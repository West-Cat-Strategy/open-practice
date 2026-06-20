import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import {
  IMAP_INBOUND_PROVIDER_KEY,
  IMAP_POLL_JOB_NAME,
  INBOUND_EMAIL_PARSE_JOB_NAME,
  parseImapProviderConfig,
  requireCompleteImapProviderConfig,
  serializeImapProviderConfig,
} from "@open-practice/domain";
import type { JobLifecycleRecord } from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { ImapMailboxPoller } from "@open-practice/providers/email/imap";
import type {
  WorkerJobEnvelope,
  WorkerJobQueue,
  WorkerJobResult,
  WorkerS3Storage,
} from "./types.js";

const IMAP_RAW_MIME_SOURCE = "imap.mailbox_poll";
const INBOUND_EMAIL_JOB_MAX_ATTEMPTS = 4;
const IMAP_POLL_MAX_MESSAGES = 25;
const INBOUND_EMAIL_PARSER_RECOVERY_METADATA = {
  recoveryPosture: "owner_reviewed_raw_object_replay",
  ownerReviewRequired: true,
  rawObjectRecoverable: true,
  providerPayloadStored: false,
  automaticDocumentPromotion: false,
  automaticMatterCreation: false,
} as const;
const INBOUND_EMAIL_POLL_RECOVERY_METADATA = {
  recoveryPosture: "owner_reviewed_provider_poll",
  ownerReviewRequired: true,
  rawObjectRecoverable: false,
  providerPayloadStored: false,
  automaticDocumentPromotion: false,
  automaticMatterCreation: false,
} as const;
const enqueueFailureMessage = "Job enqueue failed; retry after the worker queue is available.";

