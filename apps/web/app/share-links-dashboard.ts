import type { ShareLinkPermission, ShareLinkRecord } from "./types";

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
  requireEmailVerification: boolean;
}): {
  matterId: string;
  permissions: ShareLinkPermission[];
  expiresAt?: string;
  requireEmailVerification: boolean;
} {
  return {
    matterId: input.matterId,
    permissions: input.permissions,
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : undefined,
    requireEmailVerification: input.requireEmailVerification,
  };
}

export function replaceShareLink(
  shares: ShareLinkRecord[],
  replacement: ShareLinkRecord,
): ShareLinkRecord[] {
  return shares.map((share) => (share.id === replacement.id ? replacement : share));
}
