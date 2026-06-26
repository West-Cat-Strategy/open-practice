import { GetObjectCommand } from "@aws-sdk/client-s3";
import type {
  DocumentTextExtractionRecord,
  LegalResearchArtifactRecord,
  OcrProvider,
} from "@open-practice/domain";
import { isAllowedOcrLanguage } from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { LocalDocumentConversionReviewProvider } from "@open-practice/providers";
import { isUnsupportedOcrInputError } from "@open-practice/providers/ocr/local-cli";
import { metadataString } from "./metadata.js";
import type { WorkerJobEnvelope, WorkerJobResult, WorkerS3Storage } from "./types.js";

export const documentConversionReviewJobName = "document_conversion_review" as const;
const documentConversionReviewSummaryPosture = "op_authored_metadata_only";

function documentScanSafeForOcr(scanStatus: string): boolean {
  return scanStatus === "passed" || scanStatus === "not_required";
}

function metadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function normalizeProviderConfidence(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const normalized = value > 1 ? value / 100 : value;
  return Number(Math.min(1, Math.max(0, normalized)).toFixed(4));
}

function extractionEngineFromMetadata(
  metadata: Record<string, unknown> | undefined,
): DocumentTextExtractionRecord["engine"] {
  const engine = metadataString(metadata ?? {}, "engine");
  if (engine === "ocrmypdf" || engine === "vision_llm" || engine === "manual") return engine;
  return "tesseract";
}

const safeOcrExtractionMetadataKeys = new Set([
  "confidenceAvailable",
  "confidenceScale",
  "engine",
  "engineVersion",
  "inputKind",
  "jobs",
  "jobId",
  "language",
  "ocrEngine",
  "outputType",
  "provider",
  "shellInterpolation",
  "skipText",
  "tesseractTimeoutSeconds",
  "textLength",
  "version",
]);

function safeOcrExtractionMetadataValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string") return value.slice(0, 256);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return undefined;
}

function sanitizeOcrExtractionMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (!safeOcrExtractionMetadataKeys.has(key)) continue;
    const safeValue = safeOcrExtractionMetadataValue(value);
    if (safeValue !== undefined) sanitized[key] = safeValue;
  }
  return sanitized;
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

function conversionReviewArtifactStatus(
  artifact: LegalResearchArtifactRecord | undefined,
): LegalResearchArtifactRecord["status"] {
  return artifact?.status === "reviewed" || artifact?.status === "rejected"
    ? artifact.status
    : "ready_for_review";
}

function terminalConversionReview(status: LegalResearchArtifactRecord["status"]): boolean {
  return status === "reviewed" || status === "rejected";
}

function conversionReviewMetadataArtifactStatus(
  artifact: LegalResearchArtifactRecord | undefined,
): Exclude<
  NonNullable<LegalResearchArtifactRecord["documentAnalysis"]>["artifactStatus"],
  undefined
> {
  return artifact?.documentAnalysis?.artifactStatus ?? "metadata_only";
}

export async function processDocumentConversionReviewJob(input: {
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
}): Promise<WorkerJobResult> {
  const { data, repository } = input;
  const metadata = data.metadata ?? {};
  const documentId = data.resourceId ?? metadataString(metadata, "documentId");
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
    extractionId: metadataString(metadata, "extractionId"),
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
  const jobId = metadataString(metadata, "jobId");
  const requestedByUserId = metadataString(metadata, "requestedByUserId");
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
  const artifactStatus = conversionReviewArtifactStatus(existing);
  const metadataArtifactStatus = conversionReviewMetadataArtifactStatus(existing);
  const terminalReview = terminalConversionReview(artifactStatus);
  const baseArtifact: LegalResearchArtifactRecord = {
    id: existing?.id ?? `document-conversion-review-${documentId}`,
    firmId,
    matterId: document.matterId,
    kind: "document_analysis_status",
    status: artifactStatus,
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
      artifactStatus: metadataArtifactStatus,
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
      reviewState: artifactStatus,
      artifactStatus: metadataArtifactStatus,
      staffReviewRequired: true,
      terminalReview,
      downstreamMutation: false,
      providerEvidenceStored: false,
      rawOcrTextReturned: false,
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
      reviewState: artifact.status,
      artifactStatus: conversionReviewMetadataArtifactStatus(artifact),
      staffReviewRequired: true,
      terminalReview: terminalConversionReview(artifact.status),
      downstreamMutation: false,
      providerEvidenceStored: false,
      rawOcrTextReturned: false,
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
  let result: Awaited<ReturnType<OcrProvider["extractText"]>>;
  try {
    result = await ocrProvider.extractText({
      firmId,
      documentId,
      content,
      language,
    });
  } catch (error) {
    if (isUnsupportedOcrInputError(error)) {
      return {
        status: "skipped",
        reason: "Unsupported OCR input file type",
        metadata: {
          firmId,
          documentId,
          matterId: document.matterId,
          ocrInputStatus: "unsupported_file_type",
        },
      };
    }
    throw error;
  }

  const providerMetadata = result.metadata as Record<string, unknown> | undefined;
  const engine = extractionEngineFromMetadata(providerMetadata);
  const confidence = normalizeProviderConfidence(result.confidence);
  const extractionMetadata = sanitizeOcrExtractionMetadata(providerMetadata);

  const extraction: DocumentTextExtractionRecord = {
    id: crypto.randomUUID(),
    firmId,
    documentId,
    engine,
    status: "completed",
    language,
    ...(confidence !== undefined ? { confidence } : {}),
    extractedText: result.extractedText,
    metadata: extractionMetadata,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  await repository.createDocumentTextExtraction(extraction);

  return {
    status: "completed",
    metadata: {
      firmId,
      documentId,
      extractionEngine: engine,
      ...(confidence !== undefined ? { confidence } : {}),
      textLength: result.extractedText?.length ?? 0,
    },
  };
}
