import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { serializeSmtpProviderConfig } from "@open-practice/domain";
import type { ProfessionalRole, User } from "@open-practice/domain";
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
  publicWebBaseUrl?: string;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  const authUser = input.authUser ?? user("owner_admin", ["matter-001", "matter-002"]);
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerEmailRoutes(server, {
    repository: input.repository,
    emailJobQueue: input.emailJobQueue ?? emailJobQueue,
    jwtSecret: input.jwtSecret,
    publicWebBaseUrl: input.publicWebBaseUrl,
  });
  servers.push(server);
  return server;
}

function extractReceiptToken(emailBody: string): string {
  const match = emailBody.match(
    /\/api\/portal\/(?:email-receipts|mail\/receipts)\/([A-Za-z0-9_-]+)/,
  );
  if (!match?.[1]) throw new Error("Receipt token was not appended to the email body");
  return match[1];
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

  it("denies email provider status to client-external users", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository(),
      authUser: user("client_external", ["matter-001"]),
    }).inject({
      method: "GET",
      url: "/api/email/status",
    });

    expect(response.statusCode).toBe(403);
  });

  it("updates and returns redacted SMTP settings without leaking passwords", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({ repository }).inject({
      method: "PUT",
      url: "/api/email/settings",
      payload: {
        enabled: true,
        host: "smtp.example.test",
        port: 587,
        secure: false,
        username: "mailer@example.test",
        password: "smtp-secret",
        fromAddress: "Open Practice <no-reply@example.test>",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      settings: {
        enabled: true,
        host: "smtp.example.test",
        port: 587,
        username: "mailer@example.test",
        fromAddress: "Open Practice <no-reply@example.test>",
        passwordConfigured: true,
        configValid: true,
      },
    });
    expect(response.body).not.toContain("smtp-secret");

    const getResponse = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/email/settings",
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body).not.toContain("smtp-secret");
    expect(getResponse.json().settings.passwordConfigured).toBe(true);
  });

  it("preserves the SMTP password when settings are updated without a replacement", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-smtp-default",
      firmId: "firm-west-legal",
      kind: "smtp",
      key: "default",
      enabled: true,
      encryptedConfig: serializeSmtpProviderConfig({
        version: 1,
        host: "smtp.old.example.test",
        port: 587,
        secure: false,
        username: "mailer@example.test",
        password: "smtp-secret",
        fromAddress: "Open Practice <no-reply@example.test>",
      }),
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
    });

    const response = await testServer({ repository }).inject({
      method: "PUT",
      url: "/api/email/settings",
      payload: {
        enabled: true,
        host: "smtp.new.example.test",
        port: 465,
        secure: true,
        username: "mailer@example.test",
        fromAddress: "Open Practice <no-reply@example.test>",
      },
    });

    expect(response.statusCode).toBe(200);
    const [saved] = await repository.listProviderSettings("firm-west-legal", { kind: "smtp" });
    expect(JSON.parse(saved!.encryptedConfig)).toMatchObject({
      host: "smtp.new.example.test",
      port: 465,
      password: "smtp-secret",
    });
    expect(response.body).not.toContain("smtp-secret");
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

  it("records opt-in delivery receipts with hashed public tokens and staff-safe status", async () => {
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
    const queuedJobs: unknown[] = [];
    const queue: ApiJobQueue = {
      async add(_name, data, options) {
        queuedJobs.push(data);
        return { id: options?.jobId ?? "email-job-test" };
      },
    };
    const server = testServer({
      repository,
      authUser: user("licensee"),
      emailJobQueue: queue,
      jwtSecret: "receipt-token-test-secret-at-least-32-characters",
      publicWebBaseUrl: "https://practice.example.test",
    });

    const created = await server.inject({
      method: "POST",
      url: "/api/mail/outbox",
      payload: {
        matterId: "matter-001",
        templateKey: "client.update",
        to: ["client@example.test"],
        subject: "Synthetic private subject",
        textBody: "Synthetic private body.",
        htmlBody: "<p>Synthetic private body.</p>",
        deliveryConfirmation: deliveryConfirmation(),
        receipt: { requested: true },
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().email.deliveryReceipt).toMatchObject({
      status: "pending",
      requestedAt: expect.any(String),
    });
    expect(JSON.stringify(created.json())).not.toContain("tokenHash");
    const [stored] = await repository.listEmailOutbox("firm-west-legal", {
      matterId: "matter-001",
    });
    const receiptToken = extractReceiptToken(stored.textBody);
    expect(stored.htmlBody).toContain("https://practice.example.test/api/portal/email-receipts/");
    expect(stored.metadata.deliveryReceipt).toMatchObject({
      requested: true,
      requestedAt: expect.any(String),
    });
    expect(stored.metadata.deliveryReceipt).not.toHaveProperty("tokenHash");
    expect(stored.metadata.deliveryReceipt).not.toHaveProperty("expiresAt");
    expect(stored.metadata.deliveryReceipt).not.toHaveProperty("recordedAt");
    expect(stored.metadata.deliveryReceipt).not.toHaveProperty("status");
    const [storedReceiptToken] = await repository.listEmailReceiptTokens("firm-west-legal", {
      emailId: stored.id,
    });
    expect(storedReceiptToken).toMatchObject({
      emailId: stored.id,
      matterId: "matter-001",
      purpose: "delivery_receipt",
      tokenHash: expect.any(String),
    });
    expect(storedReceiptToken?.tokenHash).not.toBe(receiptToken);
    expect(storedReceiptToken?.tokenHash).toHaveLength(64);
    expect(JSON.stringify(queuedJobs)).not.toContain(receiptToken);
    expect(JSON.stringify(queuedJobs)).not.toContain("tokenHash");
    expect(JSON.stringify(queuedJobs)).not.toContain("client@example.test");
    expect(JSON.stringify(queuedJobs)).not.toContain("Synthetic private subject");
    expect(JSON.stringify(queuedJobs)).not.toContain("Synthetic private body");
    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "email",
    });
    expect(JSON.stringify(job?.metadata)).not.toContain(receiptToken);
    expect(JSON.stringify(job?.metadata)).not.toContain("tokenHash");
    expect(JSON.stringify(job?.metadata)).not.toContain("client@example.test");
    expect(JSON.stringify(job?.metadata)).not.toContain("Synthetic private subject");
    expect(JSON.stringify(job?.metadata)).not.toContain("Synthetic private body");
    const auditBeforeReceipt = await repository.listAuditEvents("firm-west-legal");
    expect(JSON.stringify(auditBeforeReceipt.events)).not.toContain(receiptToken);
    expect(JSON.stringify(auditBeforeReceipt.events)).not.toContain("tokenHash");
    expect(JSON.stringify(auditBeforeReceipt.events)).not.toContain("client@example.test");
    expect(JSON.stringify(auditBeforeReceipt.events)).not.toContain("Synthetic private subject");
    expect(JSON.stringify(auditBeforeReceipt.events)).not.toContain("Synthetic private body");

    const historyBefore = await server.inject({
      method: "GET",
      url: "/api/mail/outbox?matterId=matter-001",
    });
    expect(historyBefore.statusCode).toBe(200);
    expect(historyBefore.json().emails[0].deliveryReceipt).toMatchObject({
      status: "pending",
      requestedAt: expect.any(String),
    });
    expect(JSON.stringify(historyBefore.json())).not.toContain(receiptToken);
    expect(JSON.stringify(historyBefore.json())).not.toContain("tokenHash");
    expect(JSON.stringify(historyBefore.json())).not.toContain("Synthetic private body");

    const confirmation = await server.inject({
      method: "GET",
      url: `/api/portal/email-receipts/${receiptToken}`,
    });
    expect(confirmation.statusCode).toBe(200);
    expect(confirmation.headers["cache-control"]).toBe("no-store");
    expect(confirmation.headers["content-type"]).toContain("text/html");
    expect(confirmation.body).toContain("Email Receipt Confirmation");
    expect(confirmation.body).toContain(
      `form method="post" action="/api/portal/email-receipts/${receiptToken}"`,
    );
    expect(confirmation.body).not.toContain(stored.id);
    expect(confirmation.body).not.toContain("matter-001");
    expect(confirmation.body).not.toContain("client@example.test");
    const [receiptTokenAfterGet] = await repository.listEmailReceiptTokens("firm-west-legal", {
      emailId: stored.id,
    });
    expect(receiptTokenAfterGet?.recordedAt).toBeUndefined();
    const historyAfterGet = await server.inject({
      method: "GET",
      url: "/api/mail/outbox?matterId=matter-001",
    });
    expect(historyAfterGet.json().emails[0].deliveryReceipt).toMatchObject({
      status: "pending",
    });

    const legacyConfirmation = await server.inject({
      method: "GET",
      url: `/api/portal/mail/receipts/${receiptToken}`,
    });
    expect(legacyConfirmation.statusCode).toBe(200);
    expect(legacyConfirmation.headers["cache-control"]).toBe("no-store");
    expect(legacyConfirmation.headers["content-type"]).toContain("text/html");
    expect(legacyConfirmation.body).toContain(
      `form method="post" action="/api/portal/mail/receipts/${receiptToken}"`,
    );
    const [receiptTokenAfterLegacyGet] = await repository.listEmailReceiptTokens(
      "firm-west-legal",
      { emailId: stored.id },
    );
    expect(receiptTokenAfterLegacyGet?.recordedAt).toBeUndefined();

    const recorded = await server.inject({
      method: "POST",
      url: `/api/portal/email-receipts/${receiptToken}`,
    });
    expect(recorded.statusCode).toBe(200);
    expect(recorded.json()).toMatchObject({
      recorded: true,
      receipt: { status: "received", recordedAt: expect.any(String) },
    });
    expect(JSON.stringify(recorded.json())).not.toContain("matter-001");
    expect(JSON.stringify(recorded.json())).not.toContain(stored.id);
    expect(JSON.stringify(recorded.json())).not.toContain(receiptToken);

    const replay = await server.inject({
      method: "POST",
      url: `/api/portal/email-receipts/${receiptToken}`,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({
      recorded: false,
      receipt: { status: "received", recordedAt: recorded.json().receipt.recordedAt },
    });

    const historyAfter = await server.inject({
      method: "GET",
      url: "/api/mail/outbox?matterId=matter-001",
    });
    expect(historyAfter.json().emails[0].deliveryReceipt).toMatchObject({
      status: "received",
      recordedAt: recorded.json().receipt.recordedAt,
    });
    expect(JSON.stringify(historyAfter.json())).not.toContain(receiptToken);
    expect(JSON.stringify(historyAfter.json())).not.toContain("tokenHash");
  });

  it("rejects receipt-token opt-in when token signing is not configured", async () => {
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
        templateKey: "client.update",
        to: ["client@example.test"],
        subject: "Synthetic private subject",
        textBody: "Synthetic private body.",
        deliveryConfirmation: deliveryConfirmation(),
        deliveryReceipt: { requested: true },
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      code: "EMAIL_RECEIPT_TOKEN_SIGNING_NOT_CONFIGURED",
    });
    await expect(repository.listEmailOutbox("firm-west-legal")).resolves.toEqual([]);
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual([]);
  });

  it("rejects expired public receipt tokens without recording receipt state", async () => {
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
    const server = testServer({
      repository,
      authUser: user("licensee"),
      jwtSecret: "receipt-token-test-secret-at-least-32-characters",
      publicWebBaseUrl: "https://practice.example.test",
    });

    const created = await server.inject({
      method: "POST",
      url: "/api/mail/outbox",
      payload: {
        matterId: "matter-001",
        templateKey: "client.update",
        to: ["client@example.test"],
        subject: "Synthetic private subject",
        textBody: "Synthetic private body.",
        deliveryConfirmation: deliveryConfirmation(),
        deliveryReceipt: {
          requested: true,
          expiresAt: "2020-01-01T00:00:00.000Z",
        },
      },
    });

    expect(created.statusCode).toBe(201);
    const [stored] = await repository.listEmailOutbox("firm-west-legal", {
      matterId: "matter-001",
    });
    const receiptToken = extractReceiptToken(stored.textBody);
    const expired = await server.inject({
      method: "POST",
      url: `/api/portal/email-receipts/${receiptToken}`,
    });
    expect(expired.statusCode).toBe(410);
    expect(expired.json()).toMatchObject({
      code: "EMAIL_RECEIPT_EXPIRED",
    });
    const [storedReceiptToken] = await repository.listEmailReceiptTokens("firm-west-legal", {
      emailId: stored.id,
    });
    expect(storedReceiptToken).toMatchObject({
      expiresAt: "2020-01-01T00:00:00.000Z",
    });
    expect(storedReceiptToken?.recordedAt).toBeUndefined();
    const history = await server.inject({
      method: "GET",
      url: "/api/mail/outbox?matterId=matter-001",
    });
    expect(history.json().emails[0].deliveryReceipt).toMatchObject({
      status: "pending",
    });
    expect(JSON.stringify(history.json())).not.toContain(receiptToken);
    expect(JSON.stringify(history.json())).not.toContain("tokenHash");
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
