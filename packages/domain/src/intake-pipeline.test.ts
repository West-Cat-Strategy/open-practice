import { describe, expect, it } from "vitest";
import { buildIntakePipelineSnapshot } from "./intake-pipeline.js";

describe("intake pipeline projection", () => {
  it("promotes public consultation and intake-session records into safe lead reporting", () => {
    const snapshot = buildIntakePipelineSnapshot({
      publicConsultationIntakes: [
        {
          id: "public-intake-001",
          firmId: "firm-west-legal",
          status: "pending",
          clientName: "Synthetic Public Client",
          telephone: "604-555-0111",
          email: "client@example.test",
          opposingPartyNames: ["Synthetic Opponent"],
          matterDescription: "Synthetic private website request details.",
          sourceUrl: "https://consult.example.test/#intake",
          disclosureAcceptedAt: "2026-05-28T10:00:00.000Z",
          submittedAt: "2026-05-28T10:00:00.000Z",
          metadata: { source: "website_consultation_form" },
        },
        {
          id: "public-intake-converted",
          firmId: "firm-west-legal",
          status: "converted",
          clientName: "Converted Public Client",
          telephone: "",
          opposingPartyNames: [],
          matterDescription: "Converted synthetic private details.",
          disclosureAcceptedAt: "2026-05-27T10:00:00.000Z",
          submittedAt: "2026-05-27T10:00:00.000Z",
          reviewedAt: "2026-05-27T11:00:00.000Z",
          reviewedByUserId: "user-admin",
          convertedMatterId: "matter-converted",
          metadata: {},
        },
      ],
      intakeSessions: [
        {
          id: "intake-session-001",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          templateId: "intake-template-001",
          provider: "embedded",
          externalId: "embedded:intake-session-001",
          status: "created",
          clientContactId: "contact-ada",
          interviewUrl: "https://intake.example.test/session",
          evidence: { source: "https://intake.example.test/session" },
          createdAt: "2026-05-28T09:00:00.000Z",
          updatedAt: "2026-05-28T09:05:00.000Z",
        },
      ],
      intakeFormLinks: [
        {
          id: "intake-form-link-001",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          intakeSessionId: "intake-session-001",
          tokenHash: "raw-token-hash",
          requestedByUserId: "user-admin",
          clientContactId: "contact-ada",
          answerSnapshotId: "answer-snapshot-001",
          expiresAt: "2026-06-28T09:00:00.000Z",
          submittedAt: "2026-05-28T09:30:00.000Z",
          createdAt: "2026-05-28T09:10:00.000Z",
        },
      ],
      intakeFormReviews: [
        {
          id: "intake-form-review-001",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          intakeSessionId: "intake-session-001",
          formLinkId: "intake-form-link-001",
          answerSnapshotId: "answer-snapshot-001",
          decision: "accepted",
          decidedByUserId: "user-admin",
          decidedAt: "2026-05-28T09:45:00.000Z",
        },
      ],
      calendarEvents: [
        {
          id: "calendar-event-001",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          uid: "calendar-event-001@example.test",
          title: "Synthetic consultation appointment",
          startsAt: "2026-05-29T17:00:00.000Z",
          endsAt: "2026-05-29T17:30:00.000Z",
          status: "confirmed",
          sequence: 0,
          createdAt: "2026-05-28T09:00:00.000Z",
          updatedAt: "2026-05-28T09:00:00.000Z",
          createdByUserId: "user-admin",
          updatedByUserId: "user-admin",
        },
      ],
    });

    expect(snapshot.summary).toMatchObject({
      totalLeads: 3,
      conversionCount: 2,
      byLeadStatus: {
        new: 0,
        contacted: 0,
        conflict_review: 1,
        qualified: 0,
        converted: 2,
        closed: 0,
      },
      bySourceType: {
        public_consultation: 2,
        intake_session: 1,
      },
      conflictReview: {
        not_started: 0,
        needs_review: 1,
        reviewing: 0,
        reviewed: 2,
      },
    });

    const publicLead = snapshot.leads.find(
      (lead) => lead.id === "public-consultation:public-intake-001",
    );
    expect(publicLead).toMatchObject({
      displayName: "Synthetic Public Client",
      leadStatus: "conflict_review",
      sourceAttribution: {
        type: "public_consultation",
        label: "website_consultation_form",
        channel: "website",
        sourceUrlPresent: true,
      },
      conflictReview: { posture: "needs_review", opposingPartyCount: 1 },
      conversionCount: 0,
      auditSafe: true,
    });

    const intakeLead = snapshot.leads.find(
      (lead) => lead.id === "intake-session:intake-session-001",
    );
    expect(intakeLead).toMatchObject({
      matterId: "matter-001",
      displayName: "contact-ada",
      leadStatus: "converted",
      convertedMatterId: "matter-001",
      sourceAttribution: expect.objectContaining({
        label: "intake_embedded",
        sourceUrlPresent: true,
      }),
      requestLinks: expect.arrayContaining([
        expect.objectContaining({ kind: "interview", urlPresent: true }),
        expect.objectContaining({
          kind: "intake_form",
          id: "intake-form-link-001",
          status: "submitted",
        }),
      ]),
      appointmentLinks: [
        {
          eventId: "calendar-event-001",
          matterId: "matter-001",
          startsAt: "2026-05-29T17:00:00.000Z",
          status: "confirmed",
        },
      ],
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("client@example.test");
    expect(serialized).not.toContain("Synthetic private website request details");
    expect(serialized).not.toContain("https://consult.example.test/#intake");
    expect(serialized).not.toContain("https://intake.example.test/session");
    expect(serialized).not.toContain("raw-token-hash");
    expect(serialized).not.toContain("Synthetic consultation appointment");
  });
});
