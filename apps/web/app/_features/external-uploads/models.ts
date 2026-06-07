export interface ExternalUploadLinkRecord {
  id: string;
  firmId: string;
  matterId: string;
  requestedByUserId: string;
  expiresAt: string;
  maxUploads: number;
  usedUploads: number;
  createdAt: string;
  revokedAt?: string;
}

export interface ExternalUploadReviewItem {
  id: string;
  matterId: string;
  externalUploadLinkId?: string;
  title: string;
  version: number;
  classification: string;
  legalHold: boolean;
  uploadStatus: string;
  checksumStatus: string;
  scanStatus: string;
  reviewStatus: string;
  reviewDecision?: string;
  reviewReason?: string;
  reviewMetadata: Record<string, unknown>;
  reviewedByUserId?: string;
  reviewedAt?: string;
  duplicateOfDocumentId?: string;
  uploadedAt?: string;
  verifiedAt?: string;
  accessLogProof?: {
    total: number;
    latestAt?: string;
    outcomes: string[];
  };
}

export interface ExternalUploadsStatusResponse {
  status: string;
  provider?: string;
  reason?: string;
  canCreate?: boolean;
  canManage?: boolean;
}

export interface ExternalUploadsListResponse {
  uploads: ExternalUploadLinkRecord[];
  reviewItems?: ExternalUploadReviewItem[];
}

export interface ExternalUploadCreateResponse {
  upload: ExternalUploadLinkRecord | null;
  token?: string;
  reason?: string;
}

export interface ExternalUploadRevokeResponse {
  upload: ExternalUploadLinkRecord;
}

export interface ExternalUploadsDashboardResponse {
  status: ExternalUploadsStatusResponse;
  uploadsByMatterId: Record<string, ExternalUploadLinkRecord[]>;
  reviewItemsByMatterId: Record<string, ExternalUploadReviewItem[]>;
}
