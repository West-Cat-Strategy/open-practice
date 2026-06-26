import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { FastifyInstance } from "fastify";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { type JobLifecycleRecord, type ProviderSettingRecord } from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import {
  buildIdempotencyKey,
  idempotencyMetadata,
  rethrowIdempotencyConflict,
} from "../idempotency.js";
import { enqueueFailureError, markJobEnqueueFailed } from "../outbound-email.js";
import {
  INBOUND_EMAIL_JOB_MAX_ATTEMPTS,
  INBOUND_EMAIL_PARSER_RECOVERY_METADATA,
  type InboundEmailRouteDependencies,
  MAILGUN_PROVIDER_KEY,
  MAILGUN_RAW_MIME_JOB_NAME,
  MAILGUN_RAW_MIME_SOURCE,
} from "./shared.js";

const MAILGUN_SIGNATURE_FRESHNESS_MS = 15 * 60 * 1000;
const MAILGUN_RAW_MIME_BODY_LIMIT_BYTES = 25 * 1024 * 1024;

const mailgunRawMimeWebhookSchema = z.object({
  timestamp: z.string().trim().min(1),
  token: z.string().trim().min(1),
  signature: z.string().trim().min(1),
  "body-mime": z.string().min(1),
});

const mailgunProviderConfigSchema = z.object({
  webhookSigningKey: z.string().trim().min(1).optional(),
  domain: z.string().trim().min(1).optional(),
});

type MailgunRawMimeDependencies = Pick<
  InboundEmailRouteDependencies,
  "repository" | "inboundEmailJobQueue" | "s3"
>;

function registerMailgunUrlEncodedParser(server: FastifyInstance): void {
  if (server.hasContentTypeParser("application/x-www-form-urlencoded")) return;
  server.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, payload, done) => {
      const form = new URLSearchParams(typeof payload === "string" ? payload : payload.toString());
      done(null, Object.fromEntries(form.entries()));
    },
  );
}

function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function mailgunWebhookRejected(message: string): ApiHttpError {
  return new ApiHttpError(406, "MAILGUN_WEBHOOK_REJECTED", message);
}

function parseMailgunProviderConfig(provider: ProviderSettingRecord): {
  webhookSigningKey?: string;
  domain?: string;
} {
  const rawConfig = provider.encryptedConfig.trim();
  if (!rawConfig) return {};

  try {
    const parsed = JSON.parse(rawConfig);
    if (typeof parsed === "string") {
      return parsed.trim() ? { webhookSigningKey: parsed.trim() } : {};
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const config = mailgunProviderConfigSchema.parse(parsed);
      return {
        webhookSigningKey: config.webhookSigningKey?.trim(),
        domain: config.domain?.trim(),
      };
    }
  } catch {
    return { webhookSigningKey: rawConfig };
  }

  return {};
}

async function resolveMailgunWebhookConfig(input: {
  repository: InboundEmailRouteDependencies["repository"];
  firmId: string;
}): Promise<{ signingKey: string; domain?: string }> {
  const provider = (
    await input.repository.listProviderSettings(input.firmId, { kind: "inbound_email" })
  ).find((candidate) => candidate.enabled && candidate.key === MAILGUN_PROVIDER_KEY);
  const config = provider ? parseMailgunProviderConfig(provider) : undefined;
  if (!provider || !config?.webhookSigningKey) {
    throw new ApiHttpError(
      503,
      "INBOUND_EMAIL_WEBHOOK_NOT_CONFIGURED",
      "Mailgun inbound email webhook signing is not configured",
    );
  }
  return { signingKey: config.webhookSigningKey, domain: config.domain };
}

