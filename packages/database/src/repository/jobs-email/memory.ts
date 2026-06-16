import type {
  EmailEventRecord,
  EmailOutboxRecord,
  EmailReceiptTokenRecord,
  JobLifecycleRecord,
} from "@open-practice/domain";
import type { EmailJobsRepository } from "../jobs-email-contracts.js";
import {
  assertSameIdempotencyFingerprint,
  clone,
  sanitizeEmailDeliveryMetadata,
} from "../contracts.js";
import { nextEmailAttemptCount, sanitizeEmailFailureSummary } from "../drizzle-mappers.js";

export interface MemoryEmailJobsStore {
  jobLifecycleRecords: JobLifecycleRecord[];
  emailOutbox: EmailOutboxRecord[];
  emailEvents: EmailEventRecord[];
  emailReceiptTokens: EmailReceiptTokenRecord[];
}

export function createMemoryJobLifecycleRecord(
  store: MemoryEmailJobsStore,
  record: JobLifecycleRecord,
): JobLifecycleRecord {
  const existing = record.idempotencyKey
    ? store.jobLifecycleRecords.find(
        (job) => job.firmId === record.firmId && job.idempotencyKey === record.idempotencyKey,
      )
    : undefined;
  if (existing) {
    assertSameIdempotencyFingerprint(existing.metadata, record.metadata);
    return clone(existing);
  }
  store.jobLifecycleRecords.push(clone(record));
  return clone(record);
}

export function createMemoryQueuedEmailOutbox(
  store: MemoryEmailJobsStore,
  input: {
    email: EmailOutboxRecord;
    event: EmailEventRecord;
    job: JobLifecycleRecord;
  },
): {
  email: EmailOutboxRecord;
  event: EmailEventRecord;
  job: JobLifecycleRecord;
} {
  const existingEmail = input.email.idempotencyKey
    ? store.emailOutbox.find(
        (email) =>
          email.firmId === input.email.firmId &&
          email.idempotencyKey === input.email.idempotencyKey,
      )
    : undefined;
  if (existingEmail) {
    assertSameIdempotencyFingerprint(existingEmail.metadata, input.email.metadata);
    const existingEvent =
      store.emailEvents.find(
        (event) => event.firmId === existingEmail.firmId && event.emailId === existingEmail.id,
      ) ?? input.event;
    const existingJob =
      store.jobLifecycleRecords.find(
        (job) =>
          job.firmId === existingEmail.firmId &&
          job.targetResourceType === "email_outbox" &&
          job.targetResourceId === existingEmail.id,
      ) ?? input.job;
    return {
      email: clone(existingEmail),
      event: clone(existingEvent),
      job: clone(existingJob),
    };
  }
  store.emailOutbox.push(clone(input.email));
  store.emailEvents.push(clone(input.event));
  store.jobLifecycleRecords.push(clone(input.job));
  return clone(input);
}

export function getMemoryEmailOutbox(
  store: MemoryEmailJobsStore,
  firmId: string,
  emailId: string,
): EmailOutboxRecord | undefined {
  return clone(store.emailOutbox.find((email) => email.firmId === firmId && email.id === emailId));
}

export function listMemoryEmailOutbox(
  store: MemoryEmailJobsStore,
  firmId: string,
  options: { matterId?: string; limit?: number } = {},
): EmailOutboxRecord[] {
  const limit = options.limit ?? 50;
  return clone(
    store.emailOutbox
      .filter((email) => {
        if (email.firmId !== firmId) return false;
        if (options.matterId && email.matterId !== options.matterId) return false;
        return true;
      })
      .sort((left, right) => right.queuedAt.localeCompare(left.queuedAt))
      .slice(0, limit),
  );
}

export function getMemoryEmailOutboxByReceiptTokenHash(
  store: MemoryEmailJobsStore,
  receiptTokenHash: string,
): EmailOutboxRecord | undefined {
  const token = store.emailReceiptTokens.find(
    (candidate) => candidate.tokenHash === receiptTokenHash,
  );
  if (!token) return undefined;
  return clone(
    store.emailOutbox.find((email) => email.firmId === token.firmId && email.id === token.emailId),
  );
}

export function recordMemoryEmailDeliveryReceipt(
  store: MemoryEmailJobsStore,
  input: {
    firmId: string;
    emailId: string;
    receiptTokenHash: string;
    recordedAt: string;
  },
): { email: EmailOutboxRecord; recorded: boolean } {
  const result = recordMemoryEmailReceiptToken(store, {
    tokenHash: input.receiptTokenHash,
    recordedAt: input.recordedAt,
  });
  if (result) {
    const token = result.token;
    if (token.firmId !== input.firmId || token.emailId !== input.emailId) {
      throw new Error(`Email outbox receipt ${input.emailId} was not found`);
    }
    const email = getMemoryEmailOutbox(store, token.firmId, token.emailId);
    if (!email) throw new Error(`Email outbox record ${token.emailId} was not found`);
    return { email, recorded: result.recordedNow };
  }
  throw new Error(`Email outbox receipt ${input.emailId} was not found`);
}

