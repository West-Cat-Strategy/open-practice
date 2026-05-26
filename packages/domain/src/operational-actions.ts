export type OperationalActionAvailability = "available" | "disabled";
export type OperationalActionTone = "neutral" | "ready" | "risk";

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
