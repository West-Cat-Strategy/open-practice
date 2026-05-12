import type {
  ExternalUploadReviewItem,
  ExternalUploadLinkRecord,
  ExternalUploadsListResponse,
  ExternalUploadsDashboardResponse,
  ExternalUploadsStatusResponse,
  MatterSummary,
} from "./types";

export interface ExternalUploadCreateFormState {
  matterId: string;
  maxUploads: string;
  expiresAtLocal: string;
}

export type ExternalUploadReviewDecision =
  | "accept"
  | "request_metadata"
  | "request_retry"
  | "discard";

export type ExternalUploadReviewReason =
  | "duplicate"
  | "missing_metadata"
  | "checksum_mismatch"
  | "scan_failed"
  | "wrong_matter"
  | "unreadable"
  | "other";

export const externalUploadReviewReasons: ExternalUploadReviewReason[] = [
  "duplicate",
  "missing_metadata",
  "checksum_mismatch",
  "scan_failed",
  "wrong_matter",
  "unreadable",
  "other",
];

export const externalUploadsStatusFallback: ExternalUploadsStatusResponse = {
  status: "unavailable",
  reason: "external_uploads_unavailable",
};

export function buildExternalUploadListPath(matterId: string): string {
  return `/api/external-uploads?matterId=${encodeURIComponent(matterId)}`;
}

export function buildExternalUploadRevokePath(uploadId: string): string {
  return `/api/external-uploads/${encodeURIComponent(uploadId)}/revoke`;
}

export function buildExternalUploadReviewPath(documentId: string): string {
  return `/api/external-uploads/documents/${encodeURIComponent(documentId)}/review`;
}

export function canCreateExternalUpload(status: ExternalUploadsStatusResponse): boolean {
  return status.status === "available";
}

export function coerceExternalUploadMaxUploads(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function buildExternalUploadCreatePayload(input: ExternalUploadCreateFormState): {
  matterId: string;
  maxUploads: number;
  expiresAt?: string;
} {
  const expiresAt = input.expiresAtLocal.trim()
    ? new Date(input.expiresAtLocal).toISOString()
    : undefined;

  return {
    matterId: input.matterId,
    maxUploads: coerceExternalUploadMaxUploads(input.maxUploads),
    ...(expiresAt ? { expiresAt } : {}),
  };
}

export function upsertExternalUploadLink(
  uploadsByMatterId: Record<string, ExternalUploadLinkRecord[]>,
  upload: ExternalUploadLinkRecord,
): Record<string, ExternalUploadLinkRecord[]> {
  const matterUploads = uploadsByMatterId[upload.matterId] ?? [];
  const nextMatterUploads = matterUploads.some((candidate) => candidate.id === upload.id)
    ? matterUploads.map((candidate) => (candidate.id === upload.id ? upload : candidate))
    : [upload, ...matterUploads];

  return {
    ...uploadsByMatterId,
    [upload.matterId]: nextMatterUploads,
  };
}

export function upsertExternalUploadDocument(
  reviewItemsByMatterId: Record<string, ExternalUploadReviewItem[]>,
  document: ExternalUploadReviewItem,
): Record<string, ExternalUploadReviewItem[]> {
  const matterDocuments = reviewItemsByMatterId[document.matterId] ?? [];
  const nextMatterDocuments = matterDocuments.some((candidate) => candidate.id === document.id)
    ? matterDocuments.map((candidate) => (candidate.id === document.id ? document : candidate))
    : [document, ...matterDocuments];

  return {
    ...reviewItemsByMatterId,
    [document.matterId]: nextMatterDocuments,
  };
}

export function getExternalUploadLinkState(
  upload: ExternalUploadLinkRecord,
  now = new Date(),
): "active" | "expired" | "revoked" | "used" {
  if (upload.revokedAt) return "revoked";
  if (Date.parse(upload.expiresAt) <= now.getTime()) return "expired";
  if (upload.usedUploads >= upload.maxUploads) return "used";
  return "active";
}

export function describeExternalUploadReviewState(document: ExternalUploadReviewItem): {
  label: string;
  tone: "neutral" | "ready" | "risk";
} {
  if (document.reviewStatus === "accepted") return { label: "Accepted", tone: "ready" };
  if (document.reviewStatus === "needs_metadata") {
    return { label: "Needs metadata", tone: "risk" };
  }
  if (document.reviewStatus === "pending_review") {
    return { label: "Pending review", tone: "neutral" };
  }
  if (document.reviewStatus === "retry_requested") {
    return { label: "Retry requested", tone: "risk" };
  }
  if (document.reviewStatus === "discarded") {
    return { label: "Discarded", tone: "risk" };
  }
  return { label: "Pending review", tone: "neutral" };
}

export function buildExternalUploadReviewPayload(input: {
  decision: ExternalUploadReviewDecision;
  reason?: ExternalUploadReviewReason | "";
  duplicateOfDocumentId?: string;
  note?: string;
}): Record<string, string> {
  return {
    decision: input.decision,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.duplicateOfDocumentId ? { duplicateOfDocumentId: input.duplicateOfDocumentId } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
}

export async function loadExternalUploadsDashboardData(input: {
  matters: MatterSummary[];
  getStatus: () => Promise<ExternalUploadsStatusResponse>;
  listUploadsForMatter: (matterId: string) => Promise<ExternalUploadsListResponse>;
}): Promise<ExternalUploadsDashboardResponse> {
  const [status, uploadsByMatterEntries] = await Promise.all([
    input.getStatus(),
    Promise.all(
      input.matters.map(async (matter) => {
        const response = await input.listUploadsForMatter(matter.id);
        return [matter.id, response] as const;
      }),
    ),
  ]);

  return {
    status,
    uploadsByMatterId: Object.fromEntries(
      uploadsByMatterEntries.map(([matterId, response]) => [matterId, response.uploads]),
    ),
    reviewItemsByMatterId: Object.fromEntries(
      uploadsByMatterEntries.map(([matterId, response]) => [matterId, response.reviewItems ?? []]),
    ),
  };
}
