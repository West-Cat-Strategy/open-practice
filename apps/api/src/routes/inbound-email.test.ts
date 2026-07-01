import { PutObjectCommand } from "@aws-sdk/client-s3";
import Fastify, { type FastifyInstance } from "fastify";
import type { S3Client } from "@aws-sdk/client-s3";
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type {
  InboundEmailAttachmentRecord,
  InboundEmailMessageRecord,
  JobLifecycleRecord,
  ProfessionalRole,
  User,
} from "@open-practice/domain";
import {
  IMAP_INBOUND_PROVIDER_KEY,
  IMAP_POLL_JOB_NAME,
  serializeImapProviderConfig,
} from "@open-practice/domain";
import { sampleFirm, sampleUsers } from "@open-practice/domain/sample-data";
import { registerInboundEmailRoutes } from "./inbound-email.js";
import type { ApiJobQueue, ConnectorDnsResolver } from "./types.js";

const firmId = "firm-west-legal";
const now = "2026-04-29T12:00:00.000Z";
const servers: FastifyInstance[] = [];
type TestS3Config = { client: S3Client; bucket: string; serverSideEncryption?: "AES256" };
const inboundParserRecoveryMetadata = {
  recoveryPosture: "owner_reviewed_raw_object_replay",
  ownerReviewRequired: true,
  rawObjectRecoverable: true,
  providerPayloadStored: false,
  automaticDocumentPromotion: false,
  automaticMatterCreation: false,
};
const inboundPollRecoveryMetadata = {
  recoveryPosture: "owner_reviewed_provider_poll",
  ownerReviewRequired: true,
  rawObjectRecoverable: false,
  providerPayloadStored: false,
  automaticDocumentPromotion: false,
  automaticMatterCreation: false,
};

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  const idByRole: Partial<Record<ProfessionalRole, string>> = {
    owner_admin: "user-admin",
    auditor: "user-auditor",
    licensee: "user-licensee",
    firm_member: "user-staff",
  };
  return {
    id: idByRole[role] ?? `user-${role}`,
    firmId,
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function testServer(
  repository: InMemoryOpenPracticeRepository,
  authUser: User = user("owner_admin", ["matter-001", "matter-002"]),
  ocrJobQueue?: ApiJobQueue,
  s3: TestS3Config | null = fakeS3(),
  inboundEmailJobQueue?: ApiJobQueue,
  connectorDnsResolver: ConnectorDnsResolver = async () => ["203.0.113.10"],
): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerInboundEmailRoutes(server, {
    repository,
    ocrJobQueue,
    inboundEmailJobQueue,
    s3: s3 ?? undefined,
    connectorDnsResolver,
  });
  servers.push(server);
  return server;
}

function message(overrides: Partial<InboundEmailMessageRecord> = {}): InboundEmailMessageRecord {
  return {
    id: "inbound-message-001",
    firmId,
    addressId: "inbound-address-001",
    matterId: "matter-001",
    messageId: "<message-001@example.test>",
    fromAddress: "client@example.test",
    toAddresses: ["matter-001@open-practice.test"],
    subject: "Filed materials",
    receivedAt: now,
    rawStorageKey: "inbound/raw/message-001.eml",
    parsedText: "Please review.",
    labels: [],
    status: "triaged",
    metadata: {},
    ...overrides,
  };
}

function attachment(
  overrides: Partial<InboundEmailAttachmentRecord> = {},
): InboundEmailAttachmentRecord {
  return {
    id: "inbound-attachment-001",
    firmId,
    inboundMessageId: "inbound-message-001",
    filename: "filing.pdf",
    contentType: "application/pdf",
    sizeBytes: 128,
    storageKey: "inbound/message-001/filing.pdf",
    checksumSha256: "a".repeat(64),
    ...overrides,
  };
}

function parserJob(overrides: Partial<JobLifecycleRecord> = {}): JobLifecycleRecord {
  const id = overrides.id ?? "job-inbound-parser-failed";
  return {
    id,
    firmId,
    queueName: "inbound_email",
    jobName: "parse_inbound_email",
    status: "failed",
    targetResourceType: "inbound_email_raw",
    targetResourceId: "synthetic-token-hash",
    attemptsMade: 1,
    maxAttempts: 4,
    queuedAt: "2026-04-29T10:00:00.000Z",
    failedAt: "2026-04-29T10:01:00.000Z",
    errorMessage: "Synthetic parser failed with raw MIME body details",
    idempotencyKey: `inbound-parser-original-key-${id}`,
    metadata: {
      ...inboundParserRecoveryMetadata,
      provider: "mailgun",
      source: "mailgun.raw_mime_webhook",
      resourceType: "inbound_email_raw",
      resourceId: "synthetic-token-hash",
      tokenHash: "synthetic-token-hash",
      rawStorageKeyPresent: true,
      rawContentSha256: "b".repeat(64),
      rawSizeBytes: 128,
    },
    ...overrides,
  };
}

function fakeOcrQueue() {
  const jobs: Array<{ name: string; data: unknown; jobId?: string }> = [];
  const queue: ApiJobQueue = {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? "bull-ocr-job" };
    },
  };
  return { queue, jobs };
}

function fakeInboundEmailQueue(input: { reject?: boolean } = {}) {
  const jobs: Array<{ name: string; data: unknown; jobId?: string }> = [];
  const queue: ApiJobQueue = {
    async add(name, data, options) {
      if (input.reject) throw new Error("synthetic queue failure");
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? "bull-inbound-email-job" };
    },
  };
  return { queue, jobs };
}

function fakeS3(): TestS3Config {
  return {
    client: {} as S3Client,
    bucket: "open-practice-test-documents",
  };
}

function writableFakeS3(input: { serverSideEncryption?: "AES256" } = {}): {
  s3: TestS3Config;
  puts: PutObjectCommand[];
} {
  const puts: PutObjectCommand[] = [];
  return {
    s3: {
      client: {
        async send(command: PutObjectCommand) {
          puts.push(command);
          return {};
        },
      } as unknown as S3Client,
      bucket: "open-practice-test-documents",
      ...(input.serverSideEncryption ? { serverSideEncryption: input.serverSideEncryption } : {}),
    },
    puts,
  };
}

async function enableMailgunProvider(
  repository: InMemoryOpenPracticeRepository,
  config: Record<string, unknown> | string = {
    webhookSigningKey: "synthetic-mailgun-signing-key",
    domain: "mail.example.test",
  },
): Promise<void> {
  await repository.upsertProviderSetting({
    id: "provider-inbound-mailgun",
    firmId,
    kind: "inbound_email",
    key: "mailgun",
    enabled: true,
    encryptedConfig: typeof config === "string" ? config : JSON.stringify(config),
    createdAt: now,
    updatedAt: now,
  });
}

async function enableOcrProvider(repository: InMemoryOpenPracticeRepository): Promise<void> {
  await repository.upsertProviderSetting({
    id: "provider-ocr-enabled",
    firmId,
    kind: "ocr",
    key: "local-cli-ocr",
    enabled: true,
    encryptedConfig: "synthetic-ocr-config-not-returned",
    createdAt: now,
    updatedAt: now,
  });
}

function mailgunSignature(secret: string, timestamp: string, token: string): string {
  return createHmac("sha256", secret).update(`${timestamp}${token}`).digest("hex");
}

