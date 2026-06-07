import type {
  EmailEventRecord,
  EmailOutboxRecord,
  EmailReceiptTokenRecord,
  JobLifecycleRecord,
} from "@open-practice/domain";
import { and, asc, desc, eq, isNull, lt } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type { EmailJobsRepository } from "../jobs-email-contracts.js";
import {
  assertSameIdempotencyFingerprint,
  clone,
  isPostgresUniqueViolation,
  sanitizeEmailDeliveryMetadata,
} from "../contracts.js";
import {
  emailEventInsert,
  emailOutboxInsert,
  emailReceiptTokenInsert,
  jobLifecycleInsert,
  mapEmailEventRow,
  mapEmailOutboxRow,
  mapEmailReceiptTokenRow,
  mapJobLifecycleRow,
  nextEmailAttemptCount,
  sanitizeEmailFailureSummary,
} from "../drizzle-mappers.js";

export async function createDrizzleJobLifecycleRecord(
  db: OpenPracticeDatabase,
  record: JobLifecycleRecord,
): Promise<JobLifecycleRecord> {
  try {
    const [row] = await db
      .insert(schema.jobLifecycleRecords)
      .values(jobLifecycleInsert(record))
      .returning();
    return mapJobLifecycleRow(row);
  } catch (error) {
    if (!isPostgresUniqueViolation(error, "job_lifecycle_records_firm_idempotency_idx")) {
      throw error;
    }
    const [existingRow] = await db
      .select()
      .from(schema.jobLifecycleRecords)
      .where(
        and(
          eq(schema.jobLifecycleRecords.firmId, record.firmId),
          eq(schema.jobLifecycleRecords.idempotencyKey, record.idempotencyKey ?? ""),
        ),
      );
    if (!existingRow) throw error;
    const existing = mapJobLifecycleRow(existingRow);
    assertSameIdempotencyFingerprint(existing.metadata, record.metadata);
    return existing;
  }
}

export async function createDrizzleQueuedEmailOutbox(
  db: OpenPracticeDatabase,
  input: {
    email: EmailOutboxRecord;
    event: EmailEventRecord;
    job: JobLifecycleRecord;
  },
): Promise<{
  email: EmailOutboxRecord;
  event: EmailEventRecord;
  job: JobLifecycleRecord;
}> {
  return db.transaction(async (tx) => {
    let emailRow: typeof schema.emailOutbox.$inferSelect;
    try {
      [emailRow] = await tx
        .insert(schema.emailOutbox)
        .values(emailOutboxInsert(input.email))
        .returning();
    } catch (error) {
      if (!isPostgresUniqueViolation(error, "email_outbox_firm_idempotency_idx")) {
        throw error;
      }
      const [existingEmailRow] = await tx
        .select()
        .from(schema.emailOutbox)
        .where(
          and(
            eq(schema.emailOutbox.firmId, input.email.firmId),
            eq(schema.emailOutbox.idempotencyKey, input.email.idempotencyKey ?? ""),
          ),
        );
      if (!existingEmailRow) throw error;
      const existingEmail = mapEmailOutboxRow(existingEmailRow);
      assertSameIdempotencyFingerprint(existingEmail.metadata, input.email.metadata);
      const [existingEventRow] = await tx
        .select()
        .from(schema.emailEvents)
        .where(
          and(
            eq(schema.emailEvents.firmId, existingEmail.firmId),
            eq(schema.emailEvents.emailId, existingEmail.id),
          ),
        )
        .orderBy(asc(schema.emailEvents.occurredAt))
        .limit(1);
      const [existingJobRow] = await tx
        .select()
        .from(schema.jobLifecycleRecords)
        .where(
          and(
            eq(schema.jobLifecycleRecords.firmId, existingEmail.firmId),
            eq(schema.jobLifecycleRecords.targetResourceType, "email_outbox"),
            eq(schema.jobLifecycleRecords.targetResourceId, existingEmail.id),
          ),
        )
        .orderBy(asc(schema.jobLifecycleRecords.queuedAt))
        .limit(1);
      return {
        email: existingEmail,
        event: existingEventRow ? mapEmailEventRow(existingEventRow) : input.event,
        job: existingJobRow ? mapJobLifecycleRow(existingJobRow) : input.job,
      };
    }
    const [eventRow] = await tx
      .insert(schema.emailEvents)
      .values(emailEventInsert(input.event))
      .returning();
    const [jobRow] = await tx
      .insert(schema.jobLifecycleRecords)
      .values(jobLifecycleInsert(input.job))
      .returning();
    return {
      email: mapEmailOutboxRow(emailRow),
      event: mapEmailEventRow(eventRow),
      job: mapJobLifecycleRow(jobRow),
    };
  });
}

