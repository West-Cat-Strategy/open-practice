import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type {
  OpenPracticeQueueName,
  DocumentTextExtractionRecord,
  MailSender,
  OcrProvider,
} from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";

export interface WorkerJobEnvelope {
  firmId: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkerJobResult {
  status: "completed" | "skipped";
  reason?: string;
  metadata: Record<string, unknown>;
}

const disabledReasons: Record<OpenPracticeQueueName, string> = {
  email: "SMTP email delivery is not configured",
  inbound_email: "Inbound email parsing is not configured",
  ai_triage: "AI triage is disabled by default",
  ocr: "OCR worker dependencies are not configured",
  transcription: "Whisper transcription is not configured",
  media: "FFmpeg media processing is not configured",
};

export async function processOpenPracticeJob(input: {
  queueName: OpenPracticeQueueName;
  jobName: string;
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
  s3: { client: S3Client; bucket: string };
  ocrProvider: OcrProvider;
  mailSender: MailSender;
}): Promise<WorkerJobResult> {
  const { queueName, data } = input;

  if (queueName === "ocr") {
    return processOcrJob(input);
  }

  if (queueName === "email") {
    return processEmailJob(input);
  }

  return {
    status: "skipped",
    reason: disabledReasons[queueName],
    metadata: {
      firmId: data.firmId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      providerConfigured: false,
    },
  };
}

async function processEmailJob(input: {
  data: WorkerJobEnvelope;
  mailSender: MailSender;
}): Promise<WorkerJobResult> {
  const { data, mailSender } = input;
  const metadata = data.metadata || {};

  if (!metadata.to || !metadata.subject || (!metadata.html && !metadata.text)) {
    return {
      status: "skipped",
      reason: "Missing email details in job metadata",
      metadata: { firmId: data.firmId },
    };
  }

  const result = await mailSender.send({
    firmId: data.firmId,
    from: (metadata.from as string) || "Open Practice <no-reply@open-practice.local>",
    to: Array.isArray(metadata.to) ? (metadata.to as string[]) : [metadata.to as string],
    subject: metadata.subject as string,
    html: (metadata.html as string) || "",
    text: (metadata.text as string) || "",
    metadata: metadata.providerMetadata as Record<string, unknown>,
  });

  return {
    status: "completed",
    metadata: {
      firmId: data.firmId,
      providerMessageId: result.providerMessageId,
    },
  };
}

async function processOcrJob(input: {
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
  s3: { client: S3Client; bucket: string };
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

  // Download from S3
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

  // Extract text
  const language = (data.metadata?.language as string) || "eng";
  const result = await ocrProvider.extractText({
    firmId,
    documentId,
    content,
    language,
  });

  // Save extraction record
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