function verifyMailgunSignature(input: {
  timestamp: string;
  token: string;
  signature: string;
  signingKey: string;
  nowMs?: number;
}): boolean {
  const timestampSeconds = Number(input.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const timestampMs = timestampSeconds * 1000;
  if (Math.abs((input.nowMs ?? Date.now()) - timestampMs) > MAILGUN_SIGNATURE_FRESHNESS_MS) {
    return false;
  }

  if (!/^[a-f0-9]{64}$/i.test(input.signature)) return false;
  const expected = createHmac("sha256", input.signingKey)
    .update(`${input.timestamp}${input.token}`)
    .digest();
  const provided = Buffer.from(input.signature, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

async function resolveSingleConfiguredFirm(
  repository: InboundEmailRouteDependencies["repository"],
) {
  const resolution = await repository.resolveConfiguredFirm();
  if (resolution.status !== "ready") {
    throw new ApiHttpError(
      503,
      "INBOUND_EMAIL_FIRM_NOT_CONFIGURED",
      "Inbound email webhooks require exactly one configured firm",
    );
  }
  return resolution.firm;
}

function buildMailgunRawStorageKey(input: {
  firmId: string;
  tokenHash: string;
  rawContentSha256: string;
}): string {
  return [
    "inbound-email",
    input.firmId,
    "raw",
    "provider-webhooks",
    MAILGUN_PROVIDER_KEY,
    "raw-mime",
    `${input.tokenHash}-${input.rawContentSha256}.eml`,
  ].join("/");
}

async function createMailgunRawMimeJob(input: {
  repository: InboundEmailRouteDependencies["repository"];
  firmId: string;
  rawStorageKey: string;
  tokenHash: string;
  rawContentSha256: string;
  rawSizeBytes: number;
  domain?: string;
}): Promise<{ job: JobLifecycleRecord; created: boolean }> {
  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  const idempotencyKey = buildIdempotencyKey({
    scope: "inbound_email",
    firmId: input.firmId,
    resourceType: "mailgun_raw_mime",
    resourceId: input.tokenHash,
    action: "provider_webhook",
    providerOrTemplate: MAILGUN_PROVIDER_KEY,
  });
  const metadata = {
    ...idempotencyMetadata({
      provider: MAILGUN_PROVIDER_KEY,
      source: MAILGUN_RAW_MIME_SOURCE,
      tokenHash: input.tokenHash,
      rawContentSha256: input.rawContentSha256,
    }),
    ...INBOUND_EMAIL_PARSER_RECOVERY_METADATA,
    provider: MAILGUN_PROVIDER_KEY,
    source: MAILGUN_RAW_MIME_SOURCE,
    resourceType: "inbound_email_raw",
    resourceId: input.tokenHash,
    idempotencyKeyPresent: true,
    rawStorageKeyPresent: true,
    rawContentSha256: input.rawContentSha256,
    rawSizeBytes: input.rawSizeBytes,
    domain: input.domain,
  };
  try {
    const job = await input.repository.createJobLifecycleRecord({
      id: jobId,
      firmId: input.firmId,
      queueName: "inbound_email",
      jobName: MAILGUN_RAW_MIME_JOB_NAME,
      status: "queued",
      targetResourceType: "inbound_email_raw",
      targetResourceId: input.tokenHash,
      attemptsMade: 0,
      maxAttempts: INBOUND_EMAIL_JOB_MAX_ATTEMPTS,
      queuedAt: now,
      idempotencyKey,
      metadata,
    });
    return { job, created: job.id === jobId };
  } catch (error) {
    rethrowIdempotencyConflict(error);
  }
}

export function registerInboundEmailRawMimeRoutes(
  server: FastifyInstance,
  { repository, inboundEmailJobQueue, s3 }: MailgunRawMimeDependencies,
): void {
  registerMailgunUrlEncodedParser(server);

  server.post(
    "/api/inbound-email/provider-webhooks/mailgun/raw-mime",
    { bodyLimit: MAILGUN_RAW_MIME_BODY_LIMIT_BYTES },
    async (request, reply) => {
      const parsed = mailgunRawMimeWebhookSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        throw mailgunWebhookRejected("Mailgun raw MIME webhook fields are required");
      }

      const bodyMime = parsed.data["body-mime"];
      if (!bodyMime.trim()) {
        throw mailgunWebhookRejected("Mailgun raw MIME body is required");
      }

      const firm = await resolveSingleConfiguredFirm(repository);
      const config = await resolveMailgunWebhookConfig({ repository, firmId: firm.id });
      const signatureValid = verifyMailgunSignature({
        timestamp: parsed.data.timestamp,
        token: parsed.data.token,
        signature: parsed.data.signature,
        signingKey: config.signingKey,
      });
      if (!signatureValid) {
        throw mailgunWebhookRejected("Mailgun webhook signature was not accepted");
      }
      if (!s3) {
        throw new ApiHttpError(
          503,
          "INBOUND_EMAIL_STORAGE_NOT_CONFIGURED",
          "Inbound email raw MIME storage is not configured",
        );
      }
      if (!inboundEmailJobQueue) {
        throw new ApiHttpError(
          503,
          "INBOUND_EMAIL_QUEUE_NOT_CONFIGURED",
          "Inbound email parser queue is not configured",
        );
      }

      const rawContent = Buffer.from(bodyMime, "utf8");
      const tokenHash = sha256Hex(parsed.data.token);
      const rawContentSha256 = sha256Hex(rawContent);
      const rawStorageKey = buildMailgunRawStorageKey({
        firmId: firm.id,
        tokenHash,
        rawContentSha256,
      });

      const { job, created } = await createMailgunRawMimeJob({
        repository,
        firmId: firm.id,
        rawStorageKey,
        tokenHash,
        rawContentSha256,
        rawSizeBytes: rawContent.byteLength,
        domain: config.domain,
      });

      let queuedJob = job;
      if (created) {
        try {
          await s3.client.send(
            new PutObjectCommand({
              Bucket: s3.bucket,
              Key: rawStorageKey,
              Body: rawContent,
              ContentType: "message/rfc822",
              ...(s3.serverSideEncryption ? { ServerSideEncryption: s3.serverSideEncryption } : {}),
            }),
          );
        } catch {
          await repository.updateJobLifecycleRecord(firm.id, job.id, {
            status: "failed",
            attemptsMade: Math.max(job.attemptsMade, 1),
            failedAt: new Date().toISOString(),
            errorMessage:
              "Inbound email raw MIME storage failed; retry after object storage is available.",
            metadata: {
              ...job.metadata,
              ...INBOUND_EMAIL_PARSER_RECOVERY_METADATA,
              providerFailureStage: "raw_mime_storage",
            },
          });
          throw new ApiHttpError(
            503,
            "INBOUND_EMAIL_STORAGE_WRITE_FAILED",
            "Inbound email raw MIME storage did not accept the object.",
          );
        }
        try {
          const bullJob = await inboundEmailJobQueue.add(
            MAILGUN_RAW_MIME_JOB_NAME,
            {
              firmId: firm.id,
              resourceType: "inbound_email_raw",
              resourceId: tokenHash,
              metadata: { ...job.metadata, rawStorageKey },
            },
            { jobId: job.id },
          );
          queuedJob = await repository.updateJobLifecycleRecord(firm.id, job.id, {
            bullJobId: bullJob.id?.toString(),
            metadata: { ...job.metadata, bullJobId: bullJob.id?.toString() },
          });
        } catch {
          await markJobEnqueueFailed(repository, firm.id, job, new Date().toISOString(), {
            ...INBOUND_EMAIL_PARSER_RECOVERY_METADATA,
            providerFailureStage: "parser_enqueue",
          });
          throw enqueueFailureError();
        }
      }

      reply.code(200);
      return {
        status: "accepted",
        provider: MAILGUN_PROVIDER_KEY,
        duplicate: !created,
        job: {
          id: queuedJob.id,
          queueName: queuedJob.queueName,
          jobName: queuedJob.jobName,
          status: queuedJob.status,
          idempotencyKeyPresent: Boolean(queuedJob.idempotencyKey),
        },
      };
    },
  );
}
