import type {
  PaymentImportDepositMatchReviewRecord,
  PaymentImportRefundChargebackResolutionRecord,
  PaymentImportRefundChargebackReviewRecord,
  PaymentImportReviewRecord,
} from "@open-practice/domain";
import { and, desc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { IdempotencyKeyConflictError, clone, isPostgresUniqueViolation } from "../contracts.js";
import {
  mapPaymentImportDepositMatchReviewRow,
  mapPaymentImportRefundChargebackResolutionRecordRow,
  mapPaymentImportRefundChargebackReviewRow,
  mapPaymentImportReviewRecordRow,
  paymentImportDepositMatchReviewInsert,
  paymentImportRefundChargebackResolutionRecordInsert,
  paymentImportRefundChargebackReviewInsert,
  paymentImportReviewRecordInsert,
} from "../drizzle-mappers.js";
import type {
  PaymentImportDepositMatchReviewListOptions,
  PaymentImportRefundChargebackResolutionRecordListOptions,
  PaymentImportRefundChargebackReviewListOptions,
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

async function getRefundChargebackReviewByIdempotency(input: {
  db: OpenPracticeDatabase;
  firmId: string;
  paymentImportReviewRecordId: string;
  idempotencyKey: string;
}): Promise<PaymentImportRefundChargebackReviewRecord | undefined> {
  const [row] = await input.db
    .select()
    .from(schema.paymentImportRefundChargebackReviews)
    .where(
      and(
        eq(schema.paymentImportRefundChargebackReviews.firmId, input.firmId),
        eq(
          schema.paymentImportRefundChargebackReviews.paymentImportReviewRecordId,
          input.paymentImportReviewRecordId,
        ),
        eq(schema.paymentImportRefundChargebackReviews.idempotencyKey, input.idempotencyKey),
      ),
    );
  return row ? mapPaymentImportRefundChargebackReviewRow(row) : undefined;
}

function existingRefundChargebackReviewOrConflict(
  existing: PaymentImportRefundChargebackReviewRecord | undefined,
  incoming: PaymentImportRefundChargebackReviewRecord,
): PaymentImportRefundChargebackReviewRecord | undefined {
  if (!existing) return undefined;
  if (existing.decisionFingerprint !== incoming.decisionFingerprint) {
    throw new IdempotencyKeyConflictError();
  }
  return clone(existing);
}

export async function createDrizzlePaymentImportRefundChargebackReview(
  db: OpenPracticeDatabase,
  record: PaymentImportRefundChargebackReviewRecord,
): Promise<PaymentImportRefundChargebackReviewRecord> {
  const existing = await getRefundChargebackReviewByIdempotency({
    db,
    firmId: record.firmId,
    paymentImportReviewRecordId: record.paymentImportReviewRecordId,
    idempotencyKey: record.idempotencyKey,
  });
  const reused = existingRefundChargebackReviewOrConflict(existing, record);
  if (reused) return reused;

  try {
    const [row] = await db
      .insert(schema.paymentImportRefundChargebackReviews)
      .values(paymentImportRefundChargebackReviewInsert(record))
      .returning();
    return mapPaymentImportRefundChargebackReviewRow(row);
  } catch (error) {
    if (
      !isPostgresUniqueViolation(error, "payment_import_rc_reviews_firm_record_idempotency_idx")
    ) {
      throw error;
    }
    const racedExisting = await getRefundChargebackReviewByIdempotency({
      db,
      firmId: record.firmId,
      paymentImportReviewRecordId: record.paymentImportReviewRecordId,
      idempotencyKey: record.idempotencyKey,
    });
    const racedReuse = existingRefundChargebackReviewOrConflict(racedExisting, record);
    if (racedReuse) return racedReuse;
    throw error;
  }
}

export async function listDrizzlePaymentImportRefundChargebackReviews(
  db: OpenPracticeDatabase,
  firmId: string,
  options: PaymentImportRefundChargebackReviewListOptions = {},
): Promise<PaymentImportRefundChargebackReviewRecord[]> {
  const filters = [eq(schema.paymentImportRefundChargebackReviews.firmId, firmId)];
  if (options.matterId) {
    filters.push(eq(schema.paymentImportRefundChargebackReviews.matterId, options.matterId));
  }
  if (options.paymentImportReviewRecordId) {
    filters.push(
      eq(
        schema.paymentImportRefundChargebackReviews.paymentImportReviewRecordId,
        options.paymentImportReviewRecordId,
      ),
    );
  }
  if (options.category) {
    filters.push(eq(schema.paymentImportRefundChargebackReviews.category, options.category));
  }
  if (options.decision) {
    filters.push(eq(schema.paymentImportRefundChargebackReviews.decision, options.decision));
  }
  const rows = await db
    .select()
    .from(schema.paymentImportRefundChargebackReviews)
    .where(and(...filters))
    .orderBy(desc(schema.paymentImportRefundChargebackReviews.reviewedAt));
  return rows.map(mapPaymentImportRefundChargebackReviewRow);
}

async function getRefundChargebackResolutionRecordByIdempotency(input: {
  db: OpenPracticeDatabase;
  firmId: string;
  paymentImportReviewRecordId: string;
  idempotencyKey: string;
}): Promise<PaymentImportRefundChargebackResolutionRecord | undefined> {
  const [row] = await input.db
    .select()
    .from(schema.paymentImportRefundChargebackResolutionRecords)
    .where(
      and(
        eq(schema.paymentImportRefundChargebackResolutionRecords.firmId, input.firmId),
        eq(
          schema.paymentImportRefundChargebackResolutionRecords.paymentImportReviewRecordId,
          input.paymentImportReviewRecordId,
        ),
        eq(
          schema.paymentImportRefundChargebackResolutionRecords.idempotencyKey,
          input.idempotencyKey,
        ),
      ),
    );
  return row ? mapPaymentImportRefundChargebackResolutionRecordRow(row) : undefined;
}

function existingRefundChargebackResolutionRecordOrConflict(
  existing: PaymentImportRefundChargebackResolutionRecord | undefined,
  incoming: PaymentImportRefundChargebackResolutionRecord,
): PaymentImportRefundChargebackResolutionRecord | undefined {
  if (!existing) return undefined;
  if (existing.resolutionFingerprint !== incoming.resolutionFingerprint) {
    throw new IdempotencyKeyConflictError();
  }
  return clone(existing);
}

export async function createDrizzlePaymentImportRefundChargebackResolutionRecord(
  db: OpenPracticeDatabase,
  record: PaymentImportRefundChargebackResolutionRecord,
): Promise<PaymentImportRefundChargebackResolutionRecord> {
  const existing = await getRefundChargebackResolutionRecordByIdempotency({
    db,
    firmId: record.firmId,
    paymentImportReviewRecordId: record.paymentImportReviewRecordId,
    idempotencyKey: record.idempotencyKey,
  });
  const reused = existingRefundChargebackResolutionRecordOrConflict(existing, record);
  if (reused) return reused;

  try {
    const [row] = await db
      .insert(schema.paymentImportRefundChargebackResolutionRecords)
      .values(paymentImportRefundChargebackResolutionRecordInsert(record))
      .returning();
    return mapPaymentImportRefundChargebackResolutionRecordRow(row);
  } catch (error) {
    if (!isPostgresUniqueViolation(error, "payment_import_rc_res_firm_record_idempotency_idx")) {
      throw error;
    }
    const racedExisting = await getRefundChargebackResolutionRecordByIdempotency({
      db,
      firmId: record.firmId,
      paymentImportReviewRecordId: record.paymentImportReviewRecordId,
      idempotencyKey: record.idempotencyKey,
    });
    const racedReuse = existingRefundChargebackResolutionRecordOrConflict(racedExisting, record);
    if (racedReuse) return racedReuse;
    throw error;
  }
}

export async function listDrizzlePaymentImportRefundChargebackResolutionRecords(
  db: OpenPracticeDatabase,
  firmId: string,
  options: PaymentImportRefundChargebackResolutionRecordListOptions = {},
): Promise<PaymentImportRefundChargebackResolutionRecord[]> {
  const filters = [eq(schema.paymentImportRefundChargebackResolutionRecords.firmId, firmId)];
  if (options.matterId) {
    filters.push(
      eq(schema.paymentImportRefundChargebackResolutionRecords.matterId, options.matterId),
    );
  }
  if (options.paymentImportReviewRecordId) {
    filters.push(
      eq(
        schema.paymentImportRefundChargebackResolutionRecords.paymentImportReviewRecordId,
        options.paymentImportReviewRecordId,
      ),
    );
  }
  if (options.category) {
    filters.push(
      eq(schema.paymentImportRefundChargebackResolutionRecords.category, options.category),
    );
  }
  if (options.resolutionPosture) {
    filters.push(
      eq(
        schema.paymentImportRefundChargebackResolutionRecords.resolutionPosture,
        options.resolutionPosture,
      ),
    );
  }
  const rows = await db
    .select()
    .from(schema.paymentImportRefundChargebackResolutionRecords)
    .where(and(...filters))
    .orderBy(desc(schema.paymentImportRefundChargebackResolutionRecords.recordedAt));
  return rows.map(mapPaymentImportRefundChargebackResolutionRecordRow);
}
