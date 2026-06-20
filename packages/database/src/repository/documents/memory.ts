import type { DocumentRecord, DocumentTextExtractionRecord } from "@open-practice/domain";
import { clone } from "../contracts.js";
import type { DocumentRepository, DocumentUploadIntent } from "../documents-contracts.js";

export interface MemoryDocumentStore {
  documents: DocumentRecord[];
  documentTextExtractions: DocumentTextExtractionRecord[];
}

export function getMemoryDocument(
  store: MemoryDocumentStore,
  firmId: string,
  documentId: string,
): DocumentRecord | undefined {
  return clone(
    store.documents.find((document) => document.firmId === firmId && document.id === documentId),
  );
}

export function listMemoryMatterDocuments(
  store: MemoryDocumentStore,
  firmId: string,
  matterId: string,
): DocumentRecord[] {
  return clone(
    store.documents.filter(
      (document) => document.firmId === firmId && document.matterId === matterId,
    ),
  );
}

export function createMemoryDocumentUploadIntent(
  store: MemoryDocumentStore,
  input: DocumentUploadIntent,
): DocumentRecord {
  const supersededDocument = input.supersedesDocumentId
    ? store.documents.find(
        (candidate) =>
          candidate.firmId === input.firmId &&
          candidate.matterId === input.matterId &&
          candidate.id === input.supersedesDocumentId,
      )
    : undefined;
  if (input.supersedesDocumentId && !supersededDocument) {
    throw new Error(`Unknown superseded document ${input.supersedesDocumentId}`);
  }
  const now = new Date().toISOString();
  if (supersededDocument) {
    supersededDocument.supersededAt = now;
  }
  const document: DocumentRecord = {
    id: input.id,
    firmId: input.firmId,
    matterId: input.matterId,
    title: input.title,
    storageKey: input.storageKey,
    checksumSha256: input.checksumSha256,
    sizeBytes: input.sizeBytes,
    version: supersededDocument ? supersededDocument.version + 1 : 1,
    classification: input.classification,
    legalHold: input.legalHold,
    uploadStatus: "intent_created",
    checksumStatus: "pending",
    scanStatus: "pending",
    reviewStatus: input.reviewStatus ?? "not_required",
    reviewMetadata: {},
    externalUploadLinkId: input.externalUploadLinkId,
    supersedesDocumentId: input.supersedesDocumentId,
    createdAt: now,
  };
  store.documents.push(clone(document));
  return clone(document);
}

export function completeMemoryDocumentUpload(
  store: MemoryDocumentStore,
  input: {
    firmId: string;
    documentId: string;
    checksumSha256: string;
    scanStatus?: DocumentRecord["scanStatus"];
  },
): DocumentRecord {
  const document = store.documents.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.documentId,
  );
  if (!document) throw new Error(`Unknown document ${input.documentId}`);

  const duplicate = store.documents.find(
    (candidate) =>
      candidate.firmId === input.firmId &&
      candidate.id !== input.documentId &&
      candidate.matterId === document.matterId &&
      candidate.checksumSha256 === input.checksumSha256 &&
      candidate.checksumStatus === "verified",
  );
  const now = new Date().toISOString();
  document.uploadedAt = now;
  document.verifiedAt = now;

  if (document.checksumSha256 !== input.checksumSha256) {
    document.uploadStatus = "rejected";
    document.checksumStatus = "mismatch";
    document.scanStatus = "failed";
    if (document.externalUploadLinkId) {
      document.reviewStatus = "retry_requested";
      document.reviewReason = "checksum_mismatch";
      document.reviewMetadata = { automatedOutcome: "checksum_mismatch" };
    }
    return clone(document);
  }

  document.uploadStatus = "verified";
  document.checksumStatus = duplicate ? "duplicate" : "verified";
  document.duplicateOfDocumentId = duplicate?.id;
  document.scanStatus = input.scanStatus ?? "queued";
  document.reviewStatus = document.externalUploadLinkId ? "pending_review" : "not_required";
  document.reviewReason = duplicate ? "duplicate" : undefined;
  document.reviewMetadata = duplicate
    ? { automatedOutcome: "duplicate_detected", duplicateOfDocumentId: duplicate.id }
    : {};
  return clone(document);
}

export function updateMemoryDocumentScanStatus(
  store: MemoryDocumentStore,
  input: {
    firmId: string;
    documentId: string;
    scanStatus: DocumentRecord["scanStatus"];
  },
): DocumentRecord {
  const document = store.documents.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.documentId,
  );
  if (!document) throw new Error(`Unknown document ${input.documentId}`);
  document.scanStatus = input.scanStatus;
  return clone(document);
}

export function reviewMemoryUploadedDocument(
  store: MemoryDocumentStore,
  input: {
    firmId: string;
    documentId: string;
    status: DocumentRecord["reviewStatus"];
    decision: DocumentRecord["reviewDecision"];
    reason?: DocumentRecord["reviewReason"];
    metadata: Record<string, unknown>;
    reviewedByUserId: string;
    reviewedAt: string;
  },
): DocumentRecord {
  const document = store.documents.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.documentId,
  );
  if (!document) throw new Error(`Unknown document ${input.documentId}`);
  document.reviewStatus = input.status;
  document.reviewDecision = input.decision;
  document.reviewReason = input.reason;
  document.reviewMetadata = clone(input.metadata);
  document.reviewedByUserId = input.reviewedByUserId;
  document.reviewedAt = input.reviewedAt;
  return clone(document);
}

export function recordMemoryDocumentRetentionHoldReviewDecision(
  store: MemoryDocumentStore,
  input: Parameters<DocumentRepository["recordDocumentRetentionHoldReviewDecision"]>[0],
): DocumentRecord {
  const document = store.documents.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.documentId,
  );
  if (!document) throw new Error(`Unknown document ${input.documentId}`);
  document.reviewMetadata = {
    ...document.reviewMetadata,
    retentionHoldReview: {
      decision: input.decision,
      reason: input.reason,
      ...(input.reviewAfter ? { reviewAfter: input.reviewAfter } : {}),
      ...(input.minimumRetainThrough ? { minimumRetainThrough: input.minimumRetainThrough } : {}),
      recordedByUserId: input.recordedByUserId,
      recordedAt: input.recordedAt,
      sourceCueCounts: clone(input.sourceCueCounts),
    },
  };
  return clone(document);
}

export function createMemoryDocumentTextExtraction(
  store: MemoryDocumentStore,
  extraction: DocumentTextExtractionRecord,
): DocumentTextExtractionRecord {
  store.documentTextExtractions.push(clone(extraction));
  return clone(extraction);
}

export function getMemoryDocumentTextExtractions(
  store: MemoryDocumentStore,
  firmId: string,
  documentId: string,
): DocumentTextExtractionRecord[] {
  return clone(
    store.documentTextExtractions.filter(
      (ext) => ext.firmId === firmId && ext.documentId === documentId,
    ),
  );
}
