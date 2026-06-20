import type {
  DocumentRecord,
  DocumentRetentionHoldReviewDecision,
  DocumentRetentionHoldReviewReason,
  DocumentTextExtractionRecord,
} from "@open-practice/domain";

export interface DocumentUploadIntent {
  id: string;
  firmId: string;
  matterId: string;
  title: string;
  storageKey: string;
  checksumSha256: string;
  sizeBytes?: number;
  classification: DocumentRecord["classification"];
  legalHold: boolean;
  reviewStatus?: DocumentRecord["reviewStatus"];
  externalUploadLinkId?: string;
  supersedesDocumentId?: string;
}

export interface DocumentRepository {
  getDocument(firmId: string, documentId: string): Promise<DocumentRecord | undefined>;
  listMatterDocuments(firmId: string, matterId: string): Promise<DocumentRecord[]>;
  createDocumentUploadIntent(input: DocumentUploadIntent): Promise<DocumentRecord>;
  completeDocumentUpload(input: {
    firmId: string;
    documentId: string;
    checksumSha256: string;
    scanStatus?: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord>;
  updateDocumentScanStatus(input: {
    firmId: string;
    documentId: string;
    scanStatus: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord>;
  reviewUploadedDocument(input: {
    firmId: string;
    documentId: string;
    status: DocumentRecord["reviewStatus"];
    decision: DocumentRecord["reviewDecision"];
    reason?: DocumentRecord["reviewReason"];
    metadata: Record<string, unknown>;
    reviewedByUserId: string;
    reviewedAt: string;
  }): Promise<DocumentRecord>;
  recordDocumentRetentionHoldReviewDecision(input: {
    firmId: string;
    documentId: string;
    decision: DocumentRetentionHoldReviewDecision;
    reason: DocumentRetentionHoldReviewReason;
    reviewAfter?: string;
    minimumRetainThrough?: string;
    recordedByUserId: string;
    recordedAt: string;
    sourceCueCounts: Record<string, number>;
  }): Promise<DocumentRecord>;
  createDocumentTextExtraction(
    extraction: DocumentTextExtractionRecord,
  ): Promise<DocumentTextExtractionRecord>;
  getDocumentTextExtractions(
    firmId: string,
    documentId: string,
  ): Promise<DocumentTextExtractionRecord[]>;
}
