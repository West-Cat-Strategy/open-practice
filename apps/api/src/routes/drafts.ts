import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";
import { sanitizeDraftHtml, type DraftRecord, type DraftTemplateRecord } from "@open-practice/domain";

const draftListQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
});

const createDraftBodySchema = z.object({
  matterId: z.string().min(1).optional(),
  title: z.string().min(1),
  editorJson: z.record(z.string(), z.any()),
  renderedHtml: z.string().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
});

const updateDraftBodySchema = z.object({
  title: z.string().min(1).optional(),
  editorJson: z.record(z.string(), z.any()).optional(),
  renderedHtml: z.string().optional(),
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

    const draftId = crypto.randomUUID();
    const now = new Date().toISOString();

    const draft: DraftRecord = {
      id: draftId,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      title: body.title,
      editorJson: body.editorJson,
      renderedHtml: body.renderedHtml ? sanitizeDraftHtml(body.renderedHtml) : undefined,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
      createdAt: now,
      updatedAt: now,
      metadata: body.metadata,
    };

    return repository.createDraft(draft);
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

    return repository.updateDraft(request.auth.firmId, params.id, updates);
  });

  server.delete("/api/drafts/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const existing = await repository.getDraft(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Draft was not found"), { statusCode: 404 });
    }
    assertAccess(request.auth, "draft", "delete", existing.matterId);

    await repository.deleteDraft(request.auth.firmId, params.id);
    return { ok: true };
  });

  // --- Templates ---

  server.get("/api/draft-templates", async (request) => {
    const query = parseRequestPart(templateListQuerySchema, request.query, "query");
    assertAccess(request.auth, "draft_template", "read");

    return repository.listDraftTemplates(request.auth.firmId, query);
  });

  server.post("/api/draft-templates", async (request) => {
    const body = parseRequestPart(createDraftBodySchema, request.body, "body");
    assertAccess(request.auth, "draft_template", "create");

    const templateId = crypto.randomUUID();
    const now = new Date().toISOString();

    const template: DraftTemplateRecord = {
      id: templateId,
      firmId: request.auth.firmId,
      name: body.title,
      description: (body.metadata.description as string) ?? undefined,
      editorJson: body.editorJson,
      category: (body.metadata.category as string) ?? "general",
      active: true,
      createdAt: now,
      updatedAt: now,
      metadata: body.metadata,
    };

    return repository.createDraftTemplate(template);
  });
}
