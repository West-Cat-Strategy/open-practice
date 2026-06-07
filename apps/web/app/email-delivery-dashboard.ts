import type { EmailDeliveryHistoryItem } from "./_features/email-delivery/models";

export function describeEmailDeliveryState(email: EmailDeliveryHistoryItem): {
  label: string;
  tone?: "risk";
} {
  if (email.status === "failed") return { label: "failed", tone: "risk" };
  if (email.status === "sent") return { label: "sent" };
  if (email.status === "sending") return { label: "sending" };
  return { label: email.status.replaceAll("_", " ") };
}
