import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

const licensee = {
  id: "user-licensee",
  firmId: "firm-west-legal",
  displayName: "Synthetic Licensee",
  email: "licensee@example.test",
  role: "licensee" as const,
  assignedMatterIds: ["matter-001"],
  mfaEnabled: true,
};

const firmId = "firm-west-legal";
const matterId = "matter-001";

async function lifecycleSideEffectSnapshot(repository: InMemoryOpenPracticeRepository) {
  const [matter] = await repository.listMattersForUser(licensee);
  const overview = await repository.getOverview(firmId);
  const ledger = await repository.getLedger(firmId, { matterId });

  return {
    closedOn: matter?.closedOn,
    portalGrants: (await repository.listPortalGrants(firmId)).filter(
      (grant) => grant.matterId === matterId,
    ),
    portalDocumentAccess: await repository.listPortalDocumentAccess(firmId, { matterId }),
    shareLinks: await repository.listShareLinks(firmId, { matterId }),
    externalUploadLinks: await repository.listExternalUploadLinks(firmId, { matterId }),
    assignedUsers: overview.users
      .map((user) => ({ id: user.id, assignedMatterIds: user.assignedMatterIds }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    tasks: await repository.listTaskDeadlines(firmId, {
      matterId,
      includeCompleted: true,
      includeArchived: true,
    }),
    taskChecklistItems: await repository.listTaskChecklistItems(firmId, {
      matterId,
      includeArchived: true,
    }),
    taskComments: await repository.listTaskComments(firmId, { matterId, includeArchived: true }),
    taskDependencies: await repository.listTaskDependencies(firmId, {
      matterId,
      includeArchived: true,
    }),
    taskTemplates: await repository.listTaskTemplates(firmId, { includeArchived: true }),
    timeEntries: await repository.listTimeEntries(firmId, { matterId }),
    expenseEntries: await repository.listExpenseEntries(firmId, { matterId }),
    invoices: await repository.listInvoices(firmId, { matterId }),
    payments: await repository.listPayments(firmId, { matterId }),
    ledger,
    trustTransferRequests: await repository.listTrustTransferRequests(firmId, { matterId }),
    documents: matter?.documents.map((document) => ({
      id: document.id,
      legalHold: document.legalHold,
      reviewMetadata: document.reviewMetadata,
    })),
    lifecycleTransitions: await repository.listMatterLifecycleTransitions(firmId, matterId),
  };
}

describe("repository matter lifecycle transitions", () => {
  it("stores append-only transition evidence without mutating matter status", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const before = (await repository.listMattersForUser(licensee))[0]!;

    const record = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-close",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "close",
      readiness: "blocked",
      reason: "Synthetic close review is blocked.",
      blockers: ["Synthetic trust review remains open."],
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-16T12:00:00.000Z",
      createdAt: "2026-06-16T12:00:00.000Z",
      auditEventId: "audit-matter-lifecycle-close",
    });

    expect(record).toMatchObject({
      matterId: "matter-001",
      transition: "close",
      currentStatus: before.status,
      targetStatus: "closed",
      readiness: "blocked",
      blockers: ["Synthetic trust review remains open."],
    });
    await expect(
      repository.listMatterLifecycleTransitions("firm-west-legal", "matter-001"),
    ).resolves.toEqual([record]);
    const [after] = await repository.listMattersForUser(licensee);
    expect(after).toMatchObject({
      id: "matter-001",
      status: before.status,
      lifecycleTransitions: [record],
    });
    expect(after.closedOn).toBe(before.closedOn);
    const audit = await repository.listAuditEvents("firm-west-legal");
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "matter.lifecycle_transition_reviewed",
          resourceId: "matter-001",
          metadata: expect.objectContaining({
            transition: "close",
            targetStatus: "closed",
            blockerCount: 1,
            reviewOnly: true,
          }),
        }),
      ]),
    );
    expect(JSON.stringify(audit.events)).not.toContain("Synthetic trust review remains open");
  });

  it("orders transition records by review time and scopes them by matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-pause",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "pause",
      readiness: "ready",
      reason: "Synthetic pause packet is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-16T11:00:00.000Z",
      createdAt: "2026-06-16T11:00:00.000Z",
      auditEventId: "audit-matter-lifecycle-pause",
    });
    await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-reopen",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "reopen",
      readiness: "ready",
      reason: "Synthetic reopen packet is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-16T12:00:00.000Z",
      createdAt: "2026-06-16T12:00:00.000Z",
      auditEventId: "audit-matter-lifecycle-reopen",
    });

    await expect(
      repository.listMatterLifecycleTransitions("firm-west-legal", "matter-001"),
    ).resolves.toMatchObject([{ id: "matter-lifecycle-reopen" }, { id: "matter-lifecycle-pause" }]);
    await expect(
      repository.listMatterLifecycleTransitions("firm-west-legal", "matter-002"),
    ).resolves.toEqual([]);
  });

  it("executes pause, reopen, close, and archive commands from the latest ready transition evidence", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const before = (await repository.listMattersForUser(licensee))[0]!;
    const pauseRecord = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-ready-pause",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "pause",
      readiness: "ready",
      reason: "Synthetic pause packet is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:00:00.000Z",
      createdAt: "2026-06-19T12:00:00.000Z",
      auditEventId: "audit-matter-lifecycle-ready-pause",
    });

    const paused = await repository.executeMatterLifecycleCommand({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      command: "pause",
      expectedStatus: "open",
      transitionRecordId: pauseRecord.id,
      reason: "Synthetic operator confirmed pause execution.",
      idempotencyKey: "synthetic-pause-command-key",
      executedByUserId: "user-licensee",
      executedAt: "2026-06-19T12:05:00.000Z",
      auditEventId: "audit-matter-lifecycle-pause-command",
    });

    expect(paused.matter).toMatchObject({
      id: "matter-001",
      status: "paused",
      trustBalanceCents: before.trustBalanceCents,
    });
    expect(paused.matter.closedOn).toBe(before.closedOn);
    expect(paused.matter.timeEntries).toHaveLength(before.timeEntries.length);
    expect(paused.matter.expenses).toHaveLength(before.expenses.length);
    expect(paused.lifecycleCommand).toMatchObject({
      command: "pause",
      beforeStatus: "open",
      expectedStatus: "open",
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

    const reopenRecord = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-ready-reopen",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "reopen",
      readiness: "ready",
      reason: "Synthetic reopen packet is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:10:00.000Z",
      createdAt: "2026-06-19T12:10:00.000Z",
      auditEventId: "audit-matter-lifecycle-ready-reopen",
    });
    const reopened = await repository.executeMatterLifecycleCommand({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      command: "reopen",
      expectedStatus: "paused",
      transitionRecordId: reopenRecord.id,
      reason: "Synthetic operator confirmed reopen execution.",
      idempotencyKey: "synthetic-reopen-command-key",
      executedByUserId: "user-licensee",
      executedAt: "2026-06-19T12:15:00.000Z",
      auditEventId: "audit-matter-lifecycle-reopen-command",
    });
    expect(reopened.matter).toMatchObject({
      id: "matter-001",
      status: "open",
      trustBalanceCents: before.trustBalanceCents,
    });
    expect(reopened.matter.closedOn).toBe(before.closedOn);

    const closeRecord = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-ready-close",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "close",
      readiness: "ready",
      reason: "Synthetic close packet is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:20:00.000Z",
      createdAt: "2026-06-19T12:20:00.000Z",
      auditEventId: "audit-matter-lifecycle-ready-close",
    });
    const closed = await repository.executeMatterLifecycleCommand({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      command: "close",
      expectedStatus: "open",
      transitionRecordId: closeRecord.id,
      reason: "Synthetic operator confirmed close execution.",
      idempotencyKey: "synthetic-close-command-key",
      executedByUserId: "user-licensee",
      executedAt: "2026-06-19T12:25:00.000Z",
      auditEventId: "audit-matter-lifecycle-close-command",
    });
    expect(closed.matter).toMatchObject({
      id: "matter-001",
      status: "closed",
      trustBalanceCents: before.trustBalanceCents,
    });
    expect(closed.matter.closedOn).toBe(before.closedOn);
    expect(closed.matter.timeEntries).toHaveLength(before.timeEntries.length);
    expect(closed.matter.expenses).toHaveLength(before.expenses.length);
    expect(closed.lifecycleCommand).toMatchObject({
      command: "close",
      beforeStatus: "open",
      expectedStatus: "open",
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

    const closedReopenRecord = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-ready-reopen-closed",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "reopen",
      readiness: "ready",
      reason: "Synthetic closed matter reopen packet is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:30:00.000Z",
      createdAt: "2026-06-19T12:30:00.000Z",
      auditEventId: "audit-matter-lifecycle-ready-reopen-closed",
    });
    const beforeClosedReopenSideEffects = await lifecycleSideEffectSnapshot(repository);
    const reopenedFromClosed = await repository.executeMatterLifecycleCommand({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      command: "reopen",
      expectedStatus: "closed",
      transitionRecordId: closedReopenRecord.id,
      reason: "Synthetic operator confirmed closed matter reopen execution.",
      idempotencyKey: "synthetic-closed-reopen-command-key",
      executedByUserId: "user-licensee",
      executedAt: "2026-06-19T12:35:00.000Z",
      auditEventId: "audit-matter-lifecycle-reopen-closed-command",
    });
    expect(reopenedFromClosed.matter).toMatchObject({
      id: "matter-001",
      status: "open",
      trustBalanceCents: before.trustBalanceCents,
    });
    expect(reopenedFromClosed.lifecycleCommand).toMatchObject({
      command: "reopen",
      beforeStatus: "closed",
      expectedStatus: "closed",
      afterStatus: "open",
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
    await expect(lifecycleSideEffectSnapshot(repository)).resolves.toEqual(
      beforeClosedReopenSideEffects,
    );

    const recloseRecord = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-ready-reclose",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "close",
      readiness: "ready",
      reason: "Synthetic re-close packet is ready for archive proof.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:40:00.000Z",
      createdAt: "2026-06-19T12:40:00.000Z",
      auditEventId: "audit-matter-lifecycle-ready-reclose",
    });
    await repository.executeMatterLifecycleCommand({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      command: "close",
      expectedStatus: "open",
      transitionRecordId: recloseRecord.id,
      reason: "Synthetic operator confirmed re-close execution.",
      idempotencyKey: "synthetic-reclose-command-key",
      executedByUserId: "user-licensee",
      executedAt: "2026-06-19T12:45:00.000Z",
      auditEventId: "audit-matter-lifecycle-reclose-command",
    });

    const archiveRecord = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-ready-archive",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "archive",
      readiness: "ready",
      reason: "Synthetic archive packet is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:50:00.000Z",
      createdAt: "2026-06-19T12:50:00.000Z",
      auditEventId: "audit-matter-lifecycle-ready-archive",
    });
    const archived = await repository.executeMatterLifecycleCommand({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      command: "archive",
      expectedStatus: "closed",
      transitionRecordId: archiveRecord.id,
      reason: "Synthetic operator confirmed archive execution.",
      idempotencyKey: "synthetic-archive-command-key",
      executedByUserId: "user-licensee",
      executedAt: "2026-06-19T12:55:00.000Z",
      auditEventId: "audit-matter-lifecycle-archive-command",
    });
    expect(archived.matter).toMatchObject({
      id: "matter-001",
      status: "archived",
      trustBalanceCents: before.trustBalanceCents,
    });
    expect(archived.matter.closedOn).toBe(before.closedOn);
    expect(archived.matter.timeEntries).toHaveLength(before.timeEntries.length);
    expect(archived.matter.expenses).toHaveLength(before.expenses.length);
    expect(archived.lifecycleCommand).toMatchObject({
      command: "archive",
      beforeStatus: "closed",
      expectedStatus: "closed",
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

    const archivedReopenRecord = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-ready-reopen-archived",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "reopen",
      readiness: "ready",
      reason: "Synthetic archived matter reopen packet is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T13:00:00.000Z",
      createdAt: "2026-06-19T13:00:00.000Z",
      auditEventId: "audit-matter-lifecycle-ready-reopen-archived",
    });
    const beforeArchivedReopenSideEffects = await lifecycleSideEffectSnapshot(repository);
    const reopenedFromArchived = await repository.executeMatterLifecycleCommand({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      command: "reopen",
      expectedStatus: "archived",
      transitionRecordId: archivedReopenRecord.id,
      reason: "Synthetic operator confirmed archived matter reopen execution.",
      idempotencyKey: "synthetic-archived-reopen-command-key",
      executedByUserId: "user-licensee",
      executedAt: "2026-06-19T13:05:00.000Z",
      auditEventId: "audit-matter-lifecycle-reopen-archived-command",
    });
    expect(reopenedFromArchived.matter).toMatchObject({
      id: "matter-001",
      status: "open",
      trustBalanceCents: before.trustBalanceCents,
    });
    expect(reopenedFromArchived.lifecycleCommand).toMatchObject({
      command: "reopen",
      beforeStatus: "archived",
      expectedStatus: "archived",
      afterStatus: "open",
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
    await expect(lifecycleSideEffectSnapshot(repository)).resolves.toEqual(
      beforeArchivedReopenSideEffects,
    );

    const audit = await repository.listAuditEvents("firm-west-legal");
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "matter.lifecycle_command_executed",
          resourceId: "matter-001",
          metadata: expect.objectContaining({
            transitionRecordId: "matter-lifecycle-ready-pause",
            lifecycleCommand: "pause",
            beforeStatus: "open",
            afterStatus: "paused",
            reasonPresent: true,
            idempotencyKeyPresent: true,
            billingChanged: false,
            trustChanged: false,
            retentionChanged: false,
            cleanupRun: false,
          }),
        }),
        expect.objectContaining({
          action: "matter.lifecycle_command_executed",
          resourceId: "matter-001",
          metadata: expect.objectContaining({
            transitionRecordId: "matter-lifecycle-ready-reopen",
            lifecycleCommand: "reopen",
            beforeStatus: "paused",
            afterStatus: "open",
            retentionChanged: false,
            cleanupRun: false,
          }),
        }),
        expect.objectContaining({
          action: "matter.lifecycle_command_executed",
          resourceId: "matter-001",
          metadata: expect.objectContaining({
            transitionRecordId: "matter-lifecycle-ready-reopen-closed",
            lifecycleCommand: "reopen",
            beforeStatus: "closed",
            expectedStatus: "closed",
            afterStatus: "open",
            closedOnChanged: false,
            portalAccessChanged: false,
            taskChanged: false,
            assignmentChanged: false,
            billingChanged: false,
            trustChanged: false,
            retentionChanged: false,
            cleanupRun: false,
          }),
        }),
        expect.objectContaining({
          action: "matter.lifecycle_command_executed",
          resourceId: "matter-001",
          metadata: expect.objectContaining({
            transitionRecordId: "matter-lifecycle-ready-close",
            lifecycleCommand: "close",
            beforeStatus: "open",
            afterStatus: "closed",
            closedOnChanged: false,
            billingChanged: false,
            trustChanged: false,
            retentionChanged: false,
            cleanupRun: false,
          }),
        }),
        expect.objectContaining({
          action: "matter.lifecycle_command_executed",
          resourceId: "matter-001",
          metadata: expect.objectContaining({
            transitionRecordId: "matter-lifecycle-ready-archive",
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
          }),
        }),
        expect.objectContaining({
          action: "matter.lifecycle_command_executed",
          resourceId: "matter-001",
          metadata: expect.objectContaining({
            transitionRecordId: "matter-lifecycle-ready-reopen-archived",
            lifecycleCommand: "reopen",
            beforeStatus: "archived",
            expectedStatus: "archived",
            afterStatus: "open",
            closedOnChanged: false,
            portalAccessChanged: false,
            taskChanged: false,
            assignmentChanged: false,
            billingChanged: false,
            trustChanged: false,
            retentionChanged: false,
            cleanupRun: false,
          }),
        }),
      ]),
    );
    expect(JSON.stringify(audit.events)).not.toContain("Synthetic operator confirmed");
    expect(JSON.stringify(audit.events)).not.toContain("synthetic-pause-command-key");
    expect(JSON.stringify(audit.events)).not.toContain("synthetic-reopen-command-key");
    expect(JSON.stringify(audit.events)).not.toContain("synthetic-close-command-key");
    expect(JSON.stringify(audit.events)).not.toContain("synthetic-closed-reopen-command-key");
    expect(JSON.stringify(audit.events)).not.toContain("synthetic-reclose-command-key");
    expect(JSON.stringify(audit.events)).not.toContain("synthetic-archive-command-key");
    expect(JSON.stringify(audit.events)).not.toContain("synthetic-archived-reopen-command-key");
  });

  it("rejects stale, blocked, or expected-status mismatched lifecycle commands", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const ready = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-stale-pause",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "pause",
      readiness: "ready",
      reason: "Synthetic pause packet was ready earlier.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:00:00.000Z",
      createdAt: "2026-06-19T12:00:00.000Z",
      auditEventId: "audit-matter-lifecycle-stale-pause",
    });
    await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-blocked-pause",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "pause",
      readiness: "blocked",
      reason: "Synthetic pause packet needs one more review.",
      blockers: ["Synthetic review blocker."],
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T12:10:00.000Z",
      createdAt: "2026-06-19T12:10:00.000Z",
      auditEventId: "audit-matter-lifecycle-blocked-pause",
    });

    await expect(
      repository.executeMatterLifecycleCommand({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        command: "pause",
        expectedStatus: "open",
        transitionRecordId: ready.id,
        reason: "Synthetic operator confirmed pause execution.",
        idempotencyKey: "synthetic-stale-pause-command-key",
        executedByUserId: "user-licensee",
        executedAt: "2026-06-19T12:15:00.000Z",
        auditEventId: "audit-matter-lifecycle-stale-pause-command",
      }),
    ).rejects.toMatchObject({ code: "MATTER_LIFECYCLE_READINESS_NOT_READY" });

    await expect(
      repository.executeMatterLifecycleCommand({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        command: "pause",
        expectedStatus: "paused",
        transitionRecordId: ready.id,
        reason: "Synthetic operator confirmed pause execution.",
        idempotencyKey: "synthetic-status-mismatch-command-key",
        executedByUserId: "user-licensee",
        executedAt: "2026-06-19T12:20:00.000Z",
        auditEventId: "audit-matter-lifecycle-status-mismatch-command",
      }),
    ).rejects.toMatchObject({ code: "MATTER_LIFECYCLE_EXPECTED_STATUS_MISMATCH" });
    const [after] = await repository.listMattersForUser(licensee);
    expect(after.status).toBe("open");
  });
});
