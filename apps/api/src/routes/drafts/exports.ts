import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  buildDraftExportDocument,
  draftExportFormats,
  UnknownDraftMergeFieldError,
  type DraftMergeContext,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertDraftRouteAccess, draftIdParamsSchema } from "./shared.js";

const exportDraftBodySchema = z.object({
  format: z.enum(draftExportFormats),
  title: z.string().min(1).optional(),
});

function sanitizeExportFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function contactIdentifier(
  contact: { identifiers?: Array<{ type: string; value: string }> },
  type: "email" | "phone",
): string | undefined {
  return contact.identifiers?.find((identifier) => identifier.type === type)?.value;
}

async function buildDraftMergeContext(
  context: ApiAuthContext,
  repository: ApiRouteDependencies["repository"],
  matterId: string,
): Promise<DraftMergeContext> {
  const [overview, settings, matters] = await Promise.all([
    repository.getOverview(context.firmId),
    repository.getFirmSettings(context.firmId),
    repository.listMattersForUser(context.user),
  ]);
  const matter = matters.find((candidate) => candidate.id === matterId);
  if (!matter) {
    throw Object.assign(new Error("Matter was not found"), { statusCode: 404 });
  }
  const clientParty = matter.parties.find(
    (party) =>
      !party.adverse &&
      ["client", "prospective_client", "notary_client", "paralegal_client"].includes(party.role),
  );

  return {
    firm: {
      name: overview.firm.name,
      officeEmail: settings?.officeEmail,
      officePhone: settings?.officePhone,
    },
    matter: {
      number: matter.number,
      title: matter.title,
      practiceArea: matter.practiceArea,
      jurisdiction: matter.jurisdiction,
    },
    client: clientParty
      ? {
          displayName: clientParty.contact.displayName,
          email: contactIdentifier(clientParty.contact, "email"),
          phone: contactIdentifier(clientParty.contact, "phone"),
        }
      : undefined,
  };
}

export function registerDraftExportRoutes(
  server: FastifyInstance,
  { repository, s3, draftExportRenderer }: ApiRouteDependencies,
): void {
  server.post("/api/drafts/:id/exports", async (request) => {
    const params = parseRequestPart(draftIdParamsSchema, request.params, "params");
    const body = parseRequestPart(exportDraftBodySchema, request.body, "body");
    const draft = await repository.getDraft(request.auth.firmId, params.id);
    if (!draft) {
      throw Object.assign(new Error("Draft was not found"), { statusCode: 404 });
    }
    if (!draft.matterId) {
      throw Object.assign(new Error("Matter-scoped draft is required for export"), {
        statusCode: 409,
      });
    }
    assertDraftRouteAccess(request.auth, "draft", "read", draft.matterId);
    if (!s3) {
      throw new ApiHttpError(
        503,
        "DOCUMENT_EXPORT_STORAGE_NOT_CONFIGURED",
        "Document export storage is not configured",
      );
    }

    const exportTitle = body.title ?? draft.title;
    const mergeContext = await buildDraftMergeContext(request.auth, repository, draft.matterId);
    let exportDocument;
    try {
      exportDocument = buildDraftExportDocument({
        title: exportTitle,
        editorJson: draft.editorJson,
        mergeContext,
      });
    } catch (error) {
      if (error instanceof UnknownDraftMergeFieldError) {
        throw Object.assign(error, {
          statusCode: 400,
          details: { fields: error.fields },
        });
      }
      throw error;
    }

    if (!draftExportRenderer) {
      throw new ApiHttpError(
        503,
        "DRAFT_EXPORT_PROVIDER_UNAVAILABLE",
        "Document export provider is not configured",
      );
    }

    const rendered = await draftExportRenderer({
      format: body.format,
      document: exportDocument,
    });
    const checksumSha256 = createHash("sha256").update(rendered.buffer).digest("hex");
    const checksumSha256Base64 = createHash("sha256").update(rendered.buffer).digest("base64");
    const documentId = crypto.randomUUID();
    const generatedDocumentId = crypto.randomUUID();
    const filename = `${sanitizeExportFilename(exportDocument.title)}.${rendered.extension}`;
    const storageKey = `matters/${draft.matterId}/draft-exports/${documentId}-${filename}`;

    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: storageKey,
        Body: rendered.buffer,
        ContentType: rendered.contentType,
        ChecksumSHA256: checksumSha256Base64,
        ...(s3.serverSideEncryption ? { ServerSideEncryption: s3.serverSideEncryption } : {}),
        Metadata: {
          "open-practice-matter-id": draft.matterId,
          "open-practice-draft-id": draft.id,
          "open-practice-export-format": body.format,
        },
      }),
    );

    const document = await repository.createDocumentUploadIntent({
      id: documentId,
      firmId: request.auth.firmId,
      matterId: draft.matterId,
      title: filename,
      storageKey,
      checksumSha256,
      classification: "work_product",
      legalHold: true,
    });
    const verifiedDocument = await repository.completeDocumentUpload({
      firmId: request.auth.firmId,
      documentId: document.id,
      checksumSha256,
      scanStatus: "passed",
    });
    const generatedDocument = await repository.createGeneratedDocument({
      id: generatedDocumentId,
      firmId: request.auth.firmId,
      matterId: draft.matterId,
      provider: "embedded",
      externalId: `draft-export:${draft.id}:${documentId}`,
      title: exportDocument.title,
      documentId: verifiedDocument.id,
      storageKey,
      checksumSha256,
      evidence: {
        source: "draft_export",
        draftId: draft.id,
        draftVersion: draft.version,
        format: body.format,
        byteLength: rendered.buffer.byteLength,
      },
      createdAt: new Date().toISOString(),
    });

    await appendRouteAuditEvent(repository, request.auth, {
      action: "draft.export.created",
      resourceType: "generated_document",
      resourceId: generatedDocument.id,
      metadata: {
        matterId: draft.matterId,
        draftId: draft.id,
        draftVersion: draft.version,
        documentId: verifiedDocument.id,
        generatedDocumentId: generatedDocument.id,
        format: body.format,
        checksumSha256,
        byteLength: rendered.buffer.byteLength,
      },
    });

    return {
      format: body.format,
      title: exportDocument.title,
      contentType: rendered.contentType,
      byteLength: rendered.buffer.byteLength,
      checksumSha256,
      storageKey,
      document: verifiedDocument,
      generatedDocument,
    };
  });
}
