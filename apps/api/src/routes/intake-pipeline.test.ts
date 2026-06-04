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
    await repository.createIntakeSession({
      id: "intake-session-pipeline-submitted",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      templateId: "intake-template-001",
      provider: "embedded",
      externalId: "embedded:intake-session-pipeline-submitted",
      status: "created",
      clientContactId: "contact-ada",
      interviewUrl: "https://intake.example.test/submitted-interview",
      evidence: { source: "referral_partner" },
      createdAt: "2026-05-28T08:00:00.000Z",
      updatedAt: "2026-05-28T08:10:00.000Z",
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
    await repository.createIntakeFormLink({
      id: "intake-form-link-pipeline-submitted",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      intakeSessionId: "intake-session-pipeline-submitted",
      tokenHash: "pipeline-submitted-raw-token-hash",
      requestedByUserId: "user-admin",
      clientContactId: "contact-ada",
      answerSnapshotId: "answer-snapshot-pipeline-submitted",
      expiresAt: "2026-06-28T08:00:00.000Z",
      submittedAt: "2026-05-28T08:30:00.000Z",
      createdAt: "2026-05-28T08:20:00.000Z",
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
    const body = response.json();
    expect(body).toMatchObject({
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
        followUpReview: expect.objectContaining({
          totalItems: expect.any(Number),
          highPriorityCount: expect.any(Number),
          sourceUrlPresentCount: expect.any(Number),
          defaultedSourceCount: expect.any(Number),
          automationBoundary: {
            automaticMatterCreation: false,
            campaignAutomation: false,
            smsDelivery: false,
            bulkDelivery: false,
            adSpendIngestion: false,
            automaticClientContact: false,
          },
        }),
      },
    });
    expect(body.summary.followUpReview.byAction.review_conflict).toBeGreaterThanOrEqual(1);
    expect(body.summary.followUpReview.byAction.review_submitted_intake).toBeGreaterThanOrEqual(1);
    expect(body.summary.followUpReview.byAction.confirm_conversion).toBeGreaterThanOrEqual(1);
    expect(body.leads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "public-consultation:public-intake-pipeline",
          leadStatus: "conflict_review",
          sourceAttribution: expect.objectContaining({
            label: "public_consultation_form",
            labelOrigin: "metadata",
            sourceUrlPresent: true,
          }),
          conflictReview: { posture: "needs_review", opposingPartyCount: 1 },
          followUpReview: expect.objectContaining({
            action: "review_conflict",
            posture: "staff_review",
            priority: "high",
            sourceQuality: "tracked",
            auditSafe: true,
          }),
          conversionCount: 0,
        }),
        expect.objectContaining({
          id: "public-consultation:public-intake-pipeline-converted",
          leadStatus: "converted",
          convertedMatterId: "matter-001",
          followUpReview: expect.objectContaining({
            action: "confirm_conversion",
            posture: "converted",
            priority: "low",
          }),
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
        expect.objectContaining({
          id: "intake-session:intake-session-pipeline-submitted",
          leadStatus: "qualified",
          sourceAttribution: expect.objectContaining({
            label: "referral_partner",
            labelOrigin: "metadata",
            sourceUrlPresent: true,
          }),
          followUpReview: expect.objectContaining({
            action: "review_submitted_intake",
            posture: "staff_review",
            priority: "high",
            reason: "Submitted intake ready for staff review",
            sourceQuality: "tracked",
          }),
          requestLinks: expect.arrayContaining([
            expect.objectContaining({
              kind: "intake_form",
              id: "intake-form-link-pipeline-submitted",
            }),
          ]),
        }),
      ]),
    );
    expect(response.body).not.toContain("pipeline-client@example.test");
    expect(response.body).not.toContain("Synthetic confidential website request body");
    expect(response.body).not.toContain("https://consult.example.test/#public-intake");
    expect(response.body).not.toContain("https://intake.example.test/interview");
    expect(response.body).not.toContain("https://intake.example.test/submitted-interview");
    expect(response.body).not.toContain("pipeline-raw-token-hash");
    expect(response.body).not.toContain("pipeline-submitted-raw-token-hash");
    expect(response.body).not.toContain("Synthetic private appointment title");
    expect(response.body).not.toContain('automaticMatterCreation":true');
    expect(response.body).not.toContain('campaignAutomation":true');
    expect(response.body).not.toContain('smsDelivery":true');
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
