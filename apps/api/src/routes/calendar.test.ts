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
  meetingLinks:
    | {
        providerKey: string;
        hostedMeetingBaseUrl?: string;
        guestAccessTokenSigningConfigured?: boolean;
      }
    | undefined = undefined,
  jwtSecret = "calendar-guest-session-test-secret-at-least-32-characters",
  publicWebBaseUrl = "https://practice.example.test",
) {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerCalendarRoutes(server, {
    repository,
    emailJobQueue,
    meetingLinks,
    jwtSecret,
    publicWebBaseUrl,
  });
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

function deliveryConfirmation(recipientCount = 1) {
  return { confirmed: true, channel: "email", recipientCount };
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
          meetingInvitationBoundary: {
            meetingLinks: { status: "disabled", reason: "not_configured" },
            guestAccess: { status: "disabled", reason: "not_configured" },
            invitationEmail: { status: "disabled", reason: "smtp_not_configured" },
          },
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

  it("creates, updates, cancels, and reschedules matter-scoped calendar events", async () => {
    const repository = new AuditRecordingRepository();
    const server = testServer(user("licensee", ["matter-001"]), repository);

    const created = await server.inject({
      method: "POST",
      url: "/api/calendar/events",
      payload: {
        matterId: "matter-001",
        title: "Synthetic lifecycle conference",
        startsAt: "2026-05-12T16:00:00.000Z",
        endsAt: "2026-05-12T17:00:00.000Z",
        description: "Synthetic event body should not enter audit metadata.",
        location: "Room 4",
        status: "tentative",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().event).toMatchObject({
      matterId: "matter-001",
      title: "Synthetic lifecycle conference",
      status: "tentative",
      sequence: 0,
      meetingLinkMode: "blank",
      reminders: [],
    });
    const eventId = created.json().event.id;

    const updated = await server.inject({
      method: "PATCH",
      url: `/api/calendar/events/${eventId}`,
      payload: {
        matterId: "matter-001",
        title: "Updated lifecycle conference",
        startsAt: "2026-05-12T16:30:00.000Z",
        endsAt: "2026-05-12T17:30:00.000Z",
        status: "confirmed",
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().event).toMatchObject({
      title: "Updated lifecycle conference",
      startsAt: "2026-05-12T16:30:00.000Z",
      endsAt: "2026-05-12T17:30:00.000Z",
      status: "confirmed",
      sequence: 1,
    });

    const cancelled = await server.inject({
      method: "POST",
      url: `/api/calendar/events/${eventId}/cancel`,
      payload: { matterId: "matter-001" },
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().event).toMatchObject({ status: "cancelled", sequence: 2 });

    const rescheduled = await server.inject({
      method: "POST",
      url: `/api/calendar/events/${eventId}/reschedule`,
      payload: {
        matterId: "matter-001",
        startsAt: "2026-05-13T18:00:00.000Z",
        endsAt: "2026-05-13T19:00:00.000Z",
      },
    });
    expect(rescheduled.statusCode).toBe(200);
    expect(rescheduled.json().event).toMatchObject({
      startsAt: "2026-05-13T18:00:00.000Z",
      endsAt: "2026-05-13T19:00:00.000Z",
      status: "confirmed",
      sequence: 3,
    });

    expect(repository.recordedAuditEvents.map((event) => event.action)).toEqual([
      "calendar.event.created",
      "calendar.event.updated",
      "calendar.event.cancelled",
      "calendar.event.rescheduled",
    ]);
    expect(JSON.stringify(repository.recordedAuditEvents)).not.toContain(
      "Synthetic event body should not enter audit metadata.",
    );
  });

  it("preserves attendee and reminder children across lifecycle updates", async () => {
    const repository = new AuditRecordingRepository();
    const server = testServer(user("licensee", ["matter-001"]), repository);

    const reminder = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-002/reminders",
      payload: {
        matterId: "matter-001",
        remindAt: "2026-05-07T17:30:00.000Z",
      },
    });
    expect(reminder.statusCode).toBe(201);
    const reminderId = reminder.json().reminder.id;

    const updated = await server.inject({
      method: "PATCH",
      url: "/api/calendar/events/calendar-event-002",
      payload: {
        matterId: "matter-001",
        title: "Updated client preparation call",
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().event).toMatchObject({
      attendees: [{ id: "calendar-attendee-001", email: "ada.morgan@example.test" }],
      reminders: [{ id: reminderId, status: "pending" }],
    });

    const cancelled = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-002/cancel",
      payload: { matterId: "matter-001" },
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().event).toMatchObject({
      attendees: [{ id: "calendar-attendee-001", email: "ada.morgan@example.test" }],
      reminders: [{ id: reminderId, status: "pending" }],
    });

    const rescheduled = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-002/reschedule",
      payload: {
        matterId: "matter-001",
        startsAt: "2026-05-08T18:00:00.000Z",
        endsAt: "2026-05-08T18:45:00.000Z",
      },
    });
    expect(rescheduled.statusCode).toBe(200);
    expect(rescheduled.json().event).toMatchObject({
      status: "confirmed",
      attendees: [{ id: "calendar-attendee-001", email: "ada.morgan@example.test" }],
      reminders: [{ id: reminderId, status: "pending" }],
    });
  });

  it("rejects cross-matter and invalid calendar event lifecycle writes", async () => {
    const server = testServer(user("licensee", ["matter-001"]));

    const crossMatter = await server.inject({
      method: "POST",
      url: "/api/calendar/events",
      payload: {
        matterId: "matter-002",
        title: "Cross matter event",
        startsAt: "2026-05-12T16:00:00.000Z",
        endsAt: "2026-05-12T17:00:00.000Z",
      },
    });
    expect(crossMatter.statusCode).toBe(403);

    const invalidRange = await server.inject({
      method: "PATCH",
      url: "/api/calendar/events/calendar-event-001",
      payload: {
        matterId: "matter-001",
        startsAt: "2026-05-12T18:00:00.000Z",
        endsAt: "2026-05-12T17:00:00.000Z",
      },
    });
    expect(invalidRange.statusCode).toBe(400);
    expect(invalidRange.json()).toMatchObject({ code: "INVALID_CALENDAR_EVENT_RANGE" });
  });

  it("creates, updates, and deletes manual reminder-state records without delivery side effects", async () => {
    const repository = new AuditRecordingRepository();
    const server = testServer(user("licensee", ["matter-001"]), repository);

    const created = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-001/reminders",
      payload: {
        matterId: "matter-001",
        remindAt: "2026-05-05T15:45:00.000Z",
        status: "pending",
        note: "Synthetic reminder note should stay out of audit metadata.",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().reminder).toMatchObject({
      eventId: "calendar-event-001",
      channel: "dashboard",
      status: "pending",
      note: "Synthetic reminder note should stay out of audit metadata.",
    });
    const reminderId = created.json().reminder.id;

    const updated = await server.inject({
      method: "PATCH",
      url: `/api/calendar/events/calendar-event-001/reminders/${reminderId}`,
      payload: {
        matterId: "matter-001",
        status: "acknowledged",
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().reminder).toMatchObject({ status: "acknowledged" });

    const listed = await server.inject({
      method: "GET",
      url: "/api/calendar/events?matterId=matter-001",
    });
    expect(
      listed.json().events.find((event: { id: string }) => event.id === "calendar-event-001"),
    ).toMatchObject({
      reminders: [{ id: reminderId, status: "acknowledged" }],
    });

    const deleted = await server.inject({
      method: "DELETE",
      url: `/api/calendar/events/calendar-event-001/reminders/${reminderId}?matterId=matter-001`,
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().reminder.deletedAt).toEqual(expect.any(String));
    expect(repository.recordedAuditEvents.map((event) => event.action)).toEqual([
      "calendar.reminder.created",
      "calendar.reminder.updated",
      "calendar.reminder.deleted",
    ]);
    expect(JSON.stringify(repository.recordedAuditEvents)).not.toContain(
      "Synthetic reminder note should stay out of audit metadata.",
    );
    expect(await repository.listJobLifecycleRecords("firm-west-legal", {})).toEqual([]);
    expect(JSON.stringify(repository.recordedAuditEvents)).not.toContain("email");
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

  it("stores blank, external, and hosted meeting links inside matter scope", async () => {
    const repository = new AuditRecordingRepository();
    const server = testServer(user("licensee", ["matter-001"]), repository, undefined, {
      providerKey: "open-practice-webrtc",
      hostedMeetingBaseUrl: "https://meet.example.test/rooms",
    });

    const external = await server.inject({
      method: "PATCH",
      url: "/api/calendar/events/calendar-event-002/meeting-link",
      payload: {
        matterId: "matter-001",
        mode: "external_url",
        url: "https://video.example.test/client-prep",
      },
    });
    expect(external.statusCode).toBe(200);
    expect(external.json().event).toMatchObject({
      id: "calendar-event-002",
      meetingLinkMode: "external_url",
      meetingLinkUrl: "https://video.example.test/client-prep",
    });

    const hosted = await server.inject({
      method: "PATCH",
      url: "/api/calendar/events/calendar-event-002/meeting-link",
      payload: { matterId: "matter-001", mode: "hosted_webrtc" },
    });
    expect(hosted.statusCode).toBe(200);
    expect(hosted.json().event).toMatchObject({
      meetingLinkMode: "hosted_webrtc",
      meetingLinkUrl: expect.stringMatching(
        /^https:\/\/meet\.example\.test\/rooms\/calendar-room-/,
      ),
      meetingRoomId: expect.stringMatching(/^calendar-room-/),
      meetingProviderKey: "open-practice-webrtc",
    });
    const hostedRoomId = hosted.json().event.meetingRoomId;

    const hostedReplay = await server.inject({
      method: "PATCH",
      url: "/api/calendar/events/calendar-event-002/meeting-link",
      payload: { matterId: "matter-001", mode: "hosted_webrtc" },
    });
    expect(hostedReplay.statusCode).toBe(200);
    expect(hostedReplay.json().event).toMatchObject({
      meetingLinkMode: "hosted_webrtc",
      meetingRoomId: hostedRoomId,
      meetingLinkUrl: `https://meet.example.test/rooms/${hostedRoomId}`,
      meetingProviderKey: "open-practice-webrtc",
    });

    const blank = await server.inject({
      method: "PATCH",
      url: "/api/calendar/events/calendar-event-002/meeting-link",
      payload: { matterId: "matter-001", mode: "blank" },
    });
    expect(blank.statusCode).toBe(200);
    const blankEvent = blank.json().event;
    expect(blankEvent).toMatchObject({
      meetingLinkMode: "blank",
    });
    expect(blankEvent).not.toHaveProperty("meetingLinkUrl");
    expect(blankEvent).not.toHaveProperty("meetingRoomId");
    expect(blankEvent).not.toHaveProperty("meetingProviderKey");
    expect(repository.recordedAuditEvents.map((event) => event.action)).toEqual([
      "calendar.event.updated",
      "calendar.event.updated",
      "calendar.event.updated",
      "calendar.event.updated",
    ]);
    expect(JSON.stringify(repository.recordedAuditEvents)).not.toContain("video.example.test");
    expect(JSON.stringify(repository.recordedAuditEvents)).not.toContain("meet.example.test");
  });

  it("reports configured hosted meeting and guest-access boundaries without issuing room sessions", async () => {
    const repository = new AuditRecordingRepository();
    const server = testServer(user("licensee", ["matter-001"]), repository, undefined, {
      providerKey: "open-practice-webrtc",
      hostedMeetingBaseUrl: "https://meet.example.test/rooms",
      guestAccessTokenSigningConfigured: true,
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/calendar/events?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().events[0].meetingInvitationBoundary).toEqual({
      meetingLinks: { status: "configured", provider: "open-practice-webrtc" },
      guestAccess: { status: "configured", provider: "open-practice-webrtc" },
      invitationEmail: { status: "disabled", reason: "smtp_not_configured" },
    });
    expect(JSON.stringify(response.json())).not.toContain("token");
  });

  it("manages hosted guest sessions with one-time tokens and status-only public check-in", async () => {
    const repository = new AuditRecordingRepository();
    const server = testServer(user("licensee", ["matter-001"]), repository, undefined, {
      providerKey: "open-practice-webrtc",
      hostedMeetingBaseUrl: "https://meet.example.test/rooms",
      guestAccessTokenSigningConfigured: true,
    });

    const hosted = await server.inject({
      method: "PATCH",
      url: "/api/calendar/events/calendar-event-002/meeting-link",
      payload: { matterId: "matter-001", mode: "hosted_webrtc" },
    });
    expect(hosted.statusCode).toBe(200);

    const created = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-002/guest-sessions",
      payload: { matterId: "matter-001" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().session).toMatchObject({
      eventId: "calendar-event-002",
      status: "created",
      issuedCount: 0,
    });
    const sessionId = created.json().session.id;

    const opened = await server.inject({
      method: "POST",
      url: `/api/calendar/events/calendar-event-002/guest-sessions/${sessionId}/open`,
      payload: { matterId: "matter-001" },
    });
    expect(opened.statusCode).toBe(200);
    expect(opened.json().session).toMatchObject({ status: "open" });

    const issued = await server.inject({
      method: "POST",
      url: `/api/calendar/events/calendar-event-002/guest-sessions/${sessionId}/guest-links`,
      payload: { matterId: "matter-001" },
    });
    expect(issued.statusCode).toBe(201);
    expect(issued.json()).toMatchObject({
      token: expect.any(String),
      portalUrl: expect.stringMatching(/^https:\/\/practice\.example\.test\/guest-sessions\//),
      guest: { status: "issued" },
      session: { issuedCount: 1 },
    });
    expect(JSON.stringify(issued.json())).not.toContain("tokenHash");
    const token = issued.json().token;
    const guestId = issued.json().guest.id;

    const publicStatus = await server.inject({
      method: "GET",
      url: `/api/portal/guest-sessions/${token}`,
    });
    expect(publicStatus.statusCode).toBe(200);
    expect(publicStatus.json()).toMatchObject({
      session: { status: "open", lobbyStatus: "open" },
      guest: { status: "issued" },
      lobby: { waitingCount: 0 },
    });
    expect(JSON.stringify(publicStatus.json())).not.toContain("matter-001");
    expect(JSON.stringify(publicStatus.json())).not.toContain("calendar-event-002");
    expect(JSON.stringify(publicStatus.json())).not.toContain("meet.example.test");
    expect(JSON.stringify(publicStatus.json())).not.toContain("ada.morgan@example.test");

    const checkedIn = await server.inject({
      method: "POST",
      url: `/api/portal/guest-sessions/${token}/check-in`,
      payload: { attendanceConfirmation: { source: "guest_status_page" } },
    });
    expect(checkedIn.statusCode).toBe(200);
    expect(checkedIn.json()).toMatchObject({
      guest: { status: "waiting", checkedInAt: expect.any(String) },
      lobby: { waitingCount: 1 },
    });

    const admitted = await server.inject({
      method: "POST",
      url: `/api/calendar/events/calendar-event-002/guest-sessions/${sessionId}/guests/${guestId}/admit`,
      payload: { matterId: "matter-001" },
    });
    expect(admitted.statusCode).toBe(200);
    expect(admitted.json()).toMatchObject({
      guest: { status: "admitted", admittedAt: expect.any(String) },
      session: { admittedCount: 1 },
    });

    const ended = await server.inject({
      method: "POST",
      url: `/api/calendar/events/calendar-event-002/guest-sessions/${sessionId}/end`,
      payload: { matterId: "matter-001" },
    });
    expect(ended.statusCode).toBe(200);
    expect(ended.json().session).toMatchObject({ status: "ended", revokedCount: 1 });

    const publicEnded = await server.inject({
      method: "GET",
      url: `/api/portal/guest-sessions/${token}`,
    });
    expect(publicEnded.statusCode).toBe(200);
    expect(publicEnded.json()).toMatchObject({
      session: { status: "ended" },
      guest: { status: "revoked" },
    });

    const auditJson = JSON.stringify(repository.recordedAuditEvents);
    expect(repository.recordedAuditEvents.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "calendar.meeting_session.created",
        "calendar.meeting_session.updated",
        "calendar.meeting_session.ended",
        "calendar.guest_link.created",
        "calendar.guest_link.updated",
        "calendar.guest_link.revoked",
      ]),
    );
    expect(auditJson).not.toContain(token);
    expect(auditJson).not.toContain("tokenHash");
    expect(auditJson).not.toContain("meet.example.test");
    await expect(
      repository.listAccessLogs("firm-west-legal", {
        resourceType: "calendar_guest_link",
        resourceId: guestId,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "view" }),
        expect.objectContaining({ action: "submit" }),
      ]),
    );
  });

  it("blocks hosted guest-session controls outside the matter or without hosted guest access", async () => {
    const defaultServer = testServer(user("licensee", ["matter-001"]));
    const notHosted = await defaultServer.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-002/guest-sessions",
      payload: { matterId: "matter-001" },
    });
    expect(notHosted.statusCode).toBe(409);
    expect(notHosted.json()).toMatchObject({ code: "HOSTED_MEETING_LINK_REQUIRED" });

    const crossMatter = await defaultServer.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-003/guest-sessions",
      payload: { matterId: "matter-002" },
    });
    expect(crossMatter.statusCode).toBe(403);
  });

  it("rejects cross-matter, invalid, and unconfigured hosted meeting-link updates", async () => {
    const repository = new AuditRecordingRepository();
    const server = testServer(user("licensee", ["matter-001"]), repository);

    const crossMatter = await server.inject({
      method: "PATCH",
      url: "/api/calendar/events/calendar-event-003/meeting-link",
      payload: { matterId: "matter-002", mode: "blank" },
    });
    expect(crossMatter.statusCode).toBe(403);

    const invalidUrl = await server.inject({
      method: "PATCH",
      url: "/api/calendar/events/calendar-event-002/meeting-link",
      payload: {
        matterId: "matter-001",
        mode: "external_url",
        url: "http://video.example.test/client-prep",
      },
    });
    expect(invalidUrl.statusCode).toBe(400);

    const hosted = await server.inject({
      method: "PATCH",
      url: "/api/calendar/events/calendar-event-002/meeting-link",
      payload: { matterId: "matter-001", mode: "hosted_webrtc" },
    });
    expect(hosted.statusCode).toBe(503);
    expect(hosted.json()).toMatchObject({
      code: "HOSTED_MEETING_NOT_CONFIGURED",
    });
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
      payload: { matterId: "matter-001", deliveryConfirmation: deliveryConfirmation() },
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
      metadata: expect.objectContaining({
        attendeeId: "calendar-attendee-001",
        meetingLinksStatus: "disabled",
        guestAccessStatus: "disabled",
        invitationEmailStatus: "configured",
        requestedMeetingLink: false,
        requestedGuestAccessToken: false,
      }),
    });
    const jobs = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "email",
    });
    expect(jobs).toEqual([
      expect.objectContaining({
        metadata: expect.objectContaining({
          attendeeId: "calendar-attendee-001",
          eventId: "calendar-event-002",
          templateKey: "calendar.invitation",
          recipientCount: 1,
          meetingLinksStatus: "disabled",
          guestAccessStatus: "disabled",
          invitationEmailStatus: "configured",
          requestedMeetingLink: false,
          requestedGuestAccessToken: false,
          relatedResourceType: "calendar_event",
          relatedResourceId: "calendar-event-002",
        }),
      }),
    ]);
    const queuedAudit = repository.recordedAuditEvents.find(
      (event) => event.action === "calendar.invitation.queued",
    );
    expect(queuedAudit?.metadata).toMatchObject({
      matterId: "matter-001",
      attendeeId: "calendar-attendee-001",
      invitationStatus: "queued",
      meetingLinksStatus: "disabled",
      guestAccessStatus: "disabled",
      invitationEmailStatus: "configured",
    });
    expect(JSON.stringify(queuedAudit?.metadata)).not.toContain("Client preparation call");
  });

  it("includes stored meeting links in invitations only when requested", async () => {
    const repository = new AuditRecordingRepository();
    await enableSmtp(repository);
    const emailJobQueue = {
      add: async () => ({ id: "bull-calendar-invitation-001" }),
    };
    const server = testServer(user("licensee", ["matter-001"]), repository, emailJobQueue);

    const link = await server.inject({
      method: "PATCH",
      url: "/api/calendar/events/calendar-event-002/meeting-link",
      payload: {
        matterId: "matter-001",
        mode: "external_url",
        url: "https://video.example.test/client-prep",
      },
    });
    expect(link.statusCode).toBe(200);

    const response = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-002/invitations",
      payload: {
        matterId: "matter-001",
        includeMeetingLink: true,
        deliveryConfirmation: deliveryConfirmation(),
      },
    });

    expect(response.statusCode).toBe(200);
    const email = await repository.getEmailOutbox(
      "firm-west-legal",
      response.json().results[0].attendee.invitationEmailId,
    );
    expect(email?.textBody).toContain("Meeting link: https://video.example.test/client-prep.");
    expect(email?.metadata).toMatchObject({
      requestedMeetingLink: true,
      meetingLinkMode: "external_url",
      meetingLinkIncluded: true,
    });
    expect(JSON.stringify(email?.metadata)).not.toContain("video.example.test");
  });

  it("requires confirmation before calendar invitations update attendee delivery state", async () => {
    const repository = new AuditRecordingRepository();
    await enableSmtp(repository);
    const server = testServer(user("licensee", ["matter-001"]), repository, {
      add: async () => ({ id: "bull-calendar-invitation-001" }),
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-002/invitations",
      payload: { matterId: "matter-001" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "SEND_CONFIRMATION_REQUIRED" });
    expect(
      await repository.listCalendarEventAttendees(
        "firm-west-legal",
        "matter-001",
        "calendar-event-002",
      ),
    ).toMatchObject([{ id: "calendar-attendee-001", invitationStatus: "not_sent" }]);
  });

  it("rejects link invitations without a stored link and guest-token issuance when access is not configured", async () => {
    const repository = new AuditRecordingRepository();
    const server = testServer(user("licensee", ["matter-001"]), repository);

    const meetingLinkResponse = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-002/invitations",
      payload: { matterId: "matter-001", includeMeetingLink: true },
    });
    expect(meetingLinkResponse.statusCode).toBe(400);
    expect(meetingLinkResponse.json()).toMatchObject({
      code: "MEETING_LINK_NOT_AVAILABLE",
      message: "A meeting link is not set for this event",
    });

    const guestTokenResponse = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-002/invitations",
      payload: { matterId: "matter-001", issueGuestAccessToken: true },
    });
    expect(guestTokenResponse.statusCode).toBe(503);
    expect(guestTokenResponse.json()).toMatchObject({
      code: "MEETING_GUEST_ACCESS_NOT_CONFIGURED",
      message: "Meeting guest access tokens are not configured",
    });
    expect(
      await repository.listCalendarEventAttendees(
        "firm-west-legal",
        "matter-001",
        "calendar-event-002",
      ),
    ).toMatchObject([{ id: "calendar-attendee-001", invitationStatus: "not_sent" }]);
  });

  it("marks invitations skipped when email delivery is not configured", async () => {
    const repository = new AuditRecordingRepository();
    const server = testServer(user("licensee", ["matter-001"]), repository);

    const response = await server.inject({
      method: "POST",
      url: "/api/calendar/events/calendar-event-002/invitations",
      payload: { matterId: "matter-001", deliveryConfirmation: deliveryConfirmation() },
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
