import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { AuditEvent, ProfessionalRole, User } from "@open-practice/domain";
import { registerCalendarRoutes } from "./calendar.js";

const servers: FastifyInstance[] = [];

class AuditRecordingRepository extends InMemoryOpenPracticeRepository {
  readonly recordedAuditEvents: AuditEvent[] = [];

  async recordAuditEvent(event: AuditEvent): Promise<void> {
    this.recordedAuditEvents.push(event);
  }

  override async listAuditEvents(
    firmId: string,
  ): Promise<{ events: AuditEvent[]; valid: boolean }> {
    const audit = await super.listAuditEvents(firmId);
    return {
      ...audit,
      events: [
        ...audit.events,
        ...this.recordedAuditEvents.filter((event) => event.firmId === firmId),
      ],
    };
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
  registerCalendarRoutes(server, { repository });
  servers.push(server);
  return server;
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
        { id: "calendar-event-002", matterId: "matter-001" },
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
});
