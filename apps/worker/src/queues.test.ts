import { describe, expect, it } from "vitest";
import {
  createQueuedJobLifecycleRecord,
  defaultJobOptionsByQueue,
  openPracticeQueues,
  redisConnectionFromUrl,
  terminalJobStatus,
} from "./queues.js";
import { processOpenPracticeJob } from "./processors.js";

describe("worker queue foundation", () => {
  it("defines all planned background queues with retry policies", () => {
    expect(openPracticeQueues).toEqual([
      "email",
      "inbound_email",
      "ai_triage",
      "ocr",
      "transcription",
      "media",
    ]);
    expect(defaultJobOptionsByQueue.email).toMatchObject({
      attempts: 5,
      removeOnFail: false,
    });
  });

  it("parses Redis URLs for BullMQ connections", () => {
    expect(redisConnectionFromUrl("redis://:secret@localhost:6379/2")).toMatchObject({
      host: "localhost",
      port: 6379,
      password: "secret",
      db: 2,
    });
    expect(redisConnectionFromUrl("rediss://redis.example.test")).toMatchObject({
      host: "redis.example.test",
      tls: {},
    });
  });

  it("creates lifecycle records for queued jobs", () => {
    expect(
      createQueuedJobLifecycleRecord({
        id: "job-1",
        firmId: "firm-1",
        queueName: "ocr",
        jobName: "extract_text",
        targetResourceType: "document",
        targetResourceId: "doc-1",
        now: "2026-04-25T12:00:00.000Z",
      }),
    ).toMatchObject({
      id: "job-1",
      status: "queued",
      maxAttempts: 3,
      queuedAt: "2026-04-25T12:00:00.000Z",
    });
  });

  it("keeps processors disabled until providers are configured", async () => {
    await expect(
      processOpenPracticeJob("ai_triage", "classify", { firmId: "firm-1" }),
    ).resolves.toMatchObject({
      status: "skipped",
      metadata: { providerConfigured: false },
    });
    expect(terminalJobStatus("queued")).toBe(false);
    expect(terminalJobStatus("skipped")).toBe(true);
  });
});
