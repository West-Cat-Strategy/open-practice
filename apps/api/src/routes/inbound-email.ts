import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { FastifyInstance } from "fastify";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  canAccess,
  type AccessRequest,
  type JobLifecycleRecord,
  type InboundEmailMessageRecord,
  type ProviderSettingRecord,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import { assertOcrProviderConfigured, queueDocumentOcr } from "./document-processing.js";
import {
  buildIdempotencyKey,
  idempotencyMetadata,
  rethrowIdempotencyConflict,
} from "./idempotency.js";
import { enqueueFailureError, markJobEnqueueFailed } from "./outbound-email.js";
import type { ApiRouteDependencies } from "./types.js";

const MAILGUN_PROVIDER_KEY = "mailgun";
const MAILGUN_RAW_MIME_JOB_NAME = "parse_inbound_email";
const MAILGUN_RAW_MIME_SOURCE = "mailgun.raw_mime_webhook";
const MAILGUN_SIGNATURE_FRESHNESS_MS = 15 * 60 * 1000;
const MAILGUN_RAW_MIME_BODY_LIMIT_BYTES = 25 * 1024 * 1024;
const INBOUND_EMAIL_JOB_MAX_ATTEMPTS = 4;

const inboundEmailQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

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

const idParamsSchema = z.object({ id: z.string().min(1) });
const followUpSchema = z
  .object({
    channel: z.enum(["email", "phone", "portal", "sms", "in_person"]).optional(),
    consentStatus: z.enum(["unknown", "consented", "declined", "do_not_contact"]).optional(),
    dueAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .refine(
    (followUp) =>
      followUp.channel !== undefined ||
      followUp.consentStatus !== undefined ||
      followUp.dueAt !== undefined,
    { message: "At least one follow-up field is required" },
  );
const staffTriageSchema = z
  .object({
    status: z.enum(["needs_review", "routed", "rejected", "closed"]).optional(),
    assignedToUserId: z.string().min(1).optional(),
    contactIds: z.array(z.string().min(1)).max(20).optional(),
    privateNote: z.string().trim().min(1).max(1000).optional(),
    followUp: followUpSchema.optional(),
  })
  .strict();
const inboundEmailTriageBodySchema = z
  .object({
    status: z.enum(["received", "parsed", "triage_pending", "triaged", "rejected"]).optional(),
    labels: z.array(z.string().trim().min(1).max(64)).max(12).optional(),
    matterId: z.string().min(1).optional(),
    staffTriage: staffTriageSchema.optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.status !== undefined ||
      body.labels !== undefined ||
      body.matterId !== undefined ||
      (body.staffTriage !== undefined &&
        (body.staffTriage.status !== undefined ||
          body.staffTriage.assignedToUserId !== undefined ||
          body.staffTriage.contactIds !== undefined ||
          body.staffTriage.privateNote !== undefined ||
          body.staffTriage.followUp !== undefined)),
    { message: "At least one triage field is required" },
  );
type InboundEmailTriageBody = z.infer<typeof inboundEmailTriageBodySchema>;
type StaffTriageFollowUp = NonNullable<
  NonNullable<InboundEmailTriageBody["staffTriage"]>["followUp"]
>;
type StaffTriagePrivateNote = {
  authorUserId: string;
  createdAt: string;
  text: string;
};
const promoteAttachmentParamsSchema = z.object({
  id: z.string().min(1),
  attachmentId: z.string().min(1),
});
const promoteAttachmentBodySchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  classification: z
    .enum(["general", "privileged", "work_product", "financial", "identity"])
    .default("general"),
  legalHold: z.boolean().default(false),
  queueOcr: z.boolean().default(true),
  language: z.string().trim().min(2).max(24).default("eng"),
});

function assertInboundEmailAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function assertInboundEmailStatusAccess(context: ApiAuthContext): void {
  if (context.user.role === "owner_admin" || context.user.role === "auditor") return;
  const canReadAnyAssignedMatter = context.user.assignedMatterIds.some((matterId) =>
    canAccess({
      user: context.user,
      firmId: context.firmId,
      resource: "inbound_email",
      action: "read",
      matterId,
    }),
  );
  if (canReadAnyAssignedMatter) return;
  assertInboundEmailAccess(context, {
    resource: "inbound_email",
    action: "read",
  });
}

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
  repository: ApiRouteDependencies["repository"];
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

async function resolveSingleConfiguredFirm(repository: ApiRouteDependencies["repository"]) {
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
    MAILGUN_PROVIDER_KEY,
    `${input.tokenHash}-${input.rawContentSha256}.eml`,
  ].join("/");
}

