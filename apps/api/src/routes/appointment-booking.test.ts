import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryOpenPracticeRepository, type AuthSessionRecord } from "@open-practice/database";
import type { AuditEvent, NewAuditEvent, ProfessionalRole, User } from "@open-practice/domain";
import { hashToken } from "../http/auth-helpers.js";
import { registerAppointmentBookingRoutes } from "./appointment-booking.js";

const jwtSecret = "appointment-booking-test-secret-at-least-32-characters";
const websiteToken = "website-submission-token";
const allowedOrigin = "https://booking.example.test";
const servers: FastifyInstance[] = [];

class AuditRecordingRepository extends InMemoryOpenPracticeRepository {
  readonly recordedAuditEvents: AuditEvent[] = [];

  override async appendAuditEvent(event: NewAuditEvent): Promise<AuditEvent> {
    const appended = await super.appendAuditEvent(event);
    this.recordedAuditEvents.push(appended);
    return appended;
  }
}

function user(role: ProfessionalRole = "owner_admin"): User {
  return {
    id: "user-admin",
    firmId: "firm-west-legal",
    displayName: "Synthetic Admin",
    email: "admin@example.test",
    role,
    assignedMatterIds: ["matter-001"],
    mfaEnabled: true,
  };
}

function freshSession(authUser: User): AuthSessionRecord {
  const now = new Date().toISOString();
  return {
    id: `session-${authUser.id}`,
    firmId: authUser.firmId,
    userId: authUser.id,
    tokenHash: "synthetic-fresh-session-hash",
    createdAt: now,
    freshAuthenticatedAt: now,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

async function testServer(authUser = user()) {
  const repository = new AuditRecordingRepository();
  await repository.upsertProviderSetting({
    id: "provider-public-intake-test",
    firmId: "firm-west-legal",
    kind: "public_intake",
    key: "consultation",
    enabled: true,
    encryptedConfig: JSON.stringify({
      enabled: true,
      senderAddress: "intake@example.test",
      recipientEmails: ["staff@example.test"],
      allowedOrigins: [allowedOrigin],
      submissionTokenHash: hashToken(websiteToken, jwtSecret),
      reviewOwnerUserId: "user-admin",
    }),
    createdAt: "2026-06-26T12:00:00.000Z",
    updatedAt: "2026-06-26T12:00:00.000Z",
  });

  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = {
      firmId: authUser.firmId,
      user: authUser,
      session: freshSession(authUser),
    };
  });
  registerAppointmentBookingRoutes(server, {
    repository,
    jwtSecret,
    publicFirmId: "firm-west-legal",
    publicActorUserId: "user-admin",
    publicWebBaseUrl: "https://practice.example.test",
  });
  servers.push(server);
  return { server, repository };
}

function profilePayload() {
  return {
    label: "Consultation",
    publicLabel: "Initial consultation",
    timezone: "America/Vancouver",
    durationMinutes: 30,
    slotIntervalMinutes: 30,
    minLeadMinutes: 0,
    maxLeadDays: 30,
    status: "active",
    weeklyWindows: [{ weekday: 1, startTime: "09:00", endTime: "10:00" }],
  };
}

