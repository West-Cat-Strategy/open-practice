import type { DocumentRecord } from "@open-practice/domain";
import type {
  DocumentProcessingDashboardResponse,
  DocumentProcessingDocumentSummary,
  DocumentProcessingGroup,
  DocumentProcessingLatestExtraction,
  DocumentProcessingLatestJob,
  DocumentMetadataSearchFilters,
  DocumentMetadataSearchPosture,
  DocumentMetadataTag,
  DocumentProcessingWorkbenchItem,
  DocumentProcessingWorkbenchResponse,
  DocumentReviewSuggestionCue,
  DocumentReviewSuggestionGroup,
  DocumentReviewSuggestions,
  MatterSummary,
} from "./types";

const emptySummary = {
  total: 0,
  queued: 0,
  active: 0,
  failed: 0,
  terminal: 0,
  byQueue: [],
};

export const documentProcessingGroupOrder: DocumentProcessingGroup[] = [
  "ready_to_process",
  "queued_or_active",
  "needs_review",
  "blocked",
];

export const documentReviewSuggestionGroupOrder: DocumentReviewSuggestionGroup[] = [
  "classification",
  "duplicate_or_supersession",
  "matter_contact",
  "missing_metadata",
];

export function buildDocumentProcessingWorkbenchPath(
  matterId: string,
  filters: DocumentMetadataSearchFilters = {},
): string {
  const params = new URLSearchParams({ matterId });
  for (const [key, value] of Object.entries(filters)) {
    const normalized = typeof value === "string" ? value.trim() : value;
    if (normalized) params.set(key, String(normalized));
  }
  return `/api/document-processing/workbench?${params.toString()}`;
}

export function buildDocumentProcessingQueuePath(documentId: string): string {
  return `/api/document-processing/documents/${encodeURIComponent(documentId)}/queue`;
}

export function buildDocumentProcessingOcrProviderPath(): string {
  return "/api/document-processing/ocr-provider";
}

export function emptyDocumentMetadataSearch(
  filters: DocumentMetadataSearchFilters = {},
): DocumentMetadataSearchPosture {
  return {
    reviewOnly: true,
    mutating: false,
    filters,
    totalCount: 0,
    matchedCount: 0,
    tags: [],
    ocrPosture: {
      rawTextSearch: false,
      rawTextReturned: false,
      searchableFields: ["document_title", "op_authored_metadata", "reviewer_cue_labels"],
      statusCounts: { not_available: 0, queued: 0, completed: 0, failed: 0 },
    },
    results: [],
  };
}

export function emptyDocumentProcessingWorkbench(
  matterId: string,
  reason = "workbench_unavailable",
): DocumentProcessingWorkbenchResponse {
  return {
    matterId,
    status: "unavailable",
    reason,
    providerStatus: [],
    workerQueues: [],
    reservedQueues: [],
    actionableTasks: ["ocr"],
    reservedTasks: [],
    reviewQueue: {
      needsReviewCount: 0,
      duplicateCandidateCount: 0,
      supersessionCount: 0,
      failedScanCount: 0,
    },
    metadataSearch: emptyDocumentMetadataSearch(),
    summary: emptySummary,
    documents: [],
  };
}

