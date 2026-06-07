import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  sanitizeDraftHtml,
  type EmailEventRecord,
  type EmailOutboxRecord,
} from "@open-practice/domain";
import { createSessionToken, hashToken } from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { appendWorkflowAuditEvent } from "../audit-events.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "../delivery-confirmation.js";
import {
  buildIdempotencyKey,
  idempotencyMetadata,
  rethrowIdempotencyConflict,
} from "../idempotency.js";
import {
  EMAIL_JOB_MAX_ATTEMPTS,
  emailDeliveryReceiptStatus,
  enqueueFailureError,
  markJobEnqueueFailed,
  queueRouteEmailOutbox,
  summarizeQueuedRouteEmail,
} from "../outbound-email.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertEmailAccess, requireReceiptSecret } from "./shared.js";

const relatedResourceTypeSchema = z.enum([
  "document",
  "draft",
  "external_upload",
  "intake_session",
  "invoice",
  "share_link",
  "signature_request",
]);

const emailPreviewBodySchema = z
  .object({
    matterId: z.string().min(1),
    templateKey: z.string().min(1).optional(),
    template: z.string().min(1).optional(),
    from: z.string().min(1).default("Open Practice <no-reply@open-practice.local>"),
    to: z.array(z.string().email()).default([]),
    cc: z.array(z.string().email()).default([]),
    bcc: z.array(z.string().email()).default([]),
    subject: z.string().min(1),
    htmlBody: z.string().default(""),
    textBody: z.string().default(""),
    relatedResourceType: relatedResourceTypeSchema.optional(),
    relatedResourceId: z.string().min(1).optional(),
  })
  .refine((body) => body.templateKey || body.template, {
    path: ["templateKey"],
    message: "templateKey is required",
  })
  .refine((body) => body.htmlBody.trim().length > 0 || body.textBody.trim().length > 0, {
    path: ["textBody"],
    message: "Either htmlBody or textBody is required",
  })
  .transform((body) => ({
    ...body,
    templateKey: body.templateKey ?? body.template!,
    usedLegacyTemplateAlias: !body.templateKey && Boolean(body.template),
  }));

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
  deliveryConfirmation: deliveryConfirmationSchema.optional(),
});

