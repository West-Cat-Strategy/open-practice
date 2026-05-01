import { describe, expect, it } from "vitest";
import {
  getRouteCatalogEntry,
  getRoutesByArea,
  getSidebarRouteCatalogEntries,
  matchRouteCatalogEntry,
  routeCatalog,
  type OpenPracticeRouteId,
} from "./routeCatalog";

describe("Open Practice route catalog", () => {
  it("contains the first legal-practice workspace surfaces", () => {
    const routeIds = routeCatalog.map((entry) => entry.id);
    const expected: OpenPracticeRouteId[] = [
      "matters",
      "funds",
      "billing",
      "documents",
      "shares",
      "drafting",
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
      "drafting",
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
      "drafting",
      "signatures",
      "intake",
      "audit",
    ]);
  });

  it("matches dashboard section URLs without changing runtime behavior", () => {
    expect(matchRouteCatalogEntry("/")?.id).toBe("matters");
    expect(matchRouteCatalogEntry("/?section=documents")?.id).toBe("documents");
    expect(matchRouteCatalogEntry("/?section=shares")?.id).toBe("shares");
    expect(matchRouteCatalogEntry("/?section=drafting")?.id).toBe("drafting");
    expect(matchRouteCatalogEntry("/?section=unknown")).toBeNull();
  });
});