function sha256Hex(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function mailboxHash(mailbox: string): string {
  return createHash("sha256")
    .update(`imap-mailbox:${mailbox.trim() || "INBOX"}`)
    .digest("hex");
}

function s3EncryptionOptions(s3: WorkerS3Storage) {
  return s3.serverSideEncryption ? { ServerSideEncryption: s3.serverSideEncryption } : {};
}

function rawStorageKey(input: {
  firmId: string;
  mailbox: string;
  uidValidity: number;
  uid: number;
  rawContentSha256: string;
}): string {
  return [
    "inbound-email",
    input.firmId,
    "raw",
    "provider-polls",
    IMAP_INBOUND_PROVIDER_KEY,
    mailboxHash(input.mailbox),
    String(input.uidValidity),
    `${input.uid}-${input.rawContentSha256}.eml`,
  ].join("/");
}

function parserJobIdempotencyKey(input: { firmId: string; uidValidity: number; uid: number }) {
  return `inbound_email:imap:${input.firmId}:${input.uidValidity}:${input.uid}`;
}

async function createParserJob(input: {
  repository: OpenPracticeRepository;
  firmId: string;
  rawStorageKey: string;
  mailboxHash: string;
  uidValidity: number;
  uid: number;
  rawContentSha256: string;
  rawSizeBytes: number;
}): Promise<{ job: JobLifecycleRecord; created: boolean }> {
  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  const metadata = {
    ...INBOUND_EMAIL_PARSER_RECOVERY_METADATA,
    idempotencyFingerprint: sha256Hex(
      Buffer.from(`${input.uidValidity}:${input.uid}:${input.rawContentSha256}`),
    ),
    provider: IMAP_INBOUND_PROVIDER_KEY,
    source: IMAP_RAW_MIME_SOURCE,
    resourceType: "inbound_email_raw",
    resourceId: `${input.uidValidity}:${input.uid}`,
    idempotencyKeyPresent: true,
    rawStorageKeyPresent: true,
    mailboxHash: input.mailboxHash,
    uidValidity: input.uidValidity,
    uid: input.uid,
    rawContentSha256: input.rawContentSha256,
    rawSizeBytes: input.rawSizeBytes,
  };
  const job = await input.repository.createJobLifecycleRecord({
    id: jobId,
    firmId: input.firmId,
    queueName: "inbound_email",
    jobName: INBOUND_EMAIL_PARSE_JOB_NAME,
    status: "queued",
    targetResourceType: "inbound_email_raw",
    targetResourceId: `${input.uidValidity}:${input.uid}`,
    attemptsMade: 0,
    maxAttempts: INBOUND_EMAIL_JOB_MAX_ATTEMPTS,
    queuedAt: now,
    idempotencyKey: parserJobIdempotencyKey(input),
    metadata,
  });
  return { job, created: job.id === jobId };
}

async function enqueueParserJob(input: {
  repository: OpenPracticeRepository;
  inboundEmailJobQueue: WorkerJobQueue;
  firmId: string;
  job: JobLifecycleRecord;
  rawStorageKey: string;
}): Promise<JobLifecycleRecord> {
  let bullJob: Awaited<ReturnType<WorkerJobQueue["add"]>>;
  try {
    bullJob = await input.inboundEmailJobQueue.add(
      INBOUND_EMAIL_PARSE_JOB_NAME,
      {
        firmId: input.firmId,
        resourceType: input.job.targetResourceType,
        resourceId: input.job.targetResourceId,
        metadata: { ...input.job.metadata, rawStorageKey: input.rawStorageKey },
      },
      { jobId: input.job.id },
    );
  } catch (error) {
    await input.repository.updateJobLifecycleRecord(input.firmId, input.job.id, {
      status: "failed",
      attemptsMade: Math.max(input.job.attemptsMade, 1),
      failedAt: new Date().toISOString(),
      errorMessage: enqueueFailureMessage,
      metadata: {
        ...input.job.metadata,
        ...INBOUND_EMAIL_PARSER_RECOVERY_METADATA,
        providerFailureStage: "imap_parser_enqueue",
        enqueueStatus: "failed",
      },
    });
    throw error;
  }
  return input.repository.updateJobLifecycleRecord(input.firmId, input.job.id, {
    bullJobId: bullJob.id?.toString(),
    metadata: { ...input.job.metadata, bullJobId: bullJob.id?.toString() },
  });
}

async function scheduleNextPoll(input: {
  repository: OpenPracticeRepository;
  inboundEmailJobQueue: WorkerJobQueue;
  firmId: string;
  delayMs: number;
}): Promise<JobLifecycleRecord> {
  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  const metadata = {
    ...INBOUND_EMAIL_POLL_RECOVERY_METADATA,
    provider: IMAP_INBOUND_PROVIDER_KEY,
    source: "worker.inbound_email.imap.self_schedule",
    delayMs: input.delayMs,
  };
  const job = await input.repository.createJobLifecycleRecord({
    id: jobId,
    firmId: input.firmId,
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
  const bullJob = await input.inboundEmailJobQueue.add(
    IMAP_POLL_JOB_NAME,
    {
      firmId: input.firmId,
      resourceType: "provider_setting",
      resourceId: IMAP_INBOUND_PROVIDER_KEY,
      metadata,
    },
    { jobId, delay: input.delayMs },
  );
  return input.repository.updateJobLifecycleRecord(input.firmId, job.id, {
    bullJobId: bullJob.id?.toString(),
    metadata: { ...job.metadata, bullJobId: bullJob.id?.toString() },
  });
}

export async function processInboundEmailPollJob(input: {
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
  s3: WorkerS3Storage;
  inboundEmailJobQueue?: WorkerJobQueue;
  imapMailboxPoller?: ImapMailboxPoller;
}): Promise<WorkerJobResult> {
  const { data, repository, s3 } = input;
  if (!input.inboundEmailJobQueue) {
    throw new Error("Inbound email queue producer is not configured for IMAP polling");
  }

  const provider = (
    await repository.listProviderSettings(data.firmId, { kind: "inbound_email" })
  ).find((candidate) => candidate.key === IMAP_INBOUND_PROVIDER_KEY);
  if (!provider?.enabled) {
    return {
      status: "skipped",
      reason: "IMAP inbound email provider is disabled",
      metadata: {
        ...INBOUND_EMAIL_POLL_RECOVERY_METADATA,
        firmId: data.firmId,
        provider: IMAP_INBOUND_PROVIDER_KEY,
        providerConfigured: false,
      },
    };
  }

  const config = requireCompleteImapProviderConfig(
    parseImapProviderConfig(provider.encryptedConfig),
  );
  const poller = input.imapMailboxPoller ?? new ImapMailboxPoller();
  const poll = await poller.poll({
    config,
    state: config.state,
    maxMessages: IMAP_POLL_MAX_MESSAGES,
  });

  let queuedParserJobCount = 0;
  for (const message of poll.messages) {
    const rawContentSha256 = sha256Hex(message.raw);
    const key = rawStorageKey({
      firmId: data.firmId,
      mailbox: config.mailbox,
      uidValidity: poll.uidValidity,
      uid: message.uid,
      rawContentSha256,
    });
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: message.raw,
        ContentType: "message/rfc822",
        ...s3EncryptionOptions(s3),
      }),
    );
    const { job, created } = await createParserJob({
      repository,
      firmId: data.firmId,
      rawStorageKey: key,
      mailboxHash: mailboxHash(config.mailbox),
      uidValidity: poll.uidValidity,
      uid: message.uid,
      rawContentSha256,
      rawSizeBytes: message.raw.byteLength,
    });
    if (created) {
      await enqueueParserJob({
        repository,
        inboundEmailJobQueue: input.inboundEmailJobQueue,
        firmId: data.firmId,
        job,
        rawStorageKey: key,
      });
      queuedParserJobCount += 1;
    }
  }

  const delayMs = config.pollIntervalSeconds * 1000;
  const nextPollAt = new Date(Date.now() + delayMs).toISOString();
  await repository.upsertProviderSetting({
    ...provider,
    encryptedConfig: serializeImapProviderConfig({
      ...config,
      state: {
        ...config.state,
        ...poll.nextState,
        nextPollAt,
      },
    }),
    updatedAt: new Date().toISOString(),
  });
  const nextPollJob = await scheduleNextPoll({
    repository,
    inboundEmailJobQueue: input.inboundEmailJobQueue,
    firmId: data.firmId,
    delayMs,
  });

  return {
    status: "completed",
    metadata: {
      ...INBOUND_EMAIL_POLL_RECOVERY_METADATA,
      firmId: data.firmId,
      provider: IMAP_INBOUND_PROVIDER_KEY,
      source: IMAP_RAW_MIME_SOURCE,
      messageCount: poll.messages.length,
      queuedParserJobCount,
      uidValidity: poll.uidValidity,
      lastSuccessfullyQueuedUid: poll.nextState.lastSuccessfullyQueuedUid,
      nextPollJobId: nextPollJob.id,
    },
  };
}
