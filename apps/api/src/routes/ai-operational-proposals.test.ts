import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { authorizationFixtureCases, type AiOperationalProposalRecord } from "@open-practice/domain";
import { FakeDraftAssistProvider } from "@open-practice/providers";
import { createApiServer } from "../server.js";
import type { ApiJobQueue } from "./types.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];

const editorJson = {
  type: "doc" as const,
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Synthetic draft with a filing deadline and client update." },
      ],
    },
  ],
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

function fakeAiProposalQueue() {
  const jobs: Array<{ name: string; data: unknown; jobId?: string }> = [];
  const queue: ApiJobQueue = {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? "bull-ai-proposal-job" };
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
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  });
}

async function createDraft(
  repository: InMemoryOpenPracticeRepository,
  matterId = "matter-001",
): Promise<string> {
  const created = await repository.createDraft({
    id: `ai-proposal-source-${matterId}`,
    firmId: "firm-west-legal",
    matterId,
    title: "Synthetic proposal draft",
    editorJson,
    version: 1,
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    metadata: {},
  });
  return created.id;
}

async function createMatterTwoProposal(
  repository: InMemoryOpenPracticeRepository,
): Promise<AiOperationalProposalRecord> {
  return repository.createAiOperationalProposal({
    id: "ai-proposal-matter-002",
    firmId: "firm-west-legal",
    matterId: "matter-002",
    kind: "task_creation",
    status: "proposed",
    source: {
      sourceType: "draft",
      draftId: "draft-matter-002",
      sourceLabel: "Synthetic matter 002 draft",
      sourceTextLength: 128,
      confidence: "low",
    },
    providerKey: "fake-local-ai",
    providerModel: "fake-operational-proposals-v1",
    proposal: {
      title: "Review synthetic matter 002 follow-up",
      summary: "Synthetic cross-matter proposal for authorization matrix coverage.",
      proposedAction: "Review before creating any task record.",
      task: { title: "Review follow-up" },
    },
    createdByUserId: "user-admin",
    createdAt: "2026-06-01T18:00:00.000Z",
    updatedAt: "2026-06-01T18:00:00.000Z",
    metadata: { source: "test", statusOnlyReview: true },
  });
}

