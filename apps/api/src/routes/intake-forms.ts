import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type {
  AccessLogRecord,
  AccessRequest,
  Contact,
  EmbeddedIntakeFormItem,
  EmbeddedIntakeTemplateDefinition,
  IntakeFormItemActionRecord,
  IntakeFormLinkRecord,
  SignatureProviderEventRecord,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  IntakeTemplateRecord,
} from "@open-practice/domain";
import {
  createIntakeVariableProposals,
  resolveEmbeddedIntakeAnswers,
  validateEmbeddedIntakeTemplateDefinition,
} from "@open-practice/domain";
import { createSessionToken, hashToken } from "../http/auth-helpers.js";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "./outbound-email.js";
import type { ApiRouteDependencies } from "./types.js";

const SIGNED_URL_EXPIRES_IN_SECONDS = 600;

const intakeTemplateBodySchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  active: z.coerce.boolean().default(true),
  definitionVersion: z.coerce.number().int().positive().default(1),
  definition: z.custom<EmbeddedIntakeTemplateDefinition>((value) => {
    validateEmbeddedIntakeTemplateDefinition(value as EmbeddedIntakeTemplateDefinition);
    return true;
  }),
});

const intakeTemplateParamsSchema = z.object({ id: z.string().min(1) });

const intakeFormLinksQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  intakeSessionId: z.string().min(1).optional(),
});

const intakeFormLinkBodySchema = z.object({
  intakeSessionId: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  notificationEmail: z.string().email().optional(),
});

const proposalQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

const proposalParamsSchema = z.object({ id: z.string().min(1) });

const proposalRejectBodySchema = z.object({
  reason: z.string().min(1),
});

const publicTokenParamsSchema = z.object({ token: z.string().min(1) });

const publicItemParamsSchema = z.object({
  token: z.string().min(1),
  itemId: z.string().min(1),
});

const publicCompleteParamsSchema = z.object({
  token: z.string().min(1),
  itemId: z.string().min(1),
  documentId: z.string().min(1),
});

const publicSubmitBodySchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

const publicUploadIntentBodySchema = z.object({
  filename: z.string().min(1),
  checksumSha256: z.string().min(16),
  contentType: z.string().min(1),
});

const publicCompleteBodySchema = z.object({
  checksumSha256: z.string().min(16),
});

