import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type {
  EmailEventRecord,
  EmailOutboxRecord,
  EmailReceiptTokenRecord,
  JobLifecycleRecord,
  ProviderSettingRecord,
} from "@open-practice/domain";
import {
  createProviderConfigCipherFromKey,
  providerConfigEnvelopePrefix,
} from "../src/config-encryption.js";
import { DrizzleOpenPracticeRepository } from "../src/repository/drizzle.js";
import { emailEventInsert, emailReceiptTokenInsert } from "../src/repository/drizzle-mappers.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import * as schema from "../src/schema.js";
import { now } from "./repository.fixtures.js";

const providerConfigKey = "base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
type DrizzleDb = ConstructorParameters<typeof DrizzleOpenPracticeRepository>[0];
type EmailEventRow = ReturnType<typeof emailEventInsert>;
type EmailReceiptTokenRow = ReturnType<typeof emailReceiptTokenInsert>;
type EmailChildRow = EmailEventRow | EmailReceiptTokenRow;

const drizzleDialect = new PgDialect();

function calendarReminderEmail(overrides: Partial<EmailOutboxRecord> = {}): EmailOutboxRecord {
  return {
    id: "email-calendar-reminder-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    templateKey: "calendar.reminder",
    status: "queued",
    to: ["licensee@example.test"],
    cc: [],
    bcc: [],
    from: "Open Practice <no-reply@open-practice.local>",
    subject: "Synthetic calendar reminder",
    htmlBody: "",
    textBody: "Synthetic calendar reminder body.",
    relatedResourceType: "calendar_event",
    relatedResourceId: "calendar-event-001",
    queuedAt: now,
    attemptCount: 0,
    metadata: {
      matterId: "matter-001",
      source: "calendar.reminder",
      eventId: "calendar-event-001",
      reminderId: "calendar-reminder-001",
      reminderStatus: "pending",
    },
    ...overrides,
  };
}

function calendarReminderJob(overrides: Partial<JobLifecycleRecord> = {}): JobLifecycleRecord {
  return {
    id: "job-calendar-reminder-001",
    firmId: "firm-west-legal",
    queueName: "email",
    jobName: "send_email",
    status: "queued",
    targetResourceType: "email_outbox",
    targetResourceId: "email-calendar-reminder-001",
    attemptsMade: 0,
    maxAttempts: 5,
    queuedAt: now,
    metadata: {
      emailId: "email-calendar-reminder-001",
      matterId: "matter-001",
      source: "calendar.reminder",
      templateKey: "calendar.reminder",
    },
    ...overrides,
  };
}

function drizzleProviderSettingsRepositoryWithRows(rows: Record<string, unknown>[] = []) {
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: async () => rows,
        }),
      }),
    }),
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoUpdate: () => ({
          returning: async () => {
            rows.push(value);
            return [value];
          },
        }),
      }),
    }),
  } as unknown as DrizzleDb;
  return { db, rows };
}

function renderedColumnValues(
  rendered: ReturnType<PgDialect["sqlToQuery"]>,
  tableName: string,
  columnName: string,
): unknown[] {
  const columnRef = `"${tableName}"\\."${columnName}"`;
  const equalsMatch = rendered.sql.match(new RegExp(`${columnRef} = \\$(\\d+)`));
  if (equalsMatch?.[1]) return [rendered.params[Number(equalsMatch[1]) - 1]];
  const inMatch = rendered.sql.match(new RegExp(`${columnRef} in \\(([^)]+)\\)`));
  if (!inMatch?.[1]) return [];
  return [...inMatch[1].matchAll(/\$(\d+)/g)].map((match) => rendered.params[Number(match[1]) - 1]);
}

function filterDrizzleEmailChildRows(
  rows: EmailChildRow[],
  tableName: "email_events" | "email_receipt_tokens",
  condition: unknown,
): EmailChildRow[] {
  const rendered = drizzleDialect.sqlToQuery(condition as Parameters<PgDialect["sqlToQuery"]>[0]);
  const firmIds = renderedColumnValues(rendered, tableName, "firm_id");
  const emailIds = renderedColumnValues(rendered, tableName, "email_id");
  const matterIds = renderedColumnValues(rendered, tableName, "matter_id");
  return rows.filter(
    (row) =>
      (firmIds.length === 0 || firmIds.includes(row.firmId)) &&
      (emailIds.length === 0 || emailIds.includes(row.emailId)) &&
      (matterIds.length === 0 || matterIds.includes((row as EmailReceiptTokenRow).matterId)),
  );
}

