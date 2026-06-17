import { apiGetOptional } from "../../_shared/server-api";
import type { ContactDataQualityResolutionsResponse, ContactReviewQueueResponse } from "./models";

function emptyContactReviewQueue(totalContacts: number): ContactReviewQueueResponse {
  return {
    summary: {
      totalContacts,
      reviewItemCount: 0,
      duplicateCandidateCount: 0,
      sensitivePartyCueCount: 0,
      revalidationPromptCount: 0,
      retentionHoldCueCount: 0,
    },
    items: [],
  };
}

export async function loadContactDashboardResources(input: {
  contactCount: number;
  headers: Record<string, string>;
}): Promise<{
  contactReviewQueue: ContactReviewQueueResponse;
  contactDataQualityResolutions: ContactDataQualityResolutionsResponse;
}> {
  const emptyReviewQueue = emptyContactReviewQueue(input.contactCount);
  const [contactReviewQueue, contactDataQualityResolutions] = await Promise.all([
    apiGetOptional<ContactReviewQueueResponse>(
      "/api/contacts/review-queue",
      emptyReviewQueue,
      input.headers,
      emptyReviewQueue,
    ),
    apiGetOptional<ContactDataQualityResolutionsResponse>(
      "/api/contacts/data-quality-resolutions",
      [],
      input.headers,
      [],
    ),
  ]);

  return { contactReviewQueue, contactDataQualityResolutions };
}
