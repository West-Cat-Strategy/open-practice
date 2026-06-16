import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type {
  AccessLogRecord,
  AnswerSnapshotRecord,
  Contact,
  EmbeddedIntakeFormItem,
  EmbeddedIntakeTemplateDefinition,
  IntakeFormItemActionRecord,
  IntakeFormLinkRecord,
  IntakeFormReviewRecord,
  SignatureProviderEventRecord,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
} from "@open-practice/domain";
import { createIntakeVariableProposals, resolveEmbeddedIntakeAnswers } from "@open-practice/domain";
import {
  hashToken,
  publicTokenPathFromHeader,
  readPublicTokenHeader,
} from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import {
  ensureIntakeReviewTask,
  getTemplateForSession,
  linkExpired,
  linkStatus,
} from "./shared.js";
import type { IntakeFormRouteDependencies } from "./shared.js";
import { trustedEvidence } from "../trusted-evidence.js";
import { publicTokenPolicyOptions } from "../public-token-rate-limits.js";
import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  normalizeChecksumSha256,
  normalizeUploadSizeBytes,
  sanitizeUploadFilenameSegment,
  sha256HexToBase64,
  uploadContentTypeSchema,
  uploadFilenameSchema,
  verifyUploadedObject,
} from "../upload-verification.js";

const SIGNED_URL_EXPIRES_IN_SECONDS = 600;

const publicTokenParamsSchema = z.object({ token: z.string().min(1) });

const publicItemParamsSchema = z.object({
  itemId: z.string().min(1),
});

const publicCompleteParamsSchema = z.object({
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
  filename: uploadFilenameSchema,
  checksumSha256: z.string().transform(normalizeChecksumSha256),
  fileSizeBytes: z.coerce.number().transform(normalizeUploadSizeBytes),
  contentType: uploadContentTypeSchema,
});

const publicCompleteBodySchema = z.object({
  checksumSha256: z.string().transform(normalizeChecksumSha256),
});

