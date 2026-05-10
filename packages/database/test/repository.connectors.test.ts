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
});
