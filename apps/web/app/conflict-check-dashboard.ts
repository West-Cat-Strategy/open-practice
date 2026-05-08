import type { ConflictCandidate } from "@open-practice/domain";

export type ConflictProspectiveRole = "client" | "opposing_party" | "third_party";

export interface ConflictCheckPayload {
  prospectiveName: string;
  aliases?: string[];
  identifiers?: Array<{ type: string; value: string }>;
  prospectiveRole?: ConflictProspectiveRole;
  includeClosedMatters: boolean;
}

export interface ConflictCheckPayloadResult {
  payload?: ConflictCheckPayload;
  error?: string;
}

const roleLabels: Record<ConflictProspectiveRole, string> = {
  client: "Prospective client",
  opposing_party: "Opposing party",
  third_party: "Third party",
};

export function formatConflictProspectiveRole(role: ConflictProspectiveRole): string {
  return roleLabels[role];
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function summarizeConflictCheckPayload(payload: ConflictCheckPayload): string {
  const details = [
    payload.prospectiveRole
      ? formatConflictProspectiveRole(payload.prospectiveRole)
      : "Role not set",
  ];
  const aliasCount = payload.aliases?.length ?? 0;
  const identifierCount = payload.identifiers?.length ?? 0;

  if (aliasCount > 0) details.push(countLabel(aliasCount, "alias", "aliases"));
  if (identifierCount > 0) details.push(countLabel(identifierCount, "identifier"));
  details.push(payload.includeClosedMatters ? "closed matters included" : "open matters only");

  return details.join(" · ");
}

export function describeConflictCheckStatus(
  payload: ConflictCheckPayload,
  resultCount: number,
): string {
  const scope = summarizeConflictCheckPayload(payload);
  if (resultCount === 0) return `No conflicts found for ${scope}.`;

  return `${resultCount} potential conflict${resultCount === 1 ? "" : "s"} found for ${scope}.`;
}

export function parseConflictAliases(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  );
}

export function parseConflictIdentifiers(
  value: string,
): { identifiers: Array<{ type: string; value: string }> } | { error: string } {
  const identifiers: Array<{ type: string; value: string }> = [];

  for (const line of value.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const delimiterIndex = trimmed.search(/[:=]/);
    if (delimiterIndex <= 0 || delimiterIndex === trimmed.length - 1) {
      return { error: "Use identifier lines as type: value." };
    }

    const type = trimmed.slice(0, delimiterIndex).trim();
    const identifierValue = trimmed.slice(delimiterIndex + 1).trim();
    if (!type || !identifierValue) return { error: "Use identifier lines as type: value." };

    identifiers.push({ type, value: identifierValue });
  }

  return { identifiers };
}

export function buildConflictCheckPayload(input: {
  prospectiveName: string;
  aliasesText: string;
  identifiersText: string;
  prospectiveRole: ConflictProspectiveRole | "";
  includeClosedMatters?: boolean;
}): ConflictCheckPayloadResult {
  const prospectiveName = input.prospectiveName.trim();
  if (!prospectiveName) return { error: "Enter a prospective name before running a check." };

  const parsedIdentifiers = parseConflictIdentifiers(input.identifiersText);
  if ("error" in parsedIdentifiers) return { error: parsedIdentifiers.error };

  const aliases = parseConflictAliases(input.aliasesText);
  const payload: ConflictCheckPayload = {
    prospectiveName,
    includeClosedMatters: input.includeClosedMatters ?? true,
  };

  if (aliases.length > 0) payload.aliases = aliases;
  if (parsedIdentifiers.identifiers.length > 0) {
    payload.identifiers = parsedIdentifiers.identifiers;
  }
  if (input.prospectiveRole) payload.prospectiveRole = input.prospectiveRole;

  return { payload };
}

export function describeConflictResult(result: ConflictCandidate): string {
  const matter = result.matterId ? `Matter ${result.matterId}` : "Firm-wide contact";
  return `${matter} · matched ${result.matchedValue}`;
}
