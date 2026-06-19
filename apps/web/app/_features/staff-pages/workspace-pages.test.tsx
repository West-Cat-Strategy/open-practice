import { describe, expect, it } from "vitest";

import { workspaceStaffPageDefinitions, workspaceStaffPageMetadata } from "./workspace-pages";

describe("workspace staff pages", () => {
  it("declares canonical workspace pages by stable key", () => {
    expect(Object.keys(workspaceStaffPageDefinitions)).toEqual([
      "matters",
      "contacts",
      "communications",
      "documents",
      "research",
      "drafting",
      "calendar",
    ]);
    expect(workspaceStaffPageDefinitions.documents.canonicalPath).toBe("/workspace/documents");
    expect(workspaceStaffPageDefinitions.calendar.componentName).toBe("WorkspaceCalendarPage");
  });

  it("keeps every workspace page mapped to a canonical section", () => {
    expect(
      Object.values(workspaceStaffPageDefinitions).map((definition) => [
        definition.key,
        definition.sectionKey,
        definition.canonicalPath,
      ]),
    ).toEqual([
      ["matters", "matters", "/workspace/matters"],
      ["contacts", "contacts", "/workspace/contacts"],
      ["communications", "communications", "/workspace/communications"],
      ["documents", "documents", "/workspace/documents"],
      ["research", "research", "/workspace/research"],
      ["drafting", "drafting", "/workspace/drafting"],
      ["calendar", "calendar", "/workspace/calendar"],
    ]);
  });

  it("keeps communications canonical while preserving legacy dashboard links", () => {
    expect(workspaceStaffPageDefinitions.communications.currentDashboardHref).toBe(
      "/?section=communications",
    );
    expect(workspaceStaffPageDefinitions.communications.currentDashboardLabel).toBe(
      "Matter communications",
    );
    expect(workspaceStaffPageMetadata.communications.title).toBe(
      "Communications | Open Practice Workspace",
    );
  });
});
