import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { DocumentAutomationProvider, IntakeSessionRecord } from "@open-practice/domain";
import { registerIntakeRoutes } from "./intake.js";

const servers: FastifyInstance[] = [];

interface TestServerOptions {
  repository?: InMemoryOpenPracticeRepository;
  automationProvider?: DocumentAutomationProvider;
}
const emailJobQueue = {
  async add(_name: string, _data: unknown, options?: { jobId?: string }) {
    return { id: options?.jobId ?? "email-job-test" };
  },
};

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function testServer({ repository, automationProvider }: TestServerOptions = {}) {
  const testRepository = repository ?? new InMemoryOpenPracticeRepository();
  const server = Fastify({ logger: false });

  server.addHook("preHandler", async (request) => {
    const firmId = firstHeader(request.headers["x-open-practice-firm-id"]) ?? "firm-west-legal";
    const userId = firstHeader(request.headers["x-open-practice-user-id"]) ?? "user-admin";
    const user = await testRepository.getUser(firmId, userId);
    if (!user)
      throw Object.assign(new Error("Authenticated user was not found"), { statusCode: 401 });
    request.auth = { user, firmId };
  });

  registerIntakeRoutes(server, {
    repository: testRepository,
    automationProvider,
    emailJobQueue,
  });

  server.setErrorHandler((error, _request, reply) => {
    const normalizedError = error as Error & { statusCode?: number };
    const statusCode =
      typeof normalizedError.statusCode === "number" ? normalizedError.statusCode : 400;
    reply.status(statusCode).send({
      error: normalizedError.name,
      message: normalizedError.message,
    });
  });

  servers.push(server);
  return server;
}

