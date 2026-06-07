import { describe, expect, it } from "vitest";
import {
  buildDashboardHistoryEntry,
  buildDashboardHistoryState,
  dashboardReviewRailCollapsedStorageKey,
  readDashboardRequestedSection,
} from "./dashboard-shell-state";

describe("dashboard shell state helpers", () => {
  it("keeps the review rail session storage key stable", () => {
    expect(dashboardReviewRailCollapsedStorageKey).toBe(
      "open-practice.dashboard.reviewRailCollapsed",
    );
  });

  it("reads the requested dashboard section from a URL search string", () => {
    expect(readDashboardRequestedSection("?matter=one&section=billing")).toBe("billing");
    expect(readDashboardRequestedSection("?section=externalUploads")).toBe("externalUploads");
    expect(readDashboardRequestedSection("?matter=one")).toBeNull();
  });

  it("builds stable dashboard history state", () => {
    expect(buildDashboardHistoryState("queues")).toEqual({ section: "queues" });
  });

  it("builds dashboard history URLs without dropping existing query or hash state", () => {
    expect(
      buildDashboardHistoryEntry("http://localhost:3000/?matter=one#detail", "contacts"),
    ).toEqual({
      state: { section: "contacts" },
      url: "/?matter=one&section=contacts#detail",
    });
  });
});
