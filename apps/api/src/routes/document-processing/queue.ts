import type { FastifyInstance } from "fastify";
import { appendWorkflowAuditEvent } from "../audit-events.js";
import {
  buildIdempotencyKey,
  idempotencyMetadata,
  rethrowIdempotencyConflict,
} from "../idempotency.js";
import { enqueueFailureError, markJobEnqueueFailed } from "../outbound-email.js";
import type { ApiRouteDependencies } from "../types.js";
import { parseRequestPart } from "../../http/validation.js";
import {
  assertDocumentProcessable,
  assertDocumentProcessingAccess,
  assertOcrProviderConfigured,
  idParamsSchema,
  normalizeDocumentOcrLanguage,
  queueDocumentProcessingBodySchema,
  type QueueDocumentOcrInput,
  type QueueDocumentOcrResult,
} from "./shared.js";

export async function queueDocumentOcr(
  input: QueueDocumentOcrInput,
): Promise<QueueDocumentOcrResult> {
  const { repository, ocrJobQueue, auth, document } = input;
  if (!ocrJobQueue) {
    throw Object.assign(new Error("OCR queue is not configured"), { statusCode: 503 });
  }
  if (!input.s3) {
    throw Object.assign(new Error("OCR document storage is not configured"), { statusCode: 503 });
  }
  await assertOcrProviderConfigured({ repository, firmId: auth.firmId });
  assertDocumentProcessable(document);

  const language = normalizeDocumentOcrLanguage(input.language);
  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  const metadata = {
    matterId: document.matterId,
    documentId: document.id,
    task: "ocr",
    language,
    checksumStatus: document.checksumStatus,
    scanStatus: document.scanStatus,
  };
  const idempotencyKey = buildIdempotencyKey({
    scope: "job",
    firmId: auth.firmId,
    matterId: document.matterId,
    resourceType: "document",
    resourceId: document.id,
    action: "document_processing.ocr.queue",
    providerOrTemplate: language,
  });
  const fingerprint = idempotencyMetadata(metadata);
  let job;
  try {
    job = await repository.createJobLifecycleRecord({
      id: jobId,
      firmId: auth.firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "queued",
      targetResourceType: "document",
      targetResourceId: document.id,
      idempotencyKey,
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: now,
      metadata: { ...metadata, ...fingerprint },
    });
  } catch (error) {
    rethrowIdempotencyConflict(error);
  }
  const created = job.id === jobId;
  let updatedJob = job;
  if (created) {
    let bullJobId: string | undefined;
    try {
      bullJobId = (
        await ocrJobQueue.add(
          "extract_document_text",
          {
            firmId: auth.firmId,
            resourceType: "document",
            resourceId: document.id,
            metadata: {
              ...metadata,
              jobId,
              idempotencyKeyPresent: true,
            },
          },
          { jobId },
        )
      ).id?.toString();
    } catch {
      await markJobEnqueueFailed(repository, auth.firmId, job, now);
      throw enqueueFailureError();
    }
    updatedJob = await repository.updateJobLifecycleRecord(auth.firmId, job.id, { bullJobId });
  }

  if (created)
    await appendWorkflowAuditEvent(repository, auth, {
      action: "document_processing.ocr.queued",
      resourceType: "document",
      resourceId: document.id,
      occurredAt: now,
      metadata: {
        matterId: document.matterId,
        beforeStatus: document.scanStatus,
        expectedStatus: "queued",
        afterStatus: updatedJob.status,
        attemptNumber: updatedJob.attemptsMade,
        maxAttempts: updatedJob.maxAttempts,
        idempotencyKeyPresent: true,
      },
      workflow: {
        requestId: input.requestId,
        matterId: document.matterId,
        matterIds: [document.matterId],
        status: "queued",
        idempotencyKeyPresent: true,
      },
    });

  return {
    status: "queued",
    task: "ocr",
    language,
    documentId: document.id,
    job: {
      id: updatedJob.id,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: updatedJob.status,
      bullJobId: updatedJob.bullJobId,
      targetResourceType: "document",
      targetResourceId: document.id,
      queuedAt: updatedJob.queuedAt,
      language,
      idempotencyKeyPresent: Boolean(updatedJob.idempotencyKey),
    },
  };
}

export function registerDocumentProcessingQueueRoutes(
  server: FastifyInstance,
  { repository, ocrJobQueue, s3 }: ApiRouteDependencies,
): void {
  server.post("/api/document-processing/documents/:id/queue", async (request, reply) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const document = await repository.getDocument(request.auth.firmId, params.id);
    if (!document) {
      throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
    }
    assertDocumentProcessingAccess(request.auth, {
      resource: "document",
      action: "update",
      matterId: document.matterId,
    });
    const body = parseRequestPart(queueDocumentProcessingBodySchema, request.body ?? {}, "body");

    return queueDocumentOcr({
      repository,
      ocrJobQueue,
      s3,
      auth: request.auth,
      requestId: request.id,
      document,
      language: body.language,
    }).then((result) => reply.code(202).send(result));
  });
}
