import type {
  ActivityTimelineEntry,
  Contact,
  ContactRoleCategory,
  ContactStatus,
  Matter,
  MatterParty,
  PortalGrant,
} from "./models.js";
import type { IntakeVariableProposal } from "./intake.js";
import {
  normalizeConflictToken,
  type ConflictCheckRecord,
  type ConflictSeverity,
} from "./conflicts.js";

export type ContactDossierContactSummary = Omit<
  Contact,
  "notes" | "privateNotes" | "createdByUserId" | "updatedByUserId"
>;

export interface ContactDossierMatterLink {
  associationId?: string;
  matterId: string;
  matterNumber: string;
  matterTitle: string;
  matterStatus: Matter["status"];
  practiceArea: string;
  role: MatterParty["role"];
  adverse: boolean;
  confidential: boolean;
  status?: MatterParty["status"];
  side?: MatterParty["side"];
  startedOn?: string;
  endedOn?: string;
  conflictCheckIncluded?: boolean;
  portalActive: boolean;
  portalPermissions: PortalGrant["permissions"];
}

export interface ContactDossierConflictCue {
  severity: "blocker" | "review" | "info";
  reason: string;
  matterId?: string;
}

export type ContactRelationshipKind =
  | "authorized_representative"
  | "director_of"
  | "employee_of"
  | "employer_of"
  | "expert_for"
  | "family_contact"
  | "family_member"
  | "guardian_of"
  | "insurer_for"
  | "lawyer_for"
  | "officer_of"
  | "owned_by"
  | "owner_of"
  | "parent_of"
  | "paralegal_for"
  | "partner_of"
  | "subsidiary_of"
  | "agent_for"
  | "opposing_counsel_for"
  | "opposing_party_for"
  | "referral_source"
  | "spouse_partner"
  | "witness_against"
  | "witness_for"
  | "custom";

export const contactRelationshipKinds = [
  "authorized_representative",
  "director_of",
  "employee_of",
  "employer_of",
  "expert_for",
  "family_contact",
  "family_member",
  "guardian_of",
  "insurer_for",
  "lawyer_for",
  "officer_of",
  "owned_by",
  "owner_of",
  "parent_of",
  "paralegal_for",
  "partner_of",
  "subsidiary_of",
  "agent_for",
  "opposing_counsel_for",
  "opposing_party_for",
  "referral_source",
  "spouse_partner",
  "witness_against",
  "witness_for",
  "custom",
] as const satisfies ContactRelationshipKind[];

export type ContactRelationshipSource = "manual" | "matter_party" | "intake";

export const contactRelationshipSources = [
  "manual",
  "matter_party",
  "intake",
] as const satisfies ContactRelationshipSource[];

export type ContactRelationshipStatus = "active" | "review_needed" | "ended";

export const contactRelationshipStatuses = [
  "active",
  "review_needed",
  "ended",
] as const satisfies ContactRelationshipStatus[];

