import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { AuditEvent, NewAuditEvent, ProfessionalRole, User } from "@open-practice/domain";
import { registerCalendarRoutes } from "./calendar.js";

const servers: FastifyInstance[] = [];

class AuditRecordingRepository extends InMemoryOpenPracticeRepository {
  readonly recordedAuditEvents: AuditEvent[] = [];

  async recordAuditEvent(event: AuditEvent): Promise<void> {
    this.recordedAuditEvents.push(event);
  }

  override async appendAuditEvent(event: NewAuditEvent): Promise<AuditEvent> {
    const appended = await super.appendAuditEvent(event);
    this.recordedAuditEvents.push(appended);
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
  emailJobQueue: { add: () => Promise<{ id: string }> } | undefined = undefined,
) {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerCalendarRoutes(server, { repository, emailJobQueue });
  servers.push(server);
  return server;
}

async function enableSmtp(repository: AuditRecordingRepository): Promise<void> {
  await repository.upsertProviderSetting({
    id: "provider-smtp-test",
    firmId: "firm-west-legal",
    kind: "smtp",
    key: "mailpit",
    enabled: true,
    encryptedConfig: "local-only",
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("calendar routes", () => {
  it("lists assigned matter events with a webcal-friendly subscription URL", async () => {
    const response = await testServer(user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/calendar/events?matterId=matter-001",
      headers: { host: "practice.example.test" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      subscriptionUrl: "webcal://practice.example.test/api/calendar/matters/matter-001.ics",
      events: [
        { id: "calendar-event-001", matterId: "matter-001" },
        {
          id: "calendar-event-002",
          matterId: "matter-001",
          attendees: [{ email: "ada.morgan@example.test", invitationStatus: "not_sent" }],
        },
      ],
    });
    expect(response.json()).not.toHaveProperty("principalUrl");
  });

  it("blocks cross-matter calendar reads and export", async () => {
    const server = testServer(user("licensee", ["matter-001"]));
    const listResponse = await server.inject({
      method: "GET",
      url: "/api/calendar/events?matterId=matter-002",
    });
    const exportResponse = await server.inject({
      method: "GET",
      url: "/api/calendar/matters/matter-002.ics",
    });

    expect(listResponse.statusCode).toBe(403);
    expect(listResponse.json()).toMatchObject({
      message: "Calendar event access required",
    });
    expect(exportResponse.statusCode).toBe(403);
    expect(exportResponse.body).not.toContain("Corporate records review");
  });

  it("denies calendar reads for billing-only roles", async () => {
    const response = await testServer(user("billing_bookkeeper", ["matter-001"])).inject({
      method: "GET",
      url: "/api/calendar/events?matterId=matter-001",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: "Calendar event access required",
    });
  });

  it("exports only the requested matter as text/calendar", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/calendar/matters/matter-001.ics",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/calendar");
    expect(response.body).toContain("BEGIN:VCALENDAR");
    expect(response.body).not.toContain("DTSTAMP:19700101T000000Z");
    expect(response.body).toContain("SUMMARY:Residential tenancy filing deadline");
    expect(response.body).not.toContain("Corporate records review");
  });

  it("creates, lists, and revokes current-user calendar app passwords without echoing secrets", async () => {
    const repository = new AuditRecordingRepository();
    const server = testServer(user("licensee", ["matter-001"]), repository);
    const created = await server.inject({
      method: "POST",
      url: "/api/calendar/credentials",
      headers: { host: "practice.example.test" },
      payload: { label: "Mina iPhone" },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      username: expect.stringContaining("firm-west-legal.user-licensee."),
      password: expect.any(String),
      caldavUrl: "http://practice.example.test/caldav",
      principalUrl: `http://practice.example.test/caldav/principals/${encodeURIComponent(
        created.json().username,
      )}/`,
      calendarHomeUrl: `http://practice.example.test/caldav/calendars/${encodeURIComponent(
        created.json().username,
      )}/`,
      credential: {
        label: "Mina iPhone",
      },
    });

    const listed = await server.inject({ method: "GET", url: "/api/calendar/credentials" });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().credentials).toHaveLength(1);
    expect(listed.body).not.toContain(created.json().password);
    expect(listed.body).not.toContain("passwordHash");

    const revoked = await server.inject({
      method: "POST",
      url: `/api/calendar/credentials/${created.json().credential.id}/revoke`,
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().credential.revokedAt).toEqual(expect.any(String));
    expect(repository.recordedAuditEvents.map((event) => event.action)).toEqual([
      "calendar.credential.created",
      "calendar.credential.revoked",
    ]);
    expect(repository.recordedAuditEvents).toEqual([
      expect.objectContaining({
        actorId: "user-licensee",
        resourceType: "calendar_credential",
        resourceId: created.json().credential.id,
        metadata: expect.objectContaining({ label: "Mina iPhone" }),
      }),
      expect.objectContaining({
        actorId: "user-licensee",
        resourceType: "calendar_credential",
        resourceId: created.json().credential.id,
        metadata: expect.objectContaining({ label: "Mina iPhone" }),
      }),
    ]);
  });

  it("creates, updates, and deletes event attendees with matter-scoped authorization", async () => {
    const repository = new AuditRecordingRepository();
    const server = testServer(user("licensee", ["matter-001"]), repository);
    const created = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-001/attendees",
      payload: {
        matterId: "matter-001",
        name: "Synthetic Reviewer",
        email: "reviewer@example.test",
        role: "optional",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      attendee: {
        name: "Synthetic Reviewer",
        email: "reviewer@example.test",
        role: "optional",
        responseStatus: "needs_action",
        invitationStatus: "not_sent",
      },
    });

    const attendeeId = created.json().attendee.id;
    const updated = await server.inject({
      method: "PATCH",
      url: `/api/calendar/events/calendar-event-001/attendees/${attendeeId}`,
      payload: {
        matterId: "matter-001",
        responseStatus: "accepted",
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().attendee.responseStatus).toBe("accepted");

    const deleted = await server.inject({
      method: "DELETE",
      url: `/api/calendar/events/calendar-event-001/attendees/${attendeeId}?matterId=matter-001`,
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().attendee.deletedAt).toEqual(expect.any(String));
    expect(repository.recordedAuditEvents.map((event) => event.action)).toEqual([
      "calendar.attendee.created",
      "calendar.attendee.updated",
      "calendar.attendee.deleted",
    ]);

    const crossMatter = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-003/attendees",
      payload: {
        matterId: "matter-002",
        name: "Cross Matter",
        email: "cross@example.test",
      },
    });
    expect(crossMatter.statusCode).toBe(403);
  });

  it("queues attendee invitations when SMTP and the email queue are configured", async () => {
    const repository = new AuditRecordingRepository();
    await enableSmtp(repository);
    const emailJobQueue = {
      add: async () => ({ id: "bull-calendar-invitation-001" }),
    };
    const server = testServer(user("licensee", ["matter-001"]), repository, emailJobQueue);

    const response = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-002/invitations",
      payload: { matterId: "matter-001" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      results: [
        {
          attendee: {
            id: "calendar-attendee-001",
            invitationStatus: "queued",
            invitationEmailId: expect.any(String),
            invitationJobId: expect.any(String),
          },
          queuedEmail: {
            templateKey: "calendar.invitation",
            status: "queued",
          },
        },
      ],
    });
    const email = await repository.getEmailOutbox(
      "firm-west-legal",
      response.json().results[0].attendee.invitationEmailId,
    );
    expect(email).toMatchObject({
      templateKey: "calendar.invitation",
      to: ["ada.morgan@example.test"],
      relatedResourceType: "calendar_event",
      relatedResourceId: "calendar-event-002",
    });
    const queuedAudit = repository.recordedAuditEvents.find(
      (event) => event.action === "calendar.invitation.queued",
    );
    expect(queuedAudit?.metadata).toMatchObject({
      matterId: "matter-001",
      attendeeId: "calendar-attendee-001",
      invitationStatus: "queued",
    });
    expect(JSON.stringify(queuedAudit?.metadata)).not.toContain("Client preparation call");
  });

  it("marks invitations skipped when email delivery is not configured", async () => {
    const repository = new AuditRecordingRepository();
    const server = testServer(user("licensee", ["matter-001"]), repository);

    const response = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-002/invitations",
      payload: { matterId: "matter-001" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      results: [
        {
          attendee: {
            id: "calendar-attendee-001",
            invitationStatus: "skipped",
          },
        },
      ],
    });
    expect(response.body).not.toContain("queuedEmail");
    expect(response.body).not.toContain("invitationEmailId");
    expect(repository.recordedAuditEvents.map((event) => event.action)).toEqual([
      "calendar.invitation.skipped",
    ]);
  });
});
