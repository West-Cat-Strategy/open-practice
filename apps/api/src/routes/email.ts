import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest, EmailEventRecord, EmailOutboxRecord } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import {
  buildIdempotencyKey,
  idempotencyMetadata,
  rethrowIdempotencyConflict,
} from "./idempotency.js";
import {
  EMAIL_JOB_MAX_ATTEMPTS,
  queueRouteEmailOutbox,
  summarizeQueuedRouteEmail,
} from "./outbound-email.js";
import type { ApiRouteDependencies } from "./types.js";

const relatedResourceTypeSchema = z.enum([
  "document",
  "draft",
  "external_upload",
  "intake_session",
  "invoice",
  "share_link",
  "signature_request",
]);

const emailPreviewBodySchema = z.object({
  matterId: z.string().min(1),
  template: z.string().min(1),
  to: z.array(z.string().email()).default([]),
});

const emailHistoryQuerySchema = z.object({
  matterId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const emailRetryParamsSchema = z.object({
  emailId: z.string().min(1),
});

const emailRetryBodySchema = z.object({
  matterId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(8).max(180).optional(),
});

const emailOutboxBodySchema = z
  .object({
    matterId: z.string().min(1),
    templateKey: z.string().min(1),
    to: z.array(z.string().email()).min(1),
    cc: z.array(z.string().email()).default([]),
    bcc: z.array(z.string().email()).default([]),
    from: z.string().min(1).default("Open Practice <no-reply@open-practice.local>"),
    subject: z.string().min(1),
    htmlBody: z.string().default(""),
    textBody: z.string().default(""),
    relatedResourceType: relatedResourceTypeSchema.optional(),
    relatedResourceId: z.string().min(1).optional(),
    idempotencyKey: z.string().min(8).max(180).optional(),
    metadata: z
      .object({
        correlationId: z.string().min(1).max(128).optional(),
      })
      .default({}),
  })
  .refine((body) => body.htmlBody.trim().length > 0 || body.textBody.trim().length > 0, {
    path: ["textBody"],
    message: "Either htmlBody or textBody is required",
  });

function emailMatterId(email: EmailOutboxRecord): string | undefined {
  return (
    email.matterId ||
    (typeof email.metadata.matterId === "string" ? email.metadata.matterId : undefined)
  );
}

type RelatedResourceType = z.infer<typeof relatedResourceTypeSchema>;

function sanitizeDeliveryFailureSummary(message: string | undefined): string | undefined {
  if (!message) return undefined;
  return message.replace(/\s+/g, " ").trim().slice(0, 240) || undefined;
}

function recipientCount(email: EmailOutboxRecord): number {
  return email.to.length + email.cc.length + email.bcc.length;
}

function serializeDeliveryEvent(event: EmailEventRecord): Record<string, unknown> {
  return {
    id: event.id,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    providerMessageId: event.providerMessageId,
    attemptNumber: event.attemptNumber,
    jobId: event.jobId,
    source: event.source,
    errorSummary: sanitizeDeliveryFailureSummary(event.errorMessage),
  };
}

function serializeDeliveryHistory(email: EmailOutboxRecord, events: EmailEventRecord[]) {
  const latestFailure = [...events].reverse().find((event) => event.eventType === "failed");
  return {
    id: email.id,
    matterId: email.matterId,
    templateKey: email.templateKey,
    status: email.status,
    relatedResourceType: email.relatedResourceType,
    relatedResourceId: email.relatedResourceId,
    recipientCount: recipientCount(email),
    attemptCount: email.attemptCount,
    queuedAt: email.queuedAt,
    lastAttemptAt: email.lastAttemptAt,
    sentAt: email.sentAt,
    failedAt: email.failedAt,
    terminalFailureAt: email.terminalFailureAt,
    failureSummary:
      sanitizeDeliveryFailureSummary(email.terminalFailureReason) ??
      sanitizeDeliveryFailureSummary(latestFailure?.errorMessage),
    events: events.map(serializeDeliveryEvent),
  };
}

function assertEmailAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

async function resolveRelatedResourceMatterId(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  type: RelatedResourceType,
  id: string,
): Promise<string | undefined> {
  if (type === "document") {
    return (await repository.getDocument(firmId, id))?.matterId;
  }
  if (type === "draft") {
    return (await repository.getDraft(firmId, id))?.matterId;
  }
  if (type === "external_upload") {
    return (await repository.listExternalUploadLinks(firmId)).find((link) => link.id === id)
      ?.matterId;
  }
  if (type === "intake_session") {
    return (await repository.getIntakeSession(firmId, id))?.matterId;
  }
  if (type === "invoice") {
    return (await repository.getInvoice(firmId, id))?.matterId;
  }
  if (type === "share_link") {
    return (await repository.getShareLink(firmId, id))?.matterId;
  }
  return (await repository.listSignatureRequests(firmId)).find((request) => request.id === id)
    ?.matterId;
}

async function assertRelatedResourceMatchesMatter(
  repository: ApiRouteDependencies["repository"],
  context: ApiAuthContext,
  input: {
    matterId: string;
    relatedResourceType?: RelatedResourceType;
    relatedResourceId?: string;
  },
): Promise<void> {
  if (!input.relatedResourceType && !input.relatedResourceId) return;
  if (!input.relatedResourceType || !input.relatedResourceId) {
    throw Object.assign(
      new Error("relatedResourceType and relatedResourceId must be provided together"),
      {
        statusCode: 400,
      },
    );
  }

  const relatedMatterId = await resolveRelatedResourceMatterId(
    repository,
    context.firmId,
    input.relatedResourceType,
    input.relatedResourceId,
  );
  if (!relatedMatterId) {
    throw Object.assign(new Error("Related email resource was not found"), { statusCode: 404 });
  }
  if (relatedMatterId !== input.matterId) {
    throw Object.assign(new Error("Related email resource does not match the email matter"), {
      statusCode: 403,
    });
  }
}

export function registerEmailRoutes(
  server: FastifyInstance,
  { repository, emailJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/email/status", async (request) => {
    const providers = await repository.listProviderSettings(request.auth.firmId, { kind: "smtp" });
    const enabled = providers.find((provider) => provider.enabled);
    return {
      status: enabled ? "configured" : "disabled",
      reason: enabled ? undefined : "not_configured",
      provider: enabled?.key,
      providers: providers.map((provider) => ({
        key: provider.key,
        enabled: provider.enabled,
        updatedAt: provider.updatedAt,
      })),
    };
  });

  server.get("/api/mail/outbox", async (request) => {
    const query = parseRequestPart(emailHistoryQuerySchema, request.query, "query");
    assertEmailAccess(request.auth, {
      resource: "email",
      action: "read",
      matterId: query.matterId,
    });

    const emails = await repository.listEmailOutbox(request.auth.firmId, {
      matterId: query.matterId,
      limit: query.limit,
    });
    const eventsByEmailId = new Map<string, EmailEventRecord[]>();
    await Promise.all(
      emails.map(async (email) => {
        eventsByEmailId.set(
          email.id,
          await repository.listEmailEvents(request.auth.firmId, { emailId: email.id }),
        );
      }),
    );

    return {
      emails: emails.map((email) =>
        serializeDeliveryHistory(email, eventsByEmailId.get(email.id) ?? []),
      ),
    };
  });

  server.post("/api/email/previews", async (request) => {
    const body = parseRequestPart(emailPreviewBodySchema, request.body, "body");
    assertEmailAccess(request.auth, {
      resource: "portal_message",
      action: "create",
      matterId: body.matterId,
    });

    return {
      status: "disabled",
      reason: "not_configured",
      preview: null,
    };
  });

  server.post("/api/mail/outbox", async (request, reply) => {
    const body = parseRequestPart(emailOutboxBodySchema, request.body, "body");
    assertEmailAccess(request.auth, {
      resource: "email",
      action: "create",
      matterId: body.matterId,
    });
    await assertRelatedResourceMatchesMatter(repository, request.auth, body);

    const queued = await queueRouteEmailOutbox(repository, emailJobQueue, request.auth, {
      matterId: body.matterId,
      templateKey: body.templateKey,
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      from: body.from,
      subject: body.subject,
      htmlBody: body.htmlBody,
      textBody: body.textBody,
      relatedResourceType: body.relatedResourceType,
      relatedResourceId: body.relatedResourceId,
      idempotencyKey: body.idempotencyKey,
      metadata: body.metadata,
      source: "api.mail_outbox",
      required: true,
    });
    if (!queued) throw new Error("SMTP email delivery is not configured");

    reply.code(201);
    return {
      queuedEmail: summarizeQueuedRouteEmail(queued),
      email: {
        id: queued.email.id,
        matterId: queued.email.matterId,
        templateKey: queued.email.templateKey,
        status: queued.email.status,
        relatedResourceType: queued.email.relatedResourceType,
        relatedResourceId: queued.email.relatedResourceId,
        attemptCount: queued.email.attemptCount,
        queuedAt: queued.email.queuedAt,
        idempotencyKeyPresent: Boolean(queued.email.idempotencyKey),
      },
      event: {
        id: queued.event.id,
        eventType: queued.event.eventType,
        occurredAt: queued.event.occurredAt,
      },
      job: {
        id: queued.job.id,
        queueName: queued.job.queueName,
        jobName: queued.job.jobName,
        status: queued.job.status,
        targetResourceType: queued.job.targetResourceType,
        targetResourceId: queued.job.targetResourceId,
        idempotencyKeyPresent: Boolean(queued.job.idempotencyKey),
      },
    };
  });

  server.post("/api/mail/outbox/:emailId/retry", async (request, reply) => {
    const params = parseRequestPart(emailRetryParamsSchema, request.params, "params");
    const body = parseRequestPart(emailRetryBodySchema, request.body, "body");
    const email = await repository.getEmailOutbox(request.auth.firmId, params.emailId);
    if (!email) {
      throw new ApiHttpError(404, "EMAIL_OUTBOX_NOT_FOUND", "Email outbox record was not found");
    }
    const matterId = body.matterId ?? emailMatterId(email);
    if (!matterId) {
      throw new ApiHttpError(409, "EMAIL_MATTER_REQUIRED", "Email retry requires matter scope");
    }
    assertEmailAccess(request.auth, {
      resource: "email",
      action: "update",
      matterId,
    });
    if (email.status !== "failed") {
      throw new ApiHttpError(
        409,
        "EMAIL_RETRY_NOT_ALLOWED",
        "Only failed email can be manually retried",
      );
    }

    const providers = await repository.listProviderSettings(request.auth.firmId, { kind: "smtp" });
    const enabledProvider = providers.find((provider) => provider.enabled);
    if (!enabledProvider) {
      throw new ApiHttpError(503, "SMTP_NOT_CONFIGURED", "SMTP email delivery is not configured");
    }
    if (!emailJobQueue) {
      throw new ApiHttpError(503, "EMAIL_QUEUE_NOT_CONFIGURED", "Email queue is not configured");
    }

    const now = new Date().toISOString();
    const jobId = crypto.randomUUID();
    const recipientCount = email.to.length + email.cc.length + email.bcc.length;
    const idempotencyKey = buildIdempotencyKey({
      scope: "email_retry",
      firmId: request.auth.firmId,
      matterId,
      resourceType: "email_outbox",
      resourceId: email.id,
      action: "api.mail_outbox.retry",
      providerOrTemplate: email.templateKey,
      clientKey: body.idempotencyKey,
    });
    const fingerprint = idempotencyMetadata({
      emailId: email.id,
      matterId,
      provider: enabledProvider.key,
      templateKey: email.templateKey,
      previousStatus: email.status,
      recipientCount,
    });
    const jobMetadata = {
      ...fingerprint,
      emailId: email.id,
      matterId,
      provider: enabledProvider.key,
      source: "api.mail_outbox.retry",
      templateKey: email.templateKey,
      recipientCount,
      relatedResourceType: email.relatedResourceType,
      relatedResourceId: email.relatedResourceId,
    };
    let retried: Awaited<ReturnType<typeof repository.retryEmailOutbox>>;
    try {
      retried = await repository.retryEmailOutbox({
        firmId: request.auth.firmId,
        emailId: email.id,
        occurredAt: now,
        requestedByUserId: request.auth.user.id,
        metadata: {
          ...fingerprint,
          matterId,
          provider: enabledProvider.key,
          templateKey: email.templateKey,
          previousStatus: email.status,
        },
        job: {
          id: jobId,
          firmId: request.auth.firmId,
          queueName: "email",
          jobName: "send_email",
          status: "queued",
          targetResourceType: "email_outbox",
          targetResourceId: email.id,
          idempotencyKey,
          attemptsMade: 0,
          maxAttempts: EMAIL_JOB_MAX_ATTEMPTS,
          queuedAt: now,
          metadata: jobMetadata,
        },
      });
    } catch (error) {
      rethrowIdempotencyConflict(error);
    }
    const created = retried.job.id === jobId;
    const updatedJob = created
      ? await repository.updateJobLifecycleRecord(request.auth.firmId, retried.job.id, {
          bullJobId: (
            await emailJobQueue.add(
              "send_email",
              {
                firmId: request.auth.firmId,
                resourceType: "email_outbox",
                resourceId: email.id,
                metadata: { ...jobMetadata, idempotencyKeyPresent: true },
              },
              { jobId },
            )
          ).id?.toString(),
        })
      : retried.job;

    if (created)
      await appendRouteAuditEvent(repository, request.auth, {
        action: "email_outbox.manual_retry",
        resourceType: "email_outbox",
        resourceId: email.id,
        occurredAt: now,
        metadata: {
          matterId,
          provider: enabledProvider.key,
          templateKey: email.templateKey,
          recipientCount,
          previousStatus: email.status,
          jobId: updatedJob.id,
          bullJobId: updatedJob.bullJobId,
          idempotencyKeyPresent: true,
        },
      });

    reply.code(202);
    return {
      email: serializeDeliveryHistory(
        retried.email,
        await repository.listEmailEvents(request.auth.firmId, { emailId: email.id }),
      ),
      event: serializeDeliveryEvent(retried.event),
      job: {
        id: updatedJob.id,
        queueName: updatedJob.queueName,
        jobName: updatedJob.jobName,
        status: updatedJob.status,
        targetResourceType: updatedJob.targetResourceType,
        targetResourceId: updatedJob.targetResourceId,
        idempotencyKeyPresent: Boolean(updatedJob.idempotencyKey),
      },
    };
  });
}
