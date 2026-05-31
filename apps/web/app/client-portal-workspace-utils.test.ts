import { describe, expect, it } from "vitest";
import {
  clientPortalAccessLabel,
  clientPortalActionFamilyLabel,
  clientPortalAttentionCount,
  clientPortalMatterActionLabel,
} from "./client-portal-workspace-utils";
import type { ClientPortalWorkspaceResponse } from "./types";

const workspace: ClientPortalWorkspaceResponse = {
  account: {
    id: "client-001",
    displayName: "Ada Morgan",
    email: "ada@example.test",
    role: "client_external",
  },
  access: {
    posture: "active",
    activeGrantCount: 1,
    matterCount: 1,
    permissions: ["view_documents", "upload_documents"],
  },
  matters: [
    {
      id: "matter-001",
      number: "2026-0001",
      title: "Synthetic matter",
      status: "open",
      permissions: ["view_documents"],
      actionCount: 2,
    },
  ],
  actions: [
    {
      id: "external-upload:001",
      family: "external_upload",
      matterId: "matter-001",
      title: "Upload requested documents",
      detail: "One upload remains.",
      status: "active",
      tone: "risk",
    },
    {
      id: "receipt:001",
      family: "receipt",
      matterId: "matter-001",
      title: "Email receipt status",
      detail: "Recorded.",
      status: "recorded",
      tone: "ready",
    },
  ],
};

describe("client portal workspace helpers", () => {
  it("labels account posture and action families without leaking implementation names", () => {
    expect(clientPortalAccessLabel(workspace.access)).toBe("1 active grant across 1 matter");
    expect(clientPortalActionFamilyLabel("secure_share")).toBe("Secure share");
    expect(clientPortalActionFamilyLabel("client_update")).toBe("Client update");
    expect(clientPortalActionFamilyLabel("client_action")).toBe("Client action");
  });

  it("summarizes attention and matter action counts", () => {
    expect(clientPortalAttentionCount(workspace)).toBe(1);
    expect(clientPortalMatterActionLabel(1)).toBe("1 action");
    expect(clientPortalMatterActionLabel(2)).toBe("2 actions");
  });
});
