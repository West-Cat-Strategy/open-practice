import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AccessRequest,
  AnswerSnapshotRecord,
  GeneratedDocumentRecord,
  IntakeSessionRecord,
} from "@open-practice/domain";
import {
  resolveEmbeddedIntakeAnswers,
  validateEmbeddedIntakeTemplateDefinition,
} from "@open-practice/domain";
import { EmbeddedAutomationProvider } from "@open-practice/providers";
import { requireAccess, requireStaffAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "./delivery-confirmation.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "./outbound-email.js";
import type { ApiRouteDependencies } from "./types.js";

const intakeSessionQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

const intakeSessionBodySchema = z.object({
  matterId: z.string().min(1),
  templateId: z.string().min(1).default("intake-template-001"),
  clientContactId: z.string().min(1).optional(),
  interviewUrl: z.string().url().optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
  deliveryConfirmation: deliveryConfirmationSchema.optional(),
});

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

const answerSnapshotBodySchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  capturedAt: z.string().datetime().optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function assertIntakeAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

async function getEmbeddedTemplate(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  templateId: string,
) {
  const template = (await repository.listIntakeTemplates(firmId)).find(
    (candidate) => candidate.id === templateId,
  );
  if (!template) {
    throw Object.assign(new Error("Intake template was not found"), { statusCode: 404 });
  }
  if (!template.active) {
    throw Object.assign(new Error("Intake template is inactive"), { statusCode: 409 });
  }
  if (template.provider === "docassemble") {
    throw Object.assign(new Error("docassemble intake templates are deprecated"), {
      statusCode: 410,
    });
  }
  validateEmbeddedIntakeTemplateDefinition(template.definition);
  return template;
}

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

export function registerIntakeRoutes(
  server: FastifyInstance,
  { repository, automationProvider, emailJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/intake-sessions", async (request) => {
    const query = parseRequestPart(intakeSessionQuerySchema, request.query, "query");
    const templates = await repository.listIntakeTemplates(request.auth.firmId);
    if (query.matterId) {
      assertIntakeAccess(request.auth, {
        resource: "intake_session",
        action: "read",
        matterId: query.matterId,
      });
      return {
        templates,
        sessions: await repository.listIntakeSessions(request.auth.firmId, query),
      };
    }
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    if (request.auth.user.role === "owner_admin" || request.auth.user.role === "auditor") {
      assertIntakeAccess(request.auth, { resource: "intake_session", action: "read" });
      return {
        templates,
        sessions: await repository.listIntakeSessions(request.auth.firmId),
      };
    }
    const sessions = await Promise.all(
      request.auth.user.assignedMatterIds.map((matterId) => {
        assertIntakeAccess(request.auth, {
          resource: "intake_session",
          action: "read",
          matterId,
        });
        return repository.listIntakeSessions(request.auth.firmId, { matterId });
      }),
    );
    return {
      templates,
      sessions: sessions.flat(),
    };
  });

  server.post("/api/intake-sessions", async (request) => {
    const body = parseRequestPart(intakeSessionBodySchema, request.body, "body");
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "create",
      matterId: body.matterId,
    });
    const template = await getEmbeddedTemplate(repository, request.auth.firmId, body.templateId);
    requireEmailDeliveryConfirmation(body.deliveryConfirmation, { recipientCount: 1 });
    const now = new Date().toISOString();
    const provider = automationProvider ?? new EmbeddedAutomationProvider();
    const providerRef = await provider.startInterview({
      firmId: request.auth.firmId,
      matterId: body.matterId,
      templateId: template.externalTemplateId,
      clientContactId: body.clientContactId,
      metadata: body.evidence,
    });
    const session: IntakeSessionRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      templateId: body.templateId,
      provider: providerRef.provider,
      externalId: providerRef.externalId,
      status: providerRef.status,
      clientContactId: body.clientContactId,
      interviewUrl: body.interviewUrl ?? providerRef.interviewUrl,
      evidence: providerRef.evidence ?? body.evidence,
      createdAt: now,
      updatedAt: now,
    };
    const created = await repository.createIntakeSession(session);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_session.created",
      resourceType: "intake_session",
      resourceId: created.id,
      occurredAt: created.createdAt,
      metadata: {
        matterId: created.matterId,
        templateId: created.templateId,
        provider: created.provider,
        status: created.status,
      },
    });
    const queuedEmail = await queueRouteEmailOutbox(repository, emailJobQueue, request.auth, {
      matterId: created.matterId,
      templateKey: "intake.session.created",
      to: [request.auth.user.email],
      subject: "Intake session created",
      textBody: `An intake session was created for matter ${created.matterId}.`,
      relatedResourceType: "intake_session",
      relatedResourceId: created.id,
      metadata: {
        intakeSessionId: created.id,
        templateId: created.templateId,
        provider: created.provider,
      },
    });
    return { ...created, queuedEmail: summarizeQueuedRouteEmail(queuedEmail) };
  });

  server.get("/api/intake-sessions/:id/answer-snapshots", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const session = await repository.getIntakeSession(request.auth.firmId, params.id);
    if (!session) {
      throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    }
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "read",
      matterId: session.matterId,
    });
    return {
      snapshots: await repository.listAnswerSnapshots(request.auth.firmId, {
        intakeSessionId: session.id,
      }),
    };
  });

  server.post("/api/intake-sessions/:id/answer-snapshots", async (request) => {
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
    const body = parseRequestPart(answerSnapshotBodySchema, request.body, "body");
    const template = await getEmbeddedTemplate(repository, request.auth.firmId, session.templateId);
    const resolution = resolveEmbeddedIntakeAnswers({
      templateId: template.id,
      templateVersion: template.definitionVersion,
      definition: template.definition,
      answers: body.answers,
    });
    const snapshot: AnswerSnapshotRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      intakeSessionId: session.id,
      capturedAt: body.capturedAt ?? new Date().toISOString(),
      answers: body.answers,
      resolution,
    };
    const created = await repository.createAnswerSnapshot(snapshot);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_answer_snapshot.created",
      resourceType: "intake_session",
      resourceId: session.id,
      occurredAt: created.capturedAt,
      metadata: {
        matterId: session.matterId,
        intakeSessionId: session.id,
        templateId: template.id,
        templateVersion: template.definitionVersion,
        answerCount: Object.keys(created.answers).length,
        visibleQuestionCount: resolution.visibleQuestionIds.length,
        eligiblePackageCount: resolution.eligiblePackageIds.length,
        selectedPackageCount: resolution.selectedPackageIds.length,
      },
    });
    return created;
  });

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
    const provider = automationProvider ?? new EmbeddedAutomationProvider();
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

    const provider = automationProvider ?? new EmbeddedAutomationProvider();
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
