import { describe, expect, it } from "vitest";
import {
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
} from "./routeCatalog";

function enabledSidebarNavigation(): OpenPracticeSidebarNavigationSection[] {
  return getSidebarRouteCatalogEntries().map((entry) => ({
    key: entry.sectionKey ?? "matters",
    label: entry.shortLabel,
    enabled: true,
  }));
}

describe("Open Practice route catalog", () => {
  it("contains the first legal-practice workspace surfaces", () => {
    const routeIds = routeCatalog.map((entry) => entry.id);
    const expected: OpenPracticeRouteId[] = [
      "matters",
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
      "documents",
      "externalUploads",
      "drafting",
      "calendar",
    ]);
  });

  it("keeps queues cataloged without showing it in the sidebar order", () => {
    expect(getRouteCatalogEntry("queues")).toMatchObject({
      title: "Operational Queues",
      showInSidebar: false,
    });
    expect(getSidebarRouteCatalogEntries().map((entry) => entry.id)).toEqual([
      "matters",
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
    ]);
  });

  it("matches dashboard section URLs without changing runtime behavior", () => {
    expect(matchRouteCatalogEntry("/")?.id).toBe("matters");
    expect(matchRouteCatalogEntry("/?section=documents")?.id).toBe("documents");
    expect(matchRouteCatalogEntry("/?section=shares")?.id).toBe("shares");
    expect(matchRouteCatalogEntry("/?section=externalUploads")?.id).toBe("externalUploads");
    expect(matchRouteCatalogEntry("/?section=drafting")?.id).toBe("drafting");
    expect(matchRouteCatalogEntry("/?section=calendar")?.id).toBe("calendar");
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

  it("keeps queues and non-sidebar catalog entries from becoming active dashboard sections", () => {
    const nonSidebarEntries = routeCatalog.filter((entry) => !entry.showInSidebar);

    expect(nonSidebarEntries.map((entry) => entry.id)).toEqual(["queues"]);
    expect(
      resolveDashboardRouteSelection({
        requestedSection: "queues",
        navigationSections: enabledSidebarNavigation(),
      }),
    ).toMatchObject({
      sectionKey: "matters",
      status: "queue",
      entry: expect.objectContaining({ id: "queues", showInSidebar: false }),
    });
  });
});
