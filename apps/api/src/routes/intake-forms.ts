import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type {
  AccessLogRecord,
  AccessRequest,
  AnswerSnapshotRecord,
  Contact,
  EmbeddedIntakeFormItem,
  EmbeddedIntakeTemplateDefinition,
  IntakeFormItemActionRecord,
  IntakeFormLinkRecord,
  IntakeFormReviewDecision,
  IntakeFormReviewRecord,
  SignatureProviderEventRecord,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  IntakeTemplateRecord,
} from "@open-practice/domain";
import {
  buildEmbeddedIntakeTemplateQaReport,
  createIntakeVariableProposals,
  intakeTemplatePreviewStatus,
  previewEmbeddedIntakeTemplate,
  resolveEmbeddedIntakeAnswers,
  validateEmbeddedIntakeTemplateDefinition,
} from "@open-practice/domain";
import { createSessionToken, hashToken } from "../http/auth-helpers.js";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "./delivery-confirmation.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "./outbound-email.js";
import { publicTokenPolicyOptions } from "./public-token-rate-limits.js";
import type { ApiRouteDependencies } from "./types.js";
import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  normalizeChecksumSha256,
  normalizeUploadSizeBytes,
  sha256HexToBase64,
  verifyUploadedObject,
} from "./upload-verification.js";

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

const intakeTemplatePreviewBodySchema = z.object({
  definition: z.custom<EmbeddedIntakeTemplateDefinition>(
    (value) => typeof value === "object" && value !== null,
  ),
  matterId: z.string().min(1).optional(),
  answers: z.record(z.string(), z.unknown()).default({}),
  selectedPackageIds: z.array(z.string().min(1)).optional(),
});

const intakeFormLinksQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  intakeSessionId: z.string().min(1).optional(),
});

const intakeFormLinkBodySchema = z.object({
  intakeSessionId: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  notificationEmail: z.string().email().optional(),
  deliveryConfirmation: deliveryConfirmationSchema.optional(),
});

const proposalQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

const proposalParamsSchema = z.object({ id: z.string().min(1) });

const proposalRejectBodySchema = z.object({
  reason: z.string().min(1),
});

const reviewParamsSchema = z.object({ id: z.string().min(1) });

const reviewDecisionBodySchema = z.object({
  reason: z.string().min(1).optional(),
});

const requestMoreInfoBodySchema = z.object({
  reason: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }).optional(),
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
  clientSubmissionId: z.string().min(1).max(128).optional(),
  answers: z.record(z.string(), z.unknown()),
});

const publicDraftBodySchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

const publicUploadIntentBodySchema = z.object({
  filename: z.string().min(1),
  checksumSha256: z.string().transform(normalizeChecksumSha256),
  fileSizeBytes: z.coerce.number().transform(normalizeUploadSizeBytes),
  contentType: z.string().min(1),
});

