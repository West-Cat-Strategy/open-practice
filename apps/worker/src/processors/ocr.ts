import { GetObjectCommand } from "@aws-sdk/client-s3";
import type {
  DocumentTextExtractionRecord,
  LegalResearchArtifactRecord,
  OcrProvider,
} from "@open-practice/domain";
import { isAllowedOcrLanguage } from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { LocalDocumentConversionReviewProvider } from "@open-practice/providers";
import type { WorkerJobEnvelope, WorkerJobResult, WorkerS3Storage } from "./types.js";

export const documentConversionReviewJobName = "document_conversion_review" as const;
const documentConversionReviewSummaryPosture = "op_authored_metadata_only";

function documentScanSafeForOcr(scanStatus: string): boolean {
  return scanStatus === "passed" || scanStatus === "not_required";
}

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function metadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function latestCompletedExtraction(input: {
  records: DocumentTextExtractionRecord[];
  extractionId?: string;
}): DocumentTextExtractionRecord | undefined {
  const completed = input.records.filter((record) => record.status === "completed");
  const matched = input.extractionId
    ? completed.find((record) => record.id === input.extractionId)
    : undefined;
  if (matched) return matched;
  return completed
    .sort((left, right) =>
      (right.completedAt ?? right.createdAt).localeCompare(left.completedAt ?? left.createdAt),
    )
    .at(0);
}

