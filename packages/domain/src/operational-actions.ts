import type { LedgerPostingRequestStatus } from "./ledger.js";

export type OperationalActionAvailability = "available" | "disabled";
export type OperationalActionTone = "neutral" | "ready" | "risk";
export type TrustPostingRequestReviewAction = "approved" | "rejected";
export type TrustPostingRequestReviewBusyAction = TrustPostingRequestReviewAction | "other";

export interface OperationalActionDisabledCondition {
  reason: string;
  label?: string;
  tone?: OperationalActionTone;
}

export interface OperationalActionState {
  actionKey: string;
  available: boolean;
  availability: OperationalActionAvailability;
  label: string;
  disabledReason?: string;
  tone: OperationalActionTone;
}

export interface OperationalActionStateInput {
  actionKey: string;
  label: string;
  availableLabel?: string;
  availableTone?: OperationalActionTone;
  defaultDisabledTone?: OperationalActionTone;
  disabledWhen?: Array<OperationalActionDisabledCondition | false | null | undefined>;
}

export function disabledOperationalAction(
  reason: string,
  options: Omit<OperationalActionDisabledCondition, "reason"> = {},
): OperationalActionDisabledCondition {
  return { reason, ...options };
}

function isDisabledCondition(
  condition: OperationalActionDisabledCondition | false | null | undefined,
): condition is OperationalActionDisabledCondition {
  return Boolean(condition);
}

export function describeOperationalActionState(
  input: OperationalActionStateInput,
): OperationalActionState {
  const disabledCondition = input.disabledWhen?.find(isDisabledCondition);
  if (disabledCondition) {
    return {
      actionKey: input.actionKey,
      available: false,
      availability: "disabled",
      label: disabledCondition.label ?? input.label,
      disabledReason: disabledCondition.reason,
      tone: disabledCondition.tone ?? input.defaultDisabledTone ?? "neutral",
    };
  }

  return {
    actionKey: input.actionKey,
    available: true,
    availability: "available",
    label: input.availableLabel ?? input.label,
    tone: input.availableTone ?? "ready",
  };
}

const trustPostingRequestReviewActions = [
  "approved",
  "rejected",
] as const satisfies readonly TrustPostingRequestReviewAction[];

const trustPostingRequestReviewActionDescriptors: Record<
  TrustPostingRequestReviewAction,
  {
    actionKey: string;
    label: string;
    busyLabel: string;
    availableTone: OperationalActionTone;
  }
> = {
  approved: {
    actionKey: "ledger_posting_request.approve",
    label: "Approve",
    busyLabel: "Approving",
    availableTone: "ready",
  },
  rejected: {
    actionKey: "ledger_posting_request.reject",
    label: "Reject",
    busyLabel: "Rejecting",
    availableTone: "risk",
  },
};

export function trustPostingRequestReviewBusyKey(
  action: TrustPostingRequestReviewAction,
  postingRequestId: string,
): string {
  return `${action}:${postingRequestId}`;
}

export function trustPostingRequestReviewBusyAction(
  busyKey: string,
  postingRequestId: string,
): TrustPostingRequestReviewBusyAction | undefined {
  if (!busyKey) return undefined;
  for (const action of trustPostingRequestReviewActions) {
    if (busyKey === trustPostingRequestReviewBusyKey(action, postingRequestId)) return action;
  }
  return busyKey.endsWith(`:${postingRequestId}`) ? "other" : undefined;
}

export function compactTrustPostingRequestReviewActionReason(value?: string): string {
  if (!value) return "available";
  const labels: Record<string, string> = {
    approved_in_progress: "approval in progress",
    rejected_in_progress: "rejection in progress",
    review_action_in_progress: "review action in progress",
    status_not_pending_approval: "not pending approval",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function describeTrustPostingRequestReviewAction(input: {
  action: TrustPostingRequestReviewAction;
  status: LedgerPostingRequestStatus;
  busyAction?: TrustPostingRequestReviewBusyAction;
}): OperationalActionState {
  const descriptor = trustPostingRequestReviewActionDescriptors[input.action];
  const sameActionBusy = input.busyAction === input.action;
  const anyActionBusy = input.busyAction !== undefined;

  return describeOperationalActionState({
    actionKey: descriptor.actionKey,
    label: descriptor.label,
    availableTone: descriptor.availableTone,
    disabledWhen: [
      sameActionBusy &&
        disabledOperationalAction(`${input.action}_in_progress`, {
          label: descriptor.busyLabel,
        }),
      anyActionBusy && disabledOperationalAction("review_action_in_progress"),
      input.status !== "pending_approval" &&
        disabledOperationalAction("status_not_pending_approval"),
    ],
  });
}
