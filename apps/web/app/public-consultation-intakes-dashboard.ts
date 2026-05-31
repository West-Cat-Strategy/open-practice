import {
  describeOperationalActionState,
  disabledOperationalAction,
  type OperationalActionState,
} from "@open-practice/domain/operational-actions";
import type {
  PublicConsultationDashboardResponse,
  PublicConsultationIntake,
  PublicConsultationIntakeSettings,
} from "./types";

export type PublicConsultationReviewAction = "conflict_check" | "dismiss" | "convert";
export type PublicConsultationReviewBusyAction = PublicConsultationReviewAction | "other";

const publicConsultationReviewActions = [
  "conflict_check",
  "dismiss",
  "convert",
] as const satisfies readonly PublicConsultationReviewAction[];

const publicConsultationReviewActionDescriptors: Record<
  PublicConsultationReviewAction,
  {
    actionKey: string;
    label: string;
    busyLabel: string;
  }
> = {
  conflict_check: {
    actionKey: "public_consultation_intake.conflict_check",
    label: "Conflict check",
    busyLabel: "Checking...",
  },
  dismiss: {
    actionKey: "public_consultation_intake.dismiss",
    label: "Dismiss",
    busyLabel: "Dismissing...",
  },
  convert: {
    actionKey: "public_consultation_intake.convert",
    label: "Convert to intake matter",
    busyLabel: "Converting...",
  },
};

export function buildPublicConsultationIntakesPath(status = "pending"): string {
  return `/api/public-consultation-intakes?status=${encodeURIComponent(status)}`;
}

export function buildPublicConsultationIntakeSettingsPath(): string {
  return "/api/public-consultation-intakes/settings";
}

export function buildPublicConsultationIntakeDismissPath(intakeId: string): string {
  return `/api/public-consultation-intakes/${encodeURIComponent(intakeId)}/dismiss`;
}

export function buildPublicConsultationIntakeConvertPath(intakeId: string): string {
  return `/api/public-consultation-intakes/${encodeURIComponent(intakeId)}/convert`;
}

export function publicConsultationReviewBusyKey(
  action: PublicConsultationReviewAction,
  intakeId: string,
): string {
  return `${action}:${intakeId}`;
}

export function publicConsultationReviewBusyAction(
  busyKey: string,
  intakeId: string,
): PublicConsultationReviewBusyAction | undefined {
  if (!busyKey) return undefined;
  for (const action of publicConsultationReviewActions) {
    if (busyKey === publicConsultationReviewBusyKey(action, intakeId)) return action;
  }
  return busyKey.endsWith(`:${intakeId}`) ? "other" : undefined;
}

export function compactPublicConsultationReviewActionReason(value?: string): string {
  if (!value) return "available";
  const labels: Record<string, string> = {
    conflict_check_in_progress: "conflict check in progress",
    dismiss_in_progress: "dismiss in progress",
    convert_in_progress: "convert in progress",
    review_action_in_progress: "review action in progress",
    permission_required: "permission required",
    review_unavailable: "review unavailable",
    status_not_pending: "not pending",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function describePublicConsultationReviewAction(input: {
  action: PublicConsultationReviewAction;
  intake: Pick<PublicConsultationIntake, "id" | "status">;
  dashboardStatus: PublicConsultationDashboardResponse["status"];
  busyAction?: PublicConsultationReviewBusyAction;
}): OperationalActionState {
  const descriptor = publicConsultationReviewActionDescriptors[input.action];
  const sameActionBusy = input.busyAction === input.action;
  const anyActionBusy = input.busyAction !== undefined;
  return describeOperationalActionState({
    actionKey: descriptor.actionKey,
    label: descriptor.label,
    availableTone: input.action === "dismiss" ? "neutral" : "ready",
    disabledWhen: [
      sameActionBusy &&
        disabledOperationalAction(`${input.action}_in_progress`, {
          label: descriptor.busyLabel,
        }),
      anyActionBusy && disabledOperationalAction("review_action_in_progress"),
      input.dashboardStatus === "access_denied" && disabledOperationalAction("permission_required"),
      input.dashboardStatus === "unavailable" && disabledOperationalAction("review_unavailable"),
      input.intake.status !== "pending" && disabledOperationalAction("status_not_pending"),
    ],
  });
}

export const defaultPublicConsultationSettings: PublicConsultationIntakeSettings = {
  enabled: false,
  senderAddress: "",
  recipientEmails: [],
  allowedOrigins: [],
};

export function emptyPublicConsultationDashboard(
  status: PublicConsultationDashboardResponse["status"] = "unavailable",
): PublicConsultationDashboardResponse {
  return {
    settings: defaultPublicConsultationSettings,
    intakes: [],
    status,
  };
}

export function publicConsultationSettingsControlDisabled(
  status: PublicConsultationDashboardResponse["status"],
): boolean {
  return status === "access_denied";
}

export function upsertPublicConsultationIntake(
  intakes: PublicConsultationIntake[],
  intake: PublicConsultationIntake,
): PublicConsultationIntake[] {
  return intakes.some((candidate) => candidate.id === intake.id)
    ? intakes.map((candidate) => (candidate.id === intake.id ? intake : candidate))
    : [intake, ...intakes];
}

export function splitPublicConsultationList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

export function buildPublicConsultationSettingsPayload(input: {
  enabled: boolean;
  senderAddress: string;
  recipientEmailsText: string;
  allowedOriginsText: string;
  reviewOwnerUserId: string;
}): { payload: PublicConsultationIntakeSettings } | { error: string } {
  const senderAddress = input.senderAddress.trim();
  const recipientEmails = splitPublicConsultationList(input.recipientEmailsText);
  const allowedOrigins = splitPublicConsultationList(input.allowedOriginsText);
  if (
    input.enabled &&
    (!senderAddress || recipientEmails.length === 0 || allowedOrigins.length === 0)
  ) {
    return {
      error: "Settings save failed: sender, recipients, and origins are required when enabled.",
    };
  }
  return {
    payload: {
      enabled: input.enabled,
      senderAddress,
      recipientEmails,
      allowedOrigins,
      reviewOwnerUserId: input.reviewOwnerUserId.trim() || undefined,
    },
  };
}

export function publicConsultationOpposingParties(intake: PublicConsultationIntake): string {
  return intake.opposingPartyNames.length > 0 ? intake.opposingPartyNames.join(", ") : "none";
}

export function publicConsultationSettingsSummary(
  settings: PublicConsultationIntakeSettings,
): string {
  const sender = settings.senderAddress || "sender not configured";
  const recipients =
    settings.recipientEmails.length > 0
      ? `notify ${settings.recipientEmails.join(", ")}`
      : "recipients not configured";
  const originCount =
    settings.allowedOrigins.length === 1 ? "1 origin" : `${settings.allowedOrigins.length} origins`;
  return `${settings.enabled ? "enabled" : "disabled"} · ${sender} · ${recipients} · ${originCount}`;
}
