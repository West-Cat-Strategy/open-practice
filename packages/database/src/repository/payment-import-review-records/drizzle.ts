import type {
  PaymentImportDepositMatchReviewRecord,
  PaymentImportReviewRecord,
} from "@open-practice/domain";
import { and, desc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { IdempotencyKeyConflictError, clone, isPostgresUniqueViolation } from "../contracts.js";
import {
  mapPaymentImportDepositMatchReviewRow,
  mapPaymentImportReviewRecordRow,
  paymentImportDepositMatchReviewInsert,
  paymentImportReviewRecordInsert,
} from "../drizzle-mappers.js";
import type {
  PaymentImportDepositMatchReviewListOptions,
  PaymentImportReviewRecordListOptions,
} from "../payment-import-review-records-contracts.js";

async function getByProviderEvent(input: {
  db: OpenPracticeDatabase;
  firmId: string;
  providerLabel: string;
  externalEventId: string;
}): Promise<PaymentImportReviewRecord | undefined> {
  const [row] = await input.db
    .select()
    .from(schema.paymentImportReviewRecords)
    .where(
      and(
        eq(schema.paymentImportReviewRecords.firmId, input.firmId),
        eq(schema.paymentImportReviewRecords.providerLabel, input.providerLabel),
        eq(schema.paymentImportReviewRecords.externalEventId, input.externalEventId),
      ),
    );
  return row ? mapPaymentImportReviewRecordRow(row) : undefined;
}

function existingOrConflict(
  existing: PaymentImportReviewRecord | undefined,
  incoming: PaymentImportReviewRecord,
): PaymentImportReviewRecord | undefined {
  if (!existing) return undefined;
  if (existing.normalizedEvidenceFingerprint !== incoming.normalizedEvidenceFingerprint) {
    throw new IdempotencyKeyConflictError();
  }
  return clone(existing);
}

export async function createDrizzlePaymentImportReviewRecord(
  db: OpenPracticeDatabase,
  record: PaymentImportReviewRecord,
): Promise<PaymentImportReviewRecord> {
  const existing = await getByProviderEvent({
    db,
    firmId: record.firmId,
    providerLabel: record.providerLabel,
    externalEventId: record.externalEventId,
  });
  const reused = existingOrConflict(existing, record);
  if (reused) return reused;

  try {
    const [row] = await db
      .insert(schema.paymentImportReviewRecords)
      .values(paymentImportReviewRecordInsert(record))
      .returning();
    return mapPaymentImportReviewRecordRow(row);
  } catch (error) {
    if (
      !isPostgresUniqueViolation(error, "payment_import_review_records_firm_provider_event_idx")
    ) {
      throw error;
    }
    const racedExisting = await getByProviderEvent({
      db,
      firmId: record.firmId,
      providerLabel: record.providerLabel,
      externalEventId: record.externalEventId,
    });
    const racedReuse = existingOrConflict(racedExisting, record);
    if (racedReuse) return racedReuse;
    throw error;
  }
}

export async function getDrizzlePaymentImportReviewRecord(
  db: OpenPracticeDatabase,
  firmId: string,
  recordId: string,
): Promise<PaymentImportReviewRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.paymentImportReviewRecords)
    .where(
      and(
        eq(schema.paymentImportReviewRecords.firmId, firmId),
        eq(schema.paymentImportReviewRecords.id, recordId),
      ),
    );
  return row ? mapPaymentImportReviewRecordRow(row) : undefined;
}

export async function listDrizzlePaymentImportReviewRecords(
  db: OpenPracticeDatabase,
  firmId: string,
  options: PaymentImportReviewRecordListOptions = {},
): Promise<PaymentImportReviewRecord[]> {
  const filters = [eq(schema.paymentImportReviewRecords.firmId, firmId)];
  if (options.matterId) {
    filters.push(eq(schema.paymentImportReviewRecords.matterId, options.matterId));
  }
  if (options.candidateInvoiceId) {
    filters.push(
      eq(schema.paymentImportReviewRecords.candidateInvoiceId, options.candidateInvoiceId),
    );
  }
  if (options.candidateHostedPaymentRequestId) {
    filters.push(
      eq(
        schema.paymentImportReviewRecords.candidateHostedPaymentRequestId,
        options.candidateHostedPaymentRequestId,
      ),
    );
  }
  if (options.candidateManualPaymentId) {
    filters.push(
      eq(
        schema.paymentImportReviewRecords.candidateManualPaymentId,
        options.candidateManualPaymentId,
      ),
    );
  }
  if (options.eventFamily) {
    filters.push(eq(schema.paymentImportReviewRecords.eventFamily, options.eventFamily));
  }
  const rows = await db
    .select()
    .from(schema.paymentImportReviewRecords)
    .where(and(...filters))
    .orderBy(desc(schema.paymentImportReviewRecords.importedAt));
  return rows.map(mapPaymentImportReviewRecordRow);
}

