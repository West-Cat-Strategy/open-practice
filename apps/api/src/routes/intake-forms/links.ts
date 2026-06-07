import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AnswerSnapshotRecord,
  IntakeFormItemActionRecord,
  IntakeFormLinkRecord,
  IntakeFormReviewDecision,
  IntakeFormReviewRecord,
} from "@open-practice/domain";
import { createSessionToken, hashToken } from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "../delivery-confirmation.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "../outbound-email.js";
import {
  assertIntakeAccess,
  completeIntakeReviewTask,
  intakeReviewTaskId,
  intakeTemplateParamsSchema,
  linkStatus,
} from "./shared.js";
import type { IntakeFormRouteDependencies } from "./shared.js";

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

function defaultExpiry(now: Date): string {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
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

function buildPortalUrl(publicWebBaseUrl: string, token: string): string {
  return `${publicWebBaseUrl.replace(/\/+$/, "")}/intake-forms#${encodeURIComponent(token)}`;
}

async function getSubmittedReviewPayload(
  repository: IntakeFormRouteDependencies["repository"],
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
  repository: IntakeFormRouteDependencies["repository"],
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

export function registerIntakeFormLinkRoutes(
  server: FastifyInstance,
  dependencies: IntakeFormRouteDependencies,
): void {
  const {
    repository,
    jwtSecret,
    emailJobQueue,
    publicWebBaseUrl = "http://localhost:3000",
  } = dependencies;

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
}
