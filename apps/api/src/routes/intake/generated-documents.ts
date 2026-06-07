import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AnswerSnapshotRecord, GeneratedDocumentRecord } from "@open-practice/domain";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "../delivery-confirmation.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "../outbound-email.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertIntakeAccess, idParamsSchema, requireAutomationProvider } from "./shared.js";

const generatedDocumentBodySchema = z.object({
  title: z.string().min(1),
  externalId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  storageKey: z.string().min(1).optional(),
  checksumSha256: z.string().min(16).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
  deliveryConfirmation: deliveryConfirmationSchema.optional(),
});

const generatedPackageBodySchema = z.object({
  packageId: z.string().min(1),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

async function getQueuedEmailSummary(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
): Promise<
  | { status: "disabled"; reason: "not_configured"; provider?: undefined }
  | { status: "not_queued"; reason: "recipient_not_specified"; provider: string }
> {
  const providers = await repository.listProviderSettings(firmId, { kind: "smtp" });
  const enabled = providers.find((provider) => provider.enabled);
  if (!enabled) return { status: "disabled", reason: "not_configured" };
  return {
    status: "not_queued",
    reason: "recipient_not_specified",
    provider: enabled.key,
  };
}

function buildPackageRuntimeSummary(input: {
  snapshot: AnswerSnapshotRecord;
  packageId: string;
  documents: GeneratedDocumentRecord[];
}) {
  const packageSummary = input.snapshot.resolution.packageSummaries.find(
    (candidate) => candidate.packageId === input.packageId,
  );
  return {
    packageId: input.packageId,
    packageTitle: packageSummary?.title,
    templateId: input.snapshot.resolution.templateId,
    templateVersion: input.snapshot.resolution.templateVersion,
    answerSnapshotId: input.snapshot.id,
    replayProof: {
      capturedAt: input.snapshot.capturedAt,
      matchedBranchRuleIds: input.snapshot.resolution.matchedBranchRuleIds,
      visibleQuestionIds: input.snapshot.resolution.visibleQuestionIds,
      eligiblePackageIds: input.snapshot.resolution.eligiblePackageIds,
      selectedPackageIds: input.snapshot.resolution.selectedPackageIds,
      requiredIncompleteItemIds: input.snapshot.resolution.requiredIncompleteItemIds ?? [],
    },
    generatedDocuments: input.documents.map((document) => ({
      id: document.id,
      title: document.title,
      packageDocumentId: document.packageDocumentId,
      documentId: document.documentId,
      provider: document.provider,
    })),
  };
}

function serializeGeneratedDocument(document: GeneratedDocumentRecord) {
  return {
    id: document.id,
    matterId: document.matterId,
    intakeSessionId: document.intakeSessionId,
    provider: document.provider,
    externalId: document.externalId,
    title: document.title,
    documentId: document.documentId,
    packageId: document.packageId,
    packageDocumentId: document.packageDocumentId,
    createdAt: document.createdAt,
    evidenceSummary: {
      present: Object.keys(document.evidence).length > 0,
      keyCount: Object.keys(document.evidence).length,
    },
    storageKeyPresent: Boolean(document.storageKey),
    checksumPresent: Boolean(document.checksumSha256),
  };
}

export function registerIntakeGeneratedDocumentRoutes(
  server: FastifyInstance,
  {
    repository,
    automationProvider,
    emailJobQueue,
  }: Pick<ApiRouteDependencies, "repository" | "automationProvider" | "emailJobQueue">,
): void {
  server.post("/api/intake-sessions/:id/generated-documents", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const session = await repository.getIntakeSession(request.auth.firmId, params.id);
    if (!session) {
      throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    }
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "update",
      matterId: session.matterId,
    });
    const body = parseRequestPart(generatedDocumentBodySchema, request.body, "body");
    if (session.provider === "docassemble") {
      throw Object.assign(new Error("docassemble generated documents are deprecated"), {
        statusCode: 410,
      });
    }
    const provider = requireAutomationProvider(automationProvider);
    requireEmailDeliveryConfirmation(body.deliveryConfirmation, { recipientCount: 1 });
    const generated = await provider.renderDocument({
      firmId: request.auth.firmId,
      matterId: session.matterId,
      sessionExternalId: session.externalId,
      documentTitle: body.title,
    });
    const created = await repository.createGeneratedDocument({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: session.matterId,
      intakeSessionId: session.id,
      provider: generated.provider,
      externalId: generated.externalId,
      title: generated.title,
      documentId: body.documentId,
      storageKey: generated.storageKey ?? body.storageKey,
      checksumSha256: generated.checksumSha256 ?? body.checksumSha256,
      evidence: { ...body.evidence, ...(generated.evidence ?? {}) },
      createdAt: new Date().toISOString(),
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_generated_document.created",
      resourceType: "generated_document",
      resourceId: created.id,
      occurredAt: created.createdAt,
      metadata: {
        matterId: created.matterId,
        intakeSessionId: session.id,
        documentId: created.documentId,
        provider: created.provider,
      },
    });
    const queuedEmail = await queueRouteEmailOutbox(repository, emailJobQueue, request.auth, {
      matterId: created.matterId,
      templateKey: "intake.generated_document.created",
      to: [request.auth.user.email],
      subject: `Generated intake document: ${created.title}`,
      textBody: `A generated intake document is ready for matter ${created.matterId}.`,
      relatedResourceType: "generated_document",
      relatedResourceId: created.id,
      metadata: {
        intakeSessionId: session.id,
        documentId: created.documentId,
        provider: created.provider,
      },
    });
    return {
      ...serializeGeneratedDocument(created),
      queuedEmail: summarizeQueuedRouteEmail(queuedEmail),
    };
  });

  server.post("/api/intake-sessions/:id/generated-packages", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const session = await repository.getIntakeSession(request.auth.firmId, params.id);
    if (!session) {
      throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    }
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "update",
      matterId: session.matterId,
    });
    if (session.provider === "docassemble") {
      throw Object.assign(new Error("docassemble generated documents are deprecated"), {
        statusCode: 410,
      });
    }
    const body = parseRequestPart(generatedPackageBodySchema, request.body, "body");
    const snapshots = await repository.listAnswerSnapshots(request.auth.firmId, {
      intakeSessionId: session.id,
    });
    const latestSnapshot = [...snapshots].sort((left, right) =>
      right.capturedAt.localeCompare(left.capturedAt),
    )[0];
    if (!latestSnapshot) {
      throw Object.assign(new Error("Answer snapshot is required before package generation"), {
        statusCode: 409,
      });
    }
    if (!latestSnapshot.resolution.selectedPackageIds.includes(body.packageId)) {
      throw Object.assign(new Error("Requested package is not eligible for this intake session"), {
        statusCode: 409,
      });
    }
    const packageDocuments = latestSnapshot.resolution.packageDocuments.filter(
      (document) => document.packageId === body.packageId,
    );
    if (packageDocuments.length === 0) {
      throw Object.assign(new Error("Requested package has no resolved documents"), {
        statusCode: 409,
      });
    }

    const provider = requireAutomationProvider(automationProvider);
    const documents: GeneratedDocumentRecord[] = [];
    for (const packageDocument of packageDocuments) {
      const generated = await provider.renderDocument({
        firmId: request.auth.firmId,
        matterId: session.matterId,
        sessionExternalId: session.externalId,
        documentTitle: packageDocument.title,
        packageId: packageDocument.packageId,
        packageDocumentId: packageDocument.packageDocumentId,
      });
      documents.push(
        await repository.createGeneratedDocument({
          id: crypto.randomUUID(),
          firmId: request.auth.firmId,
          matterId: session.matterId,
          intakeSessionId: session.id,
          provider: generated.provider,
          externalId: generated.externalId,
          title: generated.title,
          packageId: packageDocument.packageId,
          packageDocumentId: packageDocument.packageDocumentId,
          storageKey: generated.storageKey,
          checksumSha256: generated.checksumSha256,
          evidence: {
            ...body.evidence,
            ...(generated.evidence ?? {}),
            answerSnapshotId: latestSnapshot.id,
          },
          createdAt: new Date().toISOString(),
        }),
      );
    }

    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake.package.generated",
      resourceType: "intake_session",
      resourceId: session.id,
      occurredAt: new Date().toISOString(),
      metadata: {
        matterId: session.matterId,
        intakeSessionId: session.id,
        templateId: latestSnapshot.resolution.templateId,
        templateVersion: latestSnapshot.resolution.templateVersion,
        answerSnapshotId: latestSnapshot.id,
        packageId: body.packageId,
        packageDocumentIds: packageDocuments.map((document) => document.packageDocumentId),
        documentCount: documents.length,
        providers: [...new Set(documents.map((document) => document.provider))],
      },
    });

    return {
      packageId: body.packageId,
      packageRuntime: buildPackageRuntimeSummary({
        snapshot: latestSnapshot,
        packageId: body.packageId,
        documents,
      }),
      documents: documents.map(serializeGeneratedDocument),
      queuedEmail: await getQueuedEmailSummary(repository, request.auth.firmId),
    };
  });
}
