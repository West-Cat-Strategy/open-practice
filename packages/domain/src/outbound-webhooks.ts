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
      reason: "invalid_url" | "https_required" | "credentials_denied" | "private_network_denied";
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

function parseIpv4(host: string): number[] | undefined {
  const parts = host.split(".");
  if (parts.length !== 4) return undefined;
  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return undefined;
  }
  return octets;
}

function normalizedHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.$/, "");
}

function isDeniedIpv4(host: string): boolean {
  const octets = parseIpv4(host);
  if (!octets) return false;
  const [first = 0, second = 0] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isDeniedIpv6(host: string): boolean {
  const mapped = host.match(/(?:^|:)ffff:(?<suffix>[0-9a-f:.]+)$/i);
  if (mapped?.groups?.suffix) {
    const suffix = mapped.groups.suffix;
    if (suffix.includes(".")) return isDeniedIpv4(suffix);
    const parts = suffix.split(":");
    if (parts.length === 2) {
      const words = parts.map((part) => Number.parseInt(part, 16));
      if (words.every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffff)) {
        const [high = 0, low = 0] = words;
        return isDeniedIpv4(
          `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`,
        );
      }
    }
  }
  if (!host.includes(":")) return false;
  return (
    host === "::" ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    /^fe[89ab][0-9a-f]?:/i.test(host) ||
    host.startsWith("ff")
  );
}

export function isDeniedOutboundWebhookAddress(address: string): boolean {
  const host = normalizedHost(address);
  return isDeniedIpv4(host) || isDeniedIpv6(host);
}

function isPrivateOrInternalHost(hostname: string): boolean {
  const host = normalizedHost(hostname);
  return (
    LOCALHOST_NAMES.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".") ||
    isDeniedOutboundWebhookAddress(host)
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
  if (parsed.username || parsed.password) return { ok: false, reason: "credentials_denied" };
  if (isPrivateOrInternalHost(parsed.hostname)) {
    return { ok: false, reason: "private_network_denied" };
  }

  parsed.hash = "";
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
