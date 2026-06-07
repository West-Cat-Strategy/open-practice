import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseRequestPart } from "../http/validation.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import { registerDraftExportRoutes } from "./drafts/exports.js";
import { assertDraftRouteAccess, draftIdParamsSchema } from "./drafts/shared.js";
import { registerDraftTemplateRoutes } from "./drafts/templates.js";
import type { ApiRouteDependencies } from "./types.js";
import { sanitizeDraftHtml, tipTapDocumentSchema, type DraftRecord } from "@open-practice/domain";

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

export function registerDraftRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies,
): void {
  const { repository } = dependencies;
  // --- Drafts ---

  server.get("/api/drafts", async (request) => {
    const query = parseRequestPart(draftListQuerySchema, request.query, "query");
    assertDraftRouteAccess(request.auth, "draft", "read", query.matterId);

    return repository.listDrafts(request.auth.firmId, query);
  });

  server.get("/api/drafts/:id", async (request) => {
    const params = parseRequestPart(draftIdParamsSchema, request.params, "params");
    const draft = await repository.getDraft(request.auth.firmId, params.id);
    if (!draft) {
      throw Object.assign(new Error("Draft was not found"), { statusCode: 404 });
    }
    assertDraftRouteAccess(request.auth, "draft", "read", draft.matterId);

    return draft;
  });

  server.post("/api/drafts", async (request) => {
    const body = parseRequestPart(createDraftBodySchema, request.body, "body");
    assertDraftRouteAccess(request.auth, "draft", "create", body.matterId);

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
    const params = parseRequestPart(draftIdParamsSchema, request.params, "params");
    const body = parseRequestPart(updateDraftBodySchema, request.body, "body");

    const existing = await repository.getDraft(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Draft was not found"), { statusCode: 404 });
    }
    assertDraftRouteAccess(request.auth, "draft", "update", existing.matterId);

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
    const params = parseRequestPart(draftIdParamsSchema, request.params, "params");
    const existing = await repository.getDraft(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Draft was not found"), { statusCode: 404 });
    }
    assertDraftRouteAccess(request.auth, "draft", "delete", existing.matterId);

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

  registerDraftExportRoutes(server, dependencies);
  registerDraftTemplateRoutes(server, dependencies);
}
