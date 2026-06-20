import type {
  AiOperationalProposalProvider,
  DocumentAutomationProvider,
  DraftAssistProvider,
  InboundEmailParser,
  MailSender,
  OcrProvider,
  OpenPracticeQueueName,
} from "@open-practice/domain";
import { IMAP_POLL_JOB_NAME } from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import type { ImapMailboxPoller } from "@open-practice/providers/email/imap";
import { processAiTriageJob } from "./processors/ai-triage.js";
import { processConnectorJob } from "./processors/connectors.js";
import { processDocumentAssemblyJob } from "./processors/document-assembly.js";
import { processEmailJob } from "./processors/email.js";
import { processInboundEmailJob } from "./processors/inbound-email.js";
import { processInboundEmailPollJob } from "./processors/inbound-email-poll.js";
import {
  documentConversionReviewJobName,
  processDocumentConversionReviewJob,
  processOcrJob,
} from "./processors/ocr.js";
import { processReportJob } from "./processors/reports.js";
import type {
  ConnectorDnsResolver,
  ConnectorHttpDeliverer,
  ConnectorSecretResolver,
  WorkerJobEnvelope,
  WorkerJobQueue,
  WorkerJobResult,
  WorkerS3Storage,
} from "./processors/types.js";
import { sanitizeJobMetadata } from "./queues.js";

export type {
  ConnectorDeliveryRequest,
  ConnectorDeliveryResponse,
  ConnectorDnsResolver,
  ConnectorHttpDeliverer,
  ConnectorSecretResolver,
  WorkerJobEnvelope,
  WorkerJobQueue,
  WorkerJobResult,
  WorkerS3Storage,
} from "./processors/types.js";

const disabledReasons: Record<OpenPracticeQueueName, string> = {
  email: "SMTP email delivery is not configured",
  connectors: "Connector delivery is not configured",
  document_assembly: "Document assembly processing is not configured",
  inbound_email: "Inbound email parsing is not configured",
  reports: "Report export processing is not configured",
  ai_triage: "AI triage is reserved/deferred and has no worker processor",
  ocr: "OCR worker dependencies are not configured",
  transcription: "Transcription is reserved/deferred and has no worker processor",
  media: "Media processing is reserved/deferred and has no worker processor",
};

const reservedQueueNames = new Set<OpenPracticeQueueName>(["ai_triage", "transcription", "media"]);

export async function processOpenPracticeJob(input: {
  queueName: OpenPracticeQueueName;
  jobName: string;
  data: WorkerJobEnvelope;
  jobLifecycleId?: string;
  attemptsMade?: number;
  maxAttempts?: number;
  repository: OpenPracticeRepository;
  s3: WorkerS3Storage;
  ocrProvider: OcrProvider;
  aiOperationalProposalProvider?: AiOperationalProposalProvider;
  draftAssistProvider?: DraftAssistProvider;
  mailSender: MailSender;
  inboundEmailParser: InboundEmailParser;
  imapMailboxPoller?: ImapMailboxPoller;
  connectorSecretResolver?: ConnectorSecretResolver;
  connectorHttpDeliverer?: ConnectorHttpDeliverer;
  connectorDnsResolver?: ConnectorDnsResolver;
  connectorJobQueue?: WorkerJobQueue;
  automationProvider?: DocumentAutomationProvider;
  inboundEmailJobQueue?: WorkerJobQueue;
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
  jobLifecycleId?: string;
  attemptsMade?: number;
  maxAttempts?: number;
  repository: OpenPracticeRepository;
  s3: WorkerS3Storage;
  ocrProvider: OcrProvider;
  aiOperationalProposalProvider?: AiOperationalProposalProvider;
  draftAssistProvider?: DraftAssistProvider;
  mailSender: MailSender;
  inboundEmailParser: InboundEmailParser;
  imapMailboxPoller?: ImapMailboxPoller;
  connectorSecretResolver?: ConnectorSecretResolver;
  connectorHttpDeliverer?: ConnectorHttpDeliverer;
  connectorDnsResolver?: ConnectorDnsResolver;
  connectorJobQueue?: WorkerJobQueue;
  automationProvider?: DocumentAutomationProvider;
  inboundEmailJobQueue?: WorkerJobQueue;
}): Promise<WorkerJobResult> {
  const { queueName, data } = input;

  if (queueName === "ocr" && input.jobName === documentConversionReviewJobName) {
    return processDocumentConversionReviewJob(input);
  }
  if (queueName === "ocr") return processOcrJob(input);
  if (queueName === "email") return processEmailJob(input);
  if (queueName === "connectors") return processConnectorJob(input);
  if (queueName === "document_assembly") return processDocumentAssemblyJob(input);
  if (queueName === "inbound_email" && input.jobName === IMAP_POLL_JOB_NAME) {
    return processInboundEmailPollJob(input);
  }
  if (queueName === "inbound_email") return processInboundEmailJob(input);
  if (queueName === "reports") return processReportJob(input);
  if (queueName === "ai_triage") {
    const result = await processAiTriageJob(input);
    if (result) return result;
  }

  return {
    status: "skipped",
    reason: disabledReasons[queueName],
    metadata: {
      firmId: data.firmId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      queueStatus: reservedQueueNames.has(queueName) ? "reserved" : "disabled",
      reason: reservedQueueNames.has(queueName) ? "deferred_worker" : "not_configured",
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