export function recordMemoryEmailDeliveryResult(
  store: MemoryEmailJobsStore,
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
): { email: EmailOutboxRecord; event: EmailEventRecord } {
  const index = store.emailOutbox.findIndex(
    (email) => email.firmId === input.firmId && email.id === input.emailId,
  );
  if (index === -1) throw new Error(`Email outbox record ${input.emailId} was not found`);

  const existing = store.emailOutbox[index]!;
  const terminal = input.terminal ?? input.status === "failed";
  const failureSummary = sanitizeEmailFailureSummary(input.errorMessage);
  const attemptCount = nextEmailAttemptCount(existing, input.attemptNumber);
  const deliveryMetadata = sanitizeEmailDeliveryMetadata(input.metadata);
  const email: EmailOutboxRecord = {
    ...existing,
    status:
      input.status === "failed" && !terminal
        ? "queued"
        : (input.status as EmailOutboxRecord["status"]),
    sentAt: input.status === "sent" ? input.occurredAt : existing.sentAt,
    failedAt: input.status === "failed" && terminal ? input.occurredAt : undefined,
    attemptCount,
    lastAttemptAt: input.attemptNumber ? input.occurredAt : existing.lastAttemptAt,
    terminalFailureAt: input.status === "failed" && terminal ? input.occurredAt : undefined,
    terminalFailureReason: input.status === "failed" && terminal ? failureSummary : undefined,
    errorMessage: input.status === "failed" && terminal ? failureSummary : undefined,
    metadata: {
      ...existing.metadata,
      deliveryState: deliveryMetadata,
    },
  };
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
  store.emailOutbox[index] = clone(email);
  store.emailEvents.push(clone(event));
  return { email: clone(email), event: clone(event) };
}

export function retryMemoryEmailOutbox(
  store: MemoryEmailJobsStore,
  input: {
    firmId: string;
    emailId: string;
    occurredAt: string;
    requestedByUserId: string;
    job: JobLifecycleRecord;
    metadata?: Record<string, unknown>;
  },
): { email: EmailOutboxRecord; event: EmailEventRecord; job: JobLifecycleRecord } {
  const deliveryMetadata = sanitizeEmailDeliveryMetadata(input.metadata);
  const existingJob = input.job.idempotencyKey
    ? store.jobLifecycleRecords.find(
        (job) =>
          job.firmId === input.firmId &&
          job.idempotencyKey === input.job.idempotencyKey &&
          job.targetResourceType === "email_outbox" &&
          job.targetResourceId === input.emailId,
      )
    : undefined;
  if (existingJob) {
    assertSameIdempotencyFingerprint(existingJob.metadata, input.job.metadata);
    const email = store.emailOutbox.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.emailId,
    );
    if (!email) throw new Error(`Email outbox record ${input.emailId} was not found`);
    const event = store.emailEvents.find(
      (candidate) =>
        candidate.firmId === input.firmId &&
        candidate.emailId === input.emailId &&
        candidate.jobId === existingJob.id,
    ) ?? {
      id: crypto.randomUUID(),
      firmId: input.firmId,
      emailId: input.emailId,
      eventType: "queued" as const,
      occurredAt: existingJob.queuedAt,
      jobId: existingJob.id,
      source: "api" as const,
      metadata: deliveryMetadata,
    };
    return { email: clone(email), event: clone(event), job: clone(existingJob) };
  }
  const index = store.emailOutbox.findIndex(
    (email) => email.firmId === input.firmId && email.id === input.emailId,
  );
  if (index === -1) throw new Error(`Email outbox record ${input.emailId} was not found`);

  const existing = store.emailOutbox[index]!;
  const email: EmailOutboxRecord = {
    ...existing,
    status: "queued",
    failedAt: undefined,
    errorMessage: undefined,
    metadata: {
      ...existing.metadata,
      deliveryState: {
        ...deliveryMetadata,
        manualRetryRequestedAt: input.occurredAt,
        manualRetryRequestedByUserId: input.requestedByUserId,
        nextRetryAt: input.occurredAt,
        terminal: false,
      },
    },
  };
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
  store.emailOutbox[index] = clone(email);
  store.emailEvents.push(clone(event));
  store.jobLifecycleRecords.push(clone(input.job));
  return { email: clone(email), event: clone(event), job: clone(input.job) };
}

