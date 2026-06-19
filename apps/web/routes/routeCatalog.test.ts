import { describe, expect, it } from "vitest";
import {
  buildSidebarNavigationSections,
  buildDashboardSectionUrl,
  getDashboardSectionPath,
  getRouteCatalogEntry,
  getRoutesByArea,
  getSidebarRouteCatalogEntries,
  isUnavailableDashboardRouteSelection,
  matchRouteCatalogEntry,
  resolveDashboardRouteSelection,
  routeCatalog,
  type OpenPracticeSidebarNavigationSection,
  type OpenPracticeRouteId,
  type RouteCatalogSectionCapability,
} from "./routeCatalog";

function enabledSidebarNavigation(): OpenPracticeSidebarNavigationSection[] {
  return getSidebarRouteCatalogEntries().map((entry) => ({
    key: entry.sectionKey ?? "matters",
    label: entry.shortLabel,
    title: entry.title,
    area: entry.area,
    availability: entry.availability,
    enabled: true,
    requiresMatterContext: entry.requiresMatterContext,
  }));
}

const canonicalRoutePaths = {
  matters: "/workspace/matters",
  contacts: "/workspace/contacts",
  communications: "/workspace/communications",
  documents: "/workspace/documents",
  research: "/workspace/research",
  drafting: "/workspace/drafting",
  calendar: "/workspace/calendar",
  funds: "/finance/trust-funds",
  billing: "/finance/billing",
  tasks: "/operations/tasks",
  shares: "/operations/share-links",
  externalUploads: "/operations/external-uploads",
  signatures: "/operations/signatures",
  intake: "/operations/intake",
  queues: "/operations/queues",
  audit: "/review/audit",
  reports: "/review/reports",
  admin: "/review/admin-readiness",
} satisfies Record<OpenPracticeRouteId, string>;

