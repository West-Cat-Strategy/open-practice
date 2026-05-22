import type { OpenPracticeRepository } from "@open-practice/database";
import type {
  EmailEventRecord,
  EmailOutboxRecord,
  EmailReceiptTokenRecord,
  JobLifecycleRecord,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import {
  buildIdempotencyKey,
  idempotencyMetadata,
  rethrowIdempotencyConflict,
} from "./idempotency.js";
import type { ApiJobQueue } from "./types.js";

const DEFAULT_FROM = "Open Practice <no-reply@open-practice.local>";
export const EMAIL_JOB_MAX_ATTEMPTS = 5;

export interface QueueRouteEmailInput {
  matterId: string;
  templateKey: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  from?: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  relatedResourceType?: string;
  relatedResourceId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  deliveryReceipt?: {
    tokenHash: string;
    requestedAt: string;
    expiresAt: string;
    recordUrl: string;
    includeInBody: boolean;
  };
  source?: string;
  required?: boolean;
}

export interface QueuedRouteEmail {
  email: EmailOutboxRecord;
  event: EmailEventRecord;
  job: JobLifecycleRecord;
}

export interface QueuedRouteEmailSummary {
  id: string;
  templateKey: string;
  status: EmailOutboxRecord["status"];
  queuedAt: string;
  jobId: string;
  idempotencyKeyPresent: boolean;
}

export interface EmailDeliveryReceiptStatus {
  status: "pending" | "received";
  requestedAt?: string;
  recordedAt?: string;
}

const enqueueFailureMessage = "Job enqueue failed; retry after the worker queue is available.";

export async function markJobEnqueueFailed(
  repository: OpenPracticeRepository,
  firmId: string,
  job: JobLifecycleRecord,
  occurredAt: string,
): Promise<JobLifecycleRecord> {
  return repository.updateJobLifecycleRecord(firmId, job.id, {
    status: "failed",
    attemptsMade: Math.max(job.attemptsMade, 1),
    failedAt: occurredAt,
    errorMessage: enqueueFailureMessage,
    metadata: { ...job.metadata, enqueueStatus: "failed" },
  });
}

export function enqueueFailureError(): ApiHttpError {
  return new ApiHttpError(
    503,
    "QUEUE_ENQUEUE_FAILED",
    "The worker queue did not accept the job. The durable job record was marked failed for operator review.",
  );
}

export function summarizeQueuedRouteEmail(
  queued: QueuedRouteEmail | undefined,
): QueuedRouteEmailSummary | undefined {
  if (!queued) return undefined;
  return {
    id: queued.email.id,
    templateKey: queued.email.templateKey,
    status: queued.email.status,
    queuedAt: queued.email.queuedAt,
    jobId: queued.job.id,
    idempotencyKeyPresent: Boolean(queued.email.idempotencyKey ?? queued.job.idempotencyKey),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function emailDeliveryReceiptStatus(
  email: EmailOutboxRecord,
  receiptToken?: EmailReceiptTokenRecord,
): EmailDeliveryReceiptStatus | undefined {
  const tokenStatus = emailReceiptTokenStatus(receiptToken);
  if (tokenStatus) return tokenStatus;
  const receipt = email.metadata.deliveryReceipt;
  if (!isObject(receipt) || receipt.requested !== true) return undefined;
  const recordedAt = typeof receipt.recordedAt === "string" ? receipt.recordedAt : undefined;
  return {
    status: recordedAt ? "received" : "pending",
    requestedAt: typeof receipt.requestedAt === "string" ? receipt.requestedAt : undefined,
    recordedAt,
  };
}

export function emailReceiptTokenStatus(
  receiptToken: EmailReceiptTokenRecord | undefined,
): EmailDeliveryReceiptStatus | undefined {
  if (!receiptToken) return undefined;
  return {
    status: receiptToken.recordedAt ? "received" : "pending",
    requestedAt: receiptToken.createdAt,
    recordedAt: receiptToken.recordedAt,
  };
}

function appendTextReceipt(textBody: string, recordUrl: string): string {
  const suffix = `\n\nDelivery receipt endpoint: ${recordUrl}`;
  return textBody.trimEnd().length > 0 ? `${textBody.trimEnd()}${suffix}` : textBody;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function appendHtmlReceipt(htmlBody: string, recordUrl: string): string {
  if (!htmlBody.trim()) return htmlBody;
  return `${htmlBody.trimEnd()}\n<p>Delivery receipt endpoint: ${escapeHtml(recordUrl)}</p>`;
}

export async function queueRouteEmailOutbox(
  repository: OpenPracticeRepository,
  emailJobQueue: ApiJobQueue | undefined,
  auth: ApiAuthContext,
  input: QueueRouteEmailInput,
): Promise<QueuedRouteEmail | undefined> {
  const access = requireAccess(auth, {
    resource: "email",
    action: "create",
    matterId: input.matterId,
  });
  if (!access.ok) throw access.error;

  const providers = await repository.listProviderSettings(auth.firmId, { kind: "smtp" });
  const enabledProvider = providers.find((provider) => provider.enabled);
  if (!enabledProvider) {
    if (input.required) {
      throw new ApiHttpError(503, "SMTP_NOT_CONFIGURED", "SMTP email delivery is not configured");
    }
    return undefined;
  }
  if (!emailJobQueue) {
    if (input.required) {
      throw new ApiHttpError(503, "EMAIL_QUEUE_NOT_CONFIGURED", "Email queue is not configured");
    }
    return undefined;
  }

  const now = new Date().toISOString();
  const emailId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const to = [...input.to];
  const cc = [...(input.cc ?? [])];
  const bcc = [...(input.bcc ?? [])];
  const requestedHtmlBody = input.htmlBody?.trim() ? input.htmlBody : "";
  const requestedTextBody = input.textBody?.trim() ? input.textBody : "";
  const appendReceiptLink = Boolean(input.deliveryReceipt?.includeInBody);
  const htmlBody =
    input.deliveryReceipt && appendReceiptLink
      ? appendHtmlReceipt(requestedHtmlBody, input.deliveryReceipt.recordUrl)
      : requestedHtmlBody;
  const textBody =
    input.deliveryReceipt && appendReceiptLink
      ? appendTextReceipt(requestedTextBody, input.deliveryReceipt.recordUrl)
      : requestedTextBody;
  if (!htmlBody && !textBody) {
    throw new ApiHttpError(
      400,
      "EMAIL_BODY_REQUIRED",
      "Email delivery requires either htmlBody or textBody",
    );
  }
  const metadata = {
    ...(input.metadata ?? {}),
    matterId: input.matterId,
    provider: enabledProvider.key,
    source: input.source,
    createdByUserId: auth.user.id,
    deliveryReceipt: input.deliveryReceipt
      ? {
          requested: true,
          requestedAt: input.deliveryReceipt.requestedAt,
          includeInBody: input.deliveryReceipt.includeInBody,
        }
      : undefined,
  };
  const idempotencyKey = buildIdempotencyKey({
    scope: "email",
    firmId: auth.firmId,
    matterId: input.matterId,
    resourceType: input.relatedResourceType ?? "email_outbox",
    resourceId: input.relatedResourceId,
    action: input.source ?? "api.route",
    providerOrTemplate: input.templateKey,
    clientKey: input.idempotencyKey,
  });
  const fingerprint = idempotencyMetadata({
    matterId: input.matterId,
    provider: enabledProvider.key,
    templateKey: input.templateKey,
    to,
    cc,
    bcc,
    from: input.from ?? DEFAULT_FROM,
    subject: input.subject,
    relatedResourceType: input.relatedResourceType,
    relatedResourceId: input.relatedResourceId,
    source: input.source ?? "api.route",
    deliveryReceiptRequested: Boolean(input.deliveryReceipt),
  });
  const safeJobMetadata = {
    ...fingerprint,
    emailId,
    matterId: input.matterId,
    provider: enabledProvider.key,
    source: input.source ?? "api.route",
    templateKey: input.templateKey,
    recipientCount: to.length + cc.length + bcc.length,
    relatedResourceType: input.relatedResourceType,
    relatedResourceId: input.relatedResourceId,
    deliveryReceiptRequested: Boolean(input.deliveryReceipt),
  };
  let queued: QueuedRouteEmail;
  try {
    queued = await repository.createQueuedEmailOutbox({
      email: {
        id: emailId,
        firmId: auth.firmId,
        matterId: input.matterId,
        idempotencyKey,
        templateKey: input.templateKey,
        status: "queued",
        to,
        cc,
        bcc,
        from: input.from ?? DEFAULT_FROM,
        subject: input.subject,
        htmlBody,
        textBody,
        relatedResourceType: input.relatedResourceType,
        relatedResourceId: input.relatedResourceId,
        queuedAt: now,
        attemptCount: 0,
        metadata: { ...metadata, ...fingerprint },
      },
      event: {
        id: crypto.randomUUID(),
        firmId: auth.firmId,
        emailId,
        eventType: "queued",
        occurredAt: now,
        jobId,
        source: "api",
        metadata: {
          matterId: input.matterId,
          provider: enabledProvider.key,
          source: input.source ?? "api.route",
          idempotencyKeyPresent: true,
        },
      },
      job: {
        id: jobId,
        firmId: auth.firmId,
        queueName: "email",
        jobName: "send_email",
        status: "queued",
        targetResourceType: "email_outbox",
        targetResourceId: emailId,
        idempotencyKey,
        attemptsMade: 0,
        maxAttempts: EMAIL_JOB_MAX_ATTEMPTS,
        queuedAt: now,
        metadata: safeJobMetadata,
      },
    });
  } catch (error) {
    rethrowIdempotencyConflict(error);
  }
  const created = queued.email.id === emailId && queued.job.id === jobId;
  if (!created) return queued;
  if (input.deliveryReceipt) {
    await repository.createEmailReceiptToken({
      id: crypto.randomUUID(),
      firmId: auth.firmId,
      matterId: input.matterId,
      emailId,
      tokenHash: input.deliveryReceipt.tokenHash,
      purpose: "delivery_receipt",
      expiresAt: input.deliveryReceipt.expiresAt,
      createdAt: input.deliveryReceipt.requestedAt,
      metadata: {
        requestedByUserId: auth.user.id,
        includeInBody: input.deliveryReceipt.includeInBody,
      },
    });
  }
  let bullJobId: string | undefined;
  try {
    const bullJob = await emailJobQueue.add(
      "send_email",
      {
        firmId: auth.firmId,
        resourceType: "email_outbox",
        resourceId: emailId,
        metadata: {
          emailId: queued.email.id,
          matterId: input.matterId,
          provider: enabledProvider.key,
          source: input.source ?? "api.route",
          templateKey: input.templateKey,
          recipientCount: to.length + cc.length + bcc.length,
          relatedResourceType: input.relatedResourceType,
          relatedResourceId: input.relatedResourceId,
          idempotencyKeyPresent: true,
        },
      },
      { jobId },
    );
    bullJobId = bullJob.id === undefined ? undefined : String(bullJob.id);
  } catch {
    await markJobEnqueueFailed(repository, auth.firmId, queued.job, now);
    throw enqueueFailureError();
  }
  const updatedJob = await repository.updateJobLifecycleRecord(auth.firmId, queued.job.id, {
    bullJobId,
  });
  const queuedWithJob = { ...queued, job: updatedJob };

  await appendRouteAuditEvent(repository, auth, {
    action: "email_outbox.queued",
    resourceType: "email_outbox",
    resourceId: queued.email.id,
    occurredAt: now,
    metadata: {
      matterId: input.matterId,
      templateKey: queued.email.templateKey,
      provider: enabledProvider.key,
      source: input.source,
      recipientCount: to.length + cc.length + bcc.length,
      relatedResourceType: queued.email.relatedResourceType,
      relatedResourceId: queued.email.relatedResourceId,
      jobId: queuedWithJob.job.id,
      bullJobId: queuedWithJob.job.bullJobId,
    },
  });

  return queuedWithJob;
}
