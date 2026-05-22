import { describe, expect, it } from "vitest";
import {
  buildSidebarNavigationSections,
  buildDashboardSectionUrl,
  getDashboardSectionPath,
  getRouteCatalogEntry,
  getRoutesByArea,
  getSidebarRouteCatalogEntries,
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
    enabled: true,
    requiresMatterContext: entry.requiresMatterContext,
  }));
}

describe("Open Practice route catalog", () => {
  it("contains the first legal-practice workspace surfaces", () => {
    const routeIds = routeCatalog.map((entry) => entry.id);
    const expected: OpenPracticeRouteId[] = [
      "matters",
      "contacts",
      "funds",
      "billing",
      "documents",
      "shares",
      "externalUploads",
      "drafting",
      "calendar",
      "signatures",
      "intake",
      "audit",
      "queues",
    ];

    expect(routeIds).toEqual(expected);
  });

  it("looks up entries by id and exposes stable dashboard paths", () => {
    expect(getRouteCatalogEntry("billing")).toMatchObject({
      title: "Billing",
      path: "/?section=billing",
      area: "finance",
    });
    expect(getDashboardSectionPath("billing")).toBe("/?section=billing");
    expect(buildDashboardSectionUrl("http://localhost:3000/?matter=one#detail", "billing")).toBe(
      "/?matter=one&section=billing#detail",
    );
  });

  it("groups routes by area in display order", () => {
    expect(getRoutesByArea("finance").map((entry) => entry.id)).toEqual(["funds", "billing"]);
    expect(getRoutesByArea("operations").map((entry) => entry.id)).toEqual([
      "shares",
      "signatures",
      "intake",
      "queues",
    ]);
    expect(getRoutesByArea("workspace").map((entry) => entry.id)).toEqual([
      "matters",
      "contacts",
      "documents",
      "externalUploads",
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
      "funds",
      "billing",
      "documents",
      "shares",
      "externalUploads",
      "drafting",
      "calendar",
      "signatures",
      "intake",
      "audit",
      "queues",
    ]);
  });

  it("matches dashboard section URLs without changing runtime behavior", () => {
    expect(matchRouteCatalogEntry("/")?.id).toBe("matters");
    expect(matchRouteCatalogEntry("/?section=contacts")?.id).toBe("contacts");
    expect(matchRouteCatalogEntry("/?section=documents")?.id).toBe("documents");
    expect(matchRouteCatalogEntry("/?section=shares")?.id).toBe("shares");
    expect(matchRouteCatalogEntry("/?section=externalUploads")?.id).toBe("externalUploads");
    expect(matchRouteCatalogEntry("/?section=drafting")?.id).toBe("drafting");
    expect(matchRouteCatalogEntry("/?section=calendar")?.id).toBe("calendar");
    expect(matchRouteCatalogEntry("/?section=queues")?.id).toBe("queues");
    expect(matchRouteCatalogEntry("/?section=unknown")).toBeNull();
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

  it("falls back to matters for unknown dashboard sections", () => {
    expect(
      resolveDashboardRouteSelection({
        requestedSection: "not-a-section",
        navigationSections: enabledSidebarNavigation(),
      }),
    ).toMatchObject({
      sectionKey: "matters",
      status: "unknown",
      entry: null,
    });
  });

  it("does not hydrate disabled sidebar entries", () => {
    const navigationSections = enabledSidebarNavigation().map((section) =>
      section.key === "billing" ? { ...section, enabled: false } : section,
    );

    expect(
      resolveDashboardRouteSelection({
        requestedSection: "billing",
        navigationSections,
      }),
    ).toMatchObject({
      sectionKey: "matters",
      status: "disabled",
      entry: expect.objectContaining({ id: "billing" }),
    });
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
          { key: "intake", enabled: true },
          { key: "billing", enabled: true },
          { key: "audit", enabled: true },
        ],
        expected: {
          matters: "matched",
          funds: "matched",
          billing: "matched",
          intake: "matched",
          audit: "matched",
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
          { key: "intake", enabled: true },
          { key: "audit", enabled: true },
        ],
        expected: {
          matters: "matched",
          documents: "matched",
          intake: "matched",
          audit: "matched",
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
          funds: "disabled",
          billing: "disabled",
          documents: "matched",
          intake: "matched",
          shares: "disabled",
          externalUploads: "disabled",
          audit: "disabled",
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
