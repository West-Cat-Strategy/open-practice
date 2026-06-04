import { PutObjectCommand } from "@aws-sdk/client-s3";
import Fastify, { type FastifyInstance } from "fastify";
import type { S3Client } from "@aws-sdk/client-s3";
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type {
  InboundEmailAttachmentRecord,
  InboundEmailMessageRecord,
  ProfessionalRole,
  User,
} from "@open-practice/domain";
import { sampleUsers } from "@open-practice/domain/sample-data";
import { registerInboundEmailRoutes } from "./inbound-email.js";
import type { ApiJobQueue } from "./types.js";

const firmId = "firm-west-legal";
const now = "2026-04-29T12:00:00.000Z";
const servers: FastifyInstance[] = [];
type TestS3Config = { client: S3Client; bucket: string; serverSideEncryption?: "AES256" };

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

function writableFakeS3(): { s3: TestS3Config; puts: PutObjectCommand[] } {
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
      serverSideEncryption: "AES256",
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
    key: "local-tesseract",
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

describe("inbound email routes", () => {
  it("accepts signed Mailgun raw MIME webhooks, stores the raw body, and queues parsing", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableMailgunProvider(repository);
    const { s3, puts } = writableFakeS3();
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
    expect(response.body).not.toContain("rawStorageKey");
    expect(response.body).not.toContain("Synthetic body");
    expect(response.body).not.toContain("synthetic-mailgun-signing-key");

    expect(puts).toHaveLength(1);
    const putInput = puts[0]!.input;
    expect(putInput).toMatchObject({
      Bucket: "open-practice-test-documents",
      ContentType: "message/rfc822",
      ServerSideEncryption: "AES256",
    });
    expect(putInput.Key).toMatch(/^inbound-email\/firm-west-legal\/raw\/mailgun\//);
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
        provider: "mailgun",
        source: "mailgun.raw_mime_webhook",
        rawStorageKey: putInput.Key,
      },
    });
  });

  it("accepts legacy plaintext Mailgun provider signing secrets", async () => {
    const repository = new InMemoryOpenPracticeRepository();
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
    const repository = new InMemoryOpenPracticeRepository();
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
    const repository = new InMemoryOpenPracticeRepository();
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
    const missingSecretRepository = new InMemoryOpenPracticeRepository();
    await enableMailgunProvider(missingSecretRepository, { domain: "mail.example.test" });
    const missingS3Repository = new InMemoryOpenPracticeRepository();
    await enableMailgunProvider(missingS3Repository);
    const missingQueueRepository = new InMemoryOpenPracticeRepository();
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
    const repository = new InMemoryOpenPracticeRepository();
    await enableMailgunProvider(repository);
    const { s3 } = writableFakeS3();
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
    expect(inboundQueue.jobs).toHaveLength(1);
    expect(
      await repository.listJobLifecycleRecords(firmId, { queueName: "inbound_email" }),
    ).toHaveLength(1);
  });

  it("marks Mailgun lifecycle jobs failed when the parser queue rejects enqueue", async () => {
    const repository = new InMemoryOpenPracticeRepository();
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
      metadata: expect.objectContaining({ enqueueStatus: "failed" }),
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
    await repository.createInboundEmailMessage(message());
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

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
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

  it("allows authorized staff to triage-route unscoped inbound email to an accessible matter", async () => {
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

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
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
          updatedByUserId: "user-licensee",
        },
      },
    });
    const updated = await repository.getInboundEmailMessage(firmId, "inbound-message-unscoped");
    expect(updated?.metadata.staffTriage).not.toHaveProperty("note");
    expect(updated?.metadata.staffTriage).toMatchObject({
      privateNotes: [
        expect.objectContaining({
          authorUserId: "user-licensee",
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
    await enableOcrProvider(repository);
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());
    const { queue, jobs } = fakeOcrQueue();

    const response = await testServer(repository, user("licensee", ["matter-001"]), queue).inject({
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
        storageKey: "inbound/message-001/filing.pdf",
        checksumSha256: "a".repeat(64),
        classification: "work_product",
        legalHold: true,
        uploadStatus: "verified",
        checksumStatus: "verified",
        scanStatus: "queued",
      },
      queuedOcr: {
        status: "queued",
        task: "ocr",
        language: "eng",
        documentId: expect.any(String),
        job: {
          queueName: "ocr",
          jobName: "extract_document_text",
          status: "queued",
          targetResourceType: "document",
          targetResourceId: expect.any(String),
        },
      },
    });
    expect(payload.document.id).toBe(payload.attachment.documentId);
    expect(payload.queuedOcr.documentId).toBe(payload.document.id);
    expect(payload.queuedOcr.job.targetResourceId).toBe(payload.document.id);
    expect(jobs).toEqual([
      expect.objectContaining({
        name: "extract_document_text",
        jobId: payload.queuedOcr.job.id,
        data: expect.objectContaining({
          firmId,
          resourceType: "document",
          resourceId: payload.document.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            documentId: payload.document.id,
            task: "ocr",
            language: "eng",
            checksumStatus: "verified",
            scanStatus: "queued",
          }),
        }),
      }),
    ]);

    const detail = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(detail.json().attachments[0]).toMatchObject({ documentId: payload.document.id });

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

  it("keeps default OCR queueing atomic when no OCR queue is configured", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());

    const response = await testServer(repository).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ message: "OCR queue is not configured" });
    const detail = await testServer(repository).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(detail.json().attachments[0]).not.toHaveProperty("documentId");
  });

  it("keeps default OCR queueing atomic when no OCR provider is enabled", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailAttachment(attachment());
    const { queue, jobs } = fakeOcrQueue();

    const response = await testServer(repository, user("licensee", ["matter-001"]), queue).inject({
      method: "POST",
      url: "/api/inbound-email/messages/inbound-message-001/attachments/inbound-attachment-001/promote-document",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ message: "OCR provider is not configured" });
    expect(jobs).toEqual([]);
    const detail = await testServer(repository).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(detail.json().attachments[0]).not.toHaveProperty("documentId");
    await expect(repository.listJobLifecycleRecords(firmId, { queueName: "ocr" })).resolves.toEqual(
      [],
    );
  });

  it("keeps default OCR queueing atomic when document storage is unavailable", async () => {
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

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ message: "OCR document storage is not configured" });
    expect(jobs).toEqual([]);
    const detail = await testServer(repository).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(detail.json().attachments[0]).not.toHaveProperty("documentId");
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