export async function getDrizzleEmailOutbox(
  db: OpenPracticeDatabase,
  firmId: string,
  emailId: string,
): Promise<EmailOutboxRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.emailOutbox)
    .where(and(eq(schema.emailOutbox.firmId, firmId), eq(schema.emailOutbox.id, emailId)));
  return row ? mapEmailOutboxRow(row) : undefined;
}

export async function listDrizzleEmailOutbox(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterId?: string; limit?: number } = {},
): Promise<EmailOutboxRecord[]> {
  const conditions = [eq(schema.emailOutbox.firmId, firmId)];
  if (options.matterId) conditions.push(eq(schema.emailOutbox.matterId, options.matterId));
  const rows = await db
    .select()
    .from(schema.emailOutbox)
    .where(and(...conditions))
    .orderBy(desc(schema.emailOutbox.queuedAt))
    .limit(options.limit ?? 50);
  return rows.map(mapEmailOutboxRow);
}

export async function getDrizzleEmailOutboxByReceiptTokenHash(
  db: OpenPracticeDatabase,
  receiptTokenHash: string,
): Promise<EmailOutboxRecord | undefined> {
  const token = await getDrizzleEmailReceiptTokenByHash(db, receiptTokenHash);
  if (!token) return undefined;
  return getDrizzleEmailOutbox(db, token.firmId, token.emailId);
}

export async function recordDrizzleEmailDeliveryReceipt(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    emailId: string;
    receiptTokenHash: string;
    recordedAt: string;
  },
): Promise<{ email: EmailOutboxRecord; recorded: boolean }> {
  const result = await recordDrizzleEmailReceiptToken(db, {
    tokenHash: input.receiptTokenHash,
    recordedAt: input.recordedAt,
  });
  if (result) {
    const token = result.token;
    if (token.firmId !== input.firmId || token.emailId !== input.emailId) {
      throw new Error(`Email outbox receipt ${input.emailId} was not found`);
    }
    const email = await getDrizzleEmailOutbox(db, token.firmId, token.emailId);
    if (!email) throw new Error(`Email outbox record ${token.emailId} was not found`);
    return { email, recorded: result.recordedNow };
  }
  throw new Error(`Email outbox receipt ${input.emailId} was not found`);
}

export async function createDrizzleEmailReceiptToken(
  db: OpenPracticeDatabase,
  token: EmailReceiptTokenRecord,
): Promise<EmailReceiptTokenRecord> {
  const email = await getDrizzleEmailOutbox(db, token.firmId, token.emailId);
  if (!email) throw new Error("Email receipt token email was not found");
  if (email.matterId !== token.matterId) {
    throw new Error("Email receipt token matter must match the email outbox matter");
  }
  await db.insert(schema.emailReceiptTokens).values(emailReceiptTokenInsert(token));
  return clone(token);
}

export async function getDrizzleEmailReceiptTokenByHash(
  db: OpenPracticeDatabase,
  tokenHash: string,
): Promise<EmailReceiptTokenRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.emailReceiptTokens)
    .where(eq(schema.emailReceiptTokens.tokenHash, tokenHash));
  return row ? mapEmailReceiptTokenRow(row) : undefined;
}

