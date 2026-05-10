import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now } from "./repository.fixtures.js";

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
      metadata: { provider: "mailpit", terminal: true },
    });

    await expect(
      repository.listEmailOutbox("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toMatchObject([
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
    expect(events.at(-1)?.errorMessage?.length).toBeLessThanOrEqual(240);
  });
});
