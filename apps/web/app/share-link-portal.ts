export interface PublicShareDocument {
  id: string;
  matterId: string;
  title: string;
  classification: string;
  version: number;
  uploadedAt?: string;
  verifiedAt?: string;
}

export interface PublicShareLink {
  id: string;
  permissions: string[];
  expiresAt?: string;
  requireEmailVerification: boolean;
  createdAt?: string;
}

export interface PublicShareLinkResponse {
  share: PublicShareLink;
  documents: PublicShareDocument[];
}

export interface PublicShareErrorBody {
  code?: string;
  message?: string;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export function buildPublicSharePath(token: string): string {
  return `/api/portal/shares/${encodeURIComponent(token)}`;
}

export function buildShareEmailVerificationPath(token: string): string {
  return `${buildPublicSharePath(token)}/email-verification`;
}

export function publicShareErrorCode(body: PublicShareErrorBody): string | undefined {
  return body.error?.code ?? body.code;
}

export function publicShareErrorMessage(body: PublicShareErrorBody, fallback: string): string {
  return body.error?.message ?? body.message ?? fallback;
}

export function isShareEmailVerificationRequired(body: PublicShareErrorBody): boolean {
  return publicShareErrorCode(body) === "EMAIL_VERIFICATION_REQUIRED";
}

export function describePublicShareStatus(payload: { documents: readonly unknown[] }): string {
  return payload.documents.length === 1
    ? "Email verification complete. 1 document is available."
    : `Email verification complete. ${payload.documents.length} documents are available.`;
}
