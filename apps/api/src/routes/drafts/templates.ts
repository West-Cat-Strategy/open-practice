import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { tipTapDocumentSchema, type DraftTemplateRecord } from "@open-practice/domain";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertDraftRouteAccess } from "./shared.js";

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

export function registerDraftTemplateRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/draft-templates", async (request) => {
    const query = parseRequestPart(templateListQuerySchema, request.query, "query");
    assertDraftRouteAccess(request.auth, "draft_template", "read");

    return repository.listDraftTemplates(request.auth.firmId, query);
  });

  server.post("/api/draft-templates", async (request) => {
    const body = parseRequestPart(createTemplateBodySchema, request.body, "body");
    assertDraftRouteAccess(request.auth, "draft_template", "create");

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
