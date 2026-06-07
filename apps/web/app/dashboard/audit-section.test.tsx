import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { emptyAuditProjectionDashboard } from "../audit-dashboard";
import type { DashboardLaneFreshnessCue, DashboardLaneRefreshState } from "../dashboard-utils";
import type { MatterSummary } from "../types";
import { AuditSection } from "./audit-section";

const freshnessCue: DashboardLaneFreshnessCue = {
  label: "Fresh",
  detail: "Loaded with the dashboard response.",
  tone: "ready",
  stale: false,
};

const refreshState: DashboardLaneRefreshState = {
  refreshing: false,
};

const auditProjection = {
  ...emptyAuditProjectionDashboard("available"),
  valid: false,
  taxonomySummary: {
    ...emptyAuditProjectionDashboard("available").taxonomySummary,
    unknown: 2,
    matterScopedWithoutMatterId: 1,
    unknownActions: ["unknown.action", "another.action"],
    resourceTypeMismatches: [
      {
        action: "documents.reviewed",
        expectedResourceType: "document",
        observedResourceType: "matter",
        count: 3,
      },
    ],
  },
};

const activity: MatterSummary["activity"] = [
  {
    id: "activity_synthetic",
    firmId: "firm_synthetic",
    kind: "document",
    metadata: {},
    title: "Synthetic document reviewed",
    occurredAt: "2026-06-06T00:00:00.000Z",
  },
];

function noop(): void {}

describe("AuditSection", () => {
  it("renders matter audit activity without changing copy or classes", () => {
    const html = renderToStaticMarkup(
      createElement(AuditSection, {
        activity,
        auditFreshnessCue: freshnessCue,
        auditProjection,
        auditRefreshState: refreshState,
        compactDate: (value) => value.slice(0, 10),
        onRefreshAudit: noop,
      }),
    );

    expect(html).toContain('class="lane-refresh-panel ready"');
    expect(html).toContain('data-stale="false"');
    expect(html).toContain("Refresh audit activity");
    expect(html).toContain('class="party-list"');
    expect(html).toContain("Audit taxonomy projection");
    expect(html).toContain("Audit taxonomy loaded");
    expect(html).toContain("chain invalid");
    expect(html).toContain("Unknown actions");
    expect(html).toContain("Matter-scope gaps");
    expect(html).toContain("Resource-type mismatches");
    expect(html).toContain("unknown.action, another.action");
    expect(html).toContain("documents.reviewed: matter expected document (3)");
    expect(html).toContain("Synthetic document reviewed");
    expect(html).toContain("2026-06-06");
  });

  it("keeps zero-matter audit summary free of matter activity wrappers", () => {
    const html = renderToStaticMarkup(
      createElement(AuditSection, {
        auditFreshnessCue: freshnessCue,
        auditProjection: emptyAuditProjectionDashboard("access_denied"),
        auditRefreshState: { refreshing: true },
        compactDate: (value) => value,
        onRefreshAudit: noop,
      }),
    );

    expect(html).toContain("Audit activity");
    expect(html).toContain("Refreshing");
    expect(html).toContain("Audit taxonomy access denied");
    expect(html).toContain("read-only");
    expect(html).not.toContain('class="party-list"');
    expect(html).not.toContain("No activity has been recorded for this matter.");
  });
});