const publicSignatureBodySchema = z.object({
  status: z.enum(["completed", "declined"]),
  consentText: z.string().min(1).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

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

function readIntakeFormPublicToken(request: FastifyRequest): string {
  const params = request.params as { token?: string } | undefined;
  return parseRequestPart(
    publicTokenParamsSchema,
    params?.token ? params : publicTokenPathFromHeader(readPublicTokenHeader(request.headers)),
    "params",
  ).token;
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

async function assertNoActivePublicUploadIntent(input: {
  repository: IntakeFormRouteDependencies["repository"];
  firmId: string;
  formLinkId: string;
  itemId: string;
}): Promise<void> {
  const actions = await input.repository.listIntakeFormItemActions(input.firmId, {
    formLinkId: input.formLinkId,
    itemId: input.itemId,
  });
  for (const action of actions) {
    if (action.kind !== "upload" || action.status !== "intent_created" || !action.documentId) {
      continue;
    }
    const document = await input.repository.getDocument(input.firmId, action.documentId);
    if (document?.uploadStatus === "intent_created") {
      throw new ApiHttpError(
        409,
        "PUBLIC_INTAKE_UPLOAD_INTENT_ACTIVE",
        "An upload intent is already active for this intake item",
      );
    }
  }
}

async function recordAccessLog(
  repository: IntakeFormRouteDependencies["repository"],
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
  repository: IntakeFormRouteDependencies["repository"],
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
  const expired = linkExpired(link);
  if (status !== "active" && !(input.allowSubmitted && status === "submitted" && !expired)) {
    await recordAccessLog(repository, {
      link,
      request: input.request,
      action: "view",
      resourceType: "intake_form_link",
      resourceId: link.id,
      metadata: {
        outcome: "denied",
        reason: expired && status === "submitted" ? "expired" : status,
      },
    });
    throw denied();
  }
  return link;
}

async function buildIdempotentSubmissionReplay(input: {
  repository: IntakeFormRouteDependencies["repository"];
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

export function registerPublicIntakeFormRoutes(
  server: FastifyInstance,
  dependencies: IntakeFormRouteDependencies,
): void {
  const { repository, s3, jwtSecret, signatureProvider } = dependencies;

  const viewPublicIntakeForm = async (request: FastifyRequest) => {
    const token = readIntakeFormPublicToken(request);
    if (!jwtSecret) throw denied();
    const link = await resolvePublicLink(repository, {
      token,
      jwtSecret,
      request,
      allowSubmitted: true,
    });
    const session = await repository.getIntakeSession(link.firmId, link.intakeSessionId);
    if (!session) throw denied();
    const template = await getTemplateForSession(repository, link.firmId, session);
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
  };

  server.get(
    "/api/portal/intake-forms",
    publicTokenPolicyOptions("intake-form", "view"),
    viewPublicIntakeForm,
  );
  server.get(
    "/api/portal/intake-forms/:token",
    publicTokenPolicyOptions("intake-form", "view"),
    viewPublicIntakeForm,
  );

  const savePublicIntakeDraft = async (request: FastifyRequest) => {
    const token = readIntakeFormPublicToken(request);
    const body = parseRequestPart(publicDraftBodySchema, request.body, "body");
    if (!jwtSecret) throw denied();
    const link = await resolvePublicLink(repository, {
      token,
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
  };

  server.post(
    "/api/portal/intake-forms/draft",
    publicTokenPolicyOptions("intake-form", "mutation"),
    savePublicIntakeDraft,
  );
  server.post(
    "/api/portal/intake-forms/:token/draft",
    publicTokenPolicyOptions("intake-form", "mutation"),
    savePublicIntakeDraft,
  );

  const submitPublicIntakeForm = async (request: FastifyRequest) => {
    const token = readIntakeFormPublicToken(request);
    const body = parseRequestPart(publicSubmitBodySchema, request.body, "body");
    if (!jwtSecret) throw denied();
    let link = await resolvePublicLink(repository, {
      token,
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
    const template = await getTemplateForSession(repository, link.firmId, session);
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
  };

  server.post(
    "/api/portal/intake-forms/submit",
    publicTokenPolicyOptions("intake-form", "mutation"),
    submitPublicIntakeForm,
  );
  server.post(
    "/api/portal/intake-forms/:token/submit",
    publicTokenPolicyOptions("intake-form", "mutation"),
    submitPublicIntakeForm,
  );

  const createPublicIntakeUploadIntent = async (request: FastifyRequest) => {
    const token = readIntakeFormPublicToken(request);
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
    const link = await resolvePublicLink(repository, { token, jwtSecret, request });
    const session = await repository.getIntakeSession(link.firmId, link.intakeSessionId);
    if (!session) throw denied();
    const template = await getTemplateForSession(repository, link.firmId, session);
    const item = findFormItem(template.definition, params.itemId, "upload");
    if (!item || item.kind !== "upload") throw denied();
    if (!contentTypeAllowed(body.contentType, item.acceptedFileTypes)) {
      throw unsupportedUploadContentType(body.contentType, item.acceptedFileTypes ?? []);
    }
    await assertNoActivePublicUploadIntent({
      repository,
      firmId: link.firmId,
      formLinkId: link.id,
      itemId: params.itemId,
    });
    const documentId = crypto.randomUUID();
    const storageKey = `intake-forms/${sanitizeUploadFilenameSegment(
      params.itemId,
    )}/${documentId}-${sanitizeUploadFilenameSegment(body.filename)}`;
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
  };

  server.post(
    "/api/portal/intake-forms/items/:itemId/uploads",
    publicTokenPolicyOptions("intake-form-upload", "upload-intent"),
    createPublicIntakeUploadIntent,
  );
  server.post(
    "/api/portal/intake-forms/:token/items/:itemId/uploads",
    publicTokenPolicyOptions("intake-form-upload", "upload-intent"),
    createPublicIntakeUploadIntent,
  );

  const completePublicIntakeUpload = async (request: FastifyRequest) => {
    const token = readIntakeFormPublicToken(request);
    const params = parseRequestPart(publicCompleteParamsSchema, request.params, "params");
    const body = parseRequestPart(publicCompleteBodySchema, request.body, "body");
    if (!jwtSecret) throw denied();
    const link = await resolvePublicLink(repository, { token, jwtSecret, request });
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
  };

  server.post(
    "/api/portal/intake-forms/items/:itemId/documents/:documentId/complete",
    publicTokenPolicyOptions("intake-form-upload", "mutation"),
    completePublicIntakeUpload,
  );
  server.post(
    "/api/portal/intake-forms/:token/items/:itemId/documents/:documentId/complete",
    publicTokenPolicyOptions("intake-form-upload", "mutation"),
    completePublicIntakeUpload,
  );

  const recordPublicIntakeSignature = async (request: FastifyRequest) => {
    const token = readIntakeFormPublicToken(request);
    const params = parseRequestPart(publicItemParamsSchema, request.params, "params");
    const body = parseRequestPart(publicSignatureBodySchema, request.body, "body");
    if (!jwtSecret) throw denied();
    const link = await resolvePublicLink(repository, { token, jwtSecret, request });
    const session = await repository.getIntakeSession(link.firmId, link.intakeSessionId);
    if (!session) throw denied();
    const template = await getTemplateForSession(repository, link.firmId, session);
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
        );
      }
      if (!session.clientContactId) {
        throw signatureConfigurationError(
          "INTAKE_SIGNATURE_SIGNER_UNAVAILABLE",
          "Signature signer contact is not available for this intake form",
        );
      }
      const contact = await repository.getContact(link.firmId, session.clientContactId);
      const signerEmail = contact ? firstContactEmail(contact) : undefined;
      if (!contact || !signerEmail) {
        throw signatureConfigurationError(
          "INTAKE_SIGNATURE_SIGNER_UNAVAILABLE",
          "Signature signer contact email is not available for this intake form",
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
        evidence: trustedEvidence(
          {
            mode: "embedded_intake_signature_request",
            formLinkId: link.id,
            itemId: params.itemId,
            signerId: signerRecord.id,
            consentText: body.consentText ?? item.consentText,
            ip: request.ip,
            userAgent: requestUserAgent(request),
          },
          body.evidence,
        ),
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
      evidence: trustedEvidence(
        {
          mode: "embedded_intake_attestation",
          consentText: body.consentText ?? item.consentText,
          ip: request.ip,
          userAgent: requestUserAgent(request),
        },
        body.evidence,
      ),
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
  };

  server.post(
    "/api/portal/intake-forms/items/:itemId/signature",
    publicTokenPolicyOptions("intake-form-signature", "mutation"),
    recordPublicIntakeSignature,
  );
  server.post(
    "/api/portal/intake-forms/:token/items/:itemId/signature",
    publicTokenPolicyOptions("intake-form-signature", "mutation"),
    recordPublicIntakeSignature,
  );
}
