import { describe, expect, it } from "vitest";
import {
  buildOutboundWebhookTestDeliverySimulation,
  isDeniedOutboundWebhookAddress,
  validateOutboundWebhookDestination,
} from "./outbound-webhooks.js";

describe("outbound webhook guardrails", () => {
  it("requires HTTPS destinations and rejects URL credentials", () => {
    expect(validateOutboundWebhookDestination("http://example.test/hooks")).toEqual({
      ok: false,
      reason: "https_required",
    });

    expect(
      validateOutboundWebhookDestination("https://user:secret@webhooks.example.test/hooks#token"),
    ).toEqual({
      ok: false,
      reason: "credentials_denied",
    });
  });

  it("denies localhost and private-network destinations before simulation", () => {
    expect(validateOutboundWebhookDestination("https://localhost/hooks")).toEqual({
      ok: false,
      reason: "private_network_denied",
    });
    expect(validateOutboundWebhookDestination("https://ops.localhost/hooks")).toEqual({
      ok: false,
      reason: "private_network_denied",
    });
    expect(validateOutboundWebhookDestination("https://127.0.0.1/hooks")).toEqual({
      ok: false,
      reason: "private_network_denied",
    });
    expect(validateOutboundWebhookDestination("https://10.0.0.7/hooks")).toEqual({
      ok: false,
      reason: "private_network_denied",
    });
    expect(validateOutboundWebhookDestination("https://[fd00::1]/hooks")).toEqual({
      ok: false,
      reason: "private_network_denied",
    });
    expect(validateOutboundWebhookDestination("https://[::1]/hooks")).toEqual({
      ok: false,
      reason: "private_network_denied",
    });
  });

  it("classifies resolved private addresses for worker-side DNS guardrails", () => {
    expect(isDeniedOutboundWebhookAddress("192.168.1.10")).toBe(true);
    expect(isDeniedOutboundWebhookAddress("169.254.169.254")).toBe(true);
    expect(isDeniedOutboundWebhookAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isDeniedOutboundWebhookAddress("::ffff:7f00:1")).toBe(true);
    expect(isDeniedOutboundWebhookAddress("::ffff:0a00:5")).toBe(true);
    expect(isDeniedOutboundWebhookAddress("::ffff:c0a8:10")).toBe(true);
    expect(isDeniedOutboundWebhookAddress("64:ff9b::0a00:0005")).toBe(true);
    expect(isDeniedOutboundWebhookAddress("64:ff9b::10.0.0.5")).toBe(true);
    expect(isDeniedOutboundWebhookAddress("[64:ff9b:1:0a00:0005::]")).toBe(true);
    expect(isDeniedOutboundWebhookAddress("fec0::1")).toBe(true);
    expect(isDeniedOutboundWebhookAddress("203.0.113.10")).toBe(false);
    expect(isDeniedOutboundWebhookAddress("64:ff9b::cb00:710a")).toBe(false);
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
