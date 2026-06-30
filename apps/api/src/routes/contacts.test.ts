import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import { authorizationFixtureCases } from "@open-practice/domain/authorization-fixtures";
import type { Contact, ProfessionalRole, User } from "@open-practice/domain";
import { registerContactRoutes } from "./contacts.js";
import type { ApiJobQueue } from "./types.js";

const servers: FastifyInstance[] = [];
type QueuedReportJob = { name: string; data: unknown; jobId?: string };

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
    reportJobQueue?: ApiJobQueue;
    user?: User;
  } = {},
): FastifyInstance {
  const repository = input.repository ?? new InMemoryOpenPracticeRepository();
  const authUser = input.user ?? user("owner_admin");
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerContactRoutes(server, { repository, reportJobQueue: input.reportJobQueue });
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

function fakeReportQueue(jobs: QueuedReportJob[] = []): ApiJobQueue {
  return {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? name };
    },
  };
}

function contactAuthorizationFixtureCase(id: string) {
  const match = authorizationFixtureCases.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing contact authorization fixture case ${id}`);
  return match;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("contact routes", () => {
  it("keeps contact dossier and list visibility aligned with authorization fixtures", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createContact({
      id: "contact-standalone-creator",
      firmId: "firm-west-legal",
      kind: "person",
      displayName: "Synthetic Standalone Contact",
      aliases: [],
      identifiers: [],
      createdByUserId: "user-staff",
    });

    const firmWideReviewer: User = {
      ...user("owner_admin", []),
      id: "user-admin",
      displayName: "Synthetic Owner Admin",
      email: "owner-admin@example.test",
    };
    const standaloneCreator: User = {
      ...user("firm_member", []),
      id: "user-staff",
      displayName: "Synthetic Staff Creator",
      email: "staff-creator@example.test",
    };
    const portalClient: User = {
      id: "client-ada",
      firmId: "firm-west-legal",
      displayName: "Synthetic Portal Client",
      email: "portal-client@example.test",
      role: "client_external",
      assignedMatterIds: ["matter-001"],
      mfaEnabled: true,
    };

    const scenarios: Array<{
      fixtureIds: string[];
      authUser: User;
      expectedStatus: number;
      expectedVisibleIds?: string[];
    }> = [
      {
        fixtureIds: ["contact:firm-wide:list-all"],
        authUser: firmWideReviewer,
        expectedStatus: 200,
        expectedVisibleIds: [
          "contact-ada",
          "contact-northstar",
          "contact-river",
          "contact-standalone-creator",
        ],
      },
      {
        fixtureIds: ["contact:assigned:client-visible", "contact:assigned:counterparty-visible"],
        authUser: user("licensee", ["matter-001"]),
        expectedStatus: 200,
        expectedVisibleIds: ["contact-ada", "contact-river"],
      },
      {
        fixtureIds: ["contact:unassigned:list-hidden"],
        authUser: user("licensee", ["matter-001"]),
        expectedStatus: 200,
        expectedVisibleIds: ["contact-ada", "contact-river"],
      },
      {
        fixtureIds: ["contact:standalone-creator:list-visible"],
        authUser: standaloneCreator,
        expectedStatus: 200,
        expectedVisibleIds: ["contact-standalone-creator"],
      },
      {
        fixtureIds: ["contact:portal-client:staff-list-denied"],
        authUser: portalClient,
        expectedStatus: 403,
      },
    ];

    for (const scenario of scenarios) {
      const server = testServer({ repository, user: scenario.authUser });
      const dossiers = await server.inject({ method: "GET", url: "/api/contacts/dossiers" });
      const contactList = await server.inject({ method: "GET", url: "/api/contacts" });
      const fixtures = scenario.fixtureIds.map(contactAuthorizationFixtureCase);

      for (const fixture of fixtures) {
        expect(fixture.family).toBe("contact");
        expect(fixture.resource).toBe("contact");
        expect(fixture.action).toBe("read");
      }

      expect(dossiers.statusCode).toBe(scenario.expectedStatus);
      expect(contactList.statusCode).toBe(scenario.expectedStatus);

      if (scenario.expectedStatus !== 200) {
        expect(fixtures.every((fixture) => fixture.expectedDecision === "deny")).toBe(true);
        continue;
      }

      if (!scenario.expectedVisibleIds) {
        throw new Error("Expected visible contact ids for allowed contact fixture scenario");
      }
      const dossierPayload = dossiers.json<Array<{ contact: { id: string } }>>();
      const listPayload = contactList.json<{ contacts: Array<{ id: string }> }>();
      const dossierIds = dossierPayload.map((dossier) => dossier.contact.id);
      const listIds = listPayload.contacts.map((contact) => contact.id);
      expect(dossierIds).toEqual(scenario.expectedVisibleIds);
      expect(listIds).toEqual(scenario.expectedVisibleIds);
      const serialized = JSON.stringify({ dossiers: dossierPayload, contacts: listPayload });

      for (const fixture of fixtures) {
        expect(fixture.expectedDecision).toBe("allow");
        const resourceId = fixture.resourceId;
        if (!resourceId) {
          throw new Error(`Missing contact resource id for fixture ${fixture.id}`);
        }
        if (fixture.listVisible) {
          expect(dossierIds).toContain(resourceId);
          expect(listIds).toContain(resourceId);
        } else {
          expect(serialized).not.toContain(resourceId);
        }
      }
    }

    const hiddenSearch = await testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/contacts?search=North" });
    expect(hiddenSearch.statusCode).toBe(200);
    expect(hiddenSearch.json<{ contacts: unknown[] }>().contacts).toEqual([]);
  });

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
        qualityReview: {
          summary: { revalidationPromptCount: number; retentionHoldCueCount: number };
          signals: unknown[];
        };
      }>
    >();
    expect(payload.map((dossier) => dossier.contact.id)).toEqual(["contact-ada", "contact-river"]);
    expect(payload).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ contact: { id: "contact-northstar" } })]),
    );
    expect(payload.find((dossier) => dossier.contact.id === "contact-ada")).toMatchObject({
      qualityReview: {
        summary: { revalidationPromptCount: 1, retentionHoldCueCount: 1 },
        signals: expect.arrayContaining([
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
          expect.objectContaining({
            kind: "retention_hold_review",
            matterId: "matter-001",
          }),
        ]),
      },
      conflictHistory: [
        expect.objectContaining({
          matchedContactId: "contact-ada",
          visibleMatchedMatterIds: ["matter-001"],
          matchCount: 1,
          maxSeverity: "info",
        }),
      ],
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

  it("manages CRM detail, methods, relationships, matter associations, portal grants, and timeline", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, user: user("owner_admin") });

    const created = await server.inject({
      method: "POST",
      url: "/api/contacts",
      payload: {
        kind: "organization",
        status: "prospective",
        roleCategories: ["organization", "expert"],
        displayName: "Synthetic Expert Services Inc.",
        organizationLegalName: "Synthetic Expert Services Inc.",
        aliases: ["Synthetic Experts"],
        formerNames: ["Synthetic Expert Co."],
        identifiers: [{ type: "business_number", value: "BN-EXPERT-1" }],
        contactMethods: [
          {
            type: "email",
            label: "work",
            value: "experts@example.test",
            preferred: true,
            conflictCheckIncluded: true,
            notes: "Synthetic private contact-method note.",
          },
        ],
        notes: "Synthetic operational contact note.",
        privateNotes: "Synthetic private contact note.",
        conflictSensitive: true,
      },
    });

    expect(created.statusCode).toBe(201);
    const contactId = created.json<{ contact: { id: string } }>().contact.id;

    const method = await server.inject({
      method: "POST",
      url: `/api/contacts/${contactId}/contact-methods`,
      payload: {
        type: "address",
        label: "service",
        address: { line1: "10 Synthetic Plaza", city: "Vancouver", province: "BC" },
        conflictCheckIncluded: true,
      },
    });
    expect(method.statusCode).toBe(201);
    const methodId = method.json<{ contactMethod: { id: string } }>().contactMethod.id;

    const methodUpdate = await server.inject({
      method: "PATCH",
      url: `/api/contacts/${contactId}/contact-methods/${methodId}`,
      payload: {
        label: "registered_office",
        conflictCheckIncluded: false,
      },
    });
    expect(methodUpdate.statusCode).toBe(200);

    const methodDelete = await server.inject({
      method: "DELETE",
      url: `/api/contacts/${contactId}/contact-methods/${methodId}`,
    });
    expect(methodDelete.statusCode).toBe(200);

    const names = await server.inject({
      method: "PATCH",
      url: `/api/contacts/${contactId}/names-identifiers`,
      payload: {
        aliases: ["Synthetic Experts", "SE Services"],
        formerNames: ["Synthetic Expert Co."],
        identifiers: [
          { type: "business_number", value: "BN-EXPERT-1" },
          { type: "registry_id", value: "BC9999999" },
        ],
      },
    });
    expect(names.statusCode).toBe(200);

    const relationship = await server.inject({
      method: "POST",
      url: `/api/contacts/${contactId}/relationships`,
      payload: {
        relatedContactId: "contact-ada",
        relationshipKind: "expert_for",
        label: "Expert for",
        reciprocalLabel: "Uses expert",
        matterId: "matter-001",
        privateNotes: "Synthetic private relationship note.",
        includeInConflictCheck: true,
      },
    });
    expect(relationship.statusCode).toBe(201);

    const association = await server.inject({
      method: "POST",
      url: `/api/contacts/${contactId}/matter-associations`,
      payload: {
        matterId: "matter-001",
        role: "expert",
        side: "neutral",
        notes: "Synthetic expert association.",
        privateNotes: "Synthetic private association note.",
        conflictCheckIncluded: true,
      },
    });
    expect(association.statusCode).toBe(201);
    const associationId = association.json<{ association: { id: string } }>().association.id;

    const associationUpdate = await server.inject({
      method: "PATCH",
      url: `/api/contacts/${contactId}/matter-associations/${associationId}`,
      payload: { status: "inactive", conflictCheckIncluded: false },
    });
    expect(associationUpdate.statusCode).toBe(200);

    const portal = await server.inject({
      method: "POST",
      url: `/api/contacts/${contactId}/portal-access`,
      payload: {
        matterId: "matter-001",
        status: "invited",
        permissions: ["view_matter_summary", "view_documents", "upload_documents"],
      },
    });
    expect(portal.statusCode).toBe(201);
    const portalGrantId = portal.json<{ grant: { id: string } }>().grant.id;

    const suspended = await server.inject({
      method: "PATCH",
      url: `/api/contacts/${contactId}/portal-access/${portalGrantId}`,
      payload: { status: "suspended" },
    });
    expect(suspended.statusCode).toBe(200);
    expect(suspended.json()).toMatchObject({ grant: { status: "suspended" } });
    await repository.createCalendarSchedulingRequest({
      id: "calendar-scheduling-request-contact-follow-up",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      kind: "event_scheduling",
      status: "needs_review",
      title: "Private follow-up scheduling title must stay out",
      ownerUserId: "user-owner_admin",
      sourceType: "calendar_event",
      sourceId: "calendar-event-private",
      sourceLabel: "Private follow-up source label must stay out",
      requestedDueAt: "2026-05-04T17:00:00.000Z",
      reminderPosture: "dashboard_pending",
      privacy: "staff_only",
      timeCaptureCue: {
        posture: "none",
        existingTimeEntryCount: 0,
        billable: false,
      },
      createdAt: "2026-05-02T12:00:00.000Z",
      updatedAt: "2026-05-02T12:00:00.000Z",
      createdByUserId: "user-owner_admin",
      updatedByUserId: "user-owner_admin",
    });

    const detail = await server.inject({ method: "GET", url: `/api/contacts/${contactId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      contact: {
        kind: "organization",
        status: "prospective",
        roleCategories: ["organization", "expert"],
        formerNames: ["Synthetic Expert Co."],
        conflictSensitive: true,
      },
      matters: [expect.objectContaining({ matterId: "matter-001", status: "inactive" })],
      relationships: [expect.objectContaining({ relationshipKind: "expert_for" })],
      portal: { grants: [expect.objectContaining({ status: "suspended" })] },
    });
    expect(JSON.stringify(detail.json())).not.toContain("Synthetic expert association.");

    const timeline = await server.inject({
      method: "GET",
      url: `/api/contacts/${contactId}/timeline`,
    });
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json()).toMatchObject({
      timeline: expect.arrayContaining([
        expect.objectContaining({ kind: "contact" }),
        expect.objectContaining({
          kind: "portal",
          metadata: expect.objectContaining({ portalGrantId }),
        }),
        expect.objectContaining({
          kind: "task",
          title: "Task deadline cue",
          metadata: expect.objectContaining({
            cueType: "open_task",
            contactId,
            matterId: "matter-001",
            taskId: "task-deadline-001",
            reviewBoundary: {
              automaticTaskCreation: false,
              automaticDeadlineMutation: false,
              automaticReminderChanges: false,
              queueDelivery: false,
            },
          }),
        }),
        expect.objectContaining({
          kind: "task",
          title: "Follow-up review cue",
          metadata: expect.objectContaining({
            cueType: "follow_up_review",
            contactId,
            matterId: "matter-001",
            schedulingRequestId: "calendar-scheduling-request-contact-follow-up",
            reviewBoundary: {
              automaticTaskCreation: false,
              automaticDeadlineMutation: false,
              automaticReminderChanges: false,
              queueDelivery: false,
            },
          }),
        }),
      ]),
    });
    expect(JSON.stringify(timeline.json())).not.toContain("Review tenant evidence package");
    expect(JSON.stringify(timeline.json())).not.toContain("Review filing deadline schedule");
    expect(JSON.stringify(timeline.json())).not.toContain("Private follow-up scheduling title");
    expect(JSON.stringify(timeline.json())).not.toContain("Private follow-up source label");
    expect(JSON.stringify(timeline.json())).not.toContain("sourceLabel");

    const crmActivityTimeline = await server.inject({
      method: "GET",
      url: `/api/contacts/${contactId}/timeline?activity=crm_activity`,
    });
    expect(crmActivityTimeline.statusCode).toBe(200);
    expect(
      crmActivityTimeline
        .json<{ timeline: Array<{ kind: string }> }>()
        .timeline.map((entry) => entry.kind),
    ).toEqual(expect.arrayContaining(["contact", "portal"]));
    expect(
      crmActivityTimeline
        .json<{ timeline: Array<{ kind: string }> }>()
        .timeline.some((entry) => entry.kind === "task"),
    ).toBe(false);

    const taskCueTimeline = await server.inject({
      method: "GET",
      url: `/api/contacts/${contactId}/timeline?activity=task_cues`,
    });
    expect(taskCueTimeline.statusCode).toBe(200);
    expect(
      taskCueTimeline.json<{
        timeline: Array<{ kind: string; metadata: Record<string, unknown> }>;
      }>().timeline,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metadata: expect.objectContaining({ cueType: "open_task" }) }),
        expect.objectContaining({
          metadata: expect.objectContaining({ cueType: "follow_up_review" }),
        }),
      ]),
    );
    expect(
      taskCueTimeline
        .json<{ timeline: Array<{ kind: string }> }>()
        .timeline.every((entry) => entry.kind === "task"),
    ).toBe(true);

    const openTaskTimeline = await server.inject({
      method: "GET",
      url: `/api/contacts/${contactId}/timeline?activity=open_tasks`,
    });
    expect(openTaskTimeline.statusCode).toBe(200);
    expect(
      openTaskTimeline
        .json<{ timeline: Array<{ metadata: Record<string, unknown> }> }>()
        .timeline.map((entry) => entry.metadata.cueType),
    ).toEqual(["open_task", "open_task"]);

    const followUpTimeline = await server.inject({
      method: "GET",
      url: `/api/contacts/${contactId}/timeline?activity=follow_ups`,
    });
    expect(followUpTimeline.statusCode).toBe(200);
    expect(followUpTimeline.json()).toMatchObject({
      timeline: [
        expect.objectContaining({
          title: "Follow-up review cue",
          metadata: expect.objectContaining({
            cueType: "follow_up_review",
            schedulingRequestId: "calendar-scheduling-request-contact-follow-up",
          }),
        }),
      ],
    });
    expect(JSON.stringify(followUpTimeline.json())).not.toContain(
      "Private follow-up scheduling title",
    );

    const invalidTimelineFilter = await server.inject({
      method: "GET",
      url: `/api/contacts/${contactId}/timeline?activity=raw_history`,
    });
    expect(invalidTimelineFilter.statusCode).toBe(400);

    const exportResponse = await server.inject({
      method: "POST",
      url: `/api/contacts/${contactId}/history-export`,
      payload: {
        purpose: "staff_review",
        reviewReason: "Synthetic staff review reason for contact history export.",
      },
    });
    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.json()).toMatchObject({
      exportRequest: {
        contactId,
        purpose: "staff_review",
        generatedByUserId: "user-owner_admin",
        storedBody: false,
        retentionPosture: "transient_regenerated_no_retained_export_body",
        legalHoldPosture: "respects_existing_matter_visibility_no_hold_override",
        privacyPosture: "redacted_authorized_projection_only",
      },
      export: {
        policyBoundary: {
          rawPrivateContactHistory: false,
          retainedExportArtifact: false,
          deletionAutomation: false,
          retentionDeadline: false,
          jurisdictionCertifiedRecordsClaim: false,
        },
        categories: {
          identityPosture: expect.objectContaining({ contactId, kind: "organization" }),
          contactMethodPosture: expect.objectContaining({
            identifierTypes: ["business_number", "registry_id"],
            identifierCount: 2,
          }),
          matterPartyPosture: [expect.objectContaining({ matterId: "matter-001" })],
          portalAccessPosture: expect.objectContaining({
            grants: [expect.objectContaining({ status: "suspended", accountBound: false })],
          }),
          documentHoldReviewPosture: [
            expect.objectContaining({
              matterId: "matter-001",
              documentLegalHoldCount: 1,
              documentReviewCount: 0,
            }),
          ],
          retentionHoldReviewPosture: {
            summary: { retentionHoldCueCount: 1 },
            signals: [
              expect.objectContaining({
                kind: "retention_hold_review",
                matterId: "matter-001",
                retentionHoldReview: expect.objectContaining({
                  cueReasons: expect.arrayContaining([
                    "matter_party_posture",
                    "document_legal_hold",
                  ]),
                }),
              }),
            ],
          },
          timelineCues: expect.arrayContaining([
            expect.objectContaining({
              title: "Task deadline cue",
              metadata: expect.objectContaining({
                cueType: "open_task",
                reviewBoundary: expect.objectContaining({ queueDelivery: false }),
              }),
            }),
          ]),
        },
      },
    });
    const serializedExport = JSON.stringify(exportResponse.json());
    expect(serializedExport).not.toContain("experts@example.test");
    expect(serializedExport).not.toContain("10 Synthetic Plaza");
    expect(serializedExport).not.toContain("BN-EXPERT-1");
    expect(serializedExport).not.toContain("BC9999999");
    expect(serializedExport).not.toContain("Synthetic private contact-method note");
    expect(serializedExport).not.toContain("Synthetic operational contact note");
    expect(serializedExport).not.toContain("Synthetic private contact note");
    expect(serializedExport).not.toContain("Synthetic expert association.");
    expect(serializedExport).not.toContain("Synthetic private association note");
    expect(serializedExport).not.toContain("Synthetic private relationship note");
    expect(serializedExport).not.toContain("BC tenancy retainer and review plan.pdf");
    expect(serializedExport).not.toContain("matters/matter-001/retainer-v1.pdf");
    expect(serializedExport).not.toContain("Review tenant evidence package");
    expect(serializedExport).not.toContain("Review filing deadline schedule");
    expect(serializedExport).not.toContain("sourceLabel");

    const deniedExport = await testServer({
      repository,
      user: user("firm_member", ["matter-001"]),
    }).inject({
      method: "POST",
      url: `/api/contacts/${contactId}/history-export`,
      payload: {
        purpose: "staff_review",
        reviewReason: "Synthetic staff review reason for denied export.",
      },
    });
    expect(deniedExport.statusCode).toBe(403);

    const unlinkedMatterExport = await server.inject({
      method: "POST",
      url: `/api/contacts/${contactId}/history-export`,
      payload: {
        purpose: "staff_review",
        matterId: "matter-002",
        reviewReason: "Synthetic staff review reason for unlinked matter export.",
      },
    });
    expect(unlinkedMatterExport.statusCode).toBe(403);

    const audit = await repository.listAuditEvents("firm-west-legal");
    expect(audit.events.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "contact.updated",
        "contact.relationship.created",
        "contact.matter_association.created",
        "contact.matter_association.updated",
        "portal.grant.invited",
        "portal.grant.suspended",
        "contact_history_export.requested",
      ]),
    );
    const contactMethodAuditEvents = audit.events.filter(
      (event) =>
        event.action === "contact.updated" &&
        event.resourceId === contactId &&
        Array.isArray(event.metadata.changedFields) &&
        event.metadata.changedFields.includes("contactMethods"),
    );
    expect(contactMethodAuditEvents).toHaveLength(3);
    expect(contactMethodAuditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: { contactId, changedFields: ["contactMethods"], status: "prospective" },
        }),
      ]),
    );
    expect(JSON.stringify(contactMethodAuditEvents)).not.toContain("10 Synthetic Plaza");
    expect(JSON.stringify(contactMethodAuditEvents)).not.toContain("address");
    const exportAudit = audit.events.find(
      (event) => event.action === "contact_history_export.requested",
    );
    expect(exportAudit).toMatchObject({
      resourceType: "contact_history_export",
      resourceId: contactId,
      metadata: {
        contactId,
        purpose: "staff_review",
        reviewReasonPresent: true,
        generatedCategoryCount: 11,
        matterAssociationCount: 1,
        portalGrantCount: 1,
        documentHoldCueCount: 1,
        retentionHoldCueCount: 1,
        retentionPosture: "transient_regenerated_no_retained_export_body",
        legalHoldPosture: "respects_existing_matter_visibility_no_hold_override",
        privacyPosture: "redacted_authorized_projection_only",
      },
    });
    const serializedAudit = JSON.stringify(exportAudit);
    expect(serializedAudit).not.toContain("Synthetic Expert Services");
    expect(serializedAudit).not.toContain("experts@example.test");
    expect(serializedAudit).not.toContain("10 Synthetic Plaza");
    expect(serializedAudit).not.toContain("Synthetic private");
  });

  it("reuses authorized contact dossiers on detail, portal, timeline, and export paths", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const originalListContactDossiersForUser =
      repository.listContactDossiersForUser.bind(repository);
    let dossierReads = 0;
    repository.listContactDossiersForUser = async (authUser) => {
      dossierReads += 1;
      return originalListContactDossiersForUser(authUser);
    };
    const server = testServer({ repository, user: user("owner_admin") });

    dossierReads = 0;
    const detail = await server.inject({ method: "GET", url: "/api/contacts/contact-ada" });
    expect(detail.statusCode).toBe(200);
    expect(dossierReads).toBe(1);

    dossierReads = 0;
    const portal = await server.inject({
      method: "GET",
      url: "/api/contacts/contact-ada/portal-access",
    });
    expect(portal.statusCode).toBe(200);
    expect(dossierReads).toBe(1);

    dossierReads = 0;
    const timeline = await server.inject({
      method: "GET",
      url: "/api/contacts/contact-ada/timeline",
    });
    expect(timeline.statusCode).toBe(200);
    expect(dossierReads).toBe(1);

    dossierReads = 0;
    const historyExport = await server.inject({
      method: "POST",
      url: "/api/contacts/contact-ada/history-export",
      payload: {
        purpose: "staff_review",
        reviewReason: "Synthetic staff review reason for contact preload export.",
      },
    });
    expect(historyExport.statusCode).toBe(200);
    expect(dossierReads).toBe(1);
  });

  it("queues contact-history export requests and regenerates completed downloads", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const jobs: QueuedReportJob[] = [];
    const server = testServer({ repository, reportJobQueue: fakeReportQueue(jobs) });

    const queued = await server.inject({
      method: "POST",
      url: "/api/contacts/contact-river/history-export-requests",
      payload: {
        purpose: "staff_review",
        matterId: "matter-001",
        reviewReason: "Synthetic staff review reason for queued contact export.",
      },
    });

    expect(queued.statusCode).toBe(202);
    expect(queued.json()).toMatchObject({
      exportRequest: {
        contactId: "contact-river",
        matterId: "matter-001",
        matterScoped: true,
        purpose: "staff_review",
        status: "queued",
        reviewReasonPresent: true,
        retainedExportArtifact: false,
        deletionAutomation: false,
        retentionDeadline: false,
        legalHoldOverride: false,
        redactedAuthorizedProjection: true,
        retentionPosture: "queued_regenerated_download_no_retained_export_body",
        legalHoldPosture: "respects_existing_matter_visibility_no_hold_override",
        privacyPosture: "redacted_authorized_projection_only",
      },
    });
    expect(queued.json().exportRequest.downloadExpiresAt).toEqual(expect.any(String));
    expect(queued.json().exportRequest.downloadUrl).toContain(
      "/api/contacts/contact-river/history-export-requests/",
    );
    expect(jobs).toEqual([
      expect.objectContaining({
        name: "contact_history_export",
        jobId: queued.json().exportRequest.jobId,
      }),
    ]);
    expect(JSON.stringify(jobs[0])).not.toContain("Synthetic staff review reason");

    const notReady = await server.inject({
      method: "GET",
      url: queued.json().exportRequest.downloadUrl,
    });
    expect(notReady.statusCode).toBe(409);

    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "reports",
    });
    expect(JSON.stringify(job.metadata)).not.toContain("Synthetic staff review reason");
    expect(JSON.stringify(job.metadata)).not.toContain("Synthetic private");
    await repository.updateJobLifecycleRecord("firm-west-legal", job.id, {
      status: "completed",
      finishedAt: "2026-06-16T12:05:00.000Z",
      metadata: {
        ...job.metadata,
        generatedCategoryCount: 11,
        timelineEntryCount: 1,
        matterAssociationCount: 1,
        portalGrantCount: 0,
        conflictSummaryCount: 0,
        documentHoldCueCount: 1,
        retentionHoldCueCount: 1,
      },
    });

    const status = await server.inject({
      method: "GET",
      url: queued.json().exportRequest.pollUrl,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      exportRequest: {
        contactId: "contact-river",
        matterId: "matter-001",
        status: "completed",
        generatedCategoryCount: 11,
        documentHoldCueCount: 1,
        retentionHoldCueCount: 1,
      },
    });

    const wrongContactPath = await server.inject({
      method: "GET",
      url: `/api/contacts/contact-ada/history-export-requests/${job.id}`,
    });
    expect(wrongContactPath.statusCode).toBe(404);

    const download = await server.inject({
      method: "GET",
      url: queued.json().exportRequest.downloadUrl,
    });
    expect(download.statusCode).toBe(200);
    expect(download.json()).toMatchObject({
      exportRequest: {
        contactId: "contact-river",
        matterId: "matter-001",
        jobId: job.id,
        status: "completed",
        storedBody: false,
        retainedExportArtifact: false,
        retentionDeadline: false,
        legalHoldOverride: false,
      },
      export: {
        policyBoundary: {
          rawPrivateContactHistory: false,
          retainedExportArtifact: false,
          deletionAutomation: false,
          retentionDeadline: false,
          jurisdictionCertifiedRecordsClaim: false,
        },
        categories: {
          documentHoldReviewPosture: [
            expect.objectContaining({
              matterId: "matter-001",
              documentLegalHoldCount: 1,
            }),
          ],
          retentionHoldReviewPosture: {
            summary: { retentionHoldCueCount: 1 },
          },
          timelineCues: expect.arrayContaining([
            expect.objectContaining({ matterId: "matter-001" }),
          ]),
        },
      },
    });
    expect(
      download
        .json<{ export: { categories: { timelineCues: Array<{ matterId?: string }> } } }>()
        .export.categories.timelineCues.every((entry) => entry.matterId === "matter-001"),
    ).toBe(true);
    expect(JSON.stringify(download.json())).not.toContain("Synthetic staff review reason");
    expect(JSON.stringify(download.json())).not.toContain("Synthetic private");

    const audit = await repository.listAuditEvents("firm-west-legal");
    expect(audit.events.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "contact_history_export.requested",
        "contact_history_export.downloaded",
      ]),
    );
    const serializedAudit = JSON.stringify(audit.events);
    expect(serializedAudit).not.toContain("Synthetic staff review reason");
    expect(serializedAudit).not.toContain("Synthetic private");
  });

  it("scopes contact-history exports to the requested visible linked matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, user: user("owner_admin") });

    const scoped = await server.inject({
      method: "POST",
      url: "/api/contacts/contact-ada/history-export",
      payload: {
        purpose: "staff_review",
        matterId: "matter-001",
        reviewReason: "Synthetic staff review reason for scoped contact export.",
      },
    });

    expect(scoped.statusCode).toBe(200);
    const payload = scoped.json<{
      exportRequest: { matterId?: string };
      export: {
        categories: {
          relationshipPosture: unknown[];
          matterPartyPosture: Array<{ matterId: string }>;
          portalAccessPosture: { grants: Array<{ matterId: string }> };
          conflictReviewPosture: {
            cues: Array<{ matterId?: string }>;
            history: Array<{ visibleMatchedMatterIds: string[] }>;
          };
          documentHoldReviewPosture: Array<{ matterId: string; documentLegalHoldCount: number }>;
          retentionHoldReviewPosture: { summary: { retentionHoldCueCount: number } };
          timelineCues: Array<{ matterId?: string }>;
        };
      };
    }>();
    expect(payload.exportRequest.matterId).toBe("matter-001");
    expect(payload.export.categories.relationshipPosture).toEqual([
      expect.objectContaining({ visibleMatterIds: ["matter-001"] }),
    ]);
    expect(payload.export.categories.matterPartyPosture).toEqual([
      expect.objectContaining({ matterId: "matter-001" }),
    ]);
    expect(
      payload.export.categories.portalAccessPosture.grants.every(
        (grant) => grant.matterId === "matter-001",
      ),
    ).toBe(true);
    expect(
      payload.export.categories.conflictReviewPosture.cues.every(
        (cue) => cue.matterId === "matter-001",
      ),
    ).toBe(true);
    expect(
      payload.export.categories.conflictReviewPosture.history.every((entry) =>
        entry.visibleMatchedMatterIds.every((matterId) => matterId === "matter-001"),
      ),
    ).toBe(true);
    expect(payload.export.categories.documentHoldReviewPosture).toEqual([
      expect.objectContaining({ matterId: "matter-001", documentLegalHoldCount: 1 }),
    ]);
    expect(payload.export.categories.retentionHoldReviewPosture.summary).toEqual({
      retentionHoldCueCount: 1,
    });
    expect(
      payload.export.categories.timelineCues.every((entry) => entry.matterId === "matter-001"),
    ).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("North Star");
    expect(JSON.stringify(payload)).not.toContain("BC tenancy retainer and review plan.pdf");

    const unlinked = await server.inject({
      method: "POST",
      url: "/api/contacts/contact-ada/history-export",
      payload: {
        purpose: "staff_review",
        matterId: "matter-002",
        reviewReason: "Synthetic staff review reason for unlinked scoped contact export.",
      },
    });
    expect(unlinked.statusCode).toBe(403);
  });

  it("completes inline contact-history export requests and rejects expired links or denied roles", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const inline = await server.inject({
      method: "POST",
      url: "/api/contacts/contact-river/history-export-requests",
      payload: {
        purpose: "staff_review",
        reviewReason: "Synthetic staff review reason for inline contact export.",
      },
    });
    expect(inline.statusCode).toBe(202);
    expect(inline.json()).toMatchObject({
      exportRequest: {
        contactId: "contact-river",
        status: "completed",
        retainedExportArtifact: false,
        legalHoldOverride: false,
      },
    });

    const download = await server.inject({
      method: "GET",
      url: inline.json().exportRequest.downloadUrl,
    });
    expect(download.statusCode).toBe(200);

    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "reports",
    });
    await repository.updateJobLifecycleRecord("firm-west-legal", job.id, {
      metadata: {
        ...job.metadata,
        downloadExpiresAt: "2000-01-01T00:00:00.000Z",
      },
    });
    const expired = await server.inject({
      method: "GET",
      url: inline.json().exportRequest.downloadUrl,
    });
    expect(expired.statusCode).toBe(410);

    const denied = await testServer({
      repository,
      user: user("firm_member", ["matter-001"]),
    }).inject({
      method: "POST",
      url: "/api/contacts/contact-river/history-export-requests",
      payload: {
        purpose: "staff_review",
        reviewReason: "Synthetic staff review reason for denied queued contact export.",
      },
    });
    expect(denied.statusCode).toBe(403);
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
        retentionHoldCueCount: 2,
      },
      items: expect.arrayContaining([
        expect.objectContaining({
          contact: expect.objectContaining({ id: "contact-ada" }),
          auditSafe: true,
          signals: expect.arrayContaining([
            expect.objectContaining({
              kind: "duplicate_candidate",
              matchedValueRedacted: true,
              duplicateReview: {
                candidate: expect.objectContaining({
                  contactId: "contact-river",
                  displayName: "River City Rentals Inc.",
                  kind: "organization",
                }),
                matchedFields: ["identifier"],
                matchCount: 1,
                sharedVisibleMatterIds: ["matter-001"],
                sharedVisibleMatterCount: 1,
                reviewSeverity: "review",
              },
            }),
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
    expect(serialized).toContain('"duplicateReview"');
    expect(serialized).toContain('"matchedFields":["identifier"]');
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

    const duplicateGenericRoute = await server.inject({
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
    const duplicate = await server.inject({
      method: "POST",
      url: "/api/contacts/contact-ada/duplicate-resolution-decisions",
      payload: {
        id: "contact-duplicate-decision-api-001",
        relatedContactId: "contact-river",
        decision: "acknowledged_duplicate_candidate",
        reason: "safe_identity_match",
        idempotencyKey: "contact-ada:contact-river:acknowledged",
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
    const retentionHold = await server.inject({
      method: "POST",
      url: "/api/contacts/data-quality-resolutions",
      payload: {
        contactId: "contact-ada",
        signalKind: "retention_hold_review",
        decision: "needs_follow_up",
        matterId: "matter-001",
        resolutionNote: "Synthetic private retention note should stay out of audit metadata.",
      },
    });

    expect(duplicateGenericRoute.statusCode).toBe(400);
    expect(duplicateGenericRoute.json()).toMatchObject({
      message: "Duplicate-candidate decisions must use the enum-only duplicate resolution endpoint",
    });
    expect(duplicate.statusCode).toBe(200);
    expect(protectedParty.statusCode).toBe(200);
    expect(revalidation.statusCode).toBe(200);
    expect(retentionHold.statusCode).toBe(200);
    expect(duplicate.json()).toMatchObject({
      decision: {
        id: "contact-duplicate-decision-api-001",
        contactId: "contact-ada",
        relatedContactId: "contact-river",
        decision: "acknowledged_duplicate_candidate",
        reason: "safe_identity_match",
        reviewedByUserId: "user-licensee",
        boundaries: {
          contactMerge: false,
          contactFieldMutation: "none",
          hiddenMatterDisclosure: false,
          rawMatchedValueRetention: false,
          privateReviewerNoteRetention: false,
          conflictCheckMutation: "none",
          portalPermissionWidening: false,
          contactPermissionWidening: false,
        },
      },
    });
    const listResponse = await server.inject({
      method: "GET",
      url: "/api/contacts/data-quality-resolutions?contactId=contact-ada",
    });
    const duplicateListResponse = await server.inject({
      method: "GET",
      url: "/api/contacts/contact-ada/duplicate-resolution-decisions",
    });
    expect(listResponse.statusCode).toBe(200);
    expect(duplicateListResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ signalKind: "protected_party_cue", decision: "acknowledged" }),
        expect.objectContaining({
          signalKind: "conflict_revalidation",
          decision: "revalidation_completed",
        }),
        expect.objectContaining({
          signalKind: "retention_hold_review",
          decision: "needs_follow_up",
        }),
      ]),
    );
    expect(JSON.stringify(listResponse.json())).not.toContain("duplicate_candidate");
    expect(duplicateListResponse.json()).toMatchObject({
      reviewOnly: true,
      decisions: [
        expect.objectContaining({
          id: "contact-duplicate-decision-api-001",
          contactId: "contact-ada",
          relatedContactId: "contact-river",
          decision: "acknowledged_duplicate_candidate",
          reason: "safe_identity_match",
        }),
      ],
    });
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
    const duplicateAudit = audit.events.filter(
      (event) => event.action === "contact.duplicate_resolution_decision.recorded",
    );
    expect(resolutionAudit).toHaveLength(3);
    expect(duplicateAudit).toHaveLength(1);
    expect(duplicateAudit[0]?.metadata).toMatchObject({
      contactId: "contact-ada",
      relatedContactId: "contact-river",
      decision: "acknowledged_duplicate_candidate",
      reason: "safe_identity_match",
      idempotencyKeyPresent: true,
      contactMerge: false,
      contactFieldMutation: "none",
      hiddenMatterDisclosure: false,
      rawMatchedValueRetention: false,
      privateReviewerNoteRetention: false,
      conflictCheckMutation: "none",
      portalPermissionWidening: false,
      contactPermissionWidening: false,
    });
    const auditJson = JSON.stringify([...resolutionAudit, ...duplicateAudit]);
    expect(auditJson).not.toContain("Synthetic private");
    expect(auditJson).not.toContain("ada@example.test");
    expect(auditJson).not.toContain("Possible duplicate");
    expect(JSON.stringify(duplicateAudit)).not.toContain("resolutionNote");
  });

  it("enforces duplicate resolution visible cues, idempotency, and staff-only access", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const visibleContacts = (repository as unknown as { contacts: Contact[] }).contacts;
    const riverContact = visibleContacts.find((contact) => contact.id === "contact-river");
    if (!riverContact) throw new Error("Expected sample contact-river fixture");
    riverContact.identifiers = [{ type: "email", value: "ada@example.test" }];
    const staffServer = testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    });

    const created = await staffServer.inject({
      method: "POST",
      url: "/api/contacts/contact-ada/duplicate-resolution-decisions",
      payload: {
        id: "contact-duplicate-decision-visibility",
        relatedContactId: "contact-river",
        decision: "needs_follow_up",
        reason: "reviewer_follow_up_required",
        idempotencyKey: "contact-ada:contact-river:follow-up",
      },
    });
    const replay = await staffServer.inject({
      method: "POST",
      url: "/api/contacts/contact-ada/duplicate-resolution-decisions",
      payload: {
        id: "contact-duplicate-decision-replay",
        relatedContactId: "contact-river",
        decision: "needs_follow_up",
        reason: "reviewer_follow_up_required",
        idempotencyKey: "contact-ada:contact-river:follow-up",
      },
    });
    const conflict = await staffServer.inject({
      method: "POST",
      url: "/api/contacts/contact-ada/duplicate-resolution-decisions",
      payload: {
        relatedContactId: "contact-river",
        decision: "not_duplicate",
        reason: "distinct_contact_verified",
        idempotencyKey: "contact-ada:contact-river:follow-up",
      },
    });
    const privateNoteAttempt = await staffServer.inject({
      method: "POST",
      url: "/api/contacts/contact-ada/duplicate-resolution-decisions",
      payload: {
        relatedContactId: "contact-river",
        decision: "not_duplicate",
        reason: "distinct_contact_verified",
        idempotencyKey: "contact-ada:contact-river:private-note-attempt",
        resolutionNote: "Synthetic private note should not be accepted.",
      },
    });
    const hiddenCue = await staffServer.inject({
      method: "POST",
      url: "/api/contacts/contact-ada/duplicate-resolution-decisions",
      payload: {
        relatedContactId: "contact-northstar",
        decision: "not_duplicate",
        reason: "distinct_contact_verified",
        idempotencyKey: "contact-ada:contact-northstar:not-duplicate",
      },
    });
    const hiddenContactList = await staffServer.inject({
      method: "GET",
      url: "/api/contacts/contact-northstar/duplicate-resolution-decisions",
    });
    const visibleList = await staffServer.inject({
      method: "GET",
      url: "/api/contacts/contact-ada/duplicate-resolution-decisions",
    });
    const portalServer = testServer({
      repository,
      user: user("client_external", ["matter-001"]),
    });
    const portalList = await portalServer.inject({
      method: "GET",
      url: "/api/contacts/contact-ada/duplicate-resolution-decisions",
    });
    const portalCreate = await portalServer.inject({
      method: "POST",
      url: "/api/contacts/contact-ada/duplicate-resolution-decisions",
      payload: {
        relatedContactId: "contact-river",
        decision: "needs_follow_up",
        reason: "reviewer_follow_up_required",
        idempotencyKey: "contact-ada:contact-river:portal-denied",
      },
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      decision: {
        id: "contact-duplicate-decision-visibility",
        contactId: "contact-ada",
        relatedContactId: "contact-river",
        decision: "needs_follow_up",
        reason: "reviewer_follow_up_required",
      },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({
      decision: { id: "contact-duplicate-decision-visibility" },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({
      message: "Idempotency key was reused with a different payload",
    });
    expect(privateNoteAttempt.statusCode).toBe(400);
    expect(privateNoteAttempt.json()).toMatchObject({ message: "Invalid request body" });
    expect(hiddenCue.statusCode).toBe(403);
    expect(hiddenCue.json()).toMatchObject({
      message: "Contact duplicate resolution requires a visible duplicate cue",
    });
    expect(hiddenContactList.statusCode).toBe(403);
    expect(portalList.statusCode).toBe(403);
    expect(portalCreate.statusCode).toBe(403);
    expect(visibleList.statusCode).toBe(200);
    expect(visibleList.json()).toMatchObject({
      reviewOnly: true,
      decisions: [
        expect.objectContaining({
          id: "contact-duplicate-decision-visibility",
          contactId: "contact-ada",
          relatedContactId: "contact-river",
        }),
      ],
    });
    const serialized = JSON.stringify({
      created: created.json(),
      visibleList: visibleList.json(),
    });
    expect(serialized).not.toContain("ada@example.test");
    expect(serialized).not.toContain("Synthetic private note");
    expect(serialized).not.toContain('"matchedValue"');
    expect(serialized).not.toContain('"matchedFields"');
    expect(serialized).not.toContain("matter-002");
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
    const duplicateDecisions = await testServer({
      user: user("client_external", ["matter-001"]),
    }).inject({
      method: "GET",
      url: "/api/contacts/contact-ada/duplicate-resolution-decisions",
    });
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
    expect(duplicateDecisions.statusCode).toBe(403);
    expect(duplicateDecisions.json()).toMatchObject({
      message: "Contact access required",
    });
    expect(createContact.statusCode).toBe(403);
    expect(createContact.json()).toMatchObject({
      message: "Contact access required",
    });
  });
});
