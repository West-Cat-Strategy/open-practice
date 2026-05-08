import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  assertDraftAssistTask,
  buildDraftAssistAuditMetadata,
  draftAssistTasks,
  extractTipTapPlainText,
  reviewDraftAssistRecord,
  type AccessRequest,
  type DraftAssistRecord,
  type DraftAssistReviewDecision,
  type DraftAssistTask,
} from "@open-practice/domain";
import { ApiHttpError } from "../http/response.js";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";

const statusResponse = {
  status: "disabled" as const,
  reason: "not_configured" as const,
  supportedTasks: draftAssistTasks,
};

const recordsQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  draftId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
});

const assistBodySchema = z.object({
  task: z.enum(draftAssistTasks),
  instruction: z.string().max(2000).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const documentAssistBodySchema = assistBodySchema.extend({
  task: z.literal("summarize").default("summarize"),
});

const reviewBodySchema = z.object({
  decision: z.enum(["reviewed", "rejected"]),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function assertDraftAssistAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

async function getEnabledAiProvider(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
): Promise<string | undefined> {
  return (await repository.listProviderSettings(firmId, { kind: "ai" })).find(
    (setting) => setting.enabled,
  )?.key;
}

export async function buildDraftAssistStatus(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  draftAssistProvider?: ApiRouteDependencies["draftAssistProvider"];
}) {
  const providerKey = await getEnabledAiProvider(input.repository, input.firmId);
  if (!providerKey) return statusResponse;
  if (!input.draftAssistProvider) {
    return {
      ...statusResponse,
      reason: "provider_not_injected" as const,
      provider: providerKey,
    };
  }
  return { ...input.draftAssistProvider.getStatus(), provider: providerKey };
}

export function registerDraftAssistRoutes(
  server: FastifyInstance,
  { repository, draftAssistProvider }: ApiRouteDependencies,
): void {
  server.get("/api/draft-assist/status", async (request) => {
    return buildDraftAssistStatus({
      repository,
      firmId: request.auth.firmId,
      draftAssistProvider,
    });
  });

  server.get("/api/draft-assist/records", async (request) => {
    const query = parseRequestPart(recordsQuerySchema, request.query, "query");
    let matterId = query.matterId;
    if (!matterId && query.draftId) {
      matterId = (await repository.getDraft(request.auth.firmId, query.draftId))?.matterId;
    }
    if (!matterId && query.documentId) {
      matterId = (await repository.getDocument(request.auth.firmId, query.documentId))?.matterId;
    }
    assertDraftAssistAccess(request.auth, { resource: "draft", action: "read", matterId });
    return {
      records: await repository.listDraftAssistRecords(request.auth.firmId, query),
    };
  });

  server.post("/api/drafts/:id/assist", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(assistBodySchema, request.body, "body");
    assertDraftAssistTask(body.task);
    const draft = await repository.getDraft(request.auth.firmId, params.id);
    if (!draft) throw Object.assign(new Error("Draft was not found"), { statusCode: 404 });
    if (!draft.matterId) {
      throw new ApiHttpError(
        409,
        "matter_scoped_draft_required",
        "Draft assist requires a matter-scoped draft",
      );
    }
    assertDraftAssistAccess(request.auth, {
      resource: "draft",
      action: "update",
      matterId: draft.matterId,
    });
    const sourceText = extractTipTapPlainText(draft.editorJson);
    return createAssistRecord({
      auth: request.auth,
      body,
      source: {
        sourceType: "draft",
        matterId: draft.matterId,
        draftId: draft.id,
        sourceText,
      },
      repository,
      draftAssistProvider,
    });
  });

  server.post("/api/documents/:id/assist", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(documentAssistBodySchema, request.body, "body");
    const document = await repository.getDocument(request.auth.firmId, params.id);
    if (!document) throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
    assertDraftAssistAccess(request.auth, {
      resource: "document",
      action: "read",
      matterId: document.matterId,
    });
    const extraction = (
      await repository.getDocumentTextExtractions(request.auth.firmId, document.id)
    )
      .filter((candidate) => candidate.status === "completed" && candidate.extractedText)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (!extraction?.extractedText) {
      throw new ApiHttpError(
        409,
        "text_extraction_required",
        "Document text extraction is required before draft assist",
      );
    }
    return createAssistRecord({
      auth: request.auth,
      body,
      source: {
        sourceType: "document",
        matterId: document.matterId,
        documentId: document.id,
        sourceText: extraction.extractedText,
      },
      repository,
      draftAssistProvider,
    });
  });

  server.patch("/api/draft-assist/records/:id/review", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(reviewBodySchema, request.body, "body");
    const record = await repository.getDraftAssistRecord(request.auth.firmId, params.id);
    if (!record) {
      throw Object.assign(new Error("Draft assist record was not found"), { statusCode: 404 });
    }
    assertDraftAssistAccess(request.auth, {
      resource: "draft",
      action: "update",
      matterId: record.matterId,
    });
    const updated = await repository.updateDraftAssistRecord(
      reviewDraftAssistRecord({
        record,
        decision: body.decision as DraftAssistReviewDecision,
        reviewedByUserId: request.auth.user.id,
        reviewedAt: new Date().toISOString(),
      }),
    );
    await appendRouteAuditEvent(repository, request.auth, {
      action: "draft_assist.reviewed",
      resourceType: "draft_assist",
      resourceId: updated.id,
      metadata: buildDraftAssistAuditMetadata(updated),
    });
    return updated;
  });
}