export async function recordDrizzleEmailReceiptToken(
  db: OpenPracticeDatabase,
  input: {
    tokenHash: string;
    recordedAt: string;
  },
): Promise<{ token: EmailReceiptTokenRecord; recordedNow: boolean } | undefined> {
  return db.transaction(async (tx) => {
    const [existingRow] = await tx
      .select()
      .from(schema.emailReceiptTokens)
      .where(eq(schema.emailReceiptTokens.tokenHash, input.tokenHash));
    if (!existingRow) return undefined;
    const existing = mapEmailReceiptTokenRow(existingRow);
    if (existing.recordedAt) return { token: existing, recordedNow: false };

    const [tokenRow] = await tx
      .update(schema.emailReceiptTokens)
      .set({ recordedAt: new Date(input.recordedAt) })
      .where(
        and(
          eq(schema.emailReceiptTokens.tokenHash, input.tokenHash),
          isNull(schema.emailReceiptTokens.recordedAt),
        ),
      )
      .returning();
    if (!tokenRow) {
      const [latestRow] = await tx
        .select()
        .from(schema.emailReceiptTokens)
        .where(eq(schema.emailReceiptTokens.tokenHash, input.tokenHash));
      return latestRow
        ? { token: mapEmailReceiptTokenRow(latestRow), recordedNow: false }
        : undefined;
    }
    const token = mapEmailReceiptTokenRow(tokenRow);
    await tx.insert(schema.emailEvents).values(
      emailEventInsert({
        id: crypto.randomUUID(),
        firmId: token.firmId,
        emailId: token.emailId,
        eventType: "receipt_recorded",
        occurredAt: input.recordedAt,
        source: "api",
        metadata: {
          receiptTokenId: token.id,
          matterId: token.matterId,
          purpose: token.purpose,
        },
      }),
    );
    return { token, recordedNow: true };
  });
}

export async function listDrizzleEmailReceiptTokens(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { emailId?: string; matterId?: string } = {},
): Promise<EmailReceiptTokenRecord[]> {
  const filters = [eq(schema.emailReceiptTokens.firmId, firmId)];
  if (options.emailId) filters.push(eq(schema.emailReceiptTokens.emailId, options.emailId));
  if (options.matterId) filters.push(eq(schema.emailReceiptTokens.matterId, options.matterId));
  const rows = await db
    .select()
    .from(schema.emailReceiptTokens)
    .where(and(...filters))
    .orderBy(asc(schema.emailReceiptTokens.createdAt));
  return rows.map(mapEmailReceiptTokenRow);
}

export async function recordDrizzleEmailDeliveryResult(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    emailId: string;
    status: "sending" | "sent" | "failed";
    occurredAt: string;
    providerMessageId?: string;
    attemptNumber?: number;
    jobId?: string;
    source?: EmailEventRecord["source"];
    terminal?: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ email: EmailOutboxRecord; event: EmailEventRecord }> {
  return db.transaction(async (tx) => {
    const occurredAt = new Date(input.occurredAt);
    const [existingRow] = await tx
      .select()
      .from(schema.emailOutbox)
      .where(
        and(eq(schema.emailOutbox.firmId, input.firmId), eq(schema.emailOutbox.id, input.emailId)),
      );
    if (!existingRow) throw new Error(`Email outbox record ${input.emailId} was not found`);
    const existing = mapEmailOutboxRow(existingRow);
    const terminal = input.terminal ?? input.status === "failed";
    const failureSummary = sanitizeEmailFailureSummary(input.errorMessage);
    const attemptCount = nextEmailAttemptCount(existing, input.attemptNumber);
    const deliveryMetadata = sanitizeEmailDeliveryMetadata(input.metadata);
    const metadata = { ...existing.metadata, deliveryState: deliveryMetadata };
    const [emailRow] = await tx
      .update(schema.emailOutbox)
      .set({
        status:
          input.status === "failed" && !terminal
            ? "queued"
            : (input.status as EmailOutboxRecord["status"]),
        sentAt: input.status === "sent" ? occurredAt : null,
        failedAt: input.status === "failed" && terminal ? occurredAt : null,
        attemptCount,
        lastAttemptAt: input.attemptNumber ? occurredAt : null,
        terminalFailureAt: input.status === "failed" && terminal ? occurredAt : null,
        terminalFailureReason:
          input.status === "failed" && terminal ? (failureSummary ?? null) : null,
        errorMessage: input.status === "failed" && terminal ? (failureSummary ?? null) : null,
        metadata,
      })
      .where(
        and(eq(schema.emailOutbox.firmId, input.firmId), eq(schema.emailOutbox.id, input.emailId)),
      )
      .returning();

    const event: EmailEventRecord = {
      id: crypto.randomUUID(),
      firmId: input.firmId,
      emailId: input.emailId,
      eventType: input.status,
      occurredAt: input.occurredAt,
      providerMessageId: input.providerMessageId,
      attemptNumber: input.attemptNumber,
      jobId: input.jobId,
      source: input.source ?? "worker",
      errorMessage: input.status === "failed" ? failureSummary : undefined,
      metadata: deliveryMetadata,
    };
    const [eventRow] = await tx
      .insert(schema.emailEvents)
      .values(emailEventInsert(event))
      .returning();
    return { email: mapEmailOutboxRow(emailRow), event: mapEmailEventRow(eventRow) };
  });
}

