import type {
  ContactDataQualityResolutionRecord,
  ContactDuplicateResolutionRecord,
  ContactDossier,
  ContactReviewQueueItem,
} from "./_features/contacts/models";

export interface ContactDossierConflictCheckPrefill {
  prospectiveName: string;
  aliasesText: string;
  identifiersText: string;
  prospectiveRole: "client" | "opposing_party" | "third_party";
  matterId?: string;
}

function inferProspectiveRole(
  role: ContactDossier["matters"][number]["role"] | undefined,
): ContactDossierConflictCheckPrefill["prospectiveRole"] {
  if (
    role === "client" ||
    role === "prospective_client" ||
    role === "notary_client" ||
    role === "paralegal_client"
  ) {
    return "client";
  }
  if (role === "opposing_party" || role === "opposing_counsel") return "opposing_party";
  return "third_party";
}

export function buildContactDossierConflictCheckPrefill(
  dossier: ContactDossier,
  preferredMatterId?: string,
): ContactDossierConflictCheckPrefill {
  const matterLink =
    dossier.matters.find((matter) => matter.matterId === preferredMatterId) ?? dossier.matters[0];
  return {
    prospectiveName: dossier.contact.displayName,
    aliasesText: [...dossier.contact.aliases, ...(dossier.contact.formerNames ?? [])].join("\n"),
    identifiersText: [
      ...dossier.contact.identifiers.map((identifier) => `${identifier.type}: ${identifier.value}`),
      ...(dossier.contact.contactMethods ?? [])
        .filter((method) => method.conflictCheckIncluded !== false && method.value)
        .map((method) => `${method.type}: ${method.value}`),
    ].join("\n"),
    prospectiveRole: inferProspectiveRole(matterLink?.role),
    matterId: matterLink?.matterId,
  };
}

export function filterContactDossiers(
  dossiers: ContactDossier[],
  search: string,
): ContactDossier[] {
  const query = search.trim().toLowerCase();
  if (!query) return dossiers;

  return dossiers.filter((dossier) => {
    const tokens = [
      dossier.contact.displayName,
      dossier.contact.kind,
      dossier.contact.status ?? "",
      dossier.contact.canonicalName ?? "",
      dossier.contact.givenName ?? "",
      dossier.contact.middleName ?? "",
      dossier.contact.familyName ?? "",
      dossier.contact.organizationLegalName ?? "",
      dossier.contact.organizationOperatingName ?? "",
      dossier.contact.organizationRegisteredName ?? "",
      dossier.contact.organizationType ?? "",
      dossier.contact.website ?? "",
      ...(dossier.contact.roleCategories ?? []),
      ...dossier.contact.aliases,
      ...(dossier.contact.formerNames ?? []),
      ...dossier.contact.identifiers.map((identifier) => identifier.value),
      ...(dossier.contact.contactMethods ?? []).flatMap((method) => [
        method.type,
        method.label,
        method.value ?? "",
        method.address?.line1 ?? "",
        method.address?.city ?? "",
        method.address?.postalCode ?? "",
      ]),
      ...dossier.matters.flatMap((matter) => [
        matter.matterNumber,
        matter.matterTitle,
        matter.role,
        matter.practiceArea,
      ]),
      ...dossier.crmTaxonomy.labels.map((label) => label.label),
      ...dossier.relationships.flatMap((relationship) => [
        relationship.relationshipKind,
        relationship.label,
        relationship.conflictSafeLabel,
        relationship.status,
        relationship.source,
        relationship.relatedContact.displayName,
        relationship.relatedContact.kind,
        ...relationship.visibleMatterIds,
      ]),
      ...dossier.qualityReview.signals.flatMap((signal) => [
        signal.kind,
        signal.reason,
        signal.duplicateReview?.candidate.displayName ?? "",
        signal.duplicateReview?.candidate.kind ?? "",
        signal.duplicateReview?.candidate.status ?? "",
        ...(signal.duplicateReview?.candidate.roleCategories ?? []),
        ...(signal.duplicateReview?.matchedFields ?? []),
        signal.sourceRecordId ?? "",
        signal.changedAt ?? "",
        ...(signal.retentionHoldReview?.cueReasons ?? []),
      ]),
      ...dossier.conflictHistory.flatMap((entry) => [
        entry.id,
        entry.disposition,
        entry.maxSeverity,
        ...entry.visibleMatchedMatterIds,
      ]),
    ];
    return tokens.some((token) => token.toLowerCase().includes(query));
  });
}

export function summarizeContactDossier(dossier: ContactDossier): string {
  const flags = [
    dossier.qualityReview.summary.duplicateCandidateCount > 0 ? "duplicate review" : null,
    dossier.qualityReview.summary.revalidationPromptCount > 0 ? "conflict recheck" : null,
    dossier.qualityReview.summary.retentionHoldCueCount > 0 ? "retention/hold review" : null,
    dossier.matters.some((matter) => matter.adverse) ? "adverse" : null,
    dossier.matters.some((matter) => matter.confidential) ? "confidential" : null,
    dossier.portal.activeGrantCount > 0 ? "portal active" : null,
    dossier.relationships.length > 0 ? "relationship graph" : null,
  ].filter(Boolean);
  return flags.length > 0 ? flags.join(" / ") : "standard";
}

