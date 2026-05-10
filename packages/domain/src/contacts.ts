import type { Contact, Matter, MatterParty, PortalGrant } from "./models.js";
import type { IntakeVariableProposal } from "./intake.js";
import {
  normalizeConflictToken,
  type ConflictCheckRecord,
  type ConflictSeverity,
} from "./conflicts.js";

export type ContactDossierContactSummary = Omit<Contact, "notes">;

export interface ContactDossierMatterLink {
  matterId: string;
  matterNumber: string;
  matterTitle: string;
  matterStatus: Matter["status"];
  practiceArea: string;
  role: MatterParty["role"];
  adverse: boolean;
  confidential: boolean;
  portalActive: boolean;
  portalPermissions: PortalGrant["permissions"];
}

export interface ContactDossierConflictCue {
  severity: "blocker" | "review" | "info";
  reason: string;
  matterId?: string;
}

export type ContactDossierQualitySignalKind =
  | "duplicate_candidate"
  | "protected_party_cue"
  | "conflict_revalidation";

export interface ContactDossierQualitySignal {
  kind: ContactDossierQualitySignalKind;
  severity: "blocker" | "review" | "info";
  reason: string;
  matterId?: string;
  relatedContactIds?: string[];
  matchedOn?: "name" | "alias" | "identifier";
  matchedValue?: string;
  sourceRecordId?: string;
  changedAt?: string;
}

export interface ContactDossierQualityReview {
  summary: {
    duplicateCandidateCount: number;
    sensitivePartyCueCount: number;
    revalidationPromptCount: number;
  };
  signals: ContactDossierQualitySignal[];
}

export interface ContactDossierConflictHistoryEntry {
  id: string;
  createdAt: string;
  disposition: ConflictCheckRecord["disposition"];
  matchedContactId: string;
  visibleMatchedMatterIds: string[];
  matchCount: number;
  maxSeverity: ConflictSeverity;
}

export interface ContactDossier {
  contact: ContactDossierContactSummary;
  matters: ContactDossierMatterLink[];
  portal: {
    activeGrantCount: number;
    permissionLabels: PortalGrant["permissions"];
  };
  conflictCues: ContactDossierConflictCue[];
  qualityReview: ContactDossierQualityReview;
  conflictHistory: ContactDossierConflictHistoryEntry[];
}

export interface BuildContactDossiersInput {
  firmId: string;
  contacts: Contact[];
  matters: Matter[];
  matterParties: MatterParty[];
  portalGrants: PortalGrant[];
  intakeVariableProposals?: IntakeVariableProposal[];
  conflictChecks?: ConflictCheckRecord[];
  now?: string;
}

function isActiveGrant(grant: PortalGrant, now: string): boolean {
  if (grant.revokedAt) return false;
  if (!grant.expiresAt) return true;
  return Date.parse(grant.expiresAt) > Date.parse(now);
}

function uniquePermissions(grants: PortalGrant[]): PortalGrant["permissions"] {
  return Array.from(new Set(grants.flatMap((grant) => grant.permissions))).sort();
}

function buildConflictCues(links: ContactDossierMatterLink[]): ContactDossierConflictCue[] {
  const cues = links.flatMap((link) => {
    const linkCues: ContactDossierConflictCue[] = [];
    if (link.adverse) {
      linkCues.push({
        severity: "blocker",
        reason: "Linked as an adverse party on an accessible matter",
        matterId: link.matterId,
      });
    }
    if (link.confidential) {
      linkCues.push({
        severity: "review",
        reason: "Linked to a confidential matter party record",
        matterId: link.matterId,
      });
    }
    return linkCues;
  });

  return cues.length > 0
    ? cues
    : [{ severity: "info", reason: "No adverse or confidential accessible party flags" }];
}

function summarizeContact(contact: Contact): ContactDossierContactSummary {
  return {
    id: contact.id,
    firmId: contact.firmId,
    kind: contact.kind,
    displayName: contact.displayName,
    aliases: contact.aliases,
    identifiers: contact.identifiers,
  };
}

function normalizedContactNames(
  contact: Contact,
): Array<{ matchedOn: "name" | "alias"; matchedValue: string; normalizedValue: string }> {
  return [
    { matchedOn: "name" as const, matchedValue: contact.displayName },
    ...contact.aliases.map((alias) => ({ matchedOn: "alias" as const, matchedValue: alias })),
  ]
    .map((entry) => ({ ...entry, normalizedValue: normalizeConflictToken(entry.matchedValue) }))
    .filter((entry) => entry.normalizedValue.length > 0);
}