function isMatchingCalendarReminderEmail(
  email: EmailOutboxRecord,
  input: {
    firmId: string;
    matterId: string;
    eventId: string;
    reminderId: string;
  },
): boolean {
  return (
    email.firmId === input.firmId &&
    email.matterId === input.matterId &&
    email.status === "queued" &&
    email.templateKey === "calendar.reminder" &&
    email.relatedResourceType === "calendar_event" &&
    email.relatedResourceId === input.eventId &&
    email.metadata.source === "calendar.reminder" &&
    email.metadata.eventId === input.eventId &&
    email.metadata.reminderId === input.reminderId &&
    email.metadata.matterId === input.matterId
  );
}

export function reconcileMemoryCalendarReminderDelivery(
  store: MemoryEmailJobsStore,
  input: {
    firmId: string;
    matterId: string;
    eventId: string;
    reminderId: string;
    occurredAt: string;
    requestedByUserId: string;
    reason: string;
  },
): { cancelledEmails: EmailOutboxRecord[]; skippedJobs: JobLifecycleRecord[] } {
  const cancelledEmails: EmailOutboxRecord[] = [];
  const skippedJobs: JobLifecycleRecord[] = [];

  for (const [index, existing] of store.emailOutbox.entries()) {
    if (!isMatchingCalendarReminderEmail(existing, input)) continue;

    const metadata = {
      ...existing.metadata,
      deliveryState: {
        reconciledBy: "calendar.reminder",
        reconciliationReason: input.reason,
        reconciledAt: input.occurredAt,
        requestedByUserId: input.requestedByUserId,
      },
    };
    const email: EmailOutboxRecord = {
      ...existing,
      status: "cancelled",
      metadata,
    };
    store.emailOutbox[index] = clone(email);
    cancelledEmails.push(clone(email));

    const job = store.jobLifecycleRecords.find(
      (candidate) =>
        candidate.firmId === input.firmId &&
        candidate.queueName === "email" &&
        candidate.jobName === "send_email" &&
        candidate.status === "queued" &&
        candidate.targetResourceType === "email_outbox" &&
        candidate.targetResourceId === existing.id,
    );
    if (job) {
      job.status = "skipped";
      job.finishedAt = input.occurredAt;
      job.metadata = {
        ...job.metadata,
        reconciledBy: "calendar.reminder",
        reconciliationReason: input.reason,
        reconciledAt: input.occurredAt,
        requestedByUserId: input.requestedByUserId,
      };
      skippedJobs.push(clone(job));
    }

    store.emailEvents.push({
      id: crypto.randomUUID(),
      firmId: input.firmId,
      emailId: existing.id,
      eventType: "cancelled",
      occurredAt: input.occurredAt,
      jobId: job?.id,
      source: "api",
      metadata: {
        matterId: input.matterId,
        eventId: input.eventId,
        reminderId: input.reminderId,
        reconciledBy: "calendar.reminder",
        reconciliationReason: input.reason,
      },
    });
  }

  return { cancelledEmails, skippedJobs };
}

export function listMemoryEmailEvents(
  store: MemoryEmailJobsStore,
  firmId: string,
  options: { emailId?: string } = {},
): EmailEventRecord[] {
  return clone(
    store.emailEvents
      .filter(
        (event) =>
          event.firmId === firmId && (!options.emailId || event.emailId === options.emailId),
      )
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)),
  );
}

export function createMemoryEmailReceiptToken(
  store: MemoryEmailJobsStore,
  token: EmailReceiptTokenRecord,
): EmailReceiptTokenRecord {
  const email = store.emailOutbox.find(
    (candidate) => candidate.firmId === token.firmId && candidate.id === token.emailId,
  );
  if (!email) throw new Error("Email receipt token email was not found");
  if (email.matterId !== token.matterId) {
    throw new Error("Email receipt token matter must match the email outbox matter");
  }
  store.emailReceiptTokens.push(clone(token));
  return clone(token);
}

export function getMemoryEmailReceiptTokenByHash(
  store: MemoryEmailJobsStore,
  tokenHash: string,
): EmailReceiptTokenRecord | undefined {
  return clone(store.emailReceiptTokens.find((token) => token.tokenHash === tokenHash));
}

