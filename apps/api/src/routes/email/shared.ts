import type { AccessRequest } from "@open-practice/domain";
import { z } from "zod";
import { requireAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import type { ApiAuthContext } from "../../server.js";
import type { ApiRouteDependencies } from "../types.js";

export const relatedEmailResourceTypeSchema = z.enum([
  "document",
  "draft",
  "external_upload",
  "intake_session",
  "invoice",
  "share_link",
  "signature_request",
]);

export type RelatedEmailResourceType = z.infer<typeof relatedEmailResourceTypeSchema>;

export function assertEmailAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function requireReceiptSecret(jwtSecret: string | undefined): string {
  if (jwtSecret) return jwtSecret;
  throw new ApiHttpError(
    503,
    "EMAIL_RECEIPT_TOKEN_SIGNING_NOT_CONFIGURED",
    "Email receipt token signing is not configured",
  );
}

async function resolveRelatedEmailResourceMatterId(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  type: RelatedEmailResourceType,
  id: string,
): Promise<string | undefined> {
  if (type === "document") {
    return (await repository.getDocument(firmId, id))?.matterId;
  }
  if (type === "draft") {
    return (await repository.getDraft(firmId, id))?.matterId;
  }
  if (type === "external_upload") {
    return (await repository.listExternalUploadLinks(firmId)).find((link) => link.id === id)
      ?.matterId;
  }
  if (type === "intake_session") {
    return (await repository.getIntakeSession(firmId, id))?.matterId;
  }
  if (type === "invoice") {
    return (await repository.getInvoice(firmId, id))?.matterId;
  }
  if (type === "share_link") {
    return (await repository.getShareLink(firmId, id))?.matterId;
  }
  return (await repository.listSignatureRequests(firmId)).find((request) => request.id === id)
    ?.matterId;
}

export async function assertRelatedEmailResourceMatchesMatter(
  repository: ApiRouteDependencies["repository"],
  context: ApiAuthContext,
  input: {
    matterId: string;
    relatedResourceType?: RelatedEmailResourceType;
    relatedResourceId?: string;
  },
): Promise<void> {
  if (!input.relatedResourceType && !input.relatedResourceId) return;
  if (!input.relatedResourceType || !input.relatedResourceId) {
    throw Object.assign(
      new Error("relatedResourceType and relatedResourceId must be provided together"),
      {
        statusCode: 400,
      },
    );
  }

  const relatedMatterId = await resolveRelatedEmailResourceMatterId(
    repository,
    context.firmId,
    input.relatedResourceType,
    input.relatedResourceId,
  );
  if (!relatedMatterId) {
    throw Object.assign(new Error("Related email resource was not found"), { statusCode: 404 });
  }
  if (relatedMatterId !== input.matterId) {
    throw Object.assign(new Error("Related email resource does not match the email matter"), {
      statusCode: 403,
    });
  }
}