export function contactDossierRiskClass(dossier: ContactDossier): "risk" | undefined {
  return dossier.conflictCues.some((cue) => cue.severity === "blocker") ||
    dossier.qualityReview.signals.some((signal) => signal.severity === "blocker")
    ? "risk"
    : undefined;
}

export function summarizeContactReviewQueueItem(item: ContactReviewQueueItem): string {
  const flags = [
    item.summary.duplicateCandidateCount > 0 ? "duplicate review" : null,
    item.summary.sensitivePartyCueCount > 0 ? "protected-party cue" : null,
    item.summary.revalidationPromptCount > 0 ? "conflict recheck" : null,
    item.summary.retentionHoldCueCount > 0 ? "retention/hold review" : null,
  ].filter(Boolean);
  return flags.length > 0 ? flags.join(" / ") : "review";
}

export function contactReviewQueueRiskClass(item: ContactReviewQueueItem): "risk" | undefined {
  return item.signals.some((signal) => signal.severity === "blocker") ? "risk" : undefined;
}

export function formatContactReviewSignalKind(kind: string): string {
  return kind.replaceAll("_", " ");
}

export function summarizeContactDuplicateReviewCue(
  signal: ContactDossier["qualityReview"]["signals"][number],
): string | undefined {
  if (!signal.duplicateReview) return undefined;
  const fields = signal.duplicateReview.matchedFields
    .map((field) => field.replaceAll("_", " "))
    .join(", ");
  const sharedMatterCopy =
    signal.duplicateReview.sharedVisibleMatterCount === 1
      ? "1 shared visible matter"
      : `${signal.duplicateReview.sharedVisibleMatterCount} shared visible matters`;
  return [
    signal.duplicateReview.candidate.displayName,
    signal.duplicateReview.candidate.kind,
    signal.duplicateReview.candidate.status,
    fields,
    `${signal.duplicateReview.matchCount} safe match${
      signal.duplicateReview.matchCount === 1 ? "" : "es"
    }`,
    sharedMatterCopy,
  ].join(" · ");
}

export type ContactDataQualityResolutionPayload = {
  contactId: string;
  signalKind: ContactDossier["qualityReview"]["signals"][number]["kind"];
  decision: ContactDataQualityResolutionRecord["decision"];
  matterId?: string;
  relatedContactId?: string;
  sourceRecordId?: string;
  resolutionNote: string;
};

export interface ContactDataQualityResolutionAction {
  decision: ContactDataQualityResolutionRecord["decision"];
  label: string;
}

type ContactNonDuplicateQualitySignalKind = Exclude<
  ContactDossier["qualityReview"]["signals"][number]["kind"],
  "duplicate_candidate"
>;

export const contactDataQualityResolutionActions: Record<
  ContactNonDuplicateQualitySignalKind,
  ContactDataQualityResolutionAction[]
> = {
  protected_party_cue: [
    { decision: "acknowledged", label: "Acknowledge" },
    { decision: "needs_follow_up", label: "Follow up" },
  ],
  conflict_revalidation: [
    { decision: "revalidation_completed", label: "Revalidated" },
    { decision: "revalidation_requested", label: "Request recheck" },
  ],
  retention_hold_review: [
    { decision: "acknowledged", label: "Acknowledge" },
    { decision: "needs_follow_up", label: "Follow up" },
  ],
};

export type ContactDuplicateResolutionPayload = {
  relatedContactId: string;
  decision: ContactDuplicateResolutionRecord["decision"];
  reason: ContactDuplicateResolutionRecord["reason"];
  idempotencyKey: string;
};

export interface ContactDuplicateResolutionAction {
  decision: ContactDuplicateResolutionRecord["decision"];
  reason: ContactDuplicateResolutionRecord["reason"];
  label: string;
}

export const contactDuplicateResolutionActions: ContactDuplicateResolutionAction[] = [
  {
    decision: "acknowledged_duplicate_candidate",
    reason: "safe_identity_match",
    label: "Acknowledge cue",
  },
  { decision: "not_duplicate", reason: "distinct_contact_verified", label: "Not duplicate" },
  { decision: "needs_follow_up", reason: "reviewer_follow_up_required", label: "Needs review" },
];

export function formatContactDataQualityResolutionDecision(
  decision: ContactDataQualityResolutionRecord["decision"],
): string {
  switch (decision) {
    case "false_positive":
      return "not duplicate";
    case "needs_follow_up":
      return "needs follow-up";
    case "revalidation_completed":
      return "revalidated";
    case "revalidation_requested":
      return "recheck requested";
    case "acknowledged":
      return "acknowledged";
  }
}

