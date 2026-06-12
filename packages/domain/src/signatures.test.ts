import { describe, expect, it } from "vitest";
import {
  compareSignatureProviderEvents,
  compareSignatureProviderStatuses,
  getSignatureProviderEventReplayMetadata,
  getSignatureStatusUpdateDecision,
  orderSignatureProviderEvents,
  orderSignatureProviderStatuses,
  shouldUpdateSignatureRequestStatus,
} from "./signatures.js";

describe("signature provider lifecycle helpers", () => {
  it("orders provider statuses by lifecycle progress", () => {
    expect(compareSignatureProviderStatuses("viewed", "sent")).toBe(1);
    expect(compareSignatureProviderStatuses("sent", "viewed")).toBe(-1);
    expect(compareSignatureProviderStatuses("completed", "declined")).toBe(0);
    expect(
      orderSignatureProviderStatuses([
        "completed",
        "draft",
        "viewed",
        "pending_provider_submission",
        "sent",
      ]),
    ).toEqual(["draft", "pending_provider_submission", "sent", "viewed", "completed"]);
  });

  it("orders provider events by lifecycle progress and occurrence time", () => {
    const events = [
      { status: "completed" as const, occurredAt: "2026-04-24T10:03:00.000Z" },
      { status: "sent" as const, occurredAt: "2026-04-24T10:02:00.000Z" },
      { status: "sent" as const, occurredAt: "2026-04-24T10:01:00.000Z" },
    ];

    expect(compareSignatureProviderEvents(events[1], events[2])).toBe(1);
    expect(orderSignatureProviderEvents(events)).toEqual([
      { status: "sent", occurredAt: "2026-04-24T10:01:00.000Z" },
      { status: "sent", occurredAt: "2026-04-24T10:02:00.000Z" },
      { status: "completed", occurredAt: "2026-04-24T10:03:00.000Z" },
    ]);
  });

  it("allows advancing events while preserving terminal request statuses", () => {
    expect(shouldUpdateSignatureRequestStatus("sent", { status: "viewed" })).toBe(true);
    expect(shouldUpdateSignatureRequestStatus("viewed", { status: "sent" })).toBe(false);
    expect(shouldUpdateSignatureRequestStatus("sent", { status: "sent" })).toBe(false);
    expect(shouldUpdateSignatureRequestStatus("completed", { status: "declined" })).toBe(false);

    expect(getSignatureStatusUpdateDecision("completed", { status: "declined" })).toMatchObject({
      shouldUpdate: false,
      reason: "terminal_status_preserved",
    });
    expect(getSignatureStatusUpdateDecision("viewed", { status: "sent" })).toMatchObject({
      shouldUpdate: false,
      reason: "status_regression",
    });
  });

  it("extracts replay metadata from legacy provider evidence when available", () => {
    expect(
      getSignatureProviderEventReplayMetadata({
        provider: "docuseal",
        externalId: "submission-001",
        status: "completed",
        occurredAt: "2026-04-24T10:00:00.000Z",
        evidence: {
          event_id: 12345,
          deliveryId: "delivery-001",
        },
      }),
    ).toEqual({
      replayKey: "docuseal:submission-001:12345",
      providerEventId: "12345",
      providerWebhookId: "delivery-001",
    });

    expect(
      getSignatureProviderEventReplayMetadata({
        provider: "embedded",
        externalId: "embedded:matter-001:doc-001",
        status: "viewed",
        occurredAt: "2026-04-24T10:01:00.000Z",
        evidence: {},
      }).replayKey,
    ).toBe("embedded:embedded%3Amatter-001%3Adoc-001:viewed:2026-04-24T10%3A01%3A00.000Z");
  });
});
