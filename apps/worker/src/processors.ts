import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type {
  OpenPracticeQueueName,
  DocumentTextExtractionRecord,
  InboundEmailParser,
  MailSender,
  OcrProvider,
} from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { processInboundEmailJob } from "./processors/inbound-email.js";
import { sanitizeJobMetadata } from "./queues.js";

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
  jobLifecycleId?: string;
  attemptsMade?: number;
  maxAttempts?: number;
  repository: OpenPracticeRepository;
  s3: { client: S3Client; bucket: string };
  ocrProvider: OcrProvider;
  mailSender: MailSender;
  inboundEmailParser: InboundEmailParser;
}): Promise<WorkerJobResult> {
  const { data } = input;

  await updateJobLifecycle(input, {
    status: "active",
    startedAt: new Date().toISOString(),
    attemptsMade: input.attemptsMade,
  });

  try {
    const result = await processOpenPracticeJobBody(input);
    await updateJobLifecycle(input, {
      status: result.status,
      finishedAt: new Date().toISOString(),
      attemptsMade: input.attemptsMade,
      errorMessage: result.reason,
      metadata: sanitizeJobMetadata({
        ...data.metadata,
        ...result.metadata,
      }),
    });
    return result;
  } catch (error) {
    const failedAttempts = (input.attemptsMade ?? 0) + 1;
    const maxAttempts = input.maxAttempts ?? 1;
    await updateJobLifecycle(input, {
      status: failedAttempts >= maxAttempts ? "dead_letter" : "failed",
      failedAt: new Date().toISOString(),
      attemptsMade: failedAttempts,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function processOpenPracticeJobBody(input: {
  queueName: OpenPracticeQueueName;
  jobName: string;
  data: WorkerJobEnvelope;
  attemptsMade?: number;
  maxAttempts?: number;
  repository: OpenPracticeRepository;
  s3: { client: S3Client; bucket: string };
  ocrProvider: OcrProvider;
  mailSender: MailSender;
  inboundEmailParser: InboundEmailParser;
}): Promise<WorkerJobResult> {
  const { queueName, data } = input;

  if (queueName === "ocr") return processOcrJob(input);
  if (queueName === "email") return processEmailJob(input);
  if (queueName === "inbound_email") return processInboundEmailJob(input);

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

async function updateJobLifecycle(
  input: {
    data: WorkerJobEnvelope;
    jobLifecycleId?: string;
    repository: OpenPracticeRepository;
  },
  updates: Parameters<OpenPracticeRepository["updateJobLifecycleRecord"]>[2],
): Promise<void> {
  if (!input.jobLifecycleId) return;
  await input.repository.updateJobLifecycleRecord(input.data.firmId, input.jobLifecycleId, updates);
}

function calculateNextEmailRetryAt(occurredAt: string, attemptsMade: number): string {
  const delayMs = Math.min(30_000 * 2 ** Math.max(attemptsMade - 1, 0), 30 * 60_000);
  return new Date(Date.parse(occurredAt) + delayMs).toISOString();
}

async function processEmailJob(input: {
  data: WorkerJobEnvelope;
  attemptsMade?: number;
  maxAttempts?: number;
  repository: OpenPracticeRepository;
  mailSender: MailSender;
}): Promise<WorkerJobResult> {
  const { data, repository, mailSender } = input;
  const metadata = data.metadata || {};
  const emailId =
    data.resourceType === "email_outbox" && data.resourceId
      ? data.resourceId
      : typeof metadata.emailId === "string"
        ? metadata.emailId
        : undefined;

  if (!emailId) {
    return {
      status: "skipped",
      reason: "Missing email outbox id in job metadata",
      metadata: { firmId: data.firmId },
    };
  }

  const email = await repository.getEmailOutbox(data.firmId, emailId);
  if (!email) {
    return {
      status: "skipped",
      reason: "Email outbox record not found",
      metadata: { firmId: data.firmId, emailId },
    };
  }

  if (email.status === "sent" || email.status === "cancelled") {
    return {
      status: "skipped",
      reason: `Email outbox is already ${email.status}`,
      metadata: { firmId: data.firmId, emailId },
    };
  }

  if (!email.subject || (!email.htmlBody && !email.textBody)) {
    return {
      status: "skipped",
      reason: "Missing email details in outbox record",
      metadata: { firmId: data.firmId, emailId },
    };
  }

  const attemptNumber = (input.attemptsMade ?? 0) + 1;
  const maxAttempts = input.maxAttempts ?? 1;
  let result: Awaited<ReturnType<MailSender["send"]>>;
  try {
    result = await mailSender.send({
      firmId: data.firmId,
      from: email.from,
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      subject: email.subject,
      html: email.htmlBody,
      text: email.textBody,
      metadata: email.metadata.providerMetadata as Record<string, unknown>,
    });
  } catch (error) {
    const occurredAt = new Date().toISOString();
    const terminal = attemptNumber >= maxAttempts;
    const nextRetryAt = terminal ? undefined : calculateNextEmailRetryAt(occurredAt, attemptNumber);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await repository.recordEmailDeliveryResult({
      firmId: data.firmId,
      emailId,
      status: "failed",
      occurredAt,
      errorMessage,
      metadata: {
        attemptNumber,
        maxAttempts,
        nextRetryAt,
        terminal,
        provider: email.metadata.provider,
        templateKey: email.templateKey,
      },
    });
    throw error;
  }

  await repository.recordEmailDeliveryResult({
    firmId: data.firmId,
    emailId,
    status: "sent",
    occurredAt: new Date().toISOString(),
    providerMessageId: result.providerMessageId,
    metadata: {
      attemptNumber,
      maxAttempts,
      terminal: true,
      provider: email.metadata.provider,
      templateKey: email.templateKey,
    },
  });

  return {
    status: "completed",
    metadata: {
      firmId: data.firmId,
      emailId,
      attemptNumber,
      maxAttempts,
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
