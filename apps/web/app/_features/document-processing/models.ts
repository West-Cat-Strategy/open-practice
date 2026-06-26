export type DocumentProcessingGroup =
  | "ready_to_process"
  | "queued_or_active"
  | "needs_review"
  | "blocked";

export type DocumentProcessingDocumentClassification =
  | "general"
  | "privileged"
  | "work_product"
  | "financial"
  | "identity";

export type DocumentProcessingUploadStatus =
  | "intent_created"
  | "uploaded"
  | "verified"
  | "rejected";

export type DocumentProcessingChecksumStatus = "pending" | "verified" | "mismatch" | "duplicate";

export type DocumentProcessingScanStatus =
  | "pending"
  | "queued"
  | "passed"
  | "failed"
  | "not_required";

export type DocumentProcessingReviewStatus =
  | "not_required"
  | "pending_review"
  | "needs_metadata"
  | "accepted"
  | "retry_requested"
  | "discarded";

export type DocumentProcessingReviewDecision =
  | "accept"
  | "request_metadata"
  | "request_retry"
  | "discard";

export type DocumentProcessingReviewReason =
  | "duplicate"
  | "missing_metadata"
  | "checksum_mismatch"
  | "scan_failed"
  | "wrong_matter"
  | "unreadable"
  | "other";

export interface DocumentProcessingDocumentSummary {
  id: string;
  matterId: string;
  title: string;
  version: number;
  classification: DocumentProcessingDocumentClassification;
  legalHold: boolean;
  uploadStatus: DocumentProcessingUploadStatus;
  checksumStatus: DocumentProcessingChecksumStatus;
  scanStatus: DocumentProcessingScanStatus;
  reviewStatus: DocumentProcessingReviewStatus;
  reviewDecision?: DocumentProcessingReviewDecision;
  reviewReason?: DocumentProcessingReviewReason;
  reviewedAt?: string;
  duplicateOfDocumentId?: string;
  supersedesDocumentId?: string;
  supersededAt?: string;
  uploadedAt?: string;
  verifiedAt?: string;
}

export interface DocumentProcessingProviderStatus {
  kind: string;
  status: "configured" | "disabled" | string;
  reason?: string;
  providers?: Array<{
    key: string;
    enabled: boolean;
    disabledReason?: string;
    updatedAt?: string;
  }>;
}

export interface DocumentProcessingWorkerQueueStatus {
  queueName: string;
  status: "configured" | "not_configured" | "reserved" | string;
  reason?: string;
  task?: string;
  actionable?: boolean;
}

export interface DocumentProcessingReservedTask {
  task: string;
  queueName: string;
  status: "reserved" | string;
  reason?: string;
  actionable?: boolean;
}

export interface DocumentProcessingQueueSummary {
  queueName: string;
  total: number;
  queued: number;
  active: number;
  failed: number;
  terminal: number;
  latestQueuedAt?: string;
}

export interface DocumentProcessingSummary {
  total: number;
  queued: number;
  active: number;
  failed: number;
  terminal: number;
  byQueue?: DocumentProcessingQueueSummary[];
}

export interface DocumentProcessingJobCounts {
  total: number;
  queued: number;
  active: number;
  failed: number;
  terminal: number;
}

export interface DocumentProcessingProviderEvidencePacket {
  packet: "document_processing_provider_readiness" | string;
  posture: "op_authored_metadata_only" | string;
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
  kind: "ocr" | "ai" | "transcription" | "media" | string;
  task: "ocr" | "classification" | "transcription" | "media" | string;
  queueName: string;
  status: "ready" | "disabled" | "reserved" | string;
  reason?: string;
  actionable: boolean;
  providerStatus: "configured" | "disabled" | string;
  providerReason?: string;
  queueStatus: "configured" | "not_configured" | "reserved" | string;
  queueReason?: string;
  providerCount: number;
  enabledProviderCount: number;
  storageRequired: boolean;
  storageConfigured?: boolean;
  evidencePacket: DocumentProcessingProviderEvidencePacket;
}