function sortDrizzleEmailChildRows(
  rows: EmailChildRow[],
  tableName: "email_events" | "email_receipt_tokens",
): EmailChildRow[] {
  const timestampFor = (row: EmailChildRow) =>
    tableName === "email_events"
      ? ((row as EmailEventRow).occurredAt?.getTime() ?? 0)
      : ((row as EmailReceiptTokenRow).createdAt?.getTime() ?? 0);
  return [...rows].sort((left, right) => timestampFor(left) - timestampFor(right));
}

function drizzleEmailJobsRepositoryWithRows(input: {
  emailEvents: EmailEventRecord[];
  emailReceiptTokens: EmailReceiptTokenRecord[];
}) {
  const emailEvents = input.emailEvents.map(emailEventInsert);
  const emailReceiptTokens = input.emailReceiptTokens.map(emailReceiptTokenInsert);
  const db = {
    select: () => ({
      from: (table: unknown) => {
        const tableName =
          table === schema.emailEvents
            ? "email_events"
            : table === schema.emailReceiptTokens
              ? "email_receipt_tokens"
              : undefined;
        const rows = tableName === "email_events" ? emailEvents : emailReceiptTokens;
        return {
          where: (condition: unknown) => ({
            orderBy: async () =>
              tableName
                ? sortDrizzleEmailChildRows(
                    filterDrizzleEmailChildRows(rows, tableName, condition),
                    tableName,
                  )
                : [],
          }),
        };
      },
    }),
  } as unknown as DrizzleDb;
  return new DrizzleOpenPracticeRepository(db);
}

function emailEventRecord(overrides: Partial<EmailEventRecord> = {}): EmailEventRecord {
  return {
    id: "email-event-bulk-default",
    firmId: "firm-west-legal",
    emailId: "email-bulk-a",
    eventType: "queued",
    occurredAt: now,
    source: "api",
    metadata: {},
    ...overrides,
  };
}

async function queueBulkReadEmail(
  repository: InMemoryOpenPracticeRepository,
  input: {
    id: string;
    firmId?: string;
    matterId?: string;
    queuedAt: string;
  },
) {
  const firmId = input.firmId ?? "firm-west-legal";
  const matterId = input.matterId ?? "matter-001";
  await repository.createQueuedEmailOutbox({
    email: calendarReminderEmail({
      id: input.id,
      firmId,
      matterId,
      queuedAt: input.queuedAt,
      metadata: { matterId, source: "email.bulk-read.test" },
    }),
    event: emailEventRecord({
      id: `email-event-${input.id}-queued`,
      firmId,
      emailId: input.id,
      occurredAt: input.queuedAt,
    }),
    job: calendarReminderJob({
      id: `job-${input.id}`,
      firmId,
      targetResourceId: input.id,
      queuedAt: input.queuedAt,
      metadata: { emailId: input.id, matterId, source: "email.bulk-read.test" },
    }),
  });
}

function receiptTokenRecord(
  overrides: Partial<EmailReceiptTokenRecord> = {},
): EmailReceiptTokenRecord {
  return {
    id: "receipt-token-bulk-default",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    emailId: "email-bulk-a",
    tokenHash: "hashed-receipt-token-bulk-default",
    purpose: "delivery_receipt",
    expiresAt: "2026-05-25T12:00:00.000Z",
    createdAt: now,
    metadata: {},
    ...overrides,
  };
}

