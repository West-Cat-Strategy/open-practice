import type {
  EmailDeliveryHandoffSummary,
  EmailDeliveryHistoryItem,
} from "./_features/email-delivery/models";
import { buildEmailDeliveryConfirmation, type DeliveryConfirmationPayload } from "./types";

export function describeEmailDeliveryState(email: EmailDeliveryHistoryItem): {
  label: string;
  detail: string;
  retryEligible: boolean;
  tone?: "risk";
} {
  const handoff = describeEmailDeliveryHandoff(email);
  return {
    label: handoff.label,
    detail: handoff.detail,
    retryEligible: handoff.retryEligible,
    tone: handoff.tone,
  };
}

export function describeEmailDeliveryHandoff(
  email: EmailDeliveryHistoryItem,
): EmailDeliveryHandoffSummary {
  if (email.status === "failed") {
    return {
      status: "retry_available",
      label: "retry handoff",
      detail:
        "Failed delivery can be retried by staff after confirming recipients; no automatic send starts from the dashboard summary.",
      retryEligible: true,
      requiresConfirmation: true,
      tone: "risk",
    };
  }
  if (email.status === "sent") {
    return {
      status: "delivered",
      label: "sent",
      detail: "Delivery is complete; no retry handoff is available.",
      retryEligible: false,
      requiresConfirmation: false,
    };
  }
  if (email.status === "queued" || email.status === "sending") {
    return {
      status: "delivery_in_progress",
      label: email.status.replaceAll("_", " "),
      detail: "Delivery is already in progress; staff retry remains disabled.",
      retryEligible: false,
      requiresConfirmation: false,
    };
  }
  if (email.status === "cancelled") {
    return {
      status: "cancelled",
      label: "cancelled",
      detail: "Cancelled delivery records are not retried from the staff handoff.",
      retryEligible: false,
      requiresConfirmation: false,
    };
  }
  return {
    status: "review_required",
    label: email.status.replaceAll("_", " "),
    detail: "Review delivery status before taking any staff handoff action.",
    retryEligible: false,
    requiresConfirmation: false,
  };
}

export function buildEmailDeliveryRetryPath(emailId: string): string {
  return `/api/mail/outbox/${encodeURIComponent(emailId)}/retry`;
}

export function buildEmailDeliveryRetryPayload(input: {
  matterId: string;
  recipientCount: number;
  idempotencyKey?: string;
}): {
  matterId: string;
  idempotencyKey?: string;
  deliveryConfirmation: DeliveryConfirmationPayload;
} {
  return {
    matterId: input.matterId,
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    deliveryConfirmation: buildEmailDeliveryConfirmation(input.recipientCount),
  };
}
