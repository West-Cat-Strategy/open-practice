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
    expect(view(payload, "overdue_tasks_deadlines").results).toEqual([
      expect.objectContaining({
        id: "calendar:calendar-event-001",
        matterId: "matter-001",
      }),
    ]);
    expect(JSON.stringify(payload)).not.toContain("token-hash-not-returned");
    expect(JSON.stringify(payload)).not.toContain("Ada Morgan");
    expect(JSON.stringify(payload)).not.toContain(sampleMatters[0]!.title);
    expect(JSON.stringify(payload)).not.toContain(sampleSignatureRequests[0]!.title);
    expect(JSON.stringify(payload)).not.toContain(sampleCalendarEvents[0]!.title);
  });
});
