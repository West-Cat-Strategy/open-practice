import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";
import {
  sanitizeDraftHtml,
  tipTapDocumentSchema,
  type DraftRecord,
  type DraftTemplateRecord,
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
  activeOnly: z.coerce.boolean().default(true),
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

export function registerDraftRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
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
