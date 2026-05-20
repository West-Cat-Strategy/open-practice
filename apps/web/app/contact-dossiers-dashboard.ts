import type { ContactDossier, ContactReviewQueueItem } from "./types";

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
      ...dossier.qualityReview.signals.flatMap((signal) => [
        signal.kind,
        signal.reason,
        signal.matchedValueRedacted ? "value redacted" : "",
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
