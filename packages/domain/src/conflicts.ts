import type { Contact, Matter, MatterParty } from "./models.js";

export type ConflictSeverity = "blocker" | "review" | "info";

export interface ConflictCandidate {
  contactId: string;
  matterId?: string;
  severity: ConflictSeverity;
  reason: string;
  matchedValue: string;
}

export interface ConflictCheckRecord {
  id: string;
  firmId: string;
  requestedByUserId: string;
  prospectiveName: string;
  querySnapshot: {
    prospectiveName: string;
    aliases: string[];
    identifiers: Array<{ type: string; value: string }>;
    prospectiveRole?: "client" | "opposing_party" | "third_party";
    includeClosedMatters: boolean;
  };
  resultSnapshot: ConflictCandidate[];
  disposition: "pending_review" | "cleared" | "conflict_found" | string;
  reviewedByUserId?: string;
  createdAt: string;
}

export interface ConflictCheckInput {
  firmId: string;
  prospectiveName: string;
  aliases?: string[];
  identifiers?: Array<{ type: string; value: string }>;
  prospectiveRole?: "client" | "opposing_party" | "third_party";
  includeClosedMatters: boolean;
  contacts: Contact[];
  matters: Matter[];
  matterParties: MatterParty[];
}

const entityMarkers = [
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
  "ltd",
  "limited",
  "llc",
  "llp",
  "plc",
  "ulc",
  "the",
];

export function normalizeConflictToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((part) => part.length > 0 && !entityMarkers.includes(part))
    .join(" ");
}

function levenshtein(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 1; j <= b.length; j += 1) rows[0]![j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i]![j] = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }

  return rows[a.length]![b.length]!;
}

function similarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - levenshtein(a, b) / maxLength;
}

function contactNames(contact: Contact): string[] {
  return [contact.displayName, ...contact.aliases].map(normalizeConflictToken).filter(Boolean);
}

function matterLinksForContact(
  contactId: string,
  matters: Matter[],
  matterParties: MatterParty[],
  includeClosedMatters: boolean,
): Array<{ matter?: Matter; party?: MatterParty }> {
  const links = matterParties
    .filter((candidate) => candidate.contactId === contactId)
    .map((party) => ({
      party,
      matter: matters.find((candidate) => candidate.id === party.matterId),
    }))
    .filter(
      ({ matter }) =>
        includeClosedMatters || !matter || !["closed", "archived"].includes(matter.status),
    );

  return links.length > 0 ? links : [{}];
}

function pushUniqueCandidate(candidates: ConflictCandidate[], candidate: ConflictCandidate): void {
  const duplicate = candidates.some(
    (existing) =>
      existing.contactId === candidate.contactId &&
      existing.matterId === candidate.matterId &&
      existing.severity === candidate.severity &&
      existing.reason === candidate.reason &&
      existing.matchedValue === candidate.matchedValue,
  );
  if (!duplicate) candidates.push(candidate);
}

export function runConflictCheck(input: ConflictCheckInput): ConflictCandidate[] {
  const prospectiveNames = [input.prospectiveName, ...(input.aliases ?? [])]
    .map(normalizeConflictToken)
    .filter(Boolean);
  const prospectiveIdentifiers = new Set(
    (input.identifiers ?? []).map(
      (identifier) => `${identifier.type}:${normalizeConflictToken(identifier.value)}`,
    ),
  );

  const candidates: ConflictCandidate[] = [];

  for (const contact of input.contacts.filter((candidate) => candidate.firmId === input.firmId)) {
    const links = matterLinksForContact(
      contact.id,
      input.matters,
      input.matterParties,
      input.includeClosedMatters,
    );

    const names = contactNames(contact);
    for (const prospectiveName of prospectiveNames) {
      if (names.includes(prospectiveName)) {
        for (const { matter, party } of links) {
          if (party && !matter) continue;
          pushUniqueCandidate(candidates, {
            contactId: contact.id,
            matterId: matter?.id,
            severity:
              party?.adverse || input.prospectiveRole === "opposing_party" ? "blocker" : "review",
            reason: party?.adverse
              ? "Prospective party matches an adverse party"
              : "Name or alias match",
            matchedValue: prospectiveName,
          });
        }
        continue;
      }

      const fuzzyMatch = names.find((name) => similarity(name, prospectiveName) >= 0.86);
      if (fuzzyMatch) {
        for (const { matter, party } of links) {
          if (party && !matter) continue;
          pushUniqueCandidate(candidates, {
            contactId: contact.id,
            matterId: matter?.id,
            severity: "review",
            reason: "Near name match requires manual review",
            matchedValue: fuzzyMatch,
          });
        }
      }
    }

    for (const identifier of contact.identifiers) {
      const key = `${identifier.type}:${normalizeConflictToken(identifier.value)}`;
      if (prospectiveIdentifiers.has(key)) {
        for (const { matter, party } of links) {
          if (party && !matter) continue;
          pushUniqueCandidate(candidates, {
            contactId: contact.id,
            matterId: matter?.id,
            severity: "blocker",
            reason: `Shared ${identifier.type} identifier`,
            matchedValue: identifier.value,
          });
        }
      }
    }
  }

  return candidates;
}
