import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AccessRequest,
  DocumentRecord,
  DocumentTextExtractionRecord,
  JobLifecycleRecord,
  ProviderSettingRecord,
} from "@open-practice/domain";
import {
  buildDocumentMetadataSearchPosture,
  buildDocumentMetadataTags,
  buildDocumentReviewSuggestions,
  redactJobMetadata,
} from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent, appendWorkflowAuditEvent } from "./audit-events.js";
import {
  buildIdempotencyKey,
  idempotencyMetadata,
  rethrowIdempotencyConflict,
} from "./idempotency.js";
import {
  actionableDocumentProcessingTasks,
  documentProcessingProviderKinds,
  documentProcessingQueueNames,
  providerStatus,
  queueStatus,
  reservedDocumentProcessingTasks,
  serializeJobRun,
  summarizeJobRuns,
} from "./job-status.js";
import { enqueueFailureError, markJobEnqueueFailed } from "./outbound-email.js";
import type { ApiJobQueue, ApiRouteDependencies } from "./types.js";

const idParamsSchema = z.object({ id: z.string().min(1) });
const documentClassificationSchema = z.enum([
  "general",
  "privileged",
  "work_product",
  "financial",
  "identity",
]);
const documentReviewStatusSchema = z.enum([
  "not_required",
  "pending_review",
  "needs_metadata",
  "accepted",
  "retry_requested",
  "discarded",
]);
const documentScanStatusSchema = z.enum(["pending", "queued", "passed", "failed", "not_required"]);
const documentOcrStatusSchema = z.enum(["not_available", "queued", "completed", "failed"]);
const documentCueGroupSchema = z.enum([
  "classification",
  "duplicate_or_supersession",
  "matter_contact",
  "missing_metadata",
]);
const workbenchQuerySchema = z.object({
  matterId: z.string().min(1),
  q: z.string().trim().max(80).optional(),
  classification: documentClassificationSchema.optional(),
  reviewStatus: documentReviewStatusSchema.optional(),
  scanStatus: documentScanStatusSchema.optional(),
  ocrStatus: documentOcrStatusSchema.optional(),
  cueGroup: documentCueGroupSchema.optional(),
  tag: z.string().trim().max(80).optional(),
});
const queueDocumentProcessingBodySchema = z.object({
  task: z.enum(["ocr"]).default("ocr"),
  language: z.string().trim().min(2).max(24).default("eng"),
});
const ocrProviderBodySchema = z.object({ enabled: z.boolean() });

const localOcrProviderKey = "local-tesseract";
const localOcrProviderEncryptedConfig = "local-tesseract:no-secret";

function localOcrProviderId(firmId: string): string {
  return `provider-ocr-local-tesseract-${firmId}`;
}

type DocumentWorkbenchGroup = "ready_to_process" | "queued_or_active" | "needs_review" | "blocked";

type QueueEligibility =
  | { eligible: true }
  | {
      eligible: false;
      reason:
        | "already_queued_or_active"
        | "ocr_queue_not_configured"
        | "ocr_provider_disabled"
        | "ocr_provider_not_configured"
        | "review_required"
        | "upload_not_verified"
        | "checksum_not_verified"
        | "scan_failed";
    };

export interface QueueDocumentOcrInput {
  repository: OpenPracticeRepository;
  ocrJobQueue?: ApiJobQueue;
  auth: ApiAuthContext;
  requestId?: string;
  document: DocumentRecord;
  language?: string;
}

export interface QueueDocumentOcrResult {
  status: "queued";
  task: "ocr";
  language: string;
  documentId: string;
  job: {
    id: string;
    queueName: "ocr";
    jobName: "extract_document_text";
    status: JobLifecycleRecord["status"];
    bullJobId?: string;
    targetResourceType: "document";
    targetResourceId: string;
    queuedAt: string;
    language: string;
    idempotencyKeyPresent: boolean;
  };
}

function assertDocumentProcessingAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function assertDocumentProcessable(document: DocumentRecord): void {
  if (document.uploadStatus !== "verified") {
    throw Object.assign(new Error("Document is not verified for processing"), { statusCode: 409 });
  }
  if (document.checksumStatus !== "verified" && document.checksumStatus !== "duplicate") {
    throw Object.assign(new Error("Document checksum is not verified for processing"), {
      statusCode: 409,
    });
  }
  if (document.scanStatus === "failed") {
    throw Object.assign(new Error("Document scan failed and cannot be processed"), {
      statusCode: 409,
    });
  }
}

