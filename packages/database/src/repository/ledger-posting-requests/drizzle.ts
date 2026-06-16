import {
  ledgerTransactionFromPostingRequest,
  validateLedgerPostingRequestRecord,
  type LedgerPostingRequestRecord,
} from "@open-practice/domain";
import { and, asc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { mapLedgerPostingRequestRow } from "../drizzle-mappers.js";
import { postDrizzleLedgerTransaction } from "../ledger-core/drizzle.js";
import type { ApproveLedgerPostingRequestResult } from "../ledger-posting-requests-contracts.js";

export async function prepareDrizzleLedgerPostingRequest(
  db: OpenPracticeDatabase,
  request: LedgerPostingRequestRecord,
): Promise<LedgerPostingRequestRecord> {
  validateLedgerPostingRequestRecord(request);
  const duplicate = await findPostingRequestByIdempotencyKey(
    db,
    request.firmId,
    request.idempotencyKey,
  );
  if (duplicate) {
    if (duplicate.requestFingerprint !== request.requestFingerprint) {
      throw new Error("Idempotency key was reused with a different ledger payload");
    }
    return duplicate;
  }

  await db.insert(schema.trustPostingRequests).values(toPostingRequestInsert(request));
  const prepared = await getDrizzleLedgerPostingRequest(db, request.firmId, request.id);
  if (!prepared) throw new Error("Ledger posting request was not created");
  return prepared;
}

export async function getDrizzleLedgerPostingRequest(
  db: OpenPracticeDatabase,
  firmId: string,
  requestId: string,
): Promise<LedgerPostingRequestRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.trustPostingRequests)
    .where(
      and(
        eq(schema.trustPostingRequests.firmId, firmId),
        eq(schema.trustPostingRequests.id, requestId),
      ),
    );
  return row ? mapLedgerPostingRequestRow(row) : undefined;
}

export async function listDrizzleLedgerPostingRequests(
  db: OpenPracticeDatabase,
  firmId: string,
  options: {
    matterId?: string;
    status?: LedgerPostingRequestRecord["status"];
    idempotencyKey?: string;
  } = {},
): Promise<LedgerPostingRequestRecord[]> {
  const filters = [eq(schema.trustPostingRequests.firmId, firmId)];
  if (options.status) filters.push(eq(schema.trustPostingRequests.status, options.status));
  if (options.idempotencyKey) {
    filters.push(eq(schema.trustPostingRequests.idempotencyKey, options.idempotencyKey));
  }
  const rows = await db
    .select()
    .from(schema.trustPostingRequests)
    .where(and(...filters))
    .orderBy(asc(schema.trustPostingRequests.preparedAt));
  return rows
    .map(mapLedgerPostingRequestRow)
    .filter((request) => !options.matterId || request.matterIds.includes(options.matterId));
}

export async function approveDrizzleLedgerPostingRequest(
  db: OpenPracticeDatabase,
  firmId: string,
  requestId: string,
  input: {
    reviewedByUserId: string;
    reviewedAt: string;
    reviewNotes?: string;
  },
): Promise<ApproveLedgerPostingRequestResult> {
  const existing = await getRequiredPostingRequest(db, firmId, requestId);
  if (existing.status === "posted" && existing.ledgerTransactionId) {
    const postedTransaction = await postDrizzleLedgerTransaction(
      db,
      ledgerTransactionFromPostingRequest(existing, {
        postedByUserId: existing.reviewedByUserId ?? input.reviewedByUserId,
        postedAt: existing.proposedPostedAt,
      }),
    );
    return { request: existing, postedTransaction };
  }
  if (existing.status !== "pending_approval") {
    throw new Error("Ledger posting request is not pending approval");
  }
  if (existing.preparedByUserId === input.reviewedByUserId) {
    throw new Error("Ledger posting request requires checker approval by a different user");
  }

  const postedTransaction = await postDrizzleLedgerTransaction(
    db,
    ledgerTransactionFromPostingRequest(existing, {
      postedByUserId: input.reviewedByUserId,
      postedAt: existing.proposedPostedAt,
    }),
  );

  const [updated] = await db
    .update(schema.trustPostingRequests)
    .set({
      status: "posted",
      reviewedByUserId: input.reviewedByUserId,
      reviewedAt: new Date(input.reviewedAt),
      reviewNotes: input.reviewNotes ?? null,
      ledgerTransactionId: postedTransaction.id,
    })
    .where(
      and(
        eq(schema.trustPostingRequests.firmId, firmId),
        eq(schema.trustPostingRequests.id, requestId),
        eq(schema.trustPostingRequests.status, "pending_approval"),
      ),
    )
    .returning();
  if (!updated) throw new Error("Ledger posting request is not pending approval");
  const request = mapLedgerPostingRequestRow(updated);
  validateLedgerPostingRequestRecord(request);
  return { request, postedTransaction };
}