export function recordMemoryEmailReceiptToken(
  store: MemoryEmailJobsStore,
  input: {
    tokenHash: string;
    recordedAt: string;
  },
): { token: EmailReceiptTokenRecord; recordedNow: boolean } | undefined {
  const index = store.emailReceiptTokens.findIndex((token) => token.tokenHash === input.tokenHash);
  if (index === -1) return undefined;
  const existing = store.emailReceiptTokens[index]!;
  if (existing.recordedAt) return { token: clone(existing), recordedNow: false };
  const updated: EmailReceiptTokenRecord = {
    ...existing,
    recordedAt: input.recordedAt,
  };
  store.emailReceiptTokens[index] = clone(updated);
  store.emailEvents.push({
    id: crypto.randomUUID(),
    firmId: updated.firmId,
    emailId: updated.emailId,
    eventType: "receipt_recorded",
    occurredAt: input.recordedAt,
    source: "api",
    metadata: {
      receiptTokenId: updated.id,
      matterId: updated.matterId,
      purpose: updated.purpose,
    },
  });
  return { token: clone(updated), recordedNow: true };
}

export function listMemoryEmailReceiptTokens(
  store: MemoryEmailJobsStore,
  firmId: string,
  options: { emailId?: string; matterId?: string } = {},
): EmailReceiptTokenRecord[] {
  return clone(
    store.emailReceiptTokens
      .filter(
        (token) =>
          token.firmId === firmId &&
          (!options.emailId || token.emailId === options.emailId) &&
          (!options.matterId || token.matterId === options.matterId),
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
  );
}

export function updateMemoryJobLifecycleRecord(
  store: MemoryEmailJobsStore,
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
): JobLifecycleRecord {
  const index = store.jobLifecycleRecords.findIndex(
    (record) => record.firmId === firmId && record.id === id,
  );
  if (index === -1) throw new Error(`Job lifecycle record ${id} was not found`);
  store.jobLifecycleRecords[index] = { ...store.jobLifecycleRecords[index], ...clone(updates) };
  return clone(store.jobLifecycleRecords[index]);
}

export function listMemoryJobLifecycleRecords(
  store: MemoryEmailJobsStore,
  firmId: string,
  options: {
    status?: JobLifecycleRecord["status"];
    queueName?: JobLifecycleRecord["queueName"];
    queuedBefore?: string;
    limit?: number;
  } = {},
): JobLifecycleRecord[] {
  const limit = options.limit && options.limit > 0 ? options.limit : undefined;
  return clone(
    store.jobLifecycleRecords
      .filter(
        (record) =>
          record.firmId === firmId &&
          (!options.status || record.status === options.status) &&
          (!options.queueName || record.queueName === options.queueName) &&
          (!options.queuedBefore || record.queuedAt < options.queuedBefore),
      )
      .sort((left, right) => right.queuedAt.localeCompare(left.queuedAt))
      .slice(0, limit),
  );
}

export function createMemoryEmailJobsRepository(store: MemoryEmailJobsStore): EmailJobsRepository {
  return {
    createJobLifecycleRecord: async (record) => createMemoryJobLifecycleRecord(store, record),
    createQueuedEmailOutbox: async (input) => createMemoryQueuedEmailOutbox(store, input),
    getEmailOutbox: async (firmId, emailId) => getMemoryEmailOutbox(store, firmId, emailId),
    listEmailOutbox: async (firmId, options) => listMemoryEmailOutbox(store, firmId, options),
    getEmailOutboxByReceiptTokenHash: async (receiptTokenHash) =>
      getMemoryEmailOutboxByReceiptTokenHash(store, receiptTokenHash),
    recordEmailDeliveryReceipt: async (input) => recordMemoryEmailDeliveryReceipt(store, input),
    createEmailReceiptToken: async (token) => createMemoryEmailReceiptToken(store, token),
    getEmailReceiptTokenByHash: async (tokenHash) =>
      getMemoryEmailReceiptTokenByHash(store, tokenHash),
    recordEmailReceiptToken: async (input) => recordMemoryEmailReceiptToken(store, input),
    listEmailReceiptTokens: async (firmId, options) =>
      listMemoryEmailReceiptTokens(store, firmId, options),
    recordEmailDeliveryResult: async (input) => recordMemoryEmailDeliveryResult(store, input),
    retryEmailOutbox: async (input) => retryMemoryEmailOutbox(store, input),
    reconcileCalendarReminderDelivery: async (input) =>
      reconcileMemoryCalendarReminderDelivery(store, input),
    listEmailEvents: async (firmId, options) => listMemoryEmailEvents(store, firmId, options),
    updateJobLifecycleRecord: async (firmId, id, updates) =>
      updateMemoryJobLifecycleRecord(store, firmId, id, updates),
    listJobLifecycleRecords: async (firmId, options) =>
      listMemoryJobLifecycleRecords(store, firmId, options),
  };
}