function fixtureCase(id: string) {
  const match = authorizationFixtureCases.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing authorization fixture case ${id}`);
  return match;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("AI operational proposal routes", () => {
  it("lists matter-scoped proposals with summary and disabled generation posture", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/ai-operational-proposals?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: {
        total: 2,
        proposed: 1,
        approved: 1,
        statusOnlyReview: true,
      },
      generation: {
        status: "disabled",
        reason: "not_configured",
        jobName: "operational_action_proposals",
      },
    });
    expect(response.body).not.toContain("storage://");
  });

  it("keeps list-query visibility aligned with authorization fixtures", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createMatterTwoProposal(repository);
    await repository.createUser({
      id: "client-ada",
      firmId: "firm-west-legal",
      displayName: "Synthetic Portal Client",
      email: "portal-client@example.test",
      role: "client_external",
      assignedMatterIds: ["matter-001"],
      mfaEnabled: true,
    });

    expect(
      authorizationFixtureCases
        .filter((item) => item.family === "ai_proposal")
        .map((item) => ({
          id: item.id,
          listVisible: item.listVisible,
        })),
    ).toEqual([
      { id: "ai-proposal:firm-wide:list-all", listVisible: true },
      { id: "ai-proposal:assigned:list-visible", listVisible: true },
      { id: "ai-proposal:unassigned:list-hidden", listVisible: false },
      { id: "ai-proposal:portal-client:staff-list-denied", listVisible: false },
    ]);

    const ownerResponse = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/ai-operational-proposals",
    });
    const assignedResponse = await testServer({ repository, devUserId: "user-licensee" }).inject({
      method: "GET",
      url: "/api/ai-operational-proposals",
    });
    const unassignedMatterResponse = await testServer({
      repository,
      devUserId: "user-licensee",
    }).inject({
      method: "GET",
      url: "/api/ai-operational-proposals?matterId=matter-002",
    });
    const portalClientResponse = await testServer({
      repository,
      devUserId: "client-ada",
    }).inject({
      method: "GET",
      url: "/api/ai-operational-proposals?matterId=matter-001",
    });

    expect(ownerResponse.statusCode).toBe(200);
    expect(
      ownerResponse.json<{ proposals: Array<{ id: string }> }>().proposals.map((item) => item.id),
    ).toEqual(
      expect.arrayContaining([
        fixtureCase("ai-proposal:assigned:list-visible").resourceId,
        fixtureCase("ai-proposal:firm-wide:list-all").resourceId,
      ]),
    );

    expect(assignedResponse.statusCode).toBe(200);
    const assignedProposalIds = assignedResponse
      .json<{ proposals: Array<{ id: string }> }>()
      .proposals.map((item) => item.id);
    expect(assignedProposalIds).toEqual(
      expect.arrayContaining([fixtureCase("ai-proposal:assigned:list-visible").resourceId]),
    );
    expect(assignedProposalIds).not.toContain(
      fixtureCase("ai-proposal:unassigned:list-hidden").resourceId,
    );
    expect(assignedResponse.json()).toMatchObject({
      summary: { total: 2, proposed: 1, approved: 1 },
    });

    expect(unassignedMatterResponse.statusCode).toBe(403);
    expect(portalClientResponse.statusCode).toBe(403);
  });

  it("queues draft-sourced operational proposal jobs with redacted lifecycle metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableAi(repository);
    const draftId = await createDraft(repository);
    const { queue, jobs } = fakeAiProposalQueue();
    const server = testServer({
      repository,
      aiOperationalProposalProvider: new FakeDraftAssistProvider({ model: "fake-model" }),
      aiAssistJobQueue: queue,
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/operational-proposals/jobs`,
      payload: {
        proposalKinds: ["deadline_extraction", "task_creation"],
        clientRequestId: "ai-proposal-client-request-001",
      },
    });
    const lifecycle = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "ai_triage",
    });
    const audit = await repository.listAuditEvents("firm-west-legal");

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      status: "queued",
      sourceType: "draft",
      draftId,
      proposalKinds: ["deadline_extraction", "task_creation"],
      job: {
        queueName: "ai_triage",
        jobName: "operational_action_proposals",
        metadata: {
          matterId: "matter-001",
          draftId,
          proposalKinds: "deadline_extraction,task_creation",
          proposalKindCount: 2,
          sourceTextLength: 57,
        },
      },
    });
    expect(jobs).toEqual([
      expect.objectContaining({
        name: "operational_action_proposals",
        data: expect.objectContaining({
          resourceType: "draft",
          resourceId: draftId,
        }),
      }),
    ]);
    expect(JSON.stringify(lifecycle)).not.toContain("Synthetic draft with a filing deadline");
    expect(
      audit.events.find((event) => event.action === "ai_operational_proposal.async_queued"),
    ).toMatchObject({
      resourceType: "ai_proposal",
      metadata: expect.objectContaining({
        proposalKindCount: 2,
        sourceTextLength: 57,
      }),
    });
  });

  it("keeps generation disabled until AI provider and queue are configured", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const draftId = await createDraft(repository);
    const disabled = await testServer({ repository }).inject({
      method: "POST",
      url: `/api/drafts/${draftId}/operational-proposals/jobs`,
      payload: { proposalKinds: ["task_creation"] },
    });
    await enableAi(repository);
    const withoutQueue = await testServer({
      repository,
      aiOperationalProposalProvider: new FakeDraftAssistProvider(),
    }).inject({
      method: "POST",
      url: `/api/drafts/${draftId}/operational-proposals/jobs`,
      payload: { proposalKinds: ["task_creation"] },
    });

    expect(disabled.statusCode).toBe(503);
    expect(disabled.json()).toMatchObject({ code: "ai_operational_proposals_not_configured" });
    expect(withoutQueue.statusCode).toBe(503);
    expect(withoutQueue.json()).toMatchObject({
      code: "ai_operational_proposals_queue_not_configured",
    });
  });

  it("queues document proposals only after completed extraction", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableAi(repository);
    const { queue } = fakeAiProposalQueue();
    const server = testServer({
      repository,
      aiOperationalProposalProvider: new FakeDraftAssistProvider({ model: "fake-model" }),
      aiAssistJobQueue: queue,
    });

    const missing = await server.inject({
      method: "POST",
      url: "/api/documents/doc-001/operational-proposals/jobs",
      payload: { proposalKinds: ["document_organization"] },
    });
    await repository.createDocumentTextExtraction({
      id: "extract-ai-proposal-001",
      firmId: "firm-west-legal",
      documentId: "doc-001",
      engine: "manual",
      status: "completed",
      language: "eng",
      extractedText: "Synthetic extracted text for organization proposals.",
      metadata: {},
      createdAt: "2026-06-01T00:00:00.000Z",
      completedAt: "2026-06-01T00:00:00.000Z",
    });
    const success = await server.inject({
      method: "POST",
      url: "/api/documents/doc-001/operational-proposals/jobs",
      payload: { proposalKinds: ["document_organization"] },
    });

    expect(missing.statusCode).toBe(409);
    expect(success.statusCode).toBe(202);
    expect(success.json()).toMatchObject({
      sourceType: "document",
      documentId: "doc-001",
      proposalKinds: ["document_organization"],
    });
  });

  it("reviews proposals without creating downstream operational records", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const beforeTasks = await repository.listTaskDeadlines("firm-west-legal", {
      matterId: "matter-001",
      includeCompleted: true,
    });
    const server = testServer({ repository });
    const response = await server.inject({
      method: "PATCH",
      url: "/api/ai-operational-proposals/ai-proposal-deadline-001/review",
      payload: { decision: "approved" },
    });
    const afterTasks = await repository.listTaskDeadlines("firm-west-legal", {
      matterId: "matter-001",
      includeCompleted: true,
    });
    const audit = await repository.listAuditEvents("firm-west-legal");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "ai-proposal-deadline-001",
      status: "approved",
      reviewDecision: "approved",
      reviewedByUserId: "user-admin",
    });
    expect(afterTasks).toHaveLength(beforeTasks.length);
    const event = audit.events.find(
      (candidate) => candidate.action === "ai_operational_proposal.reviewed",
    );
    expect(event).toMatchObject({
      resourceType: "ai_proposal",
      resourceId: "ai-proposal-deadline-001",
      metadata: expect.objectContaining({
        proposalKind: "deadline_extraction",
        decision: "approved",
      }),
    });
    expect(JSON.stringify(event?.metadata)).not.toContain("Synthetic deadline proposal");
  });

  it("denies cross-matter proposal generation", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableAi(repository);
    const draftId = await createDraft(repository, "matter-002");
    const { queue } = fakeAiProposalQueue();
    const response = await testServer({
      repository,
      devUserId: "user-staff",
      aiOperationalProposalProvider: new FakeDraftAssistProvider(),
      aiAssistJobQueue: queue,
    }).inject({
      method: "POST",
      url: `/api/drafts/${draftId}/operational-proposals/jobs`,
      payload: { proposalKinds: ["task_creation"] },
    });

    expect(response.statusCode).toBe(403);
  });
});
