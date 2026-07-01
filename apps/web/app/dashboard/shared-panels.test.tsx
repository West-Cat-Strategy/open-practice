import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardSectionHeader, DashboardStatusNote, DashboardSummaryGrid } from "./shared-panels";

describe("shared dashboard panel primitives", () => {
  it("renders labelled section headers with metadata or explicit actions", () => {
    const metadataHeader = renderToStaticMarkup(
      createElement(DashboardSectionHeader, {
        eyebrow: "Matter context",
        id: "synthetic-section-title",
        meta: "4 records",
        title: "Synthetic section",
      }),
    );
    const actionHeader = renderToStaticMarkup(
      createElement(DashboardSectionHeader, {
        actions: createElement("button", { type: "button" }, "Refresh"),
        meta: "hidden when actions exist",
        title: "Action section",
      }),
    );

    expect(metadataHeader).toContain('id="synthetic-section-title"');
    expect(metadataHeader).toContain("Matter context");
    expect(metadataHeader).toContain("Synthetic section");
    expect(metadataHeader).toContain("4 records");
    expect(actionHeader).toContain("<button");
    expect(actionHeader).toContain("Refresh");
    expect(actionHeader).not.toContain("hidden when actions exist");
  });

  it("renders compact summaries and live status notes without requiring data contracts", () => {
    const summary = renderToStaticMarkup(
      createElement(DashboardSummaryGrid, {
        ariaLabel: "Synthetic summary",
        items: [
          { label: "Ready", value: "12", detail: "reviewed", tone: "ready" },
          { label: "Needs attention", value: "2", detail: "blocked", tone: "risk" },
        ],
      }),
    );
    const note = renderToStaticMarkup(
      createElement(DashboardStatusNote, { children: "Synthetic status", live: true }),
    );

    expect(summary).toContain('aria-label="Synthetic summary"');
    expect(summary).toContain("dashboard-summary-item ready");
    expect(summary).toContain("dashboard-summary-item risk");
    expect(summary).toContain("Needs attention");
    expect(note).toContain('role="status"');
    expect(note).toContain('aria-live="polite"');
    expect(note).toContain("Synthetic status");
  });
});
