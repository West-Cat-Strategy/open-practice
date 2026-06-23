import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type MatterSummary,
  type OpenPracticeRepository,
} from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { authorizationFixtureCases } from "@open-practice/domain/authorization-fixtures";
import { registerMatterRoutes } from "./matters.js";

const firmId = "firm-west-legal";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  return {
    id: `user-${role}`,
    firmId,
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function testServer(
  authUser: User,
  repository: OpenPracticeRepository = new InMemoryOpenPracticeRepository(),
): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId, user: authUser };
  });
  registerMatterRoutes(server, { repository });
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

describe("matter routes", () => {
  it("matches the authorization fixture catalogue for matter list visibility", async () => {
    const matterCases = authorizationFixtureCases.filter((item) => item.family === "matter");
    expect(matterCases.map((item) => item.id)).toEqual([
      "matter:firm-wide:list-all",
      "matter:assigned:list-visible",
      "matter:unassigned:list-hidden",
    ]);

    const firmWide = await testServer(user("owner_admin", [])).inject({
      method: "GET",
      url: "/api/matters",
    });
    expect(firmWide.statusCode).toBe(200);
    expect(firmWide.json<MatterSummary[]>().map((matter) => matter.id)).toEqual(
      expect.arrayContaining(["matter-001", "matter-002"]),
    );

    const assigned = await testServer(user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/matters",
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json<MatterSummary[]>().map((matter) => matter.id)).toEqual(["matter-001"]);
  });

  it("returns full firm overview only to firm-wide readers", async () => {
    const response = await testServer(user("owner_admin", ["matter-001", "matter-002"])).inject({
      method: "GET",
      url: "/api/overview",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      metrics: {
        openMatters: 1,
        intakeMatters: 1,
        portalGrants: expect.any(Number),
      },
    });
    expect(response.json().users.length).toBeGreaterThan(1);
  });

  it("scopes overview metrics and users for matter-scoped readers", async () => {
    const response = await testServer(user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/overview",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      metrics: {
        openMatters: 1,
        intakeMatters: 0,
        portalGrants: 0,
      },
      users: [
        {
          id: "user-licensee",
          role: "licensee",
          assignedMatterIds: ["matter-001"],
        },
      ],
    });
  });

  it("rejects external client users from staff matter aggregates", async () => {
    const server = testServer(user("client_external", ["matter-001"]));

    const matters = await server.inject({ method: "GET", url: "/api/matters" });
    const overview = await server.inject({ method: "GET", url: "/api/overview" });

    expect(matters.statusCode).toBe(403);
    expect(overview.statusCode).toBe(403);
    expect(matters.json()).toMatchObject({ message: "Staff access required" });
    expect(overview.json()).toMatchObject({ message: "Staff access required" });
  });

  it("lists firm matters for firm-wide readers without assignments", async () => {
    const response = await testServer(user("owner_admin", [])).inject({
      method: "GET",
      url: "/api/matters",
    });

    expect(response.statusCode).toBe(200);
    const matters = response.json<MatterSummary[]>();
    expect(matters.map((matter) => matter.id)).toEqual(
      expect.arrayContaining(["matter-001", "matter-002"]),
    );
  });

  it("includes read-only setup profiles on authorized matter summaries", async () => {
    const response = await testServer(user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/matters",
    });

    expect(response.statusCode).toBe(200);
    const matters = response.json<MatterSummary[]>();
    expect(matters).toHaveLength(1);
    expect(matters[0]?.setupProfile).toMatchObject({
      stage: {
        key: "open",
        label: "Open",
      },
      responsibleUser: {
        state: "assigned",
        responsibleUserId: "user-licensee",
      },
      financialSnapshot: {
        caution: expect.stringContaining("read-only setup context"),
      },
    });
    expect(matters[0]?.setupProfile.fieldDefinitions.map((field) => field.key)).toEqual([
      "practiceArea",
      "jurisdiction",
      "openedOn",
      "status",
    ]);
    expect(JSON.stringify(matters[0]?.setupProfile)).not.toContain("client@example");
  });

  it("keeps matter-scoped readers assignment-limited when no matters are assigned", async () => {
    const response = await testServer(user("licensee", [])).inject({
      method: "GET",
      url: "/api/matters",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it("creates a first matter with a client, assignment, scoped listing, and safe audit metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer(user("licensee", []), repository).inject({
      method: "POST",
      url: "/api/matters",
      payload: {
        title: "Synthetic starter intake",
        practiceArea: "Residential tenancy",
        jurisdiction: "BC",
        client: {
          kind: "person",
          displayName: "Synthetic Client",
          email: "synthetic.client@example.test",
          phone: "+1-555-0100",
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const created = response.json<MatterSummary>();
    expect(created).toMatchObject({
      title: "Synthetic starter intake",
      practiceArea: "Residential tenancy",
      jurisdiction: "BC",
      status: "intake",
      responsibleUserId: "user-licensee",
    });
    expect(created.number).toMatch(new RegExp(`^${new Date().getUTCFullYear()}-\\d{4}$`));
    expect(created.parties).toHaveLength(1);
    expect(created.parties[0]).toMatchObject({
      role: "prospective_client",
      adverse: false,
      confidential: true,
      contact: {
        kind: "person",
        displayName: "Synthetic Client",
        identifiers: [
          { type: "email", value: "synthetic.client@example.test" },
          { type: "phone", value: "+1-555-0100" },
        ],
      },
    });

    const refreshedUser = await repository.getUser(firmId, "user-licensee");
    expect(refreshedUser?.assignedMatterIds).toContain(created.id);
    expect(
      (await repository.listMattersForUser(refreshedUser!)).some(
        (matter) => matter.id === created.id,
      ),
    ).toBe(true);

    const audit = await repository.listAuditEvents(firmId);
    const createdEvent = audit.events.find(
      (event) => event.action === "matter.opened" && event.resourceId === created.id,
    );
    expect(createdEvent).toMatchObject({
      actorId: "user-licensee",
      resourceType: "matter",
      metadata: {
        matterId: created.id,
        source: "dashboard_zero_matter",
        clientContactCreated: true,
        partyRole: "prospective_client",
      },
    });
    expect(JSON.stringify(createdEvent?.metadata)).not.toContain("Synthetic Client");
    expect(JSON.stringify(createdEvent?.metadata)).not.toContain("synthetic.client@example.test");
    expect(JSON.stringify(createdEvent?.metadata)).not.toContain("+1-555-0100");
  });

  it("creates a first matter from a visible standalone contact without duplicating the contact", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createContact({
      id: "contact-standalone-matter",
      firmId,
      kind: "person",
      displayName: "Synthetic Existing Client",
      aliases: [],
      identifiers: [{ type: "email", value: "existing.client@example.test" }],
      createdByUserId: "user-licensee",
    });

    const response = await testServer(user("licensee", []), repository).inject({
      method: "POST",
      url: "/api/matters",
      payload: {
        title: "Synthetic contact-first intake",
        practiceArea: "Residential tenancy",
        jurisdiction: "BC",
        clientContactId: "contact-standalone-matter",
      },
    });

    expect(response.statusCode).toBe(201);
    const created = response.json<MatterSummary>();
    expect(created.parties).toEqual([
      expect.objectContaining({
        contactId: "contact-standalone-matter",
        role: "prospective_client",
        contact: expect.objectContaining({
          id: "contact-standalone-matter",
          displayName: "Synthetic Existing Client",
        }),
      }),
    ]);
    const contact = await repository.getContact(firmId, "contact-standalone-matter");
    expect(contact).toMatchObject({
      id: "contact-standalone-matter",
      displayName: "Synthetic Existing Client",
    });
    const audit = await repository.listAuditEvents(firmId);
    const createdEvent = audit.events.find(
      (event) => event.action === "matter.opened" && event.resourceId === created.id,
    );
    expect(createdEvent).toMatchObject({
      metadata: {
        matterId: created.id,
        source: "dashboard_zero_matter",
        clientContactCreated: false,
        partyRole: "prospective_client",
      },
    });
    expect(JSON.stringify(createdEvent?.metadata)).not.toContain("Synthetic Existing Client");
    expect(JSON.stringify(createdEvent?.metadata)).not.toContain("existing.client@example.test");
  });

  it("denies first matter creation from hidden contacts", async () => {
    const response = await testServer(user("licensee", [])).inject({
      method: "POST",
      url: "/api/matters",
      payload: {
        title: "Synthetic hidden-contact intake",
        practiceArea: "Residential tenancy",
        jurisdiction: "BC",
        clientContactId: "contact-northstar",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: "Matter client contact is not visible",
    });
  });

  it("validates first matter creation requests", async () => {
    const response = await testServer(user("licensee", [])).inject({
      method: "POST",
      url: "/api/matters",
      payload: {
        title: "",
        practiceArea: "Residential tenancy",
        jurisdiction: "BC",
        client: {
          kind: "person",
          displayName: "Synthetic Client",
          email: "not-an-email",
        },
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("denies matter creation to roles without matter:create", async () => {
    const response = await testServer(user("firm_member", [])).inject({
      method: "POST",
      url: "/api/matters",
      payload: {
        title: "Synthetic starter intake",
        practiceArea: "Residential tenancy",
        jurisdiction: "BC",
        client: {
          kind: "person",
          displayName: "Synthetic Client",
        },
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("records review-only lifecycle transition evidence without mutating matter status", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const before = await repository.listMattersForUser(user("licensee", ["matter-001"]));
    const response = await testServer(user("licensee", ["matter-001"]), repository).inject({
      method: "POST",
      url: "/api/matters/matter-001/lifecycle-transitions",
      payload: {
        transition: "close",
        readiness: "blocked",
        reason: "Synthetic close packet needs review.",
        blockers: ["Synthetic trust review remains open."],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      matterId: "matter-001",
      transition: "close",
      currentStatus: before[0]?.status,
      targetStatus: "closed",
      readiness: "blocked",
      reason: "Synthetic close packet needs review.",
      blockers: ["Synthetic trust review remains open."],
      reviewedByUserId: "user-licensee",
    });

    const after = await repository.listMattersForUser(user("licensee", ["matter-001"]));
    expect(after[0]).toMatchObject({
      id: "matter-001",
      status: before[0]?.status,
      lifecycleTransitions: [expect.objectContaining({ transition: "close" })],
    });
    expect(after[0]?.closedOn).toBe(before[0]?.closedOn);
    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "matter.lifecycle_transition_reviewed",
          resourceId: "matter-001",
          metadata: expect.objectContaining({
            transition: "close",
            targetStatus: "closed",
            readiness: "blocked",
            blockerCount: 1,
            reviewOnly: true,
          }),
        }),
      ]),
    );
    expect(JSON.stringify(audit.events)).not.toContain("Synthetic trust review remains open");
  });

  it("lists lifecycle transition evidence for visible matters", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-pause",
      firmId,
      matterId: "matter-001",
      transition: "pause",
      readiness: "ready",
      reason: "Synthetic pause review is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-16T12:00:00.000Z",
      createdAt: "2026-06-16T12:00:00.000Z",
      auditEventId: "audit-matter-lifecycle-pause",
    });

    const response = await testServer(user("licensee", ["matter-001"]), repository).inject({
      method: "GET",
      url: "/api/matters/matter-001/lifecycle-transitions",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      reviewOnly: true,
      transitions: [
        {
          id: "matter-lifecycle-pause",
          transition: "pause",
          currentStatus: "open",
          targetStatus: "paused",
          readiness: "ready",
        },
      ],
    });
  });

  it("keeps lifecycle transition routes staff-only and matter-scoped", async () => {
    const client = await testServer(user("client_external", ["matter-001"])).inject({
      method: "GET",
      url: "/api/matters/matter-001/lifecycle-transitions",
    });
    const crossMatter = await testServer(user("licensee", ["matter-001"])).inject({
      method: "POST",
      url: "/api/matters/matter-002/lifecycle-transitions",
      payload: {
        transition: "archive",
        readiness: "ready",
        reason: "Synthetic archive review is ready.",
      },
    });
    const firmWide = await testServer(
      user("owner_admin", []),
      new InMemoryOpenPracticeRepository(),
    ).inject({
      method: "GET",
      url: "/api/matters/matter-002/lifecycle-transitions",
    });

    expect(client.statusCode).toBe(403);
    expect(crossMatter.statusCode).toBe(403);
    expect(firmWide.statusCode).toBe(200);
  });

  it("executes pause, reopen, close, and archive lifecycle commands after latest ready review evidence", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const [before] = await repository.listMattersForUser(user("licensee", ["matter-001"]));
    const pauseRecord = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-api-ready-pause",
      firmId,
      matterId: "matter-001",
      transition: "pause",
      readiness: "ready",
      reason: "Synthetic pause review is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:00:00.000Z",
      createdAt: "2026-06-19T12:00:00.000Z",
      auditEventId: "audit-matter-lifecycle-api-ready-pause",
    });
    const pause = await testServer(user("licensee", ["matter-001"]), repository).inject({
      method: "POST",
      url: "/api/matters/matter-001/lifecycle-commands",
      payload: {
        command: "pause",
        expectedStatus: "open",
        transitionRecordId: pauseRecord.id,
        reason: "Synthetic operator confirmed pause execution.",
        idempotencyKey: "synthetic-api-pause-command-key",
      },
    });

    expect(pause.statusCode).toBe(200);
    expect(pause.json()).toMatchObject({
      matter: {
        id: "matter-001",
        status: "paused",
        trustBalanceCents: before?.trustBalanceCents,
      },
      lifecycleCommand: {
        command: "pause",
        matterId: "matter-001",
        transitionRecordId: pauseRecord.id,
        beforeStatus: "open",
        expectedStatus: "open",
        afterStatus: "paused",
        executedByUserId: "user-licensee",
        reviewFirst: true,
        consequences: {
          matterStatusChanged: true,
          closedOnChanged: false,
          portalAccessChanged: false,
          taskChanged: false,
          assignmentChanged: false,
          billingChanged: false,
          trustChanged: false,
          cleanupRun: false,
        },
      },
    });
    expect(pause.json<{ matter: MatterSummary }>().matter.closedOn).toBe(before?.closedOn);
    expect(pause.json().matter.timeEntries).toHaveLength(before?.timeEntries.length ?? 0);
    expect(pause.json().matter.expenses).toHaveLength(before?.expenses.length ?? 0);

    const reopenRecord = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-api-ready-reopen",
      firmId,
      matterId: "matter-001",
      transition: "reopen",
      readiness: "ready",
      reason: "Synthetic reopen review is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:10:00.000Z",
      createdAt: "2026-06-19T12:10:00.000Z",
      auditEventId: "audit-matter-lifecycle-api-ready-reopen",
    });
    const reopen = await testServer(user("licensee", ["matter-001"]), repository).inject({
      method: "POST",
      url: "/api/matters/matter-001/lifecycle-commands",
      payload: {
        command: "reopen",
        expectedStatus: "paused",
        transitionRecordId: reopenRecord.id,
        reason: "Synthetic operator confirmed reopen execution.",
        idempotencyKey: "synthetic-api-reopen-command-key",
      },
    });

    expect(reopen.statusCode).toBe(200);
    expect(reopen.json()).toMatchObject({
      matter: { id: "matter-001", status: "open" },
      lifecycleCommand: {
        command: "reopen",
        beforeStatus: "paused",
        expectedStatus: "paused",
        afterStatus: "open",
        consequences: {
          billingChanged: false,
          trustChanged: false,
          cleanupRun: false,
        },
      },
    });
    expect(reopen.json<{ matter: MatterSummary }>().matter.closedOn).toBe(before?.closedOn);

    const closeRecord = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-api-ready-close",
      firmId,
      matterId: "matter-001",
      transition: "close",
      readiness: "ready",
      reason: "Synthetic close review is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:20:00.000Z",
      createdAt: "2026-06-19T12:20:00.000Z",
      auditEventId: "audit-matter-lifecycle-api-ready-close",
    });
    const close = await testServer(user("licensee", ["matter-001"]), repository).inject({
      method: "POST",
      url: "/api/matters/matter-001/lifecycle-commands",
      payload: {
        command: "close",
        expectedStatus: "open",
        transitionRecordId: closeRecord.id,
        reason: "Synthetic operator confirmed close execution.",
        idempotencyKey: "synthetic-api-close-command-key",
      },
    });

    expect(close.statusCode).toBe(200);
    expect(close.json()).toMatchObject({
      matter: {
        id: "matter-001",
        status: "closed",
        trustBalanceCents: before?.trustBalanceCents,
      },
      lifecycleCommand: {
        command: "close",
        matterId: "matter-001",
        transitionRecordId: closeRecord.id,
        beforeStatus: "open",
        expectedStatus: "open",
        afterStatus: "closed",
        executedByUserId: "user-licensee",
        reviewFirst: true,
        consequences: {
          matterStatusChanged: true,
          closedOnChanged: false,
          portalAccessChanged: false,
          taskChanged: false,
          assignmentChanged: false,
          billingChanged: false,
          trustChanged: false,
          cleanupRun: false,
        },
      },
    });
    expect(close.json<{ matter: MatterSummary }>().matter.closedOn).toBe(before?.closedOn);
    expect(close.json().matter.timeEntries).toHaveLength(before?.timeEntries.length ?? 0);
    expect(close.json().matter.expenses).toHaveLength(before?.expenses.length ?? 0);

    const archiveRecord = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-api-ready-archive",
      firmId,
      matterId: "matter-001",
      transition: "archive",
      readiness: "ready",
      reason: "Synthetic archive review is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:30:00.000Z",
      createdAt: "2026-06-19T12:30:00.000Z",
      auditEventId: "audit-matter-lifecycle-api-ready-archive",
    });
    const archive = await testServer(user("licensee", ["matter-001"]), repository).inject({
      method: "POST",
      url: "/api/matters/matter-001/lifecycle-commands",
      payload: {
        command: "archive",
        expectedStatus: "closed",
        transitionRecordId: archiveRecord.id,
        reason: "Synthetic operator confirmed archive execution.",
        idempotencyKey: "synthetic-api-archive-command-key",
      },
    });

    expect(archive.statusCode).toBe(200);
    expect(archive.json()).toMatchObject({
      matter: {
        id: "matter-001",
        status: "archived",
        trustBalanceCents: before?.trustBalanceCents,
      },
      lifecycleCommand: {
        command: "archive",
        matterId: "matter-001",
        transitionRecordId: archiveRecord.id,
        beforeStatus: "closed",
        expectedStatus: "closed",
        afterStatus: "archived",
        executedByUserId: "user-licensee",
        reviewFirst: true,
        consequences: {
          matterStatusChanged: true,
          closedOnChanged: false,
          portalAccessChanged: false,
          taskChanged: false,
          assignmentChanged: false,
          billingChanged: false,
          trustChanged: false,
          cleanupRun: false,
        },
      },
    });
    expect(archive.json<{ matter: MatterSummary }>().matter.closedOn).toBe(before?.closedOn);
    expect(archive.json().matter.timeEntries).toHaveLength(before?.timeEntries.length ?? 0);
    expect(archive.json().matter.expenses).toHaveLength(before?.expenses.length ?? 0);

    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "matter.lifecycle_command_executed",
          resourceId: "matter-001",
          metadata: expect.objectContaining({
            transitionRecordId: pauseRecord.id,
            lifecycleCommand: "pause",
            reasonPresent: true,
            idempotencyKeyPresent: true,
            billingChanged: false,
            trustChanged: false,
            cleanupRun: false,
          }),
        }),
        expect.objectContaining({
          action: "matter.lifecycle_command_executed",
          resourceId: "matter-001",
          metadata: expect.objectContaining({
            transitionRecordId: closeRecord.id,
            lifecycleCommand: "close",
            beforeStatus: "open",
            afterStatus: "closed",
            closedOnChanged: false,
            billingChanged: false,
            trustChanged: false,
            cleanupRun: false,
          }),
        }),
        expect.objectContaining({
          action: "matter.lifecycle_command_executed",
          resourceId: "matter-001",
          metadata: expect.objectContaining({
            transitionRecordId: archiveRecord.id,
            lifecycleCommand: "archive",
            beforeStatus: "closed",
            expectedStatus: "closed",
            afterStatus: "archived",
            closedOnChanged: false,
            portalAccessChanged: false,
            taskChanged: false,
            assignmentChanged: false,
            billingChanged: false,
            trustChanged: false,
            cleanupRun: false,
          }),
        }),
      ]),
    );
    expect(JSON.stringify(audit.events)).not.toContain("Synthetic operator confirmed");
    expect(JSON.stringify(audit.events)).not.toContain("synthetic-api-pause-command-key");
    expect(JSON.stringify(audit.events)).not.toContain("synthetic-api-reopen-command-key");
    expect(JSON.stringify(audit.events)).not.toContain("synthetic-api-close-command-key");
    expect(JSON.stringify(audit.events)).not.toContain("synthetic-api-archive-command-key");
  });

  it("keeps lifecycle command routes staff-only and matter-scoped", async () => {
    const client = await testServer(user("client_external", ["matter-001"])).inject({
      method: "POST",
      url: "/api/matters/matter-001/lifecycle-commands",
      payload: {
        command: "pause",
        expectedStatus: "open",
        transitionRecordId: "matter-lifecycle-api-ready-pause",
        reason: "Synthetic operator confirmed pause execution.",
        idempotencyKey: "synthetic-client-command-key",
      },
    });
    const crossMatter = await testServer(user("licensee", ["matter-001"])).inject({
      method: "POST",
      url: "/api/matters/matter-002/lifecycle-commands",
      payload: {
        command: "pause",
        expectedStatus: "open",
        transitionRecordId: "matter-lifecycle-api-ready-pause",
        reason: "Synthetic operator confirmed pause execution.",
        idempotencyKey: "synthetic-cross-matter-command-key",
      },
    });

    expect(client.statusCode).toBe(403);
    expect(crossMatter.statusCode).toBe(403);
  });

  it("rejects lifecycle commands without latest ready matching evidence", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const ready = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-api-stale-pause",
      firmId,
      matterId: "matter-001",
      transition: "pause",
      readiness: "ready",
      reason: "Synthetic pause review was ready earlier.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:00:00.000Z",
      createdAt: "2026-06-19T12:00:00.000Z",
      auditEventId: "audit-matter-lifecycle-api-stale-pause",
    });
    await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-api-blocked-pause",
      firmId,
      matterId: "matter-001",
      transition: "pause",
      readiness: "blocked",
      reason: "Synthetic pause review is blocked.",
      blockers: ["Synthetic blocker."],
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:10:00.000Z",
      createdAt: "2026-06-19T12:10:00.000Z",
      auditEventId: "audit-matter-lifecycle-api-blocked-pause",
    });

    const stale = await testServer(user("licensee", ["matter-001"]), repository).inject({
      method: "POST",
      url: "/api/matters/matter-001/lifecycle-commands",
      payload: {
        command: "pause",
        expectedStatus: "open",
        transitionRecordId: ready.id,
        reason: "Synthetic operator confirmed pause execution.",
        idempotencyKey: "synthetic-stale-command-key",
      },
    });
    const missing = await testServer(user("licensee", ["matter-001"]), repository).inject({
      method: "POST",
      url: "/api/matters/matter-001/lifecycle-commands",
      payload: {
        command: "reopen",
        expectedStatus: "paused",
        transitionRecordId: "matter-lifecycle-missing-reopen",
        reason: "Synthetic operator confirmed reopen execution.",
        idempotencyKey: "synthetic-missing-command-key",
      },
    });

    expect(stale.statusCode).toBe(409);
    expect(missing.statusCode).toBe(409);
    const [after] = await repository.listMattersForUser(user("licensee", ["matter-001"]));
    expect(after.status).toBe("open");
  });

  it("validates lifecycle command bodies before execution", async () => {
    const unsupportedExpectedStatus = await testServer(user("licensee", ["matter-001"])).inject({
      method: "POST",
      url: "/api/matters/matter-001/lifecycle-commands",
      payload: {
        command: "archive",
        expectedStatus: "archived",
        transitionRecordId: "matter-lifecycle-archive",
        reason: "Synthetic archive command needs its current closed status.",
        idempotencyKey: "synthetic-archive-command-key",
      },
    });
    const missingIdempotencyKey = await testServer(user("licensee", ["matter-001"])).inject({
      method: "POST",
      url: "/api/matters/matter-001/lifecycle-commands",
      payload: {
        command: "pause",
        expectedStatus: "open",
        transitionRecordId: "matter-lifecycle-pause",
        reason: "Synthetic pause command needs an idempotency key.",
      },
    });

    expect(unsupportedExpectedStatus.statusCode).toBe(400);
    expect(missingIdempotencyKey.statusCode).toBe(400);
  });

  it("validates lifecycle transition review evidence", async () => {
    const missingReason = await testServer(user("licensee", ["matter-001"])).inject({
      method: "POST",
      url: "/api/matters/matter-001/lifecycle-transitions",
      payload: {
        transition: "reopen",
        readiness: "ready",
        reason: "",
      },
    });
    const missingBlocker = await testServer(user("licensee", ["matter-001"])).inject({
      method: "POST",
      url: "/api/matters/matter-001/lifecycle-transitions",
      payload: {
        transition: "archive",
        readiness: "blocked",
        reason: "Synthetic archive review is blocked.",
      },
    });

    expect(missingReason.statusCode).toBe(400);
    expect(missingBlocker.statusCode).toBe(400);
  });

  it("redacts conflict-check details for non firm-wide reviewers", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer(user("licensee", ["matter-001"]), repository).inject({
      method: "POST",
      url: "/api/conflicts/check",
      payload: {
        prospectiveName: "Ada Morgan",
        identifiers: [{ type: "email", value: "ada@example.test" }],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      results: [],
      summary: {
        matchCount: expect.any(Number),
        detailsRedacted: true,
        countsBySeverity: expect.any(Object),
      },
    });
    expect(response.json()).not.toHaveProperty("auditChainValid");
    expect(JSON.stringify(response.json())).not.toContain("contact-");
    expect(JSON.stringify(response.json())).not.toContain("matter-");
    expect(JSON.stringify(response.json())).not.toContain("ada@example.test");

    const audit = await repository.listAuditEvents("firm-west-legal");
    const conflictAudit = audit.events.find((event) => event.action === "conflict_check.completed");
    expect(conflictAudit).toMatchObject({
      resourceType: "conflict_check",
      metadata: {
        resultCount: expect.any(Number),
        includeClosedMatters: true,
      },
    });
    const serializedAudit = JSON.stringify(conflictAudit);
    expect(serializedAudit).not.toContain("Ada Morgan");
    expect(serializedAudit).not.toContain("ada@example.test");
    expect(serializedAudit).not.toContain("matchCount");
  });

  it("keeps full conflict-check details for firm-wide reviewers", async () => {
    const response = await testServer(user("owner_admin", [])).inject({
      method: "POST",
      url: "/api/conflicts/check",
      payload: {
        prospectiveName: "Ada Morgan",
        identifiers: [{ type: "email", value: "ada@example.test" }],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().results.length).toBeGreaterThan(0);
    expect(response.json().results[0]).toEqual(
      expect.objectContaining({
        contactId: expect.any(String),
        severity: expect.any(String),
      }),
    );
  });
});
