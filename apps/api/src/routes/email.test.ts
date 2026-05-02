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
      templateKey: "signature.requested",
      status: "queued",
      relatedResourceType: "signature_request",
      relatedResourceId: "sig-001",
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
    expect(job.maxAttempts).toBe(5);
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

  it("lists delivery history without exposing message bodies", async () => {
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
        templateKey: "intake.generated",
        to: ["staff@example.test"],
        subject: "Generated intake document",
        htmlBody: "<p>Document generated.</p>",
        textBody: "Document generated.",
      },
    });

    const listed = await server.inject({
      method: "GET",
      url: "/api/mail/outbox?matterId=matter-001",
    });

    expect(created.statusCode).toBe(201);
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      emails: [
        {
          id: created.json().email.id,
          templateKey: "intake.generated",
          status: "queued",
          subject: "Generated intake document",
          provider: "mailpit",
          source: "api.mail_outbox",
          events: [expect.objectContaining({ eventType: "queued" })],
        },
      ],
    });
    expect(JSON.stringify(listed.json())).not.toContain("Document generated.");
    expect(JSON.stringify(listed.json())).not.toContain("<p>Document generated.</p>");
  });

  it("manually retries failed email with redacted job and audit metadata", async () => {
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
        subject: "Signature requested",
        textBody: "Please review the signature request.",
      },
    });
    const emailId = created.json().email.id;
    await repository.recordEmailDeliveryResult({
      firmId: "firm-west-legal",
      emailId,
      status: "failed",
      occurredAt: "2026-05-01T01:00:00.000Z",
      errorMessage: "SMTP refused message",
      metadata: {
        attemptNumber: 5,
        maxAttempts: 5,
        terminal: true,
        provider: "mailpit",
        templateKey: "signature.requested",
      },
    });

    const retried = await server.inject({
      method: "POST",
      url: `/api/mail/outbox/${emailId}/retry`,
      payload: { matterId: "matter-001" },
    });

    expect(retried.statusCode).toBe(202);
    expect(retried.json()).toMatchObject({
      email: {
        id: emailId,
        status: "queued",
        deliveryState: expect.objectContaining({
          terminal: false,
          nextRetryAt: expect.any(String),
        }),
        events: expect.arrayContaining([
          expect.objectContaining({ eventType: "failed" }),
          expect.objectContaining({
            eventType: "queued",
            metadata: expect.objectContaining({ manualRetry: true }),
          }),
        ]),
      },
      event: { eventType: "queued", metadata: expect.objectContaining({ manualRetry: true }) },
      job: {
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceId: emailId,
      },
    });
    const jobs = await repository.listJobLifecycleRecords("firm-west-legal");
    expect(jobs).toHaveLength(2);
    expect(jobs[1]).toMatchObject({
      maxAttempts: 5,
      metadata: expect.objectContaining({
        emailId,
        matterId: "matter-001",
        provider: "mailpit",
        recipientCount: 1,
      }),
    });
    expect(jobs[1]?.metadata).not.toHaveProperty("textBody");
    expect(jobs[1]?.metadata).not.toHaveProperty("htmlBody");
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "email_outbox.manual_retry",
          resourceId: emailId,
          metadata: expect.not.objectContaining({
            textBody: expect.anything(),
            htmlBody: expect.anything(),
          }),
        }),
      ]),
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
