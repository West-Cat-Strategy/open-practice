export const outboundWebhookEventAllowlist = [
  "matter.created",
  "document.verified",
  "signature_request.completed",
  "intake_session.completed",
  "invoice.issued",
  "email_outbox.sent",
] as const;

export type OutboundWebhookEvent = (typeof outboundWebhookEventAllowlist)[number];

export type OutboundWebhookDestinationValidation =
  | {
      ok: true;
      normalizedUrl: string;
      scheme: "https";
      host: string;
      port?: string;
    }
  | {
      ok: false;
      reason: "invalid_url" | "https_required" | "localhost_or_loopback_denied";
    };

export interface OutboundWebhookSigningMetadata {
  algorithm: "hmac-sha256";
  signatureHeader: "x-open-practice-signature";
  timestampHeader: "x-open-practice-timestamp";
  deliveryIdHeader: "x-open-practice-delivery-id";
  eventHeader: "x-open-practice-event";
  secretReference: string;
}

export interface OutboundWebhookTestDeliverySimulation {
  status: "simulated";
  deliveryId: string;
  destination: {
    scheme: "https";
    host: string;
    port?: string;
  };
  eventCount: number;
  events: OutboundWebhookEvent[];
  signing: OutboundWebhookSigningMetadata;
  bodyShape: {
    deliveryId: "string";
    event: "allowlisted_event";
    createdAt: "iso8601";
    data: "synthetic_object";
  };
}

const LOCALHOST_NAMES = new Set(["localhost", "localhost.localdomain", "0.0.0.0"]);

function isLoopbackIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  return octets[0] === 127;
}

function normalizedHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.$/, "");
}

function isLocalhostOrLoopback(hostname: string): boolean {
  const host = normalizedHost(hostname);
  return (
    LOCALHOST_NAMES.has(host) ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    isLoopbackIpv4(host)
  );
}

export function validateOutboundWebhookDestination(
  destinationUrl: string,
): OutboundWebhookDestinationValidation {
  let parsed: URL;
  try {
    parsed = new URL(destinationUrl);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (parsed.protocol !== "https:") return { ok: false, reason: "https_required" };
  if (isLocalhostOrLoopback(parsed.hostname)) {
    return { ok: false, reason: "localhost_or_loopback_denied" };
  }

  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  return {
    ok: true,
    normalizedUrl: parsed.toString(),
    scheme: "https",
    host: normalizedHost(parsed.hostname),
    port: parsed.port || undefined,
  };
}

export function buildOutboundWebhookSigningMetadata(
  secretReference = "secret://outbound-webhooks/test",
): OutboundWebhookSigningMetadata {
  return {
    algorithm: "hmac-sha256",
    signatureHeader: "x-open-practice-signature",
    timestampHeader: "x-open-practice-timestamp",
    deliveryIdHeader: "x-open-practice-delivery-id",
    eventHeader: "x-open-practice-event",
    secretReference,
  };
}

export function buildOutboundWebhookTestDeliverySimulation(input: {
  deliveryId: string;
  destination: Extract<OutboundWebhookDestinationValidation, { ok: true }>;
  events: OutboundWebhookEvent[];
  secretReference?: string;
}): OutboundWebhookTestDeliverySimulation {
  return {
    status: "simulated",
    deliveryId: input.deliveryId,
    destination: {
      scheme: input.destination.scheme,
      host: input.destination.host,
      port: input.destination.port,
    },
    eventCount: input.events.length,
    events: input.events,
    signing: buildOutboundWebhookSigningMetadata(input.secretReference),
    bodyShape: {
      deliveryId: "string",
      event: "allowlisted_event",
      createdAt: "iso8601",
      data: "synthetic_object",
    },
  };
}
