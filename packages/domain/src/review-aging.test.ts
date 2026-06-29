import { describe, expect, it } from "vitest";
import { buildReviewAgingCue } from "./review-aging.js";

describe("review aging cues", () => {
  it("classifies fresh, aging, and stale review cues at 24h and 72h thresholds", () => {
    const referenceAt = "2026-06-01T12:00:00.000Z";

    expect(buildReviewAgingCue({ referenceAt, now: "2026-06-02T11:59:59.000Z" })).toMatchObject({
      status: "fresh",
      ageHours: 23,
      agingAfterHours: 24,
      staleAfterHours: 72,
      automaticFinalConfirmation: false,
      autoExpires: false,
    });
    expect(buildReviewAgingCue({ referenceAt, now: "2026-06-02T12:00:00.000Z" })).toMatchObject({
      status: "aging",
      ageHours: 24,
    });
    expect(buildReviewAgingCue({ referenceAt, now: "2026-06-04T11:59:59.000Z" })).toMatchObject({
      status: "aging",
      ageHours: 71,
    });
    expect(buildReviewAgingCue({ referenceAt, now: "2026-06-04T12:00:00.000Z" })).toMatchObject({
      status: "stale",
      ageHours: 72,
    });
  });
});