function normalizedContactIdentifiers(
  contact: Contact,
): Array<{ matchedValue: string; normalizedValue: string }> {
  return contact.identifiers
    .map((identifier) => ({
      matchedValue: `${identifier.type}:${identifier.value}`,
      normalizedValue: `${identifier.type}:${normalizeConflictToken(identifier.value)}`,
    }))
    .filter((entry) => entry.normalizedValue.length > entry.normalizedValue.indexOf(":") + 1);
}

function buildDuplicateSignals(
  contact: Contact,
  contacts: Contact[],
): ContactDossierQualitySignal[] {
  const signals: ContactDossierQualitySignal[] = [];
  const seen = new Set<string>();
  const names = normalizedContactNames(contact);
  const identifiers = normalizedContactIdentifiers(contact);

  for (const candidate of contacts) {
    if (candidate.id === contact.id) continue;

    const candidateNames = normalizedContactNames(candidate);
    const nameMatch = names.find((entry) =>
      candidateNames.some(
        (candidateEntry) => candidateEntry.normalizedValue === entry.normalizedValue,
      ),
    );
    if (nameMatch) {
      const key = `${candidate.id}:name:${nameMatch.normalizedValue}`;
      if (!seen.has(key)) {
        seen.add(key);
        signals.push({
          kind: "duplicate_candidate",
          severity: "review",
          reason: "Possible duplicate contact name or alias",
          relatedContactIds: [candidate.id],
          matchedOn: nameMatch.matchedOn,
          matchedValue: nameMatch.matchedValue,
        });
      }
    }

    const candidateIdentifiers = normalizedContactIdentifiers(candidate);
    const identifierMatch = identifiers.find((entry) =>
      candidateIdentifiers.some(
        (candidateEntry) => candidateEntry.normalizedValue === entry.normalizedValue,
      ),
    );
    if (identifierMatch) {
      const key = `${candidate.id}:identifier:${identifierMatch.normalizedValue}`;
      if (!seen.has(key)) {
        seen.add(key);
        signals.push({
          kind: "duplicate_candidate",
          severity: "review",
          reason: "Possible duplicate contact identifier",
          relatedContactIds: [candidate.id],
          matchedOn: "identifier",
          matchedValue: identifierMatch.matchedValue,
        });
      }
    }
  }

  return signals;
}

function buildSensitivePartySignals(
  links: ContactDossierMatterLink[],
): ContactDossierQualitySignal[] {
  return links.flatMap((link) => {
    const signals: ContactDossierQualitySignal[] = [];
    if (link.adverse) {
      signals.push({
        kind: "protected_party_cue",
        severity: "blocker",
        reason: "Adverse party link requires sensitive-party caution",
        matterId: link.matterId,
      });
    }
    if (link.confidential) {
      signals.push({
        kind: "protected_party_cue",
        severity: "review",
        reason: "Confidential party link requires scoped handling",
        matterId: link.matterId,
      });
    }
    if (link.portalActive) {
      signals.push({
        kind: "protected_party_cue",
        severity: "review",
        reason: "Active portal access protects contact-matter communications",
        matterId: link.matterId,
      });
    }
    return signals;
  });
}

function buildRevalidationSignals(
  contact: Contact,
  proposals: IntakeVariableProposal[],
  visibleMatterIds: Set<string>,
): ContactDossierQualitySignal[] {
  return proposals
    .filter(
      (proposal) =>
        proposal.firmId === contact.firmId &&
        proposal.targetScope === "client" &&
        proposal.targetField === "displayName" &&
        proposal.targetRecordId === contact.id &&
        proposal.status === "approved" &&
        Boolean(proposal.appliedAt) &&
        visibleMatterIds.has(proposal.matterId),
    )
    .map((proposal) => ({
      kind: "conflict_revalidation" as const,
      severity: "review" as const,
      reason: "Approved contact name change should prompt manual conflict-check revalidation",
      matterId: proposal.matterId,
      sourceRecordId: proposal.id,
      changedAt: proposal.appliedAt,
    }));
}

const severityRank: Record<ConflictSeverity, number> = { info: 0, review: 1, blocker: 2 };

function maxSeverity(severities: ConflictSeverity[]): ConflictSeverity {
  return severities.reduce(
    (current, candidate) => (severityRank[candidate] > severityRank[current] ? candidate : current),
    "info",
  );
}