describe("Open Practice route catalog", () => {
  it("contains the first legal-practice workspace surfaces", () => {
    const routeIds = routeCatalog.map((entry) => entry.id);
    const expected: OpenPracticeRouteId[] = [
      "matters",
      "contacts",
      "communications",
      "funds",
      "billing",
      "documents",
      "research",
      "shares",
      "externalUploads",
      "drafting",
      "tasks",
      "calendar",
      "signatures",
      "intake",
      "audit",
      "reports",
      "admin",
      "queues",
    ];

    expect(routeIds).toEqual(expected);
  });

  it("looks up entries by id and exposes stable dashboard paths", () => {
    expect(getRouteCatalogEntry("billing")).toMatchObject({
      title: "Billing",
      path: "/finance/billing",
      area: "finance",
    });
    expect(getDashboardSectionPath("billing")).toBe("/finance/billing");
    expect(getDashboardSectionPath("communications")).toBe("/workspace/communications");
    expect(buildDashboardSectionUrl("http://localhost:3000/?matter=one#detail", "billing")).toBe(
      "/finance/billing?matter=one#detail",
    );
    expect(
      buildDashboardSectionUrl(
        "http://localhost:3000/workspace/documents?matter=one&section=documents#detail",
        "communications",
      ),
    ).toBe("/workspace/communications?matter=one#detail");
    expect(Object.fromEntries(routeCatalog.map((entry) => [entry.id, entry.path]))).toEqual(
      canonicalRoutePaths,
    );
    expect(new Set(routeCatalog.map((entry) => entry.path)).size).toBe(routeCatalog.length);
  });

  it("groups routes by area in display order", () => {
    expect(getRoutesByArea("finance").map((entry) => entry.id)).toEqual(["funds", "billing"]);
    expect(getRoutesByArea("operations").map((entry) => entry.id)).toEqual([
      "shares",
      "externalUploads",
      "tasks",
      "signatures",
      "intake",
      "queues",
    ]);
    expect(getRoutesByArea("review").map((entry) => entry.id)).toEqual([
      "audit",
      "reports",
      "admin",
    ]);
    expect(getRoutesByArea("workspace").map((entry) => entry.id)).toEqual([
      "matters",
      "contacts",
      "communications",
      "documents",
      "research",
      "drafting",
      "calendar",
    ]);
    expect(getSidebarRouteCatalogEntries().map((entry) => [entry.id, entry.area])).toContainEqual([
      "documents",
      "workspace",
    ]);
  });

  it("keeps queues cataloged in the sidebar order", () => {
    expect(getRouteCatalogEntry("queues")).toMatchObject({
      title: "Operational Queues",
      sectionKey: "queues",
      showInSidebar: true,
    });
    expect(getSidebarRouteCatalogEntries().map((entry) => entry.id)).toEqual([
      "matters",
      "contacts",
      "communications",
      "funds",
      "billing",
      "documents",
      "research",
      "shares",
      "externalUploads",
      "drafting",
      "tasks",
      "calendar",
      "signatures",
      "intake",
      "audit",
      "reports",
      "admin",
      "queues",
    ]);
  });

  it("matches dashboard section URLs without changing runtime behavior", () => {
    expect(matchRouteCatalogEntry("/")?.id).toBe("matters");
    expect(matchRouteCatalogEntry("/workspace/contacts")?.id).toBe("contacts");
    expect(matchRouteCatalogEntry("/workspace/communications")?.id).toBe("communications");
    expect(matchRouteCatalogEntry("/workspace/documents")?.id).toBe("documents");
    expect(matchRouteCatalogEntry("/finance/trust-funds")?.id).toBe("funds");
    expect(matchRouteCatalogEntry("/finance/billing")?.id).toBe("billing");
    expect(matchRouteCatalogEntry("/operations/external-uploads")?.id).toBe("externalUploads");
    expect(matchRouteCatalogEntry("/review/admin-readiness")?.id).toBe("admin");
    expect(matchRouteCatalogEntry("/?section=contacts")?.id).toBe("contacts");
    expect(matchRouteCatalogEntry("/?section=communications")?.id).toBe("communications");
    expect(matchRouteCatalogEntry("/?section=documents")?.id).toBe("documents");
    expect(matchRouteCatalogEntry("/?section=research")?.id).toBe("research");
    expect(matchRouteCatalogEntry("/?section=shares")?.id).toBe("shares");
    expect(matchRouteCatalogEntry("/?section=externalUploads")?.id).toBe("externalUploads");
    expect(matchRouteCatalogEntry("/?section=drafting")?.id).toBe("drafting");
    expect(matchRouteCatalogEntry("/?section=tasks")?.id).toBe("tasks");
    expect(matchRouteCatalogEntry("/?section=calendar")?.id).toBe("calendar");
    expect(matchRouteCatalogEntry("/?section=reports")?.id).toBe("reports");
    expect(matchRouteCatalogEntry("/?section=admin")?.id).toBe("admin");
    expect(matchRouteCatalogEntry("/?section=queues")?.id).toBe("queues");
    expect(matchRouteCatalogEntry("/?section=unknown")).toBeNull();
  });

  it("keeps staff canonical paths separate from public token routes", () => {
    const publicEntrypoints = new Set([
      "/share-links",
      "/external-uploads",
      "/intake-forms",
      "/guest-sessions",
    ]);

    expect(
      routeCatalog.map((entry) => entry.path).filter((path) => publicEntrypoints.has(path)),
    ).toEqual([]);
  });

  it("resolves dashboard deep links for enabled sidebar entries", () => {
    expect(
      resolveDashboardRouteSelection({
        requestedSection: "drafting",
        navigationSections: enabledSidebarNavigation(),
      }),
    ).toMatchObject({
      sectionKey: "drafting",
      status: "matched",
      requestedSection: "drafting",
    });
  });

  it("marks unknown dashboard sections unavailable while preserving a fallback target", () => {
    const selection = resolveDashboardRouteSelection({
      requestedSection: "not-a-section",
      navigationSections: enabledSidebarNavigation(),
    });

    expect(selection).toMatchObject({
      sectionKey: "matters",
      status: "unknown",
      entry: null,
    });
    expect(isUnavailableDashboardRouteSelection(selection)).toBe(true);
  });

  it("keeps the default entry aligned with the first enabled fallback section", () => {
    const navigationSections = enabledSidebarNavigation().map((section) =>
      section.key === "matters" ? { ...section, enabled: false } : section,
    );

    expect(
      resolveDashboardRouteSelection({
        navigationSections,
      }),
    ).toMatchObject({
      sectionKey: "contacts",
      status: "default",
      entry: expect.objectContaining({ id: "contacts", sectionKey: "contacts" }),
    });
  });

  it("marks disabled sidebar entries unavailable without hydrating them", () => {
    const navigationSections = enabledSidebarNavigation().map((section) =>
      section.key === "billing" ? { ...section, enabled: false } : section,
    );

    const selection = resolveDashboardRouteSelection({
      requestedSection: "billing",
      navigationSections,
    });

    expect(selection).toMatchObject({
      sectionKey: "matters",
      status: "disabled",
      entry: expect.objectContaining({ id: "billing" }),
    });
    expect(isUnavailableDashboardRouteSelection(selection)).toBe(true);
  });

  it("hydrates queue dashboard links as a real section", () => {
    expect(
      resolveDashboardRouteSelection({
        requestedSection: "queues",
        navigationSections: enabledSidebarNavigation(),
      }),
    ).toMatchObject({
      sectionKey: "queues",
      status: "matched",
      entry: expect.objectContaining({ id: "queues", showInSidebar: true }),
    });
  });

  it("keeps non-sidebar catalog entries from becoming active dashboard sections", () => {
    const nonSidebarEntries = routeCatalog.filter((entry) => !entry.showInSidebar);

    expect(nonSidebarEntries).toEqual([]);
  });

  it("classifies only blocked dashboard route selections as unavailable", () => {
    const navigationSections = enabledSidebarNavigation();
    const defaultSelection = resolveDashboardRouteSelection({ navigationSections });
    const matchedSelection = resolveDashboardRouteSelection({
      requestedSection: "queues",
      navigationSections,
    });
    const unknownSelection = resolveDashboardRouteSelection({
      requestedSection: "not-a-section",
      navigationSections,
    });
    const disabledSelection = resolveDashboardRouteSelection({
      requestedSection: "queues",
      navigationSections: navigationSections.map((section) =>
        section.key === "queues" ? { ...section, enabled: false } : section,
      ),
    });

    expect(isUnavailableDashboardRouteSelection(defaultSelection)).toBe(false);
    expect(isUnavailableDashboardRouteSelection(matchedSelection)).toBe(false);
    expect(isUnavailableDashboardRouteSelection(unknownSelection)).toBe(true);
    expect(isUnavailableDashboardRouteSelection(disabledSelection)).toBe(true);
    expect(isUnavailableDashboardRouteSelection({ status: "non_sidebar" })).toBe(true);
  });

  it("locks first-touch dashboard expectations for legal workflow roles", () => {
    const roleMatrix: Array<{
      role: string;
      billingCanView: boolean;
      shareLinksEnabled: boolean;
      externalUploadsEnabled: boolean;
      capabilitySections: RouteCatalogSectionCapability[];
      expected: Record<string, "matched" | "disabled">;
    }> = [
      {
        role: "owner-with-provider-config-absent",
        billingCanView: true,
        shareLinksEnabled: false,
        externalUploadsEnabled: false,
        capabilitySections: [
          { key: "matters", enabled: true },
          { key: "funds", enabled: true },
          { key: "documents", enabled: true },
          { key: "research", enabled: true },
          { key: "intake", enabled: true },
          { key: "billing", enabled: true },
          { key: "reports", enabled: true },
          { key: "audit", enabled: true },
        ],
        expected: {
          matters: "matched",
          communications: "matched",
          funds: "matched",
          billing: "matched",
          research: "matched",
          intake: "matched",
          audit: "matched",
          reports: "matched",
          admin: "disabled",
          shares: "disabled",
          externalUploads: "disabled",
        },
      },
      {
        role: "licensee-with-provider-config-absent",
        billingCanView: false,
        shareLinksEnabled: false,
        externalUploadsEnabled: false,
        capabilitySections: [
          { key: "matters", enabled: true },
          { key: "documents", enabled: true },
          { key: "research", enabled: true },
          { key: "intake", enabled: true },
          { key: "audit", enabled: true },
        ],
        expected: {
          matters: "matched",
          communications: "matched",
          documents: "matched",
          research: "matched",
          intake: "matched",
          audit: "matched",
          reports: "disabled",
          admin: "disabled",
          billing: "disabled",
          shares: "disabled",
          externalUploads: "disabled",
        },
      },
      {
        role: "firm-member-with-provider-config-absent",
        billingCanView: false,
        shareLinksEnabled: false,
        externalUploadsEnabled: false,
        capabilitySections: [
          { key: "matters", enabled: true },
          { key: "documents", enabled: true },
          { key: "intake", enabled: true },
        ],
        expected: {
          matters: "matched",
          communications: "matched",
          funds: "disabled",
          billing: "disabled",
          documents: "matched",
          research: "disabled",
          intake: "matched",
          shares: "disabled",
          externalUploads: "disabled",
          audit: "disabled",
          reports: "disabled",
          admin: "disabled",
        },
      },
    ];

    for (const role of roleMatrix) {
      const navigationSections = buildSidebarNavigationSections(role);
      for (const [section, status] of Object.entries(role.expected)) {
        expect(
          resolveDashboardRouteSelection({
            requestedSection: section,
            navigationSections,
          }).status,
          `${role.role} ${section}`,
        ).toBe(status);
      }
    }
  });
});