function findDocumentAnalysisArtifact(
  artifacts: LegalResearchArtifactRecord[],
  documentId: string,
): LegalResearchArtifactRecord | undefined {
  return artifacts
    .filter((artifact) => artifact.documentAnalysis?.documentId === documentId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .at(0);
}

export async function processDocumentConversionReviewJob(input: {
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
}): Promise<WorkerJobResult> {
  const { data, repository } = input;
  const documentId = data.resourceId ?? metadataString(data.metadata, "documentId");
  const firmId = data.firmId;

  if (!documentId) throw new Error("Missing documentId in conversion review job data");
  const document = await repository.getDocument(firmId, documentId);
  if (!document) {
    return {
      status: "skipped",
      reason: "Document not found",
      metadata: {
        firmId,
        documentId,
        conversionReviewPosture: "blocked",
        summaryPosture: documentConversionReviewSummaryPosture,
      },
    };
  }
  if (
    document.uploadStatus !== "verified" ||
    (document.checksumStatus !== "verified" && document.checksumStatus !== "duplicate") ||
    !documentScanSafeForOcr(document.scanStatus)
  ) {
    return {
      status: "skipped",
      reason: "Document is not safe for conversion review",
      metadata: {
        firmId,
        documentId,
        matterId: document.matterId,
        checksumStatus: document.checksumStatus,
        scanStatus: document.scanStatus,
        conversionReviewPosture: "blocked",
        summaryPosture: documentConversionReviewSummaryPosture,
      },
    };
  }

  const extraction = latestCompletedExtraction({
    records: await repository.getDocumentTextExtractions(firmId, documentId),
    extractionId: metadataString(data.metadata, "extractionId"),
  });
  if (!extraction) {
    return {
      status: "skipped",
      reason: "Completed OCR extraction is required",
      metadata: {
        firmId,
        documentId,
        matterId: document.matterId,
        extractionStatus: "not_available",
        conversionReviewPosture: "blocked",
        summaryPosture: documentConversionReviewSummaryPosture,
      },
    };
  }

  const conversionProvider = new LocalDocumentConversionReviewProvider();
  const providerMetadata = conversionProvider.createMetadata({
    sourceText: extraction.extractedText,
    sourceTextLength:
      metadataNumber(extraction.metadata, "textLength") ??
      metadataNumber(extraction.metadata, "sourceTextLength"),
  });
  const counts = providerMetadata.counts;
  const now = new Date().toISOString();
  const artifacts = await repository.listLegalResearchArtifacts(firmId, {
    matterId: document.matterId,
    kind: "document_analysis_status",
  });
  const existing = findDocumentAnalysisArtifact(artifacts, documentId);
  const jobId = metadataString(data.metadata, "jobId");
  const requestedByUserId = metadataString(data.metadata, "requestedByUserId");
  const createdByUserId = existing?.createdByUserId ?? requestedByUserId;
  if (!createdByUserId) {
    return {
      status: "skipped",
      reason: "Conversion review requester is missing",
      metadata: {
        firmId,
        documentId,
        matterId: document.matterId,
        extractionId: extraction.id,
        conversionReviewPosture: "blocked",
        summaryPosture: documentConversionReviewSummaryPosture,
      },
    };
  }
  const baseArtifact: LegalResearchArtifactRecord = {
    id: existing?.id ?? `document-conversion-review-${documentId}`,
    firmId,
    matterId: document.matterId,
    kind: "document_analysis_status",
    status:
      existing?.status === "reviewed" || existing?.status === "rejected"
        ? existing.status
        : "ready_for_review",
    title: "Document conversion review posture",
    sourceReferences: [],
    contextLinks: [
      {
        resourceType: "document",
        resourceId: document.id,
        label: "Source document",
      },
    ],
    documentAnalysis: {
      documentId: document.id,
      status: "ready_for_review",
      extractionStatus: "completed",
      artifactStatus: "metadata_only",
      sourceTextLength: counts.sourceTextLength,
    },
    reviewDecision: existing?.reviewDecision,
    reviewedByUserId: existing?.reviewedByUserId,
    reviewedAt: existing?.reviewedAt,
    createdByUserId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    reviewOnly: true,
    metadata: {
      source: documentConversionReviewJobName,
      ...(jobId ? { jobId } : {}),
      extractionId: extraction.id,
      extractionEngine: extraction.engine,
      extractionStatus: extraction.status,
      provider: providerMetadata.provider,
      providerStatus: providerMetadata.providerStatus,
      counts,
      policy: providerMetadata.policy,
      metadataOnly: providerMetadata.metadataOnly,
      reviewOnly: providerMetadata.reviewOnly,
      reviewState: existing?.reviewDecision ?? "ready_for_review",
      conversionReviewPosture: providerMetadata.conversionReviewPosture,
      summaryPosture: providerMetadata.summaryPosture,
    },
  };
  const artifact = existing
    ? await repository.updateLegalResearchArtifact(baseArtifact)
    : await repository.createLegalResearchArtifact(baseArtifact);

  return {
    status: "completed",
    metadata: {
      firmId,
      matterId: document.matterId,
      documentId,
      extractionId: extraction.id,
      extractionStatus: extraction.status,
      extractionEngine: extraction.engine,
      artifactId: artifact.id,
      artifactKind: artifact.kind,
      provider: providerMetadata.provider,
      providerStatus: providerMetadata.providerStatus,
      sourceTextLength: counts.sourceTextLength,
      wordCount: counts.wordCount,
      lineCount: counts.lineCount,
      nonEmptyLineCount: counts.nonEmptyLineCount,
      paragraphCount: counts.paragraphCount,
      pageBreakCount: counts.pageBreakCount,
      estimatedPageCount: counts.estimatedPageCount,
      reviewState: artifact.reviewDecision ?? artifact.status,
      conversionReviewPosture: providerMetadata.conversionReviewPosture,
      summaryPosture: providerMetadata.summaryPosture,
      metadataOnly: providerMetadata.metadataOnly,
      reviewOnly: providerMetadata.reviewOnly,
    },
  };
}

export async function processOcrJob(input: {
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
  s3: WorkerS3Storage;
  ocrProvider: OcrProvider;
}): Promise<WorkerJobResult> {
  const { data, repository, s3, ocrProvider } = input;
  const documentId = data.resourceId;
  const firmId = data.firmId;

  if (!documentId) {
    throw new Error("Missing documentId in OCR job data");
  }

  const document = await repository.getDocument(firmId, documentId);
  if (!document) {
    return {
      status: "skipped",
      reason: "Document not found",
      metadata: { firmId, documentId },
    };
  }
  if (!documentScanSafeForOcr(document.scanStatus)) {
    return {
      status: "skipped",
      reason: "Document scan has not passed",
      metadata: { firmId, documentId, scanStatus: document.scanStatus },
    };
  }

  const getObjectResponse = await s3.client.send(
    new GetObjectCommand({
      Bucket: s3.bucket,
      Key: document.storageKey,
    }),
  );

  const content = await getObjectResponse.Body?.transformToByteArray();
  if (!content) {
    throw new Error("Failed to read document content from S3");
  }

  const rawLanguage = typeof data.metadata?.language === "string" ? data.metadata.language : "";
  const language = isAllowedOcrLanguage(rawLanguage.trim()) ? rawLanguage.trim() : "eng";
  const result = await ocrProvider.extractText({
    firmId,
    documentId,
    content,
    language,
  });

  const extraction: DocumentTextExtractionRecord = {
    id: crypto.randomUUID(),
    firmId,
    documentId,
    engine: "tesseract",
    status: "completed",
    language,
    confidence: result.confidence,
    extractedText: result.extractedText,
    metadata: result.metadata as Record<string, unknown>,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  await repository.createDocumentTextExtraction(extraction);

  return {
    status: "completed",
    metadata: {
      firmId,
      documentId,
      confidence: result.confidence,
      textLength: result.extractedText?.length ?? 0,
    },
  };
}
