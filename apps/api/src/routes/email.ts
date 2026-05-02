import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest, EmailEventRecord, EmailOutboxRecord } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "./outbound-email.js";
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

function sanitizeDeliveryFailureSummary(message: string | undefined): string | undefined {
  if (!message) return undefined;
  return message.replace(/\s+/g, " ").trim().slice(0, 240) || undefined;
}

function recipientCount(email: EmailOutboxRecord): number {
  return email.to.length + email.cc.length + email.bcc.length;
}

function serializeDeliveryEvent(event: EmailEventRecord) {
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
      },
    };
  });
}
