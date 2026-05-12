import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { InMemoryOpenPracticeRepository } from "../../../../packages/database/src/repository/memory.js";
import { registerConversationThreadRoutes } from "./conversation-threads.js";

const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  const idByRole: Partial<Record<ProfessionalRole, string>> = {
    owner_admin: "user-admin",
    licensee: "user-licensee",
    firm_member: "user-staff",
    auditor: "user-auditor",
  };
  return {
    id: idByRole[role] ?? `user-${role}`,
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
  const authUser = input.authUser ?? user("licensee", ["matter-001", "matter-002"]);
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerConversationThreadRoutes(server, { repository: input.repository });
  server.setErrorHandler((error, _request, reply) => {
    const normalizedError = error as Error & { statusCode?: number; code?: string };
    reply.status(normalizedError.statusCode ?? 400).send({
      error: normalizedError.name,
      code: normalizedError.code,
      message: normalizedError.message,
    });
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("conversation thread routes", () => {
  it("creates and lists matter-scoped threads with boundary fields and redacted audit metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("firm_member", ["matter-001"]) });

    const created = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: {
        matterId: "matter-001",
        topic: "Synthetic intake follow-up",
        retentionUntil: "2026-06-02T00:00:00.000Z",
        exportState: "requested",
        notificationBoundary: "internal_only",
        metadata: {
          privateMessagePreview: "Do not put message text in audit metadata",
        },
      },
    });
    const listed = await server.inject({
      method: "GET",
      url: "/api/conversation-threads?matterId=matter-001",
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      thread: {
        matterId: "matter-001",
        topic: "Synthetic intake follow-up",
        status: "open",
        retentionUntil: "2026-06-02T00:00:00.000Z",
        exportState: "requested",
        notificationBoundary: "internal_only",
        createdByUserId: "user-staff",
      },
    });
    expect(created.json().thread).not.toHaveProperty("metadata");
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      threads: [expect.objectContaining({ topic: "Synthetic intake follow-up" })],
    });
    expect(listed.json().threads[0]).not.toHaveProperty("metadata");
    await expect(
      repository.getConversationThread("firm-west-legal", created.json().thread.id),
    ).resolves.toMatchObject({ metadata: {} });

    const audit = await repository.listAuditEvents("firm-west-legal");
    const event = audit.events.find(
      (candidate) => candidate.action === "conversation_thread.created",
    );
    expect(event?.metadata).toMatchObject({
      matterId: "matter-001",
      threadId: created.json().thread.id,
      status: "open",
      exportState: "requested",
      retentionBoundary: "set",
      notificationBoundary: "internal_only",
      accessRevoked: false,
    });
    expect(JSON.stringify(event?.metadata)).not.toContain("Do not put message text");
  });

  it("reads an authorized thread by id", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const created = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: {
        matterId: "matter-001",
        topic: "Synthetic disclosure checklist",
      },
    });
    const read = await server.inject({
      method: "GET",
      url: `/api/conversation-threads/${created.json().thread.id}`,
    });

    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({
      thread: { matterId: "matter-001", topic: "Synthetic disclosure checklist" },
    });
  });

  it("updates thread lifecycle state with matter-scoped audit metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const created = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: {
        matterId: "matter-001",
        topic: "Synthetic lifecycle thread",
      },
    });
    const close = await server.inject({
      method: "PATCH",
      url: `/api/conversation-threads/${created.json().thread.id}/lifecycle`,
      payload: { action: "close" },
    });
    const reopen = await server.inject({
      method: "PATCH",
      url: `/api/conversation-threads/${created.json().thread.id}/lifecycle`,
      payload: { action: "reopen" },
    });
    const exportRequest = await server.inject({
      method: "PATCH",
      url: `/api/conversation-threads/${created.json().thread.id}/lifecycle`,
      payload: { action: "request_export" },
    });

    expect(close.statusCode).toBe(200);
    expect(close.json()).toMatchObject({
      thread: { status: "closed", exportState: "not_requested" },
    });
    expect(reopen.statusCode).toBe(200);
    expect(reopen.json()).toMatchObject({
      thread: { status: "open" },
    });
    expect(exportRequest.statusCode).toBe(200);
    expect(exportRequest.json()).toMatchObject({
      thread: { status: "open", exportState: "requested" },
    });

    const audit = await repository.listAuditEvents("firm-west-legal");
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "conversation_thread.closed",
          metadata: expect.objectContaining({
            lifecycleAction: "close",
            status: "closed",
            accessRevoked: false,
          }),
        }),
        expect.objectContaining({
          action: "conversation_thread.export_requested",
          metadata: expect.objectContaining({
            lifecycleAction: "request_export",
            exportState: "requested",
          }),
        }),
      ]),
    );
  });

  it("revokes access and denies reopening a revoked thread", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const created = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: {
        matterId: "matter-001",
        topic: "Synthetic revoked lifecycle",
      },
    });
    const revoked = await server.inject({
      method: "PATCH",
      url: `/api/conversation-threads/${created.json().thread.id}/lifecycle`,
      payload: { action: "revoke_access" },
    });
    const reopen = await server.inject({
      method: "PATCH",
      url: `/api/conversation-threads/${created.json().thread.id}/lifecycle`,
      payload: { action: "reopen" },
    });

    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().thread).toMatchObject({
      status: "revoked",
      accessRevokedAt: expect.any(String),
    });
    expect(reopen.statusCode).toBe(409);
    expect(reopen.json()).toMatchObject({ code: "CONVERSATION_THREAD_REVOKED" });
    await expect(
      repository.getConversationThread("firm-west-legal", created.json().thread.id),
    ).resolves.toMatchObject({ status: "revoked", accessRevokedAt: expect.any(String) });
  });

  it("requires export permission for lifecycle export requests", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const ownerServer = testServer({
      repository,
      authUser: user("owner_admin", ["matter-001"]),
    });
    const created = await ownerServer.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: {
        matterId: "matter-001",
        topic: "Synthetic export permission",
      },
    });
    await ownerServer.close();
    servers.splice(servers.indexOf(ownerServer), 1);

    const server = testServer({ repository, authUser: user("firm_member", ["matter-001"]) });
    const denied = await server.inject({
      method: "PATCH",
      url: `/api/conversation-threads/${created.json().thread.id}/lifecycle`,
      payload: { action: "request_export" },
    });

    expect(denied.statusCode).toBe(403);
    await expect(
      repository.getConversationThread("firm-west-legal", created.json().thread.id),
    ).resolves.toMatchObject({ exportState: "not_requested" });
  });

  it("rejects cross-matter list, read, and create attempts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const ownerServer = testServer({
      repository,
      authUser: user("owner_admin", ["matter-001", "matter-002"]),
    });
    const created = await ownerServer.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: { matterId: "matter-002", topic: "Synthetic other matter thread" },
    });
    await ownerServer.close();
    servers.splice(servers.indexOf(ownerServer), 1);

    const server = testServer({ repository, authUser: user("firm_member", ["matter-001"]) });
    const deniedList = await server.inject({
      method: "GET",
      url: "/api/conversation-threads?matterId=matter-002",
    });
    const deniedRead = await server.inject({
      method: "GET",
      url: `/api/conversation-threads/${created.json().thread.id}`,
    });
    const deniedCreate = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: { matterId: "matter-002", topic: "Synthetic forbidden thread" },
    });

    expect(deniedList.statusCode).toBe(403);
    expect(deniedRead.statusCode).toBe(403);
    expect(deniedCreate.statusCode).toBe(403);
    await expect(
      repository.listConversationThreads("firm-west-legal", { matterId: "matter-002" }),
    ).resolves.toHaveLength(1);
  });

  it("requires a future retention boundary when one is provided", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const response = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: {
        matterId: "matter-001",
        topic: "Synthetic stale retention",
        retentionUntil: "2020-01-01T00:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "CONVERSATION_THREAD_RETENTION_EXPIRED",
    });
  });
});
