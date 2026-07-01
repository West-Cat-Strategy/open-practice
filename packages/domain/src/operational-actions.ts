import type { LedgerPostingRequestStatus } from "./ledger.js";
import type { LegalResearchArtifactStatus, LegalResearchReviewDecision } from "./legal-research.js";
import type { ReviewAgingDecision } from "./review-aging.js";

export type OperationalActionAvailability = "available" | "disabled";
export type OperationalActionTone = "neutral" | "ready" | "risk";
export type CalendarSchedulingAgingReviewAction = ReviewAgingDecision;
export type CalendarSchedulingAgingReviewBusyAction = CalendarSchedulingAgingReviewAction | "other";
export type DocumentRetentionHoldReviewAction = "record_review";
export type DocumentRetentionHoldReviewBusyAction = DocumentRetentionHoldReviewAction | "other";
export type LegalResearchArtifactReviewAction = LegalResearchReviewDecision;
export type LegalResearchArtifactReviewBusyAction = LegalResearchArtifactReviewAction | "other";
export type LegalResearchReviewWorkspaceStatus = "available" | "access_denied" | "unavailable";
export type TrustPostingRequestReviewAction = "approved" | "rejected";
export type TrustPostingRequestReviewBusyAction = TrustPostingRequestReviewAction | "other";
export type MatterLifecycleReviewAction = "record_review";

export interface OperationalActionDisabledCondition {
  reason: string;
  label?: string;
  ariaLabel?: string;
  tone?: OperationalActionTone;
}

export interface OperationalActionState {
  actionKey: string;
  available: boolean;
  availability: OperationalActionAvailability;
  label: string;
  ariaLabel?: string;
  disabledReason?: string;
  tone: OperationalActionTone;
}

export interface OperationalActionStateInput {
  actionKey: string;
  label: string;
  ariaLabel?: string;
  availableLabel?: string;
  availableAriaLabel?: string;
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
    const ariaLabel = disabledCondition.ariaLabel ?? input.ariaLabel;
    return {
      actionKey: input.actionKey,
      available: false,
      availability: "disabled",
      label: disabledCondition.label ?? input.label,
      ...(ariaLabel ? { ariaLabel } : {}),
      disabledReason: disabledCondition.reason,
      tone: disabledCondition.tone ?? input.defaultDisabledTone ?? "neutral",
    };
  }

  const ariaLabel = input.availableAriaLabel ?? input.ariaLabel;
  return {
    actionKey: input.actionKey,
    available: true,
    availability: "available",
    label: input.availableLabel ?? input.label,
    ...(ariaLabel ? { ariaLabel } : {}),
    tone: input.availableTone ?? "ready",
  };
}

const calendarSchedulingAgingReviewActions = [
  "acknowledged",
  "follow_up_required",
  "defer_review",
] as const satisfies readonly CalendarSchedulingAgingReviewAction[];

const calendarSchedulingAgingReviewActionDescriptors: Record<
  CalendarSchedulingAgingReviewAction,
  {
    actionKey: string;
    label: string;
    ariaLabel: string;
    availableTone: OperationalActionTone;
  }
> = {
  acknowledged: {
    actionKey: "calendar_scheduling_aging_review.acknowledge",
    label: "Acknowledge",
    ariaLabel: "Acknowledge scheduling request aging review",
    availableTone: "ready",
  },
  follow_up_required: {
    actionKey: "calendar_scheduling_aging_review.follow_up_required",
    label: "Follow up",
    ariaLabel: "Mark scheduling request follow-up required",
    availableTone: "ready",
  },
  defer_review: {
    actionKey: "calendar_scheduling_aging_review.defer",
    label: "Defer",
    ariaLabel: "Defer scheduling request aging review",
    availableTone: "neutral",
  },
};

export function calendarSchedulingAgingReviewBusyKey(
  action: CalendarSchedulingAgingReviewAction,
  schedulingRequestId: string,
): string {
  return `${schedulingRequestId}:aging:${action}`;
}

export function calendarSchedulingAgingReviewBusyAction(
  busyKey: string,
  schedulingRequestId: string,
): CalendarSchedulingAgingReviewBusyAction | undefined {
  if (!busyKey) return undefined;
  for (const action of calendarSchedulingAgingReviewActions) {
    if (busyKey === calendarSchedulingAgingReviewBusyKey(action, schedulingRequestId)) {
      return action;
    }
  }
  return busyKey.startsWith(`${schedulingRequestId}:aging:`) ? "other" : undefined;
}

