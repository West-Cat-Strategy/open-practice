import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { hashToken } from "../http/auth-helpers.js";
import { registerEmailRoutes } from "./email.js";
import type { ApiJobQueue } from "./types.js";

const servers: FastifyInstance[] = [];
const emailJobQueue = {
  async add(_name: string, _data: unknown, options?: { jobId?: string }) {
    return { id: options?.jobId ?? "email-job-test" };
  },
};

function deliveryConfirmation(recipientCount = 1) {
  return { confirmed: true, channel: "email", recipientCount };
}

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
  jwtSecret?: string;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  const authUser = input.authUser ?? user("owner_admin", ["matter-001", "matter-002"]);
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerEmailRoutes(server, {
    repository: input.repository,
    emailJobQueue: input.emailJobQueue ?? emailJobQueue,
    jwtSecret: input.jwtSecret ?? "test-email-receipt-secret-at-least-32-chars",
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("email routes", () => {
  it("reports SMTP delivery disabled when no provider is configured", async () => {
    const response = await testServer({ repository: new InMemoryOpenPracticeRepository() }).inject({
      method: "GET",
      url: "/api/email/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "disabled",
      reason: "not_configured",
    });
  });

  it("renders email previews without SMTP, outbox, job, or audit side effects", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const auditBefore = await repository.listAuditEvents("firm-west-legal");
    const response = await testServer({ repository, authUser: user("licensee") }).inject({
      method: "POST",
      url: "/api/email/previews",
      payload: {
        matterId: "matter-001",
        templateKey: "matter.update",
        from: "Open Practice <notice@example.test>",
        to: ["client@example.test"],
        cc: ["staff@example.test"],
        bcc: ["archive@example.test"],
        subject: "Synthetic matter update",
        textBody: "A short synthetic update for preview only.",
        htmlBody: '<p onclick="alert(1)">Preview</p><script>private()</script>',
        relatedResourceType: "signature_request",
        relatedResourceId: "sig-001",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "previewed",
      mode: "render_only",
      preview: {
        matterId: "matter-001",
        templateKey: "matter.update",
        from: "Open Practice <notice@example.test>",
        to: ["client@example.test"],
        cc: ["staff@example.test"],
        bcc: ["archive@example.test"],
        recipientCount: 3,
        subject: "Synthetic matter update",
        body: {
          textPreview: "A short synthetic update for preview only.",
          contentTypes: { text: true, html: true },
        },
        relatedResource: { type: "signature_request", id: "sig-001" },
        warnings: expect.arrayContaining(["html_body_sanitized"]),
        delivery: { persisted: false, queued: false },
      },
    });
    expect(response.json().preview.body.htmlPreview).not.toContain("<script>");
    expect(response.json().preview.body.htmlPreview).not.toContain("onclick");
    await expect(repository.listEmailOutbox("firm-west-legal")).resolves.toEqual([]);
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual([]);
    const auditAfter = await repository.listAuditEvents("firm-west-legal");
    expect(auditAfter.events).toHaveLength(auditBefore.events.length);
    expect(JSON.stringify(auditAfter.events)).not.toContain("Synthetic matter update");
    expect(JSON.stringify(auditAfter.events)).not.toContain("A short synthetic update");
  });

  it("normalizes legacy preview template aliases and flags missing recipients", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/email/previews",
      payload: {
        matterId: "matter-001",
        template: "matter-update",
        subject: "Matter update",
        textBody: "Preview without delivery recipients.",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "previewed",
      mode: "render_only",
      preview: {
        templateKey: "matter-update",
        recipientCount: 0,
        warnings: expect.arrayContaining(["legacy_template_alias", "no_recipients"]),
        delivery: { persisted: false, queued: false },
      },
    });
  });

  it("requires matter-scoped email access for previews", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({
      repository,
      authUser: user("firm_member", ["matter-002"]),
    }).inject({
      method: "POST",
      url: "/api/email/previews",
      payload: {
        matterId: "matter-001",
        templateKey: "matter.update",
        subject: "Matter update",
        textBody: "Preview only.",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      code: "EMAIL_ACCESS_REQUIRED",
    });
  });

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
        deliveryConfirmation: deliveryConfirmation(),
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      code: "SMTP_NOT_CONFIGURED",
      message: "SMTP email delivery is not configured",
    });
  });

  it("rejects outbox sends before provider checks when delivery is not confirmed", async () => {
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

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "SEND_CONFIRMATION_REQUIRED",
    });
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual([]);
  });

  it("rejects outbox sends when confirmed recipient count does not match", async () => {
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
        deliveryConfirmation: deliveryConfirmation(2),
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "SEND_CONFIRMATION_MISMATCH",
    });
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual([]);
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
        deliveryConfirmation: deliveryConfirmation(2),
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

  it("creates purpose-scoped receipt links and records public acknowledgements without leaking email content", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const jwtSecret = "test-email-receipt-secret-at-least-32-chars";
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
    const server = testServer({ repository, authUser: user("licensee"), jwtSecret });
    const createdEmail = await server.inject({
      method: "POST",
      url: "/api/mail/outbox",
      payload: {
        matterId: "matter-001",
        templateKey: "matter.update",
        to: ["client@example.test"],
        subject: "Synthetic private subject",
        textBody: "Synthetic private delivery body.",
        deliveryConfirmation: deliveryConfirmation(),
      },
    });
    const emailId = createdEmail.json().email.id as string;

    const receipt = await server.inject({
      method: "POST",
      url: `/api/mail/outbox/${emailId}/receipt-links`,
      payload: {
        purpose: "client_acknowledgement",
        expiresAt: "2026-05-30T12:00:00.000Z",
        metadata: { correlationId: "receipt-test" },
      },
    });

    expect(receipt.statusCode).toBe(201);
    const receiptPayload = receipt.json();
    const token = receiptPayload.token as string;
    expect(receiptPayload.receiptLink).toMatchObject({
      emailId,
      matterId: "matter-001",
      purpose: "client_acknowledgement",
      recordCount: 0,
    });
    expect(receiptPayload.receiptLink).not.toHaveProperty("tokenHash");
    const [storedLink] = await repository.listEmailReceiptLinks("firm-west-legal", { emailId });
    expect(storedLink?.tokenHash).toBe(hashToken(token, jwtSecret));
    expect(storedLink?.tokenHash).not.toBe(token);

    const viewed = await server.inject({
      method: "GET",
      url: `/api/portal/mail/receipts/${token}`,
    });
    expect(viewed.statusCode).toBe(200);
    expect(viewed.json()).toEqual({
      receipt: {
        status: "available",
        purpose: "client_acknowledgement",
        expiresAt: "2026-05-30T12:00:00.000Z",
      },
    });

    const acknowledged = await server.inject({
      method: "POST",
      url: `/api/portal/mail/receipts/${token}/acknowledge`,
    });
    expect(acknowledged.statusCode).toBe(200);
    expect(acknowledged.json()).toMatchObject({
      receipt: {
        status: "acknowledged",
        purpose: "client_acknowledgement",
        acknowledgedAt: expect.any(String),
      },
    });
    await expect(repository.listEmailReceiptLinks("firm-west-legal", { emailId })).resolves.toEqual(
      [expect.objectContaining({ recordCount: 1, firstRecordedAt: expect.any(String) })],
    );

    const serialized = JSON.stringify({
      created: receipt.json(),
      viewed: viewed.json(),
      acknowledged: acknowledged.json(),
      audit: await repository.listAuditEvents("firm-west-legal"),
    });
    expect(serialized).not.toContain("Synthetic private subject");
    expect(serialized).not.toContain("Synthetic private delivery body");
    expect(serialized).not.toContain("client@example.test");
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain(storedLink?.tokenHash);
  });

  it("requires matter access before creating receipt links for outbound email", async () => {
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
    const ownerServer = testServer({ repository, authUser: user("owner_admin") });
    const createdEmail = await ownerServer.inject({
      method: "POST",
      url: "/api/mail/outbox",
      payload: {
        matterId: "matter-001",
        templateKey: "matter.update",
        to: ["client@example.test"],
        subject: "Synthetic private subject",
        textBody: "Synthetic private delivery body.",
        deliveryConfirmation: deliveryConfirmation(),
      },
    });
    const emailId = createdEmail.json().email.id as string;
    const restrictedServer = testServer({
      repository,
      authUser: user("firm_member", ["matter-002"]),
    });

    const denied = await restrictedServer.inject({
      method: "POST",
      url: `/api/mail/outbox/${emailId}/receipt-links`,
      payload: { purpose: "delivery_receipt" },
    });

    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toMatchObject({ code: "EMAIL_ACCESS_REQUIRED" });
    await expect(repository.listEmailReceiptLinks("firm-west-legal", { emailId })).resolves.toEqual(
      [],
    );
  });

  it("keeps public receipt token failures generic and free of hashes", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const jwtSecret = "test-email-receipt-secret-at-least-32-chars";
    const token = "expired-email-receipt-token-value-for-test";
    await repository.createEmailReceiptLink({
      id: "expired-receipt-link",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      emailId: "email-expired-receipt",
      tokenHash: hashToken(token, jwtSecret),
      purpose: "delivery_receipt",
      createdByUserId: "user-licensee",
      createdAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-05-01T00:00:00.000Z",
      recordCount: 0,
      metadata: {},
    });
    const response = await testServer({ repository, jwtSecret }).inject({
      method: "GET",
      url: `/api/portal/mail/receipts/${token}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "EMAIL_RECEIPT_NOT_FOUND" });
    expect(response.body).not.toContain(hashToken(token, jwtSecret));
    expect(response.body).not.toContain("tokenHash");
    expect(response.body).not.toContain("email-expired-receipt");
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
        deliveryConfirmation: deliveryConfirmation(),
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
      deliveryConfirmation: deliveryConfirmation(),
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
      deliveryConfirmation: deliveryConfirmation(),
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
        deliveryConfirmation: deliveryConfirmation(),
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
        deliveryConfirmation: deliveryConfirmation(),
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
      payload: {
        idempotencyKey: "manual-retry-key",
        deliveryConfirmation: deliveryConfirmation(),
      },
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
