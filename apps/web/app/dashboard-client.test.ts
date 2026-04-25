import { describe, expect, it } from "vitest";
import type { DashboardSectionCapability, DashboardSectionKey } from "@open-practice/domain";
import { buildSidebarNavigationSections } from "../routes/routeCatalog";
import { filterMatters } from "./dashboard-utils";
import type { MatterSummary } from "./types";

const capabilityResources: Record<DashboardSectionKey, DashboardSectionCapability["resource"]> = {
  matters: "matter",
  funds: "trust_ledger",
  billing: "time_entry",
  documents: "document",
  signatures: "signature_request",
  intake: "intake_session",
  audit: "audit_log",
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

function matter(overrides: Partial<MatterSummary>): MatterSummary {
  return {
    id: "matter-001",
    firmId: "firm-west-legal",
    number: "2026-0001",
    title: "Morgan tenancy dispute",
    practiceArea: "Residential tenancy",
    status: "open",
    jurisdiction: "BC",
    responsibleUserId: "user-licensee",
    parties: [],
    documents: [],
    timeEntries: [],
    expenses: [],
    activity: [],
    trustBalanceCents: 0,
    ...overrides,
  } as MatterSummary;
}

describe("dashboard client behavior", () => {
  it("filters matters by API-backed matter fields", () => {
    const matters = [
      matter({ id: "matter-001", title: "Morgan tenancy dispute" }),
      matter({ id: "matter-002", number: "2026-0002", title: "North Star records" }),
    ];

    expect(filterMatters(matters, "north").map((result) => result.id)).toEqual(["matter-002"]);
    expect(filterMatters(matters, "2026-0001").map((result) => result.id)).toEqual(["matter-001"]);
  });

  it("builds sidebar navigation from catalog order and labels", () => {
    const navigationSections = buildSidebarNavigationSections({
      billingCanView: true,
      capabilitySections: [
        capability("matters"),
        capability("funds"),
        capability("documents"),
        capability("billing"),
        capability("signatures"),
        capability("intake"),
        capability("audit"),
      ],
    });

    expect(navigationSections).toEqual([
      { key: "matters", label: "Matters", enabled: true },
      { key: "funds", label: "Funds", enabled: true },
      { key: "billing", label: "Billing", enabled: true },
      { key: "documents", label: "Documents", enabled: true },
      { key: "signatures", label: "Signatures", enabled: true },
      { key: "intake", label: "Intake", enabled: true },
      { key: "audit", label: "Audit", enabled: true },
    ]);
  });

  it("keeps billing visibility compatible with billing dashboard access", () => {
    const navigationSections = buildSidebarNavigationSections({
      billingCanView: false,
      capabilitySections: [
        capability("matters"),
        capability("funds"),
        capability("documents"),
        capability("signatures"),
        capability("intake"),
        capability("audit"),
      ],
    });

    expect(navigationSections.find((section) => section.key === "billing")).toEqual({
      key: "billing",
      label: "Billing",
      enabled: false,
    });
    expect(navigationSections.map((section) => section.key)).not.toContain("queues");
  });
});
