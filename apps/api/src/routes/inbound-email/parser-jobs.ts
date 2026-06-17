import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { JobLifecycleRecord } from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import {
  buildIdempotencyKey,
  idempotencyMetadata,
  rethrowIdempotencyConflict,
} from "../idempotency.js";
import { serializeJobRun } from "../job-status.js";
import { enqueueFailureError, markJobEnqueueFailed } from "../outbound-email.js";
import {
  assertJobRecoveryAccess,
  INBOUND_EMAIL_JOB_MAX_ATTEMPTS,
  MAILGUN_PROVIDER_KEY,
  MAILGUN_RAW_MIME_JOB_NAME,
} from "./shared.js";
import type { InboundEmailRouteDependencies } from "./shared.js";

const STALLED_QUEUED_JOB_MS = 60 * 60 * 1000;
const STALLED_ACTIVE_JOB_MS = 30 * 60 * 1000;
const IMAP_PROVIDER_KEY = "imap";

const parserJobParamsSchema = z.object({ jobId: z.string().min(1) });
const parserJobRetryConfirmationSchema = z
  .object({
    confirmed: z.literal(true),
    action: z.literal("retry"),
    jobId: z.string().min(1),
    expectedStatus: z.enum(["failed", "dead_letter"]),
  })
  .strict();
const parserJobDeadLetterConfirmationSchema = z
  .object({
    confirmed: z.literal(true),
    action: z.literal("dead_letter"),
    jobId: z.string().min(1),
    expectedStatus: z.enum(["failed", "queued", "active"]),
  })
  .strict();
const parserJobRetryBodySchema = z
  .object({
    idempotencyKey: z.string().min(8).max(180).optional(),
    confirmation: parserJobRetryConfirmationSchema,
  })
  .strict();
const parserJobDeadLetterBodySchema = z
  .object({
    confirmation: parserJobDeadLetterConfirmationSchema,
  })
  .strict();

function assertFirmScopedRawStorageKey(job: JobLifecycleRecord, rawStorageKey: string): string {
  if (typeof rawStorageKey !== "string" || !rawStorageKey.trim()) {
    throw new ApiHttpError(
      409,
      "INBOUND_EMAIL_RAW_STORAGE_KEY_MISSING",
      "Inbound email parser job recovery requires a private raw object pointer",
    );
  }
  const prefix = `inbound-email/${job.firmId}/raw/`;
  const segments = rawStorageKey.split("/");
  if (
    !rawStorageKey.startsWith(prefix) ||
    rawStorageKey.length <= prefix.length ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new ApiHttpError(
      409,
      "INBOUND_EMAIL_RAW_STORAGE_KEY_INVALID",
      "Inbound email parser job recovery requires a firm-scoped raw object pointer",
    );
  }
  return rawStorageKey;
}

function rawMetadataString(job: JobLifecycleRecord, key: string): string | undefined {
  const value = job.metadata[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function rawMetadataInteger(job: JobLifecycleRecord, key: string): number | undefined {
  const value = job.metadata[key];
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

function missingRawObjectProvenance(): ApiHttpError {
  return new ApiHttpError(
    409,
    "INBOUND_EMAIL_RAW_STORAGE_KEY_MISSING",
    "Inbound email parser job recovery requires bounded raw object provenance",
  );
}

function rawStorageKeyForParser(job: JobLifecycleRecord): string {
  const legacyRawStorageKey = job.metadata.rawStorageKey;
  if (typeof legacyRawStorageKey === "string" && legacyRawStorageKey.trim()) {
    return assertFirmScopedRawStorageKey(job, legacyRawStorageKey);
  }

  const rawContentSha256 = rawMetadataString(job, "rawContentSha256");
  if (!rawContentSha256) throw missingRawObjectProvenance();

  const provider = rawMetadataString(job, "provider");
  const source = rawMetadataString(job, "source");
  if (provider === MAILGUN_PROVIDER_KEY || source === "mailgun.raw_mime_webhook") {
    const tokenHash = rawMetadataString(job, "tokenHash") ?? job.targetResourceId;
    if (!tokenHash) throw missingRawObjectProvenance();
    return assertFirmScopedRawStorageKey(
      job,
      [
        "inbound-email",
        job.firmId,
        "raw",
        "provider-webhooks",
        MAILGUN_PROVIDER_KEY,
        "raw-mime",
        `${tokenHash}-${rawContentSha256}.eml`,
      ].join("/"),
    );
  }

  if (provider === IMAP_PROVIDER_KEY || source === "imap.mailbox_poll") {
    const mailboxHash = rawMetadataString(job, "mailboxHash");
    const uidValidity = rawMetadataInteger(job, "uidValidity");
    const uid = rawMetadataInteger(job, "uid");
    if (!mailboxHash || uidValidity === undefined || uid === undefined) {
      throw missingRawObjectProvenance();
    }
    return assertFirmScopedRawStorageKey(
      job,
      [
        "inbound-email",
        job.firmId,
        "raw",
        "provider-polls",
        IMAP_PROVIDER_KEY,
        mailboxHash,
        String(uidValidity),
        `${uid}-${rawContentSha256}.eml`,
      ].join("/"),
    );
  }

  throw missingRawObjectProvenance();
}

function safeParserJobMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safeKeys = new Set([
    "bullJobId",
    "domain",
    "enqueueStatus",
    "idempotencyFingerprint",
    "idempotencyKeyPresent",
    "mailboxHash",
    "provider",
    "rawContentSha256",
    "rawSizeBytes",
    "rawStorageKeyPresent",
    "resourceId",
    "resourceType",
    "retryOfJobId",
    "source",
    "tokenHash",
    "uid",
    "uidValidity",
  ]);
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) => safeKeys.has(key) && value !== undefined),
  );
}

