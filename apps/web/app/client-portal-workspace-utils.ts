import type { ClientPortalActionFamily, ClientPortalWorkspaceResponse } from "./types";

export function clientPortalActionFamilyLabel(family: ClientPortalActionFamily): string {
  const labels: Record<ClientPortalActionFamily, string> = {
    secure_share: "Secure share",
    external_upload: "External upload",
    intake: "Intake",
    guest_session: "Guest session",
    receipt: "Receipt",
    client_update: "Client update",
    client_action: "Client action",
  };
  return labels[family];
}

export function clientPortalAccessLabel(access: ClientPortalWorkspaceResponse["access"]): string {
  if (access.posture === "active") {
    return `${access.activeGrantCount} active grant${
      access.activeGrantCount === 1 ? "" : "s"
    } across ${access.matterCount} matter${access.matterCount === 1 ? "" : "s"}`;
  }
  return "No active portal grants";
}

export function clientPortalAttentionCount(workspace: ClientPortalWorkspaceResponse): number {
  return workspace.actions.filter((action) => action.tone === "risk").length;
}

export function clientPortalMatterActionLabel(actionCount: number): string {
  return `${actionCount} action${actionCount === 1 ? "" : "s"}`;
}