export interface DocumentProcessingEvidencePacket {
  packet: "document_processing_boundary" | string;
  posture: "op_authored_metadata_only" | string;
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

export interface DocumentProcessingLatestJob {
  id: string;
  queueName: string;
  jobName?: string;
  status: string;
  terminal?: boolean;
  failed?: boolean;
  retryable?: boolean;
  attemptsMade?: number;
  maxAttempts?: number;
  queuedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  failedAt?: string;
  errorSummary?: string;
}

export interface DocumentProcessingLatestExtraction {
  id?: string;
  status?: string;
  provider?: string;
  createdAt?: string;
  completedAt?: string;
  confidence?: number;
  pageCount?: number;
  language?: string;
  summary?: string;
  errorSummary?: string;
}

export interface DocumentConversionReviewCounts {
  sourceTextLength: number;
  wordCount?: number;
  lineCount?: number;
  nonEmptyLineCount?: number;
  pageBreakCount?: number;
  estimatedPageCount?: number;
}

export interface DocumentConversionReviewPolicy {
  metadataOnly: true;
  reviewOnly: true;
  internalExtractedTextStored: true;
  rawOcrTextStored: false;
  rawOcrTextStoredInMetadata: false;
  rawOcrTextReturned: false;
  rawMarkdownStored: false;
  annotationBodiesStored: false;
  chunksStored: false;
  embeddingsStored: false;
  providerPayloadsStored: false;
}

export interface DocumentConversionReviewSummary {
  posture: "blocked" | "not_requested" | "queued" | "ready_for_review" | "failed" | string;
  summaryPosture: "op_authored_metadata_only" | string;
  jobId?: string;
  artifactId?: string;
  counts?: DocumentConversionReviewCounts;
  policy: DocumentConversionReviewPolicy;
}

export type DocumentReviewSuggestionGroup =
  | "classification"
  | "duplicate_or_supersession"
  | "matter_contact"
  | "missing_metadata"
  | "retention_review";

export interface DocumentReviewSuggestionCue {
  id: string;
  group: DocumentReviewSuggestionGroup;
  label: string;
  detail?: string;
  tone: "neutral" | "ready" | "risk";
  documentId?: string;
  relatedDocumentId?: string;
  classification?: string;
  confidence?: number;
  status?: string;
  role?: string;
  contactId?: string;
  contactName?: string;
  metadataKeys?: string[];
}

export interface DocumentReviewSuggestions {
  reviewerOnly: true;
  mutating: false;
  summaryCounts: Record<DocumentReviewSuggestionGroup | "total", number>;
  groups: Record<DocumentReviewSuggestionGroup, DocumentReviewSuggestionCue[]>;
}

export type DocumentRetentionHoldReviewDecision =
  | "needs_review"
  | "blocked_by_hold"
  | "ready_for_reviewer_packet"
  | "reviewed_keep"
  | "reviewed_superseded";

export type DocumentRetentionHoldReviewReason =
  | "legal_hold"
  | "supersession"
  | "upload_integrity"
  | "metadata_review"
  | "practice_review"
  | "other";

export interface DocumentRetentionHoldReviewRecord {
  decision: DocumentRetentionHoldReviewDecision;
  reason: DocumentRetentionHoldReviewReason;
  reviewAfter?: string;
  minimumRetainThrough?: string;
  recordedByUserId: string;
  recordedAt: string;
  sourceCueCounts: Record<DocumentReviewSuggestionGroup | "total", number>;
}

export interface DocumentRetentionHoldReview {
  reviewerOnly: true;
  mutating: false;
  destructiveAction: false;
  retentionDeadlineEnforced: false;
  legalHoldOverride: false;
  retainedExportBody: false;
  status: DocumentRetentionHoldReviewDecision;
  blockers: string[];
  sourceCueCounts: Record<DocumentReviewSuggestionGroup | "total", number>;
  latestDecision?: DocumentRetentionHoldReviewRecord;
}

export type DocumentMetadataTagGroup =
  | "classification"
  | "review_status"
  | "scan_status"
  | "legal_hold"
  | "ocr"
  | "reviewer_cue";

export type DocumentMetadataOcrStatus = "not_available" | "queued" | "completed" | "failed";

export interface DocumentMetadataTag {
  key: string;
  label: string;
  value: string;
  group: DocumentMetadataTagGroup;
  tone: "neutral" | "ready" | "risk";
  count?: number;
}

export interface DocumentMetadataSearchFilters {
  q?: string;
  classification?: DocumentProcessingDocumentClassification;
  reviewStatus?: DocumentProcessingReviewStatus;
  scanStatus?: DocumentProcessingScanStatus;
  ocrStatus?: DocumentMetadataOcrStatus;
  cueGroup?: DocumentReviewSuggestionGroup;
  tag?: string;
}

export interface DocumentMetadataSearchResultSummary {
  documentId: string;
  title: string;
  matterId: string;
  classification: DocumentProcessingDocumentClassification;
  reviewStatus: DocumentProcessingReviewStatus;
  scanStatus: DocumentProcessingScanStatus;
  legalHold: boolean;
  ocrStatus: DocumentMetadataOcrStatus;
  tagKeys: string[];
  matchedFields: string[];
  cueCounts: Record<DocumentReviewSuggestionGroup | "total", number>;
}

export interface DocumentMetadataSearchPosture {
  reviewOnly: true;
  mutating: false;
  filters: DocumentMetadataSearchFilters;
  totalCount: number;
  matchedCount: number;
  tags: DocumentMetadataTag[];
  ocrPosture: {
    rawTextSearch: false;
    rawTextReturned: false;
    searchableFields: string[];
    statusCounts: Record<DocumentMetadataOcrStatus, number>;
  };
  results: DocumentMetadataSearchResultSummary[];
}

export interface DocumentProcessingWorkbenchItem {
  document: DocumentProcessingDocumentSummary;
  group: DocumentProcessingGroup;
  queueEligibility: {
    eligible: boolean;
    reason?: string;
  };
  latestJob?: DocumentProcessingLatestJob;
  latestExtraction?: DocumentProcessingLatestExtraction;
  conversionReview?: DocumentConversionReviewSummary;
  reviewSuggestions?: DocumentReviewSuggestions;
  retentionHoldReview?: DocumentRetentionHoldReview;
  metadataTags?: DocumentMetadataTag[];
}

export interface DocumentProcessingWorkbenchResponse {
  matterId: string;
  status: "configured" | "disabled" | "available" | "unavailable" | string;
  reason?: string;
  providerStatus: DocumentProcessingProviderStatus[];
  providerReadiness?: DocumentProcessingProviderReadiness[];
  evidencePacket?: DocumentProcessingEvidencePacket;
  workerQueues: DocumentProcessingWorkerQueueStatus[];
  reservedQueues?: DocumentProcessingWorkerQueueStatus[];
  actionableTasks?: string[];
  reservedTasks?: DocumentProcessingReservedTask[];
  reviewQueue?: {
    needsReviewCount: number;
    duplicateCandidateCount: number;
    supersessionCount: number;
    failedScanCount: number;
  };
  metadataSearch?: DocumentMetadataSearchPosture;
  summary: DocumentProcessingSummary;
  documents: DocumentProcessingWorkbenchItem[];
}

export interface DocumentProcessingDashboardResponse {
  workbenchesByMatterId: Record<string, DocumentProcessingWorkbenchResponse>;
}
