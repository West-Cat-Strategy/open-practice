import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FileText, type LucideIcon } from "lucide-react";
import {
  buildSidebarNavigationSections,
  type OpenPracticeSidebarSectionKey,
} from "../../routes/routeCatalog";
import type { OperationalFocusSummary } from "../operational-focus-panel";
import type { QueuesResponse, SessionResponse } from "../types";
import { applyMatterAvailabilityToNavigation } from "../dashboard-utils";
import {
  ContextRail,
  DashboardReviewRailCollapsedTarget,
  DashboardReviewRailExpandHandle,
  DashboardSidebar,
  DashboardTopbar,
  OperationalFocusPanel,
} from "./dashboard-shell";

const session: SessionResponse = {
  user: {
    id: "user-synthetic",
    firmId: "firm-synthetic",
    displayName: "Synthetic Reviewer",
    email: "reviewer@example.test",
    role: "owner_admin",
    assignedMatterIds: [],
    mfaEnabled: true,
  },
};

const navIcons = {
  matters: FileText,
  contacts: FileText,
  billing: FileText,
  documents: FileText,
  shares: FileText,
  externalUploads: FileText,
  drafting: FileText,
  calendar: FileText,
  signatures: FileText,
  intake: FileText,
  funds: FileText,
  audit: FileText,
  reports: FileText,
  queues: FileText,
} satisfies Record<OpenPracticeSidebarSectionKey, LucideIcon>;

const queues: QueuesResponse = {
  sections: [
    {
      key: "review",
      label: "Review",
      items: [
        { id: "queue-synthetic", title: "Synthetic review", status: "open", priority: "high" },
      ],
    },
  ],
};

