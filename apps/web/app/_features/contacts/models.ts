import type {
  ActivityTimelineEntry,
  Contact,
  ContactDataQualityResolutionRecord,
  ContactDuplicateResolutionRecord,
  ContactDossier,
  ContactTimelineActivityFilter,
  DashboardSectionCapability,
} from "@open-practice/domain/contact-models";
import { contactTimelineActivityFilters } from "@open-practice/domain/contact-models";

export { contactTimelineActivityFilters };
export type {
  ContactDataQualityResolutionRecord,
  ContactDuplicateResolutionRecord,
  ContactDossier,
  ContactTimelineActivityFilter,
};

export function canRecordContactDataQualityResolutions(
  sections: DashboardSectionCapability[],
): boolean {
  return sections.some(
    (section) =>
      section.key === "contacts" && section.enabled && section.actions.includes("update"),
  );
}

export function canExportContactHistory(sections: DashboardSectionCapability[]): boolean {
  return sections.some(
    (section) =>
      section.key === "contacts" && section.enabled && section.actions.includes("export"),
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
    retentionHoldCueCount: number;
  };
  items: ContactReviewQueueItem[];
}

export type ContactDataQualityResolutionsResponse = ContactDataQualityResolutionRecord[];

export interface ContactDuplicateResolutionDecisionsResponse {
  reviewOnly: true;
  decisions: ContactDuplicateResolutionRecord[];
}

export interface ContactTimelineResponse {
  timeline: ActivityTimelineEntry[];
}

export interface ContactHistoryExportPreview {
  contactId: string;
  matterId: string;
  matterScoped: true;
  purpose: "staff_review";
  generatedAt: string;
  generatedByUserId: string;
  reviewReasonPresent: boolean;
  retentionPosture: string;
  legalHoldPosture: string;
  privacyPosture: string;
  redactedAuthorizedProjection: true;
  categoryPresence: Record<string, boolean>;
  counts: {
    generatedCategoryCount: number;
    timelineEntryCount: number;
    matterAssociationCount: number;
    relationshipCount: number;
    portalGrantCount: number;
    conflictSummaryCount: number;
    documentHoldCueCount: number;
    retentionHoldCueCount: number;
    dataQualityResolutionCount: number;
  };
  safeIds: {
    contactId: string;
    matterId: string;
    relationshipIds: string[];
    portalGrantIds: string[];
    conflictHistoryIds: string[];
    dataQualityResolutionIds: string[];
    timelineEntryIds: string[];
  };
  boundary: {
    storedBody: false;
    retainedExportArtifact: false;
    objectStorageArtifact: false;
    provider: false;
    broadQueue: false;
    deletionWorkflow: false;
    retentionDeadline: false;
    legalHoldOverride: false;
    hiddenMatterDisclosure: false;
    rawPrivateNotes: false;
    taskText: false;
    storageKeys: false;
    complianceClaim: false;
  };
}

export interface ContactHistoryExportResponse {
  preview: ContactHistoryExportPreview;
}
