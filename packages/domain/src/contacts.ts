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

export interface ContactDossierRelatedContactSummary {
  kind: Contact["kind"];
  displayName: string;
}

export interface ContactDossierRelationshipRecord {
  source: "matter_party";
  relationshipLabel: string;
  relatedContact: ContactDossierRelatedContactSummary;
  matter: Pick<ContactDossierMatterLink, "matterId" | "matterNumber" | "matterTitle">;
  contactRole: MatterParty["role"];
  relatedRole: MatterParty["role"];
  conflictSafeLabels: string[];
}

export interface ContactDossierCrmTaxonomyCue {
  kind: "contact_type" | "matter_role" | "relationship_context" | "privacy_flag" | "portal_access";
  label: string;
  source: "contact" | "matter_party" | "portal_grant";
  count?: number;
}

export interface ContactDossierCrmTaxonomy {
  contactType: Contact["kind"];
  primaryLabel: "Person" | "Company or organization";
  cues: ContactDossierCrmTaxonomyCue[];
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

export const contactDossierQualitySignalKinds = [
  "duplicate_candidate",
  "protected_party_cue",
  "conflict_revalidation",
] as const satisfies ContactDossierQualitySignalKind[];

export const contactDataQualityResolutionDecisions = [
  "acknowledged",
  "false_positive",
  "needs_follow_up",
  "revalidation_requested",
  "revalidation_completed",
] as const;

export type ContactDataQualityResolutionDecision =
  (typeof contactDataQualityResolutionDecisions)[number];

export interface ContactDataQualityResolutionRecord {
  id: string;
  firmId: string;
  contactId: string;
  signalKind: ContactDossierQualitySignalKind;
  decision: ContactDataQualityResolutionDecision;
  matterId?: string;
  relatedContactId?: string;
  sourceRecordId?: string;
  resolutionNote: string;
  recordedByUserId: string;
  recordedAt: string;
}

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

const contactDataQualityResolutionDecisionsByKind: Record<
  ContactDossierQualitySignalKind,
  ReadonlySet<ContactDataQualityResolutionDecision>
> = {
  duplicate_candidate: new Set(["acknowledged", "false_positive", "needs_follow_up"]),
  protected_party_cue: new Set(["acknowledged", "needs_follow_up"]),
  conflict_revalidation: new Set([
    "revalidation_requested",
    "revalidation_completed",
    "needs_follow_up",
  ]),
};

export function validateContactDataQualityResolutionRecord(
  resolution: ContactDataQualityResolutionRecord,
): void {
  if (!resolution.firmId.trim()) throw new Error("Contact quality resolution requires a firm id");
  if (!resolution.contactId.trim()) {
    throw new Error("Contact quality resolution requires a contact id");
  }
  if (!contactDossierQualitySignalKinds.includes(resolution.signalKind)) {
    throw new Error("Contact data-quality resolution signal kind is invalid");
  }
  if (
    !contactDataQualityResolutionDecisionsByKind[resolution.signalKind].has(resolution.decision)
  ) {
    throw new Error("Contact data-quality resolution decision is invalid for the signal kind");
  }
  if (!resolution.resolutionNote.trim()) {
    throw new Error("Contact data-quality resolution note is required");
  }
  if (Number.isNaN(new Date(resolution.recordedAt).getTime())) {
    throw new Error("Contact data-quality resolution timestamp is invalid");
  }
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
  relationships: ContactDossierRelationshipRecord[];
  crmTaxonomy: ContactDossierCrmTaxonomy;
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

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function formatContactKindLabel(kind: Contact["kind"]): ContactDossierCrmTaxonomy["primaryLabel"] {
  return kind === "person" ? "Person" : "Company or organization";
}

function formatPartyRoleLabel(role: MatterParty["role"]): string {
  return role.replaceAll("_", " ");
}

function buildRelationshipLabel(
  contactRole: MatterParty["role"],
  relatedRole: MatterParty["role"],
): string {
  return `${formatPartyRoleLabel(contactRole)} to ${formatPartyRoleLabel(relatedRole)}`;
}

function buildRelationshipConflictSafeLabels(input: {
  contactLink: ContactDossierMatterLink;
  relatedLink: ContactDossierMatterLink;
}): string[] {
  return uniqueSorted([
    input.relatedLink.adverse ? "related adverse party" : "",
    input.relatedLink.confidential ? "related confidential party" : "",
    input.relatedLink.portalActive ? "related portal contact" : "",
    input.contactLink.adverse || input.relatedLink.adverse ? "conflict caution" : "",
    input.contactLink.confidential || input.relatedLink.confidential ? "confidential handling" : "",
  ]);
}

function buildContactRelationships(input: {
  contactId: string;
  contactLinks: ContactDossierMatterLink[];
  contactById: Map<string, Contact>;
  linksByContactId: Map<string, ContactDossierMatterLink[]>;
}): ContactDossierRelationshipRecord[] {
  const relationships: ContactDossierRelationshipRecord[] = [];
  const seen = new Set<string>();

  for (const contactLink of input.contactLinks) {
    for (const [relatedContactId, relatedLinks] of input.linksByContactId.entries()) {
      if (relatedContactId === input.contactId) continue;
      const relatedLink = relatedLinks.find((link) => link.matterId === contactLink.matterId);
      if (!relatedLink) continue;

      const relatedContact = input.contactById.get(relatedContactId);
      if (!relatedContact) continue;

      const key = [
        contactLink.matterId,
        relatedContact.displayName,
        relatedContact.kind,
        relatedLink.role,
      ].join(":");
      if (seen.has(key)) continue;
      seen.add(key);

      relationships.push({
        source: "matter_party",
        relationshipLabel: buildRelationshipLabel(contactLink.role, relatedLink.role),
        relatedContact: {
          kind: relatedContact.kind,
          displayName: relatedContact.displayName,
        },
        matter: {
          matterId: contactLink.matterId,
          matterNumber: contactLink.matterNumber,
          matterTitle: contactLink.matterTitle,
        },
        contactRole: contactLink.role,
        relatedRole: relatedLink.role,
        conflictSafeLabels: buildRelationshipConflictSafeLabels({ contactLink, relatedLink }),
      });
    }
  }

  return relationships.sort(
    (left, right) =>
      [
        left.matter.matterNumber.localeCompare(right.matter.matterNumber),
        left.relatedContact.displayName.localeCompare(right.relatedContact.displayName),
        left.relationshipLabel.localeCompare(right.relationshipLabel),
      ].find((comparison) => comparison !== 0) ?? 0,
  );
}

function buildContactCrmTaxonomy(input: {
  contact: Contact;
  links: ContactDossierMatterLink[];
  relationships: ContactDossierRelationshipRecord[];
}): ContactDossierCrmTaxonomy {
  const roleCounts = new Map<string, number>();
  for (const link of input.links) {
    const label = formatPartyRoleLabel(link.role);
    roleCounts.set(label, (roleCounts.get(label) ?? 0) + 1);
  }

  const relationshipCounts = new Map<string, number>();
  for (const relationship of input.relationships) {
    relationshipCounts.set(
      relationship.relationshipLabel,
      (relationshipCounts.get(relationship.relationshipLabel) ?? 0) + 1,
    );
  }

  const cues: ContactDossierCrmTaxonomyCue[] = [
    {
      kind: "contact_type",
      label: formatContactKindLabel(input.contact.kind),
      source: "contact",
    },
    ...Array.from(roleCounts.entries()).map(([label, count]) => ({
      kind: "matter_role" as const,
      label,
      source: "matter_party" as const,
      count,
    })),
    ...Array.from(relationshipCounts.entries()).map(([label, count]) => ({
      kind: "relationship_context" as const,
      label,
      source: "matter_party" as const,
      count,
    })),
  ];

  const confidentialCount = input.links.filter((link) => link.confidential).length;
  if (confidentialCount > 0) {
    cues.push({
      kind: "privacy_flag",
      label: "confidential matter",
      source: "matter_party",
      count: confidentialCount,
    });
  }

  const adverseCount = input.links.filter((link) => link.adverse).length;
  if (adverseCount > 0) {
    cues.push({
      kind: "privacy_flag",
      label: "adverse party",
      source: "matter_party",
      count: adverseCount,
    });
  }

  const portalCount = input.links.filter((link) => link.portalActive).length;
  if (portalCount > 0) {
    cues.push({
      kind: "portal_access",
      label: "portal contact",
      source: "portal_grant",
      count: portalCount,
    });
  }

  return {
    contactType: input.contact.kind,
    primaryLabel: formatContactKindLabel(input.contact.kind),
    cues,
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
      const relationships = buildContactRelationships({
        contactId,
        contactLinks: sortedMatters,
        contactById,
        linksByContactId,
      });
      return {
        contact: summarizeContact(contact),
        matters: sortedMatters,
        portal: {
          activeGrantCount: contactGrants.length,
          permissionLabels: uniquePermissions(contactGrants),
        },
        relationships,
        crmTaxonomy: buildContactCrmTaxonomy({
          contact,
          links: sortedMatters,
          relationships,
        }),
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
