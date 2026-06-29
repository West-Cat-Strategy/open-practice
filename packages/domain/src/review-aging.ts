export type ReviewAgingStatus = "fresh" | "aging" | "stale";
export type ReviewAgingDecisionCueStatus = Extract<ReviewAgingStatus, "aging" | "stale">;

export const reviewAgingDecisionValues = [
  "acknowledged",
  "follow_up_required",
  "defer_review",
] as const;

export type ReviewAgingDecision = (typeof reviewAgingDecisionValues)[number];

export interface ReviewAgingCue {
  status: ReviewAgingStatus;
  ageHours: number;
  referenceAt: string;
  agingAfterHours: 24;
  staleAfterHours: 72;
  automaticFinalConfirmation: false;
  autoExpires: false;
}

export interface ReviewAgingDecisionRecord {
  decision: ReviewAgingDecision;
  decidedAt: string;
  decidedByUserId: string;
  cueStatus: ReviewAgingDecisionCueStatus;
  ageHours: number;
  automaticFinalConfirmation: false;
  autoExpires: false;
  providerSync: false;
  publicRoomCreated: false;
  nativeMediaCreated: false;
  chatCreated: false;
  recordingCreated: false;
  matterCreated: false;
}

const HOUR_MS = 60 * 60 * 1000;
const REVIEW_AGING_AFTER_HOURS = 24;
const REVIEW_STALE_AFTER_HOURS = 72;

export function isReviewAgingDecision(value: unknown): value is ReviewAgingDecision {
  return reviewAgingDecisionValues.includes(value as ReviewAgingDecision);
}

export function isReviewAgingDecisionCueStatus(
  value: unknown,
): value is ReviewAgingDecisionCueStatus {
  return value === "aging" || value === "stale";
}

export function buildReviewAgingCue(input: { referenceAt: string; now?: string }): ReviewAgingCue {
  const referenceTime = Date.parse(input.referenceAt);
  const nowTime = Date.parse(input.now ?? new Date().toISOString());
  const ageHours =
    Number.isFinite(referenceTime) && Number.isFinite(nowTime)
      ? Math.max(0, Math.floor((nowTime - referenceTime) / HOUR_MS))
      : 0;
  const status: ReviewAgingStatus =
    ageHours >= REVIEW_STALE_AFTER_HOURS
      ? "stale"
      : ageHours >= REVIEW_AGING_AFTER_HOURS
        ? "aging"
        : "fresh";

  return {
    status,
    ageHours,
    referenceAt: input.referenceAt,
    agingAfterHours: REVIEW_AGING_AFTER_HOURS,
    staleAfterHours: REVIEW_STALE_AFTER_HOURS,
    automaticFinalConfirmation: false,
    autoExpires: false,
  };
}

export function buildReviewAgingDecisionRecord(input: {
  decision?: ReviewAgingDecision;
  decidedAt?: string;
  decidedByUserId?: string;
  cueStatus?: ReviewAgingStatus;
  ageHours?: number;
}): ReviewAgingDecisionRecord | undefined {
  if (
    !isReviewAgingDecision(input.decision) ||
    !input.decidedAt ||
    !input.decidedByUserId ||
    !isReviewAgingDecisionCueStatus(input.cueStatus) ||
    typeof input.ageHours !== "number" ||
    !Number.isFinite(input.ageHours)
  ) {
    return undefined;
  }

  return {
    decision: input.decision,
    decidedAt: input.decidedAt,
    decidedByUserId: input.decidedByUserId,
    cueStatus: input.cueStatus,
    ageHours: Math.max(0, Math.floor(input.ageHours)),
    automaticFinalConfirmation: false,
    autoExpires: false,
    providerSync: false,
    publicRoomCreated: false,
    nativeMediaCreated: false,
    chatCreated: false,
    recordingCreated: false,
    matterCreated: false,
  };
}