function mailgunRawMimePayload(
  input: {
    secret?: string;
    timestamp?: string;
    token?: string;
    rawMime?: string;
    signature?: string;
  } = {},
): string {
  const secret = input.secret ?? "synthetic-mailgun-signing-key";
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const token = input.token ?? "synthetic-mailgun-token";
  const signature = input.signature ?? mailgunSignature(secret, timestamp, token);
  const form = new URLSearchParams();
  form.set("timestamp", timestamp);
  form.set("token", token);
  form.set("signature", signature);
  if (input.rawMime !== undefined) form.set("body-mime", input.rawMime);
  else form.set("body-mime", "From: client@example.test\nTo: matter@example.test\n\nHello");
  return form.toString();
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function singleFirmMemoryRepository(): InMemoryOpenPracticeRepository {
  return new InMemoryOpenPracticeRepository({
    firms: [sampleFirm],
    users: sampleUsers.filter((user) => user.firmId === sampleFirm.id),
  });
}

describe("inbound email routes", () => {
  it("accepts signed Mailgun raw MIME webhooks, stores the raw body, and queues parsing", async () => {
    const repository = singleFirmMemoryRepository();
    await enableMailgunProvider(repository);
    const { s3, puts } = writableFakeS3({ serverSideEncryption: "AES256" });
    const inboundQueue = fakeInboundEmailQueue();
    const rawMime =
      "From: client@example.test\nTo: matter-001@mail.example.test\nSubject: Evidence\n\nSynthetic body.";

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      s3,
      inboundQueue.queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: mailgunRawMimePayload({ rawMime }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "accepted",
      provider: "mailgun",
      duplicate: false,
      job: {
        queueName: "inbound_email",
        jobName: "parse_inbound_email",
        status: "queued",
        idempotencyKeyPresent: true,
      },
    });
    expect(response.body).not.toMatch(/"rawStorageKey"\s*:/);
    expect(response.body).not.toContain("Synthetic body");
    expect(response.body).not.toContain("synthetic-mailgun-signing-key");

    expect(puts).toHaveLength(1);
    const putInput = puts[0]!.input;
    expect(putInput).toMatchObject({
      Bucket: "open-practice-test-documents",
      ContentType: "message/rfc822",
      ServerSideEncryption: "AES256",
    });
    expect(putInput.Key).toMatch(
      /^inbound-email\/firm-west-legal\/raw\/provider-webhooks\/mailgun\/raw-mime\//,
    );
    expect(Buffer.from(putInput.Body as Uint8Array).toString("utf8")).toBe(rawMime);

    expect(inboundQueue.jobs).toHaveLength(1);
    expect(inboundQueue.jobs[0]).toMatchObject({
      name: "parse_inbound_email",
      jobId: response.json().job.id,
      data: {
        firmId,
        resourceType: "inbound_email_raw",
      },
    });
    expect(
      (inboundQueue.jobs[0]!.data as { metadata: Record<string, unknown> }).metadata.rawStorageKey,
    ).toBe(putInput.Key);

    const [job] = await repository.listJobLifecycleRecords(firmId, {
      queueName: "inbound_email",
    });
    expect(job).toMatchObject({
      id: response.json().job.id,
      queueName: "inbound_email",
      jobName: "parse_inbound_email",
      targetResourceType: "inbound_email_raw",
      metadata: {
        ...inboundParserRecoveryMetadata,
        provider: "mailgun",
        source: "mailgun.raw_mime_webhook",
        rawStorageKeyPresent: true,
      },
    });
    expect(job.metadata).not.toHaveProperty("rawStorageKey");
    expect(JSON.stringify(job.metadata)).not.toContain(putInput.Key);
  });

  it("accepts legacy plaintext Mailgun provider signing secrets", async () => {
    const repository = singleFirmMemoryRepository();
    await enableMailgunProvider(repository, "legacy-plaintext-mailgun-secret");
    const { s3 } = writableFakeS3();
    const inboundQueue = fakeInboundEmailQueue();

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      s3,
      inboundQueue.queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: mailgunRawMimePayload({ secret: "legacy-plaintext-mailgun-secret" }),
    });

    expect(response.statusCode).toBe(200);
    expect(inboundQueue.jobs).toHaveLength(1);
  });

  it("rejects Mailgun raw MIME webhooks with invalid or stale signatures", async () => {
    const repository = singleFirmMemoryRepository();
    await enableMailgunProvider(repository);
    const { s3, puts } = writableFakeS3();
    const inboundQueue = fakeInboundEmailQueue();
    const server = testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      s3,
      inboundQueue.queue,
    );

    const invalid = await server.inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: mailgunRawMimePayload({ signature: "f".repeat(64) }),
    });
    const staleTimestamp = Math.floor((Date.now() - 60 * 60 * 1000) / 1000).toString();
    const stale = await server.inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: mailgunRawMimePayload({ timestamp: staleTimestamp }),
    });

    expect(invalid.statusCode).toBe(406);
    expect(stale.statusCode).toBe(406);
    expect(puts).toHaveLength(0);
    expect(inboundQueue.jobs).toHaveLength(0);
  });

  it("rejects Mailgun raw MIME webhooks that omit body-mime", async () => {
    const repository = singleFirmMemoryRepository();
    await enableMailgunProvider(repository);
    const { s3, puts } = writableFakeS3();
    const inboundQueue = fakeInboundEmailQueue();

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      s3,
      inboundQueue.queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: mailgunRawMimePayload({ rawMime: undefined }).replace(/&body-mime=[^&]*/, ""),
    });

    expect(response.statusCode).toBe(406);
    expect(puts).toHaveLength(0);
    expect(inboundQueue.jobs).toHaveLength(0);
  });

  it("returns 503 when Mailgun signing, object storage, or inbound queue is unavailable", async () => {
    const missingSecretRepository = singleFirmMemoryRepository();
    await enableMailgunProvider(missingSecretRepository, { domain: "mail.example.test" });
    const missingS3Repository = singleFirmMemoryRepository();
    await enableMailgunProvider(missingS3Repository);
    const missingQueueRepository = singleFirmMemoryRepository();
    await enableMailgunProvider(missingQueueRepository);
    const { s3, puts } = writableFakeS3();
    const inboundQueue = fakeInboundEmailQueue();

    const missingSecret = await testServer(
      missingSecretRepository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      s3,
      inboundQueue.queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: mailgunRawMimePayload(),
    });
    const missingS3 = await testServer(
      missingS3Repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      null,
      inboundQueue.queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: mailgunRawMimePayload(),
    });
    const missingQueue = await testServer(
      missingQueueRepository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      s3,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: mailgunRawMimePayload(),
    });

    expect(missingSecret.statusCode).toBe(503);
    expect(missingS3.statusCode).toBe(503);
    expect(missingQueue.statusCode).toBe(503);
    expect(puts).toHaveLength(0);
    expect(inboundQueue.jobs).toHaveLength(0);
  });

  it("keeps Mailgun token replays idempotent without enqueueing duplicate parser jobs", async () => {
    const repository = singleFirmMemoryRepository();
    await enableMailgunProvider(repository);
    const { s3, puts } = writableFakeS3();
    const inboundQueue = fakeInboundEmailQueue();
    const token = "synthetic-duplicate-mailgun-token";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = mailgunRawMimePayload({ token, timestamp });
    const server = testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      s3,
      inboundQueue.queue,
    );

    const first = await server.inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload,
    });
    const second = await server.inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ duplicate: true });
    expect(second.json().job.id).toBe(first.json().job.id);
    expect(puts).toHaveLength(1);
    expect(inboundQueue.jobs).toHaveLength(1);
    expect(
      await repository.listJobLifecycleRecords(firmId, { queueName: "inbound_email" }),
    ).toHaveLength(1);
  });

  it("rejects changed-body Mailgun token replays before writing raw MIME storage", async () => {
    const repository = singleFirmMemoryRepository();
    await enableMailgunProvider(repository);
    const { s3, puts } = writableFakeS3();
    const inboundQueue = fakeInboundEmailQueue();
    const token = "synthetic-changed-body-mailgun-token";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const server = testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      s3,
      inboundQueue.queue,
    );

    const first = await server.inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: mailgunRawMimePayload({ token, timestamp, rawMime: "first synthetic raw body" }),
    });
    const replay = await server.inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: mailgunRawMimePayload({ token, timestamp, rawMime: "changed synthetic raw body" }),
    });

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(409);
    expect(replay.json()).toMatchObject({ code: "IDEMPOTENCY_KEY_CONFLICT" });
    expect(puts).toHaveLength(1);
    expect(inboundQueue.jobs).toHaveLength(1);
  });

  it("marks Mailgun lifecycle jobs failed when the parser queue rejects enqueue", async () => {
    const repository = singleFirmMemoryRepository();
    await enableMailgunProvider(repository);
    const { s3 } = writableFakeS3();
    const inboundQueue = fakeInboundEmailQueue({ reject: true });

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      s3,
      inboundQueue.queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: mailgunRawMimePayload(),
    });

    const [job] = await repository.listJobLifecycleRecords(firmId, {
      queueName: "inbound_email",
    });
    expect(response.statusCode).toBe(503);
    expect(job).toMatchObject({
      status: "failed",
      attemptsMade: 1,
      metadata: expect.objectContaining({
        ...inboundParserRecoveryMetadata,
        enqueueStatus: "failed",
        providerFailureStage: "parser_enqueue",
      }),
    });
  });

  it("manually retries failed inbound parser jobs without exposing raw MIME pointers", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord(parserJob());
    const inboundQueue = fakeInboundEmailQueue();
    const server = testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      undefined,
      inboundQueue.queue,
    );

    const response = await server.inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/retry",
      payload: {
        idempotencyKey: "operator-retry-001",
        confirmation: {
          confirmed: true,
          action: "retry",
          jobId: "job-inbound-parser-failed",
          expectedStatus: "failed",
        },
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      status: "queued",
      job: {
        queueName: "inbound_email",
        jobName: "parse_inbound_email",
        status: "queued",
        targetResourceType: "inbound_email_raw",
        targetResourceId: "synthetic-token-hash",
        idempotencyKeyPresent: true,
      },
      sourceJob: {
        id: "job-inbound-parser-failed",
        status: "failed",
        errorSummary:
          "Job failed. Error details are redacted; review server logs for privileged diagnostics.",
      },
    });
    expect(response.body).not.toMatch(/"rawStorageKey"\s*:/);
    expect(response.body).not.toContain("message.eml");
    expect(response.body).not.toContain("Synthetic body");
    expect(response.body).not.toContain("synthetic-mailgun-signing-key");
    expect(response.json().job.metadata).toMatchObject(inboundParserRecoveryMetadata);
    expect(response.json().sourceJob.metadata).toMatchObject(inboundParserRecoveryMetadata);
    expect(inboundQueue.jobs).toHaveLength(1);
    expect(inboundQueue.jobs[0]).toMatchObject({
      name: "parse_inbound_email",
      jobId: response.json().job.id,
      data: {
        firmId,
        resourceType: "inbound_email_raw",
        resourceId: "synthetic-token-hash",
      },
    });
    expect(
      (inboundQueue.jobs[0]!.data as { metadata: Record<string, unknown> }).metadata.rawStorageKey,
    ).toBe(
      `inbound-email/firm-west-legal/raw/provider-webhooks/mailgun/raw-mime/synthetic-token-hash-${"b".repeat(
        64,
      )}.eml`,
    );

    const jobs = await repository.listJobLifecycleRecords(firmId, { queueName: "inbound_email" });
    expect(jobs).toHaveLength(2);
    expect(jobs.find((job) => job.id === "job-inbound-parser-failed")).toMatchObject({
      status: "failed",
    });
    expect(jobs.find((job) => job.id === response.json().job.id)).toMatchObject({
      status: "queued",
      metadata: expect.objectContaining({
        ...inboundParserRecoveryMetadata,
        retryOfJobId: "job-inbound-parser-failed",
        rawStorageKeyPresent: true,
      }),
    });
    expect(jobs.find((job) => job.id === response.json().job.id)?.metadata).not.toHaveProperty(
      "rawStorageKey",
    );
    expect(
      JSON.stringify(jobs.find((job) => job.id === response.json().job.id)?.metadata),
    ).not.toContain("message.eml");

    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events.at(-1)).toMatchObject({
      action: "inbound_email.parser_job.manual_retry",
      resourceType: "inbound_email",
      resourceId: "job-inbound-parser-failed",
      metadata: {
        jobId: "job-inbound-parser-failed",
        retryJobId: response.json().job.id,
        queueName: "inbound_email",
        jobName: "parse_inbound_email",
        beforeStatus: "failed",
        expectedStatus: "failed",
        afterStatus: "queued",
        provider: "mailgun",
        source: "mailgun.raw_mime_webhook",
        idempotencyKeyPresent: true,
        retryJobQueued: true,
      },
    });
    expect(JSON.stringify(audit.events.at(-1))).not.toContain("rawStorageKey");
    expect(JSON.stringify(audit.events.at(-1))).not.toContain(".eml");

    await repository.updateJobLifecycleRecord(firmId, response.json().job.id, {
      status: "failed",
      failedAt: "2026-04-29T10:05:00.000Z",
      errorMessage: "Synthetic retry parser failure.",
    });
    const retryAgain = await server.inject({
      method: "POST",
      url: `/api/inbound-email/parser-jobs/${response.json().job.id}/retry`,
      payload: {
        idempotencyKey: "operator-retry-002",
        confirmation: {
          confirmed: true,
          action: "retry",
          jobId: response.json().job.id,
          expectedStatus: "failed",
        },
      },
    });
    expect(retryAgain.statusCode).toBe(202);
    expect(inboundQueue.jobs).toHaveLength(2);
    expect(
      (inboundQueue.jobs[1]!.data as { metadata: Record<string, unknown> }).metadata.rawStorageKey,
    ).toBe(
      `inbound-email/firm-west-legal/raw/provider-webhooks/mailgun/raw-mime/synthetic-token-hash-${"b".repeat(
        64,
      )}.eml`,
    );
    const retriedAgainJobs = await repository.listJobLifecycleRecords(firmId, {
      queueName: "inbound_email",
    });
    expect(
      retriedAgainJobs.find((job) => job.id === retryAgain.json().job.id)?.metadata,
    ).not.toHaveProperty("rawStorageKey");
  });

  it("marks failed inbound parser retry enqueues with owner-reviewed recovery metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord(parserJob());
    const inboundQueue = fakeInboundEmailQueue({ reject: true });

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      undefined,
      inboundQueue.queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/retry",
      payload: {
        idempotencyKey: "operator-retry-enqueue-failure",
        confirmation: {
          confirmed: true,
          action: "retry",
          jobId: "job-inbound-parser-failed",
          expectedStatus: "failed",
        },
      },
    });

    expect(response.statusCode).toBe(503);
    expect(inboundQueue.jobs).toHaveLength(0);
    const jobs = await repository.listJobLifecycleRecords(firmId, { queueName: "inbound_email" });
    const retryJob = jobs.find((job) => job.id !== "job-inbound-parser-failed");
    expect(retryJob).toMatchObject({
      status: "failed",
      attemptsMade: 1,
      metadata: expect.objectContaining({
        ...inboundParserRecoveryMetadata,
        enqueueStatus: "failed",
        providerFailureStage: "parser_retry_enqueue",
        rawStorageKeyPresent: true,
      }),
    });
    expect(retryJob?.metadata).not.toHaveProperty("rawStorageKey");
    expect(JSON.stringify(retryJob?.metadata)).not.toContain(".eml");
  });

  it("keeps manual inbound parser retries idempotent by operator key", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord(parserJob({ status: "dead_letter" }));
    const inboundQueue = fakeInboundEmailQueue();
    const server = testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      undefined,
      inboundQueue.queue,
    );
    const payload = {
      idempotencyKey: "operator-retry-duplicate",
      confirmation: {
        confirmed: true,
        action: "retry",
        jobId: "job-inbound-parser-failed",
        expectedStatus: "dead_letter",
      },
    };

    const first = await server.inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/retry",
      payload,
    });
    const second = await server.inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/retry",
      payload,
    });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    expect(second.json()).toMatchObject({ status: "duplicate" });
    expect(second.json().job.id).toBe(first.json().job.id);
    expect(inboundQueue.jobs).toHaveLength(1);
    await expect(
      repository.listJobLifecycleRecords(firmId, { queueName: "inbound_email" }),
    ).resolves.toHaveLength(2);
  });

  it("rejects inbound parser recovery confirmation mismatches and non-parser raw keys", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord(parserJob());
    await repository.createJobLifecycleRecord(
      parserJob({
        id: "job-inbound-parser-old-key",
        metadata: {
          provider: "mailgun",
          rawStorageKey:
            "inbound-email/firm-west-legal/provider-webhooks/mailgun/raw-mime/old-message.eml",
        },
      }),
    );
    const inboundQueue = fakeInboundEmailQueue();
    const server = testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      undefined,
      inboundQueue.queue,
    );

    const mismatch = await server.inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/retry",
      payload: {
        confirmation: {
          confirmed: true,
          action: "retry",
          jobId: "job-inbound-parser-failed",
          expectedStatus: "dead_letter",
        },
      },
    });
    const invalidRawKey = await server.inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-old-key/retry",
      payload: {
        confirmation: {
          confirmed: true,
          action: "retry",
          jobId: "job-inbound-parser-old-key",
          expectedStatus: "failed",
        },
      },
    });

    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json()).toMatchObject({
      code: "INBOUND_EMAIL_PARSER_JOB_CONFIRMATION_MISMATCH",
    });
    expect(invalidRawKey.statusCode).toBe(409);
    expect(invalidRawKey.json()).toMatchObject({
      code: "INBOUND_EMAIL_RAW_STORAGE_KEY_INVALID",
    });
    expect(inboundQueue.jobs).toHaveLength(0);
  });

  it("rejects terminal inbound parser retries and missing parser queue configuration", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord(parserJob({ status: "completed" }));
    await repository.createJobLifecycleRecord(
      parserJob({
        id: "job-inbound-parser-failed-without-queue",
        targetResourceId: "synthetic-token-hash-queue",
      }),
    );

    const terminal = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      undefined,
      fakeInboundEmailQueue().queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/retry",
      payload: {
        confirmation: {
          confirmed: true,
          action: "retry",
          jobId: "job-inbound-parser-failed",
          expectedStatus: "failed",
        },
      },
    });
    const missingQueue = await testServer(repository).inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed-without-queue/retry",
      payload: {
        confirmation: {
          confirmed: true,
          action: "retry",
          jobId: "job-inbound-parser-failed-without-queue",
          expectedStatus: "failed",
        },
      },
    });

    expect(terminal.statusCode).toBe(409);
    expect(terminal.json()).toMatchObject({
      code: "INBOUND_EMAIL_PARSER_JOB_CONFIRMATION_MISMATCH",
    });
    expect(missingQueue.statusCode).toBe(503);
    expect(missingQueue.json()).toMatchObject({
      code: "INBOUND_EMAIL_QUEUE_NOT_CONFIGURED",
    });
  });

  it("requires owner-only job update access for inbound parser recovery", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord(parserJob());
    const payload = {
      confirmation: {
        confirmed: true,
        action: "retry",
        jobId: "job-inbound-parser-failed",
        expectedStatus: "failed",
      },
    };

    const staff = await testServer(
      repository,
      user("licensee", ["matter-001", "matter-002"]),
      undefined,
      undefined,
      fakeInboundEmailQueue().queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/retry",
      payload,
    });
    const client = await testServer(
      repository,
      user("client_external", ["matter-001"]),
      undefined,
      undefined,
      fakeInboundEmailQueue().queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/retry",
      payload,
    });

    expect(staff.statusCode).toBe(403);
    expect(client.statusCode).toBe(403);
  });

  it("lists owner-only metadata-only replay inventory for failed and dead-letter parser jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord(
      parserJob({
        bullJobId: "bull-private-parser-job",
        metadata: {
          ...parserJob().metadata,
          providerFailureStage: "parser_enqueue",
          rawStorageKey: "inbound-email/firm-west-legal/raw/private-message.eml",
          objectKey: "inbound-email/firm-west-legal/raw/private-object.eml",
          providerPayload: { private: "Synthetic provider payload" },
          mailboxPassword: "synthetic-mailbox-password",
          rawMime: "Synthetic raw MIME body",
        },
      }),
    );
    await repository.createJobLifecycleRecord(
      parserJob({
        id: "job-inbound-parser-dead-letter",
        status: "dead_letter",
        queuedAt: "2026-04-29T11:00:00.000Z",
        failedAt: "2026-04-29T11:01:00.000Z",
        attemptsMade: 4,
        metadata: {
          ...inboundParserRecoveryMetadata,
          provider: "imap",
          source: "imap.mailbox_poll",
          resourceType: "inbound_email_raw",
          resourceId: "synthetic-imap-resource",
          providerFailureStage: "imap_parser_enqueue",
          mailboxHash: "synthetic-mailbox-hash",
          uidValidity: 123,
          uid: 456,
          rawContentSha256: "c".repeat(64),
          rawStorageKey: "inbound-email/firm-west-legal/raw/provider-polls/imap/private.eml",
          providerPayload: { private: "Synthetic IMAP payload" },
          mailboxSecret: "synthetic-mailbox-secret",
        },
      }),
    );
    await repository.createJobLifecycleRecord(
      parserJob({
        id: "job-inbound-parser-completed",
        status: "completed",
        failedAt: undefined,
        finishedAt: "2026-04-29T11:30:00.000Z",
      }),
    );
    await repository.createJobLifecycleRecord(
      parserJob({
        id: "job-inbound-parser-queued",
        status: "queued",
        failedAt: undefined,
      }),
    );
    await repository.createJobLifecycleRecord({
      ...parserJob({ id: "job-inbound-poll-failed" }),
      jobName: "poll_inbound_email",
      targetResourceType: "inbound_email_poll",
      targetResourceId: "poll-private-target",
    });
    const inboundQueue = fakeInboundEmailQueue();
    const beforeJobs = await repository.listJobLifecycleRecords(firmId, {
      queueName: "inbound_email",
    });

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      null,
      inboundQueue.queue,
    ).inject({
      method: "GET",
      url: "/api/inbound-email/parser-jobs/replay-inventory?limit=2",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "available",
      summary: {
        total: 2,
        failed: 1,
        deadLetter: 1,
        byProviderFamily: { imap: 1, mailgun: 1 },
        byFailureStage: { imap_parser_enqueue: 1, parser_enqueue: 1 },
      },
      jobs: [
        {
          jobId: "job-inbound-parser-dead-letter",
          status: "dead_letter",
          providerFamily: "imap",
          failureStage: "imap_parser_enqueue",
          queuedAt: "2026-04-29T11:00:00.000Z",
          failedAt: "2026-04-29T11:01:00.000Z",
          attemptsMade: 4,
          maxAttempts: 4,
          safetyFlags: {
            noRawMime: true,
            noObjectKey: true,
            noProviderPayload: true,
            noMailboxSecret: true,
            noDocumentPromotion: true,
            noMatterCreation: true,
          },
        },
        {
          jobId: "job-inbound-parser-failed",
          status: "failed",
          providerFamily: "mailgun",
          failureStage: "parser_enqueue",
          queuedAt: "2026-04-29T10:00:00.000Z",
          failedAt: "2026-04-29T10:01:00.000Z",
          attemptsMade: 1,
          maxAttempts: 4,
          safetyFlags: {
            noRawMime: true,
            noObjectKey: true,
            noProviderPayload: true,
            noMailboxSecret: true,
            noDocumentPromotion: true,
            noMatterCreation: true,
          },
        },
      ],
    });
    expect(response.json().jobs[0].ageSeconds).toEqual(expect.any(Number));
    expect(response.json().jobs[1].ageSeconds).toEqual(expect.any(Number));
    expect(response.body).not.toContain("targetResourceId");
    expect(response.body).not.toContain("synthetic-token-hash");
    expect(response.body).not.toContain("synthetic-imap-resource");
    expect(response.body).not.toContain("bullJobId");
    expect(response.body).not.toContain("bull-private-parser-job");
    expect(response.body).not.toContain("idempotencyKey");
    expect(response.body).not.toContain("rawStorageKey");
    expect(response.body).not.toContain("objectKey");
    expect(response.body).not.toContain("private-message.eml");
    expect(response.body).not.toContain("private-object.eml");
    expect(response.body).not.toContain("Synthetic provider payload");
    expect(response.body).not.toContain("Synthetic IMAP payload");
    expect(response.body).not.toContain("synthetic-mailbox");
    expect(response.body).not.toContain("raw MIME body details");
    expect(response.body).not.toContain("uidValidity");
    expect(response.body).not.toContain("rawContentSha256");
    expect(response.body).not.toContain("c".repeat(64));
    expect(inboundQueue.jobs).toHaveLength(0);
    await expect(
      repository.listJobLifecycleRecords(firmId, { queueName: "inbound_email" }),
    ).resolves.toEqual(beforeJobs);
  });

  it.each(["auditor", "licensee", "firm_member", "client_external"] as const)(
    "denies %s access to inbound parser replay inventory",
    async (role) => {
      const repository = new InMemoryOpenPracticeRepository();
      await repository.createJobLifecycleRecord(parserJob());

      const response = await testServer(repository, user(role, ["matter-001"])).inject({
        method: "GET",
        url: "/api/inbound-email/parser-jobs/replay-inventory",
      });

      expect(response.statusCode).toBe(403);
    },
  );

  it("marks failed inbound parser jobs for metadata-only replay review", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord(
      parserJob({
        metadata: {
          ...parserJob().metadata,
          providerFailureStage: "parser_enqueue",
          rawStorageKey: "inbound-email/firm-west-legal/raw/private-message.eml",
          providerPayload: { private: "Synthetic provider payload" },
          mailboxPassword: "synthetic-mailbox-password",
        },
      }),
    );
    const inboundQueue = fakeInboundEmailQueue();

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      null,
      inboundQueue.queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/replay-request",
      payload: {
        confirmation: {
          confirmed: true,
          action: "request_replay",
          jobId: "job-inbound-parser-failed",
          expectedStatus: "failed",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "replay_requested",
      job: {
        id: "job-inbound-parser-failed",
        queueName: "inbound_email",
        jobName: "parse_inbound_email",
        status: "failed",
        metadata: {
          ...inboundParserRecoveryMetadata,
          provider: "mailgun",
          source: "mailgun.raw_mime_webhook",
          resourceType: "inbound_email_raw",
          resourceId: "synthetic-token-hash",
          providerFailureStage: "parser_enqueue",
          rawStorageKeyPresent: true,
          reviewOnly: true,
          redactedAuthorizedProjection: true,
          requestType: "inbound_email_parser_safe_replay",
          reviewState: "replay_requested",
        },
      },
    });
    expect(inboundQueue.jobs).toHaveLength(0);
    expect(response.body).not.toMatch(/"rawStorageKey"\s*:/);
    expect(response.body).not.toContain("private-message.eml");
    expect(response.body).not.toContain("Synthetic provider payload");
    expect(response.body).not.toContain("synthetic-mailbox-password");
    expect(response.body).not.toContain("raw MIME body details");

    const [storedJob] = await repository.listJobLifecycleRecords(firmId, {
      queueName: "inbound_email",
    });
    expect(storedJob).toMatchObject({
      status: "failed",
      metadata: expect.objectContaining({
        ...inboundParserRecoveryMetadata,
        providerFailureStage: "parser_enqueue",
        reviewOnly: true,
        redactedAuthorizedProjection: true,
        requestType: "inbound_email_parser_safe_replay",
        reviewState: "replay_requested",
      }),
    });
    expect(storedJob?.metadata).not.toHaveProperty("rawStorageKey");
    expect(storedJob?.metadata).not.toHaveProperty("providerPayload");
    expect(storedJob?.metadata).not.toHaveProperty("mailboxPassword");
    expect(JSON.stringify(storedJob?.metadata)).not.toContain(".eml");

    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events.at(-1)).toMatchObject({
      action: "inbound_email.parser_job.replay_requested",
      resourceType: "inbound_email",
      resourceId: "job-inbound-parser-failed",
      metadata: {
        jobId: "job-inbound-parser-failed",
        queueName: "inbound_email",
        jobName: "parse_inbound_email",
        expectedStatus: "failed",
        currentStatus: "failed",
        provider: "mailgun",
        source: "mailgun.raw_mime_webhook",
        idempotencyKeyPresent: true,
        reviewOnly: true,
        requestType: "inbound_email_parser_safe_replay",
        reviewState: "replay_requested",
        redactedAuthorizedProjection: true,
      },
    });
    expect(JSON.stringify(audit.events.at(-1))).not.toContain("rawStorageKey");
    expect(JSON.stringify(audit.events.at(-1))).not.toContain(".eml");
  });

  it("marks dead-letter inbound parser jobs for replay review without queue or storage config", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord(parserJob({ status: "dead_letter" }));

    const response = await testServer(repository, user("owner_admin"), undefined, null).inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/replay-request",
      payload: {
        confirmation: {
          confirmed: true,
          action: "request_replay",
          jobId: "job-inbound-parser-failed",
          expectedStatus: "dead_letter",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "replay_requested",
      job: {
        id: "job-inbound-parser-failed",
        status: "dead_letter",
        metadata: {
          reviewOnly: true,
          requestType: "inbound_email_parser_safe_replay",
          reviewState: "replay_requested",
        },
      },
    });
    expect(response.body).not.toMatch(/"rawStorageKey"\s*:/);
  });

  it("rejects inbound parser replay request mismatches and non-parser jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord(parserJob({ status: "failed" }));
    await repository.createJobLifecycleRecord({
      ...parserJob({
        id: "job-email-failed",
      }),
      queueName: "email",
      jobName: "send_email",
      targetResourceType: "email",
      targetResourceId: "email-001",
    });
    const server = testServer(repository);
    const payload = {
      confirmation: {
        confirmed: true,
        action: "request_replay",
        jobId: "job-inbound-parser-failed",
        expectedStatus: "failed",
      },
    };

    const mismatch = await server.inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/replay-request",
      payload: {
        confirmation: {
          ...payload.confirmation,
          expectedStatus: "dead_letter",
        },
      },
    });
    const nonParser = await server.inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-email-failed/replay-request",
      payload: {
        confirmation: {
          ...payload.confirmation,
          jobId: "job-email-failed",
        },
      },
    });
    const staff = await testServer(
      repository,
      user("licensee", ["matter-001", "matter-002"]),
    ).inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/replay-request",
      payload,
    });

    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json()).toMatchObject({
      code: "INBOUND_EMAIL_PARSER_JOB_CONFIRMATION_MISMATCH",
    });
    expect(nonParser.statusCode).toBe(404);
    expect(nonParser.json()).toMatchObject({ code: "INBOUND_EMAIL_PARSER_JOB_NOT_FOUND" });
    expect(staff.statusCode).toBe(403);
  });

  it("manually dead-letters failed or stalled inbound parser jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord(parserJob());
    await repository.createJobLifecycleRecord(
      parserJob({
        id: "job-inbound-parser-stalled-queued",
        status: "queued",
        queuedAt: "2026-04-29T08:00:00.000Z",
        failedAt: undefined,
      }),
    );
    await repository.createJobLifecycleRecord(
      parserJob({
        id: "job-inbound-parser-stalled-active",
        status: "active",
        queuedAt: "2026-04-29T08:00:00.000Z",
        startedAt: "2026-04-29T08:01:00.000Z",
        failedAt: undefined,
      }),
    );
    const server = testServer(repository);

    const failed = await server.inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-failed/dead-letter",
      payload: {
        confirmation: {
          confirmed: true,
          action: "dead_letter",
          jobId: "job-inbound-parser-failed",
          expectedStatus: "failed",
        },
      },
    });
    const stalled = await server.inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-stalled-queued/dead-letter",
      payload: {
        confirmation: {
          confirmed: true,
          action: "dead_letter",
          jobId: "job-inbound-parser-stalled-queued",
          expectedStatus: "queued",
        },
      },
    });
    const active = await server.inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-stalled-active/dead-letter",
      payload: {
        confirmation: {
          confirmed: true,
          action: "dead_letter",
          jobId: "job-inbound-parser-stalled-active",
          expectedStatus: "active",
        },
      },
    });

    expect(failed.statusCode).toBe(200);
    expect(failed.json()).toMatchObject({
      status: "dead_lettered",
      job: {
        id: "job-inbound-parser-failed",
        status: "dead_letter",
        terminal: true,
        failed: true,
      },
    });
    expect(stalled.statusCode).toBe(200);
    expect(stalled.json()).toMatchObject({
      status: "dead_lettered",
      job: { id: "job-inbound-parser-stalled-queued", status: "dead_letter" },
    });
    expect(active.statusCode).toBe(200);
    expect(active.json()).toMatchObject({
      status: "dead_lettered",
      job: { id: "job-inbound-parser-stalled-active", status: "dead_letter" },
    });
    expect(failed.body).not.toMatch(/"rawStorageKey"\s*:/);
    expect(stalled.body).not.toContain("message.eml");
    expect(active.body).not.toContain("message.eml");
    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events.map((event) => event.action)).toEqual(
      expect.arrayContaining(["inbound_email.parser_job.manual_dead_letter"]),
    );
    expect(JSON.stringify(audit.events)).not.toContain("rawStorageKey");
  });

  it("blocks manual dead-letter for fresh queued inbound parser jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord(
      parserJob({
        id: "job-inbound-parser-fresh-queued",
        status: "queued",
        queuedAt: new Date().toISOString(),
        failedAt: undefined,
      }),
    );

    const response = await testServer(repository).inject({
      method: "POST",
      url: "/api/inbound-email/parser-jobs/job-inbound-parser-fresh-queued/dead-letter",
      payload: {
        confirmation: {
          confirmed: true,
          action: "dead_letter",
          jobId: "job-inbound-parser-fresh-queued",
          expectedStatus: "queued",
        },
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "INBOUND_EMAIL_PARSER_JOB_NOT_STALLED",
    });
  });

  it("reports inbound email disabled when no provider is configured", async () => {
    const response = await testServer(new InMemoryOpenPracticeRepository()).inject({
      method: "GET",
      url: "/api/inbound-email/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "disabled",
      reason: "not_configured",
      addresses: [],
    });
  });

  it("returns configured inbound addresses without provider secrets", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-inbound-default",
      firmId,
      kind: "inbound_email",
      key: "mailgun",
      enabled: true,
      encryptedConfig: "sealed:provider-secret",
      createdAt: now,
      updatedAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-001",
      firmId,
      address: "matter-001@open-practice.test",
      matterId: "matter-001",
      enabled: true,
      createdAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-disabled",
      firmId,
      address: "archive@open-practice.test",
      enabled: false,
      createdAt: now,
    });

    const response = await testServer(repository).inject({
      method: "GET",
      url: "/api/inbound-email/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "configured",
      provider: "mailgun",
      addresses: [
        {
          id: "inbound-address-001",
          address: "matter-001@open-practice.test",
          matterId: "matter-001",
          enabled: true,
          createdAt: now,
        },
        {
          id: "inbound-address-disabled",
          address: "archive@open-practice.test",
          enabled: false,
          createdAt: now,
        },
      ],
    });
    expect(JSON.stringify(response.json())).not.toContain("sealed:provider-secret");
  });

  it("updates and returns redacted IMAP settings without leaking passwords", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { queue, jobs } = fakeInboundEmailQueue();

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      fakeS3(),
      queue,
    ).inject({
      method: "PUT",
      url: "/api/inbound-email/settings/imap",
      payload: {
        enabled: true,
        host: "imap.example.test",
        port: 993,
        secure: true,
        username: "inbox@example.test",
        password: "imap-secret",
        mailbox: "INBOX",
        pollIntervalSeconds: 300,
        markSeen: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      settings: {
        enabled: true,
        host: "imap.example.test",
        port: 993,
        username: "inbox@example.test",
        mailbox: "INBOX",
        passwordConfigured: true,
        configValid: true,
      },
      poll: {
        status: "queued",
        job: {
          queueName: "inbound_email",
          jobName: IMAP_POLL_JOB_NAME,
          status: "queued",
        },
      },
    });
    expect(response.body).not.toContain("imap-secret");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      name: IMAP_POLL_JOB_NAME,
      data: {
        firmId,
        resourceType: "provider_setting",
        resourceId: IMAP_INBOUND_PROVIDER_KEY,
        metadata: expect.objectContaining(inboundPollRecoveryMetadata),
      },
    });

    const getResponse = await testServer(repository).inject({
      method: "GET",
      url: "/api/inbound-email/settings/imap",
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body).not.toContain("imap-secret");
    expect(getResponse.json().settings.passwordConfigured).toBe(true);
  });

  it("rejects IMAP settings for unsafe provider egress hosts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { queue, jobs } = fakeInboundEmailQueue();

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      fakeS3(),
      queue,
    ).inject({
      method: "PUT",
      url: "/api/inbound-email/settings/imap",
      payload: {
        enabled: true,
        host: "localhost",
        port: 993,
        secure: true,
        username: "inbox@example.test",
        password: "imap-secret",
        mailbox: "INBOX",
        pollIntervalSeconds: 300,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "IMAP_SETTINGS_EGRESS_DENIED",
    });
    expect(jobs).toHaveLength(0);
    await expect(
      repository.listProviderSettings(firmId, { kind: "inbound_email" }),
    ).resolves.toHaveLength(0);
  });

  it("rejects IMAP settings when DNS resolves to unsafe infrastructure", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { queue, jobs } = fakeInboundEmailQueue();

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      fakeS3(),
      queue,
      async () => ["169.254.169.254"],
    ).inject({
      method: "PUT",
      url: "/api/inbound-email/settings/imap",
      payload: {
        enabled: true,
        host: "imap.example.test",
        port: 993,
        secure: true,
        username: "inbox@example.test",
        password: "imap-secret",
        mailbox: "INBOX",
        pollIntervalSeconds: 300,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "IMAP_SETTINGS_EGRESS_DENIED",
    });
    expect(jobs).toHaveLength(0);
    await expect(
      repository.listProviderSettings(firmId, { kind: "inbound_email" }),
    ).resolves.toHaveLength(0);
  });

  it("preserves the IMAP password when settings are updated without a replacement", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-inbound-email-imap",
      firmId,
      kind: "inbound_email",
      key: IMAP_INBOUND_PROVIDER_KEY,
      enabled: true,
      encryptedConfig: serializeImapProviderConfig({
        version: 1,
        host: "imap.old.example.test",
        port: 993,
        secure: true,
        username: "inbox@example.test",
        password: "imap-secret",
        mailbox: "INBOX",
        pollIntervalSeconds: 300,
        markSeen: false,
        state: { uidValidity: 7, lastSuccessfullyQueuedUid: 10 },
      }),
      createdAt: now,
      updatedAt: now,
    });
    const { queue } = fakeInboundEmailQueue();

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      fakeS3(),
      queue,
    ).inject({
      method: "PUT",
      url: "/api/inbound-email/settings/imap",
      payload: {
        enabled: true,
        host: "imap.new.example.test",
        port: 143,
        secure: false,
        username: "inbox@example.test",
        mailbox: "All Mail",
        pollIntervalSeconds: 600,
        markSeen: true,
      },
    });

    expect(response.statusCode).toBe(200);
    const provider = (
      await repository.listProviderSettings(firmId, { kind: "inbound_email" })
    ).find((candidate) => candidate.key === IMAP_INBOUND_PROVIDER_KEY);
    expect(JSON.parse(provider!.encryptedConfig)).toMatchObject({
      host: "imap.new.example.test",
      port: 143,
      password: "imap-secret",
      state: { uidValidity: 7, lastSuccessfullyQueuedUid: 10 },
    });
    expect(response.body).not.toContain("imap-secret");
  });

  it("enqueues a manual IMAP poll without returning raw config", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-inbound-email-imap",
      firmId,
      kind: "inbound_email",
      key: IMAP_INBOUND_PROVIDER_KEY,
      enabled: true,
      encryptedConfig: serializeImapProviderConfig({
        version: 1,
        host: "imap.example.test",
        port: 993,
        secure: true,
        username: "inbox@example.test",
        password: "imap-secret",
        mailbox: "INBOX",
        pollIntervalSeconds: 300,
        markSeen: false,
        state: {},
      }),
      createdAt: now,
      updatedAt: now,
    });
    const { queue, jobs } = fakeInboundEmailQueue();

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      fakeS3(),
      queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/settings/imap/poll",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("imap-secret");
    expect(response.json()).toMatchObject({
      poll: { status: "queued", job: { jobName: IMAP_POLL_JOB_NAME } },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      name: IMAP_POLL_JOB_NAME,
      data: {
        metadata: expect.objectContaining(inboundPollRecoveryMetadata),
      },
    });
  });

  it("marks failed manual IMAP poll enqueue jobs with owner-reviewed recovery metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-inbound-email-imap",
      firmId,
      kind: "inbound_email",
      key: IMAP_INBOUND_PROVIDER_KEY,
      enabled: true,
      encryptedConfig: serializeImapProviderConfig({
        version: 1,
        host: "imap.example.test",
        port: 993,
        secure: true,
        username: "inbox@example.test",
        password: "imap-secret",
        mailbox: "INBOX",
        pollIntervalSeconds: 300,
        markSeen: false,
        state: {},
      }),
      createdAt: now,
      updatedAt: now,
    });

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
      undefined,
      fakeS3(),
      fakeInboundEmailQueue({ reject: true }).queue,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/settings/imap/poll",
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("imap-secret");
    const [job] = await repository.listJobLifecycleRecords(firmId, {
      queueName: "inbound_email",
    });
    expect(job).toMatchObject({
      jobName: IMAP_POLL_JOB_NAME,
      status: "failed",
      attemptsMade: 1,
      metadata: {
        ...inboundPollRecoveryMetadata,
        enqueueStatus: "failed",
        providerFailureStage: "imap_poll_enqueue",
      },
    });
  });

  it("filters inbound address status for matter-scoped users", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-inbound-default",
      firmId,
      kind: "inbound_email",
      key: "mailgun",
      enabled: true,
      encryptedConfig: "sealed:provider-secret",
      createdAt: now,
      updatedAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-001",
      firmId,
      address: "matter-001@open-practice.test",
      matterId: "matter-001",
      enabled: true,
      createdAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-002",
      firmId,
      address: "matter-002@open-practice.test",
      matterId: "matter-002",
      enabled: true,
      createdAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-general",
      firmId,
      address: "general@open-practice.test",
      enabled: true,
      createdAt: now,
    });

    const response = await testServer(repository, user("firm_member", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "configured",
      addresses: [
        {
          id: "inbound-address-001",
          address: "matter-001@open-practice.test",
          matterId: "matter-001",
        },
      ],
    });
    expect(response.json()).not.toHaveProperty("provider");
    expect(JSON.stringify(response.json())).not.toContain("matter-002@open-practice.test");
    expect(JSON.stringify(response.json())).not.toContain("general@open-practice.test");
  });

  it("denies direct inbound email status to client-external users", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-inbound-default",
      firmId,
      kind: "inbound_email",
      key: "mailgun",
      enabled: true,
      encryptedConfig: "sealed:provider-secret",
      createdAt: now,
      updatedAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-001",
      firmId,
      address: "matter-001@open-practice.test",
      matterId: "matter-001",
      enabled: true,
      createdAt: now,
    });

    const response = await testServer(repository, user("client_external", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/status",
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.stringify(response.json())).not.toContain("mailgun");
    expect(JSON.stringify(response.json())).not.toContain("matter-001@open-practice.test");
  });

  it("returns one parsed message with only that message's inbound attachments", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(
      message({ parsedHtmlStorageKey: "inbound/message-001/body.html" }),
    );
    await repository.createInboundEmailMessage(message({ id: "inbound-message-002" }));
    await repository.createInboundEmailAttachment(attachment());
    await repository.createInboundEmailAttachment(
      attachment({
        id: "inbound-attachment-other",
        inboundMessageId: "inbound-message-002",
        filename: "other.pdf",
        storageKey: "inbound/message-002/other.pdf",
      }),
    );

    const server = testServer(repository, user("licensee", ["matter-001"]));
    const response = await server.inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    const list = await server.inject({
      method: "GET",
      url: "/api/inbound-email/messages?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "available",
      message: {
        id: "inbound-message-001",
        matterId: "matter-001",
        parsedText: "Please review.",
      },
      attachments: [
        {
          id: "inbound-attachment-001",
          inboundMessageId: "inbound-message-001",
          filename: "filing.pdf",
          checksumSha256: "a".repeat(64),
        },
      ],
    });
    expect(response.json().attachments).toHaveLength(1);
    expect(response.json().attachments[0]).not.toHaveProperty("documentId");
    for (const body of [response.body, list.body]) {
      expect(body).not.toContain("rawStorageKey");
      expect(body).not.toContain("parsedHtmlStorageKey");
      expect(body).not.toContain("storageKey");
      expect(body).not.toContain("inbound/message-001/body.html");
      expect(body).not.toContain("inbound/message-001/filing.pdf");
    }
  });

  it("applies matter-scoped access to inbound email message lists", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());

    const allowed = await testServer(repository, user("billing_bookkeeper", ["matter-001"])).inject(
      {
        method: "GET",
        url: "/api/inbound-email/messages?matterId=matter-001",
      },
    );

    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({
      status: "available",
      messages: [expect.objectContaining({ id: "inbound-message-001" })],
    });

    const denied = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/messages?matterId=matter-002",
    });
    expect(denied.statusCode).toBe(403);
  });

  it("allows owner and auditor firm-wide inbound email review but requires matter scope for staff", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
      }),
    );

    const owner = await testServer(repository, user("owner_admin", [])).inject({
      method: "GET",
      url: "/api/inbound-email/messages",
    });
    expect(owner.statusCode).toBe(200);
    expect(owner.json().messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "inbound-message-001" }),
        expect.objectContaining({ id: "inbound-message-unscoped" }),
      ]),
    );

    const auditor = await testServer(repository, user("auditor", [])).inject({
      method: "GET",
      url: "/api/inbound-email/messages",
    });
    expect(auditor.statusCode).toBe(200);
    expect(auditor.json().messages).toHaveLength(2);

    const staff = await testServer(repository, user("firm_member", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/messages",
    });
    expect(staff.statusCode).toBe(403);
  });

  it("denies client-external users across direct inbound email APIs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());
    const client = user("client_external", ["matter-001"]);

    const list = await testServer(repository, client).inject({
      method: "GET",
      url: "/api/inbound-email/messages?matterId=matter-001",
    });
    expect(list.statusCode).toBe(403);

    const detail = await testServer(repository, client).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(detail.statusCode).toBe(403);

    const triage = await testServer(repository, client).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-001",
      payload: { status: "triaged" },
    });
    expect(triage.statusCode).toBe(403);

    const promote = await testServer(repository, client).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
      payload: { queueOcr: false },
    });
    expect(promote.statusCode).toBe(403);
  });

  it("creates a staff-confirmed matter draft from unscoped inbound email without creating a matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
        subject: "Sensitive subject should not drive the draft",
        parsedText: "Private client body must not enter draft metadata.",
        parsedHtmlStorageKey: "inbound/message-unscoped/body.html",
        metadata: {
          providerId: "provider-private-id",
          rawBody: "Private client body must not leak.",
        },
      }),
    );
    await repository.createInboundEmailAttachment(
      attachment({
        id: "inbound-attachment-draft",
        inboundMessageId: "inbound-message-unscoped",
        filename: "private-filing.pdf",
        storageKey: "inbound/message-unscoped/private-filing.pdf",
      }),
    );
    const beforeMatters = await repository.listMattersForUser(user("owner_admin", []));

    const response = await testServer(repository, user("owner_admin", [])).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-unscoped/matter-draft",
      payload: {
        redactedBodySummary: "Potential new residential tenancy intake; private details removed.",
        proposedMatter: {
          title: "Synthetic inbound tenancy intake",
          practiceArea: "Residential tenancy",
          jurisdiction: "BC",
          client: {
            kind: "person",
            displayName: "Ada Morgan",
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "drafted",
      message: {
        id: "inbound-message-unscoped",
        matterDraft: {
          status: "drafted",
          source: {
            inboundMessageId: "inbound-message-unscoped",
            providerMessageIdPresent: true,
            recipientCount: 1,
            subjectPresent: true,
            senderSummary: "redacted sender at example.test",
            attachmentCount: 1,
          },
          redactedBodySummary: "Potential new residential tenancy intake; private details removed.",
          proposedMatter: {
            title: "Synthetic inbound tenancy intake",
            practiceArea: "Residential tenancy",
            jurisdiction: "BC",
            client: {
              kind: "person",
              displayName: "Ada Morgan",
            },
          },
          automaticMatterCreation: false,
          bodyRedacted: true,
          metadataRedacted: true,
          reviewCues: {
            duplicateCandidates: [
              {
                contactId: "contact-ada",
                displayName: "Ada Morgan",
                kind: "person",
                status: "active",
                matchedFields: ["name"],
                matchCount: 1,
                visibleSharedMatterCount: 1,
                severity: "review",
              },
            ],
            existingMatterCandidates: [
              {
                matterId: "matter-001",
                number: "2026-0001",
                title: "Morgan tenancy dispute",
                status: "open",
                practiceArea: "Residential tenancy",
                jurisdiction: "BC",
                matchReasons: expect.arrayContaining([
                  "jurisdiction",
                  "practice area",
                  "visible client name",
                ]),
              },
            ],
            checklist: expect.arrayContaining([
              expect.objectContaining({
                key: "source_attachment_review",
                label: "Attachment review",
                state: "review",
                count: 1,
                source: "draft",
              }),
              expect.objectContaining({
                key: "body_redaction",
                label: "Body redaction",
                state: "complete",
                source: "draft",
              }),
              expect.objectContaining({
                label: "Parties",
                source: "existing_matter",
                matterId: "matter-001",
              }),
            ]),
            boundary: {
              automaticMatterCreation: false,
              bodyRedacted: true,
              metadataRedacted: true,
              matterPermissionsExpanded: false,
            },
          },
        },
      },
    });
    const updated = await repository.getInboundEmailMessage(firmId, "inbound-message-unscoped");
    expect(updated?.metadata.matterDraft).toMatchObject({
      automaticMatterCreation: false,
      redactedBodySummary: "Potential new residential tenancy intake; private details removed.",
    });
    expect(await repository.listMattersForUser(user("owner_admin", []))).toHaveLength(
      beforeMatters.length,
    );

    for (const body of [response.body, JSON.stringify(updated?.metadata.matterDraft)]) {
      expect(body).not.toContain("Private client body");
      expect(body).not.toContain("rawStorageKey");
      expect(body).not.toContain("parsedHtmlStorageKey");
      expect(body).not.toContain("inbound/message-unscoped/body.html");
      expect(body).not.toContain("inbound/message-unscoped/private-filing.pdf");
      expect(body).not.toContain("provider-private-id");
      expect(body).not.toContain("matchedValue");
    }
    const audit = await repository.listAuditEvents(firmId);
    const event = audit.events.find(
      (candidate) => candidate.action === "inbound_email.matter_draft.confirmed",
    );
    expect(event).toMatchObject({
      resourceType: "inbound_email",
      resourceId: "inbound-message-unscoped",
      metadata: {
        sourceMessageId: "inbound-message-unscoped",
        providerMessageIdPresent: true,
        recipientCount: 1,
        attachmentCount: 1,
        subjectPresent: true,
        redactedSummaryLength: 66,
        proposedTitleLength: 32,
        proposedPracticeArea: "Residential tenancy",
        proposedJurisdiction: "BC",
        clientKind: "person",
        duplicateCandidateCount: 1,
        existingMatterCandidateCount: 1,
        checklistCueCount: 10,
        automaticMatterCreation: false,
        matterPermissionsExpanded: false,
      },
    });
    expect(JSON.stringify(event?.metadata)).not.toContain("Ada Morgan");
    expect(JSON.stringify(event?.metadata)).not.toContain("Private client body");
  });

  it("denies inbound matter drafts without unscoped update and matter-create access", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
      }),
    );
    const payload = {
      redactedBodySummary: "Synthetic redacted summary.",
      proposedMatter: {
        title: "Synthetic inbound intake",
        practiceArea: "Residential tenancy",
        jurisdiction: "BC",
        client: {
          kind: "person",
          displayName: "Synthetic Client",
        },
      },
    };

    for (const role of ["auditor", "client_external", "firm_member", "licensee"] as const) {
      const denied = await testServer(repository, user(role, [])).inject({
        method: "POST",
        url: "/api/inbound-email/messages/inbound-message-unscoped/matter-draft",
        payload,
      });
      expect(denied.statusCode).toBe(403);
    }
  });

  it("rejects matter drafts for already matter-scoped inbound email", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());

    const response = await testServer(repository, user("owner_admin", [])).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/matter-draft",
      payload: {
        redactedBodySummary: "Synthetic redacted summary.",
        proposedMatter: {
          title: "Synthetic inbound intake",
          practiceArea: "Residential tenancy",
          jurisdiction: "BC",
          client: {
            kind: "person",
            displayName: "Synthetic Client",
          },
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      message: "Matter draft requires an unscoped inbound email",
    });
  });

  it("denies matter-scoped staff claiming a known unscoped inbound email into their matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
      }),
    );

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-unscoped",
      payload: {
        matterId: "matter-001",
        status: "triaged",
      },
    });

    expect(response.statusCode).toBe(403);
    await expect(
      repository.getInboundEmailMessage(firmId, "inbound-message-unscoped"),
    ).resolves.toMatchObject({ matterId: undefined, status: "triage_pending" });
  });

  it("allows owner/admin staff to triage-route unscoped inbound email to an accessible matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
        metadata: { staffTriage: { note: "Private note must not persist" } },
      }),
    );

    const response = await testServer(repository).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-unscoped",
      payload: {
        matterId: "matter-001",
        status: "triaged",
        labels: ["client", "routed"],
        staffTriage: {
          status: "routed",
          assignedToUserId: "user-staff",
          contactIds: ["contact-ada"],
          privateNote: "Internal call-back context stays staff-only.",
          followUp: {
            channel: "phone",
            consentStatus: "consented",
            dueAt: "2026-04-30T18:00:00.000Z",
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "updated",
      message: {
        id: "inbound-message-unscoped",
        matterId: "matter-001",
        status: "triaged",
        labels: ["client", "routed"],
        staffTriage: {
          status: "routed",
          assignedToUserId: "user-staff",
          contactIds: ["contact-ada"],
          privateNoteCount: 1,
          latestPrivateNoteAt: expect.any(String),
          followUp: {
            channel: "phone",
            consentStatus: "consented",
            dueAt: "2026-04-30T18:00:00.000Z",
          },
          updatedByUserId: "user-admin",
        },
      },
    });
    const updated = await repository.getInboundEmailMessage(firmId, "inbound-message-unscoped");
    expect(updated?.metadata.staffTriage).not.toHaveProperty("note");
    expect(updated?.metadata.staffTriage).toMatchObject({
      privateNotes: [
        expect.objectContaining({
          authorUserId: "user-admin",
          text: "Internal call-back context stays staff-only.",
        }),
      ],
      followUp: {
        channel: "phone",
        consentStatus: "consented",
        dueAt: "2026-04-30T18:00:00.000Z",
      },
    });
    expect(JSON.stringify(response.json())).not.toContain("Internal call-back context");

    const secondResponse = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-unscoped",
      payload: {
        staffTriage: {
          privateNote: "Second internal-only context.",
          followUp: { dueAt: "2026-05-01T18:00:00.000Z" },
        },
      },
    });
    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.json()).toMatchObject({
      message: {
        staffTriage: {
          status: "routed",
          assignedToUserId: "user-staff",
          contactIds: ["contact-ada"],
          privateNoteCount: 2,
          followUp: {
            channel: "phone",
            consentStatus: "consented",
            dueAt: "2026-05-01T18:00:00.000Z",
          },
          updatedByUserId: "user-licensee",
        },
      },
    });
    expect(JSON.stringify(secondResponse.json())).not.toContain("Second internal-only context");
    const listResponse = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/messages?matterId=matter-001",
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      messages: [
        expect.objectContaining({
          id: "inbound-message-unscoped",
          metadata: {
            staffTriage: expect.objectContaining({
              privateNoteCount: 2,
              latestPrivateNoteAt: expect.any(String),
            }),
          },
        }),
      ],
    });
    expect(JSON.stringify(listResponse.json())).not.toContain("Internal call-back context");
    expect(JSON.stringify(listResponse.json())).not.toContain("Second internal-only context");

    const detailResponse = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-unscoped",
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      message: {
        id: "inbound-message-unscoped",
        metadata: {
          staffTriage: expect.objectContaining({
            privateNoteCount: 2,
            latestPrivateNoteAt: expect.any(String),
          }),
        },
      },
    });
    expect(JSON.stringify(detailResponse.json())).not.toContain("Internal call-back context");
    expect(JSON.stringify(detailResponse.json())).not.toContain("Second internal-only context");
    const secondUpdated = await repository.getInboundEmailMessage(
      firmId,
      "inbound-message-unscoped",
    );
    expect(secondUpdated?.metadata.staffTriage).toMatchObject({
      privateNotes: [
        expect.objectContaining({ text: "Internal call-back context stays staff-only." }),
        expect.objectContaining({ text: "Second internal-only context." }),
      ],
    });

    const audit = await repository.listAuditEvents(firmId);
    const triageAudit = audit.events
      .filter((event) => event.action === "inbound_email.triage_updated")
      .at(-1);
    expect(triageAudit?.metadata).toMatchObject({
      matterId: "matter-001",
      status: "triaged",
      labelCount: 2,
      staffTriageStatus: "routed",
      privateNoteAdded: true,
      privateNoteCount: 2,
      followUpChannel: "phone",
      followUpConsentStatus: "consented",
      followUpDueAt: "2026-05-01T18:00:00.000Z",
    });
    expect(JSON.stringify(triageAudit?.metadata)).not.toContain("Private note");
    expect(JSON.stringify(triageAudit?.metadata)).not.toContain("Internal call-back context");
    expect(JSON.stringify(triageAudit?.metadata)).not.toContain("Second internal-only context");
  });

  it("denies auditor triage mutation", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());

    const response = await testServer(repository, user("auditor", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-001",
      payload: { status: "triaged" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("caps stored private triage notes to the latest 25 entries", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(
      message({
        metadata: {
          staffTriage: {
            status: "needs_review",
            privateNotes: Array.from({ length: 25 }, (_, index) => ({
              authorUserId: "user-staff",
              createdAt: `2026-04-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
              text: `Existing private note ${index + 1}`,
            })),
          },
        },
      }),
    );

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-001",
      payload: {
        staffTriage: { privateNote: "Newest private note." },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: {
        staffTriage: {
          status: "needs_review",
          privateNoteCount: 25,
          latestPrivateNoteAt: expect.any(String),
        },
      },
    });
    const updated = await repository.getInboundEmailMessage(firmId, "inbound-message-001");
    const privateNotes = (
      updated?.metadata.staffTriage as { privateNotes?: Array<{ text: string }> } | undefined
    )?.privateNotes;
    expect(privateNotes).toHaveLength(25);
    expect(privateNotes?.[0]?.text).toBe("Existing private note 2");
    expect(privateNotes?.at(-1)?.text).toBe("Newest private note.");
    expect(JSON.stringify(response.json())).not.toContain("Newest private note.");
  });

  it("rejects cross-matter triage routing for already scoped inbound email", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message({ matterId: "matter-001" }));

    const response = await testServer(
      repository,
      user("owner_admin", ["matter-001", "matter-002"]),
    ).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-001",
      payload: { matterId: "matter-002" },
    });

    expect(response.statusCode).toBe(403);
    await expect(
      repository.getInboundEmailMessage(firmId, "inbound-message-001"),
    ).resolves.toMatchObject({ matterId: "matter-001" });
  });

  it("rejects unknown staff triage fields", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message({ status: "triage_pending" }));

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-001",
      payload: {
        status: "triaged",
        staffTriage: { note: "Unsafe private note" },
      },
    });

    expect(response.statusCode).toBe(400);
    await expect(
      repository.getInboundEmailMessage(firmId, "inbound-message-001"),
    ).resolves.toMatchObject({ status: "triage_pending" });
  });

  it("rejects triage contacts and assignees that are outside the target matter", async () => {
    const repository = new InMemoryOpenPracticeRepository({
      users: [
        ...sampleUsers,
        {
          id: "user-other-matter",
          firmId,
          displayName: "Other Matter Staff",
          email: "other@example.test",
          role: "firm_member",
          assignedMatterIds: ["matter-002"],
          mfaEnabled: true,
        },
      ],
    });
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
      }),
    );

    const badContact = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-unscoped",
      payload: {
        matterId: "matter-001",
        staffTriage: { contactIds: ["contact-northstar"] },
      },
    });
    expect(badContact.statusCode).toBe(403);

    const badAssignee = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-unscoped",
      payload: {
        matterId: "matter-001",
        staffTriage: { assignedToUserId: "user-other-matter" },
      },
    });
    expect(badAssignee.statusCode).toBe(403);

    const unscopedNote = await testServer(repository).inject({
      method: "PATCH",
      url: "/api/communications/inbox/inbound-email/inbound-message-unscoped",
      payload: {
        staffTriage: { privateNote: "Unscoped staff note should not attach" },
      },
    });
    expect(unscopedNote.statusCode).toBe(400);
  });

  it("promotes a matter-scoped attachment to a document", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
      payload: {
        title: "Filed materials.pdf",
        classification: "work_product",
        legalHold: true,
        language: "eng",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload).toMatchObject({
      status: "promoted",
      created: true,
      inboundMessageId: "inbound-message-001",
      attachment: {
        id: "inbound-attachment-001",
        documentId: expect.any(String),
      },
      document: {
        title: "Filed materials.pdf",
        matterId: "matter-001",
        checksumSha256: "a".repeat(64),
        classification: "work_product",
        legalHold: true,
        uploadStatus: "verified",
        checksumStatus: "verified",
        scanStatus: "queued",
      },
    });
    expect(payload.document.id).toBe(payload.attachment.documentId);
    expect(payload).not.toHaveProperty("queuedOcr");
    expect(payload.document).not.toHaveProperty("storageKey");
    expect(payload.attachment).not.toHaveProperty("storageKey");
    expect(JSON.stringify(payload)).not.toContain("inbound/message-001/filing.pdf");

    const detail = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(detail.json().attachments[0]).toMatchObject({ documentId: payload.document.id });
    expect(detail.body).not.toContain("storageKey");

    const audit = await repository.listAuditEvents(firmId);
    const promotionAudit = audit.events.find(
      (event) => event.action === "inbound_email.attachment.promoted_to_document",
    );
    expect(promotionAudit?.metadata).toMatchObject({
      matterId: "matter-001",
      inboundMessageId: "inbound-message-001",
      attachmentId: "inbound-attachment-001",
      documentId: payload.document.id,
      created: true,
      promotionStatus: "promoted",
      documentUploadStatus: "verified",
      checksumStatus: "verified",
      scanStatus: "queued",
    });
    const auditMetadata = JSON.stringify(promotionAudit?.metadata);
    expect(auditMetadata).not.toContain("Please review");
    expect(auditMetadata).not.toContain("inbound/message-001/filing.pdf");
    expect(auditMetadata).not.toContain("a".repeat(64));
  });

  it("returns the existing promoted document without duplicating it", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());
    const server = testServer(repository);

    const first = await server.inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
      payload: { queueOcr: false },
    });
    const second = await server.inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
      payload: { queueOcr: false },
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ created: true });
    expect(second.json()).toMatchObject({
      created: false,
      document: { id: first.json().document.id },
      attachment: { documentId: first.json().document.id },
    });
  });

  it("rejects explicit OCR queueing before inbound attachments pass scanning", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());

    const response = await testServer(repository).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
      payload: { queueOcr: true },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message: "Inbound email attachments must pass document scanning before OCR can be queued",
    });
    const detail = await testServer(repository).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(detail.json().attachments[0]).not.toHaveProperty("documentId");
  });

  it("promotes without OCR when no OCR provider is enabled", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());
    const { queue, jobs } = fakeOcrQueue();

    const response = await testServer(repository, user("licensee", ["matter-001"]), queue).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).not.toHaveProperty("queuedOcr");
    expect(jobs).toEqual([]);
    const detail = await testServer(repository).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(detail.json().attachments[0]).toMatchObject({
      documentId: response.json().document.id,
    });
    await expect(repository.listJobLifecycleRecords(firmId, { queueName: "ocr" })).resolves.toEqual(
      [],
    );
  });

  it("promotes without OCR when document storage is unavailable", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());
    await enableOcrProvider(repository);
    const { queue, jobs } = fakeOcrQueue();

    const response = await testServer(
      repository,
      user("licensee", ["matter-001"]),
      queue,
      null,
    ).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).not.toHaveProperty("queuedOcr");
    expect(jobs).toEqual([]);
    const detail = await testServer(repository).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(detail.json().attachments[0]).toMatchObject({
      documentId: response.json().document.id,
    });
    await expect(repository.listJobLifecycleRecords(firmId, { queueName: "ocr" })).resolves.toEqual(
      [],
    );
  });

  it("returns 409 for unscoped messages and attachments without checksums", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
      }),
    );
    await repository.createInboundEmailAttachment(
      attachment({ inboundMessageId: "inbound-message-unscoped" }),
    );

    const unscoped = await testServer(repository).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-unscoped/attachments/inbound-attachment-001/promote-document",
    });
    expect(unscoped.statusCode).toBe(409);
    expect(unscoped.json()).toMatchObject({
      message: "Inbound email message must be matter-scoped before promotion",
    });

    await repository.createInboundEmailMessage(message({ id: "inbound-message-no-checksum" }));
    await repository.createInboundEmailAttachment(
      attachment({
        id: "inbound-attachment-no-checksum",
        inboundMessageId: "inbound-message-no-checksum",
        checksumSha256: undefined,
      }),
    );
    const missingChecksum = await testServer(repository).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-no-checksum/attachments/inbound-attachment-no-checksum/promote-document",
    });
    expect(missingChecksum.statusCode).toBe(409);
    expect(missingChecksum.json()).toMatchObject({
      message: "Inbound email attachment checksum is required for document promotion",
    });
  });

  it("requires the attachment to belong to the message and both promotion permissions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailMessage(message({ id: "inbound-message-002" }));
    await repository.createInboundEmailAttachment(
      attachment({
        id: "inbound-attachment-other",
        inboundMessageId: "inbound-message-002",
      }),
    );

    const wrongMessage = await testServer(repository).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-other/promote-document",
    });
    expect(wrongMessage.statusCode).toBe(404);

    await repository.createInboundEmailAttachment(attachment());
    const auditorDenied = await testServer(repository, user("auditor", [])).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
    });
    expect(auditorDenied.statusCode).toBe(403);
  });

  it("denies assigned users outside their matter and for unscoped messages", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message({ matterId: "matter-002" }));
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
      }),
    );
    const server = testServer(repository, user("licensee", ["matter-001"]));

    const wrongMatter = await server.inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(wrongMatter.statusCode).toBe(403);

    const unscoped = await server.inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-unscoped",
    });
    expect(unscoped.statusCode).toBe(403);
  });

  it.each(["owner_admin", "auditor"] as const)(
    "lets %s read unscoped firm-review messages",
    async (role) => {
      const repository = new InMemoryOpenPracticeRepository();
      await repository.createInboundEmailMessage(
        message({
          id: "inbound-message-unscoped",
          matterId: undefined,
          addressId: undefined,
          status: "triage_pending",
        }),
      );

      const response = await testServer(repository, user(role, [])).inject({
        method: "GET",
        url: "/api/inbound-email/messages/inbound-message-unscoped",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: { id: "inbound-message-unscoped" },
        attachments: [],
      });
      expect(response.json().message).not.toHaveProperty("matterId");
    },
  );

  it("returns 404 for a missing firm-scoped inbound message", async () => {
    const response = await testServer(new InMemoryOpenPracticeRepository()).inject({
      method: "GET",
      url: "/api/inbound-email/messages/missing-message",
    });

    expect(response.statusCode).toBe(404);
  });
});
