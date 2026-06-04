import type {
  ClientPortalActionFamily,
  ClientPortalMatterBillingGroup,
  ClientPortalMatterActionGroup,
  ClientPortalWorkspaceResponse,
} from "./types";

export function clientPortalActionFamilyLabel(family: ClientPortalActionFamily): string {
  const labels: Record<ClientPortalActionFamily, string> = {
    secure_share: "Secure share",
    external_upload: "External upload",
    intake: "Intake",
    guest_session: "Guest session",
    receipt: "Receipt",
    client_update: "Client update",
    client_action: "Client action",
    payment_request: "Payment request",
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

export function clientPortalMoneyLabel(amountCents: number, currency = "CAD"): string {
  return `${currency} ${(amountCents / 100).toFixed(2)}`;
}

export function clientPortalMatterActionGroups(
  workspace: ClientPortalWorkspaceResponse,
): ClientPortalMatterActionGroup[] {
  const visibleMatterIds = new Set(workspace.matters.map((matter) => matter.id));
  if (workspace.matterActions && workspace.matterActions.length > 0) {
    return workspace.matterActions.filter((group) => visibleMatterIds.has(group.matterId));
  }
  return workspace.matters.map((matter) => {
    const actions = workspace.actions.filter((action) => action.matterId === matter.id);
    return {
      matterId: matter.id,
      matterNumber: matter.number,
      matterTitle: matter.title,
      actionCount: actions.length,
      attentionCount: actions.filter((action) => action.tone === "risk").length,
      actions,
    };
  });
}

export function clientPortalMatterBillingGroups(
  workspace: ClientPortalWorkspaceResponse,
): ClientPortalMatterBillingGroup[] {
  const visibleMatterIds = new Set(workspace.matters.map((matter) => matter.id));
  return (workspace.billing?.matterBills ?? []).filter((group) =>
    visibleMatterIds.has(group.matterId),
  );
}
