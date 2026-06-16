import { describe, expect, it } from "vitest";
import {
  buildMatterLifecycleTransitionAuditMetadata,
  buildMatterLifecycleTransitionRecord,
  matterLifecycleTargetStatus,
  summarizeMatterLifecycleTransitions,
} from "./matter-lifecycle.js";

const reviewedAt = "2026-06-16T12:00:00.000Z";

describe("matter lifecycle transitions", () => {
  it("maps review transitions to fixed target statuses", () => {
    expect(matterLifecycleTargetStatus("pause")).toBe("paused");
    expect(matterLifecycleTargetStatus("close")).toBe("closed");
    expect(matterLifecycleTargetStatus("archive")).toBe("archived");
    expect(matterLifecycleTargetStatus("reopen")).toBe("open");
  });

  it("builds concise review-only records and summaries", () => {
    const ready = buildMatterLifecycleTransitionRecord({
      id: "matter-lifecycle-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "close",
      currentStatus: "open",
      readiness: "ready",
      reason: "Synthetic final review packet is complete.",
      reviewedByUserId: "user-licensee",
      reviewedAt,
      createdAt: reviewedAt,
    });
    const blocked = buildMatterLifecycleTransitionRecord({
      id: "matter-lifecycle-002",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "archive",
      currentStatus: "open",
      readiness: "blocked",
      reason: "Synthetic archive readiness blocked.",
      blockers: ["Trust balance needs reviewer confirmation."],
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-16T12:05:00.000Z",
      createdAt: "2026-06-16T12:05:00.000Z",
    });

    expect(ready).toMatchObject({ targetStatus: "closed", blockers: [] });
    expect(summarizeMatterLifecycleTransitions([ready, blocked])).toMatchObject({
      total: 2,
      ready: 1,
      blocked: 1,
      reviewOnly: true,
      latestByTransition: {
        close: ready,
        archive: blocked,
      },
    });
    expect(buildMatterLifecycleTransitionAuditMetadata(blocked)).toMatchObject({
      matterId: "matter-001",
      transitionRecordId: "matter-lifecycle-002",
      transition: "archive",
      currentStatus: "open",
      targetStatus: "archived",
      readiness: "blocked",
      blockerCount: 1,
      reasonPresent: true,
      reviewOnly: true,
    });
  });

  it("rejects blocked records without blockers", () => {
    expect(() =>
      buildMatterLifecycleTransitionRecord({
        id: "matter-lifecycle-bad",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        transition: "pause",
        currentStatus: "open",
        readiness: "blocked",
        reason: "Synthetic blocker required.",
        reviewedByUserId: "user-licensee",
        reviewedAt,
        createdAt: reviewedAt,
      }),
    ).toThrow("requires at least one blocker");
  });
});
