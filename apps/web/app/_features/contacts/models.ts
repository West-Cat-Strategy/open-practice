import type {
  Contact,
  ContactDataQualityResolutionRecord,
  ContactDossier,
  DashboardSectionCapability,
} from "@open-practice/domain/contact-models";

export type { ContactDataQualityResolutionRecord, ContactDossier };

export function canRecordContactDataQualityResolutions(
  sections: DashboardSectionCapability[],
): boolean {
  return sections.some(
    (section) =>
      section.key === "contacts" && section.enabled && section.actions.includes("update"),
  );
}

export type ContactDossiersResponse = ContactDossier[];

export type ContactReviewQueueSignal = Omit<
  ContactDossier["qualityReview"]["signals"][number],
  "matchedValue"
> & {
  matchedValueRedacted: boolean;
};

export interface ContactReviewQueueItem {
  contact: {
    id: string;
    kind: Contact["kind"];
    displayName: string;
    aliasCount: number;
    identifierCount: number;
  };
  matters: ContactDossier["matters"];
  summary: ContactDossier["qualityReview"]["summary"];
  signals: ContactReviewQueueSignal[];
  auditSafe: true;
}

export interface ContactReviewQueueResponse {
  summary: {
    totalContacts: number;
    reviewItemCount: number;
    duplicateCandidateCount: number;
    sensitivePartyCueCount: number;
    revalidationPromptCount: number;
  };
  items: ContactReviewQueueItem[];
}

export type ContactDataQualityResolutionsResponse = ContactDataQualityResolutionRecord[];
