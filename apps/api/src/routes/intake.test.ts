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

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("intake routes", () => {
  it("lists and creates intake sessions through the extracted registrar", async () => {
    const server = testServer();
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
      templates: [expect.objectContaining({ id: "intake-template-001", provider: "embedded" })],
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
  });

  it("creates and lists answer snapshots", async () => {
    const server = testServer();
    const snapshot = await server.inject({
      method: "POST",
      url: "/api/intake-sessions/intake-session-001/answer-snapshots",
      payload: {
        capturedAt: "2026-04-25T12:10:00.000Z",
        answers: { issue: "repair", urgency: "high" },
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
      answers: { issue: "repair", urgency: "high" },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      snapshots: [expect.objectContaining({ answers: { issue: "repair", urgency: "high" } })],
    });
  });

  it("creates generated document records with embedded automation defaults", async () => {
    const response = await testServer().inject({
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
      message: "Matter access required",
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
