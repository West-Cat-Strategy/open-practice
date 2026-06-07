export type ShareLinkPermission = "view_documents";

export interface ShareLinkRecord {
  id: string;
  firmId: string;
  matterId: string;
  grantedByUserId: string;
  permissions: ShareLinkPermission[];
  expiresAt?: string;
  revokedAt?: string;
  createdAt?: string;
  tokenHash?: string;
  requireEmailVerification?: boolean;
  contactId?: string;
}

export interface ShareLinksResponse {
  shares: ShareLinkRecord[];
}

export interface ShareLinksStatusResponse {
  createStatus: "enabled" | "disabled";
  status?: string;
  provider?: string;
  reason?: string;
  canCreate?: boolean;
  canManage?: boolean;
}

export interface CreateShareLinkResponse {
  share: ShareLinkRecord | null;
  token?: string;
  queuedEmail?: {
    id: string;
    templateKey: string;
    status: string;
    queuedAt: string;
    jobId: string;
    idempotencyKeyPresent?: boolean;
  };
  status?: string;
  reason?: string;
}

export interface RevokeShareLinkResponse {
  share: ShareLinkRecord;
}
