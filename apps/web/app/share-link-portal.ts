import { buildPublicTokenHeaderPath } from "./publicTokenClient";

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

export function shareLinkAttentionItems(input: {
  payload: PublicShareLinkResponse | null;
  verificationRequired: boolean;
}): {
  id: string;
  title: string;
  detail: string;
  status: string;
  tone?: "neutral" | "ready" | "risk";
}[] {
  if (input.verificationRequired) {
    return [
      {
        id: "share-email-verification",
        title: "Verify email",
        detail: "Enter the email-delivered verification code before reviewing shared records.",
        status: "required",
        tone: "risk",
      },
    ];
  }

  if (!input.payload) return [];

  if (input.payload.documents.length === 0) {
    return [
      {
        id: "share-no-documents",
        title: "No shared document records available",
        detail: "The link is valid, but no document metadata is currently visible from this page.",
        status: "waiting",
      },
    ];
  }

  return [];
}

export function buildPublicSharePath(): string {
  return buildPublicTokenHeaderPath("/api/portal/shares");
}

export function buildShareEmailVerificationPath(): string {
  return buildPublicTokenHeaderPath("/api/portal/shares", "email-verification");
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
    ? "Email verification complete. 1 shared document metadata record is available."
    : `Email verification complete. ${payload.documents.length} shared document metadata records are available.`;
}
