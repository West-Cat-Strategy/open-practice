import type {
  AccessLogRecord,
  ExternalUploadLinkRecord,
  PortalGrant,
  ShareLinkRecord,
} from "@open-practice/domain";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import {
  accessLogInsert,
  externalUploadLinkInsert,
  mapAccessLogRow,
  mapExternalUploadLinkRow,
  mapShareLinkRow,
} from "../drizzle-mappers.js";
import {
  IdempotencyKeyConflictError,
  canonicalizeForIdempotency,
  clone,
  dateToIso,
  isPostgresUniqueViolation,
} from "../contracts.js";
import type {
  AccessLogListOptions,
  ExternalUploadLinkListOptions,
  ShareLinkListOptions,
} from "../portal-access-contracts.js";

export async function listDrizzlePortalGrants(
  db: OpenPracticeDatabase,
  firmId: string,
): Promise<PortalGrant[]> {
  const rows = await db
    .select()
    .from(schema.portalGrants)
    .where(eq(schema.portalGrants.firmId, firmId));
  return rows.map((row) => ({
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    contactId: row.contactId,
    grantedByUserId: row.grantedByUserId,
    permissions: row.permissions as PortalGrant["permissions"],
    expiresAt: dateToIso(row.expiresAt),
    revokedAt: dateToIso(row.revokedAt),
  }));
}

export async function createDrizzlePortalGrant(
  db: OpenPracticeDatabase,
  grant: PortalGrant,
): Promise<PortalGrant> {
  const [row] = await db
    .insert(schema.portalGrants)
    .values({
      id: grant.id,
      firmId: grant.firmId,
      matterId: grant.matterId,
      contactId: grant.contactId,
      grantedByUserId: grant.grantedByUserId,
      permissions: grant.permissions,
      expiresAt: grant.expiresAt ? new Date(grant.expiresAt) : null,
      revokedAt: grant.revokedAt ? new Date(grant.revokedAt) : null,
    })
    .returning();
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    contactId: row.contactId,
    grantedByUserId: row.grantedByUserId,
    permissions: row.permissions as PortalGrant["permissions"],
    expiresAt: dateToIso(row.expiresAt),
    revokedAt: dateToIso(row.revokedAt),
  };
}

export async function listDrizzleShareLinks(
  db: OpenPracticeDatabase,
  firmId: string,
  options: ShareLinkListOptions = {},
): Promise<ShareLinkRecord[]> {
  const filters = [eq(schema.shareLinks.firmId, firmId)];
  if (options.matterId) filters.push(eq(schema.shareLinks.matterId, options.matterId));
  const rows = await db
    .select()
    .from(schema.shareLinks)
    .where(and(...filters))
    .orderBy(desc(schema.shareLinks.createdAt));
  return rows.map(mapShareLinkRow);
}

export async function createDrizzleShareLink(
  db: OpenPracticeDatabase,
  link: ShareLinkRecord,
): Promise<ShareLinkRecord> {
  await db.insert(schema.shareLinks).values({
    id: link.id,
    firmId: link.firmId,
    matterId: link.matterId,
    tokenHash: link.tokenHash,
    grantedByUserId: link.grantedByUserId,
    permissions: link.permissions,
    requireEmailVerification: link.requireEmailVerification,
    emailVerificationCodeHash: link.emailVerificationCodeHash ?? null,
    emailVerificationExpiresAt: link.emailVerificationExpiresAt
      ? new Date(link.emailVerificationExpiresAt)
      : null,
    expiresAt: link.expiresAt ? new Date(link.expiresAt) : null,
    revokedAt: link.revokedAt ? new Date(link.revokedAt) : null,
    createdAt: new Date(link.createdAt),
  });
  return clone(link);
}

export async function getDrizzleShareLink(
  db: OpenPracticeDatabase,
  firmId: string,
  id: string,
): Promise<ShareLinkRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.shareLinks)
    .where(and(eq(schema.shareLinks.firmId, firmId), eq(schema.shareLinks.id, id)));
  return row ? mapShareLinkRow(row) : undefined;
}

export async function getDrizzleShareLinkByTokenHash(
  db: OpenPracticeDatabase,
  tokenHash: string,
): Promise<ShareLinkRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.shareLinks)
    .where(eq(schema.shareLinks.tokenHash, tokenHash));
  return row ? mapShareLinkRow(row) : undefined;
}

export async function revokeDrizzleShareLink(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    id: string;
    revokedAt: string;
  },
): Promise<ShareLinkRecord | undefined> {
  const [row] = await db
    .update(schema.shareLinks)
    .set({ revokedAt: new Date(input.revokedAt) })
    .where(and(eq(schema.shareLinks.firmId, input.firmId), eq(schema.shareLinks.id, input.id)))
    .returning();
  return row ? mapShareLinkRow(row) : undefined;
}

