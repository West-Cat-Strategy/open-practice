import { lookup as dnsLookup } from "node:dns/promises";
import type {
  AccessRequest,
  ConnectorOutboxRecord,
  ConnectorRecord,
  ConnectorSecretReference,
  JobLifecycleRecord,
} from "@open-practice/domain";
import {
  isDeniedOutboundWebhookAddress,
  outboundWebhookEventAllowlist,
  validateOutboundWebhookDestination,
} from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import type { ApiAuthContext } from "../../server.js";
import { buildIdempotencyKey, idempotencyMetadata } from "../idempotency.js";
import { enqueueFailureError, markJobEnqueueFailed } from "../outbound-email.js";
import type { ApiRouteDependencies, ConnectorDnsResolver } from "../types.js";

const CONNECTOR_DELIVERY_JOB_NAME = "deliver_connectors";
const CONNECTOR_JOB_MAX_ATTEMPTS = 3;
export const maskedSecretReferenceId = "__open_practice_connector_secret_unchanged__";

const sensitiveKeyPattern =
  /(api[_-]?key|authorization|bearer|credential|password|private[_-]?key|secret|token)/i;
const sensitiveValuePattern =
  /(bearer\s+[a-z0-9._~+/=-]+|secret:\/\/|token=|api[_-]?key|credential|password|private[_-]?key|storage[_-]?key|matters\/|generated\/)/i;

const allowedConnectorEvents = new Set<string>(outboundWebhookEventAllowlist);
const allowedPayloadSummaryKeys = new Set([
  "actionCount",
  "attemptCount",
  "checksumStatus",
  "completedAt",
  "documentId",
  "emailId",
  "eventCount",
  "fieldCount",
  "invoiceId",
  "itemCount",
  "linkId",
  "matterId",
  "recipientCount",
  "resourceId",
  "resourceType",
  "signatureRequestId",
  "status",
  "templateId",
]);

export function assertConnectorAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function containsSensitiveConfigKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSensitiveConfigKey);
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) => sensitiveKeyPattern.test(key) || containsSensitiveConfigKey(child),
  );
}

function containsSensitiveSummaryValue(value: unknown): boolean {
  if (typeof value === "string") return sensitiveValuePattern.test(value);
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSensitiveSummaryValue);
  return Object.values(value as Record<string, unknown>).some(containsSensitiveSummaryValue);
}

export function assertRedactedSummary(summary: Record<string, unknown>, field: string): void {
  if (!containsSensitiveConfigKey(summary) && !containsSensitiveSummaryValue(summary)) return;
  throw new ApiHttpError(
    400,
    "CONNECTOR_SECRET_SUMMARY_REJECTED",
    `${field} must contain redacted operational metadata only`,
  );
}

export function assertAllowlistedConnectorEvent(eventType: string): void {
  if (allowedConnectorEvents.has(eventType)) return;
  throw new ApiHttpError(
    400,
    "CONNECTOR_EVENT_NOT_ALLOWLISTED",
    "Connector outbox event type is not allowlisted for delivery",
  );
}

function safePayloadSummaryValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string") return value.length <= 160 ? value : undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return undefined;
}

export function normalizePayloadSummary(summary: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  const rejectedKeys: string[] = [];
  for (const [key, value] of Object.entries(summary)) {
    if (!allowedPayloadSummaryKeys.has(key)) {
      rejectedKeys.push(key);
      continue;
    }
    const safeValue = safePayloadSummaryValue(value);
    if (safeValue === undefined) {
      rejectedKeys.push(key);
      continue;
    }
    normalized[key] = safeValue;
  }
  if (rejectedKeys.length > 0) {
    throw new ApiHttpError(
      400,
      "CONNECTOR_PAYLOAD_SUMMARY_REJECTED",
      `payloadSummary contains unsupported delivery fields: ${rejectedKeys.sort().join(", ")}`,
    );
  }
  return normalized;
}

