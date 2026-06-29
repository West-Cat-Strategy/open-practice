import { describe, expect, it } from "vitest";
import {
  buildMatterLifecycleCommandAuditMetadata,
  buildMatterLifecycleCommandExecution,
  buildMatterLifecycleTransitionAuditMetadata,
  buildMatterLifecycleTransitionRecord,
  matterLifecycleCommandRequiredStatus,
  matterLifecycleCommandRequiredStatuses,
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

  it("maps runtime commands to required and target statuses", () => {
    expect(matterLifecycleCommandRequiredStatus("pause")).toBe("open");
    expect(matterLifecycleCommandRequiredStatuses("pause")).toEqual(["open"]);
    expect(matterLifecycleTargetStatus("pause")).toBe("paused");
    expect(matterLifecycleCommandRequiredStatuses("reopen")).toEqual([
      "paused",
      "closed",
      "archived",
    ]);
    expect(matterLifecycleCommandRequiredStatus("reopen")).toBe("paused");
    expect(matterLifecycleTargetStatus("reopen")).toBe("open");
    expect(matterLifecycleCommandRequiredStatus("close")).toBe("open");
    expect(matterLifecycleCommandRequiredStatuses("close")).toEqual(["open"]);
    expect(matterLifecycleTargetStatus("close")).toBe("closed");
    expect(matterLifecycleCommandRequiredStatus("archive")).toBe("closed");
    expect(matterLifecycleCommandRequiredStatuses("archive")).toEqual(["closed"]);
    expect(matterLifecycleTargetStatus("archive")).toBe("archived");
  });

  it("builds status-only command summaries with safe audit metadata", () => {
    const execution = buildMatterLifecycleCommandExecution({
      command: "pause",
      matterId: "matter-001",
      transitionRecordId: "matter-lifecycle-pause",
      beforeStatus: "open",
      expectedStatus: "open",
      reason: "Synthetic operator confirmed the pause packet.",
      idempotencyKey: "synthetic-pause-command-key",
      executedAt: reviewedAt,
      executedByUserId: "user-licensee",
    });

    expect(execution).toMatchObject({
      command: "pause",
      beforeStatus: "open",
      afterStatus: "paused",
      reviewFirst: true,
      consequences: {
        matterStatusChanged: true,
        closedOnChanged: false,
        portalAccessChanged: false,
        taskChanged: false,
        assignmentChanged: false,
        billingChanged: false,
        trustChanged: false,
        retentionChanged: false,
        cleanupRun: false,
      },
    });
    const metadata = buildMatterLifecycleCommandAuditMetadata(execution, {
      reason: "Synthetic operator confirmed the pause packet.",
      idempotencyKey: "synthetic-pause-command-key",
    });
    expect(metadata).toMatchObject({
      matterId: "matter-001",
      transitionRecordId: "matter-lifecycle-pause",
      lifecycleCommand: "pause",
      beforeStatus: "open",
      expectedStatus: "open",
      afterStatus: "paused",
      reasonPresent: true,
      idempotencyKeyPresent: true,
      closedOnChanged: false,
      billingChanged: false,
      trustChanged: false,
      retentionChanged: false,
      cleanupRun: false,
    });
    expect(JSON.stringify(metadata)).not.toContain("Synthetic operator confirmed");
    expect(JSON.stringify(metadata)).not.toContain("synthetic-pause-command-key");
  });

  it("builds status-only close command summaries", () => {
    const execution = buildMatterLifecycleCommandExecution({
      command: "close",
      matterId: "matter-001",
      transitionRecordId: "matter-lifecycle-close",
      beforeStatus: "open",
      expectedStatus: "open",
      reason: "Synthetic operator confirmed the close packet.",
      idempotencyKey: "synthetic-close-command-key",
      executedAt: reviewedAt,
      executedByUserId: "user-licensee",
    });

    expect(execution).toMatchObject({
      command: "close",
      beforeStatus: "open",
      afterStatus: "closed",
      reviewFirst: true,
      consequences: {
        matterStatusChanged: true,
        closedOnChanged: false,
        portalAccessChanged: false,
        taskChanged: false,
        assignmentChanged: false,
        billingChanged: false,
        trustChanged: false,
        retentionChanged: false,
        cleanupRun: false,
      },
    });
    const metadata = buildMatterLifecycleCommandAuditMetadata(execution, {
      reason: "Synthetic operator confirmed the close packet.",
      idempotencyKey: "synthetic-close-command-key",
    });
    expect(metadata).toMatchObject({
      lifecycleCommand: "close",
      beforeStatus: "open",
      expectedStatus: "open",
      afterStatus: "closed",
      closedOnChanged: false,
      portalAccessChanged: false,
      taskChanged: false,
      assignmentChanged: false,
      billingChanged: false,
      trustChanged: false,
      retentionChanged: false,
      cleanupRun: false,
    });
    expect(JSON.stringify(metadata)).not.toContain("Synthetic operator confirmed");
    expect(JSON.stringify(metadata)).not.toContain("synthetic-close-command-key");
  });

  it("builds status-only archive command summaries", () => {
    const execution = buildMatterLifecycleCommandExecution({
      command: "archive",
      matterId: "matter-001",
      transitionRecordId: "matter-lifecycle-archive",
      beforeStatus: "closed",
      expectedStatus: "closed",
      reason: "Synthetic operator confirmed the archive packet.",
      idempotencyKey: "synthetic-archive-command-key",
      executedAt: reviewedAt,
      executedByUserId: "user-licensee",
    });

    expect(execution).toMatchObject({
      command: "archive",
      beforeStatus: "closed",
      afterStatus: "archived",
      reviewFirst: true,
      consequences: {
        matterStatusChanged: true,
        closedOnChanged: false,
        portalAccessChanged: false,
        taskChanged: false,
        assignmentChanged: false,
        billingChanged: false,
        trustChanged: false,
        retentionChanged: false,
        cleanupRun: false,
      },
    });
    const metadata = buildMatterLifecycleCommandAuditMetadata(execution, {
      reason: "Synthetic operator confirmed the archive packet.",
      idempotencyKey: "synthetic-archive-command-key",
    });
    expect(metadata).toMatchObject({
      lifecycleCommand: "archive",
      beforeStatus: "closed",
      expectedStatus: "closed",
      afterStatus: "archived",
      closedOnChanged: false,
      portalAccessChanged: false,
      taskChanged: false,
      assignmentChanged: false,
      billingChanged: false,
      trustChanged: false,
      retentionChanged: false,
      cleanupRun: false,
    });
    expect(JSON.stringify(metadata)).not.toContain("Synthetic operator confirmed");
    expect(JSON.stringify(metadata)).not.toContain("synthetic-archive-command-key");
  });

  it("rejects close command executions unless the matter is open", () => {
    expect(() =>
      buildMatterLifecycleCommandExecution({
        command: "close",
        matterId: "matter-001",
        transitionRecordId: "matter-lifecycle-close",
        beforeStatus: "paused",
        expectedStatus: "open",
        reason: "Synthetic close packet is ready.",
        idempotencyKey: "synthetic-close-command-key",
        executedAt: reviewedAt,
        executedByUserId: "user-licensee",
      }),
    ).toThrow("requires matter status open");
    expect(() =>
      buildMatterLifecycleCommandExecution({
        command: "close",
        matterId: "matter-001",
        transitionRecordId: "matter-lifecycle-close",
        beforeStatus: "open",
        expectedStatus: "paused",
        reason: "Synthetic close packet is ready.",
        idempotencyKey: "synthetic-close-command-key",
        executedAt: reviewedAt,
        executedByUserId: "user-licensee",
      }),
    ).toThrow("expected status must be open");
  });

  it("rejects archive command executions unless the matter is closed", () => {
    expect(() =>
      buildMatterLifecycleCommandExecution({
        command: "archive",
        matterId: "matter-001",
        transitionRecordId: "matter-lifecycle-archive",
        beforeStatus: "open",
        expectedStatus: "closed",
        reason: "Synthetic archive packet is ready.",
        idempotencyKey: "synthetic-archive-command-key",
        executedAt: reviewedAt,
        executedByUserId: "user-licensee",
      }),
    ).toThrow("requires matter status closed");
    expect(() =>
      buildMatterLifecycleCommandExecution({
        command: "archive",
        matterId: "matter-001",
        transitionRecordId: "matter-lifecycle-archive",
        beforeStatus: "closed",
        expectedStatus: "open",
        reason: "Synthetic archive packet is ready.",
        idempotencyKey: "synthetic-archive-command-key",
        executedAt: reviewedAt,
        executedByUserId: "user-licensee",
      }),
    ).toThrow("expected status must be closed");
  });

  it("builds status-only closed and archived reopen command summaries", () => {
    const closed = buildMatterLifecycleCommandExecution({
      command: "reopen",
      matterId: "matter-001",
      transitionRecordId: "matter-lifecycle-reopen-closed",
      beforeStatus: "closed",
      expectedStatus: "closed",
      reason: "Synthetic operator confirmed closed matter reopen.",
      idempotencyKey: "synthetic-closed-reopen-command-key",
      executedAt: reviewedAt,
      executedByUserId: "user-licensee",
    });
    const archived = buildMatterLifecycleCommandExecution({
      command: "reopen",
      matterId: "matter-001",
      transitionRecordId: "matter-lifecycle-reopen-archived",
      beforeStatus: "archived",
      expectedStatus: "archived",
      reason: "Synthetic operator confirmed archived matter reopen.",
      idempotencyKey: "synthetic-archived-reopen-command-key",
      executedAt: reviewedAt,
      executedByUserId: "user-licensee",
    });

    for (const execution of [closed, archived]) {
      expect(execution).toMatchObject({
        command: "reopen",
        afterStatus: "open",
        reviewFirst: true,
        consequences: {
          matterStatusChanged: true,
          closedOnChanged: false,
          portalAccessChanged: false,
          taskChanged: false,
          assignmentChanged: false,
          billingChanged: false,
          trustChanged: false,
          retentionChanged: false,
          cleanupRun: false,
        },
      });
    }
    expect(
      buildMatterLifecycleCommandAuditMetadata(closed, {
        reason: "Synthetic operator confirmed closed matter reopen.",
        idempotencyKey: "synthetic-closed-reopen-command-key",
      }),
    ).toMatchObject({
      lifecycleCommand: "reopen",
      beforeStatus: "closed",
      expectedStatus: "closed",
      afterStatus: "open",
      retentionChanged: false,
      cleanupRun: false,
    });
    expect(
      JSON.stringify(
        buildMatterLifecycleCommandAuditMetadata(archived, {
          reason: "Synthetic operator confirmed archived matter reopen.",
          idempotencyKey: "synthetic-archived-reopen-command-key",
        }),
      ),
    ).not.toContain("synthetic-archived-reopen-command-key");
  });

  it("rejects unsupported or mismatched reopen command statuses", () => {
    expect(() =>
      buildMatterLifecycleCommandExecution({
        command: "reopen",
        matterId: "matter-001",
        transitionRecordId: "matter-lifecycle-reopen",
        beforeStatus: "open",
        expectedStatus: "open",
        reason: "Synthetic reopen packet is ready.",
        idempotencyKey: "synthetic-reopen-command-key",
        executedAt: reviewedAt,
        executedByUserId: "user-licensee",
      }),
    ).toThrow("expected status must be paused, closed, archived");
    expect(() =>
      buildMatterLifecycleCommandExecution({
        command: "reopen",
        matterId: "matter-001",
        transitionRecordId: "matter-lifecycle-reopen",
        beforeStatus: "archived",
        expectedStatus: "closed",
        reason: "Synthetic reopen packet is ready.",
        idempotencyKey: "synthetic-reopen-command-key",
        executedAt: reviewedAt,
        executedByUserId: "user-licensee",
      }),
    ).toThrow("expected status must match matter status");
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
