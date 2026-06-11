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
        crmTaxonomy: {
          labels: Array<{ key: string }>;
          relationshipSummary: { activeCount: number; reviewNeededCount: number };
        };
        relationships: Array<{
          direction: string;
          relationshipKind: string;
          relatedContact: { kind: string; displayName: string; id?: string };
          visibleMatterIds: string[];
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
    const ada = payload.find((dossier) => dossier.contact.id === "contact-ada")!;
    expect(ada.crmTaxonomy.labels.map((label) => label.key)).toEqual(
      expect.arrayContaining(["client_contact", "relationship_graph"]),
    );
    expect(ada.relationships).toEqual([
      expect.objectContaining({
        direction: "outbound",
        relationshipKind: "opposing_party_for",
        relatedContact: {
          kind: "organization",
          displayName: "River City Rentals Inc.",
        },
        visibleMatterIds: ["matter-001"],
      }),
    ]);
    expect(ada.relationships[0]?.relatedContact).not.toHaveProperty("id");
    expect(ada.relationships[0]?.relatedContact).not.toHaveProperty("aliases");
    expect(ada.relationships[0]?.relatedContact).not.toHaveProperty("identifiers");
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
    expect(JSON.stringify(payload)).not.toContain('"relatedContact":{"id"');
  });

  it("creates standalone contacts with safe response and audit metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const authUser = user("firm_member", []);
    const response = await testServer({
      repository,
      user: authUser,
    }).inject({
      method: "POST",
      url: "/api/contacts",
      payload: {
        kind: "person",
        displayName: "  Synthetic Intake Client  ",
        aliases: ["  Synthetic Client  ", "Synthetic Client"],
        identifiers: [{ type: "email", value: "synthetic.client@example.test" }],
      },
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json<{
      contact: {
        id: string;
        firmId: string;
        kind: string;
        displayName: string;
        aliases: string[];
        identifiers: Array<{ type: string; value: string }>;
      };
    }>();
    expect(payload.contact).toMatchObject({
      firmId: "firm-west-legal",
      kind: "person",
      displayName: "Synthetic Intake Client",
      aliases: ["Synthetic Client"],
      identifiers: [{ type: "email", value: "synthetic.client@example.test" }],
    });
    expect(payload.contact).not.toHaveProperty("notes");
    expect(payload.contact).not.toHaveProperty("createdByUserId");
    const dossiers = await testServer({
      repository,
      user: authUser,
    }).inject({ method: "GET", url: "/api/contacts/dossiers" });
    expect(dossiers.statusCode).toBe(200);
    expect(dossiers.json<Array<{ contact: { id: string }; matters: unknown[] }>>()).toEqual([
      expect.objectContaining({
        contact: expect.objectContaining({ id: payload.contact.id }),
        matters: [],
      }),
    ]);

    const audit = await repository.listAuditEvents("firm-west-legal");
    const createdEvent = audit.events.find((event) => event.action === "contact.created");
    expect(createdEvent).toMatchObject({
      resourceType: "contact",
      resourceId: payload.contact.id,
      metadata: {
        contactId: payload.contact.id,
        kind: "person",
        aliasCount: 1,
        identifierTypes: ["email"],
      },
    });
    const serializedAudit = JSON.stringify(createdEvent);
    expect(serializedAudit).not.toContain("Synthetic Intake Client");
    expect(serializedAudit).not.toContain("synthetic.client@example.test");
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

  it("records contact data-quality decisions for visible cues without mutating contact or conflict state", async () => {
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
    await repository.runConflictCheck({
      firmId: "firm-west-legal",
      actorId: "user-licensee",
      prospectiveName: "River City Rentals",
      includeClosedMatters: true,
    });
    const authUser = user("licensee", ["matter-001"]);
    const beforeContact = await repository.getContact("firm-west-legal", "contact-ada");
    const beforeRiverHistory = (await repository.listContactDossiersForUser(authUser)).find(
      (dossier) => dossier.contact.id === "contact-river",
    )?.conflictHistory;
    const server = testServer({ repository, user: authUser });

    const duplicate = await server.inject({
      method: "POST",
      url: "/api/contacts/data-quality-resolutions",
      payload: {
        contactId: "contact-ada",
        signalKind: "duplicate_candidate",
        decision: "false_positive",
        relatedContactId: "contact-river",
        resolutionNote: "Synthetic private duplicate note should stay out of audit metadata.",
      },
    });
    const protectedParty = await server.inject({
      method: "POST",
      url: "/api/contacts/data-quality-resolutions",
      payload: {
        contactId: "contact-ada",
        signalKind: "protected_party_cue",
        decision: "acknowledged",
        matterId: "matter-001",
        resolutionNote: "Synthetic private protected-party note should stay out of audit metadata.",
      },
    });
    const revalidation = await server.inject({
      method: "POST",
      url: "/api/contacts/data-quality-resolutions",
      payload: {
        contactId: "contact-ada",
        signalKind: "conflict_revalidation",
        decision: "revalidation_completed",
        matterId: "matter-001",
        sourceRecordId: "proposal-contact-name",
        resolutionNote: "Synthetic private revalidation note should stay out of audit metadata.",
      },
    });

    expect(duplicate.statusCode).toBe(200);
    expect(protectedParty.statusCode).toBe(200);
    expect(revalidation.statusCode).toBe(200);
    expect(duplicate.json()).toMatchObject({
      contactId: "contact-ada",
      signalKind: "duplicate_candidate",
      decision: "false_positive",
      relatedContactId: "contact-river",
      recordedByUserId: "user-licensee",
    });
    const listResponse = await server.inject({
      method: "GET",
      url: "/api/contacts/data-quality-resolutions?contactId=contact-ada",
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ signalKind: "duplicate_candidate", decision: "false_positive" }),
        expect.objectContaining({ signalKind: "protected_party_cue", decision: "acknowledged" }),
        expect.objectContaining({
          signalKind: "conflict_revalidation",
          decision: "revalidation_completed",
        }),
      ]),
    );
    await expect(repository.getContact("firm-west-legal", "contact-ada")).resolves.toEqual(
      beforeContact,
    );
    const afterRiverHistory = (await repository.listContactDossiersForUser(authUser)).find(
      (dossier) => dossier.contact.id === "contact-river",
    )?.conflictHistory;
    expect(afterRiverHistory).toEqual(beforeRiverHistory);
    const audit = await repository.listAuditEvents("firm-west-legal");
    const resolutionAudit = audit.events.filter(
      (event) => event.action === "contact.data_quality_resolution.recorded",
    );
    expect(resolutionAudit).toHaveLength(3);
    const auditJson = JSON.stringify(resolutionAudit);
    expect(auditJson).not.toContain("Synthetic private");
    expect(auditJson).not.toContain("ada@example.test");
    expect(auditJson).not.toContain("Possible duplicate");
  });

  it("allows firm-wide contact data-quality history for auditors while denying decisions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createContactDataQualityResolution({
      id: "resolution-visible-auditor",
      firmId: "firm-west-legal",
      contactId: "contact-ada",
      signalKind: "protected_party_cue",
      decision: "acknowledged",
      matterId: "matter-001",
      resolutionNote: "Synthetic visible resolution.",
      recordedByUserId: "user-licensee",
      recordedAt: "2026-05-01T12:00:00.000Z",
    });
    await repository.createContactDataQualityResolution({
      id: "resolution-hidden-auditor",
      firmId: "firm-west-legal",
      contactId: "contact-northstar",
      signalKind: "protected_party_cue",
      decision: "acknowledged",
      matterId: "matter-002",
      resolutionNote: "Synthetic hidden resolution.",
      recordedByUserId: "user-admin",
      recordedAt: "2026-05-01T13:00:00.000Z",
    });
    const auditorList = await testServer({
      repository,
      user: user("auditor", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/contacts/data-quality-resolutions" });
    const auditorPost = await testServer({
      repository,
      user: user("auditor", ["matter-001"]),
    }).inject({
      method: "POST",
      url: "/api/contacts/data-quality-resolutions",
      payload: {
        contactId: "contact-ada",
        signalKind: "protected_party_cue",
        decision: "acknowledged",
        matterId: "matter-001",
        resolutionNote: "Synthetic denied note.",
      },
    });
    const invisibleMatter = await testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    }).inject({
      method: "POST",
      url: "/api/contacts/data-quality-resolutions",
      payload: {
        contactId: "contact-northstar",
        signalKind: "protected_party_cue",
        decision: "acknowledged",
        matterId: "matter-002",
        resolutionNote: "Synthetic denied note.",
      },
    });
    const invalidDecision = await testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    }).inject({
      method: "POST",
      url: "/api/contacts/data-quality-resolutions",
      payload: {
        contactId: "contact-ada",
        signalKind: "protected_party_cue",
        decision: "false_positive",
        matterId: "matter-001",
        resolutionNote: "Synthetic invalid decision note.",
      },
    });

    expect(auditorList.statusCode).toBe(200);
    expect(auditorList.json()).toEqual([
      expect.objectContaining({
        id: "resolution-hidden-auditor",
        contactId: "contact-northstar",
        matterId: "matter-002",
        signalKind: "protected_party_cue",
        decision: "acknowledged",
      }),
      expect.objectContaining({
        id: "resolution-visible-auditor",
        contactId: "contact-ada",
        matterId: "matter-001",
        signalKind: "protected_party_cue",
        decision: "acknowledged",
      }),
    ]);
    expect(auditorPost.statusCode).toBe(403);
    expect(invisibleMatter.statusCode).toBe(403);
    expect(invalidDecision.statusCode).toBe(400);
    await expect(repository.listContactDataQualityResolutions("firm-west-legal")).resolves.toEqual([
      expect.objectContaining({ id: "resolution-hidden-auditor" }),
      expect.objectContaining({ id: "resolution-visible-auditor" }),
    ]);
  });

  it("rejects users without contact read access", async () => {
    const dossiers = await testServer({
      user: user("client_external", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/contacts/dossiers" });
    const reviewQueue = await testServer({
      user: user("client_external", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/contacts/review-queue" });
    const resolutions = await testServer({
      user: user("client_external", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/contacts/data-quality-resolutions" });
    const createContact = await testServer({
      user: user("client_external", ["matter-001"]),
    }).inject({
      method: "POST",
      url: "/api/contacts",
      payload: { kind: "person", displayName: "Synthetic Client" },
    });

    expect(dossiers.statusCode).toBe(403);
    expect(dossiers.json()).toMatchObject({
      message: "Contact access required",
    });
    expect(reviewQueue.statusCode).toBe(403);
    expect(reviewQueue.json()).toMatchObject({
      message: "Contact access required",
    });
    expect(resolutions.statusCode).toBe(403);
    expect(resolutions.json()).toMatchObject({
      message: "Contact access required",
    });
    expect(createContact.statusCode).toBe(403);
    expect(createContact.json()).toMatchObject({
      message: "Contact access required",
    });
  });
});