function intakeSessionRecord(overrides: Partial<IntakeSessionRecord> = {}): IntakeSessionRecord {
  const now = "2026-04-25T12:00:00.000Z";
  return {
    id: "intake-docassemble-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    templateId: "intake-template-001",
    provider: "docassemble",
    externalId: "docassemble:intake-docassemble-001",
    status: "ready_to_generate",
    evidence: { mode: "test" },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function enableSmtp(repository: InMemoryOpenPracticeRepository) {
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
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("intake routes", () => {
  it("lists and creates intake sessions through the extracted registrar", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const before = await server.inject({
      method: "GET",
      url: "/api/intake-sessions?matterId=matter-001",
    });
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-sessions",
      payload: {
        matterId: "matter-001",
        templateId: "intake-template-001",
        clientContactId: "contact-ada",
        evidence: { source: "route-test" },
      },
    });
    const after = await server.inject({
      method: "GET",
      url: "/api/intake-sessions?matterId=matter-001",
    });

    expect(before.statusCode).toBe(200);
    expect(before.json()).toMatchObject({
      templates: [
        expect.objectContaining({
          id: "intake-template-001",
          provider: "embedded",
          definitionVersion: 1,
          definition: expect.objectContaining({
            schemaVersion: 1,
            packages: expect.arrayContaining([
              expect.objectContaining({ id: "repair_notice_package" }),
            ]),
          }),
        }),
      ],
      sessions: [expect.objectContaining({ id: "intake-session-001", matterId: "matter-001" })],
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      templateId: "intake-template-001",
      provider: "embedded",
      externalId: "embedded:matter-001:residential-tenancy-intake",
      status: "created",
      clientContactId: "contact-ada",
      evidence: expect.objectContaining({ mode: "embedded", source: "route-test" }),
    });
    expect(created.json()).not.toHaveProperty("success");
    expect(after.json<{ sessions: Array<{ id: string }> }>().sessions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.json<{ id: string }>().id })]),
    );
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "intake_session.created",
          resourceType: "intake_session",
          resourceId: created.json<{ id: string }>().id,
          metadata: {
            matterId: "matter-001",
            templateId: "intake-template-001",
            provider: "embedded",
            status: "created",
          },
        }),
      ]),
      valid: true,
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    const auditEvent = audit.events.find((event) => event.action === "intake_session.created");
    expect(auditEvent?.metadata).not.toHaveProperty("evidence");
    expect(auditEvent?.metadata).not.toHaveProperty("clientContactId");
  });

  it("creates and lists answer snapshots", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const snapshot = await server.inject({
      method: "POST",
      url: "/api/intake-sessions/intake-session-001/answer-snapshots",
      payload: {
        capturedAt: "2026-04-25T12:10:00.000Z",
        answers: { issue_type: "repair", urgent: true },
      },
    });
    const list = await server.inject({
      method: "GET",
      url: "/api/intake-sessions/intake-session-001/answer-snapshots",
    });

    expect(snapshot.statusCode).toBe(200);
    expect(snapshot.json()).toMatchObject({
      firmId: "firm-west-legal",
      intakeSessionId: "intake-session-001",
      capturedAt: "2026-04-25T12:10:00.000Z",
      answers: { issue_type: "repair", urgent: true },
      resolution: expect.objectContaining({
        templateId: "intake-template-001",
        templateVersion: 1,
        visibleQuestionIds: expect.arrayContaining(["issue_type", "urgent", "repair_details"]),
        eligiblePackageIds: expect.arrayContaining([
          "repair_notice_package",
          "urgent_review_package",
        ]),
        selectedPackageIds: expect.arrayContaining([
          "repair_notice_package",
          "urgent_review_package",
        ]),
      }),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      snapshots: [
        expect.objectContaining({
          answers: { issue_type: "repair", urgent: true },
          resolution: expect.objectContaining({
            packageDocuments: expect.arrayContaining([
              expect.objectContaining({
                packageId: "repair_notice_package",
                packageDocumentId: "repair_notice_letter",
              }),
            ]),
          }),
        }),
      ],
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    const snapshotAudit = audit.events.find(
      (event) => event.action === "intake_answer_snapshot.created",
    );
    expect(snapshotAudit?.metadata).toMatchObject({
      intakeSessionId: "intake-session-001",
      templateId: "intake-template-001",
      answerCount: 2,
      selectedPackageCount: 2,
    });
    expect(JSON.stringify(snapshotAudit?.metadata)).not.toContain("repair");
    expect(JSON.stringify(snapshotAudit?.metadata)).not.toContain("urgent");
  });

  it("generates eligible embedded intake packages from the latest answer snapshot", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    await server.inject({
      method: "POST",
      url: "/api/intake-sessions/intake-session-001/answer-snapshots",
      payload: {
        capturedAt: "2026-04-25T12:10:00.000Z",
        answers: { issue_type: "repair", urgent: true },
      },
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/intake-sessions/intake-session-001/generated-packages",
      payload: {
        packageId: "repair_notice_package",
        evidence: { requestedBy: "route-test" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      packageId: "repair_notice_package",
      documents: [
        expect.objectContaining({
          firmId: "firm-west-legal",
          matterId: "matter-001",
          intakeSessionId: "intake-session-001",
          provider: "embedded",
          title: "Repair notice letter",
          packageId: "repair_notice_package",
          packageDocumentId: "repair_notice_letter",
          externalId:
            "embedded:embedded:intake-session-001:repair_notice_package:repair_notice_letter",
          evidence: expect.objectContaining({
            mode: "embedded",
            requestedBy: "route-test",
            packageId: "repair_notice_package",
            packageDocumentId: "repair_notice_letter",
          }),
        }),
        expect.objectContaining({
          title: "Client instruction summary",
          packageDocumentId: "client_instruction_summary",
        }),
      ],
      queuedEmail: {
        status: "disabled",
        reason: "not_configured",
      },
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    const packageAudit = audit.events.find((event) => event.action === "intake.package.generated");
    expect(packageAudit?.metadata).toMatchObject({
      intakeSessionId: "intake-session-001",
      templateId: "intake-template-001",
      packageId: "repair_notice_package",
      documentCount: 2,
      packageDocumentIds: ["repair_notice_letter", "client_instruction_summary"],
      providers: ["embedded"],
    });
    expect(JSON.stringify(packageAudit?.metadata)).not.toContain("route-test");
    expect(JSON.stringify(packageAudit?.metadata)).not.toContain("storageKey");
    expect(JSON.stringify(packageAudit?.metadata)).not.toContain("checksum");
  });

  it("rejects package generation without an eligible answer snapshot", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const missingSnapshot = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/intake-sessions/intake-session-001/generated-packages",
      payload: { packageId: "repair_notice_package" },
    });
    const server = testServer({ repository });
    await server.inject({
      method: "POST",
      url: "/api/intake-sessions/intake-session-001/answer-snapshots",
      payload: {
        capturedAt: "2026-04-25T12:10:00.000Z",
        answers: { issue_type: "deposit", urgent: false },
      },
    });
    const ineligible = await server.inject({
      method: "POST",
      url: "/api/intake-sessions/intake-session-001/generated-packages",
      payload: { packageId: "urgent_review_package" },
    });

    expect(missingSnapshot.statusCode).toBe(409);
    expect(missingSnapshot.json()).toMatchObject({
      message: "Answer snapshot is required before package generation",
    });
    expect(ineligible.statusCode).toBe(409);
    expect(ineligible.json()).toMatchObject({
      message: "Requested package is not eligible for this intake session",
    });
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "intake_answer_snapshot.created",
          resourceType: "intake_session",
          resourceId: "intake-session-001",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            intakeSessionId: "intake-session-001",
            answerCount: 2,
          }),
        }),
      ]),
      valid: true,
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    const auditEvent = audit.events.find(
      (event) => event.action === "intake_answer_snapshot.created",
    );
    expect(auditEvent?.metadata).not.toHaveProperty("answers");
    expect(auditEvent?.metadata).not.toHaveProperty("issue");
  });

  it("creates generated document records with embedded automation defaults", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/intake-sessions/intake-session-001/generated-documents",
      payload: {
        title: "Embedded notice package",
        documentId: "doc-generated-001",
        storageKey: "generated/embedded-notice-package.pdf",
        checksumSha256: "a".repeat(64),
        evidence: { requestedBy: "route-test" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      intakeSessionId: "intake-session-001",
      provider: "embedded",
      title: "Embedded notice package",
      documentId: "doc-generated-001",
      storageKey: "generated/embedded-notice-package.pdf",
      checksumSha256: "a".repeat(64),
      evidence: expect.objectContaining({ mode: "embedded", requestedBy: "route-test" }),
    });
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "intake_generated_document.created",
          resourceType: "generated_document",
          resourceId: response.json<{ id: string }>().id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            intakeSessionId: "intake-session-001",
            documentId: "doc-generated-001",
            provider: "embedded",
          }),
        }),
      ]),
      valid: true,
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    const auditEvent = audit.events.find(
      (event) => event.action === "intake_generated_document.created",
    );
    expect(auditEvent?.metadata).not.toHaveProperty("evidence");
    expect(auditEvent?.metadata).not.toHaveProperty("storageKey");
    expect(auditEvent?.metadata).not.toHaveProperty("checksumSha256");
    expect(auditEvent?.metadata).not.toHaveProperty("title");
  });

  it("queues intake workflow email through the SMTP outbox when configured", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableSmtp(repository);
    const response = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/intake-sessions/intake-session-001/generated-documents",
      payload: {
        title: "Embedded notice package",
        documentId: "doc-generated-email-001",
        storageKey: "generated/embedded-notice-package-email.pdf",
        checksumSha256: "a".repeat(64),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      queuedEmail: {
        templateKey: "intake.generated_document.created",
        status: "queued",
      },
    });
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queueName: "email",
          jobName: "send_email",
          targetResourceType: "email_outbox",
          metadata: expect.objectContaining({
            provider: "mailpit",
            templateKey: "intake.generated_document.created",
            recipientCount: 1,
            relatedResourceType: "generated_document",
          }),
        }),
      ]),
    );
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "email_outbox.queued",
          resourceType: "email_outbox",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            templateKey: "intake.generated_document.created",
            recipientCount: 1,
          }),
        }),
      ]),
      valid: true,
    });
  });

  it("keeps unauthorized answer snapshot access at 403", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-sessions",
      payload: {
        matterId: "matter-002",
        templateId: "intake-template-001",
        clientContactId: "contact-northstar",
      },
    });
    const response = await server.inject({
      method: "GET",
      url: `/api/intake-sessions/${created.json<{ id: string }>().id}/answer-snapshots`,
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(created.statusCode).toBe(200);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Intake session access required",
    });
  });

  it("returns legacy top-level error shape for invalid intake requests", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/intake-sessions",
      payload: {
        matterId: "",
        templateId: "intake-template-001",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
    expect(response.json()).not.toHaveProperty("success");
  });

  it("rejects generated documents for deprecated docassemble intake sessions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createIntakeSession(intakeSessionRecord());
    const response = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/intake-sessions/intake-docassemble-001/generated-documents",
      payload: { title: "Deprecated package" },
    });

    expect(response.statusCode).toBe(410);
    expect(response.json()).toMatchObject({
      error: "Error",
      message: "docassemble generated documents are deprecated",
    });
  });
});