async function resolveRawStorageKeyForParser(input: {
  repository: InboundEmailRouteDependencies["repository"];
  firmId: string;
  job: JobLifecycleRecord;
  seenJobIds?: Set<string>;
}): Promise<string> {
  try {
    return rawStorageKeyForParser(input.job);
  } catch (error) {
    const retryOfJobId = rawMetadataString(input.job, "retryOfJobId");
    if (!retryOfJobId) throw error;
    const seenJobIds = input.seenJobIds ?? new Set<string>();
    if (seenJobIds.has(input.job.id) || retryOfJobId === input.job.id) throw error;
    seenJobIds.add(input.job.id);
    const sourceJob = (await input.repository.listJobLifecycleRecords(input.firmId)).find(
      (candidate) => candidate.id === retryOfJobId,
    );
    if (!sourceJob || !isInboundParserJob(sourceJob)) throw error;
    return resolveRawStorageKeyForParser({
      repository: input.repository,
      firmId: input.firmId,
      job: sourceJob,
      seenJobIds,
    });
  }
}

function isInboundParserJob(job: JobLifecycleRecord): boolean {
  return (
    job.queueName === "inbound_email" &&
    job.jobName === MAILGUN_RAW_MIME_JOB_NAME &&
    job.targetResourceType === "inbound_email_raw"
  );
}

async function getInboundParserJob(input: {
  repository: InboundEmailRouteDependencies["repository"];
  firmId: string;
  jobId: string;
}): Promise<JobLifecycleRecord> {
  const job = (await input.repository.listJobLifecycleRecords(input.firmId)).find(
    (candidate) => candidate.id === input.jobId,
  );
  if (!job || !isInboundParserJob(job)) {
    throw new ApiHttpError(
      404,
      "INBOUND_EMAIL_PARSER_JOB_NOT_FOUND",
      "Inbound email parser job was not found",
    );
  }
  return job;
}

function assertParserRecoveryConfirmationMatches(
  confirmation: { jobId: string; expectedStatus: JobLifecycleRecord["status"] },
  job: JobLifecycleRecord,
): void {
  if (confirmation.jobId === job.id && confirmation.expectedStatus === job.status) return;
  throw new ApiHttpError(
    409,
    "INBOUND_EMAIL_PARSER_JOB_CONFIRMATION_MISMATCH",
    "Inbound email parser recovery confirmation does not match the current job state",
  );
}

function assertParserJobStalledForDeadLetter(job: JobLifecycleRecord, now: string): void {
  if (job.status === "failed") return;
  const observedAt = job.status === "active" ? (job.startedAt ?? job.queuedAt) : job.queuedAt;
  const elapsedMs = Date.parse(now) - Date.parse(observedAt);
  const threshold = job.status === "active" ? STALLED_ACTIVE_JOB_MS : STALLED_QUEUED_JOB_MS;
  if (Number.isFinite(elapsedMs) && elapsedMs > threshold) return;
  throw new ApiHttpError(
    409,
    "INBOUND_EMAIL_PARSER_JOB_NOT_STALLED",
    "Queued or active inbound email parser jobs must be stalled before manual dead-letter",
  );
}

