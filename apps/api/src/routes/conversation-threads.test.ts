import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { registerConversationThreadRoutes } from "./conversation-threads.js";
import type { ApiJobQueue } from "./types.js";

const servers: FastifyInstance[] = [];
type QueuedReportJob = { name: string; data: unknown; jobId?: string };

function futureIso(msFromNow = 7 * 24 * 60 * 60 * 1000): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

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
  reportJobQueue?: ApiJobQueue;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  const authUser = input.authUser ?? user("licensee", ["matter-001", "matter-002"]);
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerConversationThreadRoutes(server, {
    repository: input.repository,
    reportJobQueue: input.reportJobQueue,
  });
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

function fakeReportQueue(jobs: QueuedReportJob[] = []): ApiJobQueue {
  return {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? name };
    },
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("conversation thread routes", () => {
  it("creates and lists matter-scoped threads with boundary fields and redacted audit metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("firm_member", ["matter-001"]) });
    const retentionUntil = futureIso();

    const created = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: {
        matterId: "matter-001",
        topic: "Synthetic intake follow-up",
        retentionUntil,
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
        retentionUntil,
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

  it("creates and lists authorized thread message records without leaking bodies into audit metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const createdThread = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: {
        matterId: "matter-001",
        topic: "Synthetic message thread",
      },
    });
    const createdMessage = await server.inject({
      method: "POST",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/messages`,
      payload: {
        bodyText: "Synthetic privileged message body stays on the message record.",
      },
    });
    const listedMessages = await server.inject({
      method: "GET",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/messages`,
    });

    expect(createdMessage.statusCode).toBe(201);
    expect(createdMessage.json()).toMatchObject({
      message: {
        matterId: "matter-001",
        threadId: createdThread.json().thread.id,
        kind: "internal_note",
        bodyText: "Synthetic privileged message body stays on the message record.",
        authoredByUserId: "user-licensee",
        createdByUserId: "user-licensee",
      },
    });
    expect(listedMessages.statusCode).toBe(200);
    expect(listedMessages.json()).toMatchObject({
      messages: [
        expect.objectContaining({
          id: createdMessage.json().message.id,
          bodyText: "Synthetic privileged message body stays on the message record.",
        }),
      ],
    });
    await expect(
      repository.listConversationMessageNotifications("firm-west-legal", {
        threadId: createdThread.json().thread.id,
        messageId: createdMessage.json().message.id,
      }),
    ).resolves.toEqual([]);

    const audit = await repository.listAuditEvents("firm-west-legal");
    const event = audit.events.find(
      (candidate) => candidate.action === "conversation_message.created",
    );
    expect(event?.metadata).toMatchObject({
      matterId: "matter-001",
      threadId: createdThread.json().thread.id,
      messageId: createdMessage.json().message.id,
      kind: "internal_note",
      authoredByUserIdPresent: true,
      notificationBoundary: "disabled",
      notificationCount: 0,
      unreadNotificationCount: 0,
      mutedNotificationCount: 0,
    });
    expect(JSON.stringify(event?.metadata)).not.toContain("Synthetic privileged message body");
  });

  it("creates staff-only internal notifications for message records on internal-only threads", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const createdThread = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: {
        matterId: "matter-001",
        topic: "Synthetic internal-only notification thread",
        notificationBoundary: "internal_only",
      },
    });
    const createdMessage = await server.inject({
      method: "POST",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/messages`,
      payload: {
        bodyText: "Synthetic internal notification body.",
        kind: "internal_note",
      },
    });

    expect(createdMessage.statusCode).toBe(201);
    const notifications = await repository.listConversationMessageNotifications("firm-west-legal", {
      threadId: createdThread.json().thread.id,
      messageId: createdMessage.json().message.id,
    });
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matterId: "matter-001",
          threadId: createdThread.json().thread.id,
          messageId: createdMessage.json().message.id,
          recipientUserId: "user-admin",
        }),
        expect.objectContaining({
          matterId: "matter-001",
          threadId: createdThread.json().thread.id,
          messageId: createdMessage.json().message.id,
          recipientUserId: "user-staff",
        }),
      ]),
    );
    expect(notifications).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ recipientUserId: "user-licensee" })]),
    );

    const audit = await repository.listAuditEvents("firm-west-legal");
    const event = audit.events.find(
      (candidate) => candidate.action === "conversation_message.created",
    );
    expect(event?.metadata).toMatchObject({
      matterId: "matter-001",
      threadId: createdThread.json().thread.id,
      messageId: createdMessage.json().message.id,
      kind: "internal_note",
      notificationBoundary: "internal_only",
      notificationCount: notifications.length,
      unreadNotificationCount: notifications.length,
      mutedNotificationCount: 0,
    });
  });

  it("denies cross-matter message list and create attempts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const ownerServer = testServer({
      repository,
      authUser: user("owner_admin", ["matter-001", "matter-002"]),
    });
    const createdThread = await ownerServer.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: { matterId: "matter-002", topic: "Synthetic other matter messages" },
    });
    await ownerServer.close();
    servers.splice(servers.indexOf(ownerServer), 1);

    const server = testServer({ repository, authUser: user("firm_member", ["matter-001"]) });
    const deniedList = await server.inject({
      method: "GET",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/messages`,
    });
    const deniedCreate = await server.inject({
      method: "POST",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/messages`,
      payload: { bodyText: "Synthetic forbidden cross-matter body." },
    });

    expect(deniedList.statusCode).toBe(403);
    expect(deniedCreate.statusCode).toBe(403);
    await expect(
      repository.listConversationMessages("firm-west-legal", {
        threadId: createdThread.json().thread.id,
      }),
    ).resolves.toEqual([]);
  });

  it("rejects message creation on closed or revoked threads", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const createdThread = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: { matterId: "matter-001", topic: "Synthetic closed message guard" },
    });
    await server.inject({
      method: "PATCH",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/lifecycle`,
      payload: { action: "close" },
    });
    const rejected = await server.inject({
      method: "POST",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/messages`,
      payload: { bodyText: "Synthetic message after close." },
    });

    expect(rejected.statusCode).toBe(409);
    expect(rejected.json()).toMatchObject({ code: "CONVERSATION_THREAD_NOT_OPEN" });
  });

  it("blocks message reads after access revocation and message creates after retention expiry", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const createdThread = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: { matterId: "matter-001", topic: "Synthetic boundary message guard" },
    });
    await server.inject({
      method: "POST",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/messages`,
      payload: { bodyText: "Synthetic body before revocation." },
    });
    await server.inject({
      method: "PATCH",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/lifecycle`,
      payload: { action: "revoke_access" },
    });

    const revokedRead = await server.inject({
      method: "GET",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/messages`,
    });
    expect(revokedRead.statusCode).toBe(409);
    expect(revokedRead.json()).toMatchObject({ code: "CONVERSATION_THREAD_ACCESS_REVOKED" });

    await repository.createConversationThread({
      id: "conversation-thread-expired-retention",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      topic: "Synthetic retention message guard",
      status: "open",
      retentionUntil: "2026-01-01T00:00:00.000Z",
      exportState: "not_requested",
      notificationBoundary: "disabled",
      createdAt: "2025-12-01T00:00:00.000Z",
      updatedAt: "2025-12-01T00:00:00.000Z",
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
      metadata: {},
    });

    const expiredCreate = await server.inject({
      method: "POST",
      url: "/api/conversation-threads/conversation-thread-expired-retention/messages",
      payload: { bodyText: "Synthetic body after retention expiry." },
    });
    expect(expiredCreate.statusCode).toBe(409);
    expect(expiredCreate.json()).toMatchObject({
      code: "CONVERSATION_THREAD_RETENTION_EXPIRED",
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

  it("queues redacted conversation export requests, gates downloads, and regenerates redacted artifacts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const queuedReports: QueuedReportJob[] = [];
    const server = testServer({
      repository,
      authUser: user("licensee", ["matter-001", "matter-002"]),
      reportJobQueue: fakeReportQueue(queuedReports),
    });

    const createdThread = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: { matterId: "matter-001", topic: "Synthetic export artifact" },
    });
    const createdMessage = await server.inject({
      method: "POST",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/messages`,
      payload: {
        bodyText: "Synthetic privileged export body must stay out of job metadata.",
        kind: "client_message",
      },
    });
    const exportRequestResponse = await server.inject({
      method: "POST",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/export-requests`,
      payload: { idempotencyKey: "synthetic-conversation-export" },
    });

    expect(exportRequestResponse.statusCode).toBe(202);
    const exportRequest = exportRequestResponse.json().exportRequest;
    expect(exportRequest).toMatchObject({
      threadId: createdThread.json().thread.id,
      status: "queued",
      pollUrl: `/api/conversation-threads/${createdThread.json().thread.id}/export-requests/${exportRequest.jobId}`,
      downloadUrl: `/api/conversation-threads/${createdThread.json().thread.id}/export-requests/${exportRequest.jobId}/download`,
    });
    expect(queuedReports).toEqual([
      expect.objectContaining({
        name: "conversation_thread_export",
        jobId: exportRequest.jobId,
        data: expect.objectContaining({
          resourceType: "conversation_thread_export",
          resourceId: exportRequest.jobId,
          metadata: expect.objectContaining({
            reportType: "conversation_thread",
            matterId: "matter-001",
            threadId: createdThread.json().thread.id,
          }),
        }),
      }),
    ]);

    const notReady = await server.inject({
      method: "GET",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/export-requests/${exportRequest.jobId}/download`,
    });
    expect(notReady.statusCode).toBe(409);
    expect(notReady.json()).toMatchObject({ code: "CONVERSATION_EXPORT_NOT_READY" });

    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "reports",
    });
    expect(job).toMatchObject({
      id: exportRequest.jobId,
      jobName: "conversation_thread_export",
      metadata: expect.objectContaining({
        reportType: "conversation_thread",
        reportScope: "matter",
        matterId: "matter-001",
        threadId: createdThread.json().thread.id,
        requestedByUserId: "user-licensee",
        messageCount: 1,
      }),
    });
    expect(JSON.stringify(job?.metadata)).not.toContain("Synthetic privileged export body");

    await repository.updateJobLifecycleRecord("firm-west-legal", exportRequest.jobId, {
      status: "completed",
      finishedAt: "2026-05-26T12:00:00.000Z",
    });
    const download = await server.inject({
      method: "GET",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/export-requests/${exportRequest.jobId}/download`,
    });
    expect(download.statusCode).toBe(200);
    expect(download.json()).toMatchObject({
      exportRequest: { status: "completed" },
      export: {
        reportType: "conversation_thread",
        reportScope: "matter",
        redactionPolicy: "message_bodies_and_metadata_values_redacted",
        thread: { id: createdThread.json().thread.id, matterId: "matter-001" },
        messageCount: 1,
        messages: [
          expect.objectContaining({
            id: createdMessage.json().message.id,
            kind: "client_message",
            bodyLength: "Synthetic privileged export body must stay out of job metadata.".length,
            bodyRedacted: true,
          }),
        ],
      },
    });
    expect(download.json().export.messages[0]).not.toHaveProperty("bodyText");
    expect(JSON.stringify(download.json())).not.toContain("Synthetic privileged export body");

    const audit = await repository.listAuditEvents("firm-west-legal");
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "conversation_thread.export_artifact_requested",
          resourceType: "conversation_thread",
          resourceId: createdThread.json().thread.id,
          metadata: expect.objectContaining({
            jobId: exportRequest.jobId,
            messageCount: 1,
            idempotencyKeyPresent: true,
            enqueueStatus: "queued_for_local_report_worker",
          }),
        }),
      ]),
    );
  });

  it("completes inline exports when the reports queue is not configured", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const createdThread = await server.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: { matterId: "matter-001", topic: "Synthetic inline export" },
    });
    await server.inject({
      method: "POST",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/messages`,
      payload: { bodyText: "Synthetic inline body." },
    });
    const exportRequestResponse = await server.inject({
      method: "POST",
      url: `/api/conversation-threads/${createdThread.json().thread.id}/export-requests`,
      payload: {},
    });

    expect(exportRequestResponse.statusCode).toBe(202);
    expect(exportRequestResponse.json()).toMatchObject({
      exportRequest: { status: "completed", finishedAt: expect.any(String) },
    });
    const download = await server.inject({
      method: "GET",
      url: exportRequestResponse.json().exportRequest.downloadUrl,
    });
    expect(download.statusCode).toBe(200);
    expect(download.json()).toMatchObject({
      export: {
        messageCount: 1,
        messages: [expect.objectContaining({ bodyRedacted: true })],
      },
    });
    expect(JSON.stringify(download.json())).not.toContain("Synthetic inline body");
  });

  it("rejects export requests without permission, wrong thread job paths, or revoked access", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const ownerServer = testServer({
      repository,
      authUser: user("owner_admin", ["matter-001", "matter-002"]),
    });
    const created = await ownerServer.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: { matterId: "matter-001", topic: "Synthetic export guard" },
    });
    const otherThread = await ownerServer.inject({
      method: "POST",
      url: "/api/conversation-threads",
      payload: { matterId: "matter-002", topic: "Synthetic other export guard" },
    });
    await ownerServer.close();
    servers.splice(servers.indexOf(ownerServer), 1);

    const deniedServer = testServer({ repository, authUser: user("firm_member", ["matter-001"]) });
    const denied = await deniedServer.inject({
      method: "POST",
      url: `/api/conversation-threads/${created.json().thread.id}/export-requests`,
      payload: {},
    });
    expect(denied.statusCode).toBe(403);
    await deniedServer.close();
    servers.splice(servers.indexOf(deniedServer), 1);

    const server = testServer({
      repository,
      authUser: user("licensee", ["matter-001", "matter-002"]),
    });
    const exportRequestResponse = await server.inject({
      method: "POST",
      url: `/api/conversation-threads/${created.json().thread.id}/export-requests`,
      payload: {},
    });
    const exportRequest = exportRequestResponse.json().exportRequest;
    const wrongThread = await server.inject({
      method: "GET",
      url: `/api/conversation-threads/${otherThread.json().thread.id}/export-requests/${exportRequest.jobId}`,
    });
    expect(wrongThread.statusCode).toBe(404);
    expect(wrongThread.json()).toMatchObject({ code: "CONVERSATION_EXPORT_NOT_FOUND" });

    await server.inject({
      method: "PATCH",
      url: `/api/conversation-threads/${created.json().thread.id}/lifecycle`,
      payload: { action: "revoke_access" },
    });
    const revokedStatus = await server.inject({
      method: "GET",
      url: `/api/conversation-threads/${created.json().thread.id}/export-requests/${exportRequest.jobId}`,
    });
    const revokedCreate = await server.inject({
      method: "POST",
      url: `/api/conversation-threads/${created.json().thread.id}/export-requests`,
      payload: {},
    });
    expect(revokedStatus.statusCode).toBe(409);
    expect(revokedCreate.statusCode).toBe(409);
    expect(revokedStatus.json()).toMatchObject({ code: "CONVERSATION_THREAD_ACCESS_REVOKED" });
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
