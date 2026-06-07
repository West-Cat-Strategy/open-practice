import { and, eq, isNull } from "drizzle-orm";
import type { TrustTransferRequestRecord } from "@open-practice/domain";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { clone } from "../contracts.js";
import { mapTrustTransferRequestRow, trustTransferRequestInsert } from "../drizzle-mappers.js";
import type {
  TrustTransferRequestUpdate,
  TrustTransferRequestUpdateOptions,
} from "../trust-transfer-requests-contracts.js";

export async function createDrizzleTrustTransferRequest(
  db: OpenPracticeDatabase,
  request: TrustTransferRequestRecord,
): Promise<TrustTransferRequestRecord> {
  await db.insert(schema.billingTrustTransferRequests).values(trustTransferRequestInsert(request));
  return clone(request);
}

export async function getDrizzleTrustTransferRequest(
  db: OpenPracticeDatabase,
  firmId: string,
  requestId: string,
): Promise<TrustTransferRequestRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.billingTrustTransferRequests)
    .where(
      and(
        eq(schema.billingTrustTransferRequests.firmId, firmId),
        eq(schema.billingTrustTransferRequests.id, requestId),
      ),
    );
  return row ? mapTrustTransferRequestRow(row) : undefined;
}

export async function listDrizzleTrustTransferRequests(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterId?: string; status?: TrustTransferRequestRecord["status"] } = {},
): Promise<TrustTransferRequestRecord[]> {
  const filters = [eq(schema.billingTrustTransferRequests.firmId, firmId)];
  if (options.matterId) {
    filters.push(eq(schema.billingTrustTransferRequests.matterId, options.matterId));
  }
  if (options.status) {
    filters.push(eq(schema.billingTrustTransferRequests.status, options.status));
  }
  const rows = await db
    .select()
    .from(schema.billingTrustTransferRequests)
    .where(and(...filters));
  return rows.map(mapTrustTransferRequestRow);
}

export async function updateDrizzleTrustTransferRequest(
  db: OpenPracticeDatabase,
  firmId: string,
  requestId: string,
  updates: TrustTransferRequestUpdate,
  options: TrustTransferRequestUpdateOptions = {},
): Promise<TrustTransferRequestRecord> {
  const setValues: Partial<typeof schema.billingTrustTransferRequests.$inferInsert> = {};
  if ("status" in updates) setValues.status = updates.status;
  if ("reviewedByUserId" in updates) setValues.reviewedByUserId = updates.reviewedByUserId;
  if ("reviewedAt" in updates) {
    setValues.reviewedAt = updates.reviewedAt ? new Date(updates.reviewedAt) : null;
  }
  if ("ledgerTransactionId" in updates) {
    setValues.ledgerTransactionId = updates.ledgerTransactionId;
  }
  if ("evidence" in updates) setValues.evidence = updates.evidence;

  if (Object.keys(setValues).length === 0) {
    const existing = await getDrizzleTrustTransferRequest(db, firmId, requestId);
    if (!existing) throw new Error("Trust transfer request was not found");
    return existing;
  }

  const filters = [
    eq(schema.billingTrustTransferRequests.firmId, firmId),
    eq(schema.billingTrustTransferRequests.id, requestId),
  ];
  if (options.expectedStatus) {
    filters.push(eq(schema.billingTrustTransferRequests.status, options.expectedStatus));
  }
  if (options.requireLedgerTransactionUnlinked) {
    filters.push(isNull(schema.billingTrustTransferRequests.ledgerTransactionId));
  }

  const [row] = await db
    .update(schema.billingTrustTransferRequests)
    .set(setValues)
    .where(and(...filters))
    .returning();
  if (!row) throw new Error("Trust transfer request update conflict");
  return mapTrustTransferRequestRow(row);
}