function parserRecoveryAuditMetadata(input: {
  job: JobLifecycleRecord;
  beforeStatus: JobLifecycleRecord["status"];
  expectedStatus: JobLifecycleRecord["status"];
  afterStatus: JobLifecycleRecord["status"];
  retryJob?: JobLifecycleRecord;
}) {
  return {
    jobId: input.job.id,
    retryJobId: input.retryJob?.id,
    queueName: input.job.queueName,
    jobName: input.job.jobName,
    beforeStatus: input.beforeStatus,
    expectedStatus: input.expectedStatus,
    afterStatus: input.afterStatus,
    provider:
      typeof input.job.metadata.provider === "string" ? input.job.metadata.provider : undefined,
    source: typeof input.job.metadata.source === "string" ? input.job.metadata.source : undefined,
    idempotencyKeyPresent: Boolean(input.job.idempotencyKey),
    retryJobQueued: Boolean(input.retryJob),
  };
}

async function createParserRetryJob(input: {
  repository: InboundEmailRouteDependencies["repository"];
  firmId: string;
  sourceJob: JobLifecycleRecord;
  rawStorageKey: string;
  clientKey?: string;
  now: string;
}): Promise<{ job: JobLifecycleRecord; created: boolean }> {
  const jobId = crypto.randomUUID();
  const idempotencyKey = buildIdempotencyKey({
    scope: "job",
    firmId: input.firmId,
    resourceType: "inbound_email_parser_job",
    resourceId: input.sourceJob.id,
    action: "api.inbound_email.parser_job.retry",
    providerOrTemplate: MAILGUN_RAW_MIME_JOB_NAME,
    clientKey: input.clientKey,
  });
  const metadata = {
    ...safeParserJobMetadata(input.sourceJob.metadata),
    ...idempotencyMetadata({
      provider:
        typeof input.sourceJob.metadata.provider === "string"
          ? input.sourceJob.metadata.provider
          : MAILGUN_PROVIDER_KEY,
      source: "api.inbound_email.parser_job.retry",
      retryOfJobId: input.sourceJob.id,
      previousStatus: input.sourceJob.status,
      resourceType: input.sourceJob.targetResourceType,
      resourceId: input.sourceJob.targetResourceId,
    }),
    provider:
      typeof input.sourceJob.metadata.provider === "string"
        ? input.sourceJob.metadata.provider
        : MAILGUN_PROVIDER_KEY,
    source: "api.inbound_email.parser_job.retry",
    resourceType: input.sourceJob.targetResourceType,
    resourceId: input.sourceJob.targetResourceId,
    retryOfJobId: input.sourceJob.id,
    previousStatus: input.sourceJob.status,
    idempotencyKeyPresent: true,
    rawStorageKeyPresent: true,
  };
  try {
    const job = await input.repository.createJobLifecycleRecord({
      id: jobId,
      firmId: input.firmId,
      queueName: "inbound_email",
      jobName: MAILGUN_RAW_MIME_JOB_NAME,
      status: "queued",
      targetResourceType: "inbound_email_raw",
      targetResourceId: input.sourceJob.targetResourceId,
      attemptsMade: 0,
      maxAttempts: INBOUND_EMAIL_JOB_MAX_ATTEMPTS,
      queuedAt: input.now,
      idempotencyKey,
      metadata,
    });
    return { job, created: job.id === jobId };
  } catch (error) {
    rethrowIdempotencyConflict(error);
  }
}

