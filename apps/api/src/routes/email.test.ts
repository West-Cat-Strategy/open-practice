import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerEmailRoutes } from "./email.js";
import type { ApiJobQueue } from "./types.js";

const servers: FastifyInstance[] = [];
const emailJobQueue = {
  async add(_name: string, _data: unknown, options?: { jobId?: string }) {
    return { id: options?.jobId ?? "email-job-test" };
  },
};

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  return {
    id: `user-${role}`,
    firmId: "firm-west-legal",
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function testServer(input: {
  repository: InMemoryOpenPracticeRepository;
  authUser?: User;
  emailJobQueue?: ApiJobQueue;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  const authUser = input.authUser ?? user("owner_admin", ["matter-001", "matter-002"]);
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerEmailRoutes(server, {
    repository: input.repository,
    emailJobQueue: input.emailJobQueue ?? emailJobQueue,
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("email routes", () => {
  it("keeps outbound queueing disabled until SMTP is configured", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/mail/outbox",
      payload: {
        matterId: "matter-001",
        templateKey: "signature.requested",
        to: ["client@example.test"],
        subject: "Signature requested",
        textBody: "Please review the signature request.",
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      code: "SMTP_NOT_CONFIGURED",
      message: "SMTP email delivery is not configured",
    });
  });

  it("creates an outbox record, queued job, email event, and audit event", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-smtp-mailpit",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "mailpit",
      enabled: true,
      encryptedConfig: "local-mailpit-profile",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    });

    const response = await testServer({ repository, authUser: user("licensee") }).inject({
      method: "POST",
      url: "/api/mail/outbox",
      payload: {
        matterId: "matter-001",
        templateKey: "signature.requested",
        to: ["client@example.test"],
        cc: ["staff@example.test"],
        subject: "Signature requested",
        textBody: "Please review the signature request.",
        relatedResourceType: "signature_request",
        relatedResourceId: "sig-001",
      },
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json();
    expect(payload.queuedEmail).toMatchObject({
      templateKey: "signature.requested",
      status: "queued",
      jobId: payload.job.id,
    });
    expect(payload.email).toMatchObject({
      matterId: "matter-001",
      templateKey: "signature.requested",
      status: "queued",
      relatedResourceType: "signature_request",
      relatedResourceId: "sig-001",
      attemptCount: 0,
    });
    expect(payload.job).toMatchObject({
      queueName: "email",
      jobName: "send_email",
      status: "queued",
      targetResourceType: "email_outbox",
      targetResourceId: payload.email.id,
    });

    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toMatchObject([
      expect.objectContaining({
        id: payload.job.id,
        metadata: expect.objectContaining({
          emailId: payload.email.id,
          matterId: "matter-001",
          provider: "mailpit",
          templateKey: "signature.requested",
          recipientCount: 2,
          relatedResourceType: "signature_request",
          relatedResourceId: "sig-001",
        }),
      }),
    ]);
    const [job] = await repository.listJobLifecycleRecords("firm-west-legal");
    expect(job.bullJobId).toBe(payload.job.id);
    expect(job.metadata).not.toHaveProperty("to");
    expect(job.metadata).not.toHaveProperty("subject");
    expect(job.metadata).not.toHaveProperty("html");
    expect(job.metadata).not.toHaveProperty("text");
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      valid: true,
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "email_outbox.queued",
          resourceType: "email_outbox",
          resourceId: payload.email.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            templateKey: "signature.requested",
            provider: "mailpit",
            recipientCount: 2,
            jobId: payload.job.id,
          }),
        }),
      ]),
    });
  });

  it("marks a durable email job failed when BullMQ enqueue fails", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-smtp-mailpit",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "mailpit",
      enabled: true,
      encryptedConfig: "local-mailpit-profile",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    });
    const failingQueue: ApiJobQueue = {
      async add() {
        throw new Error("Redis unavailable with private connection details");
      },
    };

    const response = await testServer({ repository, emailJobQueue: failingQueue }).inject({
      method: "POST",
      url: "/api/mail/outbox",
      payload: {
        matterId: "matter-001",
        templateKey: "signature.requested",
        to: ["client@example.test"],
        subject: "Signature requested",
        textBody: "Please review the signature request.",
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      code: "QUEUE_ENQUEUE_FAILED",
    });
    const [job] = await repository.listJobLifecycleRecords("firm-west-legal");
    expect(job).toMatchObject({
      queueName: "email",
      status: "failed",
      attemptsMade: 1,
      errorMessage: "Job enqueue failed; retry after the worker queue is available.",
      metadata: expect.objectContaining({ enqueueStatus: "failed", matterId: "matter-001" }),
    });
    expect(job.errorMessage).not.toContain("private connection details");
  });

  it("replays matching idempotent outbox requests without queueing duplicate jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-smtp-mailpit",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "mailpit",
      enabled: true,
      encryptedConfig: "local-mailpit-profile",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    });
    const jobs: string[] = [];
    const queue: ApiJobQueue = {
      async add(_name, _data, options) {
        jobs.push(options?.jobId ?? "email-job-test");
        return { id: options?.jobId ?? "email-job-test" };
      },
    };
    const server = testServer({ repository, emailJobQueue: queue });
    const payload = {
      matterId: "matter-001",
      templateKey: "signature.requested",
      to: ["client@example.test"],
      subject: "Signature requested",
      textBody: "Please review the signature request.",
      relatedResourceType: "signature_request" as const,
      relatedResourceId: "sig-001",
      idempotencyKey: "email-route-replay-key",
    };

    const first = await server.inject({ method: "POST", url: "/api/mail/outbox", payload });
    const replay = await server.inject({ method: "POST", url: "/api/mail/outbox", payload });

    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(201);
    expect(replay.json().email.id).toBe(first.json().email.id);
    expect(replay.json().job.id).toBe(first.json().job.id);
    expect(jobs).toHaveLength(1);
    await expect(repository.listEmailOutbox("firm-west-legal")).resolves.toHaveLength(1);
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toHaveLength(1);
  });

  it("rejects idempotent outbox key reuse with changed safe payload", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-smtp-mailpit",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "mailpit",
      enabled: true,
      encryptedConfig: "local-mailpit-profile",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    });
    const server = testServer({ repository });
    const payload = {
      matterId: "matter-001",
      templateKey: "signature.requested",
      to: ["client@example.test"],
      subject: "Signature requested",
      textBody: "Please review the signature request.",
      relatedResourceType: "signature_request" as const,
      relatedResourceId: "sig-001",
      idempotencyKey: "email-route-conflict-key",
    };

    await server.inject({ method: "POST", url: "/api/mail/outbox", payload });
    const conflict = await server.inject({
      method: "POST",
      url: "/api/mail/outbox",
      payload: { ...payload, subject: "Changed safe subject" },
    });

    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({ code: "IDEMPOTENCY_KEY_CONFLICT" });
  });

  it("lists redacted matter-scoped delivery history", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-smtp-mailpit",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "mailpit",
      enabled: true,
      encryptedConfig: "local-mailpit-profile",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    });
    const server = testServer({ repository, authUser: user("licensee") });
    const created = await server.inject({
      method: "POST",
      url: "/api/mail/outbox",
      payload: {
        matterId: "matter-001",
        templateKey: "signature.requested",
        to: ["client@example.test"],
        subject: "Synthetic private subject",
        textBody: "Synthetic private body.",
      },
    });
    const emailId = created.json().email.id as string;
    const jobId = created.json().job.id as string;
    await repository.recordEmailDeliveryResult({
      firmId: "firm-west-legal",
      emailId,
      status: "sending",
      occurredAt: "2026-05-01T12:01:00.000Z",
      attemptNumber: 1,
      jobId,
      source: "worker",
      metadata: { provider: "mailpit", templateKey: "signature.requested" },
    });
    await repository.recordEmailDeliveryResult({
      firmId: "firm-west-legal",
      emailId,
      status: "failed",
      occurredAt: "2026-05-01T12:02:00.000Z",
      attemptNumber: 1,
      jobId,
      source: "worker",
      terminal: true,
      errorMessage: "SMTP refused synthetic message with details ".repeat(20),
      metadata: { provider: "mailpit", templateKey: "signature.requested", terminal: true },
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/mail/outbox?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.emails).toHaveLength(1);
    expect(payload.emails[0]).toMatchObject({
      id: emailId,
      matterId: "matter-001",
      templateKey: "signature.requested",
      status: "failed",
      recipientCount: 1,
      attemptCount: 1,
      failedAt: "2026-05-01T12:02:00.000Z",
      terminalFailureAt: "2026-05-01T12:02:00.000Z",
      failureSummary: expect.stringContaining("SMTP refused synthetic message"),
    });
    expect(payload.emails[0].events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "queued", source: "api", jobId }),
        expect.objectContaining({ eventType: "sending", source: "worker", attemptNumber: 1 }),
        expect.objectContaining({
          eventType: "failed",
          source: "worker",
          attemptNumber: 1,
          errorSummary: expect.stringContaining("SMTP refused synthetic message"),
        }),
      ]),
    );
    expect(payload.emails[0]).not.toHaveProperty("to");
    expect(payload.emails[0]).not.toHaveProperty("subject");
    expect(payload.emails[0]).not.toHaveProperty("htmlBody");
    expect(payload.emails[0]).not.toHaveProperty("textBody");
    expect(payload.emails[0].failureSummary.length).toBeLessThanOrEqual(240);
  });

  it("retries failed outbox email with a redacted workflow audit envelope", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-smtp-mailpit",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "mailpit",
      enabled: true,
      encryptedConfig: "local-mailpit-profile",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    });
    const server = testServer({ repository, authUser: user("licensee") });
    const created = await server.inject({
      method: "POST",
      url: "/api/mail/outbox",
      payload: {
        matterId: "matter-001",
        templateKey: "signature.requested",
        to: ["client@example.test"],
        subject: "Synthetic private subject",
        textBody: "Synthetic private body.",
      },
    });
    const emailId = created.json().email.id as string;
    const failedJobId = created.json().job.id as string;
    await repository.recordEmailDeliveryResult({
      firmId: "firm-west-legal",
      emailId,
      status: "failed",
      occurredAt: "2026-05-01T12:02:00.000Z",
      attemptNumber: 1,
      jobId: failedJobId,
      source: "worker",
      terminal: true,
      errorMessage: "SMTP refused synthetic message with private routing details",
      metadata: { provider: "mailpit", templateKey: "signature.requested", terminal: true },
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/mail/outbox/${emailId}/retry`,
      payload: { idempotencyKey: "manual-retry-key" },
    });

    expect(response.statusCode).toBe(202);
    const audit = await repository.listAuditEvents("firm-west-legal");
    const event = audit.events.find(
      (candidate) => candidate.action === "email_outbox.manual_retry",
    );
    expect(event).toMatchObject({
      resourceType: "email_outbox",
      resourceId: emailId,
      metadata: {
        requestId: expect.any(String),
        actorType: "licensee",
        actorId: "user-licensee",
        matterId: "matter-001",
        matterIds: ["matter-001"],
        workflowStatus: "queued",
        beforeStatus: "failed",
        expectedStatus: "queued",
        afterStatus: "queued",
        attemptNumber: 0,
        maxAttempts: 5,
        retryOfJobId: failedJobId,
        idempotencyKeyPresent: true,
      },
    });
    expect(JSON.stringify(event?.metadata)).not.toContain("Synthetic private subject");
    expect(JSON.stringify(event?.metadata)).not.toContain("Synthetic private body");
    expect(JSON.stringify(event?.metadata)).not.toContain("private routing details");
    expect(event?.metadata).not.toHaveProperty("provider");
    expect(event?.metadata).not.toHaveProperty("templateKey");
    expect(event?.metadata).not.toHaveProperty("recipientCount");
    expect(event?.metadata).not.toHaveProperty("jobId");
    expect(event?.metadata).not.toHaveProperty("bullJobId");
  });

  it("requires matter access for delivery history", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({
      repository,
      authUser: user("firm_member", ["matter-002"]),
    }).inject({
      method: "GET",
      url: "/api/mail/outbox?matterId=matter-001",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      code: "EMAIL_ACCESS_REQUIRED",
    });
  });

  it("rejects outbox requests without message body content", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-smtp-mailpit",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "mailpit",
      enabled: true,
      encryptedConfig: "local-mailpit-profile",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    });

    const response = await testServer({ repository, authUser: user("licensee") }).inject({
      method: "POST",
      url: "/api/mail/outbox",
      payload: {
        matterId: "matter-001",
        templateKey: "signature.requested",
        to: ["client@example.test"],
        subject: "Signature requested",
      },
    });

    expect(response.statusCode).toBe(400);
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual([]);
  });

  it("rejects misleading related resource links on public outbox requests", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-smtp-mailpit",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "mailpit",
      enabled: true,
      encryptedConfig: "local-mailpit-profile",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    });

    const response = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/mail/outbox",
      payload: {
        matterId: "matter-002",
        templateKey: "signature.requested",
        to: ["client@example.test"],
        subject: "Signature requested",
        textBody: "Please review the signature request.",
        relatedResourceType: "signature_request",
        relatedResourceId: "sig-001",
        metadata: { correlationId: "allowed", token: "must-not-persist" },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: "Related email resource does not match the email matter",
    });
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual([]);
  });
});