function sanitizeDocument(document: DocumentRecord) {
  return {
    id: document.id,
    matterId: document.matterId,
    title: document.title,
    version: document.version,
    classification: document.classification,
    legalHold: document.legalHold,
    uploadStatus: document.uploadStatus,
    checksumStatus: document.checksumStatus,
    scanStatus: document.scanStatus,
    reviewStatus: document.reviewStatus,
    reviewDecision: document.reviewDecision,
    reviewReason: document.reviewReason,
    reviewedAt: document.reviewedAt,
    duplicateOfDocumentId: document.duplicateOfDocumentId,
    uploadedAt: document.uploadedAt,
    verifiedAt: document.verifiedAt,
  };
}

function latestByTimestamp<T>(
  records: T[],
  timestamp: (record: T) => string | undefined,
): T | undefined {
  return records
    .slice()
    .sort((left, right) => (timestamp(right) ?? "").localeCompare(timestamp(left) ?? ""))
    .at(0);
}

function latestDocumentJob(
  document: DocumentRecord,
  jobs: JobLifecycleRecord[],
): JobLifecycleRecord | undefined {
  return latestByTimestamp(
    jobs.filter(
      (job) =>
        job.targetResourceId === document.id ||
        (typeof job.metadata.documentId === "string" && job.metadata.documentId === document.id),
    ),
    (job) => job.queuedAt,
  );
}

function sanitizeTextExtraction(extraction: DocumentTextExtractionRecord | undefined) {
  if (!extraction) return undefined;
  return {
    id: extraction.id,
    engine: extraction.engine,
    status: extraction.status,
    language: extraction.language,
    confidence: extraction.confidence,
    createdAt: extraction.createdAt,
    completedAt: extraction.completedAt,
    metadata: redactJobMetadata(extraction.metadata),
  };
}

function latestTextExtraction(
  extractions: DocumentTextExtractionRecord[],
): DocumentTextExtractionRecord | undefined {
  return latestByTimestamp(
    extractions,
    (extraction) => extraction.completedAt ?? extraction.createdAt,
  );
}

function queueEligibility(input: {
  document: DocumentRecord;
  latestJob?: JobLifecycleRecord;
  ocrQueueConfigured: boolean;
  ocrProviderStatus: ReturnType<typeof providerStatus>;
}): QueueEligibility {
  if (input.latestJob?.status === "queued" || input.latestJob?.status === "active") {
    return { eligible: false, reason: "already_queued_or_active" };
  }
  if (!input.ocrQueueConfigured) return { eligible: false, reason: "ocr_queue_not_configured" };
  if (input.ocrProviderStatus.status !== "configured") {
    return {
      eligible: false,
      reason:
        input.ocrProviderStatus.reason === "provider_disabled"
          ? "ocr_provider_disabled"
          : "ocr_provider_not_configured",
    };
  }
  if (input.document.externalUploadLinkId && input.document.reviewStatus !== "accepted") {
    return { eligible: false, reason: "review_required" };
  }
  if (input.document.uploadStatus !== "verified") {
    return { eligible: false, reason: "upload_not_verified" };
  }
  if (
    input.document.checksumStatus !== "verified" &&
    input.document.checksumStatus !== "duplicate"
  ) {
    return { eligible: false, reason: "checksum_not_verified" };
  }
  if (input.document.scanStatus === "failed") return { eligible: false, reason: "scan_failed" };
  return { eligible: true };
}

function documentWorkbenchGroup(input: {
  document: DocumentRecord;
  latestJob?: JobLifecycleRecord;
  eligibility: QueueEligibility;
}): DocumentWorkbenchGroup {
  if (input.latestJob?.status === "queued" || input.latestJob?.status === "active") {
    return "queued_or_active";
  }
  if (input.document.externalUploadLinkId && input.document.reviewStatus !== "accepted") {
    return "needs_review";
  }
  return input.eligibility.eligible ? "ready_to_process" : "blocked";
}