describe("dashboard shell review rail controls", () => {
  it("labels the topbar review rail toggle when expanded", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardTopbar, {
        firmName: "Synthetic Firm",
        session,
        formatProfessionalRole: () => "Owner/admin",
        isContextRailCollapsed: false,
        onToggleContextRail: () => {},
        reviewRailToggleRef: { current: null },
      }),
    );

    expect(html).toContain("Hide review tools");
    expect(html).toContain('aria-controls="dashboard-review-rail"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-label="Toggle review tools"');
    expect(html).not.toContain("Hide Sidebar");
  });

  it("labels the topbar review rail toggle when collapsed", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardTopbar, {
        firmName: "Synthetic Firm",
        session,
        formatProfessionalRole: () => "Owner/admin",
        isContextRailCollapsed: true,
        onToggleContextRail: () => {},
        reviewRailToggleRef: { current: null },
      }),
    );

    expect(html).toContain("Show review tools");
    expect(html).toContain('class="context-rail-toggle-btn collapsed"');
    expect(html).toContain('aria-controls="dashboard-review-rail"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Toggle review tools"');
    expect(html).not.toContain("Show Sidebar");
  });

  it("renders the collapsed rail handle with the same review rail target", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardReviewRailExpandHandle, {
        expandHandleRef: { current: null },
        onExpand: () => {},
      }),
    );

    expect(html).toContain('class="context-rail-toggle-handle"');
    expect(html).toContain('aria-controls="dashboard-review-rail"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Open review tools"');
  });

  it("keeps collapsed controls anchored to a mounted review rail placeholder", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(DashboardTopbar, {
          firmName: "Synthetic Firm",
          session,
          formatProfessionalRole: () => "Owner/admin",
          isContextRailCollapsed: true,
          onToggleContextRail: () => {},
          reviewRailToggleRef: { current: null },
        }),
        createElement(DashboardReviewRailExpandHandle, {
          expandHandleRef: { current: null },
          onExpand: () => {},
        }),
        createElement(DashboardReviewRailCollapsedTarget),
      ),
    );

    expect(html.match(/aria-controls="dashboard-review-rail"/g) ?? []).toHaveLength(2);
    expect(html.match(/id="dashboard-review-rail"/g) ?? []).toHaveLength(1);
    expect(html).toContain('role="region"');
    expect(html).toContain('data-review-rail-state="collapsed"');
    expect(html).toContain("Review tools are collapsed.");
    expect(html).toContain(
      '<section aria-label="Matter review tools" class="context-rail-placeholder" data-review-rail-state="collapsed" id="dashboard-review-rail" role="region">',
    );
  });

  it("anchors the context rail for review tools and review work", () => {
    const html = renderToStaticMarkup(
      createElement(ContextRail, {
        conflictAliases: "",
        conflictIdentifiers: "",
        conflictName: "",
        conflictProspectiveRole: "",
        conflictResults: [],
        conflictStatus: "Conflict check has not run.",
        queueSummary: "1 queue item needs review.",
        queues,
        taskDeadlineSummary: "No task deadlines.",
        onConflictAliasesChange: () => {},
        onConflictIdentifiersChange: () => {},
        onConflictNameChange: () => {},
        onConflictProspectiveRoleChange: () => {},
        onRunConflictCheck: () => {},
      }),
    );

    expect(html).toContain('id="dashboard-review-rail"');
    expect(html).toContain('aria-label="Matter review tools"');
    expect(html).not.toContain('data-review-rail-state="collapsed"');
    expect(html).toContain("Prospective client check");
    expect(html).toContain("Review work");
  });

  it("labels collapsible primary navigation groups without changing section order", () => {
    const navigationSections = buildSidebarNavigationSections({
      billingCanView: true,
      shareLinksEnabled: true,
      externalUploadsEnabled: true,
      capabilitySections: [
        { key: "matters", enabled: true },
        { key: "contacts", enabled: true },
        { key: "billing", enabled: true },
        { key: "funds", enabled: true },
        { key: "documents", enabled: true },
        { key: "shares", enabled: true },
        { key: "externalUploads", enabled: true },
        { key: "drafting", enabled: true },
        { key: "calendar", enabled: true },
        { key: "signatures", enabled: true },
        { key: "intake", enabled: true },
        { key: "audit", enabled: true },
        { key: "queues", enabled: true },
      ],
    });
    const html = renderToStaticMarkup(
      createElement(DashboardSidebar, {
        activeSection: "matters",
        navigationSections,
        navIcons,
        onSelectSection: () => {},
      }),
    );

    expect(html).toContain('aria-label="Collapse Workspace navigation"');
    expect(html).toContain('aria-controls="nav-area-workspace-items"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-label="Collapse Finance navigation"');
    expect(html).toContain('aria-label="Collapse Operations navigation"');
    expect(html).toContain('aria-label="Collapse Review navigation"');
    expect(html.indexOf(">Workspace<")).toBeLessThan(html.indexOf(">Finance<"));
    expect(html.indexOf(">Finance<")).toBeLessThan(html.indexOf(">Operations<"));
    expect(html.indexOf(">Operations<")).toBeLessThan(html.indexOf(">Review<"));
  });

  it("marks the zero-matter sidebar for compact mobile navigation", () => {
    const navigationSections = applyMatterAvailabilityToNavigation(
      buildSidebarNavigationSections({
        billingCanView: true,
        shareLinksEnabled: true,
        externalUploadsEnabled: true,
        capabilitySections: [
          { key: "matters", enabled: false },
          { key: "contacts", enabled: true },
          { key: "funds", enabled: true },
          { key: "billing", enabled: true },
          { key: "documents", enabled: true },
          { key: "shares", enabled: true },
          { key: "externalUploads", enabled: true },
          { key: "drafting", enabled: true },
          { key: "calendar", enabled: true },
          { key: "signatures", enabled: true },
          { key: "intake", enabled: true },
          { key: "audit", enabled: true },
          { key: "reports", enabled: true },
          { key: "queues", enabled: true },
        ],
      }),
      false,
      true,
    );
    const html = renderToStaticMarkup(
      createElement(DashboardSidebar, {
        activeSection: "matters",
        matterState: "empty",
        navigationSections,
        navIcons,
        onSelectSection: () => {},
      }),
    );

    expect(html).toContain('class="sidebar dashboard-sidebar zero-matter-sidebar"');
    expect(html).toContain('data-matter-state="empty"');
    expect(html).toContain("Create or assign a matter to enable this matter-scoped section.");
  });

  it("renders operational focus targets as buttons only for enabled dashboard sections", () => {
    const navigationSections = buildSidebarNavigationSections({
      billingCanView: true,
      shareLinksEnabled: false,
      externalUploadsEnabled: true,
      capabilitySections: [
        { key: "matters", enabled: true },
        { key: "contacts", enabled: true },
        { key: "billing", enabled: true },
        { key: "funds", enabled: true },
        { key: "documents", enabled: true },
        { key: "shares", enabled: true },
        { key: "externalUploads", enabled: true },
        { key: "drafting", enabled: true },
        { key: "calendar", enabled: true },
        { key: "signatures", enabled: true },
        { key: "intake", enabled: true },
        { key: "audit", enabled: true },
        { key: "queues", enabled: true },
      ],
    });
    const operationalFocus = {
      attentionCount: 3,
      activeCount: 1,
      providerRiskCount: 0,
      items: [
        {
          key: "public-consultation",
          label: "Public consultation requests",
          value: "3",
          detail: "Pending website requests are summarized by count.",
          tone: "risk",
          section: "Intake",
          targetSection: "intake",
        },
        {
          key: "portal-links",
          label: "Portal links expiring",
          value: "2",
          detail: "Links expiring within 7 days.",
          tone: "neutral",
          section: "Portal access",
          targetSection: "shares",
        },
        {
          key: "workers-active",
          label: "Active worker runs",
          value: "1",
          detail: "Worker run summaries stay redacted.",
          tone: "ready",
          section: "Workers",
        },
      ],
    } as OperationalFocusSummary;

    const html = renderToStaticMarkup(
      createElement(OperationalFocusPanel, {
        navigationSections,
        operationalFocus,
        onOpenQueues: () => {},
        onSelectSection: () => {},
      }),
    );

    expect(html).toContain('aria-label="Open Public consultation requests"');
    expect(html).toContain('class="operational-focus-item risk"');
    expect(html).toContain("<strong>Public consultation requests</strong>");
    expect(html).toContain('<article class="operational-focus-item neutral"');
    expect(html).toContain("<strong>Portal links expiring</strong>");
    expect(html).toContain('<article class="operational-focus-item ready"');
    expect(html).toContain("<strong>Active worker runs</strong>");
    expect(html).not.toContain('aria-label="Open Portal links expiring"');
    expect(html).not.toContain('aria-label="Open Active worker runs"');
  });
});
