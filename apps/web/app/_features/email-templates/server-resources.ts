import { apiGetOptional } from "../../_shared/server-api";
import type {
  EmailTemplateDashboardResponse,
  EmailTemplateDraftListResponse,
  EmailTemplatePublishedVersionListResponse,
  EmailTemplatePreviewSnapshotListResponse,
  EmailTemplateReviewedOutboundPreviewListResponse,
} from "./models";
import type { MatterSummary } from "../../types";

export function buildEmailTemplateDraftsPath(): string {
  return "/api/email/template-drafts";
}

export function buildEmailTemplatePreviewSnapshotsPath(
  templateDraftId: string,
  matterId: string,
  limit = 5,
): string {
  return `/api/email/template-drafts/${encodeURIComponent(
    templateDraftId,
  )}/preview-snapshots?matterId=${encodeURIComponent(matterId)}&limit=${limit}`;
}

export function buildEmailTemplatePublishedVersionsPath(
  templateDraftId: string,
  limit = 5,
): string {
  return `/api/email/template-drafts/${encodeURIComponent(templateDraftId)}/versions?limit=${limit}`;
}

export function buildEmailTemplateReviewedOutboundPreviewsPath(
  templateDraftId: string,
  matterId: string,
  limit = 5,
): string {
  return `/api/email/template-drafts/${encodeURIComponent(
    templateDraftId,
  )}/reviewed-outbound-previews?matterId=${encodeURIComponent(matterId)}&limit=${limit}`;
}

export async function loadEmailTemplateDashboardData(input: {
  listTemplateDrafts: () => Promise<EmailTemplateDraftListResponse>;
  listPreviewSnapshots?: (
    templateDraftId: string,
    matterId: string,
  ) => Promise<EmailTemplatePreviewSnapshotListResponse>;
  listPublishedVersions?: (
    templateDraftId: string,
  ) => Promise<EmailTemplatePublishedVersionListResponse>;
  listReviewedOutboundPreviews?: (
    templateDraftId: string,
    matterId: string,
  ) => Promise<EmailTemplateReviewedOutboundPreviewListResponse>;
  recentMatterIds?: string[];
}): Promise<EmailTemplateDashboardResponse> {
  const response = await input.listTemplateDrafts();
  const previewSnapshotsByMatterId: EmailTemplateDashboardResponse["previewSnapshotsByMatterId"] =
    {};
  const reviewedOutboundPreviewsByMatterId: EmailTemplateDashboardResponse["reviewedOutboundPreviewsByMatterId"] =
    {};
  const publishedVersionsByTemplateDraftId: EmailTemplateDashboardResponse["publishedVersionsByTemplateDraftId"] =
    {};
  const draftIds = response.templateDrafts
    .filter((draft) => draft.status !== "archived")
    .slice(0, 5)
    .map((draft) => draft.id);
  const matterIds = (input.recentMatterIds ?? []).filter(Boolean).slice(0, 3);

  if (input.listPreviewSnapshots && draftIds.length > 0 && matterIds.length > 0) {
    await Promise.all(
      matterIds.map(async (matterId) => {
        const snapshots = (
          await Promise.all(
            draftIds.map((draftId) => input.listPreviewSnapshots!(draftId, matterId)),
          )
        ).flatMap((snapshotResponse) => snapshotResponse.previewSnapshots);
        const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot] as const));
        previewSnapshotsByMatterId[matterId] = [...byId.values()]
          .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
          .slice(0, 5);
      }),
    );
  }

  if (input.listReviewedOutboundPreviews && draftIds.length > 0 && matterIds.length > 0) {
    await Promise.all(
      matterIds.map(async (matterId) => {
        const previews = (
          await Promise.all(
            draftIds.map((draftId) => input.listReviewedOutboundPreviews!(draftId, matterId)),
          )
        ).flatMap((previewResponse) => previewResponse.reviewedOutboundPreviews);
        const byId = new Map(previews.map((preview) => [preview.id, preview] as const));
        reviewedOutboundPreviewsByMatterId[matterId] = [...byId.values()]
          .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
          .slice(0, 5);
      }),
    );
  }

  if (input.listPublishedVersions && draftIds.length > 0) {
    await Promise.all(
      draftIds.map(async (draftId) => {
        const versionResponse = await input.listPublishedVersions!(draftId);
        publishedVersionsByTemplateDraftId[draftId] = versionResponse.publishedVersions.slice(0, 5);
      }),
    );
  }

  return {
    templateDrafts: response.templateDrafts,
    previewSnapshotsByMatterId,
    publishedVersionsByTemplateDraftId,
    reviewedOutboundPreviewsByMatterId,
  };
}

export async function loadEmailTemplateDashboardResources(input: {
  headers: Record<string, string>;
  matters?: Pick<MatterSummary, "id">[];
}): Promise<EmailTemplateDashboardResponse> {
  return loadEmailTemplateDashboardData({
    recentMatterIds: input.matters?.map((matter) => matter.id),
    listTemplateDrafts: () =>
      apiGetOptional<EmailTemplateDraftListResponse>(
        buildEmailTemplateDraftsPath(),
        { templateDrafts: [] },
        input.headers,
        { templateDrafts: [] },
      ),
    listPreviewSnapshots: (templateDraftId, matterId) =>
      apiGetOptional<EmailTemplatePreviewSnapshotListResponse>(
        buildEmailTemplatePreviewSnapshotsPath(templateDraftId, matterId),
        { previewSnapshots: [] },
        input.headers,
        { previewSnapshots: [] },
      ),
    listPublishedVersions: (templateDraftId) =>
      apiGetOptional<EmailTemplatePublishedVersionListResponse>(
        buildEmailTemplatePublishedVersionsPath(templateDraftId),
        { publishedVersions: [] },
        input.headers,
        { publishedVersions: [] },
      ),
    listReviewedOutboundPreviews: (templateDraftId, matterId) =>
      apiGetOptional<EmailTemplateReviewedOutboundPreviewListResponse>(
        buildEmailTemplateReviewedOutboundPreviewsPath(templateDraftId, matterId),
        { reviewedOutboundPreviews: [] },
        input.headers,
        { reviewedOutboundPreviews: [] },
      ),
  });
}