const publicSignatureBodySchema = z.object({
  status: z.enum(["completed", "declined"]),
  consentText: z.string().min(1).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

function assertIntakeAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function defaultExpiry(now: Date): string {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function requestUserAgent(request: FastifyRequest): string | undefined {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value.join(", ") : value;
}

function denied(): ApiHttpError {
  return new ApiHttpError(403, "INTAKE_FORM_LINK_UNAVAILABLE", "Intake form link is not available");
}

function incomplete(requiredIncompleteItemIds: string[]): ApiHttpError {
  return new ApiHttpError(
    409,
    "INTAKE_FORM_INCOMPLETE",
    "Required intake form items are incomplete",
    { requiredIncompleteItemIds },
  );
}

function unsupportedUploadContentType(
  contentType: string,
  acceptedFileTypes: string[],
): ApiHttpError {
  return new ApiHttpError(
    409,
    "INTAKE_FORM_UPLOAD_TYPE_NOT_ACCEPTED",
    "Upload type is not accepted",
    {
      contentType,
      acceptedFileTypes,
    },
  );
}

function signatureConfigurationError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ApiHttpError {
  return new ApiHttpError(409, code, message, details);
}

function linkStatus(link: IntakeFormLinkRecord, now = new Date()): string {
  if (link.revokedAt) return "revoked";
  if (link.submittedAt) return "submitted";
  if (Date.parse(link.expiresAt) <= now.getTime()) return "expired";
  return "active";
}

function serializeLink(link: IntakeFormLinkRecord): Omit<IntakeFormLinkRecord, "tokenHash"> & {
  status: string;
} {
  return {
    id: link.id,
    firmId: link.firmId,
    matterId: link.matterId,
    intakeSessionId: link.intakeSessionId,
    requestedByUserId: link.requestedByUserId,
    clientContactId: link.clientContactId,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
    submittedAt: link.submittedAt,
    createdAt: link.createdAt,
    status: linkStatus(link),
  };
}

function buildPortalUrl(publicWebBaseUrl: string, token: string): string {
  return `${publicWebBaseUrl.replace(/\/+$/, "")}/intake-forms/${encodeURIComponent(token)}`;
}

function contentTypeAllowed(contentType: string, acceptedFileTypes?: string[]): boolean {
  if (!acceptedFileTypes || acceptedFileTypes.length === 0) return true;
  return acceptedFileTypes.some((accepted) => {
    if (accepted.endsWith("/*")) return contentType.startsWith(accepted.slice(0, -1));
    return accepted === contentType;
  });
}

function firstContactEmail(contact: Contact): string | undefined {
  return contact.identifiers.find((identifier) => identifier.type === "email")?.value;
}

async function recordAccessLog(
  repository: ApiRouteDependencies["repository"],
  input: {
    link: IntakeFormLinkRecord;
    request: FastifyRequest;
    action: AccessLogRecord["action"];
    resourceType: string;
    resourceId: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  await repository.createAccessLog({
    id: crypto.randomUUID(),
    firmId: input.link.firmId,
    intakeFormLinkId: input.link.id,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    action: input.action,
    occurredAt: new Date().toISOString(),
    ipAddress: input.request.ip,
    userAgent: requestUserAgent(input.request),
    metadata: input.metadata,
  });
}

async function getTemplate(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  id: string,
): Promise<IntakeTemplateRecord> {
  const template = (await repository.listIntakeTemplates(firmId)).find(
    (candidate) => candidate.id === id,
  );
  if (!template)
    throw Object.assign(new Error("Intake template was not found"), { statusCode: 404 });
  validateEmbeddedIntakeTemplateDefinition(template.definition);
  return template;
}

function findFormItem(
  definition: EmbeddedIntakeTemplateDefinition,
  itemId: string,
  kind: "upload" | "signature",
): EmbeddedIntakeFormItem | undefined {
  if (definition.schemaVersion !== 2) return undefined;
  return definition.sections
    .flatMap((section) => section.items)
    .find((item) => item.id === itemId && item.kind === kind);
}

async function resolvePublicLink(
  repository: ApiRouteDependencies["repository"],
  input: {
    token: string;
    jwtSecret: string;
    request: FastifyRequest;
    allowSubmitted?: boolean;
  },
): Promise<IntakeFormLinkRecord> {
  const link = await repository.getIntakeFormLinkByTokenHash(
    hashToken(input.token, input.jwtSecret),
  );
  if (!link) throw denied();
  const status = linkStatus(link);
  if (status !== "active" && !(input.allowSubmitted && status === "submitted")) {
    await recordAccessLog(repository, {
      link,
      request: input.request,
      action: "view",
      resourceType: "intake_form_link",
      resourceId: link.id,
      metadata: { outcome: "denied", reason: status },
    });
    throw denied();
  }
  return link;
}

export function registerIntakeFormRoutes(
  server: FastifyInstance,
  {
    repository,
    s3,
    jwtSecret,
    signatureProvider,
    emailJobQueue,
    publicWebBaseUrl = "http://localhost:3000",
  }: ApiRouteDependencies & { jwtSecret?: string; publicWebBaseUrl?: string },
): void {
  server.post("/api/intake-templates", async (request) => {
    const body = parseRequestPart(intakeTemplateBodySchema, request.body, "body");
    assertIntakeAccess(request.auth, { resource: "intake_session", action: "create" });
    const templateId = body.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const template: IntakeTemplateRecord = {
      id: templateId,
      firmId: request.auth.firmId,
      name: body.name,
      category: "custom-intake",
      provider: "embedded",
      externalTemplateId: `embedded-form:${templateId}`,
      active: body.active,
      definitionVersion: body.definitionVersion,
      definition: validateEmbeddedIntakeTemplateDefinition(body.definition),
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: "open-practice-form-builder",
        editable: true,
      },
    };
    const created = await repository.createIntakeTemplate(template);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_template.created",
      resourceType: "intake_template",
      resourceId: created.id,
      metadata: {
        templateId: created.id,
        definitionVersion: created.definitionVersion,
        schemaVersion: created.definition.schemaVersion,
      },
    });
    return created;
  });

  server.patch("/api/intake-templates/:id", async (request) => {
    const params = parseRequestPart(intakeTemplateParamsSchema, request.params, "params");
    const body = parseRequestPart(intakeTemplateBodySchema, request.body, "body");
    assertIntakeAccess(request.auth, { resource: "intake_session", action: "update" });
    const existing = await getTemplate(repository, request.auth.firmId, params.id);
    const updated = await repository.updateIntakeTemplate({
      ...existing,
      name: body.name,
      active: body.active,
      definitionVersion: body.definitionVersion,
      definition: validateEmbeddedIntakeTemplateDefinition(body.definition),
      updatedAt: new Date().toISOString(),
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_template.updated",
      resourceType: "intake_template",
      resourceId: updated.id,
      metadata: {
        templateId: updated.id,
        definitionVersion: updated.definitionVersion,
        schemaVersion: updated.definition.schemaVersion,
      },
    });
    return updated;
  });

  server.get("/api/intake-form-links", async (request) => {
    const query = parseRequestPart(intakeFormLinksQuerySchema, request.query, "query");
    if (query.matterId) {
      assertIntakeAccess(request.auth, {
        resource: "intake_session",
        action: "read",
        matterId: query.matterId,
      });
    } else {
      assertIntakeAccess(request.auth, { resource: "intake_session", action: "read" });
    }
    const links = await repository.listIntakeFormLinks(request.auth.firmId, query);
    const actionsByLinkEntries = await Promise.all(
      links.map(async (link) => {
        const actions = await repository.listIntakeFormItemActions(request.auth.firmId, {
          formLinkId: link.id,
        });
        return [link.id, actions] as const;
      }),
    );
    return {
      links: links.map(serializeLink),
      actionsByLinkId: Object.fromEntries(actionsByLinkEntries),
    };
  });

  server.post("/api/intake-form-links", async (request) => {
    const body = parseRequestPart(intakeFormLinkBodySchema, request.body, "body");
    const session = await repository.getIntakeSession(request.auth.firmId, body.intakeSessionId);
    if (!session)
      throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "update",
      matterId: session.matterId,
    });
    if (!jwtSecret) {
      throw Object.assign(new Error("Intake form token signing is not configured"), {
        statusCode: 503,
      });
    }
    const token = createSessionToken();
    const portalUrl = buildPortalUrl(publicWebBaseUrl, token);
    const now = new Date().toISOString();
    const link = await repository.createIntakeFormLink({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: session.matterId,
      intakeSessionId: session.id,
      tokenHash: hashToken(token, jwtSecret),
      requestedByUserId: request.auth.user.id,
      clientContactId: session.clientContactId,
      expiresAt: body.expiresAt ?? defaultExpiry(new Date()),
      createdAt: now,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_form_link.created",
      resourceType: "intake_form_link",
      resourceId: link.id,
      metadata: {
        matterId: link.matterId,
        intakeSessionId: link.intakeSessionId,
        expiresAt: link.expiresAt,
      },
    });
    const queuedEmail = body.notificationEmail
      ? await queueRouteEmailOutbox(repository, emailJobQueue, request.auth, {
          matterId: link.matterId,
          templateKey: "intake.form_link.created",
          to: [body.notificationEmail],
          subject: "Intake form requested",
          textBody: `Please complete the intake form: ${portalUrl}`,
          relatedResourceType: "intake_form_link",
          relatedResourceId: link.id,
          metadata: { intakeSessionId: link.intakeSessionId },
        })
      : undefined;
    return {
      link: serializeLink(link),
      token,
      portalUrl,
      queuedEmail: queuedEmail ? summarizeQueuedRouteEmail(queuedEmail) : undefined,
    };
  });

  server.post("/api/intake-form-links/:id/revoke", async (request) => {
    const params = parseRequestPart(intakeTemplateParamsSchema, request.params, "params");
    const existing = await repository.getIntakeFormLink(request.auth.firmId, params.id);
    if (!existing)
      throw Object.assign(new Error("Intake form link was not found"), { statusCode: 404 });
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "update",
      matterId: existing.matterId,
    });
    const revoked = await repository.revokeIntakeFormLink({
      firmId: request.auth.firmId,
      id: params.id,
      revokedAt: new Date().toISOString(),
    });
    return { link: revoked ? serializeLink(revoked) : null };
  });

  server.get("/api/intake-variable-proposals", async (request) => {
    const query = parseRequestPart(proposalQuerySchema, request.query, "query");
    if (query.matterId) {
      assertIntakeAccess(request.auth, {
        resource: "intake_session",
        action: "read",
        matterId: query.matterId,
      });
    } else {
      assertIntakeAccess(request.auth, { resource: "intake_session", action: "read" });
    }
    return {
      proposals: await repository.listIntakeVariableProposals(request.auth.firmId, query),
    };
  });

  server.post("/api/intake-variable-proposals/:id/approve", async (request) => {
    const params = parseRequestPart(proposalParamsSchema, request.params, "params");
    const proposal = await repository
      .listIntakeVariableProposals(request.auth.firmId)
      .then((items) => items.find((item) => item.id === params.id));
    if (!proposal)
      throw Object.assign(new Error("Intake variable proposal was not found"), { statusCode: 404 });
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "approve",
      matterId: proposal.matterId,
    });
    const reviewed = await repository.reviewIntakeVariableProposal({
      firmId: request.auth.firmId,
      id: params.id,
      status: "approved",
      reviewedByUserId: request.auth.user.id,
      reviewedAt: new Date().toISOString(),
    });
    return reviewed;
  });

  server.post("/api/intake-variable-proposals/:id/reject", async (request) => {
    const params = parseRequestPart(proposalParamsSchema, request.params, "params");
    const body = parseRequestPart(proposalRejectBodySchema, request.body, "body");
    const proposal = await repository
      .listIntakeVariableProposals(request.auth.firmId)
      .then((items) => items.find((item) => item.id === params.id));
    if (!proposal)
      throw Object.assign(new Error("Intake variable proposal was not found"), { statusCode: 404 });
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "approve",
      matterId: proposal.matterId,
    });
    const reviewed = await repository.reviewIntakeVariableProposal({
      firmId: request.auth.firmId,
      id: params.id,
      status: "rejected",
      reviewedByUserId: request.auth.user.id,
      reviewedAt: new Date().toISOString(),
      rejectionReason: body.reason,
    });
    return reviewed;
  });

  server.get("/api/portal/intake-forms/:token", async (request) => {
    const params = parseRequestPart(publicTokenParamsSchema, request.params, "params");
    if (!jwtSecret) throw denied();
    const link = await resolvePublicLink(repository, {
      token: params.token,
      jwtSecret,
      request,
      allowSubmitted: true,
    });
    const session = await repository.getIntakeSession(link.firmId, link.intakeSessionId);
    if (!session) throw denied();
    const template = await getTemplate(repository, link.firmId, session.templateId);
    const actions = await repository.listIntakeFormItemActions(link.firmId, {
      formLinkId: link.id,
    });
    await recordAccessLog(repository, {
      link,
      request,
      action: "view",
      resourceType: "intake_form_link",
      resourceId: link.id,
      metadata: { outcome: "granted", status: linkStatus(link) },
    });
    return {
      link: serializeLink(link),
      template: {
        id: template.id,
        name: template.name,
        definitionVersion: template.definitionVersion,
        definition: template.definition,
      },
      actions,
    };
  });

  server.post("/api/portal/intake-forms/:token/submit", async (request) => {
    const params = parseRequestPart(publicTokenParamsSchema, request.params, "params");
    const body = parseRequestPart(publicSubmitBodySchema, request.body, "body");
    if (!jwtSecret) throw denied();
    const link = await resolvePublicLink(repository, { token: params.token, jwtSecret, request });
    const session = await repository.getIntakeSession(link.firmId, link.intakeSessionId);
    if (!session) throw denied();
    const template = await getTemplate(repository, link.firmId, session.templateId);
    const completedActions = await repository.listIntakeFormItemActions(link.firmId, {
      formLinkId: link.id,
    });
    const completedItemIds = completedActions
      .filter((action) => action.status === "uploaded" || action.status === "completed")
      .map((action) => action.itemId);
    const resolution = resolveEmbeddedIntakeAnswers({
      templateId: template.id,
      templateVersion: template.definitionVersion,
      definition: template.definition,
      answers: body.answers,
      completedItemIds,
    });
    const requiredIncompleteItemIds = resolution.requiredIncompleteItemIds ?? [];
    if (requiredIncompleteItemIds.length > 0) throw incomplete(requiredIncompleteItemIds);
    const now = new Date().toISOString();
    const snapshot = await repository.createAnswerSnapshot({
      id: crypto.randomUUID(),
      firmId: link.firmId,
      intakeSessionId: link.intakeSessionId,
      capturedAt: now,
      answers: body.answers,
      resolution,
    });
    const proposals = createIntakeVariableProposals({
      firmId: link.firmId,
      matterId: link.matterId,
      clientContactId: link.clientContactId,
      intakeSessionId: link.intakeSessionId,
      answerSnapshotId: snapshot.id,
      definition: template.definition,
      answers: body.answers,
      now,
    });
    const createdProposals = await repository.createIntakeVariableProposals(proposals);
    const submitted = await repository.markIntakeFormLinkSubmitted({
      firmId: link.firmId,
      id: link.id,
      submittedAt: now,
    });
    await recordAccessLog(repository, {
      link,
      request,
      action: "submit",
      resourceType: "answer_snapshot",
      resourceId: snapshot.id,
      metadata: {
        outcome: "submitted",
        answerCount: Object.keys(body.answers).length,
        proposalCount: createdProposals.length,
      },
    });
    return {
      status: "submitted",
      link: submitted ? serializeLink(submitted) : serializeLink(link),
      snapshot,
      proposals: createdProposals,
    };
  });

  server.post("/api/portal/intake-forms/:token/items/:itemId/uploads", async (request) => {
    const params = parseRequestPart(publicItemParamsSchema, request.params, "params");
    const body = parseRequestPart(publicUploadIntentBodySchema, request.body, "body");
    if (!jwtSecret) throw denied();
    if (!s3) {
      throw Object.assign(new Error("S3 upload signing is not configured"), { statusCode: 503 });
    }
    const link = await resolvePublicLink(repository, { token: params.token, jwtSecret, request });
    const session = await repository.getIntakeSession(link.firmId, link.intakeSessionId);
    if (!session) throw denied();
    const template = await getTemplate(repository, link.firmId, session.templateId);
    const item = findFormItem(template.definition, params.itemId, "upload");
    if (!item || item.kind !== "upload") throw denied();
    if (!contentTypeAllowed(body.contentType, item.acceptedFileTypes)) {
      throw unsupportedUploadContentType(body.contentType, item.acceptedFileTypes ?? []);
    }
    const documentId = crypto.randomUUID();
    const storageKey = `intake-forms/${link.id}/${params.itemId}/${documentId}-${sanitizeFilename(body.filename)}`;
    const uploadUrl = await getSignedUrl(
      s3.client,
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: storageKey,
        ChecksumSHA256: body.checksumSha256,
        ContentType: body.contentType,
        Metadata: {
          "open-practice-upload-scope": "intake-form",
          "open-practice-scan": "required-before-share",
        },
      }),
      { expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS },
    );
    const document = await repository.createDocumentUploadIntent({
      id: documentId,
      firmId: link.firmId,
      matterId: link.matterId,
      title: body.filename,
      storageKey,
      checksumSha256: body.checksumSha256,
      classification: item.classification ?? "general",
      legalHold: item.legalHold ?? false,
    });
    const action = await repository.upsertIntakeFormItemAction({
      id: `${link.id}:${params.itemId}:upload`,
      firmId: link.firmId,
      matterId: link.matterId,
      intakeSessionId: link.intakeSessionId,
      formLinkId: link.id,
      itemId: params.itemId,
      kind: "upload",
      status: "intent_created",
      documentId: document.id,
      evidence: { filename: body.filename, contentType: body.contentType },
      createdAt: new Date().toISOString(),
    });
    await recordAccessLog(repository, {
      link,
      request,
      action: "upload",
      resourceType: "document",
      resourceId: document.id,
      metadata: { outcome: "intent_created", itemId: params.itemId },
    });
    return {
      method: "PUT",
      uploadUrl,
      expiresInSeconds: SIGNED_URL_EXPIRES_IN_SECONDS,
      document,
      action,
    };
  });

  server.post(
    "/api/portal/intake-forms/:token/items/:itemId/documents/:documentId/complete",
    async (request) => {
      const params = parseRequestPart(publicCompleteParamsSchema, request.params, "params");
      const body = parseRequestPart(publicCompleteBodySchema, request.body, "body");
      if (!jwtSecret) throw denied();
      const link = await resolvePublicLink(repository, { token: params.token, jwtSecret, request });
      const actions = await repository.listIntakeFormItemActions(link.firmId, {
        formLinkId: link.id,
        itemId: params.itemId,
      });
      const action = actions.find((candidate) => candidate.documentId === params.documentId);
      const document = await repository.getDocument(link.firmId, params.documentId);
      if (!action || !document || document.matterId !== link.matterId) throw denied();
      const completed = await repository.completeDocumentUpload({
        firmId: link.firmId,
        documentId: params.documentId,
        checksumSha256: body.checksumSha256,
        scanStatus: "queued",
      });
      const completedAction = await repository.upsertIntakeFormItemAction({
        ...action,
        status: "uploaded",
        completedAt: new Date().toISOString(),
        evidence: { ...action.evidence, uploadStatus: completed.uploadStatus },
      });
      await recordAccessLog(repository, {
        link,
        request,
        action: "upload",
        resourceType: "document",
        resourceId: completed.id,
        metadata: { outcome: completed.uploadStatus, itemId: params.itemId },
      });
      return { document: completed, action: completedAction };
    },
  );

  server.post("/api/portal/intake-forms/:token/items/:itemId/signature", async (request) => {
    const params = parseRequestPart(publicItemParamsSchema, request.params, "params");
    const body = parseRequestPart(publicSignatureBodySchema, request.body, "body");
    if (!jwtSecret) throw denied();
    const link = await resolvePublicLink(repository, { token: params.token, jwtSecret, request });
    const session = await repository.getIntakeSession(link.firmId, link.intakeSessionId);
    if (!session) throw denied();
    const template = await getTemplate(repository, link.firmId, session.templateId);
    const item = findFormItem(template.definition, params.itemId, "signature");
    if (!item || item.kind !== "signature") throw denied();
    const existingAction = (
      await repository.listIntakeFormItemActions(link.firmId, {
        formLinkId: link.id,
        itemId: params.itemId,
      })
    ).find((candidate) => candidate.kind === "signature");
    if (existingAction?.status === "completed" || existingAction?.status === "declined") {
      return { action: existingAction };
    }
    const now = new Date().toISOString();
    if (item.documentId) {
      if (!signatureProvider) {
        throw Object.assign(new Error("Signature provider is not configured"), {
          statusCode: 503,
        });
      }
      const document = await repository.getDocument(link.firmId, item.documentId);
      if (!document || document.matterId !== link.matterId) {
        throw signatureConfigurationError(
          "INTAKE_SIGNATURE_DOCUMENT_UNAVAILABLE",
          "Signature document is not available for this intake form",
          { itemId: params.itemId, documentId: item.documentId },
        );
      }
      if (!session.clientContactId) {
        throw signatureConfigurationError(
          "INTAKE_SIGNATURE_SIGNER_UNAVAILABLE",
          "Signature signer contact is not available for this intake form",
          { itemId: params.itemId },
        );
      }
      const contact = await repository.getContact(link.firmId, session.clientContactId);
      const signerEmail = contact ? firstContactEmail(contact) : undefined;
      if (!contact || !signerEmail) {
        throw signatureConfigurationError(
          "INTAKE_SIGNATURE_SIGNER_UNAVAILABLE",
          "Signature signer contact email is not available for this intake form",
          { itemId: params.itemId, clientContactId: session.clientContactId },
        );
      }

      const signer = { name: contact.displayName, email: signerEmail, role: "client" };
      const submission = await signatureProvider.createSubmission({
        matterId: link.matterId,
        documentId: document.id,
        title: item.label,
        signers: [signer],
        consentText: body.consentText ?? item.consentText,
      });
      const signatureRequest: SignatureRequestRecord = {
        id: crypto.randomUUID(),
        firmId: link.firmId,
        matterId: link.matterId,
        documentId: document.id,
        title: item.label,
        requestedByUserId: link.requestedByUserId,
        provider: submission.provider,
        externalId: submission.externalId,
        status: submission.status ?? "sent",
        signingUrl: submission.signingUrl,
        consentText: body.consentText ?? item.consentText,
        evidence: submission.evidence ?? {},
        createdAt: now,
      };
      const signerRecord: SignatureRequestSignerRecord = {
        id: crypto.randomUUID(),
        firmId: link.firmId,
        signatureRequestId: signatureRequest.id,
        ...signer,
        status: signatureRequest.status,
        signingUrl: submission.signingUrl,
      };
      const initialEvent: SignatureProviderEventRecord = {
        id: crypto.randomUUID(),
        firmId: link.firmId,
        signatureRequestId: signatureRequest.id,
        provider: signatureRequest.provider,
        externalId: signatureRequest.externalId,
        status: signatureRequest.status,
        occurredAt: now,
        evidence: signatureRequest.evidence,
      };
      await repository.createSignatureRequest({
        request: signatureRequest,
        signers: [signerRecord],
        event: initialEvent,
      });
      const embeddedEvent = await repository.recordSignatureProviderEvent({
        id: crypto.randomUUID(),
        firmId: link.firmId,
        signatureRequestId: signatureRequest.id,
        provider: signatureRequest.provider,
        externalId: signatureRequest.externalId,
        status: body.status,
        occurredAt: now,
        evidence: {
          mode: "embedded_intake_signature_request",
          formLinkId: link.id,
          itemId: params.itemId,
          signerId: signerRecord.id,
          consentText: body.consentText ?? item.consentText,
          ip: request.ip,
          userAgent: requestUserAgent(request),
          ...body.evidence,
        },
      });
      const action = await repository.upsertIntakeFormItemAction({
        id: `${link.id}:${params.itemId}:signature`,
        firmId: link.firmId,
        matterId: link.matterId,
        intakeSessionId: link.intakeSessionId,
        formLinkId: link.id,
        itemId: params.itemId,
        kind: "signature",
        status: body.status,
        documentId: document.id,
        signatureRequestId: signatureRequest.id,
        evidence: {
          mode: "embedded_intake_signature_request",
          provider: signatureRequest.provider,
          documentId: document.id,
          signatureRequestId: signatureRequest.id,
          signerCount: 1,
        },
        createdAt: now,
        completedAt: now,
      });
      await repository.appendAuditEvent({
        id: crypto.randomUUID(),
        firmId: link.firmId,
        actorId: `public:intake_form_link:${link.id}`,
        action: "intake_signature_request.created",
        resourceType: "signature_request",
        resourceId: signatureRequest.id,
        occurredAt: now,
        metadata: {
          matterId: link.matterId,
          intakeSessionId: link.intakeSessionId,
          formLinkId: link.id,
          itemId: params.itemId,
          documentId: document.id,
          provider: signatureRequest.provider,
          status: embeddedEvent.status,
          signerCount: 1,
        },
      });
      await recordAccessLog(repository, {
        link,
        request,
        action: "sign",
        resourceType: "signature_request",
        resourceId: signatureRequest.id,
        metadata: {
          outcome: body.status,
          itemId: params.itemId,
          documentId: document.id,
          signatureRequestId: signatureRequest.id,
        },
      });
      return { action, signatureRequest: { id: signatureRequest.id, status: body.status } };
    }

    const action: IntakeFormItemActionRecord = {
      id: `${link.id}:${params.itemId}:signature`,
      firmId: link.firmId,
      matterId: link.matterId,
      intakeSessionId: link.intakeSessionId,
      formLinkId: link.id,
      itemId: params.itemId,
      kind: "signature",
      status: body.status,
      evidence: {
        mode: "embedded_intake_attestation",
        consentText: body.consentText ?? item.consentText,
        ip: request.ip,
        userAgent: requestUserAgent(request),
        ...body.evidence,
      },
      createdAt: now,
      completedAt: now,
    };
    const recorded = await repository.upsertIntakeFormItemAction(action);
    await recordAccessLog(repository, {
      link,
      request,
      action: "sign",
      resourceType: "intake_form_item",
      resourceId: params.itemId,
      metadata: { outcome: body.status },
    });
    return { action: recorded };
  });
}
