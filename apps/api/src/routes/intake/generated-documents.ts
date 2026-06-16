import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AnswerSnapshotRecord,
  GeneratedDocumentRecord,
  JobLifecycleRecord,
} from "@open-practice/domain";
import { redactJobMetadata } from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
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

const generatedPackageJobParamsSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
});

const ASSEMBLE_INTAKE_GENERATED_PACKAGE_JOB = "assemble_intake_generated_package";

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

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function latestAnswerSnapshot(snapshots: AnswerSnapshotRecord[]): AnswerSnapshotRecord | undefined {
  return [...snapshots].sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0];
}

function generatedPackageJobId(): string {
  return `intake-package-assembly-${crypto.randomUUID()}`;
}

function serializeGeneratedPackageAssemblyRequest(input: {
  job: JobLifecycleRecord;
  intakeSessionId: string;
  snapshot?: AnswerSnapshotRecord;
  packageId?: string;
  packageTitle?: string;
  documentCount?: number;
}) {
  const packageId =
    input.packageId ??
    (typeof input.job.metadata.packageId === "string" ? input.job.metadata.packageId : undefined);
  const answerSnapshotId =
    input.snapshot?.id ??
    (typeof input.job.metadata.answerSnapshotId === "string"
      ? input.job.metadata.answerSnapshotId
      : undefined);
  const documentCount =
    input.documentCount ??
    (typeof input.job.metadata.packageDocumentCount === "number"
      ? input.job.metadata.packageDocumentCount
      : undefined);

  return {
    jobId: input.job.id,
    status: input.job.status,
    queuedAt: input.job.queuedAt,
    startedAt: input.job.startedAt,
    finishedAt: input.job.finishedAt,
    failedAt: input.job.failedAt,
    errorMessage: input.job.errorMessage,
    packageId,
    packageTitle: input.packageTitle,
    answerSnapshotId,
    documentCount,
    queue: {
      queueName: input.job.queueName,
      status: input.job.status === "queued" ? "queued" : input.job.status,
    },
    pollUrl: `/api/intake-sessions/${input.intakeSessionId}/generated-packages/${input.job.id}`,
  };
}

async function findGeneratedPackageAssemblyJob(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  jobId: string,
): Promise<JobLifecycleRecord | undefined> {
  return (
    await repository.listJobLifecycleRecords(firmId, { queueName: "document_assembly" })
  ).find(
    (job) =>
      job.id === jobId &&
      job.jobName === ASSEMBLE_INTAKE_GENERATED_PACKAGE_JOB &&
      job.targetResourceType === "intake_generated_package",
  );
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
    documentAssemblyJobQueue,
  }: Pick<
    ApiRouteDependencies,
    "repository" | "automationProvider" | "emailJobQueue" | "documentAssemblyJobQueue"
  >,
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

  server.post("/api/intake-sessions/:id/generated-packages", async (request, reply) => {
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
    const latestSnapshot = latestAnswerSnapshot(snapshots);
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
    if (!documentAssemblyJobQueue) {
      throw new ApiHttpError(
        503,
        "DOCUMENT_ASSEMBLY_QUEUE_NOT_CONFIGURED",
        "Document assembly queue is not configured",
      );
    }

    const jobId = generatedPackageJobId();
    const now = new Date().toISOString();
    const packageSummary = latestSnapshot.resolution.packageSummaries.find(
      (candidate) => candidate.packageId === body.packageId,
    );
    const metadata = redactJobMetadata(
      compactMetadata({
        matterId: session.matterId,
        intakeSessionId: session.id,
        answerSnapshotId: latestSnapshot.id,
        templateId: latestSnapshot.resolution.templateId,
        templateVersion: latestSnapshot.resolution.templateVersion,
        packageId: body.packageId,
        packageDocumentCount: packageDocuments.length,
        requestedByUserId: request.auth.user.id,
        enqueueStatus: "queued_for_local_document_assembly_worker",
      }),
    );

    const job = await repository.createJobLifecycleRecord({
      id: jobId,
      firmId: request.auth.firmId,
      queueName: "document_assembly",
      jobName: ASSEMBLE_INTAKE_GENERATED_PACKAGE_JOB,
      bullJobId: jobId,
      status: "queued",
      targetResourceType: "intake_generated_package",
      targetResourceId: jobId,
      attemptsMade: 0,
      maxAttempts: 2,
      queuedAt: now,
      metadata,
    });

    try {
      await documentAssemblyJobQueue.add(
        ASSEMBLE_INTAKE_GENERATED_PACKAGE_JOB,
        {
          firmId: request.auth.firmId,
          resourceType: "intake_generated_package",
          resourceId: job.id,
          metadata,
        },
        { jobId: job.id },
      );
    } catch (error) {
      await repository.updateJobLifecycleRecord(request.auth.firmId, job.id, {
        status: "failed",
        failedAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake.package.assembly_requested",
      resourceType: "intake_session",
      resourceId: session.id,
      occurredAt: now,
      metadata,
    });

    reply.status(202);
    return {
      assemblyRequest: serializeGeneratedPackageAssemblyRequest({
        job,
        intakeSessionId: session.id,
        snapshot: latestSnapshot,
        packageId: body.packageId,
        packageTitle: packageSummary?.title,
        documentCount: packageDocuments.length,
      }),
    };
  });

  server.get("/api/intake-sessions/:id/generated-packages/:jobId", async (request) => {
    const params = parseRequestPart(generatedPackageJobParamsSchema, request.params, "params");
    const session = await repository.getIntakeSession(request.auth.firmId, params.id);
    if (!session) {
      throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    }
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "read",
      matterId: session.matterId,
    });
    const job = await findGeneratedPackageAssemblyJob(
      repository,
      request.auth.firmId,
      params.jobId,
    );
    if (!job || job.metadata.intakeSessionId !== session.id) {
      throw new ApiHttpError(404, "PACKAGE_ASSEMBLY_NOT_FOUND", "Package assembly was not found");
    }

    const documents =
      job.status === "completed"
        ? (
            await repository.listGeneratedDocuments(request.auth.firmId, {
              matterId: session.matterId,
            })
          ).filter(
            (document) =>
              document.intakeSessionId === session.id &&
              document.packageId === job.metadata.packageId,
          )
        : [];

    const snapshots = await repository.listAnswerSnapshots(request.auth.firmId, {
      intakeSessionId: session.id,
    });
    const snapshot = snapshots.find((candidate) => candidate.id === job.metadata.answerSnapshotId);

    return {
      assemblyRequest: serializeGeneratedPackageAssemblyRequest({
        job,
        intakeSessionId: session.id,
        snapshot,
      }),
      packageRuntime:
        job.status === "completed" && snapshot && typeof job.metadata.packageId === "string"
          ? buildPackageRuntimeSummary({
              snapshot,
              packageId: job.metadata.packageId,
              documents,
            })
          : undefined,
      documents: documents.map(serializeGeneratedDocument),
      queuedEmail: await getQueuedEmailSummary(repository, request.auth.firmId),
    };
  });
}
