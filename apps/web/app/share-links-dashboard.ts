import type {
  CreateShareLinkResponse,
  ShareLinkPermission,
  ShareLinkRecord,
} from "./_features/share-links/models";

export const shareLinkPermissions: readonly ShareLinkPermission[] = ["view_documents"];

const permissionLabels: Record<ShareLinkPermission, string> = {
  view_documents: "View documents",
};

export function formatSharePermission(permission: ShareLinkPermission): string {
  return permissionLabels[permission];
}

export function describeShareLinkState(share: Pick<ShareLinkRecord, "expiresAt" | "revokedAt">): {
  label: string;
  tone: "active" | "risk" | "muted";
} {
  if (share.revokedAt) return { label: "revoked", tone: "muted" };
  if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
    return { label: "expired", tone: "risk" };
  }
  return { label: "active", tone: "active" };
}

export function buildCreateShareLinkPayload(input: {
  matterId: string;
  permissions: ShareLinkPermission[];
  expiresAt: string;
  notificationEmail: string;
  requireEmailVerification: boolean;
}): {
  matterId: string;
  permissions: ShareLinkPermission[];
  expiresAt?: string;
  notificationEmail?: string;
  requireEmailVerification: boolean;
} {
  const notificationEmail = input.notificationEmail.trim();
  return {
    matterId: input.matterId,
    permissions: input.permissions,
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : undefined,
    notificationEmail: notificationEmail || undefined,
    requireEmailVerification: input.requireEmailVerification,
  };
}

export function describeCreateShareLinkResult(
  payload: Pick<CreateShareLinkResponse, "queuedEmail" | "token">,
): string {
  if (payload.queuedEmail) {
    const emailStatus = payload.queuedEmail.status.replaceAll("_", " ");
    return payload.token
      ? `Created share link; notification email ${emailStatus}. One-time token remains available below.`
      : `Created share link; notification email ${emailStatus}.`;
  }
  return payload.token
    ? "Created share link; use the one-time token below."
    : "Created share link; token unavailable.";
}

export function replaceShareLink(
  shares: ShareLinkRecord[],
  replacement: ShareLinkRecord,
): ShareLinkRecord[] {
  return shares.map((share) => (share.id === replacement.id ? replacement : share));
}
