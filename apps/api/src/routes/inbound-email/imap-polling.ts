import {
  IMAP_INBOUND_PROVIDER_KEY,
  IMAP_POLL_JOB_NAME,
  type JobLifecycleRecord,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import type { ApiAuthContext } from "../../server.js";
import { enqueueFailureError, markJobEnqueueFailed } from "../outbound-email.js";
import type { ApiJobQueue } from "../types.js";
import type { InboundEmailRouteDependencies } from "./shared.js";
import { INBOUND_EMAIL_JOB_MAX_ATTEMPTS } from "./shared.js";

export interface EnqueuedImapPollJob {
  status: "queued";
  job: JobLifecycleRecord;
}

export interface SkippedImapPollJob {
  status: "not_queued";
  reason: "inbound_email_queue_not_configured";
}

export type ImapPollEnqueueResult = EnqueuedImapPollJob | SkippedImapPollJob;

export async function enqueueImapMailboxPoll(input: {
  repository: InboundEmailRouteDependencies["repository"];
  inboundEmailJobQueue?: ApiJobQueue;
  auth: ApiAuthContext;
  reason: "settings_updated" | "manual";
  requireQueue?: boolean;
  delayMs?: number;
}): Promise<ImapPollEnqueueResult> {
  if (!input.inboundEmailJobQueue) {
    if (input.requireQueue) {
      throw new ApiHttpError(
        503,
        "INBOUND_EMAIL_QUEUE_NOT_CONFIGURED",
        "Inbound email parser queue is not configured",
      );
    }
    return { status: "not_queued", reason: "inbound_email_queue_not_configured" };
  }

  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  const metadata = {
    provider: IMAP_INBOUND_PROVIDER_KEY,
    source: "api.inbound_email.imap.poll",
    requestedByUserId: input.auth.user.id,
    reason: input.reason,
  };
  const job = await input.repository.createJobLifecycleRecord({
    id: jobId,
    firmId: input.auth.firmId,
    queueName: "inbound_email",
    jobName: IMAP_POLL_JOB_NAME,
    status: "queued",
    targetResourceType: "provider_setting",
    targetResourceId: IMAP_INBOUND_PROVIDER_KEY,
    attemptsMade: 0,
    maxAttempts: INBOUND_EMAIL_JOB_MAX_ATTEMPTS,
    queuedAt: now,
    metadata,
  });

  try {
    const bullJob = await input.inboundEmailJobQueue.add(
      IMAP_POLL_JOB_NAME,
      {
        firmId: input.auth.firmId,
        resourceType: "provider_setting",
        resourceId: IMAP_INBOUND_PROVIDER_KEY,
        metadata,
      },
      { jobId, delay: input.delayMs },
    );
    const updatedJob = await input.repository.updateJobLifecycleRecord(input.auth.firmId, job.id, {
      bullJobId: bullJob.id?.toString(),
      metadata: { ...job.metadata, bullJobId: bullJob.id?.toString() },
    });
    return { status: "queued", job: updatedJob };
  } catch {
    await markJobEnqueueFailed(input.repository, input.auth.firmId, job, now);
    throw enqueueFailureError();
  }
}

export function serializeImapPollEnqueueResult(result: ImapPollEnqueueResult) {
  if (result.status === "not_queued") return result;
  return {
    status: "queued",
    job: {
      id: result.job.id,
      queueName: result.job.queueName,
      jobName: result.job.jobName,
      status: result.job.status,
    },
  };
}