const publicCompleteBodySchema = z.object({
  checksumSha256: z.string().transform(normalizeChecksumSha256),
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

function serializePublicUploadDocument(document: {
  id: string;
  title: string;
  uploadStatus: string;
  scanStatus: string;
}) {
  return {
    id: document.id,
    title: document.title,
    uploadStatus: document.uploadStatus,
    scanStatus: document.scanStatus === "failed" ? "failed" : "queued",
  };
}

function requestUserAgent(request: FastifyRequest): string | undefined {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value.join(", ") : value;
}

function denied(): ApiHttpError {
  return new ApiHttpError(403, "INTAKE_FORM_LINK_UNAVAILABLE", "Intake form link is not available");
}

function submissionConflict(): ApiHttpError {
  return new ApiHttpError(
    409,
    "INTAKE_FORM_SUBMISSION_CONFLICT",
    "Intake form submission identifier conflicts with an existing submission",
  );
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
    parentFormLinkId: link.parentFormLinkId,
    answerSnapshotId: link.answerSnapshotId,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
    submittedAt: link.submittedAt,
    createdAt: link.createdAt,
    status: linkStatus(link),
  };
}

function serializePublicLink(link: IntakeFormLinkRecord) {
  return {
    expiresAt: link.expiresAt,
    submittedAt: link.submittedAt,
    createdAt: link.createdAt,
    status: linkStatus(link),
  };
}

function serializePublicReview(review: IntakeFormReviewRecord | undefined) {
  if (!review) return null;
  return {
    decision: review.decision,
    decidedAt: review.decidedAt,
  };
}

function serializePublicItemAction(action: IntakeFormItemActionRecord) {
  return {
    itemId: action.itemId,
    kind: action.kind,
    status: action.status,
    documentId: action.documentId,
    signatureRequestId: action.signatureRequestId,
    completedAt: action.completedAt,
  };
}

function serializePublicTemplateDefinition(
  definition: EmbeddedIntakeTemplateDefinition,
): EmbeddedIntakeTemplateDefinition {
  const publicQuestions = definition.questions.map(({ variableMapping, ...question }) => {
    void variableMapping;
    return question;
  });
  if (definition.schemaVersion !== 2) {
    return { ...definition, questions: publicQuestions };
  }
  return {
    ...definition,
    questions: publicQuestions,
    sections: definition.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        if (item.kind === "upload") {
          const { classification, legalHold, ...publicItem } = item;
          void classification;
          void legalHold;
          return publicItem;
        }
        if (item.kind === "signature") {
          const { documentId, ...publicItem } = item;
          void documentId;
          return publicItem;
        }
        return item;
      }),
    })),
  };
}

function serializePublicSubmission(input: {
  link: IntakeFormLinkRecord;
  snapshot: AnswerSnapshotRecord;
  proposalCount: number;
}) {
  return {
    status: "submitted",
    link: serializePublicLink(input.link),
    submission: {
      capturedAt: input.snapshot.capturedAt,
      answerCount: Object.keys(input.snapshot.answers).length,
    },
    proposalCount: input.proposalCount,
  };
}

function buildPortalUrl(publicWebBaseUrl: string, token: string): string {
  return `${publicWebBaseUrl.replace(/\/+$/, "")}/intake-forms/${encodeURIComponent(token)}`;
}