function buildConflictHistory(input: {
  contactId: string;
  firmId: string;
  visibleMatterIds: Set<string>;
  conflictChecks: ConflictCheckRecord[];
}): ContactDossierConflictHistoryEntry[] {
  return input.conflictChecks
    .filter((check) => check.firmId === input.firmId)
    .flatMap((check): ContactDossierConflictHistoryEntry[] => {
      const visibleMatches = check.resultSnapshot.filter(
        (result) =>
          result.contactId === input.contactId &&
          (!result.matterId || input.visibleMatterIds.has(result.matterId)),
      );
      if (visibleMatches.length === 0) return [];

      return [
        {
          id: check.id,
          createdAt: check.createdAt,
          disposition: check.disposition,
          matchedContactId: input.contactId,
          visibleMatchedMatterIds: Array.from(
            new Set(
              visibleMatches
                .map((result) => result.matterId)
                .filter((matterId): matterId is string => Boolean(matterId)),
            ),
          ).sort(),
          matchCount: visibleMatches.length,
          maxSeverity: maxSeverity(visibleMatches.map((match) => match.severity)),
        },
      ];
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function buildQualityReview(input: {
  contact: Contact;
  contacts: Contact[];
  links: ContactDossierMatterLink[];
  intakeVariableProposals: IntakeVariableProposal[];
  visibleMatterIds: Set<string>;
}): ContactDossierQualityReview {
  const duplicateSignals = buildDuplicateSignals(input.contact, input.contacts);
  const sensitivePartySignals = buildSensitivePartySignals(input.links);
  const revalidationSignals = buildRevalidationSignals(
    input.contact,
    input.intakeVariableProposals,
    input.visibleMatterIds,
  );
  const duplicateContactIds = new Set(
    duplicateSignals.flatMap((signal) => signal.relatedContactIds ?? []),
  );
  return {
    summary: {
      duplicateCandidateCount: duplicateContactIds.size,
      sensitivePartyCueCount: sensitivePartySignals.length,
      revalidationPromptCount: revalidationSignals.length,
    },
    signals: [...duplicateSignals, ...sensitivePartySignals, ...revalidationSignals],
  };
}

export function buildContactDossiers(input: BuildContactDossiersInput): ContactDossier[] {
  const now = input.now ?? new Date().toISOString();
  const visibleMatterById = new Map(
    input.matters
      .filter((matter) => matter.firmId === input.firmId)
      .map((matter) => [matter.id, matter] as const),
  );
  const contactById = new Map(
    input.contacts
      .filter((contact) => contact.firmId === input.firmId)
      .map((contact) => [contact.id, contact] as const),
  );
  const visibleMatterIds = new Set(visibleMatterById.keys());
  const visibleContacts = Array.from(contactById.values());
  const activePortalGrants = input.portalGrants.filter(
    (grant) =>
      grant.firmId === input.firmId &&
      visibleMatterById.has(grant.matterId) &&
      isActiveGrant(grant, now),
  );

  const linksByContactId = new Map<string, ContactDossierMatterLink[]>();
  for (const party of input.matterParties.filter(
    (candidate) => candidate.firmId === input.firmId,
  )) {
    const matter = visibleMatterById.get(party.matterId);
    const contact = contactById.get(party.contactId);
    if (!matter || !contact) continue;

    const grants = activePortalGrants.filter(
      (grant) => grant.matterId === party.matterId && grant.contactId === party.contactId,
    );
    const links = linksByContactId.get(party.contactId) ?? [];
    links.push({
      matterId: matter.id,
      matterNumber: matter.number,
      matterTitle: matter.title,
      matterStatus: matter.status,
      practiceArea: matter.practiceArea,
      role: party.role,
      adverse: party.adverse,
      confidential: party.confidential,
      portalActive: grants.length > 0,
      portalPermissions: uniquePermissions(grants),
    });
    linksByContactId.set(party.contactId, links);
  }

  return Array.from(linksByContactId.entries())
    .map(([contactId, matters]) => {
      const contact = contactById.get(contactId)!;
      const contactGrants = activePortalGrants.filter((grant) => grant.contactId === contactId);
      const sortedMatters = matters.sort((left, right) =>
        left.matterNumber.localeCompare(right.matterNumber),
      );
      return {
        contact: summarizeContact(contact),
        matters: sortedMatters,
        portal: {
          activeGrantCount: contactGrants.length,
          permissionLabels: uniquePermissions(contactGrants),
        },
        conflictCues: buildConflictCues(sortedMatters),
        qualityReview: buildQualityReview({
          contact,
          contacts: visibleContacts,
          links: sortedMatters,
          intakeVariableProposals: input.intakeVariableProposals ?? [],
          visibleMatterIds,
        }),
        conflictHistory: buildConflictHistory({
          contactId,
          firmId: input.firmId,
          visibleMatterIds,
          conflictChecks: input.conflictChecks ?? [],
        }),
      };
    })
    .sort((left, right) => left.contact.displayName.localeCompare(right.contact.displayName));
}
