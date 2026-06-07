import { getSavedMatterPresetDefinition } from "../../dashboard-utils";
import type { SavedOperationalViewDefinition } from "../../types";

export const documentMetadataClassificationOptions = [
  "general",
  "privileged",
  "work_product",
  "financial",
  "identity",
] as const;

export const documentMetadataReviewStatusOptions = [
  "not_required",
  "pending_review",
  "needs_metadata",
  "accepted",
  "retry_requested",
  "discarded",
] as const;

export const documentMetadataScanStatusOptions = [
  "pending",
  "queued",
  "passed",
  "failed",
  "not_required",
] as const;

export const documentMetadataOcrStatusOptions = [
  "not_available",
  "queued",
  "completed",
  "failed",
] as const;

export const documentMetadataCueGroupOptions = [
  "classification",
  "duplicate_or_supersession",
  "matter_contact",
  "missing_metadata",
  "retention_review",
] as const;

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

export function cents(value: number): string {
  return currency.format(value / 100);
}

export function minutes(value: number): string {
  const hours = Math.floor(value / 60);
  const remaining = value % 60;
  return hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`;
}

export function compactStatus(value?: string): string {
  return value ? value.replaceAll("_", " ") : "none";
}

export function compactDate(value?: string): string {
  if (!value) return "none";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

export function formatSavedOperationalViewDefinition(
  definition: SavedOperationalViewDefinition,
): string {
  const scope =
    definition.permissionScope.length > 0 ? definition.permissionScope.join(", ") : "no scope";
  return `${definition.rowLimit} rows · ${definition.columns.length} columns · ${scope}`;
}

export function formatSavedMatterViewDefinition(
  definition: SavedOperationalViewDefinition,
): string {
  const preset = getSavedMatterPresetDefinition(definition.filters.presetFamily);
  const presetLabel = preset?.summaryLabel ?? "no preset focus";
  return `${presetLabel} · ${definition.rowLimit} matters · ${definition.permissionScope.join(", ")}`;
}