export async function listDrizzleExternalUploadLinks(
  db: OpenPracticeDatabase,
  firmId: string,
  options: ExternalUploadLinkListOptions = {},
): Promise<ExternalUploadLinkRecord[]> {
  const conditions = [eq(schema.externalUploadLinks.firmId, firmId)];
  if (options.matterId) {
    conditions.push(eq(schema.externalUploadLinks.matterId, options.matterId));
  }
  const rows = await db
    .select()
    .from(schema.externalUploadLinks)
    .where(and(...conditions))
    .orderBy(desc(schema.externalUploadLinks.createdAt));
  return rows.map(mapExternalUploadLinkRow);
}

export async function createDrizzleExternalUploadLink(
  db: OpenPracticeDatabase,
  link: ExternalUploadLinkRecord,
): Promise<ExternalUploadLinkRecord> {
  try {
    const [row] = await db
      .insert(schema.externalUploadLinks)
      .values(externalUploadLinkInsert(link))
      .returning();
    return mapExternalUploadLinkRow(row);
  } catch (error) {
    if (!isPostgresUniqueViolation(error, "external_upload_links_firm_idempotency_idx")) {
      throw error;
    }
    const [existingRow] = await db
      .select()
      .from(schema.externalUploadLinks)
      .where(
        and(
          eq(schema.externalUploadLinks.firmId, link.firmId),
          eq(schema.externalUploadLinks.idempotencyKey, link.idempotencyKey ?? ""),
        ),
      );
    if (!existingRow) throw error;
    const existing = mapExternalUploadLinkRow(existingRow);
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
    return existing;
  }
}

export async function getDrizzleExternalUploadLinkByTokenHash(
  db: OpenPracticeDatabase,
  tokenHash: string,
): Promise<ExternalUploadLinkRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.externalUploadLinks)
    .where(eq(schema.externalUploadLinks.tokenHash, tokenHash));
  return row ? mapExternalUploadLinkRow(row) : undefined;
}

export async function revokeDrizzleExternalUploadLink(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    id: string;
    revokedAt: string;
  },
): Promise<ExternalUploadLinkRecord | undefined> {
  const [row] = await db
    .update(schema.externalUploadLinks)
    .set({ revokedAt: new Date(input.revokedAt) })
    .where(
      and(
        eq(schema.externalUploadLinks.firmId, input.firmId),
        eq(schema.externalUploadLinks.id, input.id),
      ),
    )
    .returning();
  return row ? mapExternalUploadLinkRow(row) : undefined;
}

export async function claimDrizzleExternalUploadUse(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    id: string;
    usedAt: string;
  },
): Promise<ExternalUploadLinkRecord | undefined> {
  const usedAt = new Date(input.usedAt);
  const [row] = await db
    .update(schema.externalUploadLinks)
    .set({ usedUploads: sql`${schema.externalUploadLinks.usedUploads} + 1` })
    .where(
      and(
        eq(schema.externalUploadLinks.firmId, input.firmId),
        eq(schema.externalUploadLinks.id, input.id),
        isNull(schema.externalUploadLinks.revokedAt),
        gt(schema.externalUploadLinks.expiresAt, usedAt),
        sql`${schema.externalUploadLinks.usedUploads} < ${schema.externalUploadLinks.maxUploads}`,
      ),
    )
    .returning();
  return row ? mapExternalUploadLinkRow(row) : undefined;
}

export async function createDrizzleAccessLog(
  db: OpenPracticeDatabase,
  log: AccessLogRecord,
): Promise<AccessLogRecord> {
  const [row] = await db.insert(schema.accessLogs).values(accessLogInsert(log)).returning();
  return mapAccessLogRow(row);
}

export async function listDrizzleAccessLogs(
  db: OpenPracticeDatabase,
  firmId: string,
  options: AccessLogListOptions = {},
): Promise<AccessLogRecord[]> {
  const conditions = [eq(schema.accessLogs.firmId, firmId)];
  if (options.shareLinkId) {
    conditions.push(eq(schema.accessLogs.shareLinkId, options.shareLinkId));
  }
  if (options.externalUploadLinkId) {
    conditions.push(eq(schema.accessLogs.externalUploadLinkId, options.externalUploadLinkId));
  }
  if (options.intakeFormLinkId) {
    conditions.push(eq(schema.accessLogs.intakeFormLinkId, options.intakeFormLinkId));
  }
  if (options.resourceType) {
    conditions.push(eq(schema.accessLogs.resourceType, options.resourceType));
  }
  if (options.resourceId) {
    conditions.push(eq(schema.accessLogs.resourceId, options.resourceId));
  }
  const rows = await db
    .select()
    .from(schema.accessLogs)
    .where(and(...conditions))
    .orderBy(desc(schema.accessLogs.occurredAt));
  return rows.map(mapAccessLogRow);
}
