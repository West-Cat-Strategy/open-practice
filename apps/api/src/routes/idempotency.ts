import { createHash } from "node:crypto";
import { IdempotencyKeyConflictError } from "@open-practice/database";
import { ApiHttpError } from "../http/response.js";

type KeyPart = string | number | boolean | undefined;

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(objectValue[key])}`)
    .join(",")}}`;
}

function keyPart(value: KeyPart): string {
  return String(value ?? "none").replace(/[^a-zA-Z0-9._:-]/g, "_");
}

export function buildIdempotencyKey(parts: {
  scope: string;
  firmId: string;
  matterId?: string;
  resourceType: string;
  resourceId?: string;
  action: string;
  providerOrTemplate?: string;
  clientKey?: string;
}): string {
  if (parts.clientKey?.trim()) return parts.clientKey.trim();
  return [
    parts.scope,
    parts.firmId,
    parts.matterId,
    parts.resourceType,
    parts.resourceId,
    parts.action,
    parts.providerOrTemplate,
  ]
    .map(keyPart)
    .join(":");
}

export function buildIdempotencyFingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

export function idempotencyMetadata(value: unknown): { idempotencyFingerprint: string } {
  return { idempotencyFingerprint: buildIdempotencyFingerprint(value) };
}

export function rethrowIdempotencyConflict(error: unknown): never {
  if (error instanceof IdempotencyKeyConflictError) {
    throw new ApiHttpError(
      409,
      "IDEMPOTENCY_KEY_CONFLICT",
      "Idempotency key was reused with a different payload",
    );
  }
  throw error;
}
