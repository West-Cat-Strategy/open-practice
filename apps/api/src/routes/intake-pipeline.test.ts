import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { createApiServer } from "../server.js";

const jwtSecret = "test-intake-pipeline-secret-at-least-32-chars";
const servers: Array<{ close: () => Promise<void> }> = [];

function testServer(
  input: {
    repository?: InMemoryOpenPracticeRepository;
    devUserId?: string;
  } = {},
) {
  const repository = input.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    jwtSecret,
    devFirmId: "firm-west-legal",
    devUserId: input.devUserId ?? "user-admin",
    publicConsultationIntake: {
      firmId: "firm-west-legal",
      actorUserId: "user-admin",
      allowedOrigins: ["https://consult.example.test"],
    },
    webAuthn: {
      rpName: "Test RP",
      rpID: "localhost",
      origin: "http://localhost:3000",
    },
  });
  servers.push(server);
  return { repository, server };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("intake pipeline routes", () => {
  it("returns staff-owned lead statuses, source reporting, links, and conversion counts", async () => {
    const { repository, server } = testServer();
    await repository.createPublicConsultationIntake({
      id: "public-intake-pipeline",
      firmId: "firm-west-legal",
      status: "pending",
      clientName: "Synthetic Public Pipeline Client",
      telephone: "604-555-0200",
      email: "pipeline-client@example.test",
      opposingPartyNames: ["Synthetic Opponent"],
      matterDescription: "Synthetic confidential website request body.",
      sourceUrl: "https://consult.example.test/#public-intake",
      disclosureAcceptedAt: "2026-05-28T10:00:00.000Z",
      submittedAt: "2026-05-28T10:00:00.000Z",
      metadata: { source: "public_consultation_form" },
    });
    await repository.createPublicConsultationIntake({
      id: "public-intake-pipeline-converted",
      firmId: "firm-west-legal",
      status: "converted",
      clientName: "Converted Pipeline Client",
      telephone: "",
      opposingPartyNames: [],
      matterDescription: "Synthetic converted website body.",
      disclosureAcceptedAt: "2026-05-27T10:00:00.000Z",
      submittedAt: "2026-05-27T10:00:00.000Z",
      reviewedAt: "2026-05-27T11:00:00.000Z",
      reviewedByUserId: "user-admin",
      convertedMatterId: "matter-001",
      metadata: {},
    });
    await repository.createIntakeSession({
      id: "intake-session-pipeline",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      templateId: "intake-template-001",
      provider: "embedded",
      externalId: "embedded:intake-session-pipeline",
      status: "created",
      clientContactId: "contact-ada",
      interviewUrl: "https://intake.example.test/interview",
      evidence: { source: "dashboard" },
      createdAt: "2026-05-28T09:00:00.000Z",
      updatedAt: "2026-05-28T09:10:00.000Z",
    });
    await repository.createIntakeFormLink({
      id: "intake-form-link-pipeline",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      intakeSessionId: "intake-session-pipeline",
      tokenHash: "pipeline-raw-token-hash",
      requestedByUserId: "user-admin",
      clientContactId: "contact-ada",
      answerSnapshotId: "answer-snapshot-pipeline",
      expiresAt: "2026-06-28T09:00:00.000Z",
      submittedAt: "2026-05-28T09:30:00.000Z",
      createdAt: "2026-05-28T09:20:00.000Z",
    });
    await repository.createIntakeFormReview({
      id: "intake-form-review-pipeline",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      intakeSessionId: "intake-session-pipeline",
      formLinkId: "intake-form-link-pipeline",
      answerSnapshotId: "answer-snapshot-pipeline",
      decision: "accepted",
      decidedByUserId: "user-admin",
      decidedAt: "2026-05-28T09:45:00.000Z",
    });
    await repository.upsertCalendarEvent({
      id: "calendar-event-pipeline",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      uid: "calendar-event-pipeline@example.test",
      title: "Synthetic private appointment title",
      startsAt: "2026-05-29T17:00:00.000Z",
      endsAt: "2026-05-29T17:30:00.000Z",
      status: "confirmed",
      sequence: 0,
      createdAt: "2026-05-28T09:00:00.000Z",
      updatedAt: "2026-05-28T09:00:00.000Z",
      createdByUserId: "user-admin",
      updatedByUserId: "user-admin",
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/intake-pipeline",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: {
        totalLeads: expect.any(Number),
        conversionCount: expect.any(Number),
        byLeadStatus: expect.objectContaining({
          conflict_review: expect.any(Number),
          converted: expect.any(Number),
        }),
        bySourceType: expect.objectContaining({
          public_consultation: expect.any(Number),
          intake_session: expect.any(Number),
        }),
        conflictReview: expect.objectContaining({
          needs_review: expect.any(Number),
          reviewed: expect.any(Number),
        }),
      },
    });
    expect(response.json().leads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "public-consultation:public-intake-pipeline",
          leadStatus: "conflict_review",
          sourceAttribution: expect.objectContaining({
            label: "public_consultation_form",
            sourceUrlPresent: true,
          }),
          conflictReview: { posture: "needs_review", opposingPartyCount: 1 },
          conversionCount: 0,
        }),
        expect.objectContaining({
          id: "public-consultation:public-intake-pipeline-converted",
          leadStatus: "converted",
          convertedMatterId: "matter-001",
          conversionCount: 1,
        }),
        expect.objectContaining({
          id: "intake-session:intake-session-pipeline",
          leadStatus: "converted",
          matterId: "matter-001",
          requestLinks: expect.arrayContaining([
            expect.objectContaining({ kind: "intake_form", id: "intake-form-link-pipeline" }),
          ]),
          appointmentLinks: expect.arrayContaining([
            expect.objectContaining({
              eventId: "calendar-event-pipeline",
              matterId: "matter-001",
              startsAt: "2026-05-29T17:00:00.000Z",
              status: "confirmed",
            }),
          ]),
        }),
      ]),
    );
    expect(response.body).not.toContain("pipeline-client@example.test");
    expect(response.body).not.toContain("Synthetic confidential website request body");
    expect(response.body).not.toContain("https://consult.example.test/#public-intake");
    expect(response.body).not.toContain("https://intake.example.test/interview");
    expect(response.body).not.toContain("pipeline-raw-token-hash");
    expect(response.body).not.toContain("Synthetic private appointment title");
  });

  it("rejects client-external reads", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createUser({
      id: "user-client-external",
      firmId: "firm-west-legal",
      displayName: "Synthetic Client",
      email: "client-external@example.test",
      role: "client_external",
      assignedMatterIds: ["matter-001"],
      mfaEnabled: false,
    });
    const { server } = testServer({ repository, devUserId: "user-client-external" });

    const response = await server.inject({
      method: "GET",
      url: "/api/intake-pipeline",
    });

    expect(response.statusCode).toBe(403);
  });
});
