import {
  buildPublicTokenPath,
  publicTokenErrorMessage,
  type PublicTokenErrorBody,
} from "../publicTokenClient";
import type { PublicTokenActionItem } from "../publicTokenActions";

export const externalUploadClassifications = [
  "general",
  "privileged",
  "work_product",
  "financial",
  "identity",
] as const;

export type ExternalUploadClassification = (typeof externalUploadClassifications)[number];

export interface PublicExternalUploadPayload {
  upload: {
    id: string;
    status: string;
    expiresAt: string;
    maxUploads: number;
    usedUploads: number;
  };
  acceptedClassifications: ExternalUploadClassification[];
  documents: PublicExternalUploadDocument[];
}

export interface PublicExternalUploadDocument {
  id: string;
  title: string;
  version?: number;
  classification: string;
  legalHold: boolean;
  uploadStatus: string;
  checksumStatus?: string;
  scanStatus: string;
  reviewStatus: string;
  reviewReason?: string;
  reviewedAt?: string;
}

export interface PublicExternalUploadIntentResponse {
  method: "PUT";
  uploadUrl: string;
  expiresInSeconds: number;
  document: PublicExternalUploadDocument;
  requiredHeaders?: Record<string, string>;
  maxFileSizeBytes?: number;
}

export function buildPublicExternalUploadPath(token: string): string {
  return buildPublicTokenPath("/api/portal/external-uploads", token);
}

export function buildPublicExternalUploadIntentPath(token: string): string {
  return buildPublicTokenPath("/api/portal/external-uploads", token, "intents");
}

export function buildPublicExternalUploadCompletePath(token: string, documentId: string): string {
  return buildPublicTokenPath(
    "/api/portal/external-uploads",
    token,
    "documents",
    documentId,
    "complete",
  );
}

export function publicExternalUploadErrorMessage(
  body: PublicTokenErrorBody,
  fallback: string,
): string {
  return publicTokenErrorMessage(body, fallback);
}

export function remainingUploadCount(payload: PublicExternalUploadPayload): number {
  return Math.max(0, payload.upload.maxUploads - payload.upload.usedUploads);
}

export function canUploadExternalDocument(payload: PublicExternalUploadPayload | null): boolean {
  return Boolean(
    payload && payload.upload.status === "active" && remainingUploadCount(payload) > 0,
  );
}

export function canRetryExternalUploadDocument(
  payload: PublicExternalUploadPayload | null,
  document: PublicExternalUploadDocument,
): boolean {
  return document.reviewStatus === "retry_requested" && canUploadExternalDocument(payload);
}

export function externalUploadLifecycleMessage(
  payload: PublicExternalUploadPayload | null,
): string {
  if (!payload) return "Loading upload link...";
  if (payload.upload.status === "active") {
    const remaining = remainingUploadCount(payload);
    return remaining === 1
      ? "Upload link ready. 1 upload remains."
      : `Upload link ready. ${remaining} uploads remain.`;
  }
  if (payload.upload.status === "exhausted") {
    return "This upload link has already been used.";
  }
  return `This upload link is ${payload.upload.status}.`;
}

export function buildExternalUploadIntentPayload(input: {
  file: Pick<File, "name" | "type" | "size">;
  checksumSha256: string;
  classification: ExternalUploadClassification;
  legalHold: boolean;
}): {
  filename: string;
  checksumSha256: string;
  fileSizeBytes: number;
  contentType: string;
  classification: ExternalUploadClassification;
  legalHold: boolean;
} {
  return {
    filename: input.file.name,
    checksumSha256: input.checksumSha256,
    fileSizeBytes: input.file.size,
    contentType: input.file.type || "application/octet-stream",
    classification: input.classification,
    legalHold: input.legalHold,
  };
}

export function buildExternalUploadPutHeaders(input: {
  file: Pick<File, "type">;
  requiredHeaders?: Record<string, string>;
}): Record<string, string> {
  return {
    "Content-Type": input.file.type || "application/octet-stream",
    ...(input.requiredHeaders ?? {}),
  };
}

export function describeExternalUploadPutFailure(status: number): string {
  return `Upload failed: ${status}`;
}

export function describeExternalUploadCompletion(document: PublicExternalUploadDocument): string {
  if (document.uploadStatus === "verified") {
    return "Upload complete. The document is ready for staff review.";
  }
  return `Upload recorded with status ${document.uploadStatus}.`;
}

export function describeExternalUploadDocumentStatus(document: PublicExternalUploadDocument): {
  label: string;
  detail: string;
  tone: "neutral" | "ready" | "risk";
} {
  if (
    document.uploadStatus === "rejected" ||
    document.checksumStatus === "mismatch" ||
    document.scanStatus === "failed"
  ) {
    return {
      label: "Upload check failed",
      detail:
        "The file could not be verified. Upload another copy if this link still accepts files.",
      tone: "risk",
    };
  }
  if (document.reviewStatus === "accepted") {
    return {
      label: "Accepted",
      detail: document.reviewedAt
        ? `Staff accepted this document on ${new Date(document.reviewedAt).toLocaleString()}.`
        : "Staff accepted this document.",
      tone: "ready",
    };
  }
  if (document.reviewStatus === "needs_metadata") {
    return {
      label: "Needs metadata",
      detail: "Staff needs more information and will follow up outside this page.",
      tone: "risk",
    };
  }
  if (document.reviewStatus === "retry_requested") {
    return {
      label: "Retry requested",
      detail: "Please upload a clearer replacement if this link still accepts uploads.",
      tone: "risk",
    };
  }
  if (document.reviewStatus === "discarded") {
    return {
      label: "Not accepted",
      detail: "Staff did not accept this upload and may follow up separately.",
      tone: "risk",
    };
  }
  if (document.uploadStatus === "intent_created") {
    return {
      label: "Upload started",
      detail: "The upload was started, but completion has not been recorded yet.",
      tone: "neutral",
    };
  }
  return {
    label: "Awaiting review",
    detail: "Upload complete. Staff review is pending.",
    tone: "neutral",
  };
}

export function externalUploadAttentionItems(
  payload: PublicExternalUploadPayload | null,
): PublicTokenActionItem[] {
  if (!payload) return [];

  const items: PublicTokenActionItem[] = [];
  const remaining = remainingUploadCount(payload);
  if (canUploadExternalDocument(payload)) {
    items.push({
      id: "external-upload-open",
      title: remaining === 1 ? "Upload requested document" : "Upload requested documents",
      detail:
        remaining === 1
          ? "One upload remains on this secure link."
          : `${remaining} uploads remain on this secure link.`,
      status: "open",
    });
  }

  for (const document of payload.documents) {
    if (canRetryExternalUploadDocument(payload, document)) {
      items.push({
        id: `external-upload-retry-${document.id}`,
        title: `Replace ${document.title}`,
        detail: "Staff requested a replacement upload for this document.",
        status: "retry",
        tone: "risk",
      });
      continue;
    }

    if (document.reviewStatus === "needs_metadata") {
      items.push({
        id: `external-upload-metadata-${document.id}`,
        title: `Follow up on ${document.title}`,
        detail: "Staff needs more information and will follow up outside this page.",
        status: "follow up",
        tone: "risk",
      });
    }
  }

  return items;
}

export function upsertPublicExternalUploadDocument(
  documents: PublicExternalUploadDocument[],
  document: PublicExternalUploadDocument,
): PublicExternalUploadDocument[] {
  return documents.some((candidate) => candidate.id === document.id)
    ? documents.map((candidate) => (candidate.id === document.id ? document : candidate))
    : [document, ...documents];
}
