import type { FastifyInstance } from "fastify";
import {
  buildDocumentRetentionHoldReview,
  buildDocumentMetadataSearchPosture,
  buildDocumentMetadataTags,
  buildDocumentReviewSuggestions,
} from "@open-practice/domain";
import { parseRequestPart } from "../../http/validation.js";
import {
  actionableDocumentProcessingTasks,
  documentProcessingProviderKinds,
  documentProcessingQueueNames,
  providerStatus,
  queueStatus,
  reservedDocumentProcessingTasks,
  serializeJobRun,
  summarizeJobRuns,
} from "../job-status.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  assertDocumentProcessingAccess,
  buildDocumentProcessingEvidencePacket,
  buildDocumentProcessingProviderReadiness,
  buildDocumentConversionReviewSummary,
  conversionReviewArtifactForDocument,
  documentReviewQueueSummary,
  documentWorkbenchGroup,
  latestCompletedTextExtraction,
  latestDocumentConversionReviewJob,
  latestDocumentJob,
  latestTextExtraction,
  queueEligibility,
  sanitizeDocument,
  sanitizeTextExtraction,
  workbenchQuerySchema,
} from "./shared.js";

export function registerDocumentProcessingWorkbenchRoutes(
  server: FastifyInstance,
  { repository, ocrJobQueue, s3 }: ApiRouteDependencies,
): void {
  server.get("/api/document-processing/workbench", async (request) => {
    const query = parseRequestPart(workbenchQuerySchema, request.query, "query");
    assertDocumentProcessingAccess(request.auth, {
      resource: "document_processing",
      action: "read",
      matterId: query.matterId,
    });

    const providers = await Promise.all([
      repository.listProviderSettings(request.auth.firmId, { kind: "ocr" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "transcription" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "media" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "ai" }),
    ]);
    const providerStates = documentProcessingProviderKinds.map((kind, index) =>
      providerStatus(kind, providers[index] ?? []),
    );
    const ocrProviderState =
      providerStates.find((providerState) => providerState.kind === "ocr") ??
      providerStatus("ocr", []);
    const workerQueues = documentProcessingQueueNames.map((queueName) =>
      queueStatus(queueName, queueName === "ocr" ? ocrJobQueue : undefined),
    );
    const reservedQueues = workerQueues.filter((queue) => queue.status === "reserved");
    const ocrQueueConfigured = workerQueues.some(
      (queue) => queue.queueName === "ocr" && queue.status === "configured",
    );
    const documents = await repository.listMatterDocuments(request.auth.firmId, query.matterId);
    const conversionReviewArtifacts = await repository.listLegalResearchArtifacts(
      request.auth.firmId,
      {
        matterId: query.matterId,
        kind: "document_analysis_status",
      },
    );
    const documentIds = new Set(documents.map((document) => document.id));
    const jobs = (await repository.listJobLifecycleRecords(request.auth.firmId)).filter(
      (job) =>
        documentProcessingQueueNames.some((queueName) => queueName === job.queueName) &&
        ((typeof job.metadata.matterId === "string" && job.metadata.matterId === query.matterId) ||
          (typeof job.targetResourceId === "string" && documentIds.has(job.targetResourceId)) ||
          (typeof job.metadata.documentId === "string" &&
            documentIds.has(job.metadata.documentId))),
    );
    const matter = (await repository.listMattersForUser(request.auth.user)).find(
      (candidate) => candidate.id === query.matterId,
    );

    const documentEntries = await Promise.all(
      documents.map(async (document) => {
        const latestJob = latestDocumentJob(document, jobs, ["extract_document_text"]);
        const latestConversionJob = latestDocumentConversionReviewJob(document, jobs);
        const eligibility = queueEligibility({
          document,
          latestJob,
          ocrQueueConfigured,
          ocrStorageConfigured: Boolean(s3),
          ocrProviderStatus: ocrProviderState,
        });
        const textExtractions = await repository.getDocumentTextExtractions(
          request.auth.firmId,
          document.id,
        );
        const latestExtraction = latestTextExtraction(textExtractions);
        const latestCompletedExtraction = latestCompletedTextExtraction(textExtractions);
        const conversionReview = buildDocumentConversionReviewSummary({
          document,
          latestExtraction: latestCompletedExtraction,
          latestJob: latestConversionJob,
          artifact: conversionReviewArtifactForDocument(document, conversionReviewArtifacts),
        });
        const reviewSuggestions = buildDocumentReviewSuggestions({
          document,
          sameMatterDocuments: documents,
          latestExtraction,
          matter,
        });
        const retentionHoldReview = buildDocumentRetentionHoldReview({
          document,
          reviewSuggestions,
        });
        const sanitizedDocument = sanitizeDocument(document);
        const metadataTags = buildDocumentMetadataTags({
          document: sanitizedDocument,
          latestExtraction,
          latestJobStatus: latestJob?.status,
          reviewSuggestions,
        });
        return {
          item: {
            document: sanitizedDocument,
            group: documentWorkbenchGroup({ document, latestJob, eligibility }),
            queueEligibility: eligibility,
            latestJob: latestJob ? serializeJobRun(latestJob) : undefined,
            latestExtraction: sanitizeTextExtraction(latestExtraction),
            reviewSuggestions,
            retentionHoldReview,
            metadataTags,
            conversionReview,
          },
          searchEntry: {
            document: sanitizedDocument,
            latestExtraction,
            latestJobStatus: latestJob?.status,
            reviewSuggestions,
            metadataTags,
          },
        };
      }),
    );
    const documentItems = documentEntries.map((entry) => entry.item);
    const ocrReady = ocrProviderState.status === "configured" && Boolean(s3);
    const status = ocrReady ? "configured" : "disabled";
    const reason =
      ocrProviderState.status === "configured" && s3
        ? undefined
        : ocrProviderState.reason === "provider_disabled"
          ? "provider_disabled"
          : ocrProviderState.status === "configured" && !s3
            ? "storage_not_configured"
            : "not_configured";
    const providerReadiness = buildDocumentProcessingProviderReadiness({
      providerStates,
      workerQueues,
      jobs,
      storageConfigured: Boolean(s3),
    });

    return {
      matterId: query.matterId,
      status,
      reason,
      providerStatus: providerStates,
      providerReadiness,
      evidencePacket: buildDocumentProcessingEvidencePacket({
        status,
        reason,
        readiness: providerReadiness,
        jobs,
      }),
      workerQueues,
      reservedQueues,
      actionableTasks: actionableDocumentProcessingTasks,
      reservedTasks: reservedDocumentProcessingTasks,
      reviewQueue: documentReviewQueueSummary(documents),
      metadataSearch: buildDocumentMetadataSearchPosture({
        entries: documentEntries.map((entry) => entry.searchEntry),
        filters: {
          q: query.q,
          classification: query.classification,
          reviewStatus: query.reviewStatus,
          scanStatus: query.scanStatus,
          ocrStatus: query.ocrStatus,
          cueGroup: query.cueGroup,
          tag: query.tag,
        },
      }),
      summary: summarizeJobRuns(jobs),
      documents: documentItems,
    };
  });
}
