import type {
  ContactDataQualityResolutionRecord,
  ContactDossier,
  ContactReviewQueueItem,
} from "./types";

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
    aliasesText: dossier.contact.aliases.join("\n"),
    identifiersText: dossier.contact.identifiers
      .map((identifier) => `${identifier.type}: ${identifier.value}`)
      .join("\n"),
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
      ...dossier.contact.aliases,
      ...dossier.contact.identifiers.map((identifier) => identifier.value),
      ...dossier.matters.flatMap((matter) => [
        matter.matterNumber,
        matter.matterTitle,
        matter.role,
        matter.practiceArea,
      ]),
      dossier.crmTaxonomy.primaryLabel,
      ...dossier.crmTaxonomy.cues.flatMap((cue) => [cue.kind, cue.label, cue.source]),
      ...dossier.relationships.flatMap((relationship) => [
        relationship.relationshipLabel,
        relationship.relatedContact.displayName,
        relationship.relatedContact.kind,
        relationship.matter.matterNumber,
        relationship.matter.matterTitle,
        relationship.contactRole,
        relationship.relatedRole,
        ...relationship.conflictSafeLabels,
      ]),
      ...dossier.qualityReview.signals.flatMap((signal) => [
        signal.kind,
        signal.reason,
        signal.sourceRecordId ?? "",
        signal.changedAt ?? "",
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
    dossier.matters.some((matter) => matter.adverse) ? "adverse" : null,
    dossier.matters.some((matter) => matter.confidential) ? "confidential" : null,
    dossier.portal.activeGrantCount > 0 ? "portal active" : null,
  ].filter(Boolean);
  return flags.length > 0 ? flags.join(" / ") : "standard";
}

export function formatContactKindLabel(kind: ContactDossier["contact"]["kind"]): string {
  return kind === "person" ? "Person" : "Company";
}

export function summarizeContactRelationshipCount(dossier: ContactDossier): string {
  const count = dossier.relationships.length;
  return `${count} relationship${count === 1 ? "" : "s"}`;
}

export function contactRelationshipRiskClass(
  relationship: ContactDossier["relationships"][number],
): "risk" | undefined {
  return relationship.conflictSafeLabels.some(
    (label) =>
      label === "conflict caution" ||
      label === "related adverse party" ||
      label === "confidential handling",
  )
    ? "risk"
    : undefined;
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
  ].filter(Boolean);
  return flags.length > 0 ? flags.join(" / ") : "review";
}

export function contactReviewQueueRiskClass(item: ContactReviewQueueItem): "risk" | undefined {
  return item.signals.some((signal) => signal.severity === "blocker") ? "risk" : undefined;
}

export function formatContactReviewSignalKind(kind: string): string {
  return kind.replaceAll("_", " ");
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

export const contactDataQualityResolutionActions: Record<
  ContactDossier["qualityReview"]["signals"][number]["kind"],
  ContactDataQualityResolutionAction[]
> = {
  duplicate_candidate: [
    { decision: "false_positive", label: "Not duplicate" },
    { decision: "needs_follow_up", label: "Needs review" },
  ],
  protected_party_cue: [
    { decision: "acknowledged", label: "Acknowledge" },
    { decision: "needs_follow_up", label: "Follow up" },
  ],
  conflict_revalidation: [
    { decision: "revalidation_completed", label: "Revalidated" },
    { decision: "revalidation_requested", label: "Request recheck" },
  ],
};

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