function intakeReviewTaskId(formLinkId: string): string {
  return `intake-review:${formLinkId}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function submissionFingerprint(answers: Record<string, unknown>): string {
  return createHash("sha256").update(stableJson({ answers })).digest("hex");
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

async function ensureIntakeReviewTask(
  repository: ApiRouteDependencies["repository"],
  link: IntakeFormLinkRecord,
  now: string,
): Promise<void> {
  const taskId = intakeReviewTaskId(link.id);
  const existing = await repository.getTaskDeadline(link.firmId, taskId);
  if (existing) return;
  await repository.createTaskDeadline({
    id: taskId,
    firmId: link.firmId,
    matterId: link.matterId,
    title: "Review submitted intake form",
    dueAt: now,
  });
}

async function completeIntakeReviewTask(
  repository: ApiRouteDependencies["repository"],
  link: IntakeFormLinkRecord,
  completedAt: string,
): Promise<void> {
  await repository.completeTaskDeadline({
    firmId: link.firmId,
    taskId: intakeReviewTaskId(link.id),
    completedAt,
  });
}

async function getSubmittedReviewPayload(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  linkId: string,
): Promise<{
  link: IntakeFormLinkRecord;
  snapshot: AnswerSnapshotRecord;
  actions: IntakeFormItemActionRecord[];
  reviews: IntakeFormReviewRecord[];
}> {
  const link = await repository.getIntakeFormLink(firmId, linkId);
  if (!link) throw Object.assign(new Error("Intake form link was not found"), { statusCode: 404 });
  if (!link.submittedAt || !link.answerSnapshotId) {
    throw new ApiHttpError(
      409,
      "INTAKE_FORM_REVIEW_NOT_READY",
      "Intake form link is not ready for review",
      { linkId },
    );
  }
  const snapshots = await repository.listAnswerSnapshots(firmId, {
    intakeSessionId: link.intakeSessionId,
  });
  const snapshot = snapshots.find((candidate) => candidate.id === link.answerSnapshotId);
  if (!snapshot) {
    throw new ApiHttpError(
      409,
      "INTAKE_FORM_REVIEW_SNAPSHOT_MISSING",
      "Submitted intake answer snapshot is not available",
      { linkId },
    );
  }
  const [actions, reviews] = await Promise.all([
    repository.listIntakeFormItemActions(firmId, { formLinkId: link.id }),
    repository.listIntakeFormReviews(firmId, { formLinkId: link.id }),
  ]);
  return { link, snapshot, actions, reviews };
}

async function recordReviewDecision(
  repository: ApiRouteDependencies["repository"],
  input: {
    link: IntakeFormLinkRecord;
    snapshot: AnswerSnapshotRecord;
    decision: IntakeFormReviewDecision;
    decidedByUserId: string;
    decidedAt: string;
    reason?: string;
    followUpFormLinkId?: string;
  },
): Promise<IntakeFormReviewRecord> {
  return repository.createIntakeFormReview({
    id: crypto.randomUUID(),
    firmId: input.link.firmId,
    matterId: input.link.matterId,
    intakeSessionId: input.link.intakeSessionId,
    formLinkId: input.link.id,
    answerSnapshotId: input.snapshot.id,
    decision: input.decision,
    decidedByUserId: input.decidedByUserId,
    decidedAt: input.decidedAt,
    reason: input.reason,
    followUpFormLinkId: input.followUpFormLinkId,
  });
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

function signatureItems(definition: EmbeddedIntakeTemplateDefinition): Array<{
  sectionId: string;
  item: Extract<EmbeddedIntakeFormItem, { kind: "signature" }>;
}> {
  if (definition.schemaVersion !== 2) return [];
  return definition.sections.flatMap((section) =>
    section.items
      .filter(
        (item): item is Extract<EmbeddedIntakeFormItem, { kind: "signature" }> =>
          item.kind === "signature",
      )
      .map((item) => ({ sectionId: section.id, item })),
  );
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

async function buildIdempotentSubmissionReplay(input: {
  repository: ApiRouteDependencies["repository"];
  link: IntakeFormLinkRecord;
  answers: Record<string, unknown>;
  clientSubmissionId?: string;
}) {
  const fingerprint = submissionFingerprint(input.answers);
  if (
    !input.clientSubmissionId ||
    input.link.clientSubmissionId !== input.clientSubmissionId ||
    input.link.submissionFingerprint !== fingerprint ||
    !input.link.answerSnapshotId
  ) {
    throw submissionConflict();
  }

  const snapshots = await input.repository.listAnswerSnapshots(input.link.firmId, {
    intakeSessionId: input.link.intakeSessionId,
  });
  const snapshot = snapshots.find((candidate) => candidate.id === input.link.answerSnapshotId);
  if (!snapshot) throw denied();
  const proposals = (
    await input.repository.listIntakeVariableProposals(input.link.firmId, {
      matterId: input.link.matterId,
    })
  ).filter((proposal) => proposal.answerSnapshotId === snapshot.id);

  return {
    response: serializePublicSubmission({
      link: input.link,
      snapshot,
      proposalCount: proposals.length,
    }),
    snapshot,
  };
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

  server.post("/api/intake-templates/preview", async (request) => {
    const body = parseRequestPart(intakeTemplatePreviewBodySchema, request.body, "body");
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "update",
      matterId: body.matterId,
    });
    const preview = previewEmbeddedIntakeTemplate({
      templateId: "preview",
      templateVersion: 1,
      definition: body.definition,
      answers: body.answers,
      selectedPackageIds: body.selectedPackageIds,
    });
    if (preview.preview === null || !body.matterId) return preview;

    const checks = preview.checks.filter((check) => check.code !== "signature_document_unverified");
    for (const { sectionId, item } of signatureItems(body.definition)) {
      if (!item.documentId) continue;
      const document = await repository.getDocument(request.auth.firmId, item.documentId);
      if (!document || document.matterId !== body.matterId) {
        checks.push({
          code: "signature_document_unavailable",
          severity: "blocking",
          message: "Signature document is not available for the selected matter.",
          sectionId,
          itemId: item.id,
        });
      }
    }

    return {
      ...preview,
      checks,
      status: intakeTemplatePreviewStatus(checks),
    };
  });

  server.get("/api/intake-templates/:id/qa-preview", async (request) => {
    const params = parseRequestPart(intakeTemplateParamsSchema, request.params, "params");
    assertIntakeAccess(request.auth, { resource: "intake_session", action: "read" });
    const template = await getTemplate(repository, request.auth.firmId, params.id);
    const qaReport = buildEmbeddedIntakeTemplateQaReport({
      templateId: template.id,
      templateVersion: template.definitionVersion,
      definition: template.definition,
    });
    return {
      template: {
        id: template.id,
        name: template.name,
        active: template.active,
        provider: template.provider,
        definitionVersion: template.definitionVersion,
      },
      qa: {
        ...qaReport,
        previews: qaReport.previews.map((preview) => ({
          id: preview.id,
          label: preview.label,
          selectedPackageIds: preview.selectedPackageIds,
          visibleQuestionIds: preview.visibleQuestionIds,
          visibleFormItemIds: preview.visibleFormItemIds,
          requiredIncompleteItemIds: preview.requiredIncompleteItemIds,
          matchedBranchRuleIds: preview.matchedBranchRuleIds,
          eligiblePackageIds: preview.eligiblePackageIds,
          packageDocuments: preview.packageDocuments,
        })),
      },
    };
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
    if (body.notificationEmail) {
      requireEmailDeliveryConfirmation(body.deliveryConfirmation, { recipientCount: 1 });
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

  server.get("/api/intake-form-links/:id/review", async (request) => {
    const params = parseRequestPart(reviewParamsSchema, request.params, "params");
    const payload = await getSubmittedReviewPayload(repository, request.auth.firmId, params.id);
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "read",
      matterId: payload.link.matterId,
    });
    return {
      link: serializeLink(payload.link),
      snapshot: payload.snapshot,
      actions: payload.actions,
      reviews: payload.reviews,
    };
  });

  server.post("/api/intake-form-links/:id/review/accept", async (request) => {
    const params = parseRequestPart(reviewParamsSchema, request.params, "params");
    const body = parseRequestPart(reviewDecisionBodySchema, request.body ?? {}, "body");
    const payload = await getSubmittedReviewPayload(repository, request.auth.firmId, params.id);
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "approve",
      matterId: payload.link.matterId,
    });
    if (payload.reviews.length > 0) {
      throw new ApiHttpError(
        409,
        "INTAKE_FORM_ALREADY_REVIEWED",
        "Intake form is already reviewed",
      );
    }
    const decidedAt = new Date().toISOString();
    const review = await recordReviewDecision(repository, {
      link: payload.link,
      snapshot: payload.snapshot,
      decision: "accepted",
      decidedByUserId: request.auth.user.id,
      decidedAt,
      reason: body.reason,
    });
    await completeIntakeReviewTask(repository, payload.link, decidedAt);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_form_review.accepted",
      resourceType: "intake_form_review",
      resourceId: review.id,
      metadata: {
        matterId: payload.link.matterId,
        intakeSessionId: payload.link.intakeSessionId,
        formLinkId: payload.link.id,
        answerSnapshotId: payload.snapshot.id,
        decision: review.decision,
        taskId: intakeReviewTaskId(payload.link.id),
      },
    });
    return { review };
  });

  server.post("/api/intake-form-links/:id/review/reject", async (request) => {
    const params = parseRequestPart(reviewParamsSchema, request.params, "params");
    const body = parseRequestPart(reviewDecisionBodySchema.required(), request.body ?? {}, "body");
    const payload = await getSubmittedReviewPayload(repository, request.auth.firmId, params.id);
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "approve",
      matterId: payload.link.matterId,
    });
    if (payload.reviews.length > 0) {
      throw new ApiHttpError(
        409,
        "INTAKE_FORM_ALREADY_REVIEWED",
        "Intake form is already reviewed",
      );
    }
    const decidedAt = new Date().toISOString();
    const review = await recordReviewDecision(repository, {
      link: payload.link,
      snapshot: payload.snapshot,
      decision: "rejected",
      decidedByUserId: request.auth.user.id,
      decidedAt,
      reason: body.reason,
    });
    await completeIntakeReviewTask(repository, payload.link, decidedAt);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_form_review.rejected",
      resourceType: "intake_form_review",
      resourceId: review.id,
      metadata: {
        matterId: payload.link.matterId,
        intakeSessionId: payload.link.intakeSessionId,
        formLinkId: payload.link.id,
        answerSnapshotId: payload.snapshot.id,
        decision: review.decision,
        taskId: intakeReviewTaskId(payload.link.id),
      },
    });
    return { review };
  });

  server.post("/api/intake-form-links/:id/review/request-more-info", async (request) => {
    const params = parseRequestPart(reviewParamsSchema, request.params, "params");
    const body = parseRequestPart(requestMoreInfoBodySchema, request.body ?? {}, "body");
    const payload = await getSubmittedReviewPayload(repository, request.auth.firmId, params.id);
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "approve",
      matterId: payload.link.matterId,
    });
    if (payload.reviews.length > 0) {
      throw new ApiHttpError(
        409,
        "INTAKE_FORM_ALREADY_REVIEWED",
        "Intake form is already reviewed",
      );
    }
    if (!jwtSecret) {
      throw Object.assign(new Error("Intake form token signing is not configured"), {
        statusCode: 503,
      });
    }

    const token = createSessionToken();
    const portalUrl = buildPortalUrl(publicWebBaseUrl, token);
    const decidedAt = new Date().toISOString();
    const followUpLink = await repository.createIntakeFormLink({
      id: crypto.randomUUID(),
      firmId: payload.link.firmId,
      matterId: payload.link.matterId,
      intakeSessionId: payload.link.intakeSessionId,
      tokenHash: hashToken(token, jwtSecret),
      requestedByUserId: request.auth.user.id,
      clientContactId: payload.link.clientContactId,
      parentFormLinkId: payload.link.id,
      expiresAt: body.expiresAt ?? defaultExpiry(new Date()),
      createdAt: decidedAt,
    });
    const review = await recordReviewDecision(repository, {
      link: payload.link,
      snapshot: payload.snapshot,
      decision: "request_more_info",
      decidedByUserId: request.auth.user.id,
      decidedAt,
      reason: body.reason,
      followUpFormLinkId: followUpLink.id,
    });
    await completeIntakeReviewTask(repository, payload.link, decidedAt);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_form_review.request_more_info",
      resourceType: "intake_form_review",
      resourceId: review.id,
      metadata: {
        matterId: payload.link.matterId,
        intakeSessionId: payload.link.intakeSessionId,
        formLinkId: payload.link.id,
        answerSnapshotId: payload.snapshot.id,
        decision: review.decision,
        followUpFormLinkId: followUpLink.id,
        taskId: intakeReviewTaskId(payload.link.id),
      },
    });
    return {
      review,
      followUp: {
        link: serializeLink(followUpLink),
        token,
        portalUrl,
      },
    };
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

  server.get(
    "/api/portal/intake-forms/:token",
    publicTokenPolicyOptions("intake-form", "view"),
    async (request) => {
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
      const reviews = await repository.listIntakeFormReviews(link.firmId, { formLinkId: link.id });
      const latestReview = reviews[0];
      const status = linkStatus(link);
      await recordAccessLog(repository, {
        link,
        request,
        action: "view",
        resourceType: "intake_form_link",
        resourceId: link.id,
        metadata: { outcome: "granted", status },
      });
      return {
        link: serializePublicLink(link),
        draft:
          status === "active" && link.draftUpdatedAt
            ? { answers: link.draftAnswers ?? {}, updatedAt: link.draftUpdatedAt }
            : null,
        review: serializePublicReview(latestReview),
        template: {
          id: template.id,
          name: template.name,
          definitionVersion: template.definitionVersion,
          definition: serializePublicTemplateDefinition(template.definition),
        },
        actions: actions.map(serializePublicItemAction),
      };
    },
  );

  server.post(
    "/api/portal/intake-forms/:token/draft",
    publicTokenPolicyOptions("intake-form", "mutation"),
    async (request) => {
      const params = parseRequestPart(publicTokenParamsSchema, request.params, "params");
      const body = parseRequestPart(publicDraftBodySchema, request.body, "body");
      if (!jwtSecret) throw denied();
      const link = await resolvePublicLink(repository, {
        token: params.token,
        jwtSecret,
        request,
      });
      const draftUpdatedAt = new Date().toISOString();
      const saved = await repository.saveIntakeFormLinkDraft({
        firmId: link.firmId,
        id: link.id,
        answers: body.answers,
        draftUpdatedAt,
      });
      if (!saved || saved.submittedAt || saved.revokedAt) throw denied();
      await recordAccessLog(repository, {
        link: saved,
        request,
        action: "draft",
        resourceType: "intake_form_link",
        resourceId: saved.id,
        metadata: { outcome: "draft_saved", answerCount: Object.keys(body.answers).length },
      });
      return { status: "draft_saved", draftUpdatedAt: saved.draftUpdatedAt ?? draftUpdatedAt };
    },
  );

  server.post(
    "/api/portal/intake-forms/:token/submit",
    publicTokenPolicyOptions("intake-form", "mutation"),
    async (request) => {
      const params = parseRequestPart(publicTokenParamsSchema, request.params, "params");
      const body = parseRequestPart(publicSubmitBodySchema, request.body, "body");
      if (!jwtSecret) throw denied();
      let link = await resolvePublicLink(repository, {
        token: params.token,
        jwtSecret,
        request,
        allowSubmitted: true,
      });
      const fingerprint = submissionFingerprint(body.answers);
      if (linkStatus(link) === "submitted") {
        let replay: Awaited<ReturnType<typeof buildIdempotentSubmissionReplay>>;
        try {
          replay = await buildIdempotentSubmissionReplay({
            repository,
            link,
            answers: body.answers,
            clientSubmissionId: body.clientSubmissionId,
          });
        } catch (error) {
          if (error instanceof ApiHttpError && error.code === "INTAKE_FORM_SUBMISSION_CONFLICT") {
            await recordAccessLog(repository, {
              link,
              request,
              action: "submit",
              resourceType: "intake_form_link",
              resourceId: link.id,
              metadata: { outcome: "submission_conflict" },
            });
          }
          throw error;
        }
        await recordAccessLog(repository, {
          link,
          request,
          action: "submit",
          resourceType: "answer_snapshot",
          resourceId: replay.snapshot.id,
          metadata: { outcome: "idempotent_replay" },
        });
        return replay.response;
      }
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
      if (body.clientSubmissionId) {
        const reserved = await repository.reserveIntakeFormLinkSubmission({
          firmId: link.firmId,
          id: link.id,
          clientSubmissionId: body.clientSubmissionId,
          submissionFingerprint: fingerprint,
        });
        if (
          !reserved ||
          reserved.clientSubmissionId !== body.clientSubmissionId ||
          reserved.submissionFingerprint !== fingerprint
        ) {
          throw submissionConflict();
        }
        link = reserved;
      } else if (link.clientSubmissionId) {
        throw submissionConflict();
      }
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
        answerSnapshotId: snapshot.id,
      });
      await ensureIntakeReviewTask(repository, link, now);
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
      return serializePublicSubmission({
        link: submitted ?? link,
        snapshot,
        proposalCount: createdProposals.length,
      });
    },
  );

  server.post(
    "/api/portal/intake-forms/:token/items/:itemId/uploads",
    publicTokenPolicyOptions("intake-form-upload", "upload-intent"),
    async (request) => {
      const params = parseRequestPart(publicItemParamsSchema, request.params, "params");
      const body = parseRequestPart(publicUploadIntentBodySchema, request.body, "body");
      if (!jwtSecret) throw denied();
      if (!s3) {
        throw new ApiHttpError(
          503,
          "S3_UPLOAD_SIGNING_NOT_CONFIGURED",
          "S3 upload signing is not configured",
        );
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
      const storageKey = `intake-forms/${sanitizeFilename(params.itemId)}/${documentId}-${sanitizeFilename(body.filename)}`;
      const checksumSha256Base64 = sha256HexToBase64(body.checksumSha256);
      const requiredHeaders = {
        "Content-Type": body.contentType,
        "x-amz-checksum-sha256": checksumSha256Base64,
        "x-amz-meta-open-practice-upload-scope": "intake-form",
        "x-amz-meta-open-practice-scan": "required-before-share",
        "x-amz-meta-open-practice-size-bytes": String(body.fileSizeBytes),
        ...(s3.serverSideEncryption
          ? { "x-amz-server-side-encryption": s3.serverSideEncryption }
          : {}),
      };
      const uploadUrl = await getSignedUrl(
        s3.client,
        new PutObjectCommand({
          Bucket: s3.bucket,
          Key: storageKey,
          ChecksumSHA256: checksumSha256Base64,
          ContentType: body.contentType,
          ContentLength: body.fileSizeBytes,
          ...(s3.serverSideEncryption ? { ServerSideEncryption: s3.serverSideEncryption } : {}),
          Metadata: {
            "open-practice-upload-scope": "intake-form",
            "open-practice-scan": "required-before-share",
            "open-practice-size-bytes": String(body.fileSizeBytes),
          },
        }),
        {
          expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS,
          unhoistableHeaders: new Set(Object.keys(requiredHeaders)),
        },
      );
      const document = await repository.createDocumentUploadIntent({
        id: documentId,
        firmId: link.firmId,
        matterId: link.matterId,
        title: body.filename,
        storageKey,
        checksumSha256: body.checksumSha256,
        sizeBytes: body.fileSizeBytes,
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
        evidence: {
          filename: body.filename,
          contentType: body.contentType,
          fileSizeBytes: body.fileSizeBytes,
        },
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
        document: serializePublicUploadDocument(document),
        requiredHeaders,
        maxFileSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES,
        action: serializePublicItemAction(action),
      };
    },
  );

  server.post(
    "/api/portal/intake-forms/:token/items/:itemId/documents/:documentId/complete",
    publicTokenPolicyOptions("intake-form-upload", "mutation"),
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
      if (!s3) {
        throw new ApiHttpError(
          503,
          "S3_UPLOAD_SIGNING_NOT_CONFIGURED",
          "S3 upload signing is not configured",
        );
      }
      await verifyUploadedObject(s3, {
        storageKey: document.storageKey,
        checksumSha256: body.checksumSha256,
        expectedSizeBytes: document.sizeBytes ?? 0,
      });
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
      return {
        document: serializePublicUploadDocument(completed),
        action: serializePublicItemAction(completedAction),
      };
    },
  );

  server.post(
    "/api/portal/intake-forms/:token/items/:itemId/signature",
    publicTokenPolicyOptions("intake-form-signature", "mutation"),
    async (request) => {
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
        return { action: serializePublicItemAction(existingAction) };
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
        return {
          action: serializePublicItemAction(action),
          signatureRequest: { id: signatureRequest.id, status: body.status },
        };
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
      return { action: serializePublicItemAction(recorded) };
    },
  );
}