export function serializeOutbox(outbox: ConnectorOutboxRecord) {
  return {
    id: outbox.id,
    connectorId: outbox.connectorId,
    eventType: outbox.eventType,
    resourceType: outbox.resourceType,
    resourceId: outbox.resourceId,
    idempotencyKeyPresent: Boolean(outbox.idempotencyKey),
    status: outbox.status,
    payloadSummary: outbox.payloadSummary,
    attemptCount: outbox.attemptCount,
    maxAttempts: outbox.maxAttempts,
    nextAttemptAt: outbox.nextAttemptAt,
    leasePresent: Boolean(outbox.leaseId),
    leasedUntil: outbox.leasedUntil,
    deliveredAt: outbox.deliveredAt,
    deadLetteredAt: outbox.deadLetteredAt,
    lastErrorSummary: outbox.lastErrorSummary,
    createdAt: outbox.createdAt,
    updatedAt: outbox.updatedAt,
  };
}

export function serializeSecretReference(reference: ConnectorSecretReference | undefined) {
  if (!reference) return undefined;
  return {
    id: maskedSecretReferenceId,
    label: reference.label,
    version: reference.version,
    lastRotatedAt: reference.lastRotatedAt,
    redacted: true,
  };
}

export async function defaultConnectorDnsResolver(hostname: string): Promise<string[]> {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export async function assertConnectorDestinationDns(
  destination: Extract<ReturnType<typeof validateOutboundWebhookDestination>, { ok: true }>,
  field: string,
  resolver: ConnectorDnsResolver,
): Promise<void> {
  let addresses: string[];
  try {
    addresses = await resolver(destination.host);
  } catch {
    throw new ApiHttpError(
      400,
      "CONNECTOR_DELIVERY_URL_REJECTED",
      `${field} failed outbound webhook DNS guardrail validation`,
      { reason: "dns_resolution_failed" },
    );
  }
  if (
    addresses.length === 0 ||
    addresses.some((address) => isDeniedOutboundWebhookAddress(address))
  ) {
    throw new ApiHttpError(
      400,
      "CONNECTOR_DELIVERY_URL_REJECTED",
      `${field} failed outbound webhook DNS guardrail validation`,
      {
        reason: addresses.length === 0 ? "dns_resolution_failed" : "private_network_denied",
      },
    );
  }
}

export async function assertConnectorDeliveryUrl(
  summary: Record<string, unknown>,
  field: string,
  resolver: ConnectorDnsResolver,
): Promise<void> {
  const value = summary.deliveryUrl;
  if (typeof value !== "string" || !value.trim()) return;
  const validation = validateOutboundWebhookDestination(value);
  if (validation.ok) {
    await assertConnectorDestinationDns(validation, `${field}.deliveryUrl`, resolver);
    return;
  }
  throw new ApiHttpError(
    400,
    "CONNECTOR_DELIVERY_URL_REJECTED",
    `${field}.deliveryUrl failed outbound webhook guardrail validation`,
    { reason: validation.reason },
  );
}

export function isConnectorOutboxLeaseActive(outbox: ConnectorOutboxRecord, now: string): boolean {
  return (
    outbox.status === "leased" &&
    outbox.leasedUntil !== undefined &&
    Date.parse(outbox.leasedUntil) > Date.parse(now)
  );
}

export function assertRecoveryConfirmationMatches(
  confirmation: {
    outboxId: string;
    expectedStatus: ConnectorOutboxRecord["status"];
  },
  outbox: ConnectorOutboxRecord,
): void {
  if (confirmation.outboxId === outbox.id && confirmation.expectedStatus === outbox.status) return;
  throw new ApiHttpError(
    409,
    "CONNECTOR_RECOVERY_CONFIRMATION_MISMATCH",
    "Connector outbox recovery confirmation does not match the current row state",
  );
}

export function connectorOutboxAuditMetadata(input: {
  connector: ConnectorRecord;
  outbox: ConnectorOutboxRecord;
  beforeStatus: ConnectorOutboxRecord["status"];
  expectedStatus: ConnectorOutboxRecord["status"];
  afterStatus: ConnectorOutboxRecord["status"];
  deliveryJob?: JobLifecycleRecord;
}) {
  return {
    connectorId: input.connector.id,
    connectorType: input.connector.type,
    connectorKey: input.connector.key,
    outboxId: input.outbox.id,
    eventType: input.outbox.eventType,
    resourceType: input.outbox.resourceType,
    resourceId: input.outbox.resourceId,
    beforeStatus: input.beforeStatus,
    expectedStatus: input.expectedStatus,
    afterStatus: input.afterStatus,
    attemptCount: input.outbox.attemptCount,
    maxAttempts: input.outbox.maxAttempts,
    idempotencyKeyPresent: Boolean(input.outbox.idempotencyKey),
    deliveryJobQueued: Boolean(input.deliveryJob),
    queueName: input.deliveryJob?.queueName,
  };
}

function jobDelayUntil(nextAttemptAt: string | undefined, now: string): number | undefined {
  if (!nextAttemptAt) return undefined;
  const delay = Date.parse(nextAttemptAt) - Date.parse(now);
  return Number.isFinite(delay) && delay > 0 ? delay : undefined;
}

function connectorDeliveryJobMetadata(
  outbox: ConnectorOutboxRecord,
  now: string,
  recoveryMetadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const delay = jobDelayUntil(outbox.nextAttemptAt, now);
  return {
    resourceType: "connector_outbox",
    resourceId: outbox.id,
    eventCount: 1,
    maxAttempts: outbox.maxAttempts,
    idempotencyKeyPresent: Boolean(outbox.idempotencyKey),
    ...recoveryMetadata,
    ...(delay ? { nextRetryAt: outbox.nextAttemptAt } : {}),
    ...idempotencyMetadata({
      outboxId: outbox.id,
      connectorId: outbox.connectorId,
      eventType: outbox.eventType,
      resourceType: outbox.resourceType,
      resourceId: outbox.resourceId,
      nextAttemptAt: outbox.nextAttemptAt,
      attemptCount: outbox.attemptCount,
      maxAttempts: outbox.maxAttempts,
      ...recoveryMetadata,
    }),
  };
}

export function summarizeConnectorDeliveryJob(job: JobLifecycleRecord | undefined) {
  if (!job) return undefined;
  return {
    id: job.id,
    queueName: job.queueName,
    jobName: job.jobName,
    status: job.status,
    bullJobId: job.bullJobId,
    targetResourceType: job.targetResourceType,
    targetResourceId: job.targetResourceId,
    queuedAt: job.queuedAt,
    idempotencyKeyPresent: Boolean(job.idempotencyKey),
  };
}

export async function scheduleConnectorDeliveryJob(
  { repository, connectorJobQueue }: ApiRouteDependencies,
  auth: ApiAuthContext,
  outbox: ConnectorOutboxRecord,
  now: string,
  options: {
    action?: string;
    clientKey?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<JobLifecycleRecord | undefined> {
  if (!connectorJobQueue) return undefined;

  const jobId = crypto.randomUUID();
  const metadata = connectorDeliveryJobMetadata(outbox, now, options.metadata);
  const idempotencyKey = buildIdempotencyKey({
    scope: "job",
    firmId: auth.firmId,
    resourceType: "connector_outbox",
    resourceId: outbox.id,
    action: options.action ?? "connectors.deliver",
    providerOrTemplate: CONNECTOR_DELIVERY_JOB_NAME,
    clientKey: options.clientKey,
  });
  const job = await repository.createJobLifecycleRecord({
    id: jobId,
    firmId: auth.firmId,
    queueName: "connectors",
    jobName: CONNECTOR_DELIVERY_JOB_NAME,
    status: "queued",
    targetResourceType: "connector_outbox",
    targetResourceId: outbox.id,
    idempotencyKey,
    attemptsMade: 0,
    maxAttempts: CONNECTOR_JOB_MAX_ATTEMPTS,
    queuedAt: now,
    metadata,
  });
  if (job.id !== jobId) return job;

  let bullJobId: string | undefined;
  try {
    const delay = jobDelayUntil(outbox.nextAttemptAt, now);
    const bullJob = await connectorJobQueue.add(
      CONNECTOR_DELIVERY_JOB_NAME,
      {
        firmId: auth.firmId,
        resourceType: "connector_outbox",
        resourceId: outbox.id,
        metadata: {
          resourceType: "connector_outbox",
          resourceId: outbox.id,
          eventCount: 1,
          maxAttempts: outbox.maxAttempts,
          idempotencyKeyPresent: Boolean(outbox.idempotencyKey),
          ...options.metadata,
        },
      },
      delay === undefined ? { jobId } : { jobId, delay },
    );
    bullJobId = bullJob.id === undefined ? undefined : String(bullJob.id);
  } catch {
    await markJobEnqueueFailed(repository, auth.firmId, job, now);
    throw enqueueFailureError();
  }

  return repository.updateJobLifecycleRecord(auth.firmId, job.id, { bullJobId });
}