function documentReviewQueueSummary(documents: DocumentRecord[]): {
  needsReviewCount: number;
  duplicateCandidateCount: number;
  supersessionCount: number;
  failedScanCount: number;
} {
  return {
    needsReviewCount: documents.filter(
      (document) => document.externalUploadLinkId && document.reviewStatus !== "accepted",
    ).length,
    duplicateCandidateCount: documents.filter(
      (document) => document.checksumStatus === "duplicate" || document.duplicateOfDocumentId,
    ).length,
    supersessionCount: documents.filter(
      (document) => document.supersedesDocumentId || document.supersededAt,
    ).length,
    failedScanCount: documents.filter((document) => document.scanStatus === "failed").length,
  };
}

export async function assertOcrProviderConfigured(input: {
  repository: OpenPracticeRepository;
  firmId: string;
}): Promise<void> {
  const providers = await input.repository.listProviderSettings(input.firmId, { kind: "ocr" });
  const state = providerStatus("ocr", providers);
  if (state.status === "configured") return;

  throw Object.assign(
    new Error(
      state.reason === "provider_disabled"
        ? "OCR provider is disabled"
        : "OCR provider is not configured",
    ),
    { statusCode: 503 },
  );
}

function localOcrProviderSetting(input: {
  firmId: string;
  enabled: boolean;
  now: string;
}): ProviderSettingRecord {
  return {
    id: localOcrProviderId(input.firmId),
    firmId: input.firmId,
    kind: "ocr",
    key: localOcrProviderKey,
    enabled: input.enabled,
    encryptedConfig: localOcrProviderEncryptedConfig,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export async function queueDocumentOcr(
  input: QueueDocumentOcrInput,
): Promise<QueueDocumentOcrResult> {
  const { repository, ocrJobQueue, auth, document } = input;
  if (!ocrJobQueue) {
    throw Object.assign(new Error("OCR queue is not configured"), { statusCode: 503 });
  }
  await assertOcrProviderConfigured({ repository, firmId: auth.firmId });
  assertDocumentProcessable(document);

  const language = input.language?.trim() || "eng";
  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  const metadata = {
    matterId: document.matterId,
    documentId: document.id,
    task: "ocr",
    language,
    checksumStatus: document.checksumStatus,
    scanStatus: document.scanStatus,
  };
  const idempotencyKey = buildIdempotencyKey({
    scope: "job",
    firmId: auth.firmId,
    matterId: document.matterId,
    resourceType: "document",
    resourceId: document.id,
    action: "document_processing.ocr.queue",
    providerOrTemplate: language,
  });
  const fingerprint = idempotencyMetadata(metadata);
  let job: JobLifecycleRecord;
  try {
    job = await repository.createJobLifecycleRecord({
      id: jobId,
      firmId: auth.firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "queued",
      targetResourceType: "document",
      targetResourceId: document.id,
      idempotencyKey,
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: now,
      metadata: { ...metadata, ...fingerprint },
    });
  } catch (error) {
    rethrowIdempotencyConflict(error);
  }
  const created = job.id === jobId;
  let updatedJob = job;
  if (created) {
    let bullJobId: string | undefined;
    try {
      bullJobId = (
        await ocrJobQueue.add(
          "extract_document_text",
          {
            firmId: auth.firmId,
            resourceType: "document",
            resourceId: document.id,
            metadata: {
              ...metadata,
              jobId,
              idempotencyKeyPresent: true,
            },
          },
          { jobId },
        )
      ).id?.toString();
    } catch {
      await markJobEnqueueFailed(repository, auth.firmId, job, now);
      throw enqueueFailureError();
    }
    updatedJob = await repository.updateJobLifecycleRecord(auth.firmId, job.id, { bullJobId });
  }

  if (created)
    await appendWorkflowAuditEvent(repository, auth, {
      action: "document_processing.ocr.queued",
      resourceType: "document",
      resourceId: document.id,
      occurredAt: now,
      metadata: {
        matterId: document.matterId,
        beforeStatus: document.scanStatus,
        expectedStatus: "queued",
        afterStatus: updatedJob.status,
        attemptNumber: updatedJob.attemptsMade,
        maxAttempts: updatedJob.maxAttempts,
        idempotencyKeyPresent: true,
      },
      workflow: {
        requestId: input.requestId,
        matterId: document.matterId,
        matterIds: [document.matterId],
        status: "queued",
        idempotencyKeyPresent: true,
      },
    });

  return {
    status: "queued",
    task: "ocr",
    language,
    documentId: document.id,
    job: {
      id: updatedJob.id,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: updatedJob.status,
      bullJobId: updatedJob.bullJobId,
      targetResourceType: "document",
      targetResourceId: document.id,
      queuedAt: updatedJob.queuedAt,
      language,
      idempotencyKeyPresent: Boolean(updatedJob.idempotencyKey),
    },
  };
}

export async function buildDocumentProcessingStatus(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  ocrJobQueue?: ApiJobQueue;
}) {
  const providers = await Promise.all([
    input.repository.listProviderSettings(input.firmId, { kind: "ocr" }),
    input.repository.listProviderSettings(input.firmId, { kind: "transcription" }),
    input.repository.listProviderSettings(input.firmId, { kind: "media" }),
    input.repository.listProviderSettings(input.firmId, { kind: "ai" }),
  ]);
  const providerStates = documentProcessingProviderKinds.map((kind, index) =>
    providerStatus(kind, providers[index] ?? []),
  );
  const jobs = (await input.repository.listJobLifecycleRecords(input.firmId)).filter((job) =>
    documentProcessingQueueNames.some((queueName) => queueName === job.queueName),
  );
  const workerQueues = documentProcessingQueueNames.map((queueName) =>
    queueStatus(queueName, queueName === "ocr" ? input.ocrJobQueue : undefined),
  );
  const reservedQueues = workerQueues.filter((queue) => queue.status === "reserved");
  const ocrProviderState =
    providerStates.find((providerState) => providerState.kind === "ocr") ??
    providerStatus("ocr", []);
  const configuredOcrProviders = (providers[0] ?? []).filter((provider) => provider.enabled);
  return {
    status: configuredOcrProviders.length > 0 ? "configured" : "disabled",
    reason:
      configuredOcrProviders.length > 0
        ? undefined
        : ocrProviderState.reason === "provider_disabled"
          ? "provider_disabled"
          : "not_configured",
    workers: workerQueues.filter((queue) => queue.status === "configured"),
    workerQueues,
    reservedQueues,
    supportedTasks: ["malware_scan", "ocr", "classification", "transcription", "media"],
    actionableTasks: actionableDocumentProcessingTasks,
    reservedTasks: reservedDocumentProcessingTasks,
    providers: configuredOcrProviders.map((provider) => ({
      kind: provider.kind,
      key: provider.key,
    })),
    providerStatus: providerStates,
    summary: summarizeJobRuns(jobs),
    jobs: jobs.map(serializeJobRun),
  };
}

export function registerDocumentProcessingRoutes(
  server: FastifyInstance,
  { repository, ocrJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/document-processing/status", async (request) => {
    const access = requireAccess(request.auth, {
      resource: "provider_setting",
      action: "read",
    });
    if (!access.ok) throw access.error;

    return buildDocumentProcessingStatus({
      repository,
      firmId: request.auth.firmId,
      ocrJobQueue,
    });
  });

  server.put("/api/document-processing/ocr-provider", async (request) => {
    const access = requireAccess(request.auth, {
      resource: "provider_setting",
      action: "update",
    });
    if (!access.ok) throw access.error;

    const body = parseRequestPart(ocrProviderBodySchema, request.body ?? {}, "body");
    const now = new Date().toISOString();
    const setting = await repository.upsertProviderSetting(
      localOcrProviderSetting({
        firmId: request.auth.firmId,
        enabled: body.enabled,
        now,
      }),
    );
    await appendRouteAuditEvent(repository, request.auth, {
      action: "document_processing.ocr_provider.updated",
      resourceType: "provider_setting",
      resourceId: setting.id,
      metadata: {
        providerKind: "ocr",
        providerKey: setting.key,
        enabled: setting.enabled,
      },
    });

    return buildDocumentProcessingStatus({
      repository,
      firmId: request.auth.firmId,
      ocrJobQueue,
    });
  });

  server.get("/api/document-processing/workbench", async (request) => {
    const query = parseRequestPart(workbenchQuerySchema, request.query, "query");
    assertDocumentProcessingAccess(request.auth, {
      resource: "document_processing",
      action: "read",
      matterId: query.matterId,
    });

    const providers = await Promise.all([
      repository.listProviderSettings(request.auth.firmId, { kind: "ocr" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "transcription" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "media" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "ai" }),
    ]);
    const providerStates = documentProcessingProviderKinds.map((kind, index) =>
      providerStatus(kind, providers[index] ?? []),
    );
    const ocrProviderState =
      providerStates.find((providerState) => providerState.kind === "ocr") ??
      providerStatus("ocr", []);
    const workerQueues = documentProcessingQueueNames.map((queueName) =>
      queueStatus(queueName, queueName === "ocr" ? ocrJobQueue : undefined),
    );
    const reservedQueues = workerQueues.filter((queue) => queue.status === "reserved");
    const ocrQueueConfigured = workerQueues.some(
      (queue) => queue.queueName === "ocr" && queue.status === "configured",
    );
    const documents = await repository.listMatterDocuments(request.auth.firmId, query.matterId);
    const documentIds = new Set(documents.map((document) => document.id));
    const jobs = (await repository.listJobLifecycleRecords(request.auth.firmId)).filter(
      (job) =>
        documentProcessingQueueNames.some((queueName) => queueName === job.queueName) &&
        ((typeof job.metadata.matterId === "string" && job.metadata.matterId === query.matterId) ||
          (typeof job.targetResourceId === "string" && documentIds.has(job.targetResourceId)) ||
          (typeof job.metadata.documentId === "string" &&
            documentIds.has(job.metadata.documentId))),
    );
    const matter = (await repository.listMattersForUser(request.auth.user)).find(
      (candidate) => candidate.id === query.matterId,
    );

    const documentEntries = await Promise.all(
      documents.map(async (document) => {
        const latestJob = latestDocumentJob(document, jobs);
        const eligibility = queueEligibility({
          document,
          latestJob,
          ocrQueueConfigured,
          ocrProviderStatus: ocrProviderState,
        });
        const latestExtraction = latestTextExtraction(
          await repository.getDocumentTextExtractions(request.auth.firmId, document.id),
        );
        const reviewSuggestions = buildDocumentReviewSuggestions({
          document,
          sameMatterDocuments: documents,
          latestExtraction,
          matter,
        });
        const sanitizedDocument = sanitizeDocument(document);
        const metadataTags = buildDocumentMetadataTags({
          document: sanitizedDocument,
          latestExtraction,
          latestJobStatus: latestJob?.status,
          reviewSuggestions,
        });
        return {
          item: {
            document: sanitizedDocument,
            group: documentWorkbenchGroup({ document, latestJob, eligibility }),
            queueEligibility: eligibility,
            latestJob: latestJob ? serializeJobRun(latestJob) : undefined,
            latestExtraction: sanitizeTextExtraction(latestExtraction),
            reviewSuggestions,
            metadataTags,
          },
          searchEntry: {
            document: sanitizedDocument,
            latestExtraction,
            latestJobStatus: latestJob?.status,
            reviewSuggestions,
            metadataTags,
          },
        };
      }),
    );
    const documentItems = documentEntries.map((entry) => entry.item);

    return {
      matterId: query.matterId,
      status: ocrProviderState.status === "configured" ? "configured" : "disabled",
      reason:
        ocrProviderState.status === "configured"
          ? undefined
          : ocrProviderState.reason === "provider_disabled"
            ? "provider_disabled"
            : "not_configured",
      providerStatus: providerStates,
      workerQueues,
      reservedQueues,
      actionableTasks: actionableDocumentProcessingTasks,
      reservedTasks: reservedDocumentProcessingTasks,
      reviewQueue: documentReviewQueueSummary(documents),
      metadataSearch: buildDocumentMetadataSearchPosture({
        entries: documentEntries.map((entry) => entry.searchEntry),
        filters: {
          q: query.q,
          classification: query.classification,
          reviewStatus: query.reviewStatus,
          scanStatus: query.scanStatus,
          ocrStatus: query.ocrStatus,
          cueGroup: query.cueGroup,
          tag: query.tag,
        },
      }),
      summary: summarizeJobRuns(jobs),
      documents: documentItems,
    };
  });

  server.post("/api/document-processing/documents/:id/queue", async (request, reply) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const document = await repository.getDocument(request.auth.firmId, params.id);
    if (!document) {
      throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
    }
    assertDocumentProcessingAccess(request.auth, {
      resource: "document",
      action: "update",
      matterId: document.matterId,
    });
    const body = parseRequestPart(queueDocumentProcessingBodySchema, request.body ?? {}, "body");

    return queueDocumentOcr({
      repository,
      ocrJobQueue,
      auth: request.auth,
      requestId: request.id,
      document,
      language: body.language,
    }).then((result) => reply.code(202).send(result));
  });
}
