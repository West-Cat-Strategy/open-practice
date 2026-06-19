import { requestDashboardJson } from "../../api-client";
import {
  buildExternalUploadCreatePayload,
  buildExternalUploadReviewPayload,
  buildExternalUploadReviewPath,
  buildExternalUploadRevokePath,
  type ExternalUploadReviewDecision,
  type ExternalUploadReviewReason,
} from "../../external-uploads-dashboard";
import type { ExternalUploadCreateResponse } from "./models";

export async function requestExternalUploadLinkCreation(input: {
  apiBaseUrl: string;
  headers: Record<string, string>;
  matterId: string;
  maxUploads: string;
  expiresAtLocal: string;
}): Promise<ExternalUploadCreateResponse> {
  return requestDashboardJson<ExternalUploadCreateResponse>(
    input.apiBaseUrl,
    "/api/external-uploads",
    {
      method: "POST",
      headers: input.headers,
      payload: buildExternalUploadCreatePayload({
        matterId: input.matterId,
        maxUploads: input.maxUploads,
        expiresAtLocal: input.expiresAtLocal,
      }),
    },
  );
}

export async function requestExternalUploadLinkRevocation(input: {
  apiBaseUrl: string;
  headers: Record<string, string>;
  uploadId: string;
}): Promise<Response> {
  return fetch(`${input.apiBaseUrl}${buildExternalUploadRevokePath(input.uploadId)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...input.headers,
      "Content-Type": "application/json",
    },
  });
}

export async function requestExternalUploadDocumentReview(input: {
  apiBaseUrl: string;
  headers: Record<string, string>;
  documentId: string;
  decision: ExternalUploadReviewDecision;
  reason?: ExternalUploadReviewReason | "";
  duplicateOfDocumentId?: string;
  note?: string;
}): Promise<Response> {
  return fetch(`${input.apiBaseUrl}${buildExternalUploadReviewPath(input.documentId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      ...input.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildExternalUploadReviewPayload({
        decision: input.decision,
        reason: input.reason,
        duplicateOfDocumentId: input.duplicateOfDocumentId,
        note: input.note,
      }),
    ),
  });
}
