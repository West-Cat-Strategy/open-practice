import { createHmac } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import type { ConnectorOutboxRecord } from "@open-practice/domain";
import {
  isDeniedOutboundWebhookAddress,
  outboundWebhookEventAllowlist,
  validateOutboundWebhookDestination,
} from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import type {
  ConnectorDeliveryRequest,
  ConnectorDeliveryResponse,
  ConnectorDnsResolver,
  ConnectorHttpDeliverer,
  ConnectorSecretResolver,
  WorkerJobEnvelope,
  WorkerJobQueue,
  WorkerJobResult,
} from "./types.js";

const CONNECTOR_DELIVERY_JOB_NAME = "deliver_connectors";
const CONNECTOR_JOB_MAX_ATTEMPTS = 3;

const allowedConnectorEvents = new Set<string>(outboundWebhookEventAllowlist);

function errorSummary(message: string): string {
  return message.length > 180 ? `${message.slice(0, 177)}...` : message;
}

function connectorBatchSize(metadata: Record<string, unknown>): number {
  const value = metadata.batchSize;
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, 25)
    : 10;
}

function connectorLeaseMs(metadata: Record<string, unknown>): number {
  const value = metadata.leaseMs;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 5 * 60 * 1000;
}

function connectorRetryAt(attemptNumber: number, now: string): string {
  const delayMs = Math.min(30 * 60 * 1000, 30_000 * 2 ** Math.max(0, attemptNumber - 1));
  return new Date(Date.parse(now) + delayMs).toISOString();
}

function responseClass(status: number): string {
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500 && status < 600) return "5xx";
  return "other";
}

function connectorDestinationUrl(configSummary: Record<string, unknown>): string | undefined {
  const value = configSummary.deliveryUrl;
  return typeof value === "string" && value.trim() ? value : undefined;
}

function connectorSummaryEnvelope(input: {
  outbox: ConnectorOutboxRecord;
  createdAt: string;
}): Record<string, unknown> {
  return {
    deliveryId: input.outbox.id,
    event: input.outbox.eventType,
    createdAt: input.createdAt,
    data: {
      resourceType: input.outbox.resourceType,
      resourceId: input.outbox.resourceId,
      payloadSummary: input.outbox.payloadSummary,
    },
  };
}

