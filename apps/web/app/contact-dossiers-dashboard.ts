import type { ContactDossier } from "./types";

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
        signal.matchedValue ?? "",
        signal.sourceRecordId ?? "",
        signal.changedAt ?? "",
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
