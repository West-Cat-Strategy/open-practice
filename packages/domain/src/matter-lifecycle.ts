import type { MatterStatus } from "./models.js";

export const matterLifecycleTransitions = ["pause", "close", "archive", "reopen"] as const;
export type MatterLifecycleTransition = (typeof matterLifecycleTransitions)[number];

export const matterLifecycleReadinessValues = ["ready", "blocked"] as const;
export type MatterLifecycleReadiness = (typeof matterLifecycleReadinessValues)[number];

export const matterLifecycleTargetStatusByTransition = {
  pause: "paused",
  close: "closed",
  archive: "archived",
  reopen: "open",
} as const satisfies Record<MatterLifecycleTransition, MatterStatus>;

export interface MatterLifecycleTransitionRecord {
  id: string;
  firmId: string;
  matterId: string;
  transition: MatterLifecycleTransition;
  currentStatus: MatterStatus;
  targetStatus: MatterStatus;
  readiness: MatterLifecycleReadiness;
  reason: string;
  blockers: string[];
  reviewedByUserId: string;
  reviewedAt: string;
  createdAt: string;
}

export interface MatterLifecycleTransitionSummary {
  total: number;
  ready: number;
  blocked: number;
  latestByTransition: Partial<Record<MatterLifecycleTransition, MatterLifecycleTransitionRecord>>;
  reviewOnly: true;
}

const transitionSet = new Set<string>(matterLifecycleTransitions);
const readinessSet = new Set<string>(matterLifecycleReadinessValues);
const maxReasonLength = 240;
const maxBlockerLength = 160;
const maxBlockers = 8;

function assertConciseText(value: string, field: string, maxLength: number): void {
  if (!value.trim()) throw new Error(`${field} is required`);
  if (value.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or less`);
}

export function matterLifecycleTargetStatus(transition: MatterLifecycleTransition): MatterStatus {
  return matterLifecycleTargetStatusByTransition[transition];
}

export function validateMatterLifecycleTransitionRecord(
  record: MatterLifecycleTransitionRecord,
): void {
  if (!record.id.trim()) throw new Error("Matter lifecycle transition id is required");
  if (!record.firmId.trim()) throw new Error("Matter lifecycle transition firm id is required");
  if (!record.matterId.trim()) throw new Error("Matter lifecycle transition matter id is required");
  if (!transitionSet.has(record.transition)) {
    throw new Error(`Unsupported matter lifecycle transition: ${record.transition}`);
  }
  if (!readinessSet.has(record.readiness)) {
    throw new Error(`Unsupported matter lifecycle readiness: ${record.readiness}`);
  }
  const expectedTarget = matterLifecycleTargetStatus(record.transition);
  if (record.targetStatus !== expectedTarget) {
    throw new Error(
      `Matter lifecycle transition ${record.transition} must target ${expectedTarget}`,
    );
  }
  assertConciseText(record.reason, "Matter lifecycle transition reason", maxReasonLength);
  if (!Array.isArray(record.blockers)) {
    throw new Error("Matter lifecycle transition blockers must be an array");
  }
  if (record.blockers.length > maxBlockers) {
    throw new Error(
      `Matter lifecycle transition blockers must include ${maxBlockers} items or fewer`,
    );
  }
  for (const blocker of record.blockers) {
    assertConciseText(blocker, "Matter lifecycle transition blocker", maxBlockerLength);
  }
  if (record.readiness === "blocked" && record.blockers.length === 0) {
    throw new Error("Blocked matter lifecycle readiness requires at least one blocker");
  }
  if (Number.isNaN(Date.parse(record.reviewedAt)) || Number.isNaN(Date.parse(record.createdAt))) {
    throw new Error("Matter lifecycle transition timestamps must be ISO-compatible");
  }
}

export function buildMatterLifecycleTransitionRecord(
  input: Omit<MatterLifecycleTransitionRecord, "targetStatus" | "blockers"> & {
    blockers?: string[];
  },
): MatterLifecycleTransitionRecord {
  const record: MatterLifecycleTransitionRecord = {
    ...input,
    targetStatus: matterLifecycleTargetStatus(input.transition),
    reason: input.reason.trim(),
    blockers: (input.blockers ?? []).map((blocker) => blocker.trim()).filter(Boolean),
  };
  validateMatterLifecycleTransitionRecord(record);
  return record;
}

export function summarizeMatterLifecycleTransitions(
  records: MatterLifecycleTransitionRecord[],
): MatterLifecycleTransitionSummary {
  const sorted = [...records].sort((left, right) =>
    right.reviewedAt.localeCompare(left.reviewedAt),
  );
  const latestByTransition: MatterLifecycleTransitionSummary["latestByTransition"] = {};
  for (const record of sorted) {
    latestByTransition[record.transition] ??= record;
  }
  return {
    total: records.length,
    ready: records.filter((record) => record.readiness === "ready").length,
    blocked: records.filter((record) => record.readiness === "blocked").length,
    latestByTransition,
    reviewOnly: true,
  };
}

export function buildMatterLifecycleTransitionAuditMetadata(
  record: MatterLifecycleTransitionRecord,
): Record<string, unknown> {
  return {
    matterId: record.matterId,
    transitionRecordId: record.id,
    transition: record.transition,
    currentStatus: record.currentStatus,
    targetStatus: record.targetStatus,
    readiness: record.readiness,
    blockerCount: record.blockers.length,
    reasonPresent: Boolean(record.reason),
    reviewedByUserId: record.reviewedByUserId,
    reviewOnly: true,
  };
}
