import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildEmailTemplatePreviewSnapshot,
  type EmailTemplateDraftRecord,
  type EmailTemplatePreviewSnapshotRecord,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  assertEmailAccess,
  assertRelatedEmailResourceMatchesMatter,
  relatedEmailResourceTypeSchema,
} from "./shared.js";

const recipientHintSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_.:-]+$/i, "recipient hints must be symbolic labels, not addresses");

const templateDraftListQuerySchema = z.object({
  category: z.string().min(1).optional(),
  activeOnly: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const templateDraftParamsSchema = z.object({
  templateDraftId: z.string().min(1),
});

const templateDraftBodyBaseSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(500).optional(),
  category: z.string().min(1).max(80).default("general"),
  templateKey: z.string().min(1).max(120),
  from: z.string().min(1).max(240).default("Open Practice <no-reply@open-practice.local>"),
  subject: z.string().min(1).max(240),
  textBody: z.string().default(""),
  htmlBody: z.string().default(""),
  recipientHints: z.array(recipientHintSchema).max(10).default([]),
  relatedResourceType: relatedEmailResourceTypeSchema.optional(),
  status: z.enum(["draft", "archived"]).default("draft"),
});

const templateDraftBodySchema = templateDraftBodyBaseSchema.refine(
  (body) => body.textBody.trim().length > 0 || body.htmlBody.trim().length > 0,
  {
    path: ["textBody"],
    message: "Either textBody or htmlBody is required",
  },
);

const templateDraftPatchBodySchema = z
  .object({
    name: z.string().min(1).max(160).optional(),
    description: z.string().max(500).optional(),
    category: z.string().min(1).max(80).optional(),
    templateKey: z.string().min(1).max(120).optional(),
    from: z.string().min(1).max(240).optional(),
    subject: z.string().min(1).max(240).optional(),
    textBody: z.string().optional(),
    htmlBody: z.string().optional(),
    recipientHints: z.array(recipientHintSchema).max(10).optional(),
    relatedResourceType: relatedEmailResourceTypeSchema.optional(),
    status: z.enum(["draft", "archived"]).optional(),
  })
  .refine(
    (body) =>
      body.textBody === undefined ||
      body.htmlBody === undefined ||
      body.textBody.trim().length > 0 ||
      body.htmlBody.trim().length > 0,
    {
      path: ["textBody"],
      message: "Either textBody or htmlBody is required",
    },
  );

const previewSnapshotBodySchema = z.object({
  matterId: z.string().min(1),
  to: z.array(z.string().email()).default([]),
  cc: z.array(z.string().email()).default([]),
  bcc: z.array(z.string().email()).default([]),
  relatedResourceType: relatedEmailResourceTypeSchema.optional(),
  relatedResourceId: z.string().min(1).optional(),
});

