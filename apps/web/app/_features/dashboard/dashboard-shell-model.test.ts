import { describe, expect, it } from "vitest";
import type { DashboardSectionCapability, DashboardSectionKey } from "@open-practice/domain";
import {
  buildDashboardShellNavigationModel,
  dashboardActiveSectionLabel,
} from "./dashboard-shell-model";

const capabilityResources: Record<DashboardSectionKey, DashboardSectionCapability["resource"]> = {
  matters: "matter",
  contacts: "contact",
  funds: "trust_ledger",
  billing: "time_entry",
  documents: "document",
  research: "legal_research",
  drafting: "draft",
  calendar: "calendar_event",
  signatures: "signature_request",
  intake: "intake_session",
  audit: "audit_log",
  reports: "report",
};

function capability(
  key: DashboardSectionKey,
  overrides: Partial<DashboardSectionCapability> = {},
): DashboardSectionCapability {
  return {
    key,
    label: `${key} from API`,
    enabled: true,
    resource: capabilityResources[key],
    actions: ["read"],
    ...overrides,
  };
}

const baseCapabilitySections: DashboardSectionCapability[] = [
  capability("matters"),
  capability("contacts"),
  capability("funds"),
  capability("documents"),
  capability("drafting"),
  capability("calendar"),
  capability("billing"),
  capability("signatures"),
  capability("intake"),
  capability("audit"),
  capability("reports"),
];

describe("dashboard shell navigation model", () => {
  it("preserves populated-matter navigation availability from shell inputs", () => {
    const model = buildDashboardShellNavigationModel({
      billingCanView: false,
      capabilitySections: baseCapabilitySections.map((section) =>
        section.key === "documents" ? { ...section, enabled: false } : section,
      ),
      hasAccessibleMatter: true,
      canCreateMatter: true,
      shareLinksEnabled: true,
      externalUploadsEnabled: true,
      sessionRole: "owner_admin",
    });

    expect(model.navigationSections.find((section) => section.key === "documents")).toMatchObject({
      enabled: true,
      requiresMatterContext: true,
      title: "Documents",
    });
    expect(model.navigationSections.find((section) => section.key === "billing")).toMatchObject({
      enabled: false,
      title: "Billing",
    });
    expect(model.navigationSections.find((section) => section.key === "shares")).toMatchObject({
      enabled: true,
      title: "Share Links",
    });
    expect(
      model.navigationSections.find((section) => section.key === "externalUploads"),
    ).toMatchObject({
      enabled: true,
      title: "External Uploads",
    });
    expect(model.navigationSections.find((section) => section.key === "admin")).toMatchObject({
      enabled: true,
      title: "Admin Readiness",
    });
  });

  it("keeps firm surfaces available while disabling zero-matter work surfaces", () => {
    const model = buildDashboardShellNavigationModel({
      billingCanView: true,
      capabilitySections: baseCapabilitySections,
      hasAccessibleMatter: false,
      canCreateMatter: true,
      shareLinksEnabled: true,
      externalUploadsEnabled: true,
      sessionRole: "auditor",
    });

    expect(model.navigationSections.find((section) => section.key === "matters")).toMatchObject({
      enabled: true,
    });
    expect(model.navigationSections.find((section) => section.key === "documents")).toMatchObject({
      enabled: false,
      disabledReason: "Create or assign a matter to enable this matter-scoped section.",
    });
    expect(model.navigationSections.find((section) => section.key === "funds")).toMatchObject({
      enabled: false,
      disabledReason: "Create or assign a matter to enable this matter-scoped section.",
    });
    expect(model.navigationSections.find((section) => section.key === "contacts")).toMatchObject({
      enabled: true,
    });
    expect(model.navigationSections.find((section) => section.key === "audit")).toMatchObject({
      enabled: true,
    });
    expect(model.navigationSections.find((section) => section.key === "reports")).toMatchObject({
      enabled: true,
    });
    expect(model.navigationSections.find((section) => section.key === "admin")).toMatchObject({
      enabled: true,
    });
    expect(model.navigationSections.find((section) => section.key === "queues")).toMatchObject({
      enabled: true,
    });
  });

  it("keeps matter action sections scoped to matter surfaces plus queues", () => {
    const model = buildDashboardShellNavigationModel({
      billingCanView: true,
      capabilitySections: baseCapabilitySections,
      hasAccessibleMatter: true,
      canCreateMatter: true,
      shareLinksEnabled: true,
      externalUploadsEnabled: true,
      sessionRole: "owner_admin",
    });

    expect(model.matterActionSections.map((section) => section.key)).toEqual([
      "funds",
      "billing",
      "documents",
      "shares",
      "externalUploads",
      "drafting",
      "calendar",
      "signatures",
      "intake",
      "queues",
    ]);
  });

  it("preserves active section labels and fallback copy", () => {
    const { navigationSections } = buildDashboardShellNavigationModel({
      billingCanView: true,
      capabilitySections: baseCapabilitySections,
      hasAccessibleMatter: true,
      canCreateMatter: true,
      shareLinksEnabled: true,
      externalUploadsEnabled: true,
      sessionRole: "owner_admin",
    });

    expect(
      dashboardActiveSectionLabel({
        activeMatterTitle: "Synthetic Tenancy Matter",
        activeSection: "matters",
        navigationSections,
      }),
    ).toBe("Synthetic Tenancy Matter");
    expect(
      dashboardActiveSectionLabel({
        activeMatterTitle: "Synthetic Tenancy Matter",
        activeSection: "queues",
        navigationSections,
      }),
    ).toBe("Operational Queues");
    expect(
      dashboardActiveSectionLabel({
        activeSection: "matters",
        navigationSections,
      }),
    ).toBe("Dashboard");
    expect(
      dashboardActiveSectionLabel({
        activeSection: "queues",
        navigationSections: [],
      }),
    ).toBe("Dashboard");
  });
});
