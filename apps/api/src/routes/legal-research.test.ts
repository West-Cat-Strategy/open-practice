import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { AuditEvent, NewAuditEvent, ProfessionalRole, User } from "@open-practice/domain";
import { authorizationFixtureCases } from "@open-practice/domain/authorization-fixtures";
import { registerLegalResearchRoutes } from "./legal-research.js";

const servers: FastifyInstance[] = [];

class AuditRecordingRepository extends InMemoryOpenPracticeRepository {
  readonly events: AuditEvent[] = [];

  override async appendAuditEvent(event: NewAuditEvent): Promise<AuditEvent> {
    const appended = await super.appendAuditEvent(event);
    this.events.push(appended);
    return appended;
  }
}

function authorizationFixtureCase(id: string) {
  const match = authorizationFixtureCases.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing authorization fixture case ${id}`);
  return match;
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

function testServer(
  authUser: User = user("owner_admin", ["matter-001", "matter-002"]),
  repository = new AuditRecordingRepository(),
  options: {
    aiAssistJobQueue?: {
      add(
        name: string,
        data: {
          firmId: string;
          resourceType?: string;
          resourceId?: string;
          metadata?: Record<string, unknown>;
        },
        options?: { jobId?: string; delay?: number },
      ): Promise<{ id?: string | number }>;
    };
  } = {},
) {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerLegalResearchRoutes(server, { repository, aiAssistJobQueue: options.aiAssistJobQueue });
  servers.push(server);
  return { server, repository };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("legal research routes", () => {
  it("returns a matter-scoped workspace with disabled provider posture", async () => {
    const { server } = testServer();
    const response = await server.inject({
      method: "GET",
      url: "/api/legal-research/workspace?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      status: "available",
      matterId: "matter-001",
      summary: {
        total: 3,
        sourceReferenceCount: 1,
        documentAnalysisCount: 1,
        reviewOnly: true,
      },
      provider: {
        status: "disabled",
        reason: "not_configured",
        liveResearchProvider: false,
      },
      policy: {
        liveResearchProvider: false,
        scrapedAuthorityStorage: false,
        automatedLegalAdvice: false,
        citationVerificationClaims: false,
        downstreamMutation: false,
      },
      citationPacketReadiness: {
        sourceReferenceCount: 1,
        sourceReferenceCountsByType: {
          statute: 1,
          case_law: 0,
        },
        readyForReviewArtifactCount: 1,
        readyForReviewArtifactIds: ["legal-research-source-note-001"],
        openCheckpointCount: 0,
        openCheckpointArtifactIds: [],
        contextLinkCount: 4,
        contextLinkCountsByType: {
          matter: 2,
          document: 2,
        },
        staffReviewReady: true,
        blockedReasons: [],
        reservedProviderJobPosture: "reserved_no_provider_execution",
        providerExecuted: false,
        authorityScraped: false,
        sourceTextStored: false,
        promptStored: false,
        providerEvidenceStored: false,
        citationVerificationClaimed: false,
        legalAdviceGenerated: false,
        downstreamMutation: false,
        reviewOnly: true,
      },
    });
    expect(JSON.stringify(body.citationPacketReadiness)).not.toContain(
      "Residential tenancy statute review label",
    );
    expect(JSON.stringify(body.citationPacketReadiness)).not.toContain(
      "Staff-entered citation label",
    );
    expect(JSON.stringify(body.citationPacketReadiness)).not.toContain(
      "Synthetic metadata-only review note",
    );
  });

  it("creates and reviews artifacts without downstream mutations or raw audit text", async () => {
    const { server, repository } = testServer(user("licensee", ["matter-001"]));
    const tasksBefore = await repository.listTaskDeadlines("firm-west-legal", {
      matterId: "matter-001",
      includeCompleted: true,
    });
    const createResponse = await server.inject({
      method: "POST",
      url: "/api/legal-research/artifacts",
      payload: {
        matterId: "matter-001",
        kind: "strategy_timeline_note",
        status: "ready_for_review",
        title: "Synthetic strategy note",
        note: "Synthetic research note body stays only on the artifact record.",
        sourceReferences: [{ sourceType: "internal_note", label: "Private source label" }],
        contextLinks: [{ resourceType: "matter", resourceId: "matter-001" }],
        timeline: { noteType: "strategy", dueAt: "2026-06-07T17:00:00.000Z" },
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json<{ id: string }>();
    const reviewResponse = await server.inject({
      method: "PATCH",
      url: `/api/legal-research/artifacts/${created.id}/review`,
      payload: { decision: "reviewed" },
    });
    const tasksAfter = await repository.listTaskDeadlines("firm-west-legal", {
      matterId: "matter-001",
      includeCompleted: true,
    });

    expect(reviewResponse.statusCode).toBe(200);
    expect(reviewResponse.json()).toMatchObject({
      id: created.id,
      status: "reviewed",
      reviewDecision: "reviewed",
      reviewedByUserId: "user-licensee",
    });
    const workspaceResponse = await server.inject({
      method: "GET",
      url: "/api/legal-research/workspace?matterId=matter-001",
    });
    expect(workspaceResponse.statusCode).toBe(200);
    expect(workspaceResponse.json()).toMatchObject({
      citationPacketReadiness: {
        readyForReviewArtifactCount: 1,
        readyForReviewArtifactIds: ["legal-research-source-note-001"],
        sourceReferenceCount: 2,
        staffReviewReady: true,
        providerExecuted: false,
        citationVerificationClaimed: false,
        legalAdviceGenerated: false,
        downstreamMutation: false,
      },
    });
    expect(tasksAfter).toHaveLength(tasksBefore.length);
    const event = repository.events.find(
      (candidate) => candidate.action === "legal_research.artifact.reviewed",
    );
    expect(event).toMatchObject({
      resourceType: "legal_research",
      resourceId: created.id,
      metadata: expect.objectContaining({
        artifactKind: "strategy_timeline_note",
        decision: "reviewed",
        reviewOnly: true,
      }),
    });
    expect(JSON.stringify(event?.metadata)).not.toContain("Synthetic research note body");
    expect(JSON.stringify(event?.metadata)).not.toContain("Private source label");
  });

  it("records and replays metadata-only citation packet decisions when readiness allows it", async () => {
    const { server, repository } = testServer(user("licensee", ["matter-001"]));
    const tasksBefore = await repository.listTaskDeadlines("firm-west-legal", {
      matterId: "matter-001",
      includeCompleted: true,
    });
    const providerJobsBefore = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "ai_triage",
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/legal-research/citation-packet-decisions",
      payload: {
        matterId: "matter-001",
        decision: "ready_for_staff_review",
        prompt: "Synthetic prompt must be rejected",
      },
    });
    expect(response.statusCode).toBe(400);

    const createdResponse = await server.inject({
      method: "POST",
      url: "/api/legal-research/citation-packet-decisions",
      payload: {
        matterId: "matter-001",
        decision: "ready_for_staff_review",
      },
    });

    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json<{
      checkpoint: { id: string };
      workspace: { citationPacketReadiness: Record<string, unknown> };
    }>();
    expect(createdResponse.json()).toMatchObject({
      status: "created",
      decision: "ready_for_staff_review",
      checkpoint: {
        kind: "review_checkpoint",
        status: "reviewed",
        reviewDecision: "reviewed",
        sourceReferences: [],
        contextLinks: [],
        checkpoint: {
          checkpointType: "source_review",
          assignedUserId: "user-licensee",
        },
        metadata: {
          source: "legal_research_citation_packet_decision",
          matterId: "matter-001",
          decision: "ready_for_staff_review",
          decidedByUserId: "user-licensee",
          sourceReferenceCount: 1,
          readyForReviewArtifactCount: 1,
          readyForReviewArtifactIds: ["legal-research-source-note-001"],
          openCheckpointCount: 0,
          openCheckpointArtifactIds: [],
          contextLinkCount: 4,
          metadataOnly: true,
          providerExecuted: false,
          sourceTextStored: false,
          promptStored: false,
          providerEvidenceStored: false,
          citationVerificationClaimed: false,
          legalAdviceGenerated: false,
          downstreamMutation: false,
          reviewOnly: true,
        },
      },
      workspace: {
        status: "available",
        citationPacketReadiness: {
          staffReviewReady: true,
          latestDecision: {
            artifactId: created.checkpoint.id,
            decision: "ready_for_staff_review",
            decidedByUserId: "user-licensee",
            sourceReferenceCount: 1,
            readyForReviewArtifactCount: 1,
            openCheckpointCount: 0,
            metadataOnly: true,
            providerExecuted: false,
            sourceTextStored: false,
            promptStored: false,
            providerEvidenceStored: false,
            citationVerificationClaimed: false,
            legalAdviceGenerated: false,
            downstreamMutation: false,
            reviewOnly: true,
          },
        },
      },
    });
    expect(JSON.stringify(createdResponse.json())).not.toContain("Synthetic prompt");
    expect(JSON.stringify(created.checkpoint)).not.toContain("Residential tenancy statute");
    expect(JSON.stringify(created.checkpoint)).not.toContain("Staff-entered citation label");
    expect(JSON.stringify(created.workspace.citationPacketReadiness)).not.toContain(
      "Residential tenancy statute",
    );
    expect(JSON.stringify(created.workspace.citationPacketReadiness)).not.toContain(
      "Staff-entered citation label",
    );

    const replayResponse = await server.inject({
      method: "POST",
      url: "/api/legal-research/citation-packet-decisions",
      payload: {
        matterId: "matter-001",
        decision: "ready_for_staff_review",
      },
    });
    expect(replayResponse.statusCode).toBe(200);
    expect(replayResponse.json()).toMatchObject({
      status: "existing",
      checkpoint: { id: created.checkpoint.id },
      workspace: {
        citationPacketReadiness: {
          latestDecision: {
            artifactId: created.checkpoint.id,
            decision: "ready_for_staff_review",
          },
        },
      },
    });

    const tasksAfter = await repository.listTaskDeadlines("firm-west-legal", {
      matterId: "matter-001",
      includeCompleted: true,
    });
    const providerJobsAfter = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "ai_triage",
    });
    expect(tasksAfter).toHaveLength(tasksBefore.length);
    expect(providerJobsAfter).toHaveLength(providerJobsBefore.length);
    expect(await repository.listLegalResearchArtifacts("firm-west-legal", {})).toHaveLength(4);

    const event = repository.events.find(
      (candidate) => candidate.action === "legal_research.citation_packet_decision.recorded",
    );
    expect(event).toMatchObject({
      resourceType: "legal_research",
      resourceId: created.checkpoint.id,
      metadata: expect.objectContaining({
        artifactKind: "review_checkpoint",
        citationPacketDecision: "ready_for_staff_review",
        sourceReferenceCount: 1,
        readyForReviewArtifactCount: 1,
        openCheckpointCount: 0,
        metadataOnly: true,
        providerExecuted: false,
        sourceTextStored: false,
        promptStored: false,
        providerEvidenceStored: false,
        citationVerificationClaimed: false,
        legalAdviceGenerated: false,
        downstreamMutation: false,
        reviewOnly: true,
      }),
    });
    expect(JSON.stringify(event?.metadata)).not.toContain("Residential tenancy statute");
    expect(JSON.stringify(event?.metadata)).not.toContain("Staff-entered citation label");
    expect(JSON.stringify(event?.metadata)).not.toContain("Synthetic prompt");
    expect(
      repository.events.filter(
        (candidate) => candidate.action === "legal_research.citation_packet_decision.recorded",
      ),
    ).toHaveLength(1);
  });

  it("rejects citation packet decisions until source references and checkpoints allow review", async () => {
    const { server } = testServer(user("owner_admin", ["matter-001"]));
    const blockedByOpenCheckpoint = await server.inject({
      method: "POST",
      url: "/api/legal-research/citation-packet-decisions",
      payload: {
        matterId: "matter-002",
        decision: "needs_source_review",
      },
    });

    expect(blockedByOpenCheckpoint.statusCode).toBe(409);
    expect(blockedByOpenCheckpoint.json()).toMatchObject({
      message: "Legal research citation packet is not ready for a decision",
    });
  });

  it("records a reserved provider job boundary without prompts, source text, or provider evidence", async () => {
    const { server, repository } = testServer(user("licensee", ["matter-001"]));
    const rejectedPrompt = await server.inject({
      method: "POST",
      url: "/api/legal-research/provider-jobs",
      payload: {
        matterId: "matter-001",
        requestType: "citation_review",
        prompt: "Synthetic prompt must not be accepted",
      },
    });
    expect(rejectedPrompt.statusCode).toBe(400);

    const response = await server.inject({
      method: "POST",
      url: "/api/legal-research/provider-jobs",
      payload: {
        matterId: "matter-001",
        requestType: "citation_review",
        artifactIds: ["legal-research-source-note-001"],
        sourceTypes: ["case_law", "statute", "case_law"],
        citationReferenceCount: 3,
        contextLinkCount: 1,
        jurisdiction: "BC",
        clientRequestId: "legal-research-citation-review-001",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      status: "reserved",
      job: {
        queueName: "ai_triage",
        jobName: "legal_research_provider_review",
        status: "skipped",
        targetResourceType: "legal_research",
        targetResourceId: "matter-001",
        terminal: true,
        idempotencyKeyPresent: true,
        metadata: {
          matterId: "matter-001",
          requestType: "citation_review",
          sourceTypes: "case_law,statute",
          sourceTypeCount: 2,
          citationReferenceCount: 3,
          contextLinkCount: 1,
          artifactCount: 1,
          provider: "reserved_legal_research_provider",
          providerStatus: "reserved",
          providerConfigured: false,
          citationReviewRequired: true,
          sourceTextIncluded: false,
          promptIncluded: false,
          providerEvidenceStored: false,
          citationVerificationClaims: false,
          downstreamMutation: false,
          reviewOnly: true,
        },
      },
      citationReview: {
        staffReviewRequired: true,
        citationVerificationClaims: false,
        providerEvidenceStored: false,
        sourceTextSubmittedToProvider: false,
        promptSubmittedToProvider: false,
        downstreamMutation: false,
      },
      providerJobBoundary: {
        queueName: "ai_triage",
        jobName: "legal_research_provider_review",
        status: "reserved",
        providerConfigured: false,
        liveResearchProvider: false,
      },
    });
    expect(JSON.stringify(response.json())).not.toContain("Synthetic prompt");
    expect(JSON.stringify(response.json())).not.toContain("Synthetic source");

    const workspace = await server.inject({
      method: "GET",
      url: "/api/legal-research/workspace?matterId=matter-001",
    });
    expect(workspace.statusCode).toBe(200);
    expect(workspace.json()).toMatchObject({
      providerJobSummary: {
        total: 1,
        skipped: 1,
        reviewOnly: true,
      },
      providerJobs: [
        {
          queueName: "ai_triage",
          jobName: "legal_research_provider_review",
          status: "skipped",
        },
      ],
    });

    const event = repository.events.find(
      (candidate) => candidate.action === "legal_research.provider_job.recorded",
    );
    expect(event).toMatchObject({
      resourceType: "legal_research",
      resourceId: response.json<{ job: { id: string } }>().job.id,
      metadata: expect.objectContaining({
        matterId: "matter-001",
        requestType: "citation_review",
        citationReviewRequired: true,
        promptIncluded: false,
        sourceTextIncluded: false,
        providerEvidenceStored: false,
      }),
    });
    expect(JSON.stringify(event?.metadata)).not.toContain("Synthetic prompt");
    expect(JSON.stringify(event?.metadata)).not.toContain("Synthetic source");
    expect(await repository.listLegalResearchArtifacts("firm-west-legal", {})).toHaveLength(3);
  });

  it("queues only safe provider job metadata when the AI queue is configured", async () => {
    const queued: Array<{
      name: string;
      data: { metadata?: Record<string, unknown> };
      options?: { jobId?: string };
    }> = [];
    const { server, repository } = testServer(user("owner_admin", ["matter-001"]), undefined, {
      aiAssistJobQueue: {
        async add(name, data, options) {
          queued.push({ name, data, options });
          return { id: `bull-${options?.jobId ?? "missing"}` };
        },
      },
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/legal-research/provider-jobs",
      payload: {
        matterId: "matter-001",
        requestType: "citation_review",
        citationReferenceCount: 2,
        contextLinkCount: 1,
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      status: "queued",
      job: {
        status: "queued",
        bullJobId: expect.stringMatching(/^bull-/),
        metadata: {
          requestType: "citation_review",
          citationReferenceCount: 2,
          contextLinkCount: 1,
          providerStatus: "reserved",
          promptIncluded: false,
          sourceTextIncluded: false,
          providerEvidenceStored: false,
        },
      },
    });
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      name: "legal_research_provider_review",
      data: {
        metadata: {
          matterId: "matter-001",
          requestType: "citation_review",
          citationReferenceCount: 2,
          contextLinkCount: 1,
          providerStatus: "reserved",
          promptIncluded: false,
          sourceTextIncluded: false,
          providerEvidenceStored: false,
        },
      },
    });
    expect(JSON.stringify(queued[0])).not.toContain("Synthetic prompt");
    expect(JSON.stringify(queued[0])).not.toContain("Synthetic source");
    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "ai_triage",
    });
    expect(job).toMatchObject({
      jobName: "legal_research_provider_review",
      status: "queued",
      bullJobId: response.json<{ job: { bullJobId: string } }>().job.bullJobId,
    });
  });

  it("enforces matter scope and staff-only mutation", async () => {
    const crossMatter = await testServer(user("firm_member", ["matter-002"])).server.inject({
      method: "GET",
      url: "/api/legal-research/workspace?matterId=matter-001",
    });
    expect(crossMatter.statusCode).toBe(403);
    const crossMatterDecision = await testServer(user("firm_member", ["matter-002"])).server.inject(
      {
        method: "POST",
        url: "/api/legal-research/citation-packet-decisions",
        payload: {
          matterId: "matter-001",
          decision: "ready_for_staff_review",
        },
      },
    );
    expect(crossMatterDecision.statusCode).toBe(403);

    const auditor = testServer(user("auditor", []));
    const readOnly = await auditor.server.inject({
      method: "GET",
      url: "/api/legal-research/workspace?matterId=matter-001",
    });
    const mutation = await auditor.server.inject({
      method: "PATCH",
      url: "/api/legal-research/artifacts/legal-research-source-note-001/review",
      payload: { decision: "reviewed" },
    });
    const citationPacketDecision = await auditor.server.inject({
      method: "POST",
      url: "/api/legal-research/citation-packet-decisions",
      payload: {
        matterId: "matter-001",
        decision: "ready_for_staff_review",
      },
    });
    expect(readOnly.statusCode).toBe(200);
    expect(mutation.statusCode).toBe(403);
    expect(citationPacketDecision.statusCode).toBe(403);

    const billing = await testServer(user("billing_bookkeeper", [])).server.inject({
      method: "GET",
      url: "/api/legal-research/workspace?matterId=matter-001",
    });
    expect(billing.statusCode).toBe(403);
  });

  it("matches citation packet readiness authorization fixtures", async () => {
    const fixtureIds = authorizationFixtureCases
      .filter((item) => item.family === "legal_research_citation_packet")
      .map((item) => item.id);
    expect(fixtureIds).toEqual([
      "legal-research-citation-packet:assigned:list-visible",
      "legal-research-citation-packet:auditor:list-visible",
      "legal-research-citation-packet:unassigned:list-hidden",
      "legal-research-citation-packet:bookkeeper:list-denied",
      "legal-research-citation-packet:portal-client:list-denied",
    ]);
    const assignedCase = authorizationFixtureCase(
      "legal-research-citation-packet:assigned:list-visible",
    );
    const auditorCase = authorizationFixtureCase(
      "legal-research-citation-packet:auditor:list-visible",
    );
    const unassignedCase = authorizationFixtureCase(
      "legal-research-citation-packet:unassigned:list-hidden",
    );
    const bookkeeperCase = authorizationFixtureCase(
      "legal-research-citation-packet:bookkeeper:list-denied",
    );
    const portalCase = authorizationFixtureCase(
      "legal-research-citation-packet:portal-client:list-denied",
    );

    const assigned = await testServer(user("licensee", [assignedCase.matterId!])).server.inject({
      method: "GET",
      url: `/api/legal-research/workspace?matterId=${assignedCase.matterId}`,
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json()).toMatchObject({
      citationPacketReadiness: expect.objectContaining({
        readyForReviewArtifactIds: expect.arrayContaining([assignedCase.resourceId]),
        reviewOnly: true,
        providerExecuted: false,
        sourceTextStored: false,
        promptStored: false,
        providerEvidenceStored: false,
        downstreamMutation: false,
      }),
    });
    expect(assignedCase.expectedDecision).toBe("allow");
    expect(assignedCase.listVisible).toBe(true);

    const auditor = await testServer(user("auditor", [])).server.inject({
      method: "GET",
      url: `/api/legal-research/workspace?matterId=${auditorCase.matterId}`,
    });
    expect(auditor.statusCode).toBe(200);
    expect(auditor.json().citationPacketReadiness.readyForReviewArtifactIds).toContain(
      auditorCase.resourceId,
    );
    expect(auditorCase.expectedDecision).toBe("allow");
    expect(auditorCase.listVisible).toBe(true);

    const unassigned = await testServer(user("firm_member", ["matter-001"])).server.inject({
      method: "GET",
      url: `/api/legal-research/workspace?matterId=${unassignedCase.matterId}`,
    });
    expect(unassigned.statusCode).toBe(403);
    expect(unassignedCase.expectedDecision).toBe("deny");
    expect(unassignedCase.listVisible).toBe(false);

    const bookkeeper = await testServer(user("billing_bookkeeper", [])).server.inject({
      method: "GET",
      url: `/api/legal-research/workspace?matterId=${bookkeeperCase.matterId}`,
    });
    expect(bookkeeper.statusCode).toBe(403);
    expect(bookkeeperCase.expectedDecision).toBe("deny");
    expect(bookkeeperCase.listVisible).toBe(false);

    const portal = await testServer(user("client_external", [portalCase.matterId!])).server.inject({
      method: "GET",
      url: `/api/legal-research/workspace?matterId=${portalCase.matterId}`,
    });
    expect(portal.statusCode).toBe(403);
    expect(portalCase.expectedDecision).toBe("deny");
    expect(portalCase.listVisible).toBe(false);
  });
});
