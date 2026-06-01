import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { AuditEvent, NewAuditEvent, ProfessionalRole, User } from "@open-practice/domain";
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
) {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerLegalResearchRoutes(server, { repository });
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
    expect(response.json()).toMatchObject({
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
    });
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

  it("enforces matter scope and staff-only mutation", async () => {
    const crossMatter = await testServer(user("firm_member", ["matter-002"])).server.inject({
      method: "GET",
      url: "/api/legal-research/workspace?matterId=matter-001",
    });
    expect(crossMatter.statusCode).toBe(403);

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
    expect(readOnly.statusCode).toBe(200);
    expect(mutation.statusCode).toBe(403);

    const billing = await testServer(user("billing_bookkeeper", [])).server.inject({
      method: "GET",
      url: "/api/legal-research/workspace?matterId=matter-001",
    });
    expect(billing.statusCode).toBe(403);
  });
});