export async function retryDrizzleEmailOutbox(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    emailId: string;
    occurredAt: string;
    requestedByUserId: string;
    job: JobLifecycleRecord;
    metadata?: Record<string, unknown>;
  },
): Promise<{ email: EmailOutboxRecord; event: EmailEventRecord; job: JobLifecycleRecord }> {
  const deliveryMetadata = sanitizeEmailDeliveryMetadata(input.metadata);
  return db.transaction(async (tx) => {
    if (input.job.idempotencyKey) {
      const [existingJobRow] = await tx
        .select()
        .from(schema.jobLifecycleRecords)
        .where(
          and(
            eq(schema.jobLifecycleRecords.firmId, input.firmId),
            eq(schema.jobLifecycleRecords.idempotencyKey, input.job.idempotencyKey),
            eq(schema.jobLifecycleRecords.targetResourceType, "email_outbox"),
            eq(schema.jobLifecycleRecords.targetResourceId, input.emailId),
          ),
        );
      if (existingJobRow) {
        const existingJob = mapJobLifecycleRow(existingJobRow);
        assertSameIdempotencyFingerprint(existingJob.metadata, input.job.metadata);
        const [emailRow] = await tx
          .select()
          .from(schema.emailOutbox)
          .where(
            and(
              eq(schema.emailOutbox.firmId, input.firmId),
              eq(schema.emailOutbox.id, input.emailId),
            ),
          );
        if (!emailRow) throw new Error(`Email outbox record ${input.emailId} was not found`);
        const [eventRow] = await tx
          .select()
          .from(schema.emailEvents)
          .where(
            and(
              eq(schema.emailEvents.firmId, input.firmId),
              eq(schema.emailEvents.emailId, input.emailId),
              eq(schema.emailEvents.jobId, existingJob.id),
            ),
          );
        return {
          email: mapEmailOutboxRow(emailRow),
          event: eventRow
            ? mapEmailEventRow(eventRow)
            : {
                id: crypto.randomUUID(),
                firmId: input.firmId,
                emailId: input.emailId,
                eventType: "queued",
                occurredAt: existingJob.queuedAt,
                jobId: existingJob.id,
                source: "api",
                metadata: deliveryMetadata,
              },
          job: existingJob,
        };
      }
    }
    const [existingRow] = await tx
      .select()
      .from(schema.emailOutbox)
      .where(
        and(eq(schema.emailOutbox.firmId, input.firmId), eq(schema.emailOutbox.id, input.emailId)),
      );
    if (!existingRow) throw new Error(`Email outbox record ${input.emailId} was not found`);
    const metadata = {
      ...existingRow.metadata,
      deliveryState: {
        ...deliveryMetadata,
        manualRetryRequestedAt: input.occurredAt,
        manualRetryRequestedByUserId: input.requestedByUserId,
        nextRetryAt: input.occurredAt,
        terminal: false,
      },
    };
    const [emailRow] = await tx
      .update(schema.emailOutbox)
      .set({
        status: "queued",
        failedAt: null,
        errorMessage: null,
        metadata,
      })
      .where(
        and(eq(schema.emailOutbox.firmId, input.firmId), eq(schema.emailOutbox.id, input.emailId)),
      )
      .returning();

    const event: EmailEventRecord = {
      id: crypto.randomUUID(),
      firmId: input.firmId,
      emailId: input.emailId,
      eventType: "queued",
      occurredAt: input.occurredAt,
      jobId: input.job.id,
      source: "api",
      metadata: {
        ...deliveryMetadata,
        manualRetry: true,
        requestedByUserId: input.requestedByUserId,
        jobId: input.job.id,
      },
    };
    const [eventRow] = await tx
      .insert(schema.emailEvents)
      .values(emailEventInsert(event))
      .returning();
    const [jobRow] = await tx
      .insert(schema.jobLifecycleRecords)
      .values(jobLifecycleInsert(input.job))
      .returning();
    return {
      email: mapEmailOutboxRow(emailRow),
      event: mapEmailEventRow(eventRow),
      job: mapJobLifecycleRow(jobRow),
    };
  });
}