const previewSnapshotQuerySchema = z.object({
  matterId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

function serializeTemplateDraft(draft: EmailTemplateDraftRecord): EmailTemplateDraftRecord {
  return draft;
}

function serializePreviewSnapshot(
  snapshot: EmailTemplatePreviewSnapshotRecord,
): EmailTemplatePreviewSnapshotRecord {
  return snapshot;
}

function draftAuditMetadata(draft: EmailTemplateDraftRecord): Record<string, unknown> {
  return {
    templateDraftId: draft.id,
    category: draft.category,
    status: draft.status,
    version: draft.version,
    subjectLength: draft.subject.length,
    textLength: draft.textBody.length,
    htmlLength: draft.htmlBody.length,
    recipientHintCount: draft.recipientHints.length,
    draftAndPreviewOnly: true,
    providerNeutral: true,
  };
}

async function getTemplateDraftOrThrow(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  templateDraftId: string,
): Promise<EmailTemplateDraftRecord> {
  const draft = await repository.getEmailTemplateDraft(firmId, templateDraftId);
  if (!draft) {
    throw new ApiHttpError(
      404,
      "EMAIL_TEMPLATE_DRAFT_NOT_FOUND",
      "Email template draft was not found",
    );
  }
  return draft;
}

export function registerEmailTemplateDraftRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
  server.get("/api/email/template-drafts", async (request) => {
    const query = parseRequestPart(templateDraftListQuerySchema, request.query, "query");
    assertEmailAccess(request.auth, {
      resource: "email",
      action: "read",
    });

    const templateDrafts = await repository.listEmailTemplateDrafts(request.auth.firmId, query);
    return { templateDrafts: templateDrafts.map(serializeTemplateDraft) };
  });

  server.post("/api/email/template-drafts", async (request, reply) => {
    const body = parseRequestPart(templateDraftBodySchema, request.body, "body");
    assertEmailAccess(request.auth, {
      resource: "email",
      action: "create",
    });

    const now = new Date().toISOString();
    const draft: EmailTemplateDraftRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      name: body.name,
      description: body.description,
      category: body.category,
      templateKey: body.templateKey,
      from: body.from,
      subject: body.subject,
      textBody: body.textBody,
      htmlBody: body.htmlBody,
      recipientHints: body.recipientHints,
      relatedResourceType: body.relatedResourceType,
      status: body.status,
      version: 1,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: "api.email_template_drafts",
        draftAndPreviewOnly: true,
        providerNeutral: true,
      },
    };
    const created = await repository.createEmailTemplateDraft(draft);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "email_template_draft.created",
      resourceType: "email_template_draft",
      resourceId: created.id,
      metadata: draftAuditMetadata(created),
    });

    reply.code(201);
    return { templateDraft: serializeTemplateDraft(created) };
  });

  server.patch("/api/email/template-drafts/:templateDraftId", async (request) => {
    const params = parseRequestPart(templateDraftParamsSchema, request.params, "params");
    const body = parseRequestPart(templateDraftPatchBodySchema, request.body, "body");
    assertEmailAccess(request.auth, {
      resource: "email",
      action: "update",
    });
    await getTemplateDraftOrThrow(repository, request.auth.firmId, params.templateDraftId);

    const updated = await repository.updateEmailTemplateDraft(
      request.auth.firmId,
      params.templateDraftId,
      {
        ...body,
        updatedByUserId: request.auth.user.id,
        updatedAt: new Date().toISOString(),
        metadata: {
          lastUpdatedByRoute: "api.email_template_drafts",
          draftAndPreviewOnly: true,
          providerNeutral: true,
        },
      },
    );
    await appendRouteAuditEvent(repository, request.auth, {
      action: "email_template_draft.updated",
      resourceType: "email_template_draft",
      resourceId: updated.id,
      metadata: draftAuditMetadata(updated),
    });

    return { templateDraft: serializeTemplateDraft(updated) };
  });

  server.post(
    "/api/email/template-drafts/:templateDraftId/preview-snapshots",
    async (request, reply) => {
      const params = parseRequestPart(templateDraftParamsSchema, request.params, "params");
      const body = parseRequestPart(previewSnapshotBodySchema, request.body, "body");
      assertEmailAccess(request.auth, {
        resource: "email",
        action: "create",
        matterId: body.matterId,
      });
      await assertRelatedEmailResourceMatchesMatter(repository, request.auth, body);

      const draft = await getTemplateDraftOrThrow(
        repository,
        request.auth.firmId,
        params.templateDraftId,
      );
      const now = new Date().toISOString();
      const snapshot = buildEmailTemplatePreviewSnapshot({
        id: crypto.randomUUID(),
        firmId: request.auth.firmId,
        templateDraft: draft,
        matterId: body.matterId,
        createdByUserId: request.auth.user.id,
        to: body.to,
        cc: body.cc,
        bcc: body.bcc,
        relatedResource:
          body.relatedResourceType && body.relatedResourceId
            ? {
                type: body.relatedResourceType,
                id: body.relatedResourceId,
              }
            : undefined,
        createdAt: now,
      });
      const created = await repository.createEmailTemplatePreviewSnapshot(snapshot);
      await appendRouteAuditEvent(repository, request.auth, {
        action: "email_template_preview_snapshot.created",
        resourceType: "email_template_preview_snapshot",
        resourceId: created.id,
        metadata: {
          previewSnapshotId: created.id,
          templateDraftId: created.templateDraftId,
          matterId: created.matterId,
          recipientCount: created.recipientSummary.recipientCount,
          warningCount: created.warnings.length,
          persisted: true,
          queued: false,
          providerNeutral: true,
        },
      });

      reply.code(201);
      return {
        status: "previewed",
        mode: "template_snapshot",
        previewSnapshot: serializePreviewSnapshot(created),
      };
    },
  );

  server.get("/api/email/template-drafts/:templateDraftId/preview-snapshots", async (request) => {
    const params = parseRequestPart(templateDraftParamsSchema, request.params, "params");
    const query = parseRequestPart(previewSnapshotQuerySchema, request.query, "query");
    assertEmailAccess(request.auth, {
      resource: "email",
      action: "read",
      matterId: query.matterId,
    });
    await getTemplateDraftOrThrow(repository, request.auth.firmId, params.templateDraftId);

    const previewSnapshots = await repository.listEmailTemplatePreviewSnapshots(
      request.auth.firmId,
      params.templateDraftId,
      {
        matterId: query.matterId,
        limit: query.limit,
      },
    );
    return { previewSnapshots: previewSnapshots.map(serializePreviewSnapshot) };
  });
}