export function compactCalendarSchedulingAgingReviewActionReason(value?: string): string {
  if (!value) return "available";
  const labels: Record<string, string> = {
    acknowledged_in_progress: "acknowledgement in progress",
    follow_up_required_in_progress: "follow-up review in progress",
    defer_review_in_progress: "deferral in progress",
    aging_review_action_in_progress: "aging review action in progress",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function describeCalendarSchedulingAgingReviewAction(input: {
  action: CalendarSchedulingAgingReviewAction;
  busyAction?: CalendarSchedulingAgingReviewBusyAction;
}): OperationalActionState {
  const descriptor = calendarSchedulingAgingReviewActionDescriptors[input.action];
  const sameActionBusy = input.busyAction === input.action;
  const anyActionBusy = input.busyAction !== undefined;

  return describeOperationalActionState({
    actionKey: descriptor.actionKey,
    label: descriptor.label,
    ariaLabel: descriptor.ariaLabel,
    availableTone: descriptor.availableTone,
    disabledWhen: [
      sameActionBusy && disabledOperationalAction(`${input.action}_in_progress`),
      anyActionBusy && disabledOperationalAction("aging_review_action_in_progress"),
    ],
  });
}

const matterLifecycleReviewActionDescriptors: Record<
  MatterLifecycleReviewAction,
  {
    actionKey: string;
    label: string;
    busyLabel: string;
    availableTone: OperationalActionTone;
  }
> = {
  record_review: {
    actionKey: "matter_lifecycle_review.record",
    label: "Record review",
    busyLabel: "Recording",
    availableTone: "ready",
  },
};

export function compactMatterLifecycleReviewActionReason(value?: string): string {
  if (!value) return "available";
  const labels: Record<string, string> = {
    permission_required: "permission required",
    record_review_in_progress: "record review in progress",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function describeMatterLifecycleReviewAction(input: {
  action: MatterLifecycleReviewAction;
  canRecord: boolean;
  recording: boolean;
}): OperationalActionState {
  const descriptor = matterLifecycleReviewActionDescriptors[input.action];

  return describeOperationalActionState({
    actionKey: descriptor.actionKey,
    label: descriptor.label,
    availableTone: descriptor.availableTone,
    disabledWhen: [
      input.recording &&
        disabledOperationalAction("record_review_in_progress", {
          label: descriptor.busyLabel,
        }),
      !input.canRecord && disabledOperationalAction("permission_required"),
    ],
  });
}

const legalResearchArtifactReviewActions = [
  "reviewed",
  "rejected",
] as const satisfies readonly LegalResearchArtifactReviewAction[];

const legalResearchArtifactReviewActionDescriptors: Record<
  LegalResearchArtifactReviewAction,
  {
    actionKey: string;
    label: string;
    busyLabel: string;
    availableTone: OperationalActionTone;
  }
> = {
  reviewed: {
    actionKey: "legal_research_artifact.review",
    label: "Review",
    busyLabel: "Saving",
    availableTone: "ready",
  },
  rejected: {
    actionKey: "legal_research_artifact.reject",
    label: "Reject",
    busyLabel: "Saving",
    availableTone: "risk",
  },
};

export function legalResearchArtifactReviewBusyKey(
  action: LegalResearchArtifactReviewAction,
  artifactId: string,
): string {
  return `${action}:${artifactId}`;
}

export function legalResearchArtifactReviewBusyAction(
  busyKey: string,
  artifactId: string,
): LegalResearchArtifactReviewBusyAction | undefined {
  if (!busyKey) return undefined;
  for (const action of legalResearchArtifactReviewActions) {
    if (busyKey === legalResearchArtifactReviewBusyKey(action, artifactId)) return action;
  }
  return busyKey.endsWith(`:${artifactId}`) ? "other" : undefined;
}

export function compactLegalResearchArtifactReviewActionReason(value?: string): string {
  if (!value) return "available";
  const labels: Record<string, string> = {
    reviewed_in_progress: "review in progress",
    rejected_in_progress: "rejection in progress",
    review_action_in_progress: "review action in progress",
    permission_required: "permission required",
    status_not_ready_for_review: "not ready for review",
    workspace_unavailable: "workspace unavailable",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function describeLegalResearchArtifactReviewAction(input: {
  action: LegalResearchArtifactReviewAction;
  status: LegalResearchArtifactStatus;
  busyAction?: LegalResearchArtifactReviewBusyAction;
  canReview: boolean;
  workspaceStatus: LegalResearchReviewWorkspaceStatus;
}): OperationalActionState {
  const descriptor = legalResearchArtifactReviewActionDescriptors[input.action];
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
      !input.canReview && disabledOperationalAction("permission_required"),
      input.status !== "ready_for_review" &&
        disabledOperationalAction("status_not_ready_for_review"),
      input.workspaceStatus !== "available" && disabledOperationalAction("workspace_unavailable"),
    ],
  });
}

const documentRetentionHoldReviewActionDescriptors: Record<
  DocumentRetentionHoldReviewAction,
  {
    actionKey: string;
    busyLabel: string;
    availableTone: OperationalActionTone;
  }
> = {
  record_review: {
    actionKey: "document_retention_hold_review.record",
    busyLabel: "Recording",
    availableTone: "ready",
  },
};

export function compactDocumentRetentionHoldReviewActionReason(value?: string): string {
  if (!value) return "available";
  const labels: Record<string, string> = {
    retention_hold_review_in_progress: "retention/hold review in progress",
    review_action_in_progress: "review action in progress",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function describeDocumentRetentionHoldReviewAction(input: {
  action: DocumentRetentionHoldReviewAction;
  label: string;
  busyAction?: DocumentRetentionHoldReviewBusyAction;
}): OperationalActionState {
  const descriptor = documentRetentionHoldReviewActionDescriptors[input.action];
  const sameActionBusy = input.busyAction === input.action;
  const anyActionBusy = input.busyAction !== undefined;

  return describeOperationalActionState({
    actionKey: descriptor.actionKey,
    label: input.label,
    availableTone: descriptor.availableTone,
    disabledWhen: [
      sameActionBusy &&
        disabledOperationalAction("retention_hold_review_in_progress", {
          label: descriptor.busyLabel,
        }),
      anyActionBusy && disabledOperationalAction("review_action_in_progress"),
    ],
  });
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
