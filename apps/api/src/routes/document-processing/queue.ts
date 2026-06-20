import type { FastifyInstance } from "fastify";
import { localDocumentConversionReviewProvider } from "@open-practice/providers";
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
  buildDocumentConversionReviewSummary,
  conversionReviewArtifactForDocument,
  conversionReviewJobBodySchema,
  documentExtractionTextLength,
  documentConversionReviewJobName,
  documentIdParamsSchema,
  idParamsSchema,
  latestCompletedTextExtraction,
  latestDocumentConversionReviewJob,
  normalizeDocumentOcrLanguage,
  queueDocumentProcessingBodySchema,
  type QueueDocumentOcrInput,
  type QueueDocumentOcrResult,
} from "./shared.js";

async function queueDocumentOcr(input: QueueDocumentOcrInput): Promise<QueueDocumentOcrResult> {
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
  server.post(
    "/api/document-processing/documents/:documentId/conversion-review/jobs",
    async (request, reply) => {
      const params = parseRequestPart(documentIdParamsSchema, request.params, "params");
      const document = await repository.getDocument(request.auth.firmId, params.documentId);
      if (!document) {
        throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
      }
      assertDocumentProcessingAccess(request.auth, {
        resource: "document_processing",
        action: "create",
        matterId: document.matterId,
      });
      const body = parseRequestPart(conversionReviewJobBodySchema, request.body ?? {}, "body");
      assertDocumentProcessable(document);

      const latestExtraction = latestCompletedTextExtraction(
        await repository.getDocumentTextExtractions(request.auth.firmId, document.id),
      );
      if (!latestExtraction) {
        throw Object.assign(new Error("Completed OCR extraction is required"), {
          statusCode: 409,
        });
      }

      const artifacts = await repository.listLegalResearchArtifacts(request.auth.firmId, {
        matterId: document.matterId,
        kind: "document_analysis_status",
      });
      const existingArtifact = conversionReviewArtifactForDocument(document, artifacts);
      const jobs = await repository.listJobLifecycleRecords(request.auth.firmId, {
        queueName: "ocr",
      });
      const latestJob = latestDocumentConversionReviewJob(document, jobs);
      const existingSummary = buildDocumentConversionReviewSummary({
        document,
        latestExtraction,
        latestJob,
        artifact: existingArtifact,
      });
      if (existingSummary.posture === "queued" || existingSummary.posture === "ready_for_review") {
        return reply.code(existingSummary.posture === "queued" ? 202 : 200).send({
          status: existingSummary.posture === "queued" ? "queued" : "completed",
          task: "document_conversion_review",
          documentId: document.id,
          job: latestJob
            ? {
                id: latestJob.id,
                queueName: latestJob.queueName,
                jobName: latestJob.jobName,
                status: latestJob.status,
                targetResourceType: latestJob.targetResourceType,
                targetResourceId: latestJob.targetResourceId,
                queuedAt: latestJob.queuedAt,
                idempotencyKeyPresent: Boolean(latestJob.idempotencyKey),
              }
            : undefined,
          conversionReview: existingSummary,
        });
      }
      if (!ocrJobQueue) {
        throw Object.assign(new Error("Document conversion review queue is not configured"), {
          statusCode: 503,
        });
      }

      const now = new Date().toISOString();
      const jobId = crypto.randomUUID();
      const sourceTextLength = documentExtractionTextLength(latestExtraction);
      const metadata = {
        matterId: document.matterId,
        documentId: document.id,
        task: "document_conversion_review",
        extractionId: latestExtraction.id,
        extractionStatus: latestExtraction.status,
        extractionEngine: latestExtraction.engine,
        provider: localDocumentConversionReviewProvider,
        providerStatus: "metadata_only",
        sourceTextLength,
        summaryPosture: "op_authored_metadata_only",
        checksumStatus: document.checksumStatus,
        scanStatus: document.scanStatus,
        requestedByUserId: request.auth.user.id,
      };
      const idempotencyKey = buildIdempotencyKey({
        scope: "job",
        firmId: request.auth.firmId,
        matterId: document.matterId,
        resourceType: "document",
        resourceId: document.id,
        action: "document_processing.conversion_review.queue",
        providerOrTemplate: latestExtraction.id,
        clientKey: body.idempotencyKey,
      });
      const fingerprint = idempotencyMetadata(metadata);
      let job;
      try {
        job = await repository.createJobLifecycleRecord({
          id: jobId,
          firmId: request.auth.firmId,
          queueName: "ocr",
          jobName: documentConversionReviewJobName,
          status: "queued",
          targetResourceType: "document",
          targetResourceId: document.id,
          idempotencyKey,
          attemptsMade: 0,
          maxAttempts: 2,
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
              documentConversionReviewJobName,
              {
                firmId: request.auth.firmId,
                resourceType: "document",
                resourceId: document.id,
                metadata: {
                  matterId: document.matterId,
                  documentId: document.id,
                  extractionId: latestExtraction.id,
                  jobId,
                  requestedByUserId: request.auth.user.id,
                  provider: localDocumentConversionReviewProvider,
                  providerStatus: "metadata_only",
                  summaryPosture: "op_authored_metadata_only",
                  idempotencyKeyPresent: true,
                },
              },
              { jobId },
            )
          ).id?.toString();
        } catch {
          await markJobEnqueueFailed(repository, request.auth.firmId, job, now);
          throw enqueueFailureError();
        }
        updatedJob = await repository.updateJobLifecycleRecord(request.auth.firmId, job.id, {
          bullJobId,
        });
      }

      if (created) {
        await appendWorkflowAuditEvent(repository, request.auth, {
          action: "document_processing.conversion_review.queued",
          resourceType: "document",
          resourceId: document.id,
          occurredAt: now,
          metadata: {
            matterId: document.matterId,
            documentId: document.id,
            extractionId: latestExtraction.id,
            provider: localDocumentConversionReviewProvider,
            providerStatus: "metadata_only",
            sourceTextLength,
            summaryPosture: "op_authored_metadata_only",
            idempotencyKeyPresent: true,
          },
          workflow: {
            requestId: request.id,
            matterId: document.matterId,
            matterIds: [document.matterId],
            status: "queued",
            idempotencyKeyPresent: true,
          },
        });
      }

      const conversionReview = buildDocumentConversionReviewSummary({
        document,
        latestExtraction,
        latestJob: updatedJob,
      });
      return reply.code(202).send({
        status: "queued",
        task: "document_conversion_review",
        documentId: document.id,
        job: {
          id: updatedJob.id,
          queueName: "ocr",
          jobName: documentConversionReviewJobName,
          status: updatedJob.status,
          bullJobId: updatedJob.bullJobId,
          targetResourceType: "document",
          targetResourceId: document.id,
          queuedAt: updatedJob.queuedAt,
          idempotencyKeyPresent: Boolean(updatedJob.idempotencyKey),
        },
        conversionReview,
      });
    },
  );

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
