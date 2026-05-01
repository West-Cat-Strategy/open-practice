import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { AuditEvent, ProfessionalRole, User } from "@open-practice/domain";
import type { InjectOptions, LightMyRequestResponse } from "fastify";
import { isPublicRoute } from "../http/auth-helpers.js";
import { createApiServer } from "../server.js";

const servers: Array<{ close: () => Promise<void> }> = [];

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

function basic(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
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

function testServer(repository = new AuditRecordingRepository()) {
  const server = createApiServer({
    repository,
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    webAuthn: {
      rpName: "Test RP",
      rpID: "localhost",
      origin: "http://localhost:3000",
    },
  });
  servers.push(server);
  return { server, repository };
}

type CalDavInjectOptions = Omit<InjectOptions, "method"> & {
  method: "PROPFIND" | "REPORT";
};

async function injectCalDav(
  server: ReturnType<typeof createApiServer>,
  options: CalDavInjectOptions,
): Promise<LightMyRequestResponse> {
  return server.inject({
    ...options,
    method: options.method as never,
  }) as unknown as Promise<LightMyRequestResponse>;
}

async function createCalendarCredential(
  server: ReturnType<typeof createApiServer>,
  userId = "user-licensee",
) {
  const response = await server.inject({
    method: "POST",
    url: "/api/calendar/credentials",
    headers: {
      "x-open-practice-user-id": userId,
      "x-open-practice-firm-id": "firm-west-legal",
      host: "practice.example.test",
    },
    payload: { label: "iOS Calendar" },
  });
  expect(response.statusCode).toBe(201);
  return response.json() as {
    username: string;
    password: string;
    credential: { id: string };
  };
}

const eventPayload = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:ios-event-001@example.test\r
DTSTAMP:20260430T120000Z\r
DTSTART:20260510T160000Z\r
DTEND:20260510T170000Z\r
SUMMARY:iOS synced prep call\r
DESCRIPTION:Synthetic CalDAV write\r
LOCATION:Open Practice office\r
STATUS:CONFIRMED\r
SEQUENCE:0\r
END:VEVENT\r
END:VCALENDAR\r
`;

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("CalDAV routes", () => {
  it("discovers a principal and calendar home for iOS-style CalDAV setup", async () => {
    const { server } = testServer();
    const credential = await createCalendarCredential(server);
    const response = await injectCalDav(server, {
      method: "PROPFIND",
      url: "/caldav",
      headers: { authorization: basic(credential.username, credential.password) },
      payload: '<D:propfind xmlns:D="DAV:" />',
    });

    expect(response.statusCode).toBe(207);
    expect(response.body).toContain("<D:current-user-principal>");
    expect(response.body).toContain(`/caldav/principals/${credential.username}/`);

    const principal = await injectCalDav(server, {
      method: "PROPFIND",
      url: `/caldav/principals/${encodeURIComponent(credential.username)}/`,
      headers: { authorization: basic(credential.username, credential.password) },
      payload: '<D:propfind xmlns:D="DAV:" />',
    });

    expect(principal.statusCode).toBe(207);
    expect(principal.body).toContain("<C:calendar-home-set>");
    expect(principal.body).toContain(`/caldav/calendars/${credential.username}/`);
  });

  it("lists only calendar collections for matters the calendar user can access", async () => {
    const { server } = testServer();
    const credential = await createCalendarCredential(server);
    const response = await injectCalDav(server, {
      method: "PROPFIND",
      url: `/caldav/calendars/${encodeURIComponent(credential.username)}/`,
      headers: { authorization: basic(credential.username, credential.password) },
      payload: '<D:propfind xmlns:D="DAV:" />',
    });

    expect(response.statusCode).toBe(207);
    expect(response.body).toContain("/matter-001/");
    expect(response.body).not.toContain("/matter-002/");
  });

  it("runs calendar-query reports without leaking cross-matter events", async () => {
    const { server } = testServer();
    const credential = await createCalendarCredential(server);
    const response = await injectCalDav(server, {
      method: "REPORT",
      url: `/caldav/calendars/${encodeURIComponent(credential.username)}/matter-001/`,
      headers: {
        authorization: basic(credential.username, credential.password),
        "content-type": "application/xml",
      },
      payload:
        '<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><D:getetag/><C:calendar-data/></D:prop><C:filter><C:comp-filter name="VCALENDAR"/></C:filter></C:calendar-query>',
    });

    expect(response.statusCode).toBe(207);
    expect(response.body).toContain("Residential tenancy filing deadline");
    expect(response.body).not.toContain("Corporate records review");
  });

  it("creates, reads, rejects stale writes, and deletes matter events through CalDAV", async () => {
    const { server, repository } = testServer();
    const credential = await createCalendarCredential(server);
    const objectUrl = `/caldav/calendars/${encodeURIComponent(
      credential.username,
    )}/matter-001/ios-event-001.ics`;
    const created = await server.inject({
      method: "PUT",
      url: objectUrl,
      headers: {
        authorization: basic(credential.username, credential.password),
        "content-type": "text/calendar",
        "if-none-match": "*",
      },
      payload: eventPayload,
    });

    expect(created.statusCode).toBe(201);
    const etag = created.headers.etag as string;
    expect(etag).toEqual(expect.stringContaining("ios-event-001"));

    const fetched = await server.inject({
      method: "GET",
      url: objectUrl,
      headers: { authorization: basic(credential.username, credential.password) },
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.body).toContain("SUMMARY:iOS synced prep call");

    const updated = await server.inject({
      method: "PUT",
      url: objectUrl,
      headers: {
        authorization: basic(credential.username, credential.password),
        "content-type": "text/calendar",
        "if-match": etag,
      },
      payload: eventPayload.replace("iOS synced prep call", "Updated prep call"),
    });
    expect(updated.statusCode).toBe(204);
    const updatedEtag = updated.headers.etag as string;

    const stale = await server.inject({
      method: "PUT",
      url: objectUrl,
      headers: {
        authorization: basic(credential.username, credential.password),
        "content-type": "text/calendar",
        "if-match": '"stale"',
      },
      payload: eventPayload.replace("iOS synced prep call", "Updated prep call"),
    });
    expect(stale.statusCode).toBe(412);

    const deleted = await server.inject({
      method: "DELETE",
      url: objectUrl,
      headers: {
        authorization: basic(credential.username, credential.password),
        "if-match": updatedEtag,
      },
    });
    expect(deleted.statusCode).toBe(204);

    const missing = await server.inject({
      method: "GET",
      url: objectUrl,
      headers: { authorization: basic(credential.username, credential.password) },
    });
    expect(missing.statusCode).toBe(404);
    expect(repository.recordedAuditEvents.map((event) => event.action)).toEqual([
      "calendar.credential.created",
      "calendar.event.created",
      "calendar.event.updated",
      "calendar.event.deleted",
    ]);
    expect(repository.recordedAuditEvents.slice(1)).toEqual([
      expect.objectContaining({
        actorId: "user-licensee",
        resourceType: "calendar_event",
        resourceId: "ios-event-001",
        metadata: expect.objectContaining({
          matterId: "matter-001",
          source: "caldav",
        }),
      }),
      expect.objectContaining({
        actorId: "user-licensee",
        resourceType: "calendar_event",
        resourceId: "ios-event-001",
        metadata: expect.objectContaining({
          matterId: "matter-001",
          source: "caldav",
        }),
      }),
      expect.objectContaining({
        actorId: "user-licensee",
        resourceType: "calendar_event",
        resourceId: "ios-event-001",
        metadata: expect.objectContaining({
          matterId: "matter-001",
          source: "caldav",
        }),
      }),
    ]);
  });

  it("denies cross-matter and billing-only CalDAV access", async () => {
    const { server, repository } = testServer();
    await repository.createUser(user("billing_bookkeeper", ["matter-001"]));
    const licensee = await createCalendarCredential(server);
    const bookkeeper = await createCalendarCredential(server, "user-billing_bookkeeper");

    const crossMatter = await injectCalDav(server, {
      method: "REPORT",
      url: `/caldav/calendars/${encodeURIComponent(licensee.username)}/matter-002/`,
      headers: {
        authorization: basic(licensee.username, licensee.password),
        "content-type": "application/xml",
      },
      payload: '<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav" />',
    });
    expect(crossMatter.statusCode).toBe(403);
    expect(crossMatter.body).not.toContain("Corporate records review");

    const billingRead = await injectCalDav(server, {
      method: "REPORT",
      url: `/caldav/calendars/${encodeURIComponent(bookkeeper.username)}/matter-001/`,
      headers: {
        authorization: basic(bookkeeper.username, bookkeeper.password),
        "content-type": "application/xml",
      },
      payload: '<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav" />',
    });
    expect(billingRead.statusCode).toBe(403);
  });

  it("rejects revoked app passwords and unsupported calendar payloads", async () => {
    const { server } = testServer();
    const credential = await createCalendarCredential(server);
    const unsupportedPayloads = [
      eventPayload.replace("END:VEVENT", "RRULE:FREQ=DAILY\r\nEND:VEVENT"),
      eventPayload.replace("END:VEVENT", "ATTENDEE:mailto:person@example.test\r\nEND:VEVENT"),
      eventPayload.replace(
        "END:VEVENT",
        "BEGIN:VALARM\r\nTRIGGER:-PT15M\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nEND:VALARM\r\nEND:VEVENT",
      ),
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTODO\r\nUID:task\r\nSUMMARY:Task\r\nEND:VTODO\r\nEND:VCALENDAR\r\n",
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VFREEBUSY\r\nUID:busy\r\nFREEBUSY:20260510T160000Z/20260510T170000Z\r\nEND:VFREEBUSY\r\nEND:VCALENDAR\r\n",
      eventPayload.replace("VERSION:2.0", "VERSION:2.0\r\nMETHOD:REQUEST"),
    ];

    for (const [index, payload] of unsupportedPayloads.entries()) {
      const unsupported = await server.inject({
        method: "PUT",
        url: `/caldav/calendars/${encodeURIComponent(
          credential.username,
        )}/matter-001/unsupported-${index}.ics`,
        headers: {
          authorization: basic(credential.username, credential.password),
          "content-type": "text/calendar",
          "if-none-match": "*",
        },
        payload,
      });
      expect(unsupported.statusCode).toBe(422);
    }

    const revoked = await server.inject({
      method: "POST",
      url: `/api/calendar/credentials/${credential.credential.id}/revoke`,
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    expect(revoked.statusCode).toBe(200);

    const denied = await injectCalDav(server, {
      method: "PROPFIND",
      url: `/caldav/calendars/${encodeURIComponent(credential.username)}/`,
      headers: { authorization: basic(credential.username, credential.password) },
      payload: '<D:propfind xmlns:D="DAV:" />',
    });
    expect(denied.statusCode).toBe(401);
  });

  it("rejects unsupported CalDAV REPORT filters and scheduling reports", async () => {
    const { server } = testServer();
    const credential = await createCalendarCredential(server);
    const unsupportedReports = [
      '<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT"><C:prop-filter name="RRULE"/></C:comp-filter></C:comp-filter></C:filter></C:calendar-query>',
      '<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT"><C:prop-filter name="ATTENDEE"/></C:comp-filter></C:comp-filter></C:filter></C:calendar-query>',
      '<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT"><C:comp-filter name="VALARM"/></C:comp-filter></C:comp-filter></C:filter></C:calendar-query>',
      '<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VTODO"/></C:filter></C:calendar-query>',
      '<C:free-busy-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:time-range start="20260510T160000Z" end="20260510T170000Z"/></C:free-busy-query>',
      '<C:schedule-query xmlns:C="urn:ietf:params:xml:ns:caldav" />',
    ];

    for (const payload of unsupportedReports) {
      const response = await injectCalDav(server, {
        method: "REPORT",
        url: `/caldav/calendars/${encodeURIComponent(credential.username)}/matter-001/`,
        headers: {
          authorization: basic(credential.username, credential.password),
          "content-type": "application/xml",
        },
        payload,
      });
      expect(response.statusCode).toBe(422);
    }
  });

  it("matches only exact CalDAV public route shapes", async () => {
    expect(isPublicRoute("PROPFIND", "/caldav")).toBe(true);
    expect(isPublicRoute("PROPFIND", "/caldav/calendars/user-001/matter-001/event-001.ics")).toBe(
      true,
    );
    expect(isPublicRoute("GET", "/caldav-not-a-public-prefix")).toBe(false);
    expect(isPublicRoute("GET", "/caldav/calendars/user-001/matter-001/event-001.ics/extra")).toBe(
      false,
    );
  });
});