export function registerInboundEmailParserJobRoutes(
  server: FastifyInstance,
  { repository, inboundEmailJobQueue }: InboundEmailRouteDependencies,
): void {
  server.post("/api/inbound-email/parser-jobs/:jobId/retry", async (request, reply) => {
    assertJobRecoveryAccess(request.auth);
    const params = parseRequestPart(parserJobParamsSchema, request.params, "params");
    const body = parseRequestPart(parserJobRetryBodySchema, request.body, "body");
    const sourceJob = await getInboundParserJob({
      repository,
      firmId: request.auth.firmId,
      jobId: params.jobId,
    });
    assertParserRecoveryConfirmationMatches(body.confirmation, sourceJob);
    if (sourceJob.status !== "failed" && sourceJob.status !== "dead_letter") {
      throw new ApiHttpError(
        409,
        "INBOUND_EMAIL_PARSER_JOB_RETRY_NOT_ALLOWED",
        "Only failed or dead-letter inbound email parser jobs can be manually retried",
      );
    }
    if (!inboundEmailJobQueue) {
      throw new ApiHttpError(
        503,
        "INBOUND_EMAIL_QUEUE_NOT_CONFIGURED",
        "Inbound email parser queue is not configured",
      );
    }

    const rawStorageKey = await resolveRawStorageKeyForParser({
      repository,
      firmId: request.auth.firmId,
      job: sourceJob,
    });
    const now = new Date().toISOString();
    const { job, created } = await createParserRetryJob({
      repository,
      firmId: request.auth.firmId,
      sourceJob,
      rawStorageKey,
      clientKey: body.idempotencyKey,
      now,
    });
    let retryJob = job;
    if (created) {
      try {
        const bullJob = await inboundEmailJobQueue.add(
          MAILGUN_RAW_MIME_JOB_NAME,
          {
            firmId: request.auth.firmId,
            resourceType: "inbound_email_raw",
            resourceId: sourceJob.targetResourceId,
            metadata: { ...job.metadata, rawStorageKey },
          },
          { jobId: job.id },
        );
        retryJob = await repository.updateJobLifecycleRecord(request.auth.firmId, job.id, {
          bullJobId: bullJob.id?.toString(),
          metadata: { ...job.metadata, bullJobId: bullJob.id?.toString() },
        });
      } catch {
        await markJobEnqueueFailed(repository, request.auth.firmId, job, now);
        throw enqueueFailureError();
      }
      await appendRouteAuditEvent(repository, request.auth, {
        action: "inbound_email.parser_job.manual_retry",
        resourceType: "inbound_email",
        resourceId: sourceJob.id,
        occurredAt: now,
        metadata: parserRecoveryAuditMetadata({
          job: sourceJob,
          beforeStatus: sourceJob.status,
          expectedStatus: body.confirmation.expectedStatus,
          afterStatus: retryJob.status,
          retryJob,
        }),
      });
    }

    reply.code(202);
    return {
      status: created ? "queued" : "duplicate",
      job: serializeJobRun(retryJob),
      sourceJob: serializeJobRun(sourceJob),
    };
  });

  server.post("/api/inbound-email/parser-jobs/:jobId/dead-letter", async (request) => {
    assertJobRecoveryAccess(request.auth);
    const params = parseRequestPart(parserJobParamsSchema, request.params, "params");
    const body = parseRequestPart(parserJobDeadLetterBodySchema, request.body, "body");
    const job = await getInboundParserJob({
      repository,
      firmId: request.auth.firmId,
      jobId: params.jobId,
    });
    assertParserRecoveryConfirmationMatches(body.confirmation, job);
    if (!["failed", "queued", "active"].includes(job.status)) {
      throw new ApiHttpError(
        409,
        "INBOUND_EMAIL_PARSER_JOB_DEAD_LETTER_NOT_ALLOWED",
        "Only failed, queued, or active inbound email parser jobs can be manually dead-lettered",
      );
    }
    const now = new Date().toISOString();
    assertParserJobStalledForDeadLetter(job, now);
    const deadLettered = await repository.updateJobLifecycleRecord(request.auth.firmId, job.id, {
      status: "dead_letter",
      failedAt: now,
      errorMessage: "Inbound email parser job manually moved to dead letter by owner review",
      metadata: {
        ...safeParserJobMetadata(job.metadata),
        manualRecoveryAction: "dead_letter",
        previousStatus: job.status,
        recoveredByUserId: request.auth.user.id,
      },
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "inbound_email.parser_job.manual_dead_letter",
      resourceType: "inbound_email",
      resourceId: job.id,
      occurredAt: now,
      metadata: parserRecoveryAuditMetadata({
        job,
        beforeStatus: job.status,
        expectedStatus: body.confirmation.expectedStatus,
        afterStatus: deadLettered.status,
      }),
    });

    return { status: "dead_lettered", job: serializeJobRun(deadLettered) };
  });
}