async function createAssistRecord(input: {
  auth: ApiAuthContext;
  body: { task: DraftAssistTask; instruction?: string; evidence: Record<string, unknown> };
  source: {
    sourceType: DraftAssistRecord["sourceType"];
    matterId: string;
    draftId?: string;
    documentId?: string;
    sourceText: string;
  };
  repository: ApiRouteDependencies["repository"];
  draftAssistProvider: ApiRouteDependencies["draftAssistProvider"];
}): Promise<DraftAssistRecord> {
  const providerKey = await getEnabledAiProvider(input.repository, input.auth.firmId);
  if (!providerKey || !input.draftAssistProvider) {
    throw new ApiHttpError(
      503,
      "draft_assist_not_configured",
      "Draft assist provider is not configured",
    );
  }

  const suggestion = await input.draftAssistProvider.createSuggestion({
    firmId: input.auth.firmId,
    matterId: input.source.matterId,
    sourceType: input.source.sourceType,
    draftId: input.source.draftId,
    documentId: input.source.documentId,
    task: input.body.task,
    sourceText: input.source.sourceText,
    instruction: input.body.instruction,
    metadata: input.body.evidence,
  });
  const now = new Date().toISOString();
  const record: DraftAssistRecord = {
    id: crypto.randomUUID(),
    firmId: input.auth.firmId,
    matterId: input.source.matterId,
    sourceType: input.source.sourceType,
    draftId: input.source.draftId,
    documentId: input.source.documentId,
    task: input.body.task,
    providerKey,
    providerModel: suggestion.providerModel,
    status: "suggested",
    suggestedText: suggestion.suggestedText,
    summary: suggestion.summary,
    createdByUserId: input.auth.user.id,
    createdAt: now,
    updatedAt: now,
    metadata: {
      sourceTextLength: input.source.sourceText.length,
      instructionLength: input.body.instruction?.length ?? 0,
      evidenceKeyCount: Object.keys(input.body.evidence).length,
      ...(suggestion.metadata ?? {}),
    },
  };
  const created = await input.repository.createDraftAssistRecord(record);
  await appendRouteAuditEvent(input.repository, input.auth, {
    action: "draft_assist.created",
    resourceType: "draft_assist",
    resourceId: created.id,
    metadata: buildDraftAssistAuditMetadata(created),
  });
  return created;
}
