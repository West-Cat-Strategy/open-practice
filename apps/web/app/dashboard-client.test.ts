import { describe, expect, it } from "vitest";
import type {
  DashboardSectionCapability,
  DashboardSectionKey,
  DraftRecord,
  DraftTemplateRecord,
} from "@open-practice/domain";
import { buildSidebarNavigationSections } from "../routes/routeCatalog";
import { filterMatters } from "./dashboard-utils";
import {
  appendDraftToMatterDrafts,
  buildDraftFromTemplatePayload,
  extractDraftPlainText,
  loadDraftingDashboardData,
} from "./drafting-dashboard";
import type { MatterSummary } from "./types";

const capabilityResources: Record<DashboardSectionKey, DashboardSectionCapability["resource"]> = {
  matters: "matter",
  funds: "trust_ledger",
  billing: "time_entry",
  documents: "document",
  drafting: "draft",
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

const editorJson = {
  type: "doc" as const,
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Synthetic letter opening" }],
    },
  ],
};

function draftTemplate(overrides: Partial<DraftTemplateRecord> = {}): DraftTemplateRecord {
  return {
    id: "draft-template-legal-letter",
    firmId: "firm-west-legal",
    name: "Generic Legal Letter",
    description: "Synthetic correspondence template.",
    editorJson,
    category: "correspondence",
    active: true,
    createdAt: "2026-04-29T12:00:00.000Z",
    updatedAt: "2026-04-29T12:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

function draftRecord(overrides: Partial<DraftRecord> = {}): DraftRecord {
  return {
    id: "draft-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    title: "Generic Legal Letter - 2026-0001",
    editorJson,
    version: 1,
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    createdAt: "2026-04-29T12:00:00.000Z",
    updatedAt: "2026-04-29T12:00:00.000Z",
    metadata: { templateId: "draft-template-legal-letter" },
    ...overrides,
  };
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
        capability("drafting"),
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
      { key: "drafting", label: "Drafting", enabled: true },
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
        capability("drafting"),
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

  it("loads draft templates once and existing drafts per matter for first render", async () => {
    const template = draftTemplate();
    const draftCalls: string[] = [];
    const data = await loadDraftingDashboardData({
      matters: [matter({ id: "matter-001" }), matter({ id: "matter-002" })],
      listTemplates: async () => [template],
      listDraftsForMatter: async (matterId) => {
        draftCalls.push(matterId);
        return [draftRecord({ id: `draft-${matterId}`, matterId })];
      },
    });

    expect(data.templates).toEqual([template]);
    expect(draftCalls).toEqual(["matter-001", "matter-002"]);
    expect(data.draftsByMatterId["matter-001"]).toEqual([
      expect.objectContaining({ id: "draft-matter-001", matterId: "matter-001" }),
    ]);
    expect(data.draftsByMatterId["matter-002"]).toEqual([
      expect.objectContaining({ id: "draft-matter-002", matterId: "matter-002" }),
    ]);
  });

  it("builds template draft payloads, appends returned drafts, and previews TipTap text", () => {
    const template = draftTemplate();
    const activeMatter = matter({ id: "matter-001", number: "2026-0001" });
    const createdDraft = draftRecord();

    expect(buildDraftFromTemplatePayload({ matter: activeMatter, template })).toEqual({
      matterId: "matter-001",
      title: "Generic Legal Letter - 2026-0001",
      templateId: "draft-template-legal-letter",
    });
    expect(appendDraftToMatterDrafts({ "matter-001": [] }, createdDraft)).toEqual({
      "matter-001": [createdDraft],
    });
    expect(extractDraftPlainText(template.editorJson)).toBe("Synthetic letter opening");
  });
});