async function createMailgunRawMimeJob(input: {
  repository: ApiRouteDependencies["repository"];
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
    provider: MAILGUN_PROVIDER_KEY,
    source: MAILGUN_RAW_MIME_SOURCE,
    resourceType: "inbound_email_raw",
    resourceId: input.tokenHash,
    idempotencyKeyPresent: true,
    rawStorageKey: input.rawStorageKey,
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

function currentStaffTriage(message: InboundEmailMessageRecord): Record<string, unknown> {
  const triage = message.metadata.staffTriage;
  if (!triage || typeof triage !== "object" || Array.isArray(triage)) return {};
  return triage as Record<string, unknown>;
}

function currentPrivateNotes(triage: Record<string, unknown>): StaffTriagePrivateNote[] {
  return Array.isArray(triage.privateNotes)
    ? triage.privateNotes.filter(
        (note): note is StaffTriagePrivateNote =>
          Boolean(note) &&
          typeof note === "object" &&
          !Array.isArray(note) &&
          typeof (note as Record<string, unknown>).authorUserId === "string" &&
          typeof (note as Record<string, unknown>).createdAt === "string" &&
          typeof (note as Record<string, unknown>).text === "string",
      )
    : [];
}

function safeFollowUp(input: unknown): StaffTriageFollowUp | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const followUp = input as Record<string, unknown>;
  const output: StaffTriageFollowUp = {};
  if (["email", "phone", "portal", "sms", "in_person"].includes(String(followUp.channel))) {
    output.channel = followUp.channel as StaffTriageFollowUp["channel"];
  }
  if (
    ["unknown", "consented", "declined", "do_not_contact"].includes(String(followUp.consentStatus))
  ) {
    output.consentStatus = followUp.consentStatus as StaffTriageFollowUp["consentStatus"];
  }
  if (typeof followUp.dueAt === "string") output.dueAt = followUp.dueAt;
  return Object.values(output).some((value) => value !== undefined) ? output : undefined;
}

function buildStaffTriageMetadata(
  message: InboundEmailMessageRecord,
  input: InboundEmailTriageBody["staffTriage"],
  actorUserId: string,
) {
  if (!input) return undefined;
  const existing = currentStaffTriage(message);
  const now = new Date().toISOString();
  const privateNotes = currentPrivateNotes(existing);
  const nextPrivateNotes = input.privateNote
    ? [
        ...privateNotes,
        {
          authorUserId: actorUserId,
          createdAt: now,
          text: input.privateNote.trim(),
        },
      ].slice(-25)
    : privateNotes;
  const existingFollowUp = safeFollowUp(existing.followUp);
  const followUp = input.followUp
    ? safeFollowUp({ ...(existingFollowUp ?? {}), ...input.followUp })
    : existingFollowUp;
  const triage = {
    status: input.status ?? (typeof existing.status === "string" ? existing.status : undefined),
    assignedToUserId:
      input.assignedToUserId ??
      (typeof existing.assignedToUserId === "string" ? existing.assignedToUserId : undefined),
    contactIds:
      input.contactIds ??
      (Array.isArray(existing.contactIds)
        ? existing.contactIds.filter((id): id is string => typeof id === "string")
        : undefined),
    privateNotes: nextPrivateNotes.length > 0 ? nextPrivateNotes : undefined,
    followUp,
    updatedAt: now,
    updatedByUserId: actorUserId,
  };
  return Object.fromEntries(Object.entries(triage).filter(([, value]) => value !== undefined));
}

function serializeStaffTriageDetail(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  if (typeof input.status === "string") output.status = input.status;
  if (typeof input.assignedToUserId === "string") output.assignedToUserId = input.assignedToUserId;
  if (Array.isArray(input.contactIds)) {
    output.contactIds = input.contactIds.filter((id): id is string => typeof id === "string");
  }
  const privateNotes = currentPrivateNotes(input);
  if (privateNotes.length > 0) {
    output.privateNoteCount = privateNotes.length;
    output.latestPrivateNoteAt = privateNotes.at(-1)?.createdAt;
  }
  const followUp = safeFollowUp(input.followUp);
  if (followUp) output.followUp = followUp;
  if (typeof input.updatedAt === "string") output.updatedAt = input.updatedAt;
  if (typeof input.updatedByUserId === "string") output.updatedByUserId = input.updatedByUserId;
  return Object.keys(output).length > 0 ? output : undefined;
}

function buildInboundEmailTriageUpdates(
  message: InboundEmailMessageRecord,
  body: InboundEmailTriageBody,
  actorUserId: string,
): Partial<Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">> {
  const updates: Partial<
    Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">
  > = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.labels !== undefined) updates.labels = body.labels;
  if (body.matterId !== undefined) updates.matterId = body.matterId;
  const staffTriage = buildStaffTriageMetadata(message, body.staffTriage, actorUserId);
  if (staffTriage) {
    updates.metadata = {
      ...message.metadata,
      staffTriage,
    };
  }
  return updates;
}