export async function rejectDrizzleLedgerPostingRequest(
  db: OpenPracticeDatabase,
  firmId: string,
  requestId: string,
  input: {
    reviewedByUserId: string;
    reviewedAt: string;
    rejectionReason: string;
    reviewNotes?: string;
  },
): Promise<LedgerPostingRequestRecord> {
  const existing = await getRequiredPostingRequest(db, firmId, requestId);
  if (existing.status !== "pending_approval") {
    throw new Error("Ledger posting request is not pending approval");
  }
  if (existing.preparedByUserId === input.reviewedByUserId) {
    throw new Error("Ledger posting request requires checker approval by a different user");
  }

  const [updated] = await db
    .update(schema.trustPostingRequests)
    .set({
      status: "rejected",
      reviewedByUserId: input.reviewedByUserId,
      reviewedAt: new Date(input.reviewedAt),
      reviewNotes: input.reviewNotes ?? null,
      rejectionReason: input.rejectionReason,
    })
    .where(
      and(
        eq(schema.trustPostingRequests.firmId, firmId),
        eq(schema.trustPostingRequests.id, requestId),
        eq(schema.trustPostingRequests.status, "pending_approval"),
      ),
    )
    .returning();
  if (!updated) throw new Error("Ledger posting request is not pending approval");
  const request = mapLedgerPostingRequestRow(updated);
  validateLedgerPostingRequestRecord(request);
  return request;
}

async function findPostingRequestByIdempotencyKey(
  db: OpenPracticeDatabase,
  firmId: string,
  idempotencyKey: string,
): Promise<LedgerPostingRequestRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.trustPostingRequests)
    .where(
      and(
        eq(schema.trustPostingRequests.firmId, firmId),
        eq(schema.trustPostingRequests.idempotencyKey, idempotencyKey),
      ),
    );
  return row ? mapLedgerPostingRequestRow(row) : undefined;
}

async function getRequiredPostingRequest(
  db: OpenPracticeDatabase,
  firmId: string,
  requestId: string,
): Promise<LedgerPostingRequestRecord> {
  const request = await getDrizzleLedgerPostingRequest(db, firmId, requestId);
  if (!request) throw new Error("Ledger posting request was not found");
  return request;
}

function toPostingRequestInsert(request: LedgerPostingRequestRecord) {
  return {
    id: request.id,
    firmId: request.firmId,
    transactionId: request.transactionId,
    idempotencyKey: request.idempotencyKey,
    requestFingerprint: request.requestFingerprint,
    status: request.status,
    proposedPostedAt: new Date(request.proposedPostedAt),
    entries: request.entries,
    matterIds: request.matterIds,
    clientIds: request.clientIds,
    accountIds: request.accountIds,
    reversesTransactionId: request.reversesTransactionId ?? null,
    preparedByUserId: request.preparedByUserId,
    preparedAt: new Date(request.preparedAt),
    preparationNotes: request.preparationNotes ?? null,
    reviewedByUserId: request.reviewedByUserId ?? null,
    reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : null,
    reviewNotes: request.reviewNotes ?? null,
    rejectionReason: request.rejectionReason ?? null,
    ledgerTransactionId: request.ledgerTransactionId ?? null,
  };
}
