import type {
  AccessLogRecord,
  ExternalUploadLinkRecord,
  Matter,
  PortalGrant,
  ShareLinkRecord,
  User,
} from "@open-practice/domain";
import { IdempotencyKeyConflictError, canonicalizeForIdempotency, clone } from "../contracts.js";
import type {
  AccessLogListOptions,
  ExternalUploadLinkListOptions,
  ShareLinkListOptions,
} from "../portal-access-contracts.js";

export interface MemoryPortalAccessStore {
  portalGrants: PortalGrant[];
  shareLinks: ShareLinkRecord[];
  externalUploadLinks: ExternalUploadLinkRecord[];
  accessLogs: AccessLogRecord[];
  matters: Pick<Matter, "firmId" | "id">[];
  users: Pick<User, "firmId" | "id">[];
}

export function listMemoryPortalGrants(
  store: MemoryPortalAccessStore,
  firmId: string,
): PortalGrant[] {
  return clone(store.portalGrants.filter((grant) => grant.firmId === firmId));
}

export function createMemoryPortalGrant(
  store: MemoryPortalAccessStore,
  grant: PortalGrant,
): PortalGrant {
  store.portalGrants.push(clone(grant));
  return clone(grant);
}

export function listMemoryShareLinks(
  store: MemoryPortalAccessStore,
  firmId: string,
  options: ShareLinkListOptions = {},
): ShareLinkRecord[] {
  return clone(
    store.shareLinks
      .filter(
        (link) =>
          link.firmId === firmId && (!options.matterId || link.matterId === options.matterId),
      )
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
      ),
  );
}

export function createMemoryShareLink(
  store: MemoryPortalAccessStore,
  link: ShareLinkRecord,
): ShareLinkRecord {
  if (store.shareLinks.some((existing) => existing.tokenHash === link.tokenHash)) {
    throw new Error("Share link token hash already exists");
  }
  const matter = store.matters.find(
    (candidate) => candidate.firmId === link.firmId && candidate.id === link.matterId,
  );
  if (!matter) throw new Error(`Unknown share link matter ${link.matterId}`);
  const user = store.users.find(
    (candidate) => candidate.firmId === link.firmId && candidate.id === link.grantedByUserId,
  );
  if (!user) throw new Error(`Unknown share link grantor ${link.grantedByUserId}`);

  store.shareLinks.push(clone(link));
  return clone(link);
}

export function getMemoryShareLink(
  store: MemoryPortalAccessStore,
  firmId: string,
  id: string,
): ShareLinkRecord | undefined {
  return clone(store.shareLinks.find((link) => link.firmId === firmId && link.id === id));
}

export function getMemoryShareLinkByTokenHash(
  store: MemoryPortalAccessStore,
  tokenHash: string,
): ShareLinkRecord | undefined {
  return clone(store.shareLinks.find((link) => link.tokenHash === tokenHash));
}

export function revokeMemoryShareLink(
  store: MemoryPortalAccessStore,
  input: {
    firmId: string;
    id: string;
    revokedAt: string;
  },
): ShareLinkRecord | undefined {
  const link = store.shareLinks.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
  );
  if (!link) return undefined;
  link.revokedAt = input.revokedAt;
  return clone(link);
}

export function listMemoryExternalUploadLinks(
  store: MemoryPortalAccessStore,
  firmId: string,
  options: ExternalUploadLinkListOptions = {},
): ExternalUploadLinkRecord[] {
  return clone(
    store.externalUploadLinks
      .filter(
        (link) =>
          link.firmId === firmId && (!options.matterId || link.matterId === options.matterId),
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  );
}

export function createMemoryExternalUploadLink(
  store: MemoryPortalAccessStore,
  link: ExternalUploadLinkRecord,
): ExternalUploadLinkRecord {
  const existing = link.idempotencyKey
    ? store.externalUploadLinks.find(
        (candidate) =>
          candidate.firmId === link.firmId && candidate.idempotencyKey === link.idempotencyKey,
      )
    : undefined;
  if (existing) {
    const existingFingerprint = canonicalizeForIdempotency({
      matterId: existing.matterId,
      requestedByUserId: existing.requestedByUserId,
      maxUploads: existing.maxUploads,
      expiresAt: existing.expiresAt,
    });
    const inputFingerprint = canonicalizeForIdempotency({
      matterId: link.matterId,
      requestedByUserId: link.requestedByUserId,
      maxUploads: link.maxUploads,
      expiresAt: link.expiresAt,
    });
    if (existingFingerprint !== inputFingerprint) throw new IdempotencyKeyConflictError();
    return clone(existing);
  }
  if (store.externalUploadLinks.some((existing) => existing.tokenHash === link.tokenHash)) {
    throw new Error("External upload link token hash already exists");
  }
  store.externalUploadLinks.push(clone(link));
  return clone(link);
}

export function getMemoryExternalUploadLinkByTokenHash(
  store: MemoryPortalAccessStore,
  tokenHash: string,
): ExternalUploadLinkRecord | undefined {
  return clone(store.externalUploadLinks.find((link) => link.tokenHash === tokenHash));
}

export function revokeMemoryExternalUploadLink(
  store: MemoryPortalAccessStore,
  input: {
    firmId: string;
    id: string;
    revokedAt: string;
  },
): ExternalUploadLinkRecord | undefined {
  const link = store.externalUploadLinks.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
  );
  if (!link) return undefined;
  link.revokedAt = input.revokedAt;
  return clone(link);
}

export function claimMemoryExternalUploadUse(
  store: MemoryPortalAccessStore,
  input: {
    firmId: string;
    id: string;
    usedAt: string;
  },
): ExternalUploadLinkRecord | undefined {
  const link = store.externalUploadLinks.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
  );
  if (
    !link ||
    link.revokedAt ||
    Date.parse(link.expiresAt) <= Date.parse(input.usedAt) ||
    link.usedUploads >= link.maxUploads
  ) {
    return undefined;
  }
  link.usedUploads += 1;
  return clone(link);
}

export function createMemoryAccessLog(
  store: MemoryPortalAccessStore,
  log: AccessLogRecord,
): AccessLogRecord {
  store.accessLogs.push(clone(log));
  return clone(log);
}

export function listMemoryAccessLogs(
  store: MemoryPortalAccessStore,
  firmId: string,
  options: AccessLogListOptions = {},
): AccessLogRecord[] {
  return clone(
    store.accessLogs
      .filter(
        (log) =>
          log.firmId === firmId &&
          (!options.shareLinkId || log.shareLinkId === options.shareLinkId) &&
          (!options.externalUploadLinkId ||
            log.externalUploadLinkId === options.externalUploadLinkId) &&
          (!options.intakeFormLinkId || log.intakeFormLinkId === options.intakeFormLinkId) &&
          (!options.resourceType || log.resourceType === options.resourceType) &&
          (!options.resourceId || log.resourceId === options.resourceId),
      )
      .sort(
        (left, right) =>
          right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id),
      ),
  );
}