export async function buildInboundEmailStatus(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  auth?: ApiAuthContext;
}) {
  const [providers, addresses] = await Promise.all([
    input.repository.listProviderSettings(input.firmId, {
      kind: "inbound_email",
    }),
    input.repository.listInboundEmailAddresses(input.firmId),
  ]);
  const enabled = providers.find((provider) => provider.enabled);
  const auth = input.auth;
  const addressesForUser = auth
    ? addresses.filter((address) => {
        if (auth.user.role === "owner_admin" || auth.user.role === "auditor") {
          return true;
        }
        return Boolean(
          address.matterId &&
          canAccess({
            user: auth.user,
            firmId: auth.firmId,
            resource: "inbound_email",
            action: "read",
            matterId: address.matterId,
          }),
        );
      })
    : addresses;

  return {
    status: enabled ? "configured" : "disabled",
    reason: enabled ? undefined : "not_configured",
    provider:
      !input.auth || input.auth.user.role === "owner_admin" || input.auth.user.role === "auditor"
        ? enabled?.key
        : undefined,
    addresses: addressesForUser.map(({ id, address, matterId, enabled, createdAt }) => ({
      id,
      address,
      matterId,
      enabled,
      createdAt,
    })),
  };
}

export function registerInboundEmailRoutes(
  server: FastifyInstance,
  { repository, ocrJobQueue, inboundEmailJobQueue, s3 }: ApiRouteDependencies,
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

      await s3.client.send(
        new PutObjectCommand({
          Bucket: s3.bucket,
          Key: rawStorageKey,
          Body: rawContent,
          ContentType: "message/rfc822",
          ServerSideEncryption: s3.serverSideEncryption,
        }),
      );

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
          const bullJob = await inboundEmailJobQueue.add(
            MAILGUN_RAW_MIME_JOB_NAME,
            {
              firmId: firm.id,
              resourceType: "inbound_email_raw",
              resourceId: tokenHash,
              metadata: job.metadata,
            },
            { jobId: job.id },
          );
          queuedJob = await repository.updateJobLifecycleRecord(firm.id, job.id, {
            bullJobId: bullJob.id?.toString(),
            metadata: { ...job.metadata, bullJobId: bullJob.id?.toString() },
          });
        } catch {
          await markJobEnqueueFailed(repository, firm.id, job, new Date().toISOString());
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

  server.get("/api/inbound-email/status", async (request) => {
    assertInboundEmailStatusAccess(request.auth);
    return buildInboundEmailStatus({ repository, firmId: request.auth.firmId, auth: request.auth });
  });

  server.get("/api/inbound-email/messages", async (request) => {
    const query = parseRequestPart(inboundEmailQuerySchema, request.query, "query");
    if (query.matterId) {
      assertInboundEmailAccess(request.auth, {
        resource: "inbound_email",
        action: "read",
        matterId: query.matterId,
      });
    } else if (request.auth.user.role !== "owner_admin" && request.auth.user.role !== "auditor") {
      throw Object.assign(new Error("Matter scope required"), { statusCode: 403 });
    }

    const messages = await repository.listInboundEmailMessages(request.auth.firmId, {
      matterId: query.matterId,
    });

    return {
      status: "available",
      messages,
    };
  });

  server.get("/api/inbound-email/messages/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const message = await repository.getInboundEmailMessage(request.auth.firmId, params.id);
    if (!message) {
      throw Object.assign(new Error("Inbound email message was not found"), { statusCode: 404 });
    }

    if (message.matterId) {
      assertInboundEmailAccess(request.auth, {
        resource: "inbound_email",
        action: "read",
        matterId: message.matterId,
      });
    } else if (request.auth.user.role !== "owner_admin" && request.auth.user.role !== "auditor") {
      throw Object.assign(new Error("Matter scope required"), { statusCode: 403 });
    }

    const attachments = await repository.listInboundEmailAttachments(
      request.auth.firmId,
      message.id,
    );

    return {
      status: "available",
      message,
      attachments,
    };
  });

  server.patch("/api/communications/inbox/inbound-email/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(inboundEmailTriageBodySchema, request.body ?? {}, "body");
    const message = await repository.getInboundEmailMessage(request.auth.firmId, params.id);
    if (!message) {
      throw Object.assign(new Error("Inbound email message was not found"), { statusCode: 404 });
    }

    const targetMatterId = body.matterId ?? message.matterId;
    if (message.matterId && body.matterId && body.matterId !== message.matterId) {
      throw Object.assign(new Error("Scoped inbound email cannot be moved to another matter"), {
        statusCode: 403,
      });
    }
    if (message.matterId) {
      assertInboundEmailAccess(request.auth, {
        resource: "inbound_email",
        action: "update",
        matterId: message.matterId,
      });
    } else if (!targetMatterId) {
      assertInboundEmailAccess(request.auth, {
        resource: "inbound_email",
        action: "update",
      });
    }
    if (targetMatterId) {
      assertInboundEmailAccess(request.auth, {
        resource: "inbound_email",
        action: "update",
        matterId: targetMatterId,
      });
    }

    const accessibleMatters = await repository.listMattersForUser(request.auth.user);
    const targetMatter = targetMatterId
      ? accessibleMatters.find((matter) => matter.id === targetMatterId)
      : undefined;
    if (targetMatterId && !targetMatter) {
      throw Object.assign(new Error("Target matter was not found"), { statusCode: 404 });
    }

    const contactIds = body.staffTriage?.contactIds ?? [];
    const requiresTargetMatter = Boolean(
      contactIds.length > 0 ||
      body.staffTriage?.assignedToUserId ||
      body.staffTriage?.privateNote ||
      body.staffTriage?.followUp,
    );
    if (requiresTargetMatter && !targetMatter) {
      throw Object.assign(
        new Error("Staff triage ownership and follow-up require a target matter"),
        {
          statusCode: 400,
        },
      );
    }
    if (contactIds.length > 0) {
      const linkedContactIds = new Set(targetMatter?.parties.map((party) => party.contactId) ?? []);
      const unlinkedContactId = contactIds.find((contactId) => !linkedContactIds.has(contactId));
      if (unlinkedContactId) {
        throw Object.assign(new Error("Triage contact is not linked to the target matter"), {
          statusCode: 403,
        });
      }
    }

    if (body.staffTriage?.assignedToUserId && targetMatter) {
      const assignedUser = await repository.getUser(
        request.auth.firmId,
        body.staffTriage.assignedToUserId,
      );
      if (!assignedUser) {
        throw Object.assign(new Error("Assigned user was not found"), { statusCode: 404 });
      }
      assertInboundEmailAccess(
        { firmId: request.auth.firmId, user: assignedUser },
        { resource: "inbound_email", action: "update", matterId: targetMatterId },
      );
    }

    const updated = await repository.updateInboundEmailMessage(
      request.auth.firmId,
      message.id,
      buildInboundEmailTriageUpdates(message, body, request.auth.user.id),
    );
    const staffTriageDetail = serializeStaffTriageDetail(updated.metadata.staffTriage);
    const followUp =
      staffTriageDetail?.followUp &&
      typeof staffTriageDetail.followUp === "object" &&
      !Array.isArray(staffTriageDetail.followUp)
        ? (staffTriageDetail.followUp as Record<string, unknown>)
        : undefined;

    await appendRouteAuditEvent(repository, request.auth, {
      action: "inbound_email.triage_updated",
      resourceType: "inbound_email",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        previousMatterId: message.matterId,
        status: updated.status,
        labelCount: updated.labels.length,
        staffTriageStatus:
          typeof updated.metadata.staffTriage === "object" &&
          updated.metadata.staffTriage !== null &&
          !Array.isArray(updated.metadata.staffTriage)
            ? (updated.metadata.staffTriage as Record<string, unknown>).status
            : undefined,
        assignedToUserId: body.staffTriage?.assignedToUserId,
        contactIds: body.staffTriage?.contactIds,
        privateNoteAdded: Boolean(body.staffTriage?.privateNote),
        privateNoteCount: staffTriageDetail?.privateNoteCount,
        followUpChannel: followUp?.channel,
        followUpConsentStatus: followUp?.consentStatus,
        followUpDueAt: followUp?.dueAt,
      },
    });

    return {
      status: "updated",
      message: {
        id: updated.id,
        matterId: updated.matterId,
        status: updated.status,
        labels: updated.labels,
        receivedAt: updated.receivedAt,
        staffTriage: staffTriageDetail,
      },
    };
  });

  server.post(
    "/api/inbound-email/messages/:id/attachments/:attachmentId/promote-document",
    async (request) => {
      const params = parseRequestPart(promoteAttachmentParamsSchema, request.params, "params");
      const body = parseRequestPart(promoteAttachmentBodySchema, request.body ?? {}, "body");
      const message = await repository.getInboundEmailMessage(request.auth.firmId, params.id);
      if (!message) {
        throw Object.assign(new Error("Inbound email message was not found"), { statusCode: 404 });
      }
      if (!message.matterId) {
        throw Object.assign(
          new Error("Inbound email message must be matter-scoped before promotion"),
          { statusCode: 409 },
        );
      }

      assertInboundEmailAccess(request.auth, {
        resource: "inbound_email",
        action: "read",
        matterId: message.matterId,
      });
      assertInboundEmailAccess(request.auth, {
        resource: "document",
        action: "create",
        matterId: message.matterId,
      });
      assertInboundEmailAccess(request.auth, {
        resource: "document",
        action: "update",
        matterId: message.matterId,
      });
      const attachments = await repository.listInboundEmailAttachments(
        request.auth.firmId,
        message.id,
      );
      const attachment = attachments.find((candidate) => candidate.id === params.attachmentId);
      if (!attachment) {
        throw Object.assign(new Error("Inbound email attachment was not found"), {
          statusCode: 404,
        });
      }
      if (!attachment.checksumSha256) {
        throw Object.assign(
          new Error("Inbound email attachment checksum is required for document promotion"),
          { statusCode: 409 },
        );
      }
      if (body.queueOcr && !ocrJobQueue) {
        throw Object.assign(new Error("OCR queue is not configured"), { statusCode: 503 });
      }
      if (body.queueOcr && !s3) {
        throw Object.assign(new Error("OCR document storage is not configured"), {
          statusCode: 503,
        });
      }
      if (body.queueOcr) {
        await assertOcrProviderConfigured({ repository, firmId: request.auth.firmId });
      }

      const promoted = await repository.promoteInboundEmailAttachmentToDocument({
        firmId: request.auth.firmId,
        messageId: message.id,
        attachmentId: attachment.id,
        matterId: message.matterId,
        title: body.title ?? attachment.filename,
        classification: body.classification,
        legalHold: body.legalHold,
      });

      await appendRouteAuditEvent(repository, request.auth, {
        action: "inbound_email.attachment.promoted_to_document",
        resourceType: "document",
        resourceId: promoted.document.id,
        metadata: {
          matterId: message.matterId,
          inboundMessageId: message.id,
          attachmentId: promoted.attachment.id,
          documentId: promoted.document.id,
          created: promoted.created,
          promotionStatus: "promoted",
          documentUploadStatus: promoted.document.uploadStatus,
          checksumStatus: promoted.document.checksumStatus,
          scanStatus: promoted.document.scanStatus,
        },
      });

      const queuedOcr = body.queueOcr
        ? await queueDocumentOcr({
            repository,
            ocrJobQueue,
            s3,
            auth: request.auth,
            document: promoted.document,
            language: body.language,
          })
        : undefined;

      return {
        status: "promoted",
        created: promoted.created,
        inboundMessageId: message.id,
        attachment: promoted.attachment,
        document: promoted.document,
        queuedOcr,
      };
    },
  );
}