export interface ContactRelationshipRecord {
  id: string;
  firmId: string;
  contactId: string;
  relatedContactId: string;
  relationshipKind: ContactRelationshipKind;
  label: string;
  reciprocalLabel?: string;
  matterId?: string;
  source: ContactRelationshipSource;
  status: ContactRelationshipStatus;
  effectiveOn?: string;
  endedOn?: string;
  notes?: string;
  privateNotes?: string;
  includeInConflictCheck?: boolean;
  createdByUserId?: string;
  updatedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactDossierRelationshipSummary {
  id: string;
  direction: "outbound" | "inbound";
  relationshipKind: ContactRelationshipKind;
  label: string;
  reciprocalLabel?: string;
  conflictSafeLabel: string;
  status: ContactRelationshipStatus;
  source: ContactRelationshipSource;
  effectiveOn?: string;
  endedOn?: string;
  includeInConflictCheck?: boolean;
  relatedContact: Pick<ContactDossierContactSummary, "kind" | "displayName">;
  visibleMatterIds: string[];
}

export interface ContactDossierCrmTaxonomy {
  entityType: "person" | "organization";
  status?: ContactStatus;
  roleCategories?: ContactRoleCategory[];
  labels: Array<{ key: string; label: string; severity: "info" | "review" | "blocker" }>;
  relatedMatterSummary: {
    total: number;
    clientRoleCount: number;
    adverseRoleCount: number;
    confidentialRoleCount: number;
    portalMatterCount: number;
  };
  relationshipSummary: {
    activeCount: number;
    reviewNeededCount: number;
    organizationCount: number;
    personCount: number;
  };
}

export const contactStatuses = [
  "prospective",
  "active",
  "inactive",
  "archived",
  "former",
  "restricted",
] as const satisfies ContactStatus[];

export const contactRoleCategories = [
  "prospective_client",
  "client",
  "former_client",
  "opposing_party",
  "related_party",
  "witness",
  "lawyer",
  "paralegal",
  "authorized_non_lawyer_provider",
  "legal_representative",
  "court_tribunal",
  "insurer",
  "expert",
  "vendor",
  "referral_source",
  "internal_team_member",
  "organization",
  "other",
] as const satisfies ContactRoleCategory[];

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

export const contactTimelineActivityFilters = [
  "all",
  "crm_activity",
  "task_cues",
  "open_tasks",
  "follow_ups",
] as const;

export type ContactTimelineActivityFilter = (typeof contactTimelineActivityFilters)[number];

const CONTACT_TIMELINE_CRM_ACTIVITY_KINDS = new Set<ActivityTimelineEntry["kind"]>([
  "audit",
  "conflict",
  "contact",
  "portal",
]);
const CONTACT_TIMELINE_TASK_CUE_TYPES = new Set(["open_task", "follow_up_review"]);

function contactTimelineCueType(entry: ActivityTimelineEntry): string | undefined {
  const cueType = entry.metadata.cueType;
  return typeof cueType === "string" ? cueType : undefined;
}

export function filterContactTimelineEntries(
  entries: ActivityTimelineEntry[],
  activity: ContactTimelineActivityFilter = "all",
): ActivityTimelineEntry[] {
  switch (activity) {
    case "all":
      return [...entries];
    case "crm_activity":
      return entries.filter((entry) => CONTACT_TIMELINE_CRM_ACTIVITY_KINDS.has(entry.kind));
    case "task_cues":
      return entries.filter(
        (entry) =>
          entry.kind === "task" &&
          CONTACT_TIMELINE_TASK_CUE_TYPES.has(contactTimelineCueType(entry) ?? ""),
      );
    case "open_tasks":
      return entries.filter(
        (entry) => entry.kind === "task" && contactTimelineCueType(entry) === "open_task",
      );
    case "follow_ups":
      return entries.filter(
        (entry) => entry.kind === "task" && contactTimelineCueType(entry) === "follow_up_review",
      );
  }
  const exhaustiveActivity: never = activity;
  return exhaustiveActivity;
}

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
  matchedOn?: "name" | "alias" | "former_name" | "identifier" | "contact_method" | "address";
  matchedValue?: string;
  duplicateReview?: ContactDuplicateReviewCue;
  sourceRecordId?: string;
  changedAt?: string;
}

export type ContactDuplicateMatchedField =
  | "name"
  | "alias"
  | "former_name"
  | "identifier"
  | "email"
  | "phone"
  | "website"
  | "address";

export interface ContactDuplicateReviewCue {
  candidate: {
    contactId: string;
    displayName: string;
    kind: Contact["kind"];
    status: ContactStatus;
    roleCategories: ContactRoleCategory[];
  };
  matchedFields: ContactDuplicateMatchedField[];
  matchCount: number;
  sharedVisibleMatterIds: string[];
  sharedVisibleMatterCount: number;
  reviewSeverity: "review";
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
  crmTaxonomy: ContactDossierCrmTaxonomy;
  relationships: ContactDossierRelationshipSummary[];
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
  contactRelationships?: ContactRelationshipRecord[];
  intakeVariableProposals?: IntakeVariableProposal[];
  conflictChecks?: ConflictCheckRecord[];
  now?: string;
}

