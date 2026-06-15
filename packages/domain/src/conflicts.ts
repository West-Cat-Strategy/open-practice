import type { Contact, Matter, MatterParty } from "./models.js";
import type { ContactRelationshipRecord } from "./contacts.js";

export type ConflictSeverity = "blocker" | "review" | "info";

export type ConflictMatchCategory =
  | "exact_contact"
  | "exact_organization"
  | "alias"
  | "former_name"
  | "fuzzy_name"
  | "identifier"
  | "contact_method"
  | "related_party"
  | "organization_relationship"
  | "matter_party_role"
  | "historical_relationship"
  | "conflict_flag";

export type ConflictRiskLevel = "high" | "medium" | "low";

export interface ConflictCandidate {
  contactId: string;
  matterId?: string;
  severity: ConflictSeverity;
  reason: string;
  matchedValue: string;
  matchCategory?: ConflictMatchCategory;
  riskLevel?: ConflictRiskLevel;
  score?: number;
  explanation?: string;
  relationshipId?: string;
  relatedContactId?: string;
  matchedContactKind?: Contact["kind"];
  matchedRole?: MatterParty["role"];
  redacted?: boolean;
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
  contactRelationships?: ContactRelationshipRecord[];
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

function contactNames(contact: Contact): Array<{
  normalized: string;
  original: string;
  category: ConflictMatchCategory;
}> {
  return [
    {
      original: contact.displayName,
      category:
        contact.kind === "organization"
          ? ("exact_organization" as const)
          : ("exact_contact" as const),
    },
    ...(contact.canonicalName
      ? [
          {
            original: contact.canonicalName,
            category:
              contact.kind === "organization"
                ? ("exact_organization" as const)
                : ("exact_contact" as const),
          },
        ]
      : []),
    ...(contact.organizationLegalName
      ? [{ original: contact.organizationLegalName, category: "exact_organization" as const }]
      : []),
    ...(contact.organizationOperatingName
      ? [{ original: contact.organizationOperatingName, category: "exact_organization" as const }]
      : []),
    ...(contact.organizationRegisteredName
      ? [{ original: contact.organizationRegisteredName, category: "exact_organization" as const }]
      : []),
    ...contact.aliases.map((alias) => ({ original: alias, category: "alias" as const })),
    ...(contact.formerNames ?? []).map((formerName) => ({
      original: formerName,
      category: "former_name" as const,
    })),
  ]
    .map((entry) => ({ ...entry, normalized: normalizeConflictToken(entry.original) }))
    .filter((entry) => entry.normalized.length > 0);
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

function severityForParty(
  party: MatterParty | undefined,
  prospectiveRole: ConflictCheckInput["prospectiveRole"],
): ConflictSeverity {
  if (party?.adverse || prospectiveRole === "opposing_party") return "blocker";
  if (party?.role === "former_client" || party?.conflictCheckIncluded === false) return "review";
  return "review";
}

function riskLevelForSeverity(severity: ConflictSeverity): ConflictRiskLevel {
  return severity === "blocker" ? "high" : severity === "review" ? "medium" : "low";
}

function contactIdentifiersAndMethods(contact: Contact): Array<{
  key: string;
  value: string;
  type: string;
  category: ConflictMatchCategory;
}> {
  type ContactMethod = NonNullable<Contact["contactMethods"]>[number];
  const contactMethodConflictValues = (method: ContactMethod): string[] => {
    if (method.type !== "address") return method.value ? [method.value] : [];
    const addressParts = [
      method.address?.line1,
      method.address?.line2,
      method.address?.city,
      method.address?.province,
      method.address?.postalCode,
      method.address?.country,
    ].filter((part): part is string => Boolean(part));
    return [addressParts.join(" "), method.address?.line1, method.address?.postalCode].filter(
      (part): part is string => Boolean(part),
    );
  };

  return [
    ...contact.identifiers
      .filter((identifier) => identifier.conflictCheckIncluded !== false)
      .map((identifier) => ({
        key: `${identifier.type}:${normalizeConflictToken(identifier.value)}`,
        value: identifier.value,
        type: identifier.type,
        category: "identifier" as const,
      })),
    ...(contact.contactMethods ?? [])
      .flatMap((method) => contactMethodConflictValues(method).map((value) => ({ method, value })))
      .filter(({ method, value }) => method.conflictCheckIncluded !== false && value)
      .map(({ method, value }) => ({
        key: `${method.type}:${normalizeConflictToken(value)}`,
        value,
        type: method.type,
        category: "contact_method" as const,
      })),
  ].filter((entry) => entry.key.length > entry.key.indexOf(":") + 1);
}

function relationshipCategory(
  relationship: ContactRelationshipRecord,
  relatedContact: Contact | undefined,
): ConflictMatchCategory {
  if (relationship.status === "ended") return "historical_relationship";
  if (relatedContact?.kind === "organization") return "organization_relationship";
  return "related_party";
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
      const exactName = names.find((name) => name.normalized === prospectiveName);
      if (exactName) {
        for (const { matter, party } of links) {
          if (party && !matter) continue;
          const severity = severityForParty(party, input.prospectiveRole);
          pushUniqueCandidate(candidates, {
            contactId: contact.id,
            matterId: matter?.id,
            severity,
            reason: party?.adverse
              ? "Prospective party matches an adverse party"
              : exactName.category === "former_name"
                ? "Former-name match"
                : exactName.category === "alias"
                  ? "Alias match"
                  : contact.kind === "organization"
                    ? "Organization name match"
                    : "Contact name match",
            matchedValue: prospectiveName,
            matchCategory: exactName.category,
            riskLevel: riskLevelForSeverity(severity),
            score: 1,
            explanation: party
              ? `Matched ${exactName.category.replaceAll("_", " ")} for a ${party.role} matter association.`
              : `Matched ${exactName.category.replaceAll("_", " ")} on a contact record.`,
            matchedContactKind: contact.kind,
            matchedRole: party?.role,
          });
        }
        continue;
      }

      const fuzzyMatch = names.find((name) => similarity(name.normalized, prospectiveName) >= 0.86);
      if (fuzzyMatch) {
        for (const { matter, party } of links) {
          if (party && !matter) continue;
          const score = Number(similarity(fuzzyMatch.normalized, prospectiveName).toFixed(2));
          pushUniqueCandidate(candidates, {
            contactId: contact.id,
            matterId: matter?.id,
            severity: "review",
            reason: "Near name match requires manual review",
            matchedValue: fuzzyMatch.normalized,
            matchCategory: "fuzzy_name",
            riskLevel: "medium",
            score,
            explanation: `Near match to ${fuzzyMatch.category.replaceAll("_", " ")} with score ${score}.`,
            matchedContactKind: contact.kind,
            matchedRole: party?.role,
          });
        }
      }
    }

    for (const identifier of contactIdentifiersAndMethods(contact)) {
      const key = identifier.key;
      if (prospectiveIdentifiers.has(key)) {
        for (const { matter, party } of links) {
          if (party && !matter) continue;
          pushUniqueCandidate(candidates, {
            contactId: contact.id,
            matterId: matter?.id,
            severity: "blocker",
            reason:
              identifier.category === "contact_method"
                ? `Shared ${identifier.type} contact method`
                : `Shared ${identifier.type} identifier`,
            matchedValue: identifier.value,
            matchCategory: identifier.category,
            riskLevel: "high",
            score: 1,
            explanation: `Matched normalized ${identifier.type} ${identifier.category.replaceAll("_", " ")}.`,
            matchedContactKind: contact.kind,
            matchedRole: party?.role,
          });
        }
      }
    }

    if (
      contact.conflictSensitive ||
      contact.adverse ||
      contact.confidentialityMarker === "restricted"
    ) {
      for (const { matter, party } of links) {
        if (party && !matter) continue;
        pushUniqueCandidate(candidates, {
          contactId: contact.id,
          matterId: matter?.id,
          severity:
            contact.adverse || contact.confidentialityMarker === "restricted"
              ? "blocker"
              : "review",
          reason: "Matched contact has conflict-sensitive handling flags",
          matchedValue: contact.displayName,
          matchCategory: "conflict_flag",
          riskLevel:
            contact.adverse || contact.confidentialityMarker === "restricted" ? "high" : "medium",
          score: 0.75,
          explanation: "Contact record is marked conflict-sensitive, adverse, or restricted.",
          matchedContactKind: contact.kind,
          matchedRole: party?.role,
        });
      }
    }
  }