async function seedEmailChildBulkReadRows(repository: InMemoryOpenPracticeRepository) {
  await queueBulkReadEmail(repository, {
    id: "email-bulk-a",
    queuedAt: "2026-04-25T12:00:00.000Z",
  });
  await queueBulkReadEmail(repository, {
    id: "email-bulk-east",
    firmId: "firm-east-legal",
    queuedAt: "2026-04-25T12:00:30.000Z",
  });
  await queueBulkReadEmail(repository, {
    id: "email-bulk-b",
    queuedAt: "2026-04-25T12:01:00.000Z",
  });
  await queueBulkReadEmail(repository, {
    id: "email-bulk-c",
    matterId: "matter-002",
    queuedAt: "2026-04-25T12:04:00.000Z",
  });
  await repository.recordEmailDeliveryResult({
    firmId: "firm-west-legal",
    emailId: "email-bulk-b",
    status: "sent",
    occurredAt: "2026-04-25T12:02:00.000Z",
    attemptNumber: 1,
    jobId: "job-email-bulk-b",
    source: "worker",
  });
  await repository.recordEmailDeliveryResult({
    firmId: "firm-west-legal",
    emailId: "email-bulk-a",
    status: "failed",
    occurredAt: "2026-04-25T12:03:00.000Z",
    attemptNumber: 1,
    jobId: "job-email-bulk-a",
    source: "worker",
    terminal: true,
    errorMessage: "Synthetic SMTP failure",
  });
  await repository.createEmailReceiptToken(
    receiptTokenRecord({
      id: "receipt-token-bulk-a",
      emailId: "email-bulk-a",
      tokenHash: "hashed-receipt-token-bulk-a",
      createdAt: "2026-04-25T12:02:00.000Z",
    }),
  );
  await repository.createEmailReceiptToken(
    receiptTokenRecord({
      id: "receipt-token-bulk-c",
      matterId: "matter-002",
      emailId: "email-bulk-c",
      tokenHash: "hashed-receipt-token-bulk-c",
      createdAt: "2026-04-25T12:03:00.000Z",
    }),
  );
  await repository.createEmailReceiptToken(
    receiptTokenRecord({
      id: "receipt-token-bulk-b",
      emailId: "email-bulk-b",
      tokenHash: "hashed-receipt-token-bulk-b",
      createdAt: "2026-04-25T12:04:00.000Z",
    }),
  );
  await repository.createEmailReceiptToken(
    receiptTokenRecord({
      id: "receipt-token-bulk-east",
      firmId: "firm-east-legal",
      emailId: "email-bulk-east",
      tokenHash: "hashed-receipt-token-bulk-east",
      createdAt: "2026-04-25T12:01:00.000Z",
    }),
  );
}