function isActiveGrant(grant: PortalGrant, now: string): boolean {
  if (["suspended", "revoked", "expired"].includes(grant.status ?? "active")) return false;
  if (grant.revokedAt) return false;
  if (grant.suspendedAt) return false;
  if (!grant.expiresAt) return true;
  return Date.parse(grant.expiresAt) > Date.parse(now);
}

function uniquePermissions(grants: PortalGrant[]): PortalGrant["permissions"] {
  return Array.from(new Set(grants.flatMap((grant) => grant.permissions))).sort();
}

export function validateContactRecord(contact: Contact): void {
  if (!contact.firmId.trim()) throw new Error("Contact requires a firm id");
  if (!contact.displayName.trim()) throw new Error("Contact display name is required");
  if (!["person", "organization"].includes(contact.kind)) {
    throw new Error("Contact kind is invalid");
  }
  if (contact.status && !contactStatuses.includes(contact.status)) {
    throw new Error("Contact status is invalid");
  }
  for (const category of contact.roleCategories ?? []) {
    if (!contactRoleCategories.includes(category)) {
      throw new Error("Contact role category is invalid");
    }
  }
  if (
    contact.kind === "person" &&
    contact.organizationLegalName &&
    !contact.organizationOperatingName
  ) {
    throw new Error("Person contacts cannot use organization-only legal name fields");
  }
  if (
    contact.kind === "organization" &&
    (contact.givenName || contact.familyName) &&
    !contact.organizationLegalName
  ) {
    throw new Error("Organization contacts require organization naming when person names are set");
  }
  const methodIds = new Set<string>();
  for (const method of contact.contactMethods ?? []) {
    if (!method.id.trim()) throw new Error("Contact method requires an id");
    if (methodIds.has(method.id)) throw new Error("Contact method ids must be unique");
    methodIds.add(method.id);
    if (method.type !== "address" && !method.value?.trim()) {
      throw new Error("Contact method value is required");
    }
    if (method.type === "address" && !method.address?.line1?.trim()) {
      throw new Error("Contact address requires a first address line");
    }
  }
  if (contact.preferredContactMethodId && !methodIds.has(contact.preferredContactMethodId)) {
    throw new Error("Preferred contact method must reference an existing method");
  }
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

export function validateContactRelationshipRecord(relationship: ContactRelationshipRecord): void {
  if (!relationship.firmId.trim()) throw new Error("Contact relationship requires a firm id");
  if (!relationship.contactId.trim()) {
    throw new Error("Contact relationship requires a contact id");
  }
  if (!relationship.relatedContactId.trim()) {
    throw new Error("Contact relationship requires a related contact id");
  }
  if (relationship.contactId === relationship.relatedContactId) {
    throw new Error("Contact relationship related contact must differ from contact");
  }
  if (!contactRelationshipKinds.includes(relationship.relationshipKind)) {
    throw new Error("Contact relationship kind is invalid");
  }
  if (!relationship.label.trim()) throw new Error("Contact relationship label is required");
  if (!contactRelationshipSources.includes(relationship.source)) {
    throw new Error("Contact relationship source is invalid");
  }
  if (!contactRelationshipStatuses.includes(relationship.status)) {
    throw new Error("Contact relationship status is invalid");
  }
  if (relationship.effectiveOn && Number.isNaN(Date.parse(relationship.effectiveOn))) {
    throw new Error("Contact relationship effective date is invalid");
  }
  if (relationship.endedOn && Number.isNaN(Date.parse(relationship.endedOn))) {
    throw new Error("Contact relationship end date is invalid");
  }
  if (
    relationship.effectiveOn &&
    relationship.endedOn &&
    Date.parse(relationship.endedOn) < Date.parse(relationship.effectiveOn)
  ) {
    throw new Error("Contact relationship end date cannot be before effective date");
  }
  if (Number.isNaN(Date.parse(relationship.createdAt))) {
    throw new Error("Contact relationship created timestamp is invalid");
  }
  if (Number.isNaN(Date.parse(relationship.updatedAt))) {
    throw new Error("Contact relationship updated timestamp is invalid");
  }
}

function summarizeContactMethod(method: NonNullable<Contact["contactMethods"]>[number]) {
  return {
    id: method.id,
    type: method.type,
    label: method.label,
    value: method.value,
    address: method.address,
    preferred: method.preferred,
    doNotContact: method.doNotContact,
    verificationStatus: method.verificationStatus,
    conflictCheckIncluded: method.conflictCheckIncluded,
  };
}

function summarizeContact(contact: Contact): ContactDossierContactSummary {
  return {
    id: contact.id,
    firmId: contact.firmId,
    kind: contact.kind,
    status: contact.status ?? "active",
    roleCategories: contact.roleCategories ?? [],
    canonicalName: contact.canonicalName,
    displayName: contact.displayName,
    givenName: contact.givenName,
    middleName: contact.middleName,
    familyName: contact.familyName,
    title: contact.title,
    pronouns: contact.pronouns,
    organizationLegalName: contact.organizationLegalName,
    organizationOperatingName: contact.organizationOperatingName,
    organizationRegisteredName: contact.organizationRegisteredName,
    organizationType: contact.organizationType,
    website: contact.website,
    aliases: contact.aliases,
    formerNames: contact.formerNames ?? [],
    identifiers: contact.identifiers,
    contactMethods: (contact.contactMethods ?? []).map(summarizeContactMethod),
    preferredContactMethodId: contact.preferredContactMethodId,
    preferredLanguage: contact.preferredLanguage,
    timezone: contact.timezone,
    communicationNotes: contact.communicationNotes,
    accessibilityNotes: contact.accessibilityNotes,
    riskFlags: contact.riskFlags ?? [],
    conflictSensitive: contact.conflictSensitive ?? false,
    adverse: contact.adverse ?? false,
    confidentialityMarker: contact.confidentialityMarker ?? "standard",
    doNotContact: contact.doNotContact ?? false,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

const clientLikeRoles = new Set<MatterParty["role"]>([
  "client",
  "prospective_client",
  "former_client",
  "notary_client",
  "paralegal_client",
]);

function relationshipKindLabel(kind: ContactRelationshipKind): string {
  switch (kind) {
    case "agent_for":
      return "agent for";
    case "authorized_representative":
      return "authorized representative";
    case "custom":
      return "custom relationship";
    case "director_of":
      return "director of";
    case "employee_of":
      return "employee of";
    case "employer_of":
      return "employer of";
    case "expert_for":
      return "expert for";
    case "family_contact":
      return "family contact";
    case "family_member":
      return "family member";
    case "guardian_of":
      return "guardian of";
    case "insurer_for":
      return "insurer for";
    case "lawyer_for":
      return "lawyer for";
    case "officer_of":
      return "officer of";
    case "opposing_counsel_for":
      return "opposing counsel";
    case "opposing_party_for":
      return "matter counterparty";
    case "owned_by":
      return "owned by";
    case "owner_of":
      return "owner of";
    case "parent_of":
      return "parent organization";
    case "paralegal_for":
      return "paralegal for";
    case "partner_of":
      return "partner of";
    case "referral_source":
      return "referral source";
    case "spouse_partner":
      return "spouse or partner";
    case "subsidiary_of":
      return "subsidiary of";
    case "witness_against":
      return "witness against";
    case "witness_for":
      return "witness for";
  }
}

function buildRelationshipSummaries(input: {
  contactId: string;
  firmId: string;
  contactById: Map<string, Contact>;
  relationships: ContactRelationshipRecord[];
  visibleMatterIds: Set<string>;
}): ContactDossierRelationshipSummary[] {
  return input.relationships
    .filter((relationship) => relationship.firmId === input.firmId)
    .flatMap((relationship): ContactDossierRelationshipSummary[] => {
      const outbound = relationship.contactId === input.contactId;
      const inbound = relationship.relatedContactId === input.contactId;
      if (!outbound && !inbound) return [];
      if (relationship.matterId && !input.visibleMatterIds.has(relationship.matterId)) return [];

      const relatedContactId = outbound ? relationship.relatedContactId : relationship.contactId;
      const relatedContact = input.contactById.get(relatedContactId);
      if (!relatedContact) return [];

      const label =
        relationship.label.trim() || relationshipKindLabel(relationship.relationshipKind);
      const reciprocalLabel = relationship.reciprocalLabel?.trim();
      const conflictSafeLabel =
        relationship.status === "review_needed" ? `${label} needs review` : label;

      return [
        {
          id: relationship.id,
          direction: outbound ? "outbound" : "inbound",
          relationshipKind: relationship.relationshipKind,
          label: inbound && reciprocalLabel ? reciprocalLabel : label,
          reciprocalLabel: reciprocalLabel || undefined,
          conflictSafeLabel,
          status: relationship.status,
          source: relationship.source,
          effectiveOn: relationship.effectiveOn,
          endedOn: relationship.endedOn,
          includeInConflictCheck: relationship.includeInConflictCheck ?? true,
          relatedContact: {
            kind: relatedContact.kind,
            displayName: relatedContact.displayName,
          },
          visibleMatterIds: relationship.matterId ? [relationship.matterId] : [],
        },
      ];
    })
    .sort((left, right) =>
      `${left.relatedContact.displayName}:${left.label}`.localeCompare(
        `${right.relatedContact.displayName}:${right.label}`,
      ),
    );
}

function buildCrmTaxonomy(input: {
  contact: Contact;
  links: ContactDossierMatterLink[];
  relationships: ContactDossierRelationshipSummary[];
}): ContactDossierCrmTaxonomy {
  const status = input.contact.status ?? "active";
  const roleCategories = input.contact.roleCategories ?? [];
  const labels: ContactDossierCrmTaxonomy["labels"] = [
    {
      key: input.contact.kind,
      label: input.contact.kind === "organization" ? "organization" : "person",
      severity: "info",
    },
    {
      key: `status_${status}`,
      label: status,
      severity: status === "restricted" ? "blocker" : status === "archived" ? "review" : "info",
    },
  ];
  for (const category of roleCategories) {
    labels.push({
      key: `role_${category}`,
      label: category.replaceAll("_", " "),
      severity: category === "opposing_party" || category === "former_client" ? "review" : "info",
    });
  }
  if (input.links.some((link) => clientLikeRoles.has(link.role))) {
    labels.push({ key: "client_contact", label: "client contact", severity: "info" });
  }
  if (input.contact.conflictSensitive) {
    labels.push({
      key: "conflict_sensitive",
      label: "conflict-sensitive",
      severity: "review",
    });
  }
  if (input.contact.confidentialityMarker === "restricted") {
    labels.push({ key: "restricted_contact", label: "restricted", severity: "blocker" });
  } else if (input.contact.confidentialityMarker === "confidential") {
    labels.push({ key: "confidential_contact", label: "confidential", severity: "review" });
  }
  if (input.contact.doNotContact) {
    labels.push({ key: "do_not_contact", label: "do not contact", severity: "review" });
  }
  if (input.links.some((link) => link.adverse)) {
    labels.push({ key: "adverse_party", label: "adverse party", severity: "blocker" });
  }
  if (input.links.some((link) => link.confidential)) {
    labels.push({
      key: "confidential_handling",
      label: "confidential handling",
      severity: "review",
    });
  }
  if (input.links.some((link) => link.portalActive)) {
    labels.push({ key: "portal_enabled", label: "portal enabled", severity: "review" });
  }
  if (input.relationships.length > 0) {
    labels.push({ key: "relationship_graph", label: "relationship graph", severity: "info" });
  }

  return {
    entityType: input.contact.kind,
    status,
    roleCategories,
    labels,
    relatedMatterSummary: {
      total: input.links.length,
      clientRoleCount: input.links.filter((link) => clientLikeRoles.has(link.role)).length,
      adverseRoleCount: input.links.filter((link) => link.adverse).length,
      confidentialRoleCount: input.links.filter((link) => link.confidential).length,
      portalMatterCount: input.links.filter((link) => link.portalActive).length,
    },
    relationshipSummary: {
      activeCount: input.relationships.filter((relationship) => relationship.status === "active")
        .length,
      reviewNeededCount: input.relationships.filter(
        (relationship) => relationship.status === "review_needed",
      ).length,
      organizationCount: input.relationships.filter(
        (relationship) => relationship.relatedContact.kind === "organization",
      ).length,
      personCount: input.relationships.filter(
        (relationship) => relationship.relatedContact.kind === "person",
      ).length,
    },
  };
}

function normalizedContactNames(contact: Contact): Array<{
  matchedOn: "name" | "alias" | "former_name";
  matchedField: ContactDuplicateMatchedField;
  matchedValue: string;
  normalizedValue: string;
}> {
  return [
    {
      matchedOn: "name" as const,
      matchedField: "name" as const,
      matchedValue: contact.displayName,
    },
    ...(contact.canonicalName
      ? [
          {
            matchedOn: "name" as const,
            matchedField: "name" as const,
            matchedValue: contact.canonicalName,
          },
        ]
      : []),
    ...(contact.organizationLegalName
      ? [
          {
            matchedOn: "name" as const,
            matchedField: "name" as const,
            matchedValue: contact.organizationLegalName,
          },
        ]
      : []),
    ...(contact.organizationOperatingName
      ? [
          {
            matchedOn: "name" as const,
            matchedField: "name" as const,
            matchedValue: contact.organizationOperatingName,
          },
        ]
      : []),
    ...(contact.organizationRegisteredName
      ? [
          {
            matchedOn: "name" as const,
            matchedField: "name" as const,
            matchedValue: contact.organizationRegisteredName,
          },
        ]
      : []),
    ...contact.aliases.map((alias) => ({
      matchedOn: "alias" as const,
      matchedField: "alias" as const,
      matchedValue: alias,
    })),
    ...(contact.formerNames ?? []).map((formerName) => ({
      matchedOn: "former_name" as const,
      matchedField: "former_name" as const,
      matchedValue: formerName,
    })),
  ]
    .map((entry) => ({ ...entry, normalizedValue: normalizeConflictToken(entry.matchedValue) }))
    .filter((entry) => entry.normalizedValue.length > 0);
}

function normalizedContactIdentifiers(contact: Contact): Array<{
  matchedOn: "identifier" | "contact_method" | "address";
  matchedField: ContactDuplicateMatchedField;
  matchedValue: string;
  normalizedValue: string;
}> {
  type ContactDuplicateEvidenceSource = {
    matchedOn: "identifier" | "contact_method" | "address";
    matchedField: ContactDuplicateMatchedField;
    type: string;
    value: string;
  };
  const addressParts = (method: NonNullable<Contact["contactMethods"]>[number]): string[] =>
    [
      method.address?.line1,
      method.address?.line2,
      method.address?.city,
      method.address?.province,
      method.address?.postalCode,
      method.address?.country,
      [
        method.address?.line1,
        method.address?.line2,
        method.address?.city,
        method.address?.province,
        method.address?.postalCode,
        method.address?.country,
      ]
        .filter(Boolean)
        .join(" "),
    ].filter((part): part is string => Boolean(part?.trim()));
  const identifiers: ContactDuplicateEvidenceSource[] = contact.identifiers
    .filter((identifier) => identifier.conflictCheckIncluded !== false)
    .map((identifier) => ({
      matchedOn: "identifier",
      matchedField: "identifier",
      type: identifier.type,
      value: identifier.value,
    }));
  const methods: ContactDuplicateEvidenceSource[] = (contact.contactMethods ?? [])
    .filter((method) => method.conflictCheckIncluded !== false)
    .flatMap((method): ContactDuplicateEvidenceSource[] => {
      if (method.type === "address") {
        return addressParts(method).map((value) => ({
          matchedOn: "address",
          matchedField: "address",
          type: "address",
          value,
        }));
      }
      return method.value
        ? [
            {
              matchedOn: "contact_method",
              matchedField: method.type,
              type: method.type,
              value: method.value,
            },
          ]
        : [];
    });
  const website: ContactDuplicateEvidenceSource[] = contact.website
    ? [
        {
          matchedOn: "contact_method",
          matchedField: "website",
          type: "website",
          value: contact.website,
        },
      ]
    : [];

  return [...identifiers, ...methods, ...website]
    .map((entry) => ({
      matchedOn: entry.matchedOn,
      matchedField: entry.matchedField,
      matchedValue: `${entry.type}:${entry.value}`,
      normalizedValue: `${entry.type}:${normalizeConflictToken(entry.value)}`,
    }))
    .filter((entry) => entry.normalizedValue.length > entry.normalizedValue.indexOf(":") + 1);
}

function buildDuplicateSignals(
  contact: Contact,
  contacts: Contact[],
  links: ContactDossierMatterLink[],
  linksByContactId: Map<string, ContactDossierMatterLink[]>,
): ContactDossierQualitySignal[] {
  const signalsByCandidate = new Map<string, ContactDossierQualitySignal>();
  const names = normalizedContactNames(contact);
  const identifiers = normalizedContactIdentifiers(contact);
  const contactMatterIds = new Set(links.map((link) => link.matterId));

  for (const candidate of contacts) {
    if (candidate.id === contact.id) continue;

    const matchedFields = new Set<ContactDuplicateMatchedField>();
    const matchedValues = new Set<string>();
    let matchedOn: ContactDossierQualitySignal["matchedOn"];
    let matchedValue: string | undefined;

    const candidateNames = normalizedContactNames(candidate);
    for (const name of names) {
      if (
        candidateNames.some(
          (candidateEntry) => candidateEntry.normalizedValue === name.normalizedValue,
        )
      ) {
        matchedFields.add(name.matchedField);
        matchedValues.add(`name:${name.normalizedValue}`);
        matchedOn ??= name.matchedOn;
        matchedValue ??= name.matchedValue;
      }
    }

    const candidateIdentifiers = normalizedContactIdentifiers(candidate);
    for (const identifier of identifiers) {
      if (
        candidateIdentifiers.some(
          (candidateEntry) => candidateEntry.normalizedValue === identifier.normalizedValue,
        )
      ) {
        matchedFields.add(identifier.matchedField);
        matchedValues.add(`identifier:${identifier.normalizedValue}`);
        matchedOn ??= identifier.matchedOn;
        matchedValue ??= identifier.matchedValue;
      }
    }

    if (matchedFields.size === 0 || matchedValues.size === 0) continue;

    const candidateLinks = linksByContactId.get(candidate.id) ?? [];
    const sharedVisibleMatterIds = Array.from(
      new Set(
        candidateLinks
          .map((link) => link.matterId)
          .filter((matterId) => contactMatterIds.has(matterId)),
      ),
    ).sort();
    const fieldList = Array.from(matchedFields).sort();
    signalsByCandidate.set(candidate.id, {
      kind: "duplicate_candidate",
      severity: "review",
      reason: `Possible duplicate contact by ${fieldList
        .map((field) => field.replaceAll("_", " "))
        .join(", ")}`,
      relatedContactIds: [candidate.id],
      matchedOn,
      matchedValue,
      duplicateReview: {
        candidate: {
          contactId: candidate.id,
          displayName: candidate.displayName,
          kind: candidate.kind,
          status: candidate.status ?? "active",
          roleCategories: candidate.roleCategories ?? [],
        },
        matchedFields: fieldList,
        matchCount: matchedValues.size,
        sharedVisibleMatterIds,
        sharedVisibleMatterCount: sharedVisibleMatterIds.length,
        reviewSeverity: "review",
      },
    });
  }

  return Array.from(signalsByCandidate.values()).sort((left, right) =>
    (left.duplicateReview?.candidate.displayName ?? "").localeCompare(
      right.duplicateReview?.candidate.displayName ?? "",
    ),
  );
}

function buildSensitivePartySignals(
  contact: Contact,
  links: ContactDossierMatterLink[],
): ContactDossierQualitySignal[] {
  const contactSignals: ContactDossierQualitySignal[] = [];
  if (contact.conflictSensitive || contact.confidentialityMarker === "restricted") {
    contactSignals.push({
      kind: "protected_party_cue",
      severity: contact.confidentialityMarker === "restricted" ? "blocker" : "review",
      reason: "Contact carries conflict-sensitive or restricted handling flags",
    });
  }
  if (contact.doNotContact) {
    contactSignals.push({
      kind: "protected_party_cue",
      severity: "review",
      reason: "Contact has a do-not-contact flag",
    });
  }
  return [
    ...contactSignals,
    ...links.flatMap((link) => {
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
    }),
  ];
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
  linksByContactId: Map<string, ContactDossierMatterLink[]>;
  intakeVariableProposals: IntakeVariableProposal[];
  visibleMatterIds: Set<string>;
}): ContactDossierQualityReview {
  const duplicateSignals = buildDuplicateSignals(
    input.contact,
    input.contacts,
    input.links,
    input.linksByContactId,
  );
  const sensitivePartySignals = buildSensitivePartySignals(input.contact, input.links);
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
      associationId: party.id,
      matterId: matter.id,
      matterNumber: matter.number,
      matterTitle: matter.title,
      matterStatus: matter.status,
      practiceArea: matter.practiceArea,
      role: party.role,
      adverse: party.adverse,
      confidential: party.confidential,
      status: party.status ?? "active",
      side: party.side,
      startedOn: party.startedOn,
      endedOn: party.endedOn,
      conflictCheckIncluded: party.conflictCheckIncluded ?? true,
      portalActive: grants.length > 0,
      portalPermissions: uniquePermissions(grants),
    });
    linksByContactId.set(party.contactId, links);
  }

  return Array.from(contactById.keys())
    .map((contactId) => {
      const contact = contactById.get(contactId)!;
      const matters = linksByContactId.get(contactId) ?? [];
      const contactGrants = activePortalGrants.filter((grant) => grant.contactId === contactId);
      const sortedMatters = matters.sort((left, right) =>
        left.matterNumber.localeCompare(right.matterNumber),
      );
      const relationships = buildRelationshipSummaries({
        contactId,
        firmId: input.firmId,
        contactById,
        relationships: input.contactRelationships ?? [],
        visibleMatterIds,
      });
      return {
        contact: summarizeContact(contact),
        matters: sortedMatters,
        portal: {
          activeGrantCount: contactGrants.length,
          permissionLabels: uniquePermissions(contactGrants),
        },
        crmTaxonomy: buildCrmTaxonomy({
          contact,
          links: sortedMatters,
          relationships,
        }),
        relationships,
        conflictCues: buildConflictCues(sortedMatters),
        qualityReview: buildQualityReview({
          contact,
          contacts: visibleContacts,
          links: sortedMatters,
          linksByContactId,
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