  const contactById = new Map(input.contacts.map((contact) => [contact.id, contact]));
  for (const relationship of input.contactRelationships ?? []) {
    if (relationship.firmId !== input.firmId) continue;
    if (relationship.includeInConflictCheck === false) continue;
    const relatedContact = contactById.get(relationship.relatedContactId);
    const sourceContact = contactById.get(relationship.contactId);
    if (!sourceContact || !relatedContact) continue;
    const sourceNames = contactNames(sourceContact);
    const relatedNames = contactNames(relatedContact);
    const matchedSource = sourceNames.find((name) => prospectiveNames.includes(name.normalized));
    const matchedRelated = relatedNames.find((name) => prospectiveNames.includes(name.normalized));
    const matched = matchedSource ?? matchedRelated;
    if (!matched) continue;
    const contactId = matchedSource ? relationship.relatedContactId : relationship.contactId;
    const links = matterLinksForContact(
      contactId,
      input.matters,
      input.matterParties,
      input.includeClosedMatters,
    );
    for (const { matter, party } of links) {
      if (party && !matter) continue;
      const category = relationshipCategory(
        relationship,
        matchedSource ? relatedContact : sourceContact,
      );
      pushUniqueCandidate(candidates, {
        contactId,
        matterId: relationship.matterId ?? matter?.id,
        severity: relationship.status === "review_needed" ? "review" : "info",
        reason: "Related-party relationship match",
        matchedValue: matched.normalized,
        matchCategory: category,
        riskLevel: relationship.status === "review_needed" ? "medium" : "low",
        score: relationship.status === "ended" ? 0.45 : 0.65,
        explanation: `Matched through ${relationship.relationshipKind.replaceAll("_", " ")} relationship.`,
        relationshipId: relationship.id,
        relatedContactId: matchedSource ? relationship.contactId : relationship.relatedContactId,
        matchedContactKind: (matchedSource ? relatedContact : sourceContact).kind,
        matchedRole: party?.role,
      });
    }
  }

  return candidates;
}
