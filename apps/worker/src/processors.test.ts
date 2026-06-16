import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { S3Client } from "@aws-sdk/client-s3";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { MailSender, OcrProvider } from "@open-practice/domain";
import { EmbeddedAutomationProvider, FakeDraftAssistProvider } from "@open-practice/providers";
import { processOpenPracticeJob, type ConnectorDeliveryRequest } from "./processors.js";

describe("worker processors", () => {
  async function createConnectorOutboxFixture(
    repository: InMemoryOpenPracticeRepository,
    overrides: {
      connectorId?: string;
      connectorStatus?: "disabled" | "enabled" | "paused" | "error";
      eventType?: string;
      deliveryUrl?: string;
      secretReferenceId?: string;
      maxAttempts?: number;
      attemptCount?: number;
      outboxId?: string;
    } = {},
  ) {
    const createdAt = "2026-05-12T12:00:00.000Z";
    const connectorId = overrides.connectorId ?? "connector-worker-test";
    await repository.createConnector({
      id: connectorId,
      firmId: "firm-west-legal",
      type: "generic",
      key: connectorId,
      displayName: "Synthetic Connector",
      status: overrides.connectorStatus ?? "enabled",
      secretReference: overrides.secretReferenceId
        ? { id: overrides.secretReferenceId, label: "Synthetic secret" }
        : { id: "secret-ref/connector-worker", label: "Synthetic secret" },
      configSummary: {
        deliveryUrl: overrides.deliveryUrl ?? "https://webhooks.example.test/open-practice",
      },
      createdAt,
      updatedAt: createdAt,
    });
    await repository.createConnectorOutbox({
      id: overrides.outboxId ?? "connector-outbox-worker-test",
      firmId: "firm-west-legal",
      connectorId,
      eventType: overrides.eventType ?? "document.verified",
      resourceType: "document",
      resourceId: "doc-001",
      idempotencyKey: `${connectorId}:doc-001:verified:v1`,
      status: "pending",
      payloadSummary: {
        documentId: "doc-001",
        fieldCount: 3,
      },
      attemptCount: overrides.attemptCount ?? 0,
      maxAttempts: overrides.maxAttempts ?? 3,
      nextAttemptAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });
  }

  function connectorJobDefaults(repository: InMemoryOpenPracticeRepository) {
    return {
      queueName: "connectors" as const,
      jobName: "deliver_connectors",
      data: {
        firmId: "firm-west-legal",
        metadata: { batchSize: 5, leaseMs: 60_000 },
      },
      repository,
      s3: {} as never,
      ocrProvider: {} as never,
      mailSender: {} as never,
      inboundEmailParser: {} as never,
      connectorDnsResolver: async () => ["203.0.113.10"],
    };
  }

  async function enableAi(repository: InMemoryOpenPracticeRepository): Promise<void> {
    await repository.upsertProviderSetting({
      id: "provider-ai-worker-fake",
      firmId: "firm-west-legal",
      kind: "ai",
      key: "fake-local-ai",
      enabled: true,
      encryptedConfig: "synthetic",
      createdAt: "2026-05-18T10:00:00.000Z",
      updatedAt: "2026-05-18T10:00:00.000Z",
    });
  }

  it("loads outbound email content from the outbox record instead of job metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const sentMessages: unknown[] = [];
    const mailSender: MailSender = {
      async send(message) {
        sentMessages.push(message);
        return { providerMessageId: "mailpit-message-001" };
      },
    };
    await repository.createQueuedEmailOutbox({
      email: {
        id: "email-outbox-worker-test",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        templateKey: "signature.requested",
        status: "queued",
        to: ["client@example.test"],
        cc: ["copy@example.test"],
        bcc: ["blind-copy@example.test"],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Signature requested",
        htmlBody: "",
        textBody: "Please review the signature request.",
        relatedResourceType: "signature_request",
        relatedResourceId: "sig-001",
        queuedAt: "2026-05-01T00:00:00.000Z",
        attemptCount: 0,
        metadata: { providerMetadata: { provider: "mailpit" } },
      },
      event: {
        id: "email-event-worker-test",
        firmId: "firm-west-legal",
        emailId: "email-outbox-worker-test",
        eventType: "queued",
        occurredAt: "2026-05-01T00:00:00.000Z",
        jobId: "job-worker-test",
        source: "api",
        metadata: { provider: "mailpit" },
      },
      job: {
        id: "job-worker-test",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-outbox-worker-test",
        attemptsMade: 0,
        maxAttempts: 3,
        queuedAt: "2026-05-01T00:00:00.000Z",
        metadata: {
          emailId: "email-outbox-worker-test",
          matterId: "matter-001",
          templateKey: "signature.requested",
          recipientCount: 3,
        },
      },
    });

    const result = await processOpenPracticeJob({
      queueName: "email",
      jobName: "send_email",
      data: {
        firmId: "firm-west-legal",
        resourceType: "email_outbox",
        resourceId: "email-outbox-worker-test",
        metadata: { emailId: "email-outbox-worker-test" },
      },
      jobLifecycleId: "job-worker-test",
      attemptsMade: 0,
      maxAttempts: 3,
      repository,
      s3: {} as never,
      ocrProvider: {} as never,
      mailSender,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        emailId: "email-outbox-worker-test",
        providerMessageId: "mailpit-message-001",
      },
    });
    expect(sentMessages).toEqual([
      expect.objectContaining({
        to: ["client@example.test"],
        cc: ["copy@example.test"],
        bcc: ["blind-copy@example.test"],
        subject: "Signature requested",
        text: "Please review the signature request.",
      }),
    ]);
    await expect(
      repository.getEmailOutbox("firm-west-legal", "email-outbox-worker-test"),
    ).resolves.toMatchObject({
      status: "sent",
      attemptCount: 1,
      lastAttemptAt: expect.any(String),
      sentAt: expect.any(String),
      errorMessage: undefined,
    });
    const events = await repository.listEmailEvents("firm-west-legal", {
      emailId: "email-outbox-worker-test",
    });
    expect(events.map((event) => event.eventType)).toEqual(["queued", "sending", "sent"]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "sending",
          emailId: "email-outbox-worker-test",
          attemptNumber: 1,
          jobId: "job-worker-test",
          source: "worker",
        }),
        expect.objectContaining({
          eventType: "sent",
          emailId: "email-outbox-worker-test",
          providerMessageId: "mailpit-message-001",
          attemptNumber: 1,
          jobId: "job-worker-test",
        }),
      ]),
    );
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job-worker-test",
          status: "completed",
          targetResourceId: "email-outbox-worker-test",
          finishedAt: expect.any(String),
        }),
      ]),
    );
  });

  it("marks outbound email and job lifecycle failed when delivery throws", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const mailSender: MailSender = {
      async send() {
        throw new Error("SMTP refused message");
      },
    };
    await repository.createQueuedEmailOutbox({
      email: {
        id: "email-outbox-failed-worker-test",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        templateKey: "intake.generated",
        status: "queued",
        to: ["staff@example.test"],
        cc: [],
        bcc: [],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Generated intake document",
        htmlBody: "<p>Document generated.</p>",
        textBody: "Document generated.",
        relatedResourceType: "intake_session",
        relatedResourceId: "intake-001",
        queuedAt: "2026-05-01T00:00:00.000Z",
        attemptCount: 0,
        metadata: { provider: "mailpit", providerMetadata: { provider: "mailpit" } },
      },
      event: {
        id: "email-event-failed-worker-test",
        firmId: "firm-west-legal",
        emailId: "email-outbox-failed-worker-test",
        eventType: "queued",
        occurredAt: "2026-05-01T00:00:00.000Z",
        jobId: "job-worker-failed-test",
        source: "api",
        metadata: { provider: "mailpit" },
      },
      job: {
        id: "job-worker-failed-test",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-outbox-failed-worker-test",
        attemptsMade: 0,
        maxAttempts: 1,
        queuedAt: "2026-05-01T00:00:00.000Z",
        metadata: {
          emailId: "email-outbox-failed-worker-test",
          templateKey: "intake.generated",
          recipientCount: 1,
        },
      },
    });

    await expect(
      processOpenPracticeJob({
        queueName: "email",
        jobName: "send_email",
        data: {
          firmId: "firm-west-legal",
          resourceType: "email_outbox",
          resourceId: "email-outbox-failed-worker-test",
          metadata: { emailId: "email-outbox-failed-worker-test" },
        },
        jobLifecycleId: "job-worker-failed-test",
        attemptsMade: 0,
        maxAttempts: 1,
        repository,
        s3: {} as never,
        ocrProvider: {} as never,
        mailSender,
        inboundEmailParser: {} as never,
      }),
    ).rejects.toThrow("SMTP refused message");

    await expect(
      repository.getEmailOutbox("firm-west-legal", "email-outbox-failed-worker-test"),
    ).resolves.toMatchObject({
      status: "failed",
      attemptCount: 1,
      failedAt: expect.any(String),
      terminalFailureAt: expect.any(String),
      terminalFailureReason: "SMTP refused message",
      errorMessage: "SMTP refused message",
    });
    const events = await repository.listEmailEvents("firm-west-legal", {
      emailId: "email-outbox-failed-worker-test",
    });
    expect(events.map((event) => event.eventType)).toEqual(["queued", "sending", "failed"]);
    expect(events.at(-1)).toMatchObject({
      eventType: "failed",
      emailId: "email-outbox-failed-worker-test",
      attemptNumber: 1,
      jobId: "job-worker-failed-test",
      source: "worker",
      errorMessage: "SMTP refused message",
      metadata: expect.objectContaining({ provider: "mailpit", terminal: true }),
    });
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job-worker-failed-test",
          status: "dead_letter",
          attemptsMade: 1,
          errorMessage: "SMTP refused message",
          failedAt: expect.any(String),
        }),
      ]),
    );
  });

  it("keeps retryable outbound email failures queued with attempt provenance", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const mailSender: MailSender = {
      async send() {
        throw new Error("Temporary SMTP outage");
      },
    };
    await repository.createQueuedEmailOutbox({
      email: {
        id: "email-outbox-retryable-worker-test",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        templateKey: "calendar.invitation",
        status: "queued",
        to: ["attendee@example.test"],
        cc: [],
        bcc: [],
        from: "Open Practice <no-reply@open-practice.local>",
        subject: "Calendar invitation",
        htmlBody: "",
        textBody: "Synthetic invitation.",
        relatedResourceType: "calendar_event",
        relatedResourceId: "calendar-event-001",
        queuedAt: "2026-05-01T00:00:00.000Z",
        attemptCount: 1,
        metadata: { provider: "mailpit", providerMetadata: { provider: "mailpit" } },
      },
      event: {
        id: "email-event-retryable-worker-test",
        firmId: "firm-west-legal",
        emailId: "email-outbox-retryable-worker-test",
        eventType: "queued",
        occurredAt: "2026-05-01T00:00:00.000Z",
        jobId: "job-worker-retryable-test",
        source: "api",
        metadata: { provider: "mailpit" },
      },
      job: {
        id: "job-worker-retryable-test",
        firmId: "firm-west-legal",
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: "email-outbox-retryable-worker-test",
        attemptsMade: 1,
        maxAttempts: 3,
        queuedAt: "2026-05-01T00:00:00.000Z",
        metadata: {
          emailId: "email-outbox-retryable-worker-test",
          matterId: "matter-001",
          templateKey: "calendar.invitation",
          recipientCount: 1,
        },
      },
    });

    await expect(
      processOpenPracticeJob({
        queueName: "email",
        jobName: "send_email",
        data: {
          firmId: "firm-west-legal",
          resourceType: "email_outbox",
          resourceId: "email-outbox-retryable-worker-test",
          metadata: { emailId: "email-outbox-retryable-worker-test" },
        },
        jobLifecycleId: "job-worker-retryable-test",
        attemptsMade: 1,
        maxAttempts: 3,
        repository,
        s3: {} as never,
        ocrProvider: {} as never,
        mailSender,
        inboundEmailParser: {} as never,
      }),
    ).rejects.toThrow("Temporary SMTP outage");

    await expect(
      repository.getEmailOutbox("firm-west-legal", "email-outbox-retryable-worker-test"),
    ).resolves.toMatchObject({
      status: "queued",
      attemptCount: 2,
      failedAt: undefined,
      terminalFailureAt: undefined,
      terminalFailureReason: undefined,
      errorMessage: undefined,
    });
    await expect(
      repository.listEmailEvents("firm-west-legal", {
        emailId: "email-outbox-retryable-worker-test",
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "failed",
          attemptNumber: 2,
          source: "worker",
          errorMessage: "Temporary SMTP outage",
          metadata: expect.objectContaining({ terminal: false }),
        }),
      ]),
    );
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job-worker-retryable-test",
          status: "failed",
          attemptsMade: 2,
          errorMessage: "Temporary SMTP outage",
        }),
      ]),
    );
  });

  it("skips email jobs when the outbox record is missing", async () => {
    const result = await processOpenPracticeJob({
      queueName: "email",
      jobName: "send_email",
      data: {
        firmId: "firm-west-legal",
        resourceType: "email_outbox",
        resourceId: "missing-email",
      },
      repository: new InMemoryOpenPracticeRepository(),
      s3: {} as never,
      ocrProvider: {} as never,
      mailSender: {
        async send() {
          throw new Error("Should not send");
        },
      },
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "skipped",
      reason: "Email outbox record not found",
      metadata: { emailId: "missing-email" },
    });
  });

  it("leases connector outbox rows and signs safe summary payloads", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createConnectorOutboxFixture(repository);
    const deliveries: ConnectorDeliveryRequest[] = [];

    const result = await processOpenPracticeJob({
      ...connectorJobDefaults(repository),
      connectorSecretResolver: (referenceId) =>
        referenceId === "secret-ref/connector-worker" ? "synthetic-signing-secret" : undefined,
      async connectorHttpDeliverer(request) {
        deliveries.push(request);
        return { status: 202 };
      },
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        leasedCount: 1,
        deliveredCount: 1,
        failedCount: 0,
        deadLetterCount: 0,
      },
    });
    expect(deliveries).toHaveLength(1);
    const [delivery] = deliveries;
    expect(delivery.url).toBe("https://webhooks.example.test/open-practice");
    expect(delivery.headers).toMatchObject({
      "content-type": "application/json",
      "x-open-practice-delivery-id": "connector-outbox-worker-test",
      "x-open-practice-event": "document.verified",
      "x-open-practice-signature": expect.any(String),
      "x-open-practice-timestamp": expect.any(String),
    });
    expect(JSON.parse(delivery.body)).toMatchObject({
      deliveryId: "connector-outbox-worker-test",
      event: "document.verified",
      data: {
        resourceType: "document",
        resourceId: "doc-001",
        payloadSummary: { documentId: "doc-001", fieldCount: 3 },
      },
    });
    expect(delivery.body).not.toContain("synthetic-signing-secret");
    const expectedSignature = createHmac("sha256", "synthetic-signing-secret")
      .update(`${delivery.headers["x-open-practice-timestamp"]}.${delivery.body}`)
      .digest("hex");
    expect(delivery.headers["x-open-practice-signature"]).toBe(expectedSignature);
    await expect(
      repository.listConnectorOutbox("firm-west-legal", { connectorId: "connector-worker-test" }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "connector-outbox-worker-test",
        status: "delivered",
        attemptCount: 1,
        deliveredAt: expect.any(String),
        leaseId: undefined,
      }),
    ]);
    const attempts = await repository.listConnectorDeliveryAttempts("firm-west-legal", {
      outboxId: "connector-outbox-worker-test",
    });
    expect(attempts).toEqual([
      expect.objectContaining({
        status: "delivered",
        errorSummary: undefined,
        metadata: expect.objectContaining({
          destinationHost: "webhooks.example.test",
          httpStatus: 202,
          signingAlgorithm: "hmac-sha256",
        }),
      }),
    ]);
    expect(JSON.stringify(attempts)).not.toContain("synthetic-signing-secret");
    expect(JSON.stringify(attempts)).not.toContain("x-open-practice-signature");
  });

  it("dead-letters non-allowlisted connector events without delivery", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createConnectorOutboxFixture(repository, {
      eventType: "matter.summary.ready",
      outboxId: "connector-outbox-not-allowlisted",
    });

    const result = await processOpenPracticeJob({
      ...connectorJobDefaults(repository),
      connectorSecretResolver: () => "synthetic-signing-secret",
      async connectorHttpDeliverer() {
        throw new Error("Should not deliver");
      },
    });

    expect(result.metadata).toMatchObject({ deadLetterCount: 1, deliveredCount: 0 });
    await expect(
      repository.listConnectorOutbox("firm-west-legal", { status: "dead_letter" }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "connector-outbox-not-allowlisted",
        lastErrorSummary: "Connector event type is not allowlisted",
      }),
    ]);
  });

  it("dead-letters invalid destinations and missing connector secrets without raw leakage", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createConnectorOutboxFixture(repository, {
      connectorId: "connector-localhost",
      deliveryUrl: "https://localhost/hooks",
      outboxId: "connector-outbox-localhost",
    });
    await createConnectorOutboxFixture(repository, {
      connectorId: "connector-missing-secret",
      secretReferenceId: "secret-ref/missing",
      outboxId: "connector-outbox-missing-secret",
    });

    const result = await processOpenPracticeJob({
      ...connectorJobDefaults(repository),
      connectorSecretResolver: (referenceId) =>
        referenceId === "secret-ref/connector-worker" ? "synthetic-signing-secret" : undefined,
      async connectorHttpDeliverer() {
        throw new Error("Should not deliver");
      },
    });

    expect(result.metadata).toMatchObject({ deadLetterCount: 2, deliveredCount: 0 });
    const outbox = await repository.listConnectorOutbox("firm-west-legal", {
      status: "dead_letter",
    });
    expect(outbox).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "connector-outbox-localhost",
          lastErrorSummary: "Connector destination failed HTTPS guardrail validation",
        }),
        expect.objectContaining({
          id: "connector-outbox-missing-secret",
          lastErrorSummary: "Connector signing secret is not configured",
        }),
      ]),
    );
    const attempts = await repository.listConnectorDeliveryAttempts("firm-west-legal");
    expect(JSON.stringify(attempts)).not.toContain("synthetic-signing-secret");
  });

  it("dead-letters connector destinations that resolve to private addresses", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createConnectorOutboxFixture(repository, {
      connectorId: "connector-private-dns",
      deliveryUrl: "https://webhooks.example.test/open-practice",
      outboxId: "connector-outbox-private-dns",
    });

    const result = await processOpenPracticeJob({
      ...connectorJobDefaults(repository),
      connectorSecretResolver: () => "synthetic-signing-secret",
      connectorDnsResolver: async () => ["10.0.0.12"],
      async connectorHttpDeliverer() {
        throw new Error("Should not deliver");
      },
    });

    expect(result.metadata).toMatchObject({ deadLetterCount: 1, deliveredCount: 0 });
    const attempts = await repository.listConnectorDeliveryAttempts("firm-west-legal", {
      outboxId: "connector-outbox-private-dns",
    });
    expect(attempts).toEqual([
      expect.objectContaining({
        status: "failed",
        errorSummary: "Connector destination failed DNS guardrail validation",
        metadata: expect.objectContaining({ reason: "private_network_denied" }),
      }),
    ]);
  });

  it("records retryable and terminal connector HTTP failures", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createConnectorOutboxFixture(repository, {
      connectorId: "connector-retryable",
      outboxId: "connector-outbox-retryable",
      maxAttempts: 3,
    });
    await createConnectorOutboxFixture(repository, {
      connectorId: "connector-terminal",
      outboxId: "connector-outbox-terminal",
      maxAttempts: 1,
    });

    const result = await processOpenPracticeJob({
      ...connectorJobDefaults(repository),
      connectorSecretResolver: () => "synthetic-signing-secret",
      async connectorHttpDeliverer() {
        return { status: 503 };
      },
    });

    expect(result.metadata).toMatchObject({
      failedCount: 1,
      deadLetterCount: 1,
      deliveredCount: 0,
    });
    await expect(
      repository.listConnectorOutbox("firm-west-legal", { connectorId: "connector-retryable" }),
    ).resolves.toEqual([
      expect.objectContaining({
        status: "failed",
        nextAttemptAt: expect.any(String),
        lastErrorSummary: "Connector delivery failed with HTTP 503",
      }),
    ]);
    await expect(
      repository.listConnectorOutbox("firm-west-legal", { connectorId: "connector-terminal" }),
    ).resolves.toEqual([
      expect.objectContaining({
        status: "dead_letter",
        nextAttemptAt: undefined,
        lastErrorSummary: "Connector delivery failed with HTTP 503",
      }),
    ]);
  });

  it("redacts connector retry error details before storing repository attempts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createConnectorOutboxFixture(repository, {
      connectorId: "connector-retry-secret",
      outboxId: "connector-outbox-retry-secret",
      maxAttempts: 3,
    });

    const result = await processOpenPracticeJob({
      ...connectorJobDefaults(repository),
      connectorSecretResolver: () => "synthetic-signing-secret",
      async connectorHttpDeliverer() {
        throw new Error(
          "Retry failed for token=private-token client@example.test secret://connector/hidden",
        );
      },
    });

    expect(result.metadata).toMatchObject({ failedCount: 1, deadLetterCount: 0 });
    const [outbox] = await repository.listConnectorOutbox("firm-west-legal", {
      connectorId: "connector-retry-secret",
    });
    expect(outbox).toMatchObject({
      status: "failed",
      lastErrorSummary: "Retry failed for [redacted] [redacted-email] [redacted]",
      nextAttemptAt: expect.any(String),
    });
    const attempts = await repository.listConnectorDeliveryAttempts("firm-west-legal", {
      outboxId: "connector-outbox-retry-secret",
    });
    const serialized = JSON.stringify(attempts);
    expect(serialized).not.toContain("private-token");
    expect(serialized).not.toContain("client@example.test");
    expect(serialized).not.toContain("secret://connector/hidden");
    expect(serialized).not.toContain("synthetic-signing-secret");
  });

  it("skips reserved document-processing queues with redacted deferred metadata", async () => {
    for (const queueName of ["ai_triage", "transcription", "media"] as const) {
      const result = await processOpenPracticeJob({
        queueName,
        jobName: "reserved_worker_task",
        data: {
          firmId: "firm-west-legal",
          resourceType: "document",
          resourceId: "doc-001",
          metadata: { rawText: "Synthetic text should not survive skip metadata" },
        },
        repository: new InMemoryOpenPracticeRepository(),
        s3: {} as never,
        ocrProvider: {} as never,
        mailSender: {} as never,
        inboundEmailParser: {} as never,
      });

      expect(result).toMatchObject({
        status: "skipped",
        reason: expect.stringContaining("reserved/deferred"),
        metadata: {
          firmId: "firm-west-legal",
          resourceType: "document",
          resourceId: "doc-001",
          queueStatus: "reserved",
          reason: "deferred_worker",
          providerConfigured: false,
        },
      });
      expect(result.metadata).not.toHaveProperty("rawText");
    }
  });

  it("skips legal research provider review jobs with citation-review-only metadata", async () => {
    const result = await processOpenPracticeJob({
      queueName: "ai_triage",
      jobName: "legal_research_provider_review",
      data: {
        firmId: "firm-west-legal",
        resourceType: "legal_research",
        resourceId: "matter-001",
        metadata: {
          matterId: "matter-001",
          requestType: "citation_review",
          sourceTypes: "case_law,statute",
          citationReferenceCount: 2,
          contextLinkCount: 1,
          prompt: "Synthetic legal research prompt must not survive",
          sourceText: "Synthetic legal research source text must not survive",
          providerEvidence: { private: "Synthetic provider evidence" },
        },
      },
      repository: new InMemoryOpenPracticeRepository(),
      s3: {} as never,
      ocrProvider: {} as never,
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "skipped",
      reason: expect.stringContaining("reserved"),
      metadata: {
        matterId: "matter-001",
        requestType: "citation_review",
        sourceTypes: "case_law,statute",
        citationReferenceCount: 2,
        contextLinkCount: 1,
        provider: "reserved_legal_research_provider",
        providerStatus: "reserved",
        providerConfigured: false,
        citationReviewRequired: true,
        sourceTextIncluded: false,
        promptIncluded: false,
        providerEvidenceStored: false,
        citationVerificationClaims: false,
        downstreamMutation: false,
        reviewOnly: true,
      },
    });
    expect(JSON.stringify(result.metadata)).not.toContain("Synthetic legal research prompt");
    expect(JSON.stringify(result.metadata)).not.toContain("Synthetic legal research source text");
    expect(JSON.stringify(result.metadata)).not.toContain("Synthetic provider evidence");
  });

  it("creates non-authoritative draft assist records from async ai_triage jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableAi(repository);
    await repository.createDraft({
      id: "draft-worker-async-assist",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      title: "Synthetic async draft",
      editorJson: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Synthetic privileged draft text" }],
          },
        ],
      },
      version: 1,
      createdByUserId: "user-admin",
      updatedByUserId: "user-admin",
      createdAt: "2026-05-18T10:00:00.000Z",
      updatedAt: "2026-05-18T10:00:00.000Z",
      metadata: {},
    });
    await repository.createJobLifecycleRecord({
      id: "job-async-draft-assist-worker-test",
      firmId: "firm-west-legal",
      queueName: "ai_triage",
      jobName: "draft_assist_suggestion",
      status: "queued",
      targetResourceType: "draft",
      targetResourceId: "draft-worker-async-assist",
      attemptsMade: 0,
      maxAttempts: 2,
      queuedAt: "2026-05-18T10:00:00.000Z",
      metadata: {
        matterId: "matter-001",
        sourceType: "draft",
        draftId: "draft-worker-async-assist",
        task: "continue_draft",
        provider: "fake-local-ai",
        requestedByUserId: "user-admin",
        sourceTextLength: "Synthetic privileged draft text".length,
        instructionLength: 44,
        evidenceKeyCount: 2,
        rawPromptContext: "Do not persist worker prompt context",
      },
    });

    const result = await processOpenPracticeJob({
      queueName: "ai_triage",
      jobName: "draft_assist_suggestion",
      data: {
        firmId: "firm-west-legal",
        resourceType: "draft",
        resourceId: "draft-worker-async-assist",
        metadata: {
          matterId: "matter-001",
          sourceType: "draft",
          draftId: "draft-worker-async-assist",
          task: "continue_draft",
          provider: "fake-local-ai",
          requestedByUserId: "user-admin",
          sourceTextLength: "Synthetic privileged draft text".length,
          instructionLength: 44,
          evidenceKeyCount: 2,
          rawPromptContext: "Do not persist worker prompt context",
        },
      },
      jobLifecycleId: "job-async-draft-assist-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      repository,
      s3: {} as never,
      ocrProvider: {} as never,
      draftAssistProvider: new FakeDraftAssistProvider({ model: "fake-model" }),
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        matterId: "matter-001",
        sourceType: "draft",
        draftId: "draft-worker-async-assist",
        task: "continue_draft",
        provider: "fake-local-ai",
        providerModel: "fake-model",
        sourceTextLength: "Synthetic privileged draft text".length,
        requestedByUserId: "user-admin",
      },
    });
    const records = await repository.listDraftAssistRecords("firm-west-legal", {
      draftId: "draft-worker-async-assist",
    });
    expect(records).toEqual([
      expect.objectContaining({
        sourceType: "draft",
        draftId: "draft-worker-async-assist",
        task: "continue_draft",
        status: "suggested",
        providerKey: "fake-local-ai",
        providerModel: "fake-model",
        createdByUserId: "user-admin",
      }),
    ]);
    expect(records[0]?.suggestedText).toContain("[continue draft]");
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { queueName: "ai_triage" }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "job-async-draft-assist-worker-test",
        status: "completed",
        metadata: expect.objectContaining({
          draftAssistRecordId: records[0]?.id,
          suggestedTextLength: records[0]?.suggestedText.length,
          summaryLength: records[0]?.summary?.length,
        }),
      }),
    ]);
    const audit = await repository.listAuditEvents("firm-west-legal");
    const created = audit.events.find((event) => event.action === "draft_assist.created");
    expect(created?.metadata).toMatchObject({
      draftAssistRecordId: records[0]?.id,
      draftId: "draft-worker-async-assist",
      task: "continue_draft",
      suggestedTextLength: records[0]?.suggestedText.length,
    });
    const serialized = JSON.stringify({
      result,
      jobs: await repository.listJobLifecycleRecords("firm-west-legal"),
      audit,
    });
    expect(serialized).not.toContain("Synthetic privileged draft text");
    expect(serialized).not.toContain("Do not persist worker prompt context");
  });

  it("creates status-only AI operational proposals from async ai_triage jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableAi(repository);
    await repository.createDraft({
      id: "draft-worker-ai-proposals",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      title: "Synthetic proposal draft",
      editorJson: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Synthetic privileged proposal source text" }],
          },
        ],
      },
      version: 1,
      createdByUserId: "user-admin",
      updatedByUserId: "user-admin",
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z",
      metadata: {},
    });
    await repository.createJobLifecycleRecord({
      id: "job-operational-proposals-worker-test",
      firmId: "firm-west-legal",
      queueName: "ai_triage",
      jobName: "operational_action_proposals",
      status: "queued",
      targetResourceType: "draft",
      targetResourceId: "draft-worker-ai-proposals",
      attemptsMade: 0,
      maxAttempts: 2,
      queuedAt: "2026-06-01T10:00:00.000Z",
      metadata: {
        matterId: "matter-001",
        sourceType: "draft",
        draftId: "draft-worker-ai-proposals",
        proposalKinds: "deadline_extraction,client_update_draft",
        proposalKindCount: 2,
        provider: "fake-local-ai",
        requestedByUserId: "user-admin",
        sourceTextLength: "Synthetic privileged proposal source text".length,
        rawPromptContext: "Do not persist operational prompt context",
      },
    });

    const result = await processOpenPracticeJob({
      queueName: "ai_triage",
      jobName: "operational_action_proposals",
      data: {
        firmId: "firm-west-legal",
        resourceType: "draft",
        resourceId: "draft-worker-ai-proposals",
        metadata: {
          matterId: "matter-001",
          sourceType: "draft",
          draftId: "draft-worker-ai-proposals",
          proposalKinds: "deadline_extraction,client_update_draft",
          proposalKindCount: 2,
          provider: "fake-local-ai",
          requestedByUserId: "user-admin",
          sourceTextLength: "Synthetic privileged proposal source text".length,
          rawPromptContext: "Do not persist operational prompt context",
        },
      },
      jobLifecycleId: "job-operational-proposals-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      repository,
      s3: {} as never,
      ocrProvider: {} as never,
      aiOperationalProposalProvider: new FakeDraftAssistProvider({ model: "fake-model" }),
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        matterId: "matter-001",
        sourceType: "draft",
        draftId: "draft-worker-ai-proposals",
        proposalKinds: "deadline_extraction,client_update_draft",
        proposalKindCount: 2,
        proposalCount: 2,
        provider: "fake-local-ai",
        providerModel: "fake-model",
        sourceTextLength: "Synthetic privileged proposal source text".length,
        requestedByUserId: "user-admin",
      },
    });
    const proposals = await repository.listAiOperationalProposals("firm-west-legal", {
      matterId: "matter-001",
    });
    expect(proposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ draftId: "draft-worker-ai-proposals" }),
          kind: "deadline_extraction",
          status: "proposed",
          providerModel: "fake-model",
          createdByUserId: "user-admin",
        }),
        expect.objectContaining({
          source: expect.objectContaining({ draftId: "draft-worker-ai-proposals" }),
          kind: "client_update_draft",
          status: "proposed",
        }),
      ]),
    );
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { queueName: "ai_triage" }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "job-operational-proposals-worker-test",
        status: "completed",
        metadata: expect.objectContaining({
          proposalCount: 2,
          proposalKindCount: 2,
          proposalKinds: "deadline_extraction,client_update_draft",
        }),
      }),
    ]);
    const audit = await repository.listAuditEvents("firm-west-legal");
    expect(
      audit.events.filter((event) => event.action === "ai_operational_proposal.created"),
    ).toHaveLength(2);
    const serialized = JSON.stringify({
      result,
      jobs: await repository.listJobLifecycleRecords("firm-west-legal"),
      audit,
    });
    expect(serialized).not.toContain("Synthetic privileged proposal source text");
    expect(serialized).not.toContain("Do not persist operational prompt context");
  });

  it("skips operational proposal jobs safely when the provider is unavailable", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-operational-proposals-disabled-test",
      firmId: "firm-west-legal",
      queueName: "ai_triage",
      jobName: "operational_action_proposals",
      status: "queued",
      targetResourceType: "draft",
      targetResourceId: "draft-missing-provider",
      attemptsMade: 0,
      maxAttempts: 2,
      queuedAt: "2026-06-01T10:00:00.000Z",
      metadata: {
        matterId: "matter-001",
        proposalKinds: "task_creation",
        requestedByUserId: "user-admin",
      },
    });

    const result = await processOpenPracticeJob({
      queueName: "ai_triage",
      jobName: "operational_action_proposals",
      data: {
        firmId: "firm-west-legal",
        resourceType: "draft",
        resourceId: "draft-missing-provider",
        metadata: {
          matterId: "matter-001",
          proposalKinds: "task_creation",
          requestedByUserId: "user-admin",
        },
      },
      jobLifecycleId: "job-operational-proposals-disabled-test",
      attemptsMade: 0,
      maxAttempts: 2,
      repository,
      s3: {} as never,
      ocrProvider: {} as never,
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "skipped",
      reason: "AI operational proposal provider is not configured",
      metadata: {
        queueStatus: "configured",
        reason: "not_configured",
        providerConfigured: false,
      },
    });
  });

  it("completes audit report export jobs with bounded metadata only", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-audit-export-worker-test",
      firmId: "firm-west-legal",
      queueName: "reports",
      jobName: "audit_export",
      status: "queued",
      targetResourceType: "audit_export",
      targetResourceId: "audit-export-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      queuedAt: "2026-05-15T12:00:00.000Z",
      metadata: {
        reportType: "audit_log",
        reportScope: "firm",
        requestedByUserId: "user-admin",
        rawBody: "Synthetic audit body must not survive job metadata",
      },
    });

    const result = await processOpenPracticeJob({
      queueName: "reports",
      jobName: "audit_export",
      data: {
        firmId: "firm-west-legal",
        resourceType: "audit_export",
        resourceId: "audit-export-worker-test",
        metadata: {
          reportType: "audit_log",
          reportScope: "firm",
          requestedByUserId: "user-admin",
          rawBody: "Synthetic audit body must not survive job metadata",
        },
      },
      jobLifecycleId: "job-audit-export-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      repository,
      s3: {} as never,
      ocrProvider: {} as never,
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        firmId: "firm-west-legal",
        resourceType: "audit_export",
        resourceId: "audit-export-worker-test",
        reportType: "audit_log",
        reportScope: "firm",
        eventCount: expect.any(Number),
      },
    });
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { queueName: "reports" }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "job-audit-export-worker-test",
        status: "completed",
        finishedAt: expect.any(String),
        metadata: expect.objectContaining({
          reportType: "audit_log",
          reportScope: "firm",
          eventCount: expect.any(Number),
        }),
      }),
    ]);
    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "reports",
    });
    expect(JSON.stringify(job.metadata)).not.toContain("Synthetic audit body");
    expect(job.metadata).not.toHaveProperty("rawBody");
  });

  it("assembles generated intake packages from snapshot IDs without raw job metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createAnswerSnapshot({
      id: "answer-snapshot-worker-package",
      firmId: "firm-west-legal",
      intakeSessionId: "intake-session-001",
      capturedAt: "2026-04-25T12:10:00.000Z",
      answers: { issue_type: "repair", repair_details: "Synthetic raw client answer" },
      resolution: {
        templateId: "intake-template-001",
        templateVersion: 2,
        visibleQuestionIds: ["issue_type", "repair_details"],
        visibleFormItemIds: ["issue-type-item", "repair-details-item"],
        requiredIncompleteItemIds: [],
        matchedBranchRuleIds: ["repair-package"],
        eligiblePackageIds: ["repair_notice_package"],
        selectedPackageIds: ["repair_notice_package"],
        packageSummaries: [
          {
            packageId: "repair_notice_package",
            title: "Repair notice package",
            documentCount: 2,
            documentIds: ["repair_notice_letter", "client_instruction_summary"],
          },
        ],
        packageDocuments: [
          {
            packageId: "repair_notice_package",
            packageDocumentId: "repair_notice_letter",
            title: "Repair notice letter",
          },
          {
            packageId: "repair_notice_package",
            packageDocumentId: "client_instruction_summary",
            title: "Client instruction summary",
          },
        ],
      },
    });
    await repository.createJobLifecycleRecord({
      id: "job-document-assembly-worker-test",
      firmId: "firm-west-legal",
      queueName: "document_assembly",
      jobName: "assemble_intake_generated_package",
      status: "queued",
      targetResourceType: "intake_generated_package",
      targetResourceId: "job-document-assembly-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      queuedAt: "2026-05-29T12:00:00.000Z",
      metadata: {
        matterId: "matter-001",
        intakeSessionId: "intake-session-001",
        answerSnapshotId: "answer-snapshot-worker-package",
        templateId: "intake-template-001",
        templateVersion: 2,
        packageId: "repair_notice_package",
        packageDocumentCount: 2,
        requestedByUserId: "user-admin",
        answers: { raw: "Synthetic raw client answer" },
      },
    });

    const result = await processOpenPracticeJob({
      queueName: "document_assembly",
      jobName: "assemble_intake_generated_package",
      data: {
        firmId: "firm-west-legal",
        resourceType: "intake_generated_package",
        resourceId: "job-document-assembly-worker-test",
        metadata: {
          matterId: "matter-001",
          intakeSessionId: "intake-session-001",
          answerSnapshotId: "answer-snapshot-worker-package",
          templateId: "intake-template-001",
          templateVersion: 2,
          packageId: "repair_notice_package",
          packageDocumentCount: 2,
          requestedByUserId: "user-admin",
          answers: { raw: "Synthetic raw client answer" },
          storageKey: "matters/matter-001/private.pdf",
        },
      },
      jobLifecycleId: "job-document-assembly-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      repository,
      s3: {} as never,
      ocrProvider: {} as never,
      automationProvider: new EmbeddedAutomationProvider(),
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        resourceType: "intake_generated_package",
        matterId: "matter-001",
        intakeSessionId: "intake-session-001",
        answerSnapshotId: "answer-snapshot-worker-package",
        packageId: "repair_notice_package",
        documentCount: 2,
        generatedDocumentCount: 2,
        providerConfigured: true,
        providerStatus: "completed",
      },
    });
    const generatedDocuments = (
      await repository.listGeneratedDocuments("firm-west-legal", {
        matterId: "matter-001",
      })
    ).filter(
      (document) =>
        document.intakeSessionId === "intake-session-001" &&
        document.packageId === "repair_notice_package",
    );
    expect(generatedDocuments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          intakeSessionId: "intake-session-001",
          provider: "embedded",
          packageId: "repair_notice_package",
          packageDocumentId: "repair_notice_letter",
          title: "Repair notice letter",
        }),
        expect.objectContaining({
          packageDocumentId: "client_instruction_summary",
          title: "Client instruction summary",
        }),
      ]),
    );
    const generatedDocumentIds = generatedDocuments.map((document) => document.id);
    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "document_assembly",
    });
    expect(job).toMatchObject({
      status: "completed",
      metadata: expect.objectContaining({
        packageId: "repair_notice_package",
        documentCount: 2,
        generatedDocumentIds,
        providerStatus: "completed",
      }),
    });
    expect(JSON.stringify(job.metadata)).not.toContain("Synthetic raw client answer");
    expect(JSON.stringify(job.metadata)).not.toContain("storageKey");
    const audit = await repository.listAuditEvents("firm-west-legal");
    const packageAudit = audit.events.find((event) => event.action === "intake.package.generated");
    expect(packageAudit?.metadata).toMatchObject({
      intakeSessionId: "intake-session-001",
      answerSnapshotId: "answer-snapshot-worker-package",
      packageId: "repair_notice_package",
      documentCount: 2,
      generatedDocumentIds,
      providerCount: 1,
    });
    expect(JSON.stringify(packageAudit?.metadata)).not.toContain("Synthetic raw client answer");
  });

  it("completes billing and jurisdictional trust report jobs with bounded metadata only", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-billing-export-worker-test",
      firmId: "firm-west-legal",
      queueName: "reports",
      jobName: "billing_export",
      status: "queued",
      targetResourceType: "billing_export",
      targetResourceId: "billing-export-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      queuedAt: "2026-05-19T12:00:00.000Z",
      metadata: {
        reportType: "billing",
        reportScope: "matter",
        matterId: "matter-001",
        requestedByUserId: "user-admin",
        rawBody: "Synthetic billing export body must not survive job metadata",
      },
    });
    await repository.createJobLifecycleRecord({
      id: "job-jurisdictional-trust-export-worker-test",
      firmId: "firm-west-legal",
      queueName: "reports",
      jobName: "jurisdictional_trust_export",
      status: "queued",
      targetResourceType: "jurisdictional_trust_export",
      targetResourceId: "jurisdictional-trust-export-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      queuedAt: "2026-05-19T12:01:00.000Z",
      metadata: {
        reportType: "jurisdictional_trust",
        reportScope: "firm",
        jurisdiction: "BC",
        requestedByUserId: "user-admin",
        statementEvidence: "synthetic-april-trust.pdf",
      },
    });

    const billingResult = await processOpenPracticeJob({
      queueName: "reports",
      jobName: "billing_export",
      data: {
        firmId: "firm-west-legal",
        resourceType: "billing_export",
        resourceId: "billing-export-worker-test",
        metadata: {
          reportType: "billing",
          reportScope: "matter",
          matterId: "matter-001",
          requestedByUserId: "user-admin",
          rawBody: "Synthetic billing export body must not survive job metadata",
        },
      },
      jobLifecycleId: "job-billing-export-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      repository,
      s3: {} as never,
      ocrProvider: {} as never,
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });
    const trustResult = await processOpenPracticeJob({
      queueName: "reports",
      jobName: "jurisdictional_trust_export",
      data: {
        firmId: "firm-west-legal",
        resourceType: "jurisdictional_trust_export",
        resourceId: "jurisdictional-trust-export-worker-test",
        metadata: {
          reportType: "jurisdictional_trust",
          reportScope: "firm",
          jurisdiction: "BC",
          requestedByUserId: "user-admin",
          statementEvidence: "synthetic-april-trust.pdf",
        },
      },
      jobLifecycleId: "job-jurisdictional-trust-export-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      repository,
      s3: {} as never,
      ocrProvider: {} as never,
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });

    expect(billingResult).toMatchObject({
      status: "completed",
      metadata: {
        firmId: "firm-west-legal",
        resourceType: "billing_export",
        resourceId: "billing-export-worker-test",
        reportType: "billing",
        reportScope: "matter",
        matterId: "matter-001",
        recordCount: expect.any(Number),
        timeEntryCount: expect.any(Number),
        invoiceCount: expect.any(Number),
      },
    });
    expect(trustResult).toMatchObject({
      status: "completed",
      metadata: {
        firmId: "firm-west-legal",
        resourceType: "jurisdictional_trust_export",
        resourceId: "jurisdictional-trust-export-worker-test",
        reportType: "jurisdictional_trust",
        reportScope: "firm",
        jurisdiction: "BC",
      },
    });

    const jobs = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "reports",
    });
    expect(jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job-billing-export-worker-test",
          status: "completed",
          metadata: expect.objectContaining({
            reportType: "billing",
            matterId: "matter-001",
            recordCount: expect.any(Number),
            timeEntryCount: expect.any(Number),
          }),
        }),
        expect.objectContaining({
          id: "job-jurisdictional-trust-export-worker-test",
          status: "completed",
          metadata: expect.objectContaining({
            reportType: "jurisdictional_trust",
            jurisdiction: "BC",
          }),
        }),
      ]),
    );
    const serializedJobs = JSON.stringify(jobs);
    expect(serializedJobs).not.toContain("Synthetic billing export body");
    expect(serializedJobs).not.toContain("synthetic-april-trust.pdf");
    expect(
      jobs.find((job) => job.id === "job-billing-export-worker-test")?.metadata,
    ).not.toHaveProperty("rawBody");
    expect(
      jobs.find((job) => job.id === "job-jurisdictional-trust-export-worker-test")?.metadata,
    ).not.toHaveProperty("statementEvidence");
  });

  it("completes staff report export jobs with bounded metadata only", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-staff-report-export-worker-test",
      firmId: "firm-west-legal",
      queueName: "reports",
      jobName: "staff_report_export",
      status: "queued",
      targetResourceType: "staff_report_export",
      targetResourceId: "staff-report-export-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      queuedAt: "2026-05-28T12:01:00.000Z",
      metadata: {
        reportType: "staff_reporting",
        reportDefinitionKey: "productivity",
        exportProfileId: "summary_json",
        groupingKey: "staff_member",
        requestedByUserId: "user-admin",
        rawBody: "Synthetic staff report body must not survive job metadata",
      },
    });

    const result = await processOpenPracticeJob({
      queueName: "reports",
      jobName: "staff_report_export",
      data: {
        firmId: "firm-west-legal",
        resourceType: "staff_report_export",
        resourceId: "staff-report-export-worker-test",
        metadata: {
          reportType: "staff_reporting",
          reportDefinitionKey: "productivity",
          exportProfileId: "summary_json",
          groupingKey: "staff_member",
          requestedByUserId: "user-admin",
          rawBody: "Synthetic staff report body must not survive job metadata",
        },
      },
      jobLifecycleId: "job-staff-report-export-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      repository,
      s3: {} as never,
      ocrProvider: {} as never,
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        firmId: "firm-west-legal",
        resourceType: "staff_report_export",
        resourceId: "staff-report-export-worker-test",
        reportType: "staff_reporting",
        reportDefinitionKey: "productivity",
        exportProfileId: "summary_json",
        groupingKey: "staff_member",
        rowCount: expect.any(Number),
      },
    });
    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "reports",
    });
    expect(job).toMatchObject({
      id: "job-staff-report-export-worker-test",
      status: "completed",
      metadata: expect.objectContaining({
        reportType: "staff_reporting",
        reportDefinitionKey: "productivity",
        exportProfileId: "summary_json",
        groupingKey: "staff_member",
        rowCount: expect.any(Number),
      }),
    });
    expect(JSON.stringify(job.metadata)).not.toContain("Synthetic staff report body");
    expect(job.metadata).not.toHaveProperty("rawBody");
  });

  it("completes conversation thread export report jobs with bounded metadata only", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createConversationThread({
      id: "conversation-thread-export-worker-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      topic: "Synthetic worker export",
      status: "open",
      retentionUntil: "2026-06-01T00:00:00.000Z",
      exportState: "requested",
      notificationBoundary: "internal_only",
      createdAt: "2026-05-26T10:00:00.000Z",
      updatedAt: "2026-05-26T10:00:00.000Z",
      createdByUserId: "user-admin",
      updatedByUserId: "user-admin",
      metadata: { privateSummary: "Synthetic thread metadata value" },
    });
    await repository.createConversationMessage({
      id: "conversation-message-export-worker-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      threadId: "conversation-thread-export-worker-test",
      kind: "client_message",
      bodyText: "Synthetic privileged conversation body must not survive job metadata",
      authoredAt: "2026-05-26T10:01:00.000Z",
      authoredByUserId: "user-licensee",
      createdAt: "2026-05-26T10:01:00.000Z",
      createdByUserId: "user-licensee",
      metadata: { privateNote: "Synthetic message metadata value" },
    });
    await repository.createJobLifecycleRecord({
      id: "job-conversation-export-worker-test",
      firmId: "firm-west-legal",
      queueName: "reports",
      jobName: "conversation_thread_export",
      status: "queued",
      targetResourceType: "conversation_thread_export",
      targetResourceId: "conversation-export-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      queuedAt: "2026-05-26T12:00:00.000Z",
      metadata: {
        reportType: "conversation_thread",
        reportScope: "matter",
        matterId: "matter-001",
        threadId: "conversation-thread-export-worker-test",
        requestedByUserId: "user-admin",
        rawBody: "Synthetic queued export body must not survive job metadata",
      },
    });

    const result = await processOpenPracticeJob({
      queueName: "reports",
      jobName: "conversation_thread_export",
      data: {
        firmId: "firm-west-legal",
        resourceType: "conversation_thread_export",
        resourceId: "conversation-export-worker-test",
        metadata: {
          reportType: "conversation_thread",
          reportScope: "matter",
          matterId: "matter-001",
          threadId: "conversation-thread-export-worker-test",
          requestedByUserId: "user-admin",
          rawBody: "Synthetic queued export body must not survive job metadata",
        },
      },
      jobLifecycleId: "job-conversation-export-worker-test",
      attemptsMade: 0,
      maxAttempts: 2,
      repository,
      s3: {} as never,
      ocrProvider: {} as never,
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        firmId: "firm-west-legal",
        resourceType: "conversation_thread_export",
        resourceId: "conversation-export-worker-test",
        reportType: "conversation_thread",
        reportScope: "matter",
        matterId: "matter-001",
        threadId: "conversation-thread-export-worker-test",
        messageCount: 1,
      },
    });
    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "reports",
    });
    expect(job).toMatchObject({
      id: "job-conversation-export-worker-test",
      status: "completed",
      metadata: expect.objectContaining({
        reportType: "conversation_thread",
        matterId: "matter-001",
        threadId: "conversation-thread-export-worker-test",
        messageCount: 1,
      }),
    });
    const serializedJob = JSON.stringify(job);
    expect(serializedJob).not.toContain("Synthetic privileged conversation body");
    expect(serializedJob).not.toContain("Synthetic queued export body");
    expect(serializedJob).not.toContain("Synthetic message metadata value");
    expect(serializedJob).not.toContain("Synthetic thread metadata value");
    expect(job?.metadata).not.toHaveProperty("rawBody");
  });

  it("runs OCR jobs from document storage and completes lifecycle records", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const requestedObjects: string[] = [];
    const s3 = {
      bucket: "open-practice-documents",
      client: {
        async send(command: unknown) {
          const input = (command as { input: { Key: string } }).input;
          requestedObjects.push(input.Key);
          return {
            Body: {
              async transformToByteArray() {
                return new TextEncoder().encode("Synthetic PDF bytes");
              },
            },
          };
        },
      } as unknown as S3Client,
    };
    const ocrProvider: OcrProvider = {
      async extractText(input) {
        expect(input).toMatchObject({
          firmId: "firm-west-legal",
          documentId: "doc-001",
          language: "eng",
        });
        expect(new TextDecoder().decode(input.content)).toBe("Synthetic PDF bytes");
        return {
          confidence: 94,
          extractedText: "Synthetic extracted retainer text.",
          metadata: { engineVersion: "test", rawText: "Synthetic provider text should stay out" },
        };
      },
    };
    await repository.createJobLifecycleRecord({
      id: "job-ocr-worker-test",
      firmId: "firm-west-legal",
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "queued",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: "2026-05-01T00:00:00.000Z",
      metadata: {
        documentId: "doc-001",
        language: "eng",
        title: "Retainer agreement.pdf",
        extractedText: "Do not persist queued text in job metadata",
      },
    });

    const result = await processOpenPracticeJob({
      queueName: "ocr",
      jobName: "extract_document_text",
      data: {
        firmId: "firm-west-legal",
        resourceType: "document",
        resourceId: "doc-001",
        metadata: {
          documentId: "doc-001",
          language: "eng",
          title: "Retainer agreement.pdf",
          extractedText: "Do not persist queued text in job metadata",
        },
      },
      jobLifecycleId: "job-ocr-worker-test",
      attemptsMade: 0,
      maxAttempts: 3,
      repository,
      s3,
      ocrProvider,
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "completed",
      metadata: {
        firmId: "firm-west-legal",
        documentId: "doc-001",
        confidence: 94,
        textLength: "Synthetic extracted retainer text.".length,
      },
    });
    expect(requestedObjects).toEqual(["matters/matter-001/retainer-v1.pdf"]);
    await expect(
      repository.getDocumentTextExtractions("firm-west-legal", "doc-001"),
    ).resolves.toEqual([
      expect.objectContaining({
        documentId: "doc-001",
        engine: "tesseract",
        status: "completed",
        language: "eng",
        confidence: 94,
        extractedText: "Synthetic extracted retainer text.",
        metadata: { engineVersion: "test", rawText: "Synthetic provider text should stay out" },
      }),
    ]);
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { queueName: "ocr" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job-ocr-worker-test",
          status: "completed",
          attemptsMade: 0,
          finishedAt: expect.any(String),
          metadata: expect.objectContaining({
            documentId: "doc-001",
            confidence: 94,
            textLength: "Synthetic extracted retainer text.".length,
          }),
        }),
      ]),
    );
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { queueName: "ocr" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job-ocr-worker-test",
          metadata: expect.not.objectContaining({
            extractedText: expect.any(String),
            rawText: expect.any(String),
            title: expect.any(String),
          }),
        }),
      ]),
    );
  });

  it("skips OCR jobs before reading storage when document scanning has not passed", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createDocumentUploadIntent({
      id: "doc-ocr-scan-gated",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      title: "Scan gated OCR.pdf",
      storageKey: "matters/matter-001/scan-gated-ocr.pdf",
      checksumSha256: "f".repeat(64),
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId: "firm-west-legal",
      documentId: "doc-ocr-scan-gated",
      checksumSha256: "f".repeat(64),
      scanStatus: "queued",
    });
    await repository.createJobLifecycleRecord({
      id: "job-ocr-scan-gated",
      firmId: "firm-west-legal",
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "queued",
      targetResourceType: "document",
      targetResourceId: "doc-ocr-scan-gated",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: "2026-05-01T00:00:00.000Z",
      metadata: { documentId: "doc-ocr-scan-gated", language: "eng" },
    });

    const result = await processOpenPracticeJob({
      queueName: "ocr",
      jobName: "extract_document_text",
      data: {
        firmId: "firm-west-legal",
        resourceType: "document",
        resourceId: "doc-ocr-scan-gated",
        metadata: { documentId: "doc-ocr-scan-gated", language: "eng" },
      },
      jobLifecycleId: "job-ocr-scan-gated",
      attemptsMade: 0,
      maxAttempts: 3,
      repository,
      s3: {
        bucket: "open-practice-documents",
        client: {
          async send() {
            throw new Error("storage should not be read before scan passes");
          },
        } as unknown as S3Client,
      },
      ocrProvider: {
        async extractText() {
          throw new Error("OCR should not run before scan passes");
        },
      },
      mailSender: {} as never,
      inboundEmailParser: {} as never,
    });

    expect(result).toMatchObject({
      status: "skipped",
      reason: "Document scan has not passed",
      metadata: {
        documentId: "doc-ocr-scan-gated",
        scanStatus: "queued",
      },
    });
    await expect(
      repository.getDocumentTextExtractions("firm-west-legal", "doc-ocr-scan-gated"),
    ).resolves.toEqual([]);
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { queueName: "ocr" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job-ocr-scan-gated",
          status: "skipped",
          metadata: expect.objectContaining({
            documentId: "doc-ocr-scan-gated",
            scanStatus: "queued",
          }),
        }),
      ]),
    );
  });
});