export async function listDrizzleEmailEvents(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { emailId?: string } = {},
): Promise<EmailEventRecord[]> {
  const conditions = [eq(schema.emailEvents.firmId, firmId)];
  if (options.emailId) conditions.push(eq(schema.emailEvents.emailId, options.emailId));
  const rows = await db
    .select()
    .from(schema.emailEvents)
    .where(and(...conditions))
    .orderBy(asc(schema.emailEvents.occurredAt));
  return rows.map(mapEmailEventRow);
}

export async function updateDrizzleJobLifecycleRecord(
  db: OpenPracticeDatabase,
  firmId: string,
  id: string,
  updates: Partial<
    Pick<
      JobLifecycleRecord,
      | "bullJobId"
      | "status"
      | "attemptsMade"
      | "startedAt"
      | "finishedAt"
      | "failedAt"
      | "errorMessage"
      | "metadata"
    >
  >,
): Promise<JobLifecycleRecord> {
  const [row] = await db
    .update(schema.jobLifecycleRecords)
    .set({
      ...updates,
      startedAt: updates.startedAt ? new Date(updates.startedAt) : undefined,
      finishedAt: updates.finishedAt ? new Date(updates.finishedAt) : undefined,
      failedAt: updates.failedAt ? new Date(updates.failedAt) : undefined,
    })
    .where(
      and(eq(schema.jobLifecycleRecords.firmId, firmId), eq(schema.jobLifecycleRecords.id, id)),
    )
    .returning();
  if (!row) throw new Error(`Job lifecycle record ${id} was not found`);
  return mapJobLifecycleRow(row);
}

export async function listDrizzleJobLifecycleRecords(
  db: OpenPracticeDatabase,
  firmId: string,
  options: {
    status?: JobLifecycleRecord["status"];
    queueName?: JobLifecycleRecord["queueName"];
    queuedBefore?: string;
    limit?: number;
  } = {},
): Promise<JobLifecycleRecord[]> {
  const conditions = [eq(schema.jobLifecycleRecords.firmId, firmId)];
  if (options.status) conditions.push(eq(schema.jobLifecycleRecords.status, options.status));
  if (options.queueName)
    conditions.push(eq(schema.jobLifecycleRecords.queueName, options.queueName));
  if (options.queuedBefore)
    conditions.push(lt(schema.jobLifecycleRecords.queuedAt, new Date(options.queuedBefore)));
  let query = db
    .select()
    .from(schema.jobLifecycleRecords)
    .where(and(...conditions))
    .orderBy(desc(schema.jobLifecycleRecords.queuedAt))
    .$dynamic();
  if (options.limit && options.limit > 0) query = query.limit(options.limit);
  const rows = await query;
  return rows.map(mapJobLifecycleRow);
}

export function createDrizzleEmailJobsRepository(db: OpenPracticeDatabase): EmailJobsRepository {
  return {
    createJobLifecycleRecord: (record) => createDrizzleJobLifecycleRecord(db, record),
    createQueuedEmailOutbox: (input) => createDrizzleQueuedEmailOutbox(db, input),
    getEmailOutbox: (firmId, emailId) => getDrizzleEmailOutbox(db, firmId, emailId),
    listEmailOutbox: (firmId, options) => listDrizzleEmailOutbox(db, firmId, options),
    getEmailOutboxByReceiptTokenHash: (receiptTokenHash) =>
      getDrizzleEmailOutboxByReceiptTokenHash(db, receiptTokenHash),
    recordEmailDeliveryReceipt: (input) => recordDrizzleEmailDeliveryReceipt(db, input),
    createEmailReceiptToken: (token) => createDrizzleEmailReceiptToken(db, token),
    getEmailReceiptTokenByHash: (tokenHash) => getDrizzleEmailReceiptTokenByHash(db, tokenHash),
    recordEmailReceiptToken: (input) => recordDrizzleEmailReceiptToken(db, input),
    listEmailReceiptTokens: (firmId, options) => listDrizzleEmailReceiptTokens(db, firmId, options),
    recordEmailDeliveryResult: (input) => recordDrizzleEmailDeliveryResult(db, input),
    retryEmailOutbox: (input) => retryDrizzleEmailOutbox(db, input),
    listEmailEvents: (firmId, options) => listDrizzleEmailEvents(db, firmId, options),
    updateJobLifecycleRecord: (firmId, id, updates) =>
      updateDrizzleJobLifecycleRecord(db, firmId, id, updates),
    listJobLifecycleRecords: (firmId, options) =>
      listDrizzleJobLifecycleRecords(db, firmId, options),
  };
}
