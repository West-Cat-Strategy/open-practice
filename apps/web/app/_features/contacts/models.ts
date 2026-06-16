import type {
  ActivityTimelineEntry,
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
  };
  items: ContactReviewQueueItem[];
}

export type ContactDataQualityResolutionsResponse = ContactDataQualityResolutionRecord[];

export interface ContactTimelineResponse {
  timeline: ActivityTimelineEntry[];
}

export interface ContactHistoryExportResponse {
  exportRequest: {
    purpose: "staff_review";
    contactId: string;
    generatedAt: string;
    generatedByUserId: string;
    reviewReasonPresent: boolean;
    retentionPosture: string;
    legalHoldPosture: string;
    privacyPosture: string;
    storedBody: false;
  };
  export: {
    generatedAt: string;
    generatedByUserId: string;
    purpose: "staff_review";
    policyBoundary: Record<string, boolean>;
    categories: {
      identityPosture: Record<string, unknown>;
      namePosture: Record<string, unknown>;
      contactMethodPosture: Record<string, unknown>;
      relationshipPosture: unknown[];
      matterPartyPosture: unknown[];
      portalAccessPosture: { grants?: unknown[]; [key: string]: unknown };
      conflictReviewPosture: Record<string, unknown>;
      dataQualityAndDuplicateReviewPosture: Record<string, unknown>;
      timelineCues: unknown[];
    };
  };
}
