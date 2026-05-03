import { describe, expect, it } from "vitest";
import {
  buildOutboundWebhookTestDeliverySimulation,
  validateOutboundWebhookDestination,
} from "./outbound-webhooks.js";

describe("outbound webhook guardrails", () => {
  it("requires HTTPS destinations and removes credentials/fragments from normalized URLs", () => {
    expect(validateOutboundWebhookDestination("http://example.test/hooks")).toEqual({
      ok: false,
      reason: "https_required",
    });

    expect(
      validateOutboundWebhookDestination("https://user:secret@webhooks.example.test/hooks#token"),
    ).toMatchObject({
      ok: true,
      normalizedUrl: "https://webhooks.example.test/hooks",
      scheme: "https",
      host: "webhooks.example.test",
    });
  });

  it("denies localhost and loopback destinations before simulation", () => {
    expect(validateOutboundWebhookDestination("https://localhost/hooks")).toEqual({
      ok: false,
      reason: "localhost_or_loopback_denied",
    });
    expect(validateOutboundWebhookDestination("https://ops.localhost/hooks")).toEqual({
      ok: false,
      reason: "localhost_or_loopback_denied",
    });
    expect(validateOutboundWebhookDestination("https://127.0.0.1/hooks")).toEqual({
      ok: false,
      reason: "localhost_or_loopback_denied",
    });
    expect(validateOutboundWebhookDestination("https://[::1]/hooks")).toEqual({
      ok: false,
      reason: "localhost_or_loopback_denied",
    });
  });

  it("builds provider-neutral signing metadata without exposing a secret value", () => {
    const destination = validateOutboundWebhookDestination("https://webhooks.example.test/hooks");
    expect(destination.ok).toBe(true);
    if (!destination.ok) throw new Error("expected valid destination");

    const simulation = buildOutboundWebhookTestDeliverySimulation({
      deliveryId: "delivery-test-001",
      destination,
      events: ["matter.created", "document.verified"],
      secretReference: "secret://outbound-webhooks/synthetic",
    });

    expect(simulation).toMatchObject({
      status: "simulated",
      deliveryId: "delivery-test-001",
      destination: { scheme: "https", host: "webhooks.example.test" },
      eventCount: 2,
      events: ["matter.created", "document.verified"],
      signing: {
        algorithm: "hmac-sha256",
        signatureHeader: "x-open-practice-signature",
        timestampHeader: "x-open-practice-timestamp",
        deliveryIdHeader: "x-open-practice-delivery-id",
        eventHeader: "x-open-practice-event",
        secretReference: "secret://outbound-webhooks/synthetic",
      },
      bodyShape: {
        deliveryId: "string",
        event: "allowlisted_event",
        createdAt: "iso8601",
        data: "synthetic_object",
      },
    });
    expect(JSON.stringify(simulation)).not.toContain("secret-value");
  });
});
