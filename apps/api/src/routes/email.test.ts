import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerEmailRoutes } from "./email.js";

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
}): FastifyInstance {
  const server = Fastify({ logger: false });
  const authUser = input.authUser ?? user("owner_admin", ["matter-001", "matter-002"]);
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerEmailRoutes(server, { repository: input.repository, emailJobQueue });
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
