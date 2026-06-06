import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";
import { renderDraftExport } from "@open-practice/providers";
import {
  buildDraftExportDocument,
  draftExportFormats,
  sanitizeDraftHtml,
  tipTapDocumentSchema,
  UnknownDraftMergeFieldError,
  type DraftRecord,
  type DraftTemplateRecord,
  type DraftMergeContext,
} from "@open-practice/domain";

const draftListQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
});

const createDraftBodySchema = z
  .object({
    matterId: z.string().min(1).optional(),
    title: z.string().min(1),
    editorJson: tipTapDocumentSchema.optional(),
    templateId: z.string().min(1).optional(),
    renderedHtml: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .refine((body) => Boolean(body.editorJson) !== Boolean(body.templateId), {
    message: "Provide exactly one of editorJson or templateId",
    path: ["editorJson"],
  });

const updateDraftBodySchema = z.object({
  title: z.string().min(1).optional(),
  editorJson: tipTapDocumentSchema.optional(),
  renderedHtml: z.string().optional(),
});

const createTemplateBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  editorJson: tipTapDocumentSchema,
  category: z.string().min(1).default("general"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const templateListQuerySchema = z.object({
  category: z.string().min(1).optional(),
  activeOnly: z
    .preprocess((value) => {
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
      }
      return value;
    }, z.boolean())
    .default(true),
});

const exportDraftBodySchema = z.object({
  format: z.enum(draftExportFormats),
  title: z.string().min(1).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function assertAccess(
  context: ApiAuthContext,
  resource: "draft" | "draft_template",
  action: "create" | "read" | "update" | "delete",
  matterId?: string,
): void {
  const access = requireAccess(context, { resource, action, matterId });
  if (!access.ok) throw access.error;
}

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

export function registerDraftRoutes(
  server: FastifyInstance,
  { repository, s3 }: ApiRouteDependencies,
): void {
  // --- Drafts ---

  server.get("/api/drafts", async (request) => {
    const query = parseRequestPart(draftListQuerySchema, request.query, "query");
    assertAccess(request.auth, "draft", "read", query.matterId);

    return repository.listDrafts(request.auth.firmId, query);
  });

  server.get("/api/drafts/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const draft = await repository.getDraft(request.auth.firmId, params.id);
    if (!draft) {
      throw Object.assign(new Error("Draft was not found"), { statusCode: 404 });
    }
    assertAccess(request.auth, "draft", "read", draft.matterId);

    return draft;
  });

  server.post("/api/drafts", async (request) => {
    const body = parseRequestPart(createDraftBodySchema, request.body, "body");
    assertAccess(request.auth, "draft", "create", body.matterId);

    const template = body.templateId
      ? (await repository.listDraftTemplates(request.auth.firmId, { activeOnly: true })).find(
          (candidate) => candidate.id === body.templateId,
        )
      : undefined;
    if (body.templateId && !template) {
      throw Object.assign(new Error("Draft template was not found"), { statusCode: 404 });
    }

    const draftId = crypto.randomUUID();
    const now = new Date().toISOString();

    const draft: DraftRecord = {
      id: draftId,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      title: body.title,
      editorJson: template?.editorJson ?? body.editorJson!,
      renderedHtml: body.renderedHtml ? sanitizeDraftHtml(body.renderedHtml) : undefined,
      version: 1,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
      createdAt: now,
      updatedAt: now,
      metadata: body.templateId ? { ...body.metadata, templateId: body.templateId } : body.metadata,
    };

    const created = await repository.createDraft(draft);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "draft.created",
      resourceType: "draft",
      resourceId: created.id,
      metadata: {
        matterId: created.matterId,
        draftId: created.id,
        version: created.version,
      },
    });

    return created;
  });

  server.put("/api/drafts/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(updateDraftBodySchema, request.body, "body");

    const existing = await repository.getDraft(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Draft was not found"), { statusCode: 404 });
    }
    assertAccess(request.auth, "draft", "update", existing.matterId);

    const updates: Partial<DraftRecord> = {
      ...body,
      updatedByUserId: request.auth.user.id,
    };

    if (updates.renderedHtml) {
      updates.renderedHtml = sanitizeDraftHtml(updates.renderedHtml);
    }

    const updated = await repository.updateDraft(request.auth.firmId, params.id, updates);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "draft.updated",
      resourceType: "draft",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        draftId: updated.id,
        version: updated.version,
      },
    });

    return updated;
  });

  server.delete("/api/drafts/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const existing = await repository.getDraft(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Draft was not found"), { statusCode: 404 });
    }
    assertAccess(request.auth, "draft", "delete", existing.matterId);

    await repository.deleteDraft(request.auth.firmId, params.id);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "draft.deleted",
      resourceType: "draft",
      resourceId: params.id,
      metadata: {
        matterId: existing.matterId,
        draftId: params.id,
        version: existing.version,
      },
    });
    return { ok: true };
  });

  server.post("/api/drafts/:id/exports", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
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
    assertAccess(request.auth, "draft", "read", draft.matterId);
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

    const rendered = await renderDraftExport({
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

  // --- Templates ---

  server.get("/api/draft-templates", async (request) => {
    const query = parseRequestPart(templateListQuerySchema, request.query, "query");
    assertAccess(request.auth, "draft_template", "read");

    return repository.listDraftTemplates(request.auth.firmId, query);
  });

  server.post("/api/draft-templates", async (request) => {
    const body = parseRequestPart(createTemplateBodySchema, request.body, "body");
    assertAccess(request.auth, "draft_template", "create");

    const templateId = crypto.randomUUID();
    const now = new Date().toISOString();

    const template: DraftTemplateRecord = {
      id: templateId,
      firmId: request.auth.firmId,
      name: body.name,
      description: body.description,
      editorJson: body.editorJson,
      category: body.category,
      active: true,
      createdAt: now,
      updatedAt: now,
      metadata: body.metadata,
    };

    const created = await repository.createDraftTemplate(template);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "draft_template.created",
      resourceType: "draft_template",
      resourceId: created.id,
      metadata: {
        templateId: created.id,
        status: created.active ? "active" : "inactive",
      },
    });

    return created;
  });
}