async function getDepositMatchReviewByIdempotency(input: {
  db: OpenPracticeDatabase;
  firmId: string;
  paymentImportReviewRecordId: string;
  idempotencyKey: string;
}): Promise<PaymentImportDepositMatchReviewRecord | undefined> {
  const [row] = await input.db
    .select()
    .from(schema.paymentImportDepositMatchReviews)
    .where(
      and(
        eq(schema.paymentImportDepositMatchReviews.firmId, input.firmId),
        eq(
          schema.paymentImportDepositMatchReviews.paymentImportReviewRecordId,
          input.paymentImportReviewRecordId,
        ),
        eq(schema.paymentImportDepositMatchReviews.idempotencyKey, input.idempotencyKey),
      ),
    );
  return row ? mapPaymentImportDepositMatchReviewRow(row) : undefined;
}

function existingDepositMatchReviewOrConflict(
  existing: PaymentImportDepositMatchReviewRecord | undefined,
  incoming: PaymentImportDepositMatchReviewRecord,
): PaymentImportDepositMatchReviewRecord | undefined {
  if (!existing) return undefined;
  if (existing.decisionFingerprint !== incoming.decisionFingerprint) {
    throw new IdempotencyKeyConflictError();
  }
  return clone(existing);
}

export async function createDrizzlePaymentImportDepositMatchReview(
  db: OpenPracticeDatabase,
  record: PaymentImportDepositMatchReviewRecord,
): Promise<PaymentImportDepositMatchReviewRecord> {
  const existing = await getDepositMatchReviewByIdempotency({
    db,
    firmId: record.firmId,
    paymentImportReviewRecordId: record.paymentImportReviewRecordId,
    idempotencyKey: record.idempotencyKey,
  });
  const reused = existingDepositMatchReviewOrConflict(existing, record);
  if (reused) return reused;

  try {
    const [row] = await db
      .insert(schema.paymentImportDepositMatchReviews)
      .values(paymentImportDepositMatchReviewInsert(record))
      .returning();
    return mapPaymentImportDepositMatchReviewRow(row);
  } catch (error) {
    if (
      !isPostgresUniqueViolation(
        error,
        "payment_import_deposit_match_reviews_firm_record_idempotency_idx",
      )
    ) {
      throw error;
    }
    const racedExisting = await getDepositMatchReviewByIdempotency({
      db,
      firmId: record.firmId,
      paymentImportReviewRecordId: record.paymentImportReviewRecordId,
      idempotencyKey: record.idempotencyKey,
    });
    const racedReuse = existingDepositMatchReviewOrConflict(racedExisting, record);
    if (racedReuse) return racedReuse;
    throw error;
  }
}

export async function listDrizzlePaymentImportDepositMatchReviews(
  db: OpenPracticeDatabase,
  firmId: string,
  options: PaymentImportDepositMatchReviewListOptions = {},
): Promise<PaymentImportDepositMatchReviewRecord[]> {
  const filters = [eq(schema.paymentImportDepositMatchReviews.firmId, firmId)];
  if (options.matterId) {
    filters.push(eq(schema.paymentImportDepositMatchReviews.matterId, options.matterId));
  }
  if (options.paymentImportReviewRecordId) {
    filters.push(
      eq(
        schema.paymentImportDepositMatchReviews.paymentImportReviewRecordId,
        options.paymentImportReviewRecordId,
      ),
    );
  }
  if (options.candidateManualPaymentId) {
    filters.push(
      eq(
        schema.paymentImportDepositMatchReviews.candidateManualPaymentId,
        options.candidateManualPaymentId,
      ),
    );
  }
  if (options.decision) {
    filters.push(eq(schema.paymentImportDepositMatchReviews.decision, options.decision));
  }
  const rows = await db
    .select()
    .from(schema.paymentImportDepositMatchReviews)
    .where(and(...filters))
    .orderBy(desc(schema.paymentImportDepositMatchReviews.reviewedAt));
  return rows.map(mapPaymentImportDepositMatchReviewRow);
}
