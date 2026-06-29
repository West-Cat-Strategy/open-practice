import { z } from "zod";
import type {
  AccessRequest,
  DocumentRecord,
  DocumentTextExtractionRecord,
  JobLifecycleRecord,
  LegalResearchArtifactRecord,
  OpenPracticeQueueName,
  ProviderSettingKind,
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
import { providerStatus, type WorkerQueueStatus } from "../job-status.js";
import type { ApiRouteDependencies } from "../types.js";

export const idParamsSchema = z.object({ id: z.string().min(1) });
export const documentIdParamsSchema = z.object({ documentId: z.string().min(1) });

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

export const conversionReviewJobBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(180).optional(),
});

export const ocrProviderBodySchema = z.object({ enabled: z.boolean() });

const localOcrProviderKey = "local-cli-ocr";
const localOcrProviderEncryptedConfig = "local-cli-ocr:no-secret";

function localOcrProviderId(firmId: string): string {
  return `provider-ocr-local-cli-${firmId}`;
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
        | "scan_required"
        | "unsupported_file_type";
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

export const documentConversionReviewJobName = "document_conversion_review" as const;

const documentConversionReviewPolicy = {
  metadataOnly: true,
  reviewOnly: true,
  internalExtractedTextStored: true,
  rawOcrTextStored: false,
  rawOcrTextStoredInMetadata: false,
  rawOcrTextReturned: false,
  rawMarkdownStored: false,
  annotationBodiesStored: false,
  chunksStored: false,
  embeddingsStored: false,
  providerPayloadsStored: false,
} as const;

const documentConversionReviewSummaryPosture = "op_authored_metadata_only" as const;

export type DocumentConversionReviewPosture =
  | "blocked"
  | "not_requested"
  | "queued"
  | "ready_for_review"
  | "reviewed"
  | "rejected"
  | "failed";

export type DocumentConversionReviewReadinessStatus =
  | DocumentConversionReviewPosture
  | "reviewed"
  | "rejected";

type DocumentConversionReviewArtifactStatus =
  | Exclude<
      NonNullable<LegalResearchArtifactRecord["documentAnalysis"]>["artifactStatus"],
      undefined
    >
  | "not_created";

export interface DocumentConversionReviewReadiness {
  status: DocumentConversionReviewReadinessStatus;
  artifactStatus: DocumentConversionReviewArtifactStatus;
  reviewedAt?: string;
  staffReviewRequired: true;
  terminalReview: boolean;
  reviewOnly: true;
  metadataOnly: true;
  downstreamMutation: false;
  providerEvidenceStored: false;
  rawOcrTextReturned: false;
}

export interface DocumentConversionReviewDecisionCue {
  artifactId: string;
  decision: "reviewed" | "rejected";
  decidedAt: string;
  decidedByUserId: string;
  artifactStatus: DocumentConversionReviewArtifactStatus;
  reviewOnly: true;
  metadataOnly: true;
  terminalReview: true;
  downstreamMutation: false;
  providerEvidenceStored: false;
  rawOcrTextReturned: false;
}

export interface DocumentConversionReviewCounts {
  sourceTextLength: number;
  wordCount?: number;
  lineCount?: number;
  nonEmptyLineCount?: number;
  pageBreakCount?: number;
  estimatedPageCount?: number;
}

export interface DocumentConversionReviewSummary {
  posture: DocumentConversionReviewPosture;
  summaryPosture: typeof documentConversionReviewSummaryPosture;
  jobId?: string;
  artifactId?: string;
  provider?: string;
  providerStatus?: string;
  counts?: DocumentConversionReviewCounts;
  reviewReadiness: DocumentConversionReviewReadiness;
  latestDecision?: DocumentConversionReviewDecisionCue;
  decisionHistory: DocumentConversionReviewDecisionCue[];
  policy: typeof documentConversionReviewPolicy;
}

export type DocumentProcessingProviderReadinessKind = "ocr" | "ai" | "transcription" | "media";

export type DocumentProcessingProviderReadinessStatus = "ready" | "disabled" | "reserved";

export type DocumentProcessingProviderReadinessReason =
  | "deferred_worker"
  | "not_configured"
  | "provider_disabled"
  | "queue_not_configured"
  | "storage_not_configured";

export interface DocumentProcessingJobCounts {
  total: number;
  queued: number;
  active: number;
  failed: number;
  terminal: number;
}

export interface DocumentProcessingProviderEvidencePacket {
  packet: "document_processing_provider_readiness";
  posture: typeof documentConversionReviewSummaryPosture;
  reviewOnly: true;
  metadataOnly: true;
  internalExtractedTextStored: true;
  rawPrivateTextStored: false;
  rawPrivateTextStoredInMetadata: false;
  rawOcrTextStored: false;
  rawOcrTextStoredInMetadata: false;
  rawOcrTextReturned: false;
  providerPayloadsStored: false;
  providerPayloadsReturned: false;
  realProviderActivation: false;
  retainedEvidenceFields: string[];
  jobCounts: DocumentProcessingJobCounts;
}

export interface DocumentProcessingProviderReadiness {
  kind: DocumentProcessingProviderReadinessKind;
  task: "ocr" | "classification" | "transcription" | "media";
  queueName: OpenPracticeQueueName;
  status: DocumentProcessingProviderReadinessStatus;
  reason?: DocumentProcessingProviderReadinessReason;
  actionable: boolean;
  providerStatus: "configured" | "disabled";
  providerReason?: "provider_disabled" | "not_configured";
  queueStatus: WorkerQueueStatus["status"];
  queueReason?: "queue_not_configured" | "deferred_worker";
  providerCount: number;
  enabledProviderCount: number;
  storageRequired: boolean;
  storageConfigured?: boolean;
  evidencePacket: DocumentProcessingProviderEvidencePacket;
}

export interface DocumentProcessingEvidencePacket {
  packet: "document_processing_boundary";
  posture: typeof documentConversionReviewSummaryPosture;
  status: string;
  reason?: string;
  reviewOnly: true;
  metadataOnly: true;
  internalExtractedTextStored: true;
  rawPrivateTextStored: false;
  rawPrivateTextStoredInMetadata: false;
  rawOcrTextStored: false;
  rawOcrTextStoredInMetadata: false;
  rawOcrTextReturned: false;
  providerPayloadsStored: false;
  providerPayloadsReturned: false;
  realProviderActivation: false;
  providerReadinessCounts: {
    ready: number;
    disabled: number;
    reserved: number;
    actionable: number;
  };
  jobCounts: DocumentProcessingJobCounts;
}

const documentProcessingProviderReadinessTasks = {
  ocr: { task: "ocr", queueName: "ocr", actionable: true, storageRequired: true },
  ai: {
    task: "classification",
    queueName: "ai_triage",
    actionable: false,
    storageRequired: false,
  },
  transcription: {
    task: "transcription",
    queueName: "transcription",
    actionable: false,
    storageRequired: false,
  },
  media: { task: "media", queueName: "media", actionable: false, storageRequired: false },
} as const satisfies Record<
  DocumentProcessingProviderReadinessKind,
  {
    task: "ocr" | "classification" | "transcription" | "media";
    queueName: OpenPracticeQueueName;
    actionable: boolean;
    storageRequired: boolean;
  }
>;

const retainedEvidenceFields = [
  "provider_kind",
  "provider_key",
  "provider_enabled",
  "provider_updated_at",
  "queue_status",
  "task_status",
  "job_counts",
  "policy_flags",
  "internal_extracted_text_scope",
];

function isDocumentProcessingProviderReadinessKind(
  value: ProviderSettingKind,
): value is DocumentProcessingProviderReadinessKind {
  return value === "ocr" || value === "ai" || value === "transcription" || value === "media";
}

function isTerminalJobStatus(status: JobLifecycleRecord["status"]): boolean {
  return status === "completed" || status === "dead_letter" || status === "skipped";
}

function documentProcessingJobCounts(records: JobLifecycleRecord[]): DocumentProcessingJobCounts {
  return {
    total: records.length,
    queued: records.filter((record) => record.status === "queued").length,
    active: records.filter((record) => record.status === "active").length,
    failed: records.filter(
      (record) => record.status === "failed" || record.status === "dead_letter",
    ).length,
    terminal: records.filter((record) => isTerminalJobStatus(record.status)).length,
  };
}

function readinessReason(input: {
  providerState: ReturnType<typeof providerStatus>;
  queue?: WorkerQueueStatus;
  task: (typeof documentProcessingProviderReadinessTasks)[DocumentProcessingProviderReadinessKind];
  storageConfigured: boolean;
}): {
  status: DocumentProcessingProviderReadinessStatus;
  reason?: DocumentProcessingProviderReadinessReason;
} {
  if (!input.task.actionable || input.queue?.status === "reserved") {
    return { status: "reserved", reason: "deferred_worker" };
  }
  if (input.providerState.status !== "configured") {
    return {
      status: "disabled",
      reason:
        input.providerState.reason === "provider_disabled" ? "provider_disabled" : "not_configured",
    };
  }
  if (input.queue?.status !== "configured") {
    return { status: "disabled", reason: "queue_not_configured" };
  }
  if (input.task.storageRequired && !input.storageConfigured) {
    return { status: "disabled", reason: "storage_not_configured" };
  }
  return { status: "ready" };
}

export function buildDocumentProcessingProviderReadiness(input: {
  providerStates: Array<ReturnType<typeof providerStatus>>;
  workerQueues: WorkerQueueStatus[];
  jobs: JobLifecycleRecord[];
  storageConfigured: boolean;
}): DocumentProcessingProviderReadiness[] {
  return input.providerStates
    .filter(
      (
        state,
      ): state is ReturnType<typeof providerStatus> & {
        kind: DocumentProcessingProviderReadinessKind;
      } => isDocumentProcessingProviderReadinessKind(state.kind),
    )
    .map((providerState) => {
      const task = documentProcessingProviderReadinessTasks[providerState.kind];
      const queue = input.workerQueues.find((candidate) => candidate.queueName === task.queueName);
      const reason = readinessReason({
        providerState,
        queue,
        task,
        storageConfigured: input.storageConfigured,
      });
      const queueJobs = input.jobs.filter((job) => job.queueName === task.queueName);
      const enabledProviderCount = providerState.providers.filter(
        (provider) => provider.enabled,
      ).length;
      const providerReason =
        providerState.reason === "provider_disabled" || providerState.reason === "not_configured"
          ? providerState.reason
          : undefined;

      return {
        kind: providerState.kind,
        task: task.task,
        queueName: task.queueName,
        status: reason.status,
        ...(reason.reason ? { reason: reason.reason } : {}),
        actionable: task.actionable,
        providerStatus: providerState.status === "configured" ? "configured" : "disabled",
        ...(providerReason ? { providerReason } : {}),
        queueStatus: queue?.status ?? "not_configured",
        ...(queue?.reason ? { queueReason: queue.reason } : {}),
        providerCount: providerState.providers.length,
        enabledProviderCount,
        storageRequired: task.storageRequired,
        ...(task.storageRequired ? { storageConfigured: input.storageConfigured } : {}),
        evidencePacket: {
          packet: "document_processing_provider_readiness",
          posture: documentConversionReviewSummaryPosture,
          reviewOnly: true,
          metadataOnly: true,
          internalExtractedTextStored: true,
          rawPrivateTextStored: false,
          rawPrivateTextStoredInMetadata: false,
          rawOcrTextStored: false,
          rawOcrTextStoredInMetadata: false,
          rawOcrTextReturned: false,
          providerPayloadsStored: false,
          providerPayloadsReturned: false,
          realProviderActivation: false,
          retainedEvidenceFields,
          jobCounts: documentProcessingJobCounts(queueJobs),
        },
      };
    });
}

export function buildDocumentProcessingEvidencePacket(input: {
  status: string;
  reason?: string;
  readiness: DocumentProcessingProviderReadiness[];
  jobs: JobLifecycleRecord[];
}): DocumentProcessingEvidencePacket {
  return {
    packet: "document_processing_boundary",
    posture: documentConversionReviewSummaryPosture,
    status: input.status,
    ...(input.reason ? { reason: input.reason } : {}),
    reviewOnly: true,
    metadataOnly: true,
    internalExtractedTextStored: true,
    rawPrivateTextStored: false,
    rawPrivateTextStoredInMetadata: false,
    rawOcrTextStored: false,
    rawOcrTextStoredInMetadata: false,
    rawOcrTextReturned: false,
    providerPayloadsStored: false,
    providerPayloadsReturned: false,
    realProviderActivation: false,
    providerReadinessCounts: {
      ready: input.readiness.filter((item) => item.status === "ready").length,
      disabled: input.readiness.filter((item) => item.status === "disabled").length,
      reserved: input.readiness.filter((item) => item.status === "reserved").length,
      actionable: input.readiness.filter((item) => item.actionable).length,
    },
    jobCounts: documentProcessingJobCounts(input.jobs),
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

function supportedOcrFileName(value: string | undefined): boolean {
  if (!value) return false;
  const withoutQuery = value.split(/[?#]/, 1)[0]?.trim().toLowerCase();
  return Boolean(withoutQuery?.match(/\.(pdf|png|jpe?g|tiff?)$/));
}

export function documentOcrFileTypeSupported(document: DocumentRecord): boolean {
  return supportedOcrFileName(document.title) || supportedOcrFileName(document.storageKey);
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

export function assertDocumentOcrSupported(document: DocumentRecord): void {
  if (documentOcrFileTypeSupported(document)) return;
  throw Object.assign(new Error("Document file type is not supported for OCR"), {
    statusCode: 409,
  });
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
    supersedesDocumentId: document.supersedesDocumentId,
    supersededAt: document.supersededAt,
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

export function latestDocumentJob(
  document: DocumentRecord,
  jobs: JobLifecycleRecord[],
  jobNames?: string[],
): JobLifecycleRecord | undefined {
  const allowedJobNames = jobNames ? new Set(jobNames) : undefined;
  return latestByTimestamp(
    jobs.filter(
      (job) =>
        (!allowedJobNames || allowedJobNames.has(job.jobName)) &&
        (job.targetResourceId === document.id ||
          (typeof job.metadata.documentId === "string" && job.metadata.documentId === document.id)),
    ),
    (job) => job.queuedAt,
  );
}

export function latestDocumentConversionReviewJob(
  document: DocumentRecord,
  jobs: JobLifecycleRecord[],
): JobLifecycleRecord | undefined {
  return latestDocumentJob(document, jobs, [documentConversionReviewJobName]);
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

export function latestCompletedTextExtraction(
  extractions: DocumentTextExtractionRecord[],
): DocumentTextExtractionRecord | undefined {
  return latestTextExtraction(
    extractions.filter((extraction) => extraction.status === "completed"),
  );
}

function metadataNumber(value: unknown): number | undefined {
  return Number.isInteger(value) && typeof value === "number" && value >= 0 ? value : undefined;
}

export function documentExtractionTextLength(
  extraction: DocumentTextExtractionRecord | undefined,
): number {
  if (!extraction) return 0;
  if (typeof extraction.extractedText === "string") return extraction.extractedText.length;
  const textLength = metadataNumber(extraction.metadata.textLength);
  if (textLength !== undefined) return textLength;
  const sourceTextLength = metadataNumber(extraction.metadata.sourceTextLength);
  if (sourceTextLength !== undefined) return sourceTextLength;
  return 0;
}

function conversionReviewCountsFromMetadata(
  metadata: Record<string, unknown> | undefined,
): DocumentConversionReviewCounts | undefined {
  const counts = metadata?.counts;
  const record =
    counts && typeof counts === "object" && !Array.isArray(counts)
      ? (counts as Record<string, unknown>)
      : metadata;
  if (!record) return undefined;
  const sourceTextLength = metadataNumber(record.sourceTextLength);
  if (sourceTextLength === undefined) return undefined;
  return {
    sourceTextLength,
    wordCount: metadataNumber(record.wordCount),
    lineCount: metadataNumber(record.lineCount),
    nonEmptyLineCount: metadataNumber(record.nonEmptyLineCount),
    pageBreakCount: metadataNumber(record.pageBreakCount),
    estimatedPageCount: metadataNumber(record.estimatedPageCount),
  };
}

function conversionReviewCountsFromJob(
  job: JobLifecycleRecord | undefined,
): DocumentConversionReviewCounts | undefined {
  return conversionReviewCountsFromMetadata(job?.metadata);
}

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function conversionReviewReadinessStatusFromArtifact(
  artifact: LegalResearchArtifactRecord | undefined,
): DocumentConversionReviewReadinessStatus | undefined {
  if (!artifact) return undefined;
  if (artifact.status === "reviewed" || artifact.status === "rejected") {
    return artifact.status;
  }
  return "ready_for_review";
}

function buildDocumentConversionReviewReadiness(input: {
  status: DocumentConversionReviewReadinessStatus;
  artifact?: LegalResearchArtifactRecord;
}): DocumentConversionReviewReadiness {
  const artifactStatus = input.artifact ? artifactStatusFromRecord(input.artifact) : "not_created";
  const status = conversionReviewReadinessStatusFromArtifact(input.artifact) ?? input.status;
  const terminalReview = status === "reviewed" || status === "rejected";
  return {
    status,
    artifactStatus,
    ...(terminalReview && input.artifact?.reviewedAt
      ? { reviewedAt: input.artifact.reviewedAt }
      : {}),
    staffReviewRequired: true,
    terminalReview,
    reviewOnly: true,
    metadataOnly: true,
    downstreamMutation: false,
    providerEvidenceStored: false,
    rawOcrTextReturned: false,
  };
}

function artifactStatusFromRecord(
  artifact: LegalResearchArtifactRecord,
): DocumentConversionReviewArtifactStatus {
  return artifact.documentAnalysis?.artifactStatus ?? "metadata_only";
}

export function conversionReviewArtifactForDocument(
  document: DocumentRecord,
  artifacts: LegalResearchArtifactRecord[],
): LegalResearchArtifactRecord | undefined {
  return latestByTimestamp(
    artifacts.filter(
      (artifact) =>
        artifact.kind === "document_analysis_status" &&
        artifact.matterId === document.matterId &&
        artifact.documentAnalysis?.documentId === document.id,
    ),
    (artifact) => artifact.updatedAt,
  );
}

const maxConversionReviewDecisionHistory = 5;

function conversionReviewDecisionCue(
  artifact: LegalResearchArtifactRecord,
): DocumentConversionReviewDecisionCue | undefined {
  const decision =
    artifact.reviewDecision === "reviewed" || artifact.reviewDecision === "rejected"
      ? artifact.reviewDecision
      : artifact.status === "reviewed" || artifact.status === "rejected"
        ? artifact.status
        : undefined;
  if (!decision || !artifact.reviewedAt || !artifact.reviewedByUserId) return undefined;
  return {
    artifactId: artifact.id,
    decision,
    decidedAt: artifact.reviewedAt,
    decidedByUserId: artifact.reviewedByUserId,
    artifactStatus: artifactStatusFromRecord(artifact),
    reviewOnly: true,
    metadataOnly: true,
    terminalReview: true,
    downstreamMutation: false,
    providerEvidenceStored: false,
    rawOcrTextReturned: false,
  };
}

function conversionReviewDecisionHistory(input: {
  document: DocumentRecord;
  artifacts?: LegalResearchArtifactRecord[];
}): DocumentConversionReviewDecisionCue[] {
  return (input.artifacts ?? [])
    .filter(
      (artifact) =>
        artifact.kind === "document_analysis_status" &&
        artifact.matterId === input.document.matterId &&
        artifact.documentAnalysis?.documentId === input.document.id &&
        (artifact.status === "reviewed" || artifact.status === "rejected"),
    )
    .map(conversionReviewDecisionCue)
    .filter((cue): cue is DocumentConversionReviewDecisionCue => Boolean(cue))
    .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt))
    .slice(0, maxConversionReviewDecisionHistory);
}

export function buildDocumentConversionReviewSummary(input: {
  document: DocumentRecord;
  latestExtraction?: DocumentTextExtractionRecord;
  latestJob?: JobLifecycleRecord;
  artifact?: LegalResearchArtifactRecord;
  artifacts?: LegalResearchArtifactRecord[];
}): DocumentConversionReviewSummary {
  const decisionHistory = conversionReviewDecisionHistory({
    document: input.document,
    artifacts: input.artifacts ?? (input.artifact ? [input.artifact] : []),
  });
  const decisionCues = {
    ...(decisionHistory[0] ? { latestDecision: decisionHistory[0] } : {}),
    decisionHistory,
  };
  const artifactCounts = conversionReviewCountsFromMetadata(input.artifact?.metadata);
  if (input.artifact) {
    const reviewReadiness = buildDocumentConversionReviewReadiness({
      status: "ready_for_review",
      artifact: input.artifact,
    });
    return {
      posture: reviewReadiness.status,
      summaryPosture: documentConversionReviewSummaryPosture,
      jobId:
        typeof input.artifact.metadata.jobId === "string"
          ? input.artifact.metadata.jobId
          : input.latestJob?.id,
      artifactId: input.artifact.id,
      provider: metadataString(input.artifact.metadata, "provider"),
      providerStatus: metadataString(input.artifact.metadata, "providerStatus"),
      counts: artifactCounts,
      reviewReadiness,
      ...decisionCues,
      policy: documentConversionReviewPolicy,
    };
  }

  if (input.latestJob?.status === "queued" || input.latestJob?.status === "active") {
    return {
      posture: "queued",
      summaryPosture: documentConversionReviewSummaryPosture,
      jobId: input.latestJob.id,
      provider: metadataString(input.latestJob.metadata, "provider"),
      providerStatus: metadataString(input.latestJob.metadata, "providerStatus"),
      counts: conversionReviewCountsFromJob(input.latestJob),
      reviewReadiness: buildDocumentConversionReviewReadiness({ status: "queued" }),
      ...decisionCues,
      policy: documentConversionReviewPolicy,
    };
  }
  if (input.latestJob?.status === "failed" || input.latestJob?.status === "dead_letter") {
    return {
      posture: "failed",
      summaryPosture: documentConversionReviewSummaryPosture,
      jobId: input.latestJob.id,
      provider: metadataString(input.latestJob.metadata, "provider"),
      providerStatus: metadataString(input.latestJob.metadata, "providerStatus"),
      counts: conversionReviewCountsFromJob(input.latestJob),
      reviewReadiness: buildDocumentConversionReviewReadiness({ status: "failed" }),
      ...decisionCues,
      policy: documentConversionReviewPolicy,
    };
  }
  if (input.latestJob?.status === "completed") {
    return {
      posture: "ready_for_review",
      summaryPosture: documentConversionReviewSummaryPosture,
      jobId: input.latestJob.id,
      provider: metadataString(input.latestJob.metadata, "provider"),
      providerStatus: metadataString(input.latestJob.metadata, "providerStatus"),
      counts: conversionReviewCountsFromJob(input.latestJob),
      reviewReadiness: buildDocumentConversionReviewReadiness({ status: "ready_for_review" }),
      ...decisionCues,
      policy: documentConversionReviewPolicy,
    };
  }

  if (
    input.document.uploadStatus !== "verified" ||
    (input.document.checksumStatus !== "verified" &&
      input.document.checksumStatus !== "duplicate") ||
    !documentScanSafeForOcr(input.document) ||
    input.latestExtraction?.status !== "completed"
  ) {
    return {
      posture: "blocked",
      summaryPosture: documentConversionReviewSummaryPosture,
      reviewReadiness: buildDocumentConversionReviewReadiness({ status: "blocked" }),
      ...decisionCues,
      policy: documentConversionReviewPolicy,
    };
  }

  return {
    posture: "not_requested",
    summaryPosture: documentConversionReviewSummaryPosture,
    counts: {
      sourceTextLength: documentExtractionTextLength(input.latestExtraction),
    },
    reviewReadiness: buildDocumentConversionReviewReadiness({ status: "not_requested" }),
    ...decisionCues,
    policy: documentConversionReviewPolicy,
  };
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
  if (!documentOcrFileTypeSupported(input.document)) {
    return { eligible: false, reason: "unsupported_file_type" };
  }
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
