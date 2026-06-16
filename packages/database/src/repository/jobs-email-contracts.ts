import type {
  EmailEventRecord,
  EmailOutboxRecord,
  EmailReceiptTokenRecord,
  JobLifecycleRecord,
} from "@open-practice/domain";

export interface EmailJobsRepository {
  createJobLifecycleRecord(record: JobLifecycleRecord): Promise<JobLifecycleRecord>;
  createQueuedEmailOutbox(input: {
    email: EmailOutboxRecord;
    event: EmailEventRecord;
    job: JobLifecycleRecord;
  }): Promise<{
    email: EmailOutboxRecord;
    event: EmailEventRecord;
    job: JobLifecycleRecord;
  }>;
  getEmailOutbox(firmId: string, emailId: string): Promise<EmailOutboxRecord | undefined>;
  listEmailOutbox(
    firmId: string,
    options?: { matterId?: string; limit?: number },
  ): Promise<EmailOutboxRecord[]>;
  getEmailOutboxByReceiptTokenHash(
    receiptTokenHash: string,
  ): Promise<EmailOutboxRecord | undefined>;
  recordEmailDeliveryReceipt(input: {
    firmId: string;
    emailId: string;
    receiptTokenHash: string;
    recordedAt: string;
  }): Promise<{ email: EmailOutboxRecord; recorded: boolean }>;
  recordEmailDeliveryResult(input: {
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
  }): Promise<{ email: EmailOutboxRecord; event: EmailEventRecord }>;
  retryEmailOutbox(input: {
    firmId: string;
    emailId: string;
    occurredAt: string;
    requestedByUserId: string;
    job: JobLifecycleRecord;
    metadata?: Record<string, unknown>;
  }): Promise<{ email: EmailOutboxRecord; event: EmailEventRecord; job: JobLifecycleRecord }>;
  reconcileCalendarReminderDelivery(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    reminderId: string;
    occurredAt: string;
    requestedByUserId: string;
    reason: string;
  }): Promise<{ cancelledEmails: EmailOutboxRecord[]; skippedJobs: JobLifecycleRecord[] }>;
  listEmailEvents(firmId: string, options?: { emailId?: string }): Promise<EmailEventRecord[]>;
  createEmailReceiptToken(token: EmailReceiptTokenRecord): Promise<EmailReceiptTokenRecord>;
  getEmailReceiptTokenByHash(tokenHash: string): Promise<EmailReceiptTokenRecord | undefined>;
  recordEmailReceiptToken(input: {
    tokenHash: string;
    recordedAt: string;
  }): Promise<{ token: EmailReceiptTokenRecord; recordedNow: boolean } | undefined>;
  listEmailReceiptTokens(
    firmId: string,
    options?: { emailId?: string; matterId?: string },
  ): Promise<EmailReceiptTokenRecord[]>;
  updateJobLifecycleRecord(
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
  ): Promise<JobLifecycleRecord>;
  listJobLifecycleRecords(
    firmId: string,
    options?: {
      status?: JobLifecycleRecord["status"];
      queueName?: JobLifecycleRecord["queueName"];
      queuedBefore?: string;
      limit?: number;
    },
  ): Promise<JobLifecycleRecord[]>;
}
