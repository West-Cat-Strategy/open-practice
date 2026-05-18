import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { FakeDraftAssistProvider } from "@open-practice/providers";
import { createApiServer } from "../server.js";
import type { ApiJobQueue } from "./types.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];

const editorJson = {
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text: "Synthetic draft text" }] }],
};

function testServer(overrides: Partial<CreateServerOptions> = {}) {
  const repository = overrides.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    webAuthn: {
      rpName: "Test RP",
      rpID: "localhost",
      origin: "http://localhost:3000",
    },
    ...overrides,
  });
  servers.push(server);
  return server;
}

function fakeAiAssistQueue() {
  const jobs: Array<{ name: string; data: unknown; jobId?: string }> = [];
  const queue: ApiJobQueue = {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? "bull-ai-assist-job" };
    },
  };
  return { queue, jobs };
}

async function enableAi(repository: InMemoryOpenPracticeRepository): Promise<void> {
  await repository.upsertProviderSetting({
    id: "provider-ai-fake",
    firmId: "firm-west-legal",
    kind: "ai",
    key: "fake-local-ai",
    enabled: true,
    encryptedConfig: "synthetic",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  });
}

async function createDraft(
  repository: InMemoryOpenPracticeRepository,
  matterId = "matter-001",
): Promise<string> {
  const created = await repository.createDraft({
    id: `draft-assist-source-${matterId}`,
    firmId: "firm-west-legal",
    matterId,
    title: "Synthetic assist draft",
    editorJson,
    version: 1,
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    metadata: {},
  });
  return created.id;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("draft assist routes", () => {
  it("reports disabled status by default and configured status with an injected provider", async () => {
    const disabled = await testServer().inject({
      method: "GET",
      url: "/api/draft-assist/status",
    });
    const repository = new InMemoryOpenPracticeRepository();
    await enableAi(repository);
    const configured = await testServer({
      repository,
      draftAssistProvider: new FakeDraftAssistProvider({ model: "fake-model" }),
    }).inject({
      method: "GET",
      url: "/api/draft-assist/status",
    });

    expect(disabled.statusCode).toBe(200);
    expect(disabled.json()).toMatchObject({
      status: "disabled",
      reason: "not_configured",
      asyncJobs: {
        status: "disabled",
        reason: "not_configured",
        queue: { queueName: "ai_triage", status: "reserved" },
      },
    });
    expect(configured.statusCode).toBe(200);
    expect(configured.json()).toMatchObject({
      status: "configured",
      provider: "fake-local-ai",
      model: "fake-model",
      asyncJobs: {
        status: "disabled",
        reason: "queue_not_configured",
        queue: { queueName: "ai_triage", status: "reserved" },
      },
    });
  });

  it("creates draft assist records without mutating the draft and redacts audit metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableAi(repository);
    const draftId = await createDraft(repository);
    const server = testServer({
      repository,
      draftAssistProvider: new FakeDraftAssistProvider({ model: "fake-model" }),
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/assist`,
      payload: {
        task: "continue_draft",
        instruction: "Use a calm tone.",
        evidence: { rawPromptContext: "not for audit" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      matterId: "matter-001",
      draftId,
      task: "continue_draft",
      status: "suggested",
      providerKey: "fake-local-ai",
      providerModel: "fake-model",
      suggestedText: expect.stringContaining("[continue draft]"),
    });
    await expect(repository.getDraft("firm-west-legal", draftId)).resolves.toMatchObject({
      version: 1,
      editorJson,
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    const event = audit.events.find((candidate) => candidate.action === "draft_assist.created");
    expect(event?.metadata).toMatchObject({
      draftId,
      task: "continue_draft",
      status: "suggested",
      provider: "fake-local-ai",
      model: "fake-model",
    });
    expect(JSON.stringify(event?.metadata)).not.toContain("Synthetic draft text");
    expect(JSON.stringify(event?.metadata)).not.toContain("Use a calm tone");
    expect(JSON.stringify(event?.metadata)).not.toContain("not for audit");
  });

  it("queues draft assist jobs with redacted lifecycle metadata and no source text", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { queue, jobs } = fakeAiAssistQueue();
    await enableAi(repository);
    const draftId = await createDraft(repository);
    const server = testServer({
      repository,
      draftAssistProvider: new FakeDraftAssistProvider({ model: "fake-model" }),
      aiAssistJobQueue: queue,
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/assist/jobs`,
      payload: {
        task: "continue_draft",
        instruction: "Use privileged strategy from the draft.",
        evidence: { rawPromptContext: "privileged evidence" },
        clientRequestId: "draft-assist-client-request-001",
      },
    });

    expect(response.statusCode).toBe(202);
    const payload = response.json();
    expect(payload).toMatchObject({
      status: "queued",
      task: "continue_draft",
      sourceType: "draft",
      draftId,
      job: {
        queueName: "ai_triage",
        jobName: "draft_assist_suggestion",
        status: "queued",
        targetResourceType: "draft",
        targetResourceId: draftId,
        idempotencyKeyPresent: true,
        metadata: {
          matterId: "matter-001",
          sourceType: "draft",
          draftId,
          task: "continue_draft",
          provider: "fake-local-ai",
          requestedByUserId: "user-admin",
          sourceTextLength: "Synthetic draft text".length,
          instructionLength: "Use privileged strategy from the draft.".length,
          evidenceKeyCount: 1,
          idempotencyKeyPresent: true,
        },
      },
    });
    expect(jobs).toEqual([
      {
        name: "draft_assist_suggestion",
        data: expect.objectContaining({
          firmId: "firm-west-legal",
          resourceType: "draft",
          resourceId: draftId,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            sourceType: "draft",
            draftId,
            task: "continue_draft",
            provider: "fake-local-ai",
            requestedByUserId: "user-admin",
          }),
        }),
        jobId: payload.job.id,
      },
    ]);
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual([
      expect.objectContaining({
        id: payload.job.id,
        queueName: "ai_triage",
        jobName: "draft_assist_suggestion",
        bullJobId: payload.job.id,
      }),
    ]);
    const audit = await repository.listAuditEvents("firm-west-legal");
    const queued = audit.events.find(
      (candidate) => candidate.action === "draft_assist.async_queued",
    );
    expect(queued?.metadata).toMatchObject({
      matterId: "matter-001",
      draftId,
      task: "continue_draft",
      provider: "fake-local-ai",
      jobId: payload.job.id,
    });
    const serialized = JSON.stringify({ payload, jobs, audit: queued });
    expect(serialized).not.toContain("Synthetic draft text");
    expect(serialized).not.toContain("Use privileged strategy");
    expect(serialized).not.toContain("privileged evidence");
  });

  it("keeps async assist disabled until the provider and queue are configured", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const draftId = await createDraft(repository);

    const withoutProvider = await testServer({ repository }).inject({
      method: "POST",
      url: `/api/drafts/${draftId}/assist/jobs`,
      payload: { task: "summarize" },
    });
    await enableAi(repository);
    const withoutQueue = await testServer({
      repository,
      draftAssistProvider: new FakeDraftAssistProvider(),
    }).inject({
      method: "POST",
      url: `/api/drafts/${draftId}/assist/jobs`,
      payload: { task: "summarize" },
    });

    expect(withoutProvider.statusCode).toBe(503);
    expect(withoutProvider.json()).toMatchObject({ code: "draft_assist_not_configured" });
    expect(withoutQueue.statusCode).toBe(503);
    expect(withoutQueue.json()).toMatchObject({ code: "draft_assist_queue_not_configured" });
  });

  it("queues document summary assist jobs only after completed extraction", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { queue, jobs } = fakeAiAssistQueue();
    await enableAi(repository);
    const server = testServer({
      repository,
      draftAssistProvider: new FakeDraftAssistProvider(),
      aiAssistJobQueue: queue,
    });

    const missing = await server.inject({
      method: "POST",
      url: "/api/documents/doc-001/assist/jobs",
      payload: { task: "summarize" },
    });
    await repository.createDocumentTextExtraction({
      id: "extract-async-001",
      firmId: "firm-west-legal",
      documentId: "doc-001",
      engine: "manual",
      status: "completed",
      language: "eng",
      extractedText: "Synthetic extracted document text.",
      metadata: {},
      createdAt: "2026-05-01T00:00:00.000Z",
      completedAt: "2026-05-01T00:00:00.000Z",
    });
    const success = await server.inject({
      method: "POST",
      url: "/api/documents/doc-001/assist/jobs",
      payload: { task: "summarize" },
    });

    expect(missing.statusCode).toBe(409);
    expect(success.statusCode).toBe(202);
    expect(success.json()).toMatchObject({
      status: "queued",
      task: "summarize",
      sourceType: "document",
      documentId: "doc-001",
      job: {
        queueName: "ai_triage",
        metadata: {
          matterId: "matter-001",
          documentId: "doc-001",
          task: "summarize",
          sourceTextLength: "Synthetic extracted document text.".length,
        },
      },
    });
    expect(JSON.stringify(jobs)).not.toContain("Synthetic extracted document text");
  });

  it("summarizes documents only after completed text extraction", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableAi(repository);
    const server = testServer({
      repository,
      draftAssistProvider: new FakeDraftAssistProvider({ model: "fake-model" }),
    });

    const missing = await server.inject({
      method: "POST",
      url: "/api/documents/doc-001/assist",
      payload: { task: "summarize" },
    });
    await repository.createDocumentTextExtraction({
      id: "extract-001",
      firmId: "firm-west-legal",
      documentId: "doc-001",
      engine: "manual",
      status: "completed",
      language: "eng",
      extractedText: "Synthetic extracted document text.",
      metadata: {},
      createdAt: "2026-05-01T00:00:00.000Z",
      completedAt: "2026-05-01T00:00:00.000Z",
    });
    const success = await server.inject({
      method: "POST",
      url: "/api/documents/doc-001/assist",
      payload: { task: "summarize" },
    });

    expect(missing.statusCode).toBe(409);
    expect(missing.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Document text extraction is required before draft assist",
    });
    expect(success.statusCode).toBe(200);
    expect(success.json()).toMatchObject({
      sourceType: "document",
      documentId: "doc-001",
      task: "summarize",
      status: "suggested",
    });
  });

  it("lists records by matter and records review decisions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableAi(repository);
    const draftId = await createDraft(repository);
    const server = testServer({
      repository,
      draftAssistProvider: new FakeDraftAssistProvider(),
    });
    const created = await server.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/assist`,
      payload: { task: "suggest_revision" },
    });
    const recordId = created.json<{ id: string }>().id;
    const listed = await server.inject({
      method: "GET",
      url: "/api/draft-assist/records?matterId=matter-001",
    });
    const reviewed = await server.inject({
      method: "PATCH",
      url: `/api/draft-assist/records/${recordId}/review`,
      payload: { decision: "rejected" },
    });

    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      records: [expect.objectContaining({ id: recordId, matterId: "matter-001" })],
    });
    expect(reviewed.statusCode).toBe(200);
    expect(reviewed.json()).toMatchObject({
      id: recordId,
      status: "rejected",
      reviewDecision: "rejected",
      reviewedByUserId: "user-admin",
    });
  });

  it("denies cross-matter draft assist", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableAi(repository);
    const draftId = await createDraft(repository, "matter-002");
    const response = await testServer({
      repository,
      devUserId: "user-staff",
      draftAssistProvider: new FakeDraftAssistProvider(),
    }).inject({
      method: "POST",
      url: `/api/drafts/${draftId}/assist`,
      payload: { task: "summarize" },
    });

    expect(response.statusCode).toBe(403);
  });
});
