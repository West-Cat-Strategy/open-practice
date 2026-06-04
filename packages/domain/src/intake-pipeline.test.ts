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
      followUpReview: {
        totalItems: 3,
        highPriorityCount: 1,
        sourceUrlPresentCount: 2,
        defaultedSourceCount: 1,
        byAction: {
          review_conflict: 1,
          review_public_request: 0,
          review_submitted_intake: 0,
          send_follow_up_form: 0,
          schedule_consultation: 0,
          confirm_conversion: 2,
          none: 0,
        },
        byPosture: {
          staff_review: 1,
          waiting_on_client: 0,
          consultation_scheduled: 0,
          converted: 2,
          closed: 0,
        },
        automationBoundary: {
          automaticMatterCreation: false,
          campaignAutomation: false,
          smsDelivery: false,
          bulkDelivery: false,
          adSpendIngestion: false,
          automaticClientContact: false,
        },
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
        labelOrigin: "metadata",
        channel: "website",
        sourceUrlPresent: true,
      },
      conflictReview: { posture: "needs_review", opposingPartyCount: 1 },
      followUpReview: {
        action: "review_conflict",
        posture: "staff_review",
        priority: "high",
        reason: "Conflict review required before follow-up",
        lastActivityAt: "2026-05-28T10:00:00.000Z",
        sourceQuality: "tracked",
        automationBoundary: {
          automaticMatterCreation: false,
          campaignAutomation: false,
          smsDelivery: false,
          bulkDelivery: false,
          adSpendIngestion: false,
          automaticClientContact: false,
        },
        auditSafe: true,
      },
      conversionCount: 0,
      auditSafe: true,
    });

    const convertedPublicLead = snapshot.leads.find(
      (lead) => lead.id === "public-consultation:public-intake-converted",
    );
    expect(convertedPublicLead).toMatchObject({
      sourceAttribution: {
        label: "public_consultation_form",
        labelOrigin: "default",
        sourceUrlPresent: false,
      },
      followUpReview: {
        action: "confirm_conversion",
        posture: "converted",
        priority: "low",
        sourceQuality: "defaulted",
      },
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
        labelOrigin: "default",
        sourceUrlPresent: true,
      }),
      followUpReview: expect.objectContaining({
        action: "confirm_conversion",
        posture: "converted",
        priority: "low",
        reason: "Accepted intake retained for source attribution review",
        sourceQuality: "tracked",
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
    expect(serialized).not.toContain('automaticMatterCreation":true');
    expect(serialized).not.toContain('campaignAutomation":true');
    expect(serialized).not.toContain('smsDelivery":true');
  });

  it("derives review-first follow-up postures without delivery or conversion side effects", () => {
    const snapshot = buildIntakePipelineSnapshot({
      publicConsultationIntakes: [
        {
          id: "public-intake-ready",
          firmId: "firm-west-legal",
          status: "pending",
          clientName: "Ready Public Client",
          telephone: "",
          opposingPartyNames: [],
          matterDescription: "Ready synthetic public details.",
          sourceUrl: "https://consult.example.test/#ready",
          disclosureAcceptedAt: "2026-05-28T12:00:00.000Z",
          submittedAt: "2026-05-28T12:00:00.000Z",
          metadata: { source: "website_ready_form" },
        },
        {
          id: "public-intake-dismissed",
          firmId: "firm-west-legal",
          status: "dismissed",
          clientName: "Dismissed Public Client",
          telephone: "",
          opposingPartyNames: [],
          matterDescription: "Dismissed synthetic public details.",
          disclosureAcceptedAt: "2026-05-28T11:00:00.000Z",
          submittedAt: "2026-05-28T11:00:00.000Z",
          reviewedAt: "2026-05-28T11:30:00.000Z",
          reviewedByUserId: "user-admin",
          dismissedReason: "Synthetic dismissed reason.",
          metadata: {},
        },
      ],
      intakeSessions: [
        {
          id: "intake-session-waiting",
          firmId: "firm-west-legal",
          matterId: "matter-waiting",
          templateId: "intake-template-001",
          provider: "embedded",
          externalId: "embedded:intake-session-waiting",
          status: "created",
          evidence: { source: "staff_referral" },
          createdAt: "2026-05-28T10:00:00.000Z",
          updatedAt: "2026-05-28T10:10:00.000Z",
        },
        {
          id: "intake-session-more-info",
          firmId: "firm-west-legal",
          matterId: "matter-more-info",
          templateId: "intake-template-001",
          provider: "embedded",
          externalId: "embedded:intake-session-more-info",
          status: "created",
          evidence: {},
          createdAt: "2026-05-28T09:00:00.000Z",
          updatedAt: "2026-05-28T09:10:00.000Z",
        },
        {
          id: "intake-session-rejected",
          firmId: "firm-west-legal",
          matterId: "matter-rejected",
          templateId: "intake-template-001",
          provider: "embedded",
          externalId: "embedded:intake-session-rejected",
          status: "created",
          evidence: { source: "phone_referral" },
          createdAt: "2026-05-28T08:00:00.000Z",
          updatedAt: "2026-05-28T08:10:00.000Z",
        },
        {
          id: "intake-session-appointment",
          firmId: "firm-west-legal",
          matterId: "matter-appointment",
          templateId: "intake-template-001",
          provider: "embedded",
          externalId: "embedded:intake-session-appointment",
          status: "created",
          evidence: {},
          createdAt: "2026-05-28T07:00:00.000Z",
          updatedAt: "2026-05-28T07:10:00.000Z",
        },
        {
          id: "intake-session-manual",
          firmId: "firm-west-legal",
          matterId: "matter-manual",
          templateId: "intake-template-001",
          provider: "embedded",
          externalId: "embedded:intake-session-manual",
          status: "created",
          evidence: {},
          createdAt: "2026-05-28T06:00:00.000Z",
          updatedAt: "2026-05-28T06:10:00.000Z",
        },
      ],
      intakeFormLinks: [
        {
          id: "intake-form-link-waiting",
          firmId: "firm-west-legal",
          matterId: "matter-waiting",
          intakeSessionId: "intake-session-waiting",
          tokenHash: "waiting-token-hash",
          requestedByUserId: "user-admin",
          expiresAt: "2026-06-28T10:00:00.000Z",
          createdAt: "2026-05-28T10:20:00.000Z",
        },
        {
          id: "intake-form-link-more-info",
          firmId: "firm-west-legal",
          matterId: "matter-more-info",
          intakeSessionId: "intake-session-more-info",
          tokenHash: "more-info-token-hash",
          requestedByUserId: "user-admin",
          answerSnapshotId: "answer-snapshot-more-info",
          expiresAt: "2026-06-28T09:00:00.000Z",
          submittedAt: "2026-05-28T09:20:00.000Z",
          createdAt: "2026-05-28T09:15:00.000Z",
        },
        {
          id: "intake-form-link-rejected",
          firmId: "firm-west-legal",
          matterId: "matter-rejected",
          intakeSessionId: "intake-session-rejected",
          tokenHash: "rejected-token-hash",
          requestedByUserId: "user-admin",
          answerSnapshotId: "answer-snapshot-rejected",
          expiresAt: "2026-06-28T08:00:00.000Z",
          submittedAt: "2026-05-28T08:20:00.000Z",
          createdAt: "2026-05-28T08:15:00.000Z",
        },
      ],
      intakeFormReviews: [
        {
          id: "intake-form-review-more-info",
          firmId: "firm-west-legal",
          matterId: "matter-more-info",
          intakeSessionId: "intake-session-more-info",
          formLinkId: "intake-form-link-more-info",
          answerSnapshotId: "answer-snapshot-more-info",
          decision: "request_more_info",
          decidedByUserId: "user-admin",
          decidedAt: "2026-05-28T09:30:00.000Z",
          reason: "Synthetic more information reason.",
        },
        {
          id: "intake-form-review-rejected",
          firmId: "firm-west-legal",
          matterId: "matter-rejected",
          intakeSessionId: "intake-session-rejected",
          formLinkId: "intake-form-link-rejected",
          answerSnapshotId: "answer-snapshot-rejected",
          decision: "rejected",
          decidedByUserId: "user-admin",
          decidedAt: "2026-05-28T08:30:00.000Z",
          reason: "Synthetic rejection reason.",
        },
      ],
      calendarEvents: [
        {
          id: "calendar-event-appointment",
          firmId: "firm-west-legal",
          matterId: "matter-appointment",
          uid: "calendar-event-appointment@example.test",
          title: "Private appointment title",
          startsAt: "2026-05-29T17:00:00.000Z",
          endsAt: "2026-05-29T17:30:00.000Z",
          status: "confirmed",
          sequence: 0,
          createdAt: "2026-05-28T07:00:00.000Z",
          updatedAt: "2026-05-28T07:00:00.000Z",
          createdByUserId: "user-admin",
          updatedByUserId: "user-admin",
        },
      ],
    });

    expect(snapshot.leads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "public-consultation:public-intake-ready",
          followUpReview: expect.objectContaining({
            action: "review_public_request",
            posture: "staff_review",
            priority: "normal",
            sourceQuality: "tracked",
          }),
        }),
        expect.objectContaining({
          id: "public-consultation:public-intake-dismissed",
          followUpReview: expect.objectContaining({
            action: "none",
            posture: "closed",
            sourceQuality: "defaulted",
          }),
        }),
        expect.objectContaining({
          id: "intake-session:intake-session-waiting",
          followUpReview: expect.objectContaining({
            action: "send_follow_up_form",
            posture: "waiting_on_client",
            sourceQuality: "tracked",
          }),
        }),
        expect.objectContaining({
          id: "intake-session:intake-session-more-info",
          followUpReview: expect.objectContaining({
            action: "send_follow_up_form",
            posture: "waiting_on_client",
            lastActivityAt: "2026-05-28T09:30:00.000Z",
          }),
        }),
        expect.objectContaining({
          id: "intake-session:intake-session-rejected",
          followUpReview: expect.objectContaining({
            action: "none",
            posture: "closed",
            lastActivityAt: "2026-05-28T08:30:00.000Z",
          }),
        }),
        expect.objectContaining({
          id: "intake-session:intake-session-appointment",
          followUpReview: expect.objectContaining({
            action: "schedule_consultation",
            posture: "consultation_scheduled",
            priority: "low",
          }),
        }),
        expect.objectContaining({
          id: "intake-session:intake-session-manual",
          followUpReview: expect.objectContaining({
            action: "schedule_consultation",
            posture: "staff_review",
            priority: "normal",
          }),
        }),
      ]),
    );
    expect(snapshot.summary.followUpReview.byAction).toMatchObject({
      review_public_request: 1,
      send_follow_up_form: 2,
      schedule_consultation: 2,
      none: 2,
    });
    expect(snapshot.summary.followUpReview.byPosture).toMatchObject({
      staff_review: 2,
      waiting_on_client: 2,
      consultation_scheduled: 1,
      closed: 2,
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("Ready synthetic public details");
    expect(serialized).not.toContain("Dismissed synthetic public details");
    expect(serialized).not.toContain("Synthetic more information reason");
    expect(serialized).not.toContain("Synthetic rejection reason");
    expect(serialized).not.toContain("https://consult.example.test/#ready");
    expect(serialized).not.toContain("waiting-token-hash");
    expect(serialized).not.toContain("more-info-token-hash");
    expect(serialized).not.toContain("rejected-token-hash");
    expect(serialized).not.toContain("Private appointment title");
    expect(serialized).not.toContain('automaticClientContact":true');
  });
});
