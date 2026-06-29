export type ReviewAgingStatus = "fresh" | "aging" | "stale";

export interface ReviewAgingCue {
  status: ReviewAgingStatus;
  ageHours: number;
  referenceAt: string;
  agingAfterHours: 24;
  staleAfterHours: 72;
  automaticFinalConfirmation: false;
  autoExpires: false;
}

const HOUR_MS = 60 * 60 * 1000;
const REVIEW_AGING_AFTER_HOURS = 24;
const REVIEW_STALE_AFTER_HOURS = 72;

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