const deliveryReceiptRequestSchema = z.object({
  requested: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
  includeInBody: z.boolean().default(true),
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
    deliveryConfirmation: deliveryConfirmationSchema.optional(),
    deliveryReceipt: deliveryReceiptRequestSchema.optional(),
    receipt: deliveryReceiptRequestSchema.optional(),
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

type RelatedResourceType = z.infer<typeof relatedResourceTypeSchema>;
type RegisterEmailOutboxRouteOptions = Pick<
  ApiRouteDependencies,
  "repository" | "emailJobQueue"
> & {
  jwtSecret?: string;
  publicWebBaseUrl?: string;
};

function emailMatterId(email: EmailOutboxRecord): string | undefined {
  return (
    email.matterId ||
    (typeof email.metadata.matterId === "string" ? email.metadata.matterId : undefined)
  );
}

function sanitizeDeliveryFailureSummary(message: string | undefined): string | undefined {
  if (!message) return undefined;
  return message.replace(/\s+/g, " ").trim().slice(0, 240) || undefined;
}

function previewText(value: string): { value: string; truncated: boolean } | undefined {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  const maxLength = 1200;
  return {
    value: normalized.slice(0, maxLength),
    truncated: normalized.length > maxLength,
  };
}

function previewHtml(
  value: string,
): { value: string; sanitized: boolean; truncated: boolean } | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const sanitized = sanitizeDraftHtml(trimmed);
  const maxLength = 1600;
  return {
    value: sanitized.slice(0, maxLength),
    sanitized: sanitized !== trimmed,
    truncated: sanitized.length > maxLength,
  };
}

function emailPreviewWarnings(input: {
  usedLegacyTemplateAlias: boolean;
  recipientCount: number;
  textTruncated: boolean;
  htmlSanitized: boolean;
  htmlTruncated: boolean;
}): string[] {
  return [
    input.usedLegacyTemplateAlias ? "legacy_template_alias" : undefined,
    input.recipientCount === 0 ? "no_recipients" : undefined,
    input.textTruncated ? "text_body_truncated" : undefined,
    input.htmlSanitized ? "html_body_sanitized" : undefined,
    input.htmlTruncated ? "html_body_truncated" : undefined,
  ].filter((warning): warning is string => Boolean(warning));
}

function emailRecipientCount(email: EmailOutboxRecord): number {
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

function serializeDeliveryHistory(
  email: EmailOutboxRecord,
  events: EmailEventRecord[],
  receiptToken?: Parameters<typeof emailDeliveryReceiptStatus>[1],
) {
  const latestFailure = [...events].reverse().find((event) => event.eventType === "failed");
  return {
    id: email.id,
    matterId: email.matterId,
    templateKey: email.templateKey,
    status: email.status,
    relatedResourceType: email.relatedResourceType,
    relatedResourceId: email.relatedResourceId,
    recipientCount: emailRecipientCount(email),
    attemptCount: email.attemptCount,
    queuedAt: email.queuedAt,
    lastAttemptAt: email.lastAttemptAt,
    sentAt: email.sentAt,
    failedAt: email.failedAt,
    terminalFailureAt: email.terminalFailureAt,
    failureSummary:
      sanitizeDeliveryFailureSummary(email.terminalFailureReason) ??
      sanitizeDeliveryFailureSummary(latestFailure?.errorMessage),
    deliveryReceipt: emailDeliveryReceiptStatus(email, receiptToken),
    events: events.map(serializeDeliveryEvent),
  };
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

function buildReceiptRecordUrl(publicWebBaseUrl: string | undefined, token: string): string {
  const baseUrl = (publicWebBaseUrl ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${baseUrl}/api/portal/email-receipts/${encodeURIComponent(token)}`;
}

function buildDeliveryReceiptPayload(input: {
  receipt: z.infer<typeof deliveryReceiptRequestSchema> | undefined;
  jwtSecret: string | undefined;
  publicWebBaseUrl: string | undefined;
}):
  | {
      tokenHash: string;
      requestedAt: string;
      expiresAt: string;
      recordUrl: string;
      includeInBody: boolean;
    }
  | undefined {
  if (!input.receipt?.requested) return undefined;
  const secret = requireReceiptSecret(input.jwtSecret);
  const token = createSessionToken();
  const requestedAt = new Date();
  const expiresAt =
    input.receipt.expiresAt ??
    new Date(requestedAt.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString();
  return {
    tokenHash: hashToken(token, secret),
    requestedAt: requestedAt.toISOString(),
    expiresAt,
    recordUrl: buildReceiptRecordUrl(input.publicWebBaseUrl, token),
    includeInBody: input.receipt.includeInBody,
  };
}

export function registerEmailOutboxRoutes(
  server: FastifyInstance,
  { repository, emailJobQueue, jwtSecret, publicWebBaseUrl }: RegisterEmailOutboxRouteOptions,
): void {
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
    const receiptTokens = await repository.listEmailReceiptTokens(request.auth.firmId, {
      matterId: query.matterId,
    });
    const receiptTokenByEmailId = new Map(
      receiptTokens.map((receiptToken) => [receiptToken.emailId, receiptToken]),
    );

    return {
      emails: emails.map((email) =>
        serializeDeliveryHistory(
          email,
          eventsByEmailId.get(email.id) ?? [],
          receiptTokenByEmailId.get(email.id),
        ),
      ),
    };
  });

  server.post("/api/email/previews", async (request) => {
    const body = parseRequestPart(emailPreviewBodySchema, request.body, "body");
    assertEmailAccess(request.auth, {
      resource: "email",
      action: "create",
      matterId: body.matterId,
    });
    await assertRelatedResourceMatchesMatter(repository, request.auth, body);

    const textPreview = previewText(body.textBody);
    const htmlPreview = previewHtml(body.htmlBody);
    const recipientCount = body.to.length + body.cc.length + body.bcc.length;

    return {
      status: "previewed",
      mode: "render_only",
      preview: {
        matterId: body.matterId,
        templateKey: body.templateKey,
        from: body.from,
        to: body.to,
        cc: body.cc,
        bcc: body.bcc,
        recipientCount,
        subject: body.subject,
        body: {
          textPreview: textPreview?.value,
          htmlPreview: htmlPreview?.value,
          contentTypes: {
            text: Boolean(textPreview),
            html: Boolean(htmlPreview),
          },
        },
        relatedResource:
          body.relatedResourceType && body.relatedResourceId
            ? {
                type: body.relatedResourceType,
                id: body.relatedResourceId,
              }
            : undefined,
        warnings: emailPreviewWarnings({
          usedLegacyTemplateAlias: body.usedLegacyTemplateAlias,
          recipientCount,
          textTruncated: Boolean(textPreview?.truncated),
          htmlSanitized: Boolean(htmlPreview?.sanitized),
          htmlTruncated: Boolean(htmlPreview?.truncated),
        }),
        delivery: {
          persisted: false,
          queued: false,
        },
      },
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
    requireEmailDeliveryConfirmation(body.deliveryConfirmation, {
      recipientCount: body.to.length + body.cc.length + body.bcc.length,
    });
    const deliveryReceipt = buildDeliveryReceiptPayload({
      receipt: body.receipt ?? body.deliveryReceipt,
      jwtSecret,
      publicWebBaseUrl,
    });

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
      deliveryReceipt,
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
        deliveryReceipt: emailDeliveryReceiptStatus(queued.email),
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
    requireEmailDeliveryConfirmation(body.deliveryConfirmation, {
      recipientCount: emailRecipientCount(email),
    });

    const providers = await repository.listProviderSettings(request.auth.firmId, { kind: "smtp" });
    const enabledProvider = providers.find((provider) => provider.enabled);
    if (!enabledProvider) {
      throw new ApiHttpError(503, "SMTP_NOT_CONFIGURED", "SMTP email delivery is not configured");
    }
    if (!emailJobQueue) {
      throw new ApiHttpError(503, "EMAIL_QUEUE_NOT_CONFIGURED", "Email queue is not configured");
    }

    const previousEvents = await repository.listEmailEvents(request.auth.firmId, {
      emailId: email.id,
    });
    const retryOfJobId = [...previousEvents]
      .reverse()
      .find((event) => event.eventType === "failed")?.jobId;
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
    let updatedJob = retried.job;
    if (created) {
      let bullJobId: string | undefined;
      try {
        bullJobId = (
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
        ).id?.toString();
      } catch {
        await markJobEnqueueFailed(repository, request.auth.firmId, retried.job, now);
        throw enqueueFailureError();
      }
      updatedJob = await repository.updateJobLifecycleRecord(request.auth.firmId, retried.job.id, {
        bullJobId,
      });
    }

    if (created)
      await appendWorkflowAuditEvent(repository, request.auth, {
        action: "email_outbox.manual_retry",
        resourceType: "email_outbox",
        resourceId: email.id,
        occurredAt: now,
        metadata: {
          matterId,
          beforeStatus: email.status,
          expectedStatus: "queued",
          afterStatus: retried.email.status,
          attemptNumber: updatedJob.attemptsMade,
          maxAttempts: updatedJob.maxAttempts,
          retryOfJobId,
          idempotencyKeyPresent: true,
        },
        workflow: {
          requestId: request.id,
          matterId,
          matterIds: [matterId],
          status: "queued",
          idempotencyKeyPresent: true,
        },
      });

    reply.code(202);
    return {
      email: serializeDeliveryHistory(
        retried.email,
        await repository.listEmailEvents(request.auth.firmId, { emailId: email.id }),
        (
          await repository.listEmailReceiptTokens(request.auth.firmId, {
            emailId: email.id,
          })
        ).at(-1),
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
