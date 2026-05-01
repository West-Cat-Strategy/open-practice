import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest, DocumentRecord, JobLifecycleRecord } from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiJobQueue, ApiRouteDependencies } from "./types.js";

const idParamsSchema = z.object({ id: z.string().min(1) });
const queueDocumentProcessingBodySchema = z.object({
  task: z.enum(["ocr"]).default("ocr"),
  language: z.string().trim().min(2).max(24).default("eng"),
});

export interface QueueDocumentOcrInput {
  repository: OpenPracticeRepository;
  ocrJobQueue?: ApiJobQueue;
  auth: ApiAuthContext;
  document: DocumentRecord;
  language?: string;
}

export interface QueueDocumentOcrResult {
  status: "queued";
  task: "ocr";
  language: string;
  documentId: string;
  job: {
    id: string;
    queueName: "ocr";
    jobName: "extract_document_text";
    status: JobLifecycleRecord["status"];
    bullJobId?: string;
    targetResourceType: "document";
    targetResourceId: string;
    queuedAt: string;
    language: string;
  };
}

function assertDocumentProcessingAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function assertDocumentProcessable(document: DocumentRecord): void {
  if (document.uploadStatus !== "verified") {
    throw Object.assign(new Error("Document is not verified for processing"), { statusCode: 409 });
  }
  if (document.checksumStatus !== "verified" && document.checksumStatus !== "duplicate") {
    throw Object.assign(new Error("Document checksum is not verified for processing"), {
      statusCode: 409,
    });
  }
  if (document.scanStatus === "failed") {
    throw Object.assign(new Error("Document scan failed and cannot be processed"), {
      statusCode: 409,
    });
  }
}

export async function queueDocumentOcr(
  input: QueueDocumentOcrInput,
): Promise<QueueDocumentOcrResult> {
  const { repository, ocrJobQueue, auth, document } = input;
  if (!ocrJobQueue) {
    throw Object.assign(new Error("OCR queue is not configured"), { statusCode: 503 });
  }
  assertDocumentProcessable(document);

  const language = input.language?.trim() || "eng";
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
  const job = await repository.createJobLifecycleRecord({
    id: jobId,
    firmId: auth.firmId,
    queueName: "ocr",
    jobName: "extract_document_text",
    status: "queued",
    targetResourceType: "document",
    targetResourceId: document.id,
    attemptsMade: 0,
    maxAttempts: 3,
    queuedAt: now,
    metadata,
  });
  const bullJob = await ocrJobQueue.add(
    "extract_document_text",
    {
      firmId: auth.firmId,
      resourceType: "document",
      resourceId: document.id,
      metadata: {
        ...metadata,
        jobId,
      },
    },
    { jobId },
  );
  const updatedJob = await repository.updateJobLifecycleRecord(auth.firmId, job.id, {
    bullJobId: bullJob.id === undefined ? undefined : String(bullJob.id),
  });

  await appendRouteAuditEvent(repository, auth, {
    action: "document_processing.ocr.queued",
    resourceType: "document",
    resourceId: document.id,
    occurredAt: now,
    metadata: {
      matterId: document.matterId,
      documentId: document.id,
      jobId: updatedJob.id,
      bullJobId: updatedJob.bullJobId,
      task: "ocr",
      language,
      checksumStatus: document.checksumStatus,
      scanStatus: document.scanStatus,
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
    },
  };
}

export function registerDocumentProcessingRoutes(
  server: FastifyInstance,
  { repository, ocrJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/document-processing/status", async (request) => {
    const providers = await Promise.all([
      repository.listProviderSettings(request.auth.firmId, { kind: "ocr" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "transcription" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "media" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "ai" }),
    ]);
    const configured = providers.flat().filter((provider) => provider.enabled);
    return {
      status: configured.length > 0 ? "configured" : "disabled",
      reason: configured.length > 0 ? undefined : "not_configured",
      workers: ocrJobQueue ? [{ queueName: "ocr", status: "configured" }] : [],
      supportedTasks: ["malware_scan", "ocr", "classification", "transcription", "media"],
      providers: configured.map((provider) => ({ kind: provider.kind, key: provider.key })),
    };
  });

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
      auth: request.auth,
      document,
      language: body.language,
    }).then((result) => reply.code(202).send(result));
  });
}
