import { apiGetOptional } from "../../_shared/server-api";
import type {
  EmailTemplateDashboardResponse,
  EmailTemplateDraftListResponse,
  EmailTemplatePreviewSnapshotListResponse,
} from "./models";

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

export async function loadEmailTemplateDashboardData(input: {
  listTemplateDrafts: () => Promise<EmailTemplateDraftListResponse>;
}): Promise<EmailTemplateDashboardResponse> {
  const response = await input.listTemplateDrafts();
  return {
    templateDrafts: response.templateDrafts,
    previewSnapshotsByMatterId: {},
  };
}

export async function loadEmailTemplateDashboardResources(input: {
  headers: Record<string, string>;
}): Promise<EmailTemplateDashboardResponse> {
  return loadEmailTemplateDashboardData({
    listTemplateDrafts: () =>
      apiGetOptional<EmailTemplateDraftListResponse>(
        buildEmailTemplateDraftsPath(),
        { templateDrafts: [] },
        input.headers,
        { templateDrafts: [] },
      ),
  });
}

export const emptyEmailTemplatePreviewSnapshotResponse: EmailTemplatePreviewSnapshotListResponse = {
  previewSnapshots: [],
};
