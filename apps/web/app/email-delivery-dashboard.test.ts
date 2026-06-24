import { describe, expect, it } from "vitest";
import type { EmailDeliveryHistoryItem } from "./_features/email-delivery/models";
import {
  buildEmailDeliveryRetryPath,
  buildEmailDeliveryRetryPayload,
  describeEmailDeliveryHandoff,
  describeEmailDeliveryState,
} from "./email-delivery-dashboard";

function email(overrides: Partial<EmailDeliveryHistoryItem> = {}): EmailDeliveryHistoryItem {
  return {
    id: "email-synthetic-001",
    matterId: "matter-synthetic-001",
    templateKey: "client.update",
    status: "failed",
    recipientCount: 1,
    attemptCount: 3,
    queuedAt: "2026-06-20T10:00:00.000Z",
    lastAttemptAt: "2026-06-20T10:05:00.000Z",
    failedAt: "2026-06-20T10:05:00.000Z",
    terminalFailureAt: "2026-06-20T10:05:00.000Z",
    failureSummary: "Synthetic SMTP failure",
    events: [],
    ...overrides,
  };
}

describe("email delivery handoff helpers", () => {
  it("marks failed delivery as staff retry handoff without auto-sending", () => {
    expect(describeEmailDeliveryState(email())).toMatchObject({
      label: "retry handoff",
      retryEligible: true,
      tone: "risk",
    });
    expect(describeEmailDeliveryHandoff(email())).toMatchObject({
      status: "retry_available",
      requiresConfirmation: true,
      retryEligible: true,
    });
  });

  it("builds confirmation-gated retry path and payload", () => {
    expect(buildEmailDeliveryRetryPath("email with spaces")).toBe(
      "/api/mail/outbox/email%20with%20spaces/retry",
    );
    expect(
      buildEmailDeliveryRetryPayload({
        matterId: "matter-synthetic-001",
        recipientCount: 2,
        idempotencyKey: "email-retry-synthetic-001",
      }),
    ).toEqual({
      matterId: "matter-synthetic-001",
      idempotencyKey: "email-retry-synthetic-001",
      deliveryConfirmation: { confirmed: true, channel: "email", recipientCount: 2 },
    });
  });

  it("keeps sent and in-progress delivery out of retry handoff", () => {
    expect(
      describeEmailDeliveryHandoff(email({ status: "sent", sentAt: "2026-06-20T10:06:00.000Z" })),
    ).toMatchObject({
      status: "delivered",
      retryEligible: false,
    });
    expect(describeEmailDeliveryHandoff(email({ status: "sending" }))).toMatchObject({
      status: "delivery_in_progress",
      retryEligible: false,
    });
  });
});