export function formatContactDuplicateResolutionDecision(
  decision: ContactDuplicateResolutionRecord["decision"],
): string {
  switch (decision) {
    case "acknowledged_duplicate_candidate":
      return "acknowledged duplicate cue";
    case "not_duplicate":
      return "not duplicate";
    case "needs_follow_up":
      return "needs follow-up";
  }
}

export function formatContactDuplicateResolutionReason(
  reason: ContactDuplicateResolutionRecord["reason"],
): string {
  switch (reason) {
    case "safe_identity_match":
      return "safe identity match";
    case "shared_visible_matter":
      return "shared visible matter";
    case "distinct_contact_verified":
      return "distinct contact verified";
    case "insufficient_safe_evidence":
      return "insufficient safe evidence";
    case "reviewer_follow_up_required":
      return "reviewer follow-up required";
  }
}

export function contactDataQualitySignalKey(
  contactId: string,
  signal: ContactDossier["qualityReview"]["signals"][number],
): string {
  return [
    contactId,
    signal.kind,
    signal.matterId ?? "contact",
    signal.relatedContactIds?.[0] ?? "no-related-contact",
    signal.sourceRecordId ?? "no-source-record",
  ].join(":");
}

export function contactDuplicateResolutionKey(
  contactId: string,
  signal: ContactDossier["qualityReview"]["signals"][number],
): string {
  return [
    "duplicate",
    contactId,
    signal.relatedContactIds?.[0] ?? signal.duplicateReview?.candidate.contactId ?? "no-related",
  ].join(":");
}

export function contactDataQualityResolutionMatchesSignal(
  resolution: ContactDataQualityResolutionRecord,
  signal: ContactDossier["qualityReview"]["signals"][number],
): boolean {
  if (resolution.signalKind !== signal.kind) return false;
  if ((resolution.matterId ?? undefined) !== (signal.matterId ?? undefined)) return false;
  if ((resolution.sourceRecordId ?? undefined) !== (signal.sourceRecordId ?? undefined)) {
    return false;
  }
  if (resolution.relatedContactId) {
    return (signal.relatedContactIds ?? []).includes(resolution.relatedContactId);
  }
  return !signal.relatedContactIds?.length;
}

export function contactDuplicateResolutionMatchesSignal(
  decision: ContactDuplicateResolutionRecord,
  signal: ContactDossier["qualityReview"]["signals"][number],
): boolean {
  return (
    signal.kind === "duplicate_candidate" &&
    (signal.relatedContactIds ?? []).includes(decision.relatedContactId)
  );
}

export function latestContactDataQualityResolutionForSignal(
  resolutions: ContactDataQualityResolutionRecord[],
  contactId: string,
  signal: ContactDossier["qualityReview"]["signals"][number],
): ContactDataQualityResolutionRecord | undefined {
  return resolutions
    .filter(
      (resolution) =>
        resolution.contactId === contactId &&
        contactDataQualityResolutionMatchesSignal(resolution, signal),
    )
    .sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt))[0];
}

export function latestContactDuplicateResolutionForSignal(
  decisions: ContactDuplicateResolutionRecord[],
  contactId: string,
  signal: ContactDossier["qualityReview"]["signals"][number],
): ContactDuplicateResolutionRecord | undefined {
  return decisions
    .filter(
      (decision) =>
        decision.contactId === contactId &&
        contactDuplicateResolutionMatchesSignal(decision, signal),
    )
    .sort((left, right) => Date.parse(right.reviewedAt) - Date.parse(left.reviewedAt))[0];
}

export function buildContactDataQualityResolutionPayload(
  dossier: ContactDossier,
  signal: ContactDossier["qualityReview"]["signals"][number],
  decision: ContactDataQualityResolutionRecord["decision"],
): ContactDataQualityResolutionPayload {
  return {
    contactId: dossier.contact.id,
    signalKind: signal.kind,
    decision,
    matterId: signal.matterId,
    relatedContactId: signal.relatedContactIds?.[0],
    sourceRecordId: signal.sourceRecordId,
    resolutionNote: `Contacts dashboard reviewer marked ${formatContactDataQualityResolutionDecision(
      decision,
    )} for ${formatContactReviewSignalKind(signal.kind)}.`,
  };
}

export function buildContactDuplicateResolutionPayload(
  dossier: ContactDossier,
  signal: ContactDossier["qualityReview"]["signals"][number],
  decision: ContactDuplicateResolutionRecord["decision"],
  reason: ContactDuplicateResolutionRecord["reason"],
): ContactDuplicateResolutionPayload {
  const relatedContactId =
    signal.relatedContactIds?.[0] ?? signal.duplicateReview?.candidate.contactId;
  if (!relatedContactId) {
    throw new Error("Duplicate resolution requires a related contact cue.");
  }
  return {
    relatedContactId,
    decision,
    reason,
    idempotencyKey: [
      "contact-duplicate-resolution",
      dossier.contact.id,
      relatedContactId,
      decision,
      reason,
    ].join(":"),
  };
}
