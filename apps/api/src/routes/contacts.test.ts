import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import type { Contact, ProfessionalRole, User } from "@open-practice/domain";
import { registerContactRoutes } from "./contacts.js";

const servers: FastifyInstance[] = [];

function user(
  role: ProfessionalRole,
  assignedMatterIds: string[] = ["matter-001", "matter-002"],
): User {
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
  input: {
    repository?: OpenPracticeRepository;
    user?: User;
  } = {},
): FastifyInstance {
  const repository = input.repository ?? new InMemoryOpenPracticeRepository();
  const authUser = input.user ?? user("owner_admin");
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerContactRoutes(server, { repository });
  server.setErrorHandler((error, _request, reply) => {
    const normalizedError = error as Error & { statusCode?: number };
    reply.status(normalizedError.statusCode ?? 400).send({
      error: normalizedError.name,
      message: normalizedError.message,
    });
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("contact routes", () => {
  it("returns read-only contact dossiers for accessible matters only", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createIntakeVariableProposals([
      {
        id: "proposal-contact-name",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        intakeSessionId: "intake-001",
        answerSnapshotId: "snapshot-001",
        sourceQuestionId: "client_display_name",
        targetScope: "client",
        targetField: "displayName",
        targetRecordId: "contact-ada",
        proposedValue: "Ada M. Nguyen",
        status: "approved",
        createdAt: "2026-05-01T10:00:00.000Z",
        reviewedByUserId: "user-licensee",
        reviewedAt: "2026-05-01T11:00:00.000Z",
        appliedAt: "2026-05-01T11:00:00.000Z",
      },
    ]);
    await repository.runConflictCheck({
      firmId: "firm-west-legal",
      actorId: "user-licensee",
      prospectiveName: "River City Rentals",
      includeClosedMatters: true,
    });
    await repository.runConflictCheck({
      firmId: "firm-west-legal",
      actorId: "user-licensee",
      prospectiveName: "North Star Holdings",
      includeClosedMatters: true,
    });
    const response = await testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/contacts/dossiers" });

    expect(response.statusCode).toBe(200);
    const payload = response.json<
      Array<{
        contact: { id: string };
        matters: unknown[];
        conflictHistory: Array<{
          id: string;
          matchedContactId: string;
          visibleMatchedMatterIds: string[];
          matchCount: number;
          maxSeverity: string;
        }>;
        qualityReview: { summary: { revalidationPromptCount: number }; signals: unknown[] };
      }>
    >();
    expect(payload.map((dossier) => dossier.contact.id)).toEqual(["contact-ada", "contact-river"]);
    expect(payload).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ contact: { id: "contact-northstar" } })]),
    );
    expect(payload.find((dossier) => dossier.contact.id === "contact-ada")).toMatchObject({
      qualityReview: {
        summary: { revalidationPromptCount: 1 },
        signals: [
          expect.objectContaining({
            kind: "protected_party_cue",
            matterId: "matter-001",
          }),
          expect.objectContaining({
            kind: "protected_party_cue",
            matterId: "matter-001",
          }),
          expect.objectContaining({
            kind: "conflict_revalidation",
            sourceRecordId: "proposal-contact-name",
          }),
        ],
      },
      conflictHistory: [],
    });
    const river = payload.find((dossier) => dossier.contact.id === "contact-river")!;
    expect(river.conflictHistory).toEqual([
      expect.objectContaining({
        matchedContactId: "contact-river",
        visibleMatchedMatterIds: ["matter-001"],
        matchCount: 1,
        maxSeverity: "blocker",
      }),
    ]);
    expect(JSON.stringify(payload)).not.toContain("North Star Holdings");
    expect(JSON.stringify(payload)).not.toContain("matter-002");
    expect(JSON.stringify(payload)).not.toContain('"matchedValue":');
    expect(JSON.stringify(payload)).toContain('"matchedValueRedacted":');
  });

  it("returns an audit-safe contact review queue without widening matter visibility", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const visibleContacts = (repository as unknown as { contacts: Contact[] }).contacts;
    const riverContact = visibleContacts.find((contact) => contact.id === "contact-river");
    if (!riverContact) throw new Error("Expected sample contact-river fixture");
    riverContact.identifiers = [{ type: "email", value: "ada@example.test" }];
    await repository.createIntakeVariableProposals([
      {
        id: "proposal-contact-name",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        intakeSessionId: "intake-001",
        answerSnapshotId: "snapshot-001",
        sourceQuestionId: "client_display_name",
        targetScope: "client",
        targetField: "displayName",
        targetRecordId: "contact-ada",
        proposedValue: "Ada M. Nguyen",
        status: "approved",
        createdAt: "2026-05-01T10:00:00.000Z",
        reviewedByUserId: "user-licensee",
        reviewedAt: "2026-05-01T11:00:00.000Z",
        appliedAt: "2026-05-01T11:00:00.000Z",
      },
    ]);

    const response = await testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/contacts/review-queue" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: {
        totalContacts: 2,
        reviewItemCount: 2,
        duplicateCandidateCount: 2,
        sensitivePartyCueCount: 3,
        revalidationPromptCount: 1,
      },
      items: expect.arrayContaining([
        expect.objectContaining({
          contact: expect.objectContaining({ id: "contact-ada" }),
          auditSafe: true,
          signals: expect.arrayContaining([
            expect.objectContaining({
              kind: "conflict_revalidation",
              sourceRecordId: "proposal-contact-name",
            }),
          ]),
        }),
      ]),
    });
    const serialized = JSON.stringify(response.json());
    expect(serialized).not.toContain("contact-northstar");
    expect(serialized).not.toContain("identifiers");
    expect(serialized).not.toContain("sin:");
    expect(serialized).not.toContain("ada@example.test");
    expect(serialized).not.toContain('"matchedValue":');
  });

  it("records reviewer contact quality decisions without mutating contacts or conflicts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const visibleContacts = (repository as unknown as { contacts: Contact[] }).contacts;
    const riverContact = visibleContacts.find((contact) => contact.id === "contact-river");
    if (!riverContact) throw new Error("Expected sample contact-river fixture");
    riverContact.identifiers = [{ type: "email", value: "ada@example.test" }];
    const server = testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/contacts/contact-ada/review-decisions",
      payload: {
        signalKind: "duplicate_candidate",
        decision: "not_duplicate",
        relatedContactIds: ["contact-river"],
        evidence: { reviewedSource: "contact_review_queue", syntheticReview: true },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      firmId: "firm-west-legal",
      contactId: "contact-ada",
      signalKind: "duplicate_candidate",
      decision: "not_duplicate",
      relatedContactIds: ["contact-river"],
      decidedByUserId: "user-licensee",
    });
    expect(response.json()).not.toHaveProperty("matchedValue");
    expect(response.json()).not.toHaveProperty("mergeContactId");
    const list = await server.inject({
      method: "GET",
      url: "/api/contacts/review-decisions?contactId=contact-ada",
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      decisions: [
        expect.objectContaining({
          contactId: "contact-ada",
          signalKind: "duplicate_candidate",
          decision: "not_duplicate",
        }),
      ],
    });
    const serializedList = JSON.stringify(list.json());
    expect(serializedList).not.toContain("contact-northstar");
    expect(serializedList).not.toContain("ada@example.test");

    const audit = await repository.listAuditEvents("firm-west-legal");
    const event = audit.events.find(
      (candidate) => candidate.action === "contact_quality_decision.recorded",
    );
    expect(event).toMatchObject({
      resourceType: "contact_quality_review_decision",
      metadata: {
        contactId: "contact-ada",
        signalKind: "duplicate_candidate",
        decision: "not_duplicate",
        relatedContactCount: 1,
        evidenceKeyCount: 2,
      },
    });
    expect(event?.metadata).not.toHaveProperty("evidence");
    expect(JSON.stringify(event?.metadata)).not.toContain("matchedValue");
    expect(JSON.stringify(event?.metadata)).not.toContain("contactPatch");
    expect(JSON.stringify(event?.metadata)).not.toContain("conflictDisposition");
  });

  it("rejects destructive or non-current contact quality decisions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    });

    const destructive = await server.inject({
      method: "POST",
      url: "/api/contacts/contact-river/review-decisions",
      payload: {
        signalKind: "protected_party_cue",
        decision: "protected_party_handling_confirmed",
        matterId: "matter-001",
        evidence: { contactPatch: { displayName: "Do not rewrite" } },
      },
    });
    const stale = await server.inject({
      method: "POST",
      url: "/api/contacts/contact-river/review-decisions",
      payload: {
        signalKind: "conflict_revalidation",
        decision: "conflict_revalidation_required",
        matterId: "matter-001",
        sourceRecordId: "proposal-that-is-not-current",
      },
    });
    const hidden = await server.inject({
      method: "POST",
      url: "/api/contacts/contact-northstar/review-decisions",
      payload: {
        signalKind: "protected_party_cue",
        decision: "protected_party_handling_confirmed",
        matterId: "matter-002",
      },
    });

    expect(destructive.statusCode).toBe(400);
    expect(destructive.json()).toMatchObject({
      message: "Contact quality review decision evidence must stay review-only",
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({
      message: "Contact quality decision must reference a visible current review signal",
    });
    expect(hidden.statusCode).toBe(404);
    expect(hidden.json()).toMatchObject({
      message: "Contact dossier is not visible to the current user",
    });
  });

  it("rejects users without contact read access", async () => {
    const dossiers = await testServer({
      user: user("client_external", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/contacts/dossiers" });
    const reviewQueue = await testServer({
      user: user("client_external", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/contacts/review-queue" });
    const reviewDecisions = await testServer({
      user: user("client_external", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/contacts/review-decisions" });
    const createDecision = await testServer({
      user: user("client_external", ["matter-001"]),
    }).inject({
      method: "POST",
      url: "/api/contacts/contact-river/review-decisions",
      payload: {
        signalKind: "protected_party_cue",
        decision: "protected_party_handling_confirmed",
        matterId: "matter-001",
      },
    });

    expect(dossiers.statusCode).toBe(403);
    expect(dossiers.json()).toMatchObject({
      message: "Contact access required",
    });
    expect(reviewQueue.statusCode).toBe(403);
    expect(reviewQueue.json()).toMatchObject({
      message: "Contact access required",
    });
    expect(reviewDecisions.statusCode).toBe(403);
    expect(reviewDecisions.json()).toMatchObject({
      message: "Contact access required",
    });
    expect(createDecision.statusCode).toBe(403);
    expect(createDecision.json()).toMatchObject({
      message: "Contact access required",
    });
  });
});
