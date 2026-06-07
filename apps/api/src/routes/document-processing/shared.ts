import { z } from "zod";
import type {
  AccessRequest,
  DocumentRecord,
  DocumentTextExtractionRecord,
  JobLifecycleRecord,
  ProviderSettingRecord,
} from "@open-practice/domain";
import {
  allowedOcrLanguages,
  normalizeOcrLanguage,
  redactJobMetadata,
} from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { requireAccess } from "../../http/auth-guards.js";
import type { ApiAuthContext } from "../../server.js";
import { providerStatus } from "../job-status.js";
import type { ApiRouteDependencies } from "../types.js";

export const idParamsSchema = z.object({ id: z.string().min(1) });

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
  "retention_review",
]);

export const workbenchQuerySchema = z.object({
  matterId: z.string().min(1),
  q: z.string().trim().max(80).optional(),
  classification: documentClassificationSchema.optional(),
  reviewStatus: documentReviewStatusSchema.optional(),
  scanStatus: documentScanStatusSchema.optional(),
  ocrStatus: documentOcrStatusSchema.optional(),
  cueGroup: documentCueGroupSchema.optional(),
  tag: z.string().trim().max(80).optional(),
});

export const queueDocumentProcessingBodySchema = z.object({
  task: z.enum(["ocr"]).default("ocr"),
  language: z.enum(allowedOcrLanguages).default("eng"),
});

export const ocrProviderBodySchema = z.object({ enabled: z.boolean() });

const localOcrProviderKey = "local-tesseract";
const localOcrProviderEncryptedConfig = "local-tesseract:no-secret";

function localOcrProviderId(firmId: string): string {
  return `provider-ocr-local-tesseract-${firmId}`;
}

export type DocumentWorkbenchGroup =
  | "ready_to_process"
  | "queued_or_active"
  | "needs_review"
  | "blocked";

export type QueueEligibility =
  | { eligible: true }
  | {
      eligible: false;
      reason:
        | "already_queued_or_active"
        | "ocr_queue_not_configured"
        | "ocr_storage_not_configured"
        | "ocr_provider_disabled"
        | "ocr_provider_not_configured"
        | "review_required"
        | "upload_not_verified"
        | "checksum_not_verified"
        | "scan_required";
    };

export interface QueueDocumentOcrInput {
  repository: OpenPracticeRepository;
  ocrJobQueue?: ApiRouteDependencies["ocrJobQueue"];
  s3?: ApiRouteDependencies["s3"];
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

export function assertDocumentProcessingAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function normalizeDocumentOcrLanguage(language?: string): string {
  return normalizeOcrLanguage(language);
}

function documentScanSafeForOcr(document: DocumentRecord): boolean {
  return document.scanStatus === "passed" || document.scanStatus === "not_required";
}

export function assertDocumentProcessable(document: DocumentRecord): void {
  if (document.uploadStatus !== "verified") {
    throw Object.assign(new Error("Document is not verified for processing"), { statusCode: 409 });
  }
  if (document.checksumStatus !== "verified" && document.checksumStatus !== "duplicate") {
    throw Object.assign(new Error("Document checksum is not verified for processing"), {
      statusCode: 409,
    });
  }
  if (!documentScanSafeForOcr(document)) {
    throw Object.assign(new Error("Document scan must pass before OCR processing"), {
      statusCode: 409,
    });
  }
}

export function sanitizeDocument(document: DocumentRecord) {
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

export function latestByTimestamp<T>(
  records: T[],
  timestamp: (record: T) => string | undefined,
): T | undefined {
  return records
    .slice()
    .sort((left, right) => (timestamp(right) ?? "").localeCompare(timestamp(left) ?? ""))
    .at(0);
}

export function latestDocumentJob(
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

export function sanitizeTextExtraction(extraction: DocumentTextExtractionRecord | undefined) {
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

export function latestTextExtraction(
  extractions: DocumentTextExtractionRecord[],
): DocumentTextExtractionRecord | undefined {
  return latestByTimestamp(
    extractions,
    (extraction) => extraction.completedAt ?? extraction.createdAt,
  );
}

export function queueEligibility(input: {
  document: DocumentRecord;
  latestJob?: JobLifecycleRecord;
  ocrQueueConfigured: boolean;
  ocrStorageConfigured: boolean;
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
  if (!input.ocrStorageConfigured) return { eligible: false, reason: "ocr_storage_not_configured" };
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
  if (!documentScanSafeForOcr(input.document)) return { eligible: false, reason: "scan_required" };
  return { eligible: true };
}

export function documentWorkbenchGroup(input: {
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

export function documentReviewQueueSummary(documents: DocumentRecord[]): {
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

export function localOcrProviderSetting(input: {
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
