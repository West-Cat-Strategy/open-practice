import { describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import {
  createQueuedJobLifecycleRecord,
  defaultJobOptionsByQueue,
  openPracticeQueues,
  redisConnectionFromUrl,
  terminalJobStatus,
} from "./queues.js";
import { processOpenPracticeJob } from "./processors.js";
import {
  createWorkerRepositoryFromEnv,
  validateWorkerReadiness,
  workerEnvSchema,
  type WorkerEnv,
} from "./worker.js";

const providerConfigEncryptionKey = Buffer.alloc(32, 7).toString("base64url");

function workerEnv(overrides: Partial<WorkerEnv> = {}): WorkerEnv {
  return workerEnvSchema.parse({
    NODE_ENV: "development",
    REDIS_URL: "redis://localhost:6379/0",
    ...overrides,
  });
}

describe("worker queue foundation", () => {
  it("defines all planned background queues with retry policies", () => {
    expect(openPracticeQueues).toEqual([
      "email",
      "connectors",
      "document_assembly",
      "inbound_email",
      "reports",
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

  it("redacts queued job metadata to routing and lifecycle fields", () => {
    expect(
      createQueuedJobLifecycleRecord({
        id: "job-ocr-1",
        firmId: "firm-1",
        queueName: "ocr",
        jobName: "extract_document_text",
        targetResourceType: "document",
        targetResourceId: "doc-1",
        metadata: {
          documentId: "doc-1",
          matterId: "matter-1",
          attachmentCount: 1,
          language: "eng",
          checksumStatus: "verified",
          extractedText: "privileged extracted text",
          title: "Privileged document.pdf",
          providerMetadata: { body: "provider payload" },
        },
      }).metadata,
    ).toEqual({
      documentId: "doc-1",
      matterId: "matter-1",
      attachmentCount: 1,
      language: "eng",
      checksumStatus: "verified",
    });
  });

  it("redacts inbound email job metadata to safe routing fields", () => {
    expect(
      createQueuedJobLifecycleRecord({
        id: "job-inbound-1",
        firmId: "firm-1",
        queueName: "inbound_email",
        jobName: "parse_inbound_email",
        targetResourceType: "inbound_email",
        targetResourceId: "inbound-message-1",
        metadata: {
          firmId: "firm-1",
          inboundMessageId: "inbound-message-1",
          matterId: "matter-1",
          attachmentCount: 2,
          rawStorageKey: "inbound-email/firm-1/raw/message.eml",
          storageKey: "inbound-email/firm-1/inbound-message-1/body.html",
          upstreamMessageId: "<provider-private@example.test>",
          attachments: [{ filename: "private filing.pdf", storageKey: "private/path.pdf" }],
        },
      }).metadata,
    ).toEqual({
      firmId: "firm-1",
      inboundMessageId: "inbound-message-1",
      matterId: "matter-1",
      attachmentCount: 2,
    });
  });

  it("keeps processors disabled until providers are configured", async () => {
    await expect(
      processOpenPracticeJob({
        queueName: "ai_triage",
        jobName: "classify",
        data: { firmId: "firm-1" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        repository: {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        s3: {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ocrProvider: {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mailSender: {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inboundEmailParser: {} as any,
      }),
    ).resolves.toMatchObject({
      status: "skipped",
      metadata: { providerConfigured: false },
    });
    expect(terminalJobStatus("queued")).toBe(false);
    expect(terminalJobStatus("skipped")).toBe(true);
  });

  it("starts memory repository mode without requiring DATABASE_URL", () => {
    const runtime = createWorkerRepositoryFromEnv(workerEnv());

    expect(runtime.repository).toBeInstanceOf(InMemoryOpenPracticeRepository);
    expect(runtime.close).toBeUndefined();
  });

  it("rejects invalid worker provider config encryption keys", () => {
    expect(() =>
      workerEnvSchema.parse({ OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: "not-a-32-byte-key" }),
    ).toThrow(/OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY/);
    expect(() => workerEnvSchema.parse({ S3_SERVER_SIDE_ENCRYPTION: "aws:kms" })).toThrow(
      /S3_SERVER_SIDE_ENCRYPTION/,
    );
  });

  it("parses worker boolean env strings before provider config key readiness checks", () => {
    const parsed = workerEnvSchema.parse({
      DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
      OPEN_PRACTICE_USE_MEMORY_REPO: "false",
      OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: providerConfigEncryptionKey,
      S3_SERVER_SIDE_ENCRYPTION: "AES256",
    });

    expect(parsed.OPEN_PRACTICE_USE_MEMORY_REPO).toBe(false);
    expect(parsed.S3_SERVER_SIDE_ENCRYPTION).toBe("AES256");
    expect(
      workerEnvSchema.parse({ OPEN_PRACTICE_USE_MEMORY_REPO: "true" })
        .OPEN_PRACTICE_USE_MEMORY_REPO,
    ).toBe(true);
    expect(workerEnvSchema.parse({ S3_SERVER_SIDE_ENCRYPTION: "AES256" })).toMatchObject({
      S3_SERVER_SIDE_ENCRYPTION: "AES256",
    });
  });

  it("requires a provider config encryption key when the worker uses PostgreSQL", () => {
    expect(() =>
      createWorkerRepositoryFromEnv(
        workerEnv({
          DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
        }),
      ),
    ).toThrow(/OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY/);
  });

  it("rejects worker memory mode when a database URL is also present", () => {
    expect(() =>
      createWorkerRepositoryFromEnv(
        workerEnv({
          DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
          OPEN_PRACTICE_USE_MEMORY_REPO: true,
        }),
      ),
    ).toThrow("Worker memory repository cannot be combined with DATABASE_URL");
  });

  it("applies production repository safety checks before worker startup", () => {
    expect(() => validateWorkerReadiness(workerEnv({ NODE_ENV: "production" }))).toThrow(
      "DATABASE_URL is required in production",
    );
    expect(() =>
      validateWorkerReadiness(
        workerEnv({
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
        }),
      ),
    ).toThrow("OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY is required when DATABASE_URL is configured");
    expect(() =>
      validateWorkerReadiness(
        workerEnv({
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
          OPEN_PRACTICE_USE_MEMORY_REPO: true,
          OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: providerConfigEncryptionKey,
        }),
      ),
    ).toThrow("OPEN_PRACTICE_USE_MEMORY_REPO cannot be true in production");
    expect(() =>
      validateWorkerReadiness(
        workerEnv({
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
          OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: providerConfigEncryptionKey,
          OPEN_PRACTICE_DEV_SEED: true,
        }),
      ),
    ).toThrow("OPEN_PRACTICE_DEV_SEED cannot be true in production");
    expect(() =>
      validateWorkerReadiness(
        workerEnv({
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
          OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: providerConfigEncryptionKey,
          OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP: true,
        }),
      ),
    ).toThrow("OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP cannot be true in production");
    expect(() =>
      validateWorkerReadiness(
        workerEnv({
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
          OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: providerConfigEncryptionKey,
          E2E_MODE: "docker",
        }),
      ),
    ).toThrow("E2E_MODE cannot be configured in production");
    expect(() =>
      validateWorkerReadiness(
        workerEnv({
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
          OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: providerConfigEncryptionKey,
          S3_ENDPOINT: "http://localhost:9000",
          S3_ACCESS_KEY: "open_practice",
          S3_SECRET_KEY: "open_practice_secret",
        }),
      ),
    ).toThrow("S3_SERVER_SIDE_ENCRYPTION=AES256 is required when S3 is configured");
    expect(() =>
      validateWorkerReadiness(
        workerEnv({
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
          OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: providerConfigEncryptionKey,
          S3_ENDPOINT: "http://localhost:9000",
          S3_ACCESS_KEY: "open_practice",
          S3_SECRET_KEY: "open_practice_secret",
          S3_SERVER_SIDE_ENCRYPTION: "AES256",
        }),
      ),
    ).not.toThrow();
  });
});
