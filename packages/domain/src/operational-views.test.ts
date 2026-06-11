import { describe, expect, it } from "vitest";
import {
  buildBuiltInOperationalViews,
  type BuiltInOperationalViewKey,
} from "./operational-views.js";
import {
  sampleCalendarEvents,
  sampleMatterParties,
  sampleMatters,
  sampleSignatureRequests,
  sampleTaskDeadlines,
} from "./sample-data.js";

const now = "2026-05-10T12:00:00.000Z";

function view(
  payload: ReturnType<typeof buildBuiltInOperationalViews>,
  key: BuiltInOperationalViewKey,
) {
  const found = payload.find((candidate) => candidate.definition.key === key);
  expect(found).toBeDefined();
  return found!;
}

describe("built-in operational views", () => {
  it("returns all built-in definitions even when result sets are empty", () => {
    const payload = buildBuiltInOperationalViews({ matters: [], now });

    expect(payload.map((candidate) => candidate.definition.key)).toEqual([
      "stale_matters",
      "uncontacted_clients",
      "awaiting_signature",
      "external_uploads_expiring",
      "conflicts_pending_review",
      "overdue_tasks_deadlines",
      "portal_access_activity",
      "portal_access_anomalies",
      "portal_links_expiring",
    ]);
    expect(payload.every((candidate) => candidate.resultCount === 0)).toBe(true);
  });

  it("computes static operational results without private token or contact details", () => {
    const payload = buildBuiltInOperationalViews({
      now,
      matters: [
        {
          ...sampleMatters[0]!,
          parties: sampleMatterParties.filter((party) => party.matterId === "matter-001"),
          activity: [
            {
              id: "activity-old",
              firmId: "firm-west-legal",
              matterId: "matter-001",
              occurredAt: "2026-04-01T18:00:00.000Z",
              title: "Matter opened",
              kind: "audit",
              metadata: {},
            },
          ],
        },
        {
          ...sampleMatters[1]!,
          parties: sampleMatterParties.filter((party) => party.matterId === "matter-002"),
          activity: [],
        },
      ],
      signatures: sampleSignatureRequests,
      taskDeadlines: sampleTaskDeadlines,
      shareLinks: [
        {
          id: "share-link-001",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          tokenHash: "share-token-hash-not-returned",
          grantedByUserId: "user-licensee",
          permissions: ["view_documents"],
          expiresAt: "2026-05-11T12:00:00.000Z",
          requireEmailVerification: true,
          createdAt: "2026-05-01T12:00:00.000Z",
        },
      ],
      externalUploadLinks: [
        {
          id: "upload-link-001",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          tokenHash: "token-hash-not-returned",
          requestedByUserId: "user-licensee",
          expiresAt: "2026-05-12T12:00:00.000Z",
          maxUploads: 3,
          usedUploads: 1,
          createdAt: "2026-05-01T12:00:00.000Z",
        },
      ],
      intakeFormLinks: [
        {
          id: "intake-form-link-001",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          intakeSessionId: "intake-session-001",
          tokenHash: "intake-token-hash-not-returned",
          requestedByUserId: "user-licensee",
          clientContactId: "contact-ada",
          expiresAt: "2026-05-15T12:00:00.000Z",
          createdAt: "2026-05-01T12:00:00.000Z",
        },
      ],
      calendarGuestLinks: [
        {
          id: "guest-link-001",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          eventId: "calendar-event-001",
          sessionId: "meeting-session-001",
          tokenHash: "guest-token-hash-not-returned",
          status: "issued",
          expiresAt: "2026-05-16T12:00:00.000Z",
          createdAt: "2026-05-01T12:00:00.000Z",
          updatedAt: "2026-05-01T12:00:00.000Z",
          createdByUserId: "user-licensee",
          updatedByUserId: "user-licensee",
          metadata: { privateRoom: "do-not-return" },
        },
      ],
      accessLogs: [
        {
          id: "access-denied-1",
          firmId: "firm-west-legal",
          shareLinkId: "share-link-001",
          resourceType: "share_link",
          resourceId: "share-link-001",
          action: "view",
          occurredAt: "2026-05-10T10:00:00.000Z",
          ipAddress: "203.0.113.44",
          userAgent: "Private Browser",
          metadata: { outcome: "email_verification_required" },
        },
        {
          id: "access-denied-2",
          firmId: "firm-west-legal",
          shareLinkId: "share-link-001",
          resourceType: "share_link",
          resourceId: "share-link-001",
          action: "view",
          occurredAt: "2026-05-10T10:30:00.000Z",
          ipAddress: "203.0.113.45",
          userAgent: "Another Private Browser",
          metadata: { outcome: "denied", reason: "email_verification_required" },
        },
        {
          id: "access-denied-3",
          firmId: "firm-west-legal",
          shareLinkId: "share-link-001",
          resourceType: "share_link",
          resourceId: "share-link-001",
          action: "view",
          occurredAt: "2026-05-10T11:00:00.000Z",
          metadata: { outcome: "expired" },
        },
        {
          id: "access-granted-latest",
          firmId: "firm-west-legal",
          externalUploadLinkId: "upload-link-001",
          resourceType: "external_upload_link",
          resourceId: "upload-link-001",
          action: "upload",
          occurredAt: "2026-05-10T11:30:00.000Z",
          metadata: { outcome: "granted", status: "active" },
        },
        {
          id: "guest-denied",
          firmId: "firm-west-legal",
          resourceType: "calendar_guest_link",
          resourceId: "guest-link-001",
          action: "submit",
          occurredAt: "2026-05-10T11:15:00.000Z",
          metadata: { outcome: "locked", status: "waiting" },
        },
      ],
      calendarEvents: [
        {
          ...sampleCalendarEvents[0]!,
          startsAt: "2026-05-05T16:00:00.000Z",
          endsAt: "2026-05-05T16:30:00.000Z",
        },
      ],
      contactDossiers: [
        {
          contact: {
            id: "contact-ada",
            firmId: "firm-west-legal",
            kind: "person",
            displayName: "Ada Morgan",
            aliases: [],
            identifiers: [],
          },
          matters: [],
          portal: { activeGrantCount: 0, permissionLabels: [] },
          crmTaxonomy: {
            entityType: "person",
            labels: [],
            relatedMatterSummary: {
              total: 0,
              clientRoleCount: 0,
              adverseRoleCount: 0,
              confidentialRoleCount: 0,
              portalMatterCount: 0,
            },
            relationshipSummary: {
              activeCount: 0,
              reviewNeededCount: 0,
              organizationCount: 0,
              personCount: 0,
            },
          },
          relationships: [],
          conflictCues: [
            {
              matterId: "matter-001",
              severity: "review",
              reason: "Linked to a confidential matter party record",
            },
          ],
          qualityReview: {
            summary: {
              duplicateCandidateCount: 0,
              sensitivePartyCueCount: 1,
              revalidationPromptCount: 0,
            },
            signals: [],
          },
          conflictHistory: [],
        },
      ],
    });

    expect(view(payload, "stale_matters").results).toEqual([
      expect.objectContaining({
        id: "stale:matter-001",
        matterId: "matter-001",
        priority: "high",
      }),
    ]);
    expect(view(payload, "uncontacted_clients").results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "uncontacted:matter-002",
          matterId: "matter-002",
        }),
      ]),
    );
    expect(view(payload, "awaiting_signature").results).toEqual([
      expect.objectContaining({
        id: "signature:sig-001",
        matterId: "matter-001",
      }),
    ]);
    expect(view(payload, "external_uploads_expiring").results).toEqual([
      expect.objectContaining({
        id: "external-upload:upload-link-001",
        metadata: expect.objectContaining({ remainingUploads: 2 }),
      }),
    ]);
    expect(view(payload, "conflicts_pending_review").results).toEqual([
      expect.objectContaining({
        matterId: "matter-001",
        reason: "Linked to a confidential matter party record",
      }),
    ]);
    expect(view(payload, "overdue_tasks_deadlines").results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task:task-deadline-001",
          matterId: "matter-001",
          title: "Review tenant evidence package",
          metadata: expect.objectContaining({ taskPriority: "high" }),
        }),
        expect.objectContaining({
          id: "calendar:calendar-event-001",
          matterId: "matter-001",
        }),
      ]),
    );
    expect(view(payload, "portal_access_activity").results[0]).toEqual(
      expect.objectContaining({
        id: "portal-access:access-granted-latest",
        matterId: "matter-001",
        status: "granted",
        metadata: expect.objectContaining({
          family: "external_upload",
          linkId: "upload-link-001",
        }),
      }),
    );
    expect(view(payload, "portal_access_anomalies").results).toEqual([
      expect.objectContaining({
        matterId: "matter-001",
        status: "denied",
        metadata: expect.objectContaining({
          family: "share",
          linkId: "share-link-001",
          deniedCount: 3,
        }),
      }),
    ]);
    expect(view(payload, "portal_links_expiring").results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "portal-expiring:share:share-link-001",
          metadata: expect.objectContaining({ family: "share" }),
        }),
        expect.objectContaining({
          id: "portal-expiring:external_upload:upload-link-001",
          metadata: expect.objectContaining({ family: "external_upload" }),
        }),
        expect.objectContaining({
          id: "portal-expiring:intake_form:intake-form-link-001",
          metadata: expect.objectContaining({ family: "intake_form" }),
        }),
        expect.objectContaining({
          id: "portal-expiring:guest_session:guest-link-001",
          metadata: expect.objectContaining({ family: "guest_session" }),
        }),
      ]),
    );
    expect(JSON.stringify(payload)).not.toContain("token-hash-not-returned");
    expect(JSON.stringify(payload)).not.toContain("share-token-hash-not-returned");
    expect(JSON.stringify(payload)).not.toContain("intake-token-hash-not-returned");
    expect(JSON.stringify(payload)).not.toContain("guest-token-hash-not-returned");
    expect(JSON.stringify(payload)).not.toContain("203.0.113.44");
    expect(JSON.stringify(payload)).not.toContain("Private Browser");
    expect(JSON.stringify(payload)).not.toContain("do-not-return");
    expect(JSON.stringify(payload)).not.toContain("Ada Morgan");
    expect(JSON.stringify(payload)).not.toContain(sampleMatters[0]!.title);
    expect(JSON.stringify(payload)).not.toContain(sampleSignatureRequests[0]!.title);
    expect(JSON.stringify(payload)).not.toContain(sampleCalendarEvents[0]!.title);
  });
});