export function documentProcessingDocumentSummary(
  document: Pick<
    DocumentRecord,
    | "id"
    | "matterId"
    | "title"
    | "version"
    | "classification"
    | "legalHold"
    | "uploadStatus"
    | "checksumStatus"
    | "scanStatus"
    | "reviewStatus"
    | "reviewDecision"
    | "reviewReason"
    | "reviewedAt"
    | "duplicateOfDocumentId"
    | "uploadedAt"
    | "verifiedAt"
  >,
): DocumentProcessingDocumentSummary {
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

function fallbackDocumentGroup(
  document: DocumentProcessingDocumentSummary,
): DocumentProcessingGroup {
  if (document.reviewStatus !== "accepted" && document.reviewStatus !== "not_required") {
    return "needs_review";
  }
  if (document.uploadStatus !== "verified" || document.scanStatus === "failed") return "blocked";
  if (document.checksumStatus !== "verified" && document.checksumStatus !== "duplicate") {
    return "blocked";
  }
  if (document.scanStatus === "queued") {
    return "queued_or_active";
  }
  return "ready_to_process";
}

function fallbackQueueEligibility(document: DocumentProcessingDocumentSummary): {
  eligible: boolean;
  reason?: string;
} {
  if (document.uploadStatus !== "verified") {
    return { eligible: false, reason: "document_not_verified" };
  }
  if (document.checksumStatus !== "verified" && document.checksumStatus !== "duplicate") {
    return { eligible: false, reason: "checksum_not_verified" };
  }
  if (document.scanStatus === "failed") return { eligible: false, reason: "scan_failed" };
  if (document.reviewStatus !== "accepted" && document.reviewStatus !== "not_required") {
    return { eligible: false, reason: "review_required" };
  }
  return { eligible: true };
}

export function documentProcessingRowsForMatter(
  documents: DocumentRecord[],
  workbench: DocumentProcessingWorkbenchResponse,
): DocumentProcessingWorkbenchItem[] {
  const byDocumentId = new Map(
    workbench.documents.map((item) => [item.document.id, item] as const),
  );
  const rows = documents.map((document) => {
    const workbenchItem = byDocumentId.get(document.id);
    if (workbenchItem) return workbenchItem;
    const summary = documentProcessingDocumentSummary(document);
    return {
      document: summary,
      group: fallbackDocumentGroup(summary),
      queueEligibility: fallbackQueueEligibility(summary),
    };
  });
  const matterDocumentIds = new Set(documents.map((document) => document.id));
  const extraWorkbenchRows = workbench.documents.filter(
    (item) => !matterDocumentIds.has(item.document.id),
  );
  return [...rows, ...extraWorkbenchRows];
}

export function replaceDocumentProcessingWorkbench(
  workbenchesByMatterId: Record<string, DocumentProcessingWorkbenchResponse>,
  workbench: DocumentProcessingWorkbenchResponse,
): Record<string, DocumentProcessingWorkbenchResponse> {
  return {
    ...workbenchesByMatterId,
    [workbench.matterId]: workbench,
  };
}

export function documentProcessingGroupLabel(group: DocumentProcessingGroup): string {
  if (group === "ready_to_process") return "Ready to process";
  if (group === "queued_or_active") return "Queued or active";
  if (group === "needs_review") return "Needs review";
  return "Blocked";
}

export function compactDocumentProcessingReason(value?: string): string {
  return value ? value.replaceAll("_", " ") : "none";
}

export function emptyDocumentReviewSuggestions(): DocumentReviewSuggestions {
  return {
    reviewerOnly: true,
    mutating: false,
    summaryCounts: {
      classification: 0,
      duplicate_or_supersession: 0,
      matter_contact: 0,
      missing_metadata: 0,
      total: 0,
    },
    groups: {
      classification: [],
      duplicate_or_supersession: [],
      matter_contact: [],
      missing_metadata: [],
    },
  };
}

export function documentReviewSuggestionGroupLabel(group: DocumentReviewSuggestionGroup): string {
  if (group === "classification") return "Classification";
  if (group === "duplicate_or_supersession") return "Duplicate or supersession";
  if (group === "matter_contact") return "Matter and contact";
  return "Missing metadata";
}

export function describeDocumentReviewSuggestion(cue: DocumentReviewSuggestionCue): string {
  const details = [
    cue.detail,
    cue.classification
      ? `classification ${compactDocumentProcessingReason(cue.classification)}`
      : undefined,
    typeof cue.confidence === "number"
      ? `${Math.round(cue.confidence * 100)}% confidence`
      : undefined,
    cue.role ? `role ${compactDocumentProcessingReason(cue.role)}` : undefined,
    cue.relatedDocumentId ? `related ${cue.relatedDocumentId}` : undefined,
    cue.metadataKeys?.length ? `metadata ${cue.metadataKeys.join(", ")}` : undefined,
  ].filter(Boolean);
  return details.join(" · ");
}

export function summarizeDocumentReviewSuggestions(
  rows: DocumentProcessingWorkbenchItem[],
): string {
  const total = rows.reduce(
    (sum, row) => sum + (row.reviewSuggestions?.summaryCounts.total ?? 0),
    0,
  );
  const missingMetadata = rows.reduce(
    (sum, row) => sum + (row.reviewSuggestions?.summaryCounts.missing_metadata ?? 0),
    0,
  );
  const duplicateOrSupersession = rows.reduce(
    (sum, row) => sum + (row.reviewSuggestions?.summaryCounts.duplicate_or_supersession ?? 0),
    0,
  );
  if (total === 0) return "No reviewer suggestion cues.";
  return `${total} reviewer suggestion cues. ${duplicateOrSupersession} duplicate or supersession. ${missingMetadata} missing metadata.`;
}

export function documentMetadataSearchFilterCount(
  filters: DocumentMetadataSearchFilters = {},
): number {
  return Object.values(filters).filter((value) =>
    typeof value === "string" ? value.trim() : value,
  ).length;
}

export function summarizeDocumentMetadataSearch(
  search: DocumentMetadataSearchPosture | undefined,
): string {
  if (!search) return "Metadata search posture unavailable.";
  const filterCount = documentMetadataSearchFilterCount(search.filters);
  const rawTextPosture = search.ocrPosture.rawTextSearch
    ? "Raw OCR search enabled."
    : "Raw OCR text is not searched or returned.";
  if (filterCount === 0) {
    return `${search.totalCount} documents indexed by OP-authored metadata. ${search.tags.length} tag cues. ${rawTextPosture}`;
  }
  return `${search.matchedCount}/${search.totalCount} document metadata matches across ${filterCount} filters. ${rawTextPosture}`;
}

export function compactDocumentMetadataTag(tag: DocumentMetadataTag): string {
  const count = typeof tag.count === "number" ? ` (${tag.count})` : "";
  return `${tag.label}${count}`;
}

function isReservedWorkerQueue(queue: { status?: string }): boolean {
  return queue.status === "reserved";
}

export function describeLatestDocumentJob(job?: DocumentProcessingLatestJob): {
  label: string;
  tone: "neutral" | "ready" | "risk";
} {
  if (!job) return { label: "No OCR job", tone: "neutral" };
  if (job.failed || job.status === "failed" || job.status === "dead_letter") {
    return { label: compactDocumentProcessingReason(job.status), tone: "risk" };
  }
  if (job.status === "queued" || job.status === "active") {
    return { label: compactDocumentProcessingReason(job.status), tone: "neutral" };
  }
  if (job.terminal || job.status === "completed") {
    return { label: compactDocumentProcessingReason(job.status), tone: "ready" };
  }
  return { label: compactDocumentProcessingReason(job.status), tone: "neutral" };
}

export function describeLatestExtraction(extraction?: DocumentProcessingLatestExtraction): string {
  if (!extraction) return "No extraction summary";
  const parts = [
    compactDocumentProcessingReason(extraction.status),
    extraction.language ? `language ${extraction.language}` : undefined,
    typeof extraction.pageCount === "number" ? `${extraction.pageCount} pages` : undefined,
    typeof extraction.confidence === "number"
      ? `${Math.round(extraction.confidence * 100)}% confidence`
      : undefined,
    extraction.completedAt ? `completed ${extraction.completedAt}` : undefined,
  ].filter(Boolean);
  return parts.join(" · ") || "Extraction summary available";
}

export function describeDocumentQueueAction(
  item: DocumentProcessingWorkbenchItem,
  workbench: DocumentProcessingWorkbenchResponse,
): {
  canQueue: boolean;
  label: string;
  disabledReason?: string;
  tone: "neutral" | "ready" | "risk";
} {
  if (workbench.status === "disabled" || workbench.status === "unavailable") {
    return {
      canQueue: false,
      label: "Queue OCR",
      disabledReason: compactDocumentProcessingReason(workbench.reason),
      tone: workbench.status === "disabled" ? "risk" : "neutral",
    };
  }
  const ocrQueue = workbench.workerQueues.find((queue) => queue.queueName === "ocr");
  if (ocrQueue && ocrQueue.status !== "configured") {
    return {
      canQueue: false,
      label: "Queue OCR",
      disabledReason: compactDocumentProcessingReason(ocrQueue.reason ?? ocrQueue.status),
      tone: "risk",
    };
  }
  const job = describeLatestDocumentJob(item.latestJob);
  if (item.latestJob?.status === "queued" || item.latestJob?.status === "active") {
    return {
      canQueue: false,
      label: compactDocumentProcessingReason(item.latestJob.status),
      disabledReason: "job already queued",
      tone: "neutral",
    };
  }
  if (!item.queueEligibility.eligible) {
    return {
      canQueue: false,
      label: "Queue OCR",
      disabledReason: compactDocumentProcessingReason(item.queueEligibility.reason),
      tone: "risk",
    };
  }
  if (job.tone === "risk") return { canQueue: true, label: "Retry OCR", tone: "risk" };
  return { canQueue: true, label: "Queue OCR", tone: "ready" };
}

export function summarizeDocumentProcessingWorkbench(
  workbench: DocumentProcessingWorkbenchResponse,
): string {
  const configuredProviders = workbench.providerStatus.filter(
    (provider) => provider.status === "configured",
  ).length;
  const configuredQueues = workbench.workerQueues.filter(
    (queue) => queue.status === "configured" && !isReservedWorkerQueue(queue),
  ).length;
  const actionableQueues = workbench.workerQueues.filter(
    (queue) => !isReservedWorkerQueue(queue),
  ).length;
  const reservedQueues = workbench.reservedQueues?.length
    ? workbench.reservedQueues.length
    : workbench.workerQueues.filter(isReservedWorkerQueue).length;
  const failed = workbench.summary.failed;
  const active = workbench.summary.active + workbench.summary.queued;
  if (workbench.status === "disabled") {
    return `Document processing disabled: ${compactDocumentProcessingReason(workbench.reason)}.`;
  }
  if (workbench.status === "unavailable") {
    return `Processing workbench unavailable: ${compactDocumentProcessingReason(
      workbench.reason,
    )}. Document list is preserved.`;
  }
  const reservedSuffix =
    reservedQueues > 0
      ? ` ${reservedQueues} reserved queue${reservedQueues === 1 ? "" : "s"}.`
      : "";
  return `${configuredProviders} providers configured. ${configuredQueues}/${actionableQueues} actionable worker queues configured.${reservedSuffix} ${active} active or queued jobs. ${failed} failed jobs.`;
}

export async function loadDocumentProcessingDashboardData(input: {
  matters: MatterSummary[];
  getWorkbench: (matterId: string) => Promise<DocumentProcessingWorkbenchResponse>;
}): Promise<DocumentProcessingDashboardResponse> {
  const entries = await Promise.all(
    input.matters.map(async (matter) => {
      const workbench = await input.getWorkbench(matter.id);
      return [matter.id, workbench] as const;
    }),
  );

  return {
    workbenchesByMatterId: Object.fromEntries(entries),
  };
}
