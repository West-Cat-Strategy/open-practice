import type { OpenPracticeRepository } from "@open-practice/database";
import type {
  EmailEventRecord,
  EmailOutboxRecord,
  JobLifecycleRecord,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";

const DEFAULT_FROM = "Open Practice <no-reply@open-practice.local>";

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
  metadata?: Record<string, unknown>;
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
  };
}

export async function queueRouteEmailOutbox(
  repository: OpenPracticeRepository,
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

  const now = new Date().toISOString();
  const emailId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const to = [...input.to];
  const cc = [...(input.cc ?? [])];
  const bcc = [...(input.bcc ?? [])];
  const metadata = {
    ...(input.metadata ?? {}),
    matterId: input.matterId,
    provider: enabledProvider.key,
  };
  const queued = await repository.createQueuedEmailOutbox({
    email: {
      id: emailId,
      firmId: auth.firmId,
      templateKey: input.templateKey,
      status: "queued",
      to,
      cc,
      bcc,
      from: input.from ?? DEFAULT_FROM,
      subject: input.subject,
      htmlBody: input.htmlBody ?? "",
      textBody: input.textBody ?? "",
      relatedResourceType: input.relatedResourceType,
      relatedResourceId: input.relatedResourceId,
      queuedAt: now,
      metadata,
    },
    event: {
      id: crypto.randomUUID(),
      firmId: auth.firmId,
      emailId,
      eventType: "queued",
      occurredAt: now,
      metadata: { matterId: input.matterId, provider: enabledProvider.key },
    },
    job: {
      id: jobId,
      firmId: auth.firmId,
      queueName: "email",
      jobName: "send_email",
      status: "queued",
      targetResourceType: "email_outbox",
      targetResourceId: emailId,
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: now,
      metadata: {
        emailId,
        matterId: input.matterId,
        provider: enabledProvider.key,
        templateKey: input.templateKey,
        recipientCount: to.length + cc.length + bcc.length,
        relatedResourceType: input.relatedResourceType,
        relatedResourceId: input.relatedResourceId,
      },
    },
  });

  await appendRouteAuditEvent(repository, auth, {
    action: "email_outbox.queued",
    resourceType: "email_outbox",
    resourceId: queued.email.id,
    occurredAt: now,
    metadata: {
      matterId: input.matterId,
      templateKey: queued.email.templateKey,
      provider: enabledProvider.key,
      recipientCount: to.length + cc.length + bcc.length,
      relatedResourceType: queued.email.relatedResourceType,
      relatedResourceId: queued.email.relatedResourceId,
      jobId: queued.job.id,
    },
  });

  return queued;
}
