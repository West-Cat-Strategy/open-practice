import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

describe("repository connectors", () => {
  it("stores connector registry rows and returns idempotent outbox records", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const createdAt = "2026-05-02T12:00:00.000Z";
    const connector = await repository.createConnector({
      id: "connector-synthetic",
      firmId: "firm-west-legal",
      type: "generic",
      key: "synthetic.registry",
      displayName: "Synthetic Registry",
      status: "enabled",
      secretReference: {
        id: "secret-ref/synthetic-registry",
        label: "Synthetic secret reference",
      },
      configSummary: { mode: "summary_only" },
      createdAt,
      updatedAt: createdAt,
    });

    await expect(repository.listConnectors("firm-west-legal")).resolves.toMatchObject([
      {
        id: connector.id,
        key: "synthetic.registry",
        secretReference: { id: "secret-ref/synthetic-registry" },
      },
    ]);

    await expect(
      repository.updateConnector("firm-west-legal", connector.id, {
        displayName: "Synthetic Registry Updated",
        status: "paused",
        updatedAt: "2026-05-02T12:05:00.000Z",
      }),
    ).resolves.toMatchObject({
      displayName: "Synthetic Registry Updated",
      status: "paused",
      secretReference: { id: "secret-ref/synthetic-registry" },
      updatedAt: "2026-05-02T12:05:00.000Z",
    });
    await repository.updateConnector("firm-west-legal", connector.id, {
      status: "enabled",
      updatedAt: "2026-05-02T12:06:00.000Z",
    });

    const outboxInput = {
      id: "connector-outbox-1",
      firmId: "firm-west-legal",
      connectorId: connector.id,
      eventType: "matter.summary.ready",
      resourceType: "matter",
      resourceId: "matter-001",
      idempotencyKey: "matter-001:summary-ready:v1",
      status: "pending" as const,
      payloadSummary: { matterId: "matter-001", fieldCount: 3 },
      attemptCount: 0,
      maxAttempts: 3,
      nextAttemptAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };
    await expect(repository.createConnectorOutbox(outboxInput)).resolves.toMatchObject({
      created: true,
      outbox: { id: "connector-outbox-1" },
    });
    await expect(
      repository.createConnectorOutbox({ ...outboxInput, id: "connector-outbox-duplicate" }),
    ).resolves.toMatchObject({
      created: false,
      outbox: { id: "connector-outbox-1" },
    });
    await expect(
      repository.createConnectorOutbox({
        ...outboxInput,
        id: "connector-outbox-conflict",
        payloadSummary: { matterId: "matter-001", fieldCount: 4 },
      }),
    ).rejects.toThrow("Idempotency key was reused with a different payload");
    await expect(
      repository.createConnectorOutbox({
        ...outboxInput,
        id: "connector-outbox-cross-firm",
        firmId: "firm-other",
        idempotencyKey: "matter-001:summary-ready:v2",
      }),
    ).rejects.toThrow("Connector connector-synthetic was not found");
    await expect(
      repository.createConnectorDeliveryAttempt({
        id: "connector-attempt-cross-firm",
        firmId: "firm-other",
        connectorId: connector.id,
        outboxId: "connector-outbox-1",
        attemptNumber: 1,
        status: "leased",
        idempotencyKey: "matter-001:summary-ready:v1",
        startedAt: createdAt,
        metadata: {},
      }),
    ).rejects.toThrow("Connector outbox connector-outbox-1 was not found");
  });

  it("leases due enabled connector outbox rows and records redacted delivery outcomes", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const createdAt = "2026-05-12T12:00:00.000Z";
    const now = "2026-05-12T12:05:00.000Z";
    const leasedUntil = "2026-05-12T12:10:00.000Z";
    const connector = await repository.createConnector({
      id: "connector-webhook",
      firmId: "firm-west-legal",
      type: "generic",
      key: "synthetic.webhook",
      displayName: "Synthetic Webhook",
      status: "enabled",
      secretReference: { id: "secret-ref/webhook" },
      configSummary: { deliveryUrl: "https://webhooks.example.test/open-practice" },
      createdAt,
      updatedAt: createdAt,
    });
    const pausedConnector = await repository.createConnector({
      id: "connector-paused",
      firmId: "firm-west-legal",
      type: "generic",
      key: "synthetic.paused",
      displayName: "Synthetic Paused Webhook",
      status: "paused",
      configSummary: { deliveryUrl: "https://paused.example.test/open-practice" },
      createdAt,
      updatedAt: createdAt,
    });

    await repository.createConnectorOutbox({
      id: "connector-outbox-later",
      firmId: "firm-west-legal",
      connectorId: connector.id,
      eventType: "document.verified",
      resourceType: "document",
      resourceId: "doc-later",
      idempotencyKey: "doc-later:verified:v1",
      status: "pending",
      payloadSummary: { documentId: "doc-later" },
      attemptCount: 0,
      maxAttempts: 3,
      nextAttemptAt: "2026-05-12T12:06:00.000Z",
      createdAt,
      updatedAt: createdAt,
    });
    await repository.createConnectorOutbox({
      id: "connector-outbox-ready",
      firmId: "firm-west-legal",
      connectorId: connector.id,
      eventType: "document.verified",
      resourceType: "document",
      resourceId: "doc-ready",
      idempotencyKey: "doc-ready:verified:v1",
      status: "pending",
      payloadSummary: { documentId: "doc-ready" },
      attemptCount: 0,
      maxAttempts: 3,
      nextAttemptAt: "2026-05-12T12:00:00.000Z",
      createdAt,
      updatedAt: createdAt,
    });
    await repository.createConnectorOutbox({
      id: "connector-outbox-paused",
      firmId: "firm-west-legal",
      connectorId: pausedConnector.id,
      eventType: "document.verified",
      idempotencyKey: "doc-paused:verified:v1",
      status: "pending",
      payloadSummary: { documentId: "doc-paused" },
      attemptCount: 0,
      maxAttempts: 3,
      nextAttemptAt: "2026-05-12T12:00:00.000Z",
      createdAt,
      updatedAt: createdAt,
    });

    const leased = await repository.leaseConnectorOutbox({
      firmId: "firm-west-legal",
      leaseId: "lease-001",
      leasedUntil,
      now,
      limit: 5,
    });

    expect(leased).toHaveLength(1);
    expect(leased[0]).toMatchObject({
      connector: { id: "connector-webhook", status: "enabled" },
      outbox: {
        id: "connector-outbox-ready",
        status: "leased",
        attemptCount: 1,
        leaseId: "lease-001",
      },
      attempt: {
        status: "leased",
        attemptNumber: 1,
        leaseId: "lease-001",
        idempotencyKey: "doc-ready:verified:v1",
      },
    });

    const delivered = await repository.recordConnectorDeliveryResult({
      firmId: "firm-west-legal",
      connectorId: connector.id,
      outboxId: "connector-outbox-ready",
      attemptId: leased[0].attempt.id,
      leaseId: "lease-001",
      status: "delivered",
      occurredAt: "2026-05-12T12:05:30.000Z",
      metadata: { destinationHost: "webhooks.example.test", httpStatus: 202 },
    });

    expect(delivered.outbox).toMatchObject({
      status: "delivered",
      deliveredAt: "2026-05-12T12:05:30.000Z",
      leaseId: undefined,
    });
    expect(delivered.attempt).toMatchObject({
      status: "delivered",
      finishedAt: "2026-05-12T12:05:30.000Z",
      metadata: expect.objectContaining({
        destinationHost: "webhooks.example.test",
        terminal: true,
      }),
    });
  });

  it("recovers expired connector leases and dead-letters terminal failures", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const createdAt = "2026-05-12T12:00:00.000Z";
    const connector = await repository.createConnector({
      id: "connector-expired",
      firmId: "firm-west-legal",
      type: "generic",
      key: "synthetic.expired",
      displayName: "Synthetic Expired Webhook",
      status: "enabled",
      secretReference: { id: "secret-ref/expired" },
      configSummary: { deliveryUrl: "https://webhooks.example.test/open-practice" },
      createdAt,
      updatedAt: createdAt,
    });
    await repository.createConnectorOutbox({
      id: "connector-outbox-expired",
      firmId: "firm-west-legal",
      connectorId: connector.id,
      eventType: "document.verified",
      idempotencyKey: "doc-expired:verified:v1",
      status: "leased",
      payloadSummary: { documentId: "doc-expired" },
      attemptCount: 1,
      maxAttempts: 2,
      nextAttemptAt: "2026-05-12T12:00:00.000Z",
      leaseId: "stale-lease",
      leasedUntil: "2026-05-12T12:02:00.000Z",
      createdAt,
      updatedAt: createdAt,
    });

    const [leased] = await repository.leaseConnectorOutbox({
      firmId: "firm-west-legal",
      leaseId: "lease-002",
      leasedUntil: "2026-05-12T12:15:00.000Z",
      now: "2026-05-12T12:10:00.000Z",
      limit: 1,
    });

    expect(leased.outbox).toMatchObject({
      status: "leased",
      attemptCount: 2,
      leaseId: "lease-002",
    });

    const failed = await repository.recordConnectorDeliveryResult({
      firmId: "firm-west-legal",
      connectorId: connector.id,
      outboxId: "connector-outbox-expired",
      attemptId: leased.attempt.id,
      leaseId: "lease-002",
      status: "failed",
      occurredAt: "2026-05-12T12:10:30.000Z",
      terminal: true,
      errorSummary:
        "Connector destination failed for token=private-token client@example.test secret://hidden",
      metadata: {
        reason: "localhost_or_loopback_denied",
        secret: "private-token",
        backupExportPath: "generated/private-export.json",
      },
    });

    expect(failed.outbox).toMatchObject({
      status: "dead_letter",
      deadLetteredAt: "2026-05-12T12:10:30.000Z",
      lastErrorSummary: "Connector destination failed for [redacted] [redacted-email] [redacted]",
      leaseId: undefined,
    });
    expect(failed.attempt).toMatchObject({
      status: "failed",
      errorSummary: "Connector destination failed for [redacted] [redacted-email] [redacted]",
      metadata: expect.objectContaining({
        reason: "localhost_or_loopback_denied",
        secret: "[redacted]",
        backupExportPath: "[redacted]",
        terminal: true,
      }),
    });
  });

  it("manually retries and dead-letters connector outbox rows without leaking private metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const createdAt = "2026-05-26T12:00:00.000Z";
    const connector = await repository.createConnector({
      id: "connector-recovery",
      firmId: "firm-west-legal",
      type: "generic",
      key: "synthetic.recovery",
      displayName: "Synthetic Recovery Webhook",
      status: "enabled",
      secretReference: { id: "secret-ref/recovery" },
      configSummary: { deliveryUrl: "https://webhooks.example.test/open-practice" },
      createdAt,
      updatedAt: createdAt,
    });
    await repository.createConnectorOutbox({
      id: "connector-outbox-retry",
      firmId: "firm-west-legal",
      connectorId: connector.id,
      eventType: "document.verified",
      idempotencyKey: "doc-retry:verified:v1",
      status: "dead_letter",
      payloadSummary: { documentId: "doc-retry" },
      attemptCount: 3,
      maxAttempts: 3,
      deadLetteredAt: "2026-05-26T12:05:00.000Z",
      lastErrorSummary: "Connector failed for [redacted]",
      createdAt,
      updatedAt: "2026-05-26T12:05:00.000Z",
    });
    await repository.createConnectorOutbox({
      id: "connector-outbox-manual-dead-letter",
      firmId: "firm-west-legal",
      connectorId: connector.id,
      eventType: "matter.created",
      idempotencyKey: "matter-dead-letter:created:v1",
      status: "failed",
      payloadSummary: { matterId: "matter-001" },
      attemptCount: 1,
      maxAttempts: 3,
      nextAttemptAt: "2026-05-26T12:30:00.000Z",
      lastErrorSummary: "Connector failed for [redacted]",
      createdAt,
      updatedAt: "2026-05-26T12:05:00.000Z",
    });

    const retried = await repository.retryConnectorOutbox({
      firmId: "firm-west-legal",
      outboxId: "connector-outbox-retry",
      expectedStatus: "dead_letter",
      occurredAt: "2026-05-26T12:10:00.000Z",
    });

    expect(retried).toMatchObject({
      id: "connector-outbox-retry",
      status: "pending",
      attemptCount: 3,
      maxAttempts: 4,
      nextAttemptAt: "2026-05-26T12:10:00.000Z",
      leaseId: undefined,
      leasedUntil: undefined,
      deadLetteredAt: undefined,
      lastErrorSummary: undefined,
    });
    await expect(
      repository.retryConnectorOutbox({
        firmId: "firm-west-legal",
        outboxId: "connector-outbox-retry",
        expectedStatus: "dead_letter",
        occurredAt: "2026-05-26T12:11:00.000Z",
      }),
    ).resolves.toBeUndefined();

    const deadLettered = await repository.deadLetterConnectorOutbox({
      firmId: "firm-west-legal",
      outboxId: "connector-outbox-manual-dead-letter",
      expectedStatus: "failed",
      occurredAt: "2026-05-26T12:12:00.000Z",
      errorSummary:
        "Owner moved connector row to dead letter after token=hidden client@example.test review",
    });

    expect(deadLettered).toMatchObject({
      id: "connector-outbox-manual-dead-letter",
      status: "dead_letter",
      nextAttemptAt: undefined,
      leaseId: undefined,
      leasedUntil: undefined,
      deadLetteredAt: "2026-05-26T12:12:00.000Z",
      lastErrorSummary:
        "Owner moved connector row to dead letter after [redacted] [redacted-email] review",
    });
  });
});