async function createProfile(server: FastifyInstance): Promise<string> {
  const response = await server.inject({
    method: "POST",
    url: "/api/appointment-booking/profiles",
    payload: profilePayload(),
  });
  expect(response.statusCode).toBe(201);
  return response.json().profile.id as string;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-26T12:00:00.000Z"));
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("appointment booking routes", () => {
  it("lets staff create profiles and one-time direct links without exposing token hashes", async () => {
    const { server } = await testServer();
    const profileId = await createProfile(server);

    const linkResponse = await server.inject({
      method: "POST",
      url: `/api/appointment-booking/profiles/${encodeURIComponent(profileId)}/links`,
      payload: { matterId: "matter-001" },
    });

    expect(linkResponse.statusCode).toBe(201);
    const body = linkResponse.json();
    expect(body.link).toMatchObject({ profileId, matterId: "matter-001", status: "active" });
    expect(body.token).toEqual(expect.any(String));
    expect(body.url).toContain("/appointment-booking#");
    expect(JSON.stringify(body)).not.toContain("tokenHash");
  });

  it("guards website slot and booking APIs by origin and bearer token", async () => {
    const { server, repository } = await testServer();
    const profileId = await createProfile(server);

    const denied = await server.inject({
      method: "GET",
      url: `/api/public/appointment-booking/${encodeURIComponent(profileId)}/slots`,
      headers: { origin: allowedOrigin },
    });
    expect(denied.statusCode).toBe(403);

    const slotsResponse = await server.inject({
      method: "GET",
      url: `/api/public/appointment-booking/${encodeURIComponent(profileId)}/slots`,
      headers: {
        origin: allowedOrigin,
        authorization: `Bearer ${websiteToken}`,
      },
    });
    expect(slotsResponse.statusCode).toBe(200);
    expect(slotsResponse.json().slots).toContainEqual({
      startsAt: "2026-06-29T16:00:00.000Z",
      endsAt: "2026-06-29T16:30:00.000Z",
    });

    const bookingResponse = await server.inject({
      method: "POST",
      url: `/api/public/appointment-booking/${encodeURIComponent(profileId)}/bookings`,
      headers: {
        origin: allowedOrigin,
        authorization: `Bearer ${websiteToken}`,
      },
      payload: {
        startsAt: "2026-06-29T16:00:00.000Z",
        requesterName: "Synthetic Public Client",
        requesterEmail: "client@example.test",
        disclosureAccepted: true,
        opposingPartyNames: ["Synthetic Opponent"],
      },
    });
    expect(bookingResponse.statusCode).toBe(201);
    expect(bookingResponse.json()).toMatchObject({
      booking: {
        status: "tentative_hold",
        requestedStartsAt: "2026-06-29T16:00:00.000Z",
        profile: { publicLabel: "Initial consultation" },
      },
    });
    expect(JSON.stringify(bookingResponse.json())).not.toContain("calendar-event");
    expect(JSON.stringify(bookingResponse.json())).not.toContain("client@example.test");
    expect(JSON.stringify(bookingResponse.json())).not.toContain("reviewAging");
    await expect(
      repository.listAppointmentBookingRequests("firm-west-legal"),
    ).resolves.toHaveLength(1);
  });

  it("supports direct link header/path booking and rejects single-use replay", async () => {
    const { server } = await testServer();
    const profileId = await createProfile(server);
    const linkResponse = await server.inject({
      method: "POST",
      url: `/api/appointment-booking/profiles/${encodeURIComponent(profileId)}/links`,
      payload: { matterId: "matter-001" },
    });
    const token = linkResponse.json().token as string;

    const headerLoad = await server.inject({
      method: "GET",
      url: "/api/portal/appointment-bookings",
      headers: { "x-open-practice-public-token": token },
    });
    expect(headerLoad.statusCode).toBe(200);
    expect(headerLoad.json().slots).toContainEqual({
      startsAt: "2026-06-29T16:00:00.000Z",
      endsAt: "2026-06-29T16:30:00.000Z",
    });

    const pathBook = await server.inject({
      method: "POST",
      url: `/api/portal/appointment-bookings/${encodeURIComponent(token)}/book`,
      payload: {
        startsAt: "2026-06-29T16:00:00.000Z",
        requesterName: "Synthetic Known Client",
        requesterEmail: "known@example.test",
      },
    });
    expect(pathBook.statusCode).toBe(201);
    expect(pathBook.json()).toMatchObject({
      booking: { status: "tentative_hold", requestedStartsAt: "2026-06-29T16:00:00.000Z" },
    });
    expect(JSON.stringify(pathBook.json())).not.toContain("matter-001");
    expect(JSON.stringify(pathBook.json())).not.toContain("known@example.test");

    const replay = await server.inject({
      method: "POST",
      url: "/api/portal/appointment-bookings/book",
      headers: { "x-open-practice-public-token": token },
      payload: {
        startsAt: "2026-06-29T16:30:00.000Z",
        requesterName: "Synthetic Known Client",
        requesterEmail: "known@example.test",
      },
    });
    expect(replay.statusCode).toBe(409);
  });

  it("confirms tentative holds through staff review", async () => {
    const { server } = await testServer();
    const profileId = await createProfile(server);
    const linkResponse = await server.inject({
      method: "POST",
      url: `/api/appointment-booking/profiles/${encodeURIComponent(profileId)}/links`,
      payload: { matterId: "matter-001" },
    });
    const token = linkResponse.json().token as string;
    const booked = await server.inject({
      method: "POST",
      url: "/api/portal/appointment-bookings/book",
      headers: { "x-open-practice-public-token": token },
      payload: {
        startsAt: "2026-06-29T16:00:00.000Z",
        requesterName: "Synthetic Known Client",
        requesterEmail: "known@example.test",
      },
    });
    expect(booked.statusCode).toBe(201);
    const requestList = await server.inject({
      method: "GET",
      url: "/api/appointment-booking/requests",
    });
    const requestId = requestList.json().requests[0].id as string;
    expect(requestList.json().requests[0]).toMatchObject({
      id: requestId,
      status: "tentative_hold",
      reviewAging: {
        status: "fresh",
        ageHours: 0,
        referenceAt: "2026-06-26T12:00:00.000Z",
        agingAfterHours: 24,
        staleAfterHours: 72,
        automaticFinalConfirmation: false,
        autoExpires: false,
      },
    });

    vi.setSystemTime(new Date("2026-06-29T12:00:00.000Z"));
    const staleRequestList = await server.inject({
      method: "GET",
      url: "/api/appointment-booking/requests",
    });
    expect(staleRequestList.json().requests[0]).toMatchObject({
      id: requestId,
      status: "tentative_hold",
      reviewAging: {
        status: "stale",
        ageHours: 72,
        referenceAt: "2026-06-26T12:00:00.000Z",
        agingAfterHours: 24,
        staleAfterHours: 72,
        automaticFinalConfirmation: false,
        autoExpires: false,
      },
    });

    const reviewed = await server.inject({
      method: "PATCH",
      url: `/api/appointment-booking/requests/${encodeURIComponent(requestId)}/review`,
      payload: { status: "confirmed" },
    });
    expect(reviewed.statusCode).toBe(200);
    expect(reviewed.json()).toMatchObject({
      request: { id: requestId, status: "confirmed" },
    });
    expect(reviewed.json().request).not.toHaveProperty("reviewAging");
  });

  it("records stale hold aging review decisions without changing lifecycle or public responses", async () => {
    const { server, repository } = await testServer();
    const profileId = await createProfile(server);
    const linkResponse = await server.inject({
      method: "POST",
      url: `/api/appointment-booking/profiles/${encodeURIComponent(profileId)}/links`,
      payload: { matterId: "matter-001" },
    });
    const token = linkResponse.json().token as string;
    const booked = await server.inject({
      method: "POST",
      url: "/api/portal/appointment-bookings/book",
      headers: { "x-open-practice-public-token": token },
      payload: {
        startsAt: "2026-06-29T16:00:00.000Z",
        requesterName: "Synthetic Known Client",
        requesterEmail: "known@example.test",
      },
    });
    expect(booked.statusCode).toBe(201);
    expect(JSON.stringify(booked.json())).not.toContain("reviewAgingDecision");

    const requestList = await server.inject({
      method: "GET",
      url: "/api/appointment-booking/requests",
    });
    const requestId = requestList.json().requests[0].id as string;

    const freshReview = await server.inject({
      method: "PATCH",
      url: `/api/appointment-booking/requests/${encodeURIComponent(requestId)}/aging-review`,
      payload: { decision: "acknowledged" },
    });
    expect(freshReview.statusCode).toBe(409);
    expect(freshReview.json()).toMatchObject({
      code: "APPOINTMENT_BOOKING_AGING_REVIEW_NOT_AGING",
    });

    vi.setSystemTime(new Date("2026-06-29T12:00:00.000Z"));
    const invalidDecision = await server.inject({
      method: "PATCH",
      url: `/api/appointment-booking/requests/${encodeURIComponent(requestId)}/aging-review`,
      payload: { decision: "confirm" },
    });
    expect(invalidDecision.statusCode).toBe(400);

    const reviewed = await server.inject({
      method: "PATCH",
      url: `/api/appointment-booking/requests/${encodeURIComponent(requestId)}/aging-review`,
      payload: { decision: "follow_up_required" },
    });
    expect(reviewed.statusCode).toBe(200);
    expect(reviewed.json().request).toMatchObject({
      id: requestId,
      status: "tentative_hold",
      reviewAging: {
        status: "stale",
        ageHours: 72,
        automaticFinalConfirmation: false,
        autoExpires: false,
      },
      reviewAgingDecision: {
        decision: "follow_up_required",
        decidedByUserId: "user-admin",
        cueStatus: "stale",
        ageHours: 72,
        automaticFinalConfirmation: false,
        autoExpires: false,
        providerSync: false,
        publicRoomCreated: false,
        nativeMediaCreated: false,
        chatCreated: false,
        recordingCreated: false,
        matterCreated: false,
      },
    });

    const stored = await repository.getAppointmentBookingRequest("firm-west-legal", requestId);
    expect(stored).toMatchObject({
      status: "tentative_hold",
      calendarEventId: reviewed.json().request.calendarEventId,
      reviewAgingDecision: "follow_up_required",
      reviewAgingCueStatus: "stale",
      reviewAgingAgeHours: 72,
    });
    const audit = repository.recordedAuditEvents.find(
      (event) => event.action === "appointment_booking.hold.aging_review_recorded",
    );
    expect(audit?.metadata).toMatchObject({
      requestId,
      profileId,
      decision: "follow_up_required",
      cueStatus: "stale",
      ageHours: 72,
      automaticFinalConfirmation: false,
      autoExpires: false,
      providerSync: false,
      publicRoomCreated: false,
      nativeMediaCreated: false,
      chatCreated: false,
      recordingCreated: false,
      matterCreated: false,
    });
    const serializedAudit = JSON.stringify(audit);
    expect(serializedAudit).not.toContain("known@example.test");
    expect(serializedAudit).not.toContain("Synthetic Known Client");
    expect(serializedAudit).not.toContain("2026-06-29T16:00:00.000Z");
    expect(serializedAudit).not.toContain(token);
    expect(serializedAudit).not.toContain("meeting");
  });
});