describe("repository providers, jobs, and email delivery", () => {
  it("upserts firm-scoped provider settings", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const createdAt = now;

    await expect(
      repository.upsertProviderSetting({
        id: "provider-smtp-default",
        firmId: "firm-west-legal",
        kind: "smtp",
        key: "default",
        enabled: false,
        encryptedConfig: "sealed:placeholder",
        createdAt,
        updatedAt: createdAt,
      }),
    ).resolves.toMatchObject({ kind: "smtp", enabled: false });

    await repository.upsertProviderSetting({
      id: "provider-smtp-default-updated",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "default",
      enabled: true,
      encryptedConfig: "sealed:updated",
      createdAt,
      updatedAt: "2026-04-25T13:00:00.000Z",
    });

    await expect(
      repository.listProviderSettings("firm-west-legal", { kind: "smtp" }),
    ).resolves.toMatchObject([{ enabled: true, encryptedConfig: "sealed:updated" }]);
  });

  it("stores encrypted provider settings while returning plaintext through the repository", async () => {
    const repository = new InMemoryOpenPracticeRepository({
      providerConfigCipher: createProviderConfigCipherFromKey(providerConfigKey),
    });
    const plaintextConfig = JSON.stringify({
      senderAddress: "consultations@example.test",
      privateValue: "synthetic-provider-secret",
    });

    await expect(
      repository.upsertProviderSetting({
        id: "provider-public-intake-firm-west-legal",
        firmId: "firm-west-legal",
        kind: "public_intake",
        key: "consultation",
        enabled: true,
        encryptedConfig: plaintextConfig,
        createdAt: now,
        updatedAt: now,
      }),
    ).resolves.toMatchObject({ encryptedConfig: plaintextConfig });

    const [provider] = await repository.listProviderSettings("firm-west-legal", {
      kind: "public_intake",
    });
    expect(provider?.encryptedConfig).toBe(plaintextConfig);

    const rawSettings = (repository as unknown as { providerSettings: ProviderSettingRecord[] })
      .providerSettings;
    expect(rawSettings[0]?.encryptedConfig).toMatch(
      new RegExp(`^${providerConfigEnvelopePrefix()}`),
    );
    expect(rawSettings[0]?.encryptedConfig).not.toContain("synthetic-provider-secret");
  });

  it("stores encrypted provider settings in Drizzle rows while returning plaintext", async () => {
    const { db, rows } = drizzleProviderSettingsRepositoryWithRows();
    const configuredRepository = new DrizzleOpenPracticeRepository(db, {
      providerConfigCipher: createProviderConfigCipherFromKey(providerConfigKey),
    });
    const plaintextConfig = JSON.stringify({
      senderAddress: "consultations@example.test",
      privateValue: "synthetic-drizzle-provider-secret",
    });

    await expect(
      configuredRepository.upsertProviderSetting({
        id: "provider-public-intake-firm-west-legal",
        firmId: "firm-west-legal",
        kind: "public_intake",
        key: "consultation",
        enabled: true,
        encryptedConfig: plaintextConfig,
        createdAt: now,
        updatedAt: now,
      }),
    ).resolves.toMatchObject({ encryptedConfig: plaintextConfig });

    const [provider] = await configuredRepository.listProviderSettings("firm-west-legal", {
      kind: "public_intake",
    });
    expect(provider?.encryptedConfig).toBe(plaintextConfig);
    expect(rows[0]?.encryptedConfig).toMatch(new RegExp(`^${providerConfigEnvelopePrefix()}`));
    expect(rows[0]?.encryptedConfig).not.toContain("synthetic-drizzle-provider-secret");
  });

  it("records job lifecycle state transitions", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await repository.createJobLifecycleRecord({
      id: "job-email-1",
      firmId: "firm-west-legal",
      queueName: "email",
      jobName: "send",
      status: "queued",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: now,
      metadata: { templateKey: "password_reset" },
    });

    await expect(
      repository.updateJobLifecycleRecord("firm-west-legal", "job-email-1", {
        status: "failed",
        attemptsMade: 1,
        failedAt: "2026-04-25T12:01:00.000Z",
        errorMessage: "SMTP unavailable",
      }),
    ).resolves.toMatchObject({ status: "failed", attemptsMade: 1 });
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { status: "failed" }),
    ).resolves.toMatchObject([{ id: "job-email-1", errorMessage: "SMTP unavailable" }]);

    await repository.createJobLifecycleRecord({
      id: "job-ocr-1",
      firmId: "firm-west-legal",
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "queued",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: now,
      metadata: { documentId: "doc-001" },
    });
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { queueName: "ocr" }),
    ).resolves.toMatchObject([{ id: "job-ocr-1", queueName: "ocr" }]);
  });

  it("returns existing job and email records for matching idempotency keys", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await repository.createJobLifecycleRecord({
      id: "job-idempotent-1",
      firmId: "firm-west-legal",
      queueName: "ocr",
      jobName: "extract_document_text",
      idempotencyKey: "job:doc-001:ocr",
      status: "queued",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: now,
      metadata: { idempotencyFingerprint: "same", documentId: "doc-001" },
    });
    await expect(
      repository.createJobLifecycleRecord({
        id: "job-idempotent-2",
        firmId: "firm-west-legal",
        queueName: "ocr",
        jobName: "extract_document_text",
        idempotencyKey: "job:doc-001:ocr",
        status: "queued",
        targetResourceType: "document",
        targetResourceId: "doc-001",
        attemptsMade: 0,
        maxAttempts: 3,
        queuedAt: now,
        metadata: { idempotencyFingerprint: "same", documentId: "doc-001" },
      }),
    ).resolves.toMatchObject({ id: "job-idempotent-1" });
    await expect(
      repository.createJobLifecycleRecord({
        id: "job-idempotent-conflict",
        firmId: "firm-west-legal",
        queueName: "ocr",
        jobName: "extract_document_text",
        idempotencyKey: "job:doc-001:ocr",
        status: "queued",
        targetResourceType: "document",
        targetResourceId: "doc-001",
        attemptsMade: 0,
        maxAttempts: 3,
        queuedAt: now,
        metadata: { idempotencyFingerprint: "changed", documentId: "doc-001" },
      }),
    ).rejects.toThrow("Idempotency key was reused with a different payload");

    const queued = await repository.createQueuedEmailOutbox({
      email: {
        id: "email-idempotent-1",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        idempotencyKey: "email:matter-001:sig",
        templateKey: "signature.requested",
        status: "queued",
        to: ["client@example.test"],
        cc: [],
        bcc: [],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Synthetic signature request",
        htmlBody: "",
        textBody: "Synthetic body",
        queuedAt: now,
        attemptCount: 0,
        metadata: { idempotencyFingerprint: "email-same", matterId: "matter-001" },
      },
      event: {
        id: "email-event-idempotent-queued",
        firmId: "firm-west-legal",
        emailId: "email-idempotent-1",
        eventType: "queued",
        occurredAt: now,
        jobId: "job-email-idempotent-1",
        source: "api",
        metadata: { provider: "mailpit" },
      },
      job: {
        id: "job-email-idempotent-1",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        idempotencyKey: "email:matter-001:sig",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-idempotent-1",
        attemptsMade: 0,
        maxAttempts: 5,
        queuedAt: now,
        metadata: { idempotencyFingerprint: "email-same", emailId: "email-idempotent-1" },
      },
    });
    expect(queued.email.id).toBe("email-idempotent-1");
    await expect(
      repository.createQueuedEmailOutbox({
        email: { ...queued.email, id: "email-idempotent-2" },
        event: { ...queued.event, id: "email-event-idempotent-2", emailId: "email-idempotent-2" },
        job: {
          ...queued.job,
          id: "job-email-idempotent-2",
          targetResourceId: "email-idempotent-2",
        },
      }),
    ).resolves.toMatchObject({
      email: { id: "email-idempotent-1" },
      job: { id: "job-email-idempotent-1" },
    });
  });

  it("reconciles only queued calendar reminder delivery records", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createQueuedEmailOutbox({
      email: calendarReminderEmail(),
      event: {
        id: "email-event-calendar-reminder-queued",
        firmId: "firm-west-legal",
        emailId: "email-calendar-reminder-001",
        eventType: "queued",
        occurredAt: now,
        jobId: "job-calendar-reminder-001",
        source: "api",
        metadata: { source: "calendar.reminder" },
      },
      job: calendarReminderJob(),
    });
    await repository.createQueuedEmailOutbox({
      email: calendarReminderEmail({
        id: "email-calendar-reminder-other",
        metadata: {
          matterId: "matter-001",
          source: "calendar.reminder",
          eventId: "calendar-event-001",
          reminderId: "calendar-reminder-other",
        },
      }),
      event: {
        id: "email-event-calendar-reminder-other",
        firmId: "firm-west-legal",
        emailId: "email-calendar-reminder-other",
        eventType: "queued",
        occurredAt: now,
        jobId: "job-calendar-reminder-other",
        source: "api",
        metadata: { source: "calendar.reminder" },
      },
      job: calendarReminderJob({
        id: "job-calendar-reminder-other",
        targetResourceId: "email-calendar-reminder-other",
      }),
    });
    await repository.createQueuedEmailOutbox({
      email: calendarReminderEmail({
        id: "email-calendar-reminder-sent",
        status: "sent",
        sentAt: "2026-04-25T12:10:00.000Z",
      }),
      event: {
        id: "email-event-calendar-reminder-sent",
        firmId: "firm-west-legal",
        emailId: "email-calendar-reminder-sent",
        eventType: "sent",
        occurredAt: "2026-04-25T12:10:00.000Z",
        jobId: "job-calendar-reminder-sent",
        source: "worker",
        metadata: { source: "calendar.reminder" },
      },
      job: calendarReminderJob({
        id: "job-calendar-reminder-sent",
        targetResourceId: "email-calendar-reminder-sent",
        status: "completed",
        finishedAt: "2026-04-25T12:10:00.000Z",
      }),
    });

    const reconciled = await repository.reconcileCalendarReminderDelivery({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      eventId: "calendar-event-001",
      reminderId: "calendar-reminder-001",
      occurredAt: "2026-04-25T12:15:00.000Z",
      requestedByUserId: "user-licensee",
      reason: "rescheduled",
    });

    expect(reconciled.cancelledEmails).toMatchObject([
      {
        id: "email-calendar-reminder-001",
        status: "cancelled",
        metadata: {
          deliveryState: {
            reconciledBy: "calendar.reminder",
            reconciliationReason: "rescheduled",
          },
        },
      },
    ]);
    expect(reconciled.skippedJobs).toMatchObject([
      {
        id: "job-calendar-reminder-001",
        status: "skipped",
        finishedAt: "2026-04-25T12:15:00.000Z",
      },
    ]);
    await expect(
      repository.getEmailOutbox("firm-west-legal", "email-calendar-reminder-other"),
    ).resolves.toMatchObject({ status: "queued" });
    await expect(
      repository.getEmailOutbox("firm-west-legal", "email-calendar-reminder-sent"),
    ).resolves.toMatchObject({ status: "sent" });
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { queueName: "email" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "job-calendar-reminder-other", status: "queued" }),
        expect.objectContaining({ id: "job-calendar-reminder-sent", status: "completed" }),
      ]),
    );
    await expect(
      repository.listEmailEvents("firm-west-legal", { emailId: "email-calendar-reminder-001" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "cancelled",
          metadata: expect.objectContaining({
            eventId: "calendar-event-001",
            reminderId: "calendar-reminder-001",
            reconciliationReason: "rescheduled",
          }),
        }),
      ]),
    );
  });

  it("records matter-scoped email delivery history in memory", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createQueuedEmailOutbox({
      email: {
        id: "email-history-001",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        templateKey: "signature.requested",
        status: "queued",
        to: ["client@example.test"],
        cc: ["staff@example.test"],
        bcc: [],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Synthetic signature request",
        htmlBody: "",
        textBody: "Synthetic body",
        relatedResourceType: "signature_request",
        relatedResourceId: "sig-001",
        queuedAt: now,
        attemptCount: 0,
        metadata: { matterId: "matter-001", provider: "mailpit" },
      },
      event: {
        id: "email-event-history-queued",
        firmId: "firm-west-legal",
        emailId: "email-history-001",
        eventType: "queued",
        occurredAt: now,
        jobId: "job-email-history-001",
        source: "api",
        metadata: { provider: "mailpit" },
      },
      job: {
        id: "job-email-history-001",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-history-001",
        attemptsMade: 0,
        maxAttempts: 5,
        queuedAt: now,
        metadata: { emailId: "email-history-001", matterId: "matter-001" },
      },
    });
    await repository.createQueuedEmailOutbox({
      email: {
        id: "email-history-other-matter",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        templateKey: "intake.generated",
        status: "queued",
        to: ["staff@example.test"],
        cc: [],
        bcc: [],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Synthetic intake notice",
        htmlBody: "",
        textBody: "Synthetic body",
        queuedAt: "2026-04-25T13:00:00.000Z",
        attemptCount: 0,
        metadata: { matterId: "matter-002", provider: "mailpit" },
      },
      event: {
        id: "email-event-history-other",
        firmId: "firm-west-legal",
        emailId: "email-history-other-matter",
        eventType: "queued",
        occurredAt: "2026-04-25T13:00:00.000Z",
        source: "api",
        metadata: { provider: "mailpit" },
      },
      job: {
        id: "job-email-history-other",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-history-other-matter",
        attemptsMade: 0,
        maxAttempts: 5,
        queuedAt: "2026-04-25T13:00:00.000Z",
        metadata: { emailId: "email-history-other-matter", matterId: "matter-002" },
      },
    });

    await repository.recordEmailDeliveryResult({
      firmId: "firm-west-legal",
      emailId: "email-history-001",
      status: "sending",
      occurredAt: "2026-04-25T12:01:00.000Z",
      attemptNumber: 1,
      jobId: "job-email-history-001",
      source: "worker",
      metadata: { provider: "mailpit" },
    });
    await repository.recordEmailDeliveryResult({
      firmId: "firm-west-legal",
      emailId: "email-history-001",
      status: "failed",
      occurredAt: "2026-04-25T12:02:00.000Z",
      attemptNumber: 1,
      jobId: "job-email-history-001",
      source: "worker",
      terminal: true,
      errorMessage: " SMTP refused synthetic message ".repeat(20),
      metadata: {
        provider: "mailpit",
        terminal: true,
        rawBody: "private-client@example.test body",
        storageKey: "matters/matter-001/private.eml",
      },
    });

    const outbox = await repository.listEmailOutbox("firm-west-legal", { matterId: "matter-001" });
    expect(outbox).toMatchObject([
      {
        id: "email-history-001",
        matterId: "matter-001",
        status: "failed",
        attemptCount: 1,
        lastAttemptAt: "2026-04-25T12:02:00.000Z",
        terminalFailureAt: "2026-04-25T12:02:00.000Z",
        terminalFailureReason: expect.stringContaining("SMTP refused synthetic message"),
      },
    ]);
    expect(outbox[0]?.metadata.deliveryState).toMatchObject({
      provider: "mailpit",
      terminal: true,
      rawBody: "[redacted]",
      storageKey: "[redacted]",
    });
    await expect(
      repository.listEmailOutbox("other-firm", { matterId: "matter-001" }),
    ).resolves.toEqual([]);
    const events = await repository.listEmailEvents("firm-west-legal", {
      emailId: "email-history-001",
    });
    expect(events.map((event) => event.eventType)).toEqual(["queued", "sending", "failed"]);
    expect(events.at(-1)).toMatchObject({
      attemptNumber: 1,
      jobId: "job-email-history-001",
      source: "worker",
      errorMessage: expect.stringContaining("SMTP refused synthetic message"),
    });
    expect(events.at(-1)?.metadata).toMatchObject({
      provider: "mailpit",
      terminal: true,
      rawBody: "[redacted]",
      storageKey: "[redacted]",
    });
    expect(events.at(-1)?.errorMessage?.length).toBeLessThanOrEqual(240);
  });

  it("lists email events and receipt tokens for multiple child email ids across providers", async () => {
    const memoryRepository = new InMemoryOpenPracticeRepository();
    await seedEmailChildBulkReadRows(memoryRepository);
    const allEvents = [
      ...(await memoryRepository.listEmailEvents("firm-west-legal")),
      ...(await memoryRepository.listEmailEvents("firm-east-legal")),
    ];
    const allTokens = [
      ...(await memoryRepository.listEmailReceiptTokens("firm-west-legal")),
      ...(await memoryRepository.listEmailReceiptTokens("firm-east-legal")),
    ];
    const drizzleRepository = drizzleEmailJobsRepositoryWithRows({
      emailEvents: allEvents,
      emailReceiptTokens: allTokens,
    });

    const omittedEvents = await memoryRepository.listEmailEvents("firm-west-legal");
    expect(await drizzleRepository.listEmailEvents("firm-west-legal")).toEqual(omittedEvents);
    expect(omittedEvents.map((event) => `${event.emailId}:${event.eventType}`)).toEqual([
      "email-bulk-a:queued",
      "email-bulk-b:queued",
      "email-bulk-b:sent",
      "email-bulk-a:failed",
      "email-bulk-c:queued",
    ]);

    const bulkEventOptions = {
      emailIds: ["email-bulk-b", "email-bulk-a", "email-bulk-east"],
    };
    const memoryBulkEvents = await memoryRepository.listEmailEvents(
      "firm-west-legal",
      bulkEventOptions,
    );
    expect(await drizzleRepository.listEmailEvents("firm-west-legal", bulkEventOptions)).toEqual(
      memoryBulkEvents,
    );
    expect(
      memoryBulkEvents.map((event) => `${event.firmId}:${event.emailId}:${event.eventType}`),
    ).toEqual([
      "firm-west-legal:email-bulk-a:queued",
      "firm-west-legal:email-bulk-b:queued",
      "firm-west-legal:email-bulk-b:sent",
      "firm-west-legal:email-bulk-a:failed",
    ]);

    const singularEventOptions = { emailId: "email-bulk-b" };
    expect(
      await drizzleRepository.listEmailEvents("firm-west-legal", singularEventOptions),
    ).toEqual(await memoryRepository.listEmailEvents("firm-west-legal", singularEventOptions));
    await expect(
      memoryRepository.listEmailEvents("firm-west-legal", { emailIds: [] }),
    ).resolves.toEqual([]);
    await expect(
      drizzleRepository.listEmailEvents("firm-west-legal", { emailIds: [] }),
    ).resolves.toEqual([]);

    const omittedTokens = await memoryRepository.listEmailReceiptTokens("firm-west-legal");
    expect(await drizzleRepository.listEmailReceiptTokens("firm-west-legal")).toEqual(
      omittedTokens,
    );
    expect(omittedTokens.map((token) => token.id)).toEqual([
      "receipt-token-bulk-a",
      "receipt-token-bulk-c",
      "receipt-token-bulk-b",
    ]);

    const bulkTokenOptions = {
      emailIds: ["email-bulk-b", "email-bulk-a", "email-bulk-east"],
    };
    const memoryBulkTokens = await memoryRepository.listEmailReceiptTokens(
      "firm-west-legal",
      bulkTokenOptions,
    );
    expect(
      await drizzleRepository.listEmailReceiptTokens("firm-west-legal", bulkTokenOptions),
    ).toEqual(memoryBulkTokens);
    expect(memoryBulkTokens.map((token) => `${token.firmId}:${token.id}`)).toEqual([
      "firm-west-legal:receipt-token-bulk-a",
      "firm-west-legal:receipt-token-bulk-b",
    ]);

    const matterFilteredTokenOptions = {
      emailIds: ["email-bulk-a", "email-bulk-c"],
      matterId: "matter-002",
    };
    expect(
      await drizzleRepository.listEmailReceiptTokens("firm-west-legal", matterFilteredTokenOptions),
    ).toEqual(
      await memoryRepository.listEmailReceiptTokens("firm-west-legal", matterFilteredTokenOptions),
    );
    expect(
      (
        await memoryRepository.listEmailReceiptTokens("firm-west-legal", matterFilteredTokenOptions)
      ).map((token) => token.id),
    ).toEqual(["receipt-token-bulk-c"]);
    await expect(
      memoryRepository.listEmailReceiptTokens("firm-west-legal", {
        emailIds: [],
        matterId: "matter-001",
      }),
    ).resolves.toEqual([]);
    await expect(
      drizzleRepository.listEmailReceiptTokens("firm-west-legal", {
        emailIds: [],
        matterId: "matter-001",
      }),
    ).resolves.toEqual([]);
  });

  it("looks up and records delivery receipts idempotently by hashed token", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createQueuedEmailOutbox({
      email: {
        id: "email-receipt-001",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        templateKey: "client.update",
        status: "queued",
        to: ["client@example.test"],
        cc: [],
        bcc: [],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Synthetic update",
        htmlBody: "",
        textBody: "Synthetic body with a receipt endpoint.",
        queuedAt: now,
        attemptCount: 0,
        metadata: {
          matterId: "matter-001",
          deliveryReceipt: {
            requested: true,
            status: "pending",
            requestedAt: now,
          },
        },
      },
      event: {
        id: "email-event-receipt-queued",
        firmId: "firm-west-legal",
        emailId: "email-receipt-001",
        eventType: "queued",
        occurredAt: now,
        source: "api",
        metadata: {},
      },
      job: {
        id: "job-email-receipt-001",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-receipt-001",
        attemptsMade: 0,
        maxAttempts: 5,
        queuedAt: now,
        metadata: { emailId: "email-receipt-001", matterId: "matter-001" },
      },
    });
    await repository.createEmailReceiptToken({
      id: "receipt-token-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      emailId: "email-receipt-001",
      tokenHash: "hashed-receipt-token",
      purpose: "delivery_receipt",
      expiresAt: "2026-05-25T12:00:00.000Z",
      createdAt: now,
      metadata: { includeInBody: true },
    });

    await expect(
      repository.getEmailReceiptTokenByHash("hashed-receipt-token"),
    ).resolves.toMatchObject({ id: "receipt-token-001", emailId: "email-receipt-001" });

    const recorded = await repository.recordEmailReceiptToken({
      tokenHash: "hashed-receipt-token",
      recordedAt: "2026-04-25T12:30:00.000Z",
    });
    expect(recorded).toMatchObject({
      recordedNow: true,
      token: {
        id: "receipt-token-001",
        recordedAt: "2026-04-25T12:30:00.000Z",
      },
    });
    await expect(
      repository.getEmailOutboxByReceiptTokenHash("hashed-receipt-token"),
    ).resolves.toMatchObject({
      id: "email-receipt-001",
      metadata: {
        deliveryReceipt: expect.not.objectContaining({
          tokenHash: expect.any(String),
          expiresAt: expect.any(String),
          recordedAt: expect.any(String),
          status: expect.any(String),
        }),
      },
    });
    await expect(
      repository.listEmailReceiptTokens("firm-west-legal", { emailId: "email-receipt-001" }),
    ).resolves.toMatchObject([{ id: "receipt-token-001", recordedAt: "2026-04-25T12:30:00.000Z" }]);

    const replay = await repository.recordEmailReceiptToken({
      tokenHash: "hashed-receipt-token",
      recordedAt: "2026-04-25T12:45:00.000Z",
    });
    expect(replay).toMatchObject({
      recordedNow: false,
      token: {
        recordedAt: "2026-04-25T12:30:00.000Z",
      },
    });
    const receiptEvents = (
      await repository.listEmailEvents("firm-west-legal", { emailId: "email-receipt-001" })
    ).filter((event) => event.eventType === "receipt_recorded");
    expect(receiptEvents).toHaveLength(1);
    await expect(repository.getEmailReceiptTokenByHash("raw-receipt-token")).resolves.toBe(
      undefined,
    );
  });
});
