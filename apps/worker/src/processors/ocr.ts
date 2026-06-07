import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { DocumentTextExtractionRecord, OcrProvider } from "@open-practice/domain";
import { isAllowedOcrLanguage } from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import type { WorkerJobEnvelope, WorkerJobResult, WorkerS3Storage } from "./types.js";

function documentScanSafeForOcr(scanStatus: string): boolean {
  return scanStatus === "passed" || scanStatus === "not_required";
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