function signConnectorBody(input: { body: string; timestamp: string; secret: string }): string {
  return createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.body}`)
    .digest("hex");
}

async function defaultConnectorDeliverer(
  request: ConnectorDeliveryRequest,
): Promise<ConnectorDeliveryResponse> {
  const destination = validateOutboundWebhookDestination(request.url);
  if (!destination.ok) {
    throw new Error(`Connector destination rejected: ${destination.reason}`);
  }
  const url = new URL(destination.normalizedUrl);
  const guardedLookup: LookupFunction = (hostname, options, callback) => {
    dnsLookup(hostname, {
      all: true,
      family: options.family === 4 || options.family === 6 ? options.family : 0,
      verbatim: true,
    }).then(
      (records) => {
        const blocked = records.some((record) => isDeniedOutboundWebhookAddress(record.address));
        const selected = records.find((record) => !isDeniedOutboundWebhookAddress(record.address));
        if (!selected || blocked) {
          const error = new Error(
            "Connector destination failed socket DNS guardrail validation",
          ) as NodeJS.ErrnoException;
          error.code = blocked ? "PRIVATE_NETWORK_DENIED" : "DNS_RESOLUTION_FAILED";
          callback(error, "", 0);
          return;
        }
        callback(null, selected.address, selected.family);
      },
      (error: NodeJS.ErrnoException) => callback(error, "", 0),
    );
  };

  return await new Promise<ConnectorDeliveryResponse>((resolve, reject) => {
    const outgoing = httpsRequest(
      url,
      {
        method: "POST",
        headers: request.headers,
        lookup: guardedLookup,
      },
      (response) => {
        response.on("error", reject);
        response.on("end", () => resolve({ status: response.statusCode ?? 0 }));
        response.resume();
      },
    );
    outgoing.on("error", reject);
    outgoing.setTimeout(15_000, () => {
      outgoing.destroy(new Error("Connector delivery timed out"));
    });
    outgoing.end(request.body);
  });
}

async function defaultConnectorDnsResolver(hostname: string): Promise<string[]> {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

async function validateConnectorDestinationDns(input: {
  host: string;
  resolver: ConnectorDnsResolver;
}): Promise<
  { ok: true } | { ok: false; reason: "dns_resolution_failed" | "private_network_denied" }
> {
  try {
    const addresses = await input.resolver(input.host);
    if (addresses.length === 0) return { ok: false, reason: "dns_resolution_failed" };
    if (addresses.some((address) => isDeniedOutboundWebhookAddress(address))) {
      return { ok: false, reason: "private_network_denied" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "dns_resolution_failed" };
  }
}

export async function processConnectorJob(input: {
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
  connectorSecretResolver?: ConnectorSecretResolver;
  connectorHttpDeliverer?: ConnectorHttpDeliverer;
  connectorDnsResolver?: ConnectorDnsResolver;
  connectorJobQueue?: WorkerJobQueue;
}): Promise<WorkerJobResult> {
  const { data, repository } = input;
  const metadata = data.metadata ?? {};
  const now = new Date().toISOString();
  const leaseId = crypto.randomUUID();
  const leasedUntil = new Date(Date.parse(now) + connectorLeaseMs(metadata)).toISOString();
  const leased = await repository.leaseConnectorOutbox({
    firmId: data.firmId,
    leaseId,
    leasedUntil,
    now,
    limit: connectorBatchSize(metadata),
  });
  const deliveredIds: string[] = [];
  const failedIds: string[] = [];
  const deadLetterIds: string[] = [];
  const retryableFailures: ConnectorOutboxRecord[] = [];

  for (const item of leased) {
    const settled = await deliverConnectorOutbox({
      ...item,
      repository,
      secretResolver: input.connectorSecretResolver,
      dnsResolver: input.connectorDnsResolver ?? defaultConnectorDnsResolver,
      deliverer: input.connectorHttpDeliverer ?? defaultConnectorDeliverer,
    });
    if (settled.status === "delivered") deliveredIds.push(item.outbox.id);
    if (settled.status === "failed") {
      failedIds.push(item.outbox.id);
      retryableFailures.push(settled.outbox);
    }
    if (settled.status === "dead_letter") deadLetterIds.push(item.outbox.id);
  }
  const retryScheduleResults = await scheduleConnectorRetryJobs({
    repository,
    connectorJobQueue: input.connectorJobQueue,
    firmId: data.firmId,
    retryableFailures,
    now: new Date().toISOString(),
  });

  return {
    status: "completed",
    metadata: {
      firmId: data.firmId,
      leasedCount: leased.length,
      deliveredCount: deliveredIds.length,
      failedCount: failedIds.length,
      deadLetterCount: deadLetterIds.length,
      retryScheduledCount: retryScheduleResults.scheduled,
      retryScheduleFailedCount: retryScheduleResults.failed,
      deliveredIds,
      failedIds,
      deadLetterIds,
    },
  };
}

async function deliverConnectorOutbox(input: {
  connector: Awaited<
    ReturnType<OpenPracticeRepository["leaseConnectorOutbox"]>
  >[number]["connector"];
  outbox: Awaited<ReturnType<OpenPracticeRepository["leaseConnectorOutbox"]>>[number]["outbox"];
  attempt: Awaited<ReturnType<OpenPracticeRepository["leaseConnectorOutbox"]>>[number]["attempt"];
  repository: OpenPracticeRepository;
  secretResolver?: ConnectorSecretResolver;
  dnsResolver: ConnectorDnsResolver;
  deliverer: ConnectorHttpDeliverer;
}): Promise<{ status: "delivered" | "failed" | "dead_letter"; outbox: ConnectorOutboxRecord }> {
  const now = new Date().toISOString();
  const destinationUrl = connectorDestinationUrl(input.connector.configSummary);
  const destination = destinationUrl
    ? validateOutboundWebhookDestination(destinationUrl)
    : { ok: false as const, reason: "invalid_url" as const };
  const baseMetadata = {
    eventType: input.outbox.eventType,
    resourceType: input.outbox.resourceType,
    resourceId: input.outbox.resourceId,
    attemptNumber: input.attempt.attemptNumber,
  };

  if (!allowedConnectorEvents.has(input.outbox.eventType)) {
    const result = await input.repository.recordConnectorDeliveryResult({
      firmId: input.outbox.firmId,
      connectorId: input.outbox.connectorId,
      outboxId: input.outbox.id,
      attemptId: input.attempt.id,
      leaseId: input.attempt.leaseId ?? "",
      status: "failed",
      occurredAt: now,
      terminal: true,
      errorSummary: "Connector event type is not allowlisted",
      metadata: { ...baseMetadata, reason: "event_not_allowlisted" },
    });
    return { status: "dead_letter", outbox: result.outbox };
  }

  if (!destination.ok) {
    const result = await input.repository.recordConnectorDeliveryResult({
      firmId: input.outbox.firmId,
      connectorId: input.outbox.connectorId,
      outboxId: input.outbox.id,
      attemptId: input.attempt.id,
      leaseId: input.attempt.leaseId ?? "",
      status: "failed",
      occurredAt: now,
      terminal: true,
      errorSummary: "Connector destination failed HTTPS guardrail validation",
      metadata: { ...baseMetadata, reason: destination.reason },
    });
    return { status: "dead_letter", outbox: result.outbox };
  }

  const dnsValidation = await validateConnectorDestinationDns({
    host: destination.host,
    resolver: input.dnsResolver,
  });
  if (!dnsValidation.ok) {
    const result = await input.repository.recordConnectorDeliveryResult({
      firmId: input.outbox.firmId,
      connectorId: input.outbox.connectorId,
      outboxId: input.outbox.id,
      attemptId: input.attempt.id,
      leaseId: input.attempt.leaseId ?? "",
      status: "failed",
      occurredAt: now,
      terminal: true,
      errorSummary: "Connector destination failed DNS guardrail validation",
      metadata: {
        ...baseMetadata,
        destinationScheme: destination.scheme,
        destinationHost: destination.host,
        destinationPort: destination.port,
        reason: dnsValidation.reason,
      },
    });
    return { status: "dead_letter", outbox: result.outbox };
  }

  const secretReferenceId = input.connector.secretReference?.id;
  const secret = secretReferenceId ? input.secretResolver?.(secretReferenceId) : undefined;
  if (!secret) {
    const result = await input.repository.recordConnectorDeliveryResult({
      firmId: input.outbox.firmId,
      connectorId: input.outbox.connectorId,
      outboxId: input.outbox.id,
      attemptId: input.attempt.id,
      leaseId: input.attempt.leaseId ?? "",
      status: "failed",
      occurredAt: now,
      terminal: true,
      errorSummary: "Connector signing secret is not configured",
      metadata: {
        ...baseMetadata,
        destinationScheme: destination.scheme,
        destinationHost: destination.host,
        destinationPort: destination.port,
        reason: "secret_not_configured",
        secretReferencePresent: Boolean(secretReferenceId),
      },
    });
    return { status: "dead_letter", outbox: result.outbox };
  }

  const envelope = connectorSummaryEnvelope({ outbox: input.outbox, createdAt: now });
  const body = JSON.stringify(envelope);
  const timestamp = now;
  const signature = signConnectorBody({ body, timestamp, secret });
  const deliveryMetadata = {
    ...baseMetadata,
    destinationScheme: destination.scheme,
    destinationHost: destination.host,
    destinationPort: destination.port,
    signingAlgorithm: "hmac-sha256",
  };

  try {
    const response = await input.deliverer({
      url: destination.normalizedUrl,
      body,
      headers: {
        "content-type": "application/json",
        "x-open-practice-delivery-id": input.outbox.id,
        "x-open-practice-event": input.outbox.eventType,
        "x-open-practice-timestamp": timestamp,
        "x-open-practice-signature": signature,
      },
    });
    if (response.status >= 200 && response.status < 300) {
      const result = await input.repository.recordConnectorDeliveryResult({
        firmId: input.outbox.firmId,
        connectorId: input.outbox.connectorId,
        outboxId: input.outbox.id,
        attemptId: input.attempt.id,
        leaseId: input.attempt.leaseId ?? "",
        status: "delivered",
        occurredAt: now,
        metadata: { ...deliveryMetadata, httpStatus: response.status, responseClass: "2xx" },
      });
      return { status: "delivered", outbox: result.outbox };
    }

    const terminal =
      response.status >= 400 && response.status < 500
        ? true
        : input.attempt.attemptNumber >= input.outbox.maxAttempts;
    const result = await input.repository.recordConnectorDeliveryResult({
      firmId: input.outbox.firmId,
      connectorId: input.outbox.connectorId,
      outboxId: input.outbox.id,
      attemptId: input.attempt.id,
      leaseId: input.attempt.leaseId ?? "",
      status: "failed",
      occurredAt: now,
      terminal,
      nextAttemptAt: terminal ? undefined : connectorRetryAt(input.attempt.attemptNumber, now),
      errorSummary: `Connector delivery failed with HTTP ${response.status}`,
      metadata: {
        ...deliveryMetadata,
        httpStatus: response.status,
        responseClass: responseClass(response.status),
      },
    });
    return { status: terminal ? "dead_letter" : "failed", outbox: result.outbox };
  } catch (error) {
    const terminal = input.attempt.attemptNumber >= input.outbox.maxAttempts;
    const result = await input.repository.recordConnectorDeliveryResult({
      firmId: input.outbox.firmId,
      connectorId: input.outbox.connectorId,
      outboxId: input.outbox.id,
      attemptId: input.attempt.id,
      leaseId: input.attempt.leaseId ?? "",
      status: "failed",
      occurredAt: now,
      terminal,
      nextAttemptAt: terminal ? undefined : connectorRetryAt(input.attempt.attemptNumber, now),
      errorSummary: errorSummary(
        error instanceof Error ? error.message : "Connector delivery failed",
      ),
      metadata: { ...deliveryMetadata, reason: "network_or_provider_error" },
    });
    return { status: terminal ? "dead_letter" : "failed", outbox: result.outbox };
  }
}

function connectorRetryDelay(nextAttemptAt: string | undefined, now: string): number | undefined {
  if (!nextAttemptAt) return undefined;
  const delay = Date.parse(nextAttemptAt) - Date.parse(now);
  return Number.isFinite(delay) && delay > 0 ? delay : undefined;
}

async function scheduleConnectorRetryJobs(input: {
  repository: OpenPracticeRepository;
  connectorJobQueue?: WorkerJobQueue;
  firmId: string;
  retryableFailures: ConnectorOutboxRecord[];
  now: string;
}): Promise<{ scheduled: number; failed: number }> {
  if (!input.connectorJobQueue || input.retryableFailures.length === 0) {
    return { scheduled: 0, failed: 0 };
  }

  let scheduled = 0;
  let failed = 0;
  for (const outbox of input.retryableFailures) {
    if (!outbox.nextAttemptAt) continue;
    const jobId = crypto.randomUUID();
    const metadata = {
      resourceType: "connector_outbox",
      resourceId: outbox.id,
      eventCount: 1,
      attemptNumber: outbox.attemptCount,
      maxAttempts: outbox.maxAttempts,
      nextRetryAt: outbox.nextAttemptAt,
      idempotencyKeyPresent: Boolean(outbox.idempotencyKey),
    };
    const job = await input.repository.createJobLifecycleRecord({
      id: jobId,
      firmId: input.firmId,
      queueName: "connectors",
      jobName: CONNECTOR_DELIVERY_JOB_NAME,
      status: "queued",
      targetResourceType: "connector_outbox",
      targetResourceId: outbox.id,
      idempotencyKey: [
        "job",
        input.firmId,
        "connector_outbox",
        outbox.id,
        "connectors.retry",
        outbox.attemptCount,
      ].join(":"),
      attemptsMade: 0,
      maxAttempts: CONNECTOR_JOB_MAX_ATTEMPTS,
      queuedAt: input.now,
      metadata,
    });
    if (job.id !== jobId) continue;
    try {
      const delay = connectorRetryDelay(outbox.nextAttemptAt, input.now);
      const bullJob = await input.connectorJobQueue.add(
        CONNECTOR_DELIVERY_JOB_NAME,
        {
          firmId: input.firmId,
          resourceType: "connector_outbox",
          resourceId: outbox.id,
          metadata,
        },
        delay === undefined ? { jobId } : { jobId, delay },
      );
      await input.repository.updateJobLifecycleRecord(input.firmId, job.id, {
        bullJobId: bullJob.id === undefined ? undefined : String(bullJob.id),
      });
      scheduled += 1;
    } catch (error) {
      failed += 1;
      await input.repository.updateJobLifecycleRecord(input.firmId, job.id, {
        status: "failed",
        attemptsMade: 1,
        failedAt: input.now,
        errorMessage: error instanceof Error ? error.message : "Connector retry enqueue failed",
        metadata: { ...metadata, enqueueStatus: "failed" },
      });
    }
  }
  return { scheduled, failed };
}
