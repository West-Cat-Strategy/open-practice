import { createHmac } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type {
  AiOperationalProposalKind,
  AiOperationalProposalProvider,
  ConnectorOutboxRecord,
  DocumentTextExtractionRecord,
  DraftAssistProvider,
  DraftAssistRecord,
  InboundEmailParser,
  MailSender,
  OcrProvider,
  OpenPracticeQueueName,
} from "@open-practice/domain";
import {
  assertDraftAssistTask,
  assertAiOperationalProposalKinds,
  buildAiOperationalProposalAuditMetadata,
  buildStaffReportProjection,
  buildDraftAssistAuditMetadata,
  extractTipTapPlainText,
  getStaffSavedReportDefinition,
  isAllowedOcrLanguage,
  isStaffReportDefinitionKey,
  isStaffReportExportProfileId,
  isStaffReportGroupingKey,
  legalResearchProviderJobName,
  isDeniedOutboundWebhookAddress,
  outboundWebhookEventAllowlist,
  validateOutboundWebhookDestination,
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

export interface WorkerJobQueue {
  add(
    name: string,
    data: WorkerJobEnvelope,
    options?: { jobId?: string; delay?: number },
  ): Promise<{ id?: string | number }>;
}

export interface WorkerJobResult {
  status: "completed" | "skipped";
  reason?: string;
  metadata: Record<string, unknown>;
}

export interface ConnectorDeliveryRequest {
  url: string;
  body: string;
  headers: Record<string, string>;
}

export interface ConnectorDeliveryResponse {
  status: number;
}

export type ConnectorSecretResolver = (secretReferenceId: string) => string | undefined;

export type ConnectorHttpDeliverer = (
  request: ConnectorDeliveryRequest,
) => Promise<ConnectorDeliveryResponse>;

export type ConnectorDnsResolver = (hostname: string) => Promise<string[]>;

type WorkerS3Storage = {
  client: S3Client;
  bucket: string;
  serverSideEncryption?: "AES256";
};

function documentScanSafeForOcr(scanStatus: string): boolean {
  return scanStatus === "passed" || scanStatus === "not_required";
}

const CONNECTOR_DELIVERY_JOB_NAME = "deliver_connectors";
const CONNECTOR_JOB_MAX_ATTEMPTS = 3;

const disabledReasons: Record<OpenPracticeQueueName, string> = {
  email: "SMTP email delivery is not configured",
  connectors: "Connector delivery is not configured",
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
  connectorSecretResolver?: ConnectorSecretResolver;
  connectorHttpDeliverer?: ConnectorHttpDeliverer;
  connectorDnsResolver?: ConnectorDnsResolver;
  connectorJobQueue?: WorkerJobQueue;
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
  connectorSecretResolver?: ConnectorSecretResolver;
  connectorHttpDeliverer?: ConnectorHttpDeliverer;
  connectorDnsResolver?: ConnectorDnsResolver;
  connectorJobQueue?: WorkerJobQueue;
}): Promise<WorkerJobResult> {
  const { queueName, data } = input;

  if (queueName === "ocr") return processOcrJob(input);
  if (queueName === "email") return processEmailJob(input);
  if (queueName === "connectors") return processConnectorJob(input);
  if (queueName === "inbound_email") return processInboundEmailJob(input);
  if (queueName === "reports") return processReportJob(input);
  if (queueName === "ai_triage" && input.jobName === "draft_assist_suggestion") {
    return processDraftAssistJob(input);
  }
  if (queueName === "ai_triage" && input.jobName === "operational_action_proposals") {
    return processOperationalProposalJob(input);
  }
  if (queueName === "ai_triage" && input.jobName === legalResearchProviderJobName) {
    return processLegalResearchProviderReviewJob(input);
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

function processLegalResearchProviderReviewJob(input: {
  data: WorkerJobEnvelope;
}): WorkerJobResult {
  const metadata = input.data.metadata ?? {};
  return {
    status: "skipped",
    reason:
      "Legal research provider jobs are reserved until a citation-review provider is configured.",
    metadata: {
      ...sanitizeJobMetadata(metadata),
      provider: "reserved_legal_research_provider",
      providerStatus: "reserved",
      providerConfigured: false,
      citationReviewRequired: true,
      sourceTextIncluded: false,
      promptIncluded: false,
      providerEvidenceStored: false,
      citationVerificationClaims: false,
      downstreamMutation: false,
      reviewOnly: true,
      enqueueStatus: "reserved_worker_skipped",
    },
  };
}

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function metadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function metadataJurisdiction(metadata: Record<string, unknown>): string | undefined {
  const value = metadataString(metadata, "jurisdiction");
  return value === "BC" || value === "ON" || value === "CANADA" || value === "OTHER"
    ? value
    : undefined;
}

function metadataStaffReportDefinitionKey(metadata: Record<string, unknown>) {
  const value = metadataString(metadata, "reportDefinitionKey");
  return value && isStaffReportDefinitionKey(value) ? value : undefined;
}

function metadataStaffReportExportProfileId(metadata: Record<string, unknown>) {
  const value = metadataString(metadata, "exportProfileId");
  return value && isStaffReportExportProfileId(value) ? value : undefined;
}

function metadataStaffReportGroupingKey(metadata: Record<string, unknown>) {
  const value = metadataString(metadata, "groupingKey");
  return value && isStaffReportGroupingKey(value) ? value : undefined;
}

async function enabledAiProviderKey(
  repository: OpenPracticeRepository,
  firmId: string,
): Promise<string | undefined> {
  return (await repository.listProviderSettings(firmId, { kind: "ai" })).find(
    (provider) => provider.enabled,
  )?.key;
}

function latestCompletedExtraction(
  extractions: DocumentTextExtractionRecord[],
): DocumentTextExtractionRecord | undefined {
  return extractions
    .filter((candidate) => candidate.status === "completed" && candidate.extractedText)
    .sort((left, right) =>
      (right.completedAt ?? right.createdAt).localeCompare(left.completedAt ?? left.createdAt),
    )[0];
}

async function resolveDraftAssistSource(input: {
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
}): Promise<
  | {
      ok: true;
      sourceType: DraftAssistRecord["sourceType"];
      matterId: string;
      draftId?: string;
      documentId?: string;
      sourceLabel?: string;
      sourceText: string;
    }
  | { ok: false; reason: string; metadata: Record<string, unknown> }
> {
  const metadata = input.data.metadata ?? {};
  const sourceType = metadataString(metadata, "sourceType") ?? input.data.resourceType;

  if (sourceType === "draft") {
    const draftId = input.data.resourceId ?? metadataString(metadata, "draftId");
    if (!draftId) {
      return { ok: false, reason: "Missing draft id in async assist job", metadata: {} };
    }
    const draft = await input.repository.getDraft(input.data.firmId, draftId);
    if (!draft?.matterId) {
      return {
        ok: false,
        reason: "Draft source record not found for async assist",
        metadata: { draftId },
      };
    }
    return {
      ok: true,
      sourceType: "draft",
      matterId: draft.matterId,
      draftId: draft.id,
      sourceLabel: draft.title,
      sourceText: extractTipTapPlainText(draft.editorJson),
    };
  }

  if (sourceType === "document") {
    const documentId = input.data.resourceId ?? metadataString(metadata, "documentId");
    if (!documentId) {
      return { ok: false, reason: "Missing document id in async assist job", metadata: {} };
    }
    const document = await input.repository.getDocument(input.data.firmId, documentId);
    if (!document) {
      return {
        ok: false,
        reason: "Document source record not found for async assist",
        metadata: { documentId },
      };
    }
    const extraction = latestCompletedExtraction(
      await input.repository.getDocumentTextExtractions(input.data.firmId, document.id),
    );
    if (!extraction?.extractedText) {
      return {
        ok: false,
        reason: "Completed document extraction not found for async assist",
        metadata: { matterId: document.matterId, documentId: document.id },
      };
    }
    return {
      ok: true,
      sourceType: "document",
      matterId: document.matterId,
      documentId: document.id,
      sourceLabel: document.title,
      sourceText: extraction.extractedText,
    };
  }

  return {
    ok: false,
    reason: "Unsupported async assist source type",
    metadata: { sourceType },
  };
}

async function processDraftAssistJob(input: {
  data: WorkerJobEnvelope;
  jobLifecycleId?: string;
  repository: OpenPracticeRepository;
  draftAssistProvider?: DraftAssistProvider;
}): Promise<WorkerJobResult> {
  const { data, repository, draftAssistProvider } = input;
  const metadata = data.metadata ?? {};
  const providerKey = await enabledAiProviderKey(repository, data.firmId);
  if (!providerKey || !draftAssistProvider) {
    return {
      status: "skipped",
      reason: "Draft assist provider is not configured",
      metadata: {
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        queueStatus: "configured",
        reason: "not_configured",
        providerConfigured: false,
      },
    };
  }

  const taskValue = metadataString(metadata, "task");
  if (!taskValue) {
    return {
      status: "skipped",
      reason: "Missing draft assist task in job metadata",
      metadata: {
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
      },
    };
  }
  assertDraftAssistTask(taskValue);
  const requestedByUserId = metadataString(metadata, "requestedByUserId");
  if (!requestedByUserId) {
    return {
      status: "skipped",
      reason: "Missing requesting user for async assist job",
      metadata: {
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
      },
    };
  }

  const source = await resolveDraftAssistSource({ data, repository });
  if (!source.ok) {
    return {
      status: "skipped",
      reason: source.reason,
      metadata: { firmId: data.firmId, ...source.metadata },
    };
  }

  const suggestion = await draftAssistProvider.createSuggestion({
    firmId: data.firmId,
    matterId: source.matterId,
    sourceType: source.sourceType,
    draftId: source.draftId,
    documentId: source.documentId,
    task: taskValue,
    sourceText: source.sourceText,
    metadata: {
      asyncJob: true,
      jobId: input.jobLifecycleId,
    },
  });
  const now = new Date().toISOString();
  const record: DraftAssistRecord = {
    id: crypto.randomUUID(),
    firmId: data.firmId,
    matterId: source.matterId,
    sourceType: source.sourceType,
    draftId: source.draftId,
    documentId: source.documentId,
    task: taskValue,
    providerKey,
    providerModel: suggestion.providerModel,
    status: "suggested",
    suggestedText: suggestion.suggestedText,
    summary: suggestion.summary,
    createdByUserId: requestedByUserId,
    createdAt: now,
    updatedAt: now,
    metadata: {
      asyncJobId: input.jobLifecycleId,
      sourceTextLength: source.sourceText.length,
      instructionLength:
        typeof metadata.instructionLength === "number" ? metadata.instructionLength : 0,
      evidenceKeyCount:
        typeof metadata.evidenceKeyCount === "number" ? metadata.evidenceKeyCount : 0,
    },
  };
  const created = await repository.createDraftAssistRecord(record);
  await repository.appendAuditEvent({
    id: crypto.randomUUID(),
    firmId: data.firmId,
    actorId: requestedByUserId,
    occurredAt: now,
    action: "draft_assist.created",
    resourceType: "draft_assist",
    resourceId: created.id,
    metadata: compactMetadata(buildDraftAssistAuditMetadata(created)),
  });

  return {
    status: "completed",
    metadata: {
      firmId: data.firmId,
      matterId: source.matterId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      sourceType: source.sourceType,
      draftId: source.draftId,
      documentId: source.documentId,
      draftAssistRecordId: created.id,
      task: taskValue,
      provider: providerKey,
      providerModel: created.providerModel,
      sourceTextLength: source.sourceText.length,
      suggestedTextLength: created.suggestedText.length,
      summaryLength: created.summary?.length ?? 0,
      requestedByUserId,
    },
  };
}

function metadataProposalKinds(metadata: Record<string, unknown>): AiOperationalProposalKind[] {
  const value = metadataString(metadata, "proposalKinds");
  const kinds = value
    ? value
        .split(",")
        .map((kind) => kind.trim())
        .filter(Boolean)
    : [];
  assertAiOperationalProposalKinds(kinds);
  return kinds;
}

async function processOperationalProposalJob(input: {
  data: WorkerJobEnvelope;
  jobLifecycleId?: string;
  repository: OpenPracticeRepository;
  aiOperationalProposalProvider?: AiOperationalProposalProvider;
}): Promise<WorkerJobResult> {
  const { data, repository, aiOperationalProposalProvider } = input;
  const metadata = data.metadata ?? {};
  const providerKey = await enabledAiProviderKey(repository, data.firmId);
  if (!providerKey || !aiOperationalProposalProvider) {
    return {
      status: "skipped",
      reason: "AI operational proposal provider is not configured",
      metadata: {
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        queueStatus: "configured",
        reason: "not_configured",
        providerConfigured: false,
      },
    };
  }

  const requestedByUserId = metadataString(metadata, "requestedByUserId");
  if (!requestedByUserId) {
    return {
      status: "skipped",
      reason: "Missing requesting user for operational proposal job",
      metadata: {
        firmId: data.firmId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
      },
    };
  }
  const proposalKinds = metadataProposalKinds(metadata);
  const source = await resolveDraftAssistSource({ data, repository });
  if (!source.ok) {
    return {
      status: "skipped",
      reason: source.reason,
      metadata: { firmId: data.firmId, ...source.metadata },
    };
  }

  const result = await aiOperationalProposalProvider.createOperationalProposals({
    firmId: data.firmId,
    matterId: source.matterId,
    sourceType: source.sourceType,
    draftId: source.draftId,
    documentId: source.documentId,
    sourceLabel: source.sourceLabel,
    sourceText: source.sourceText,
    requestedKinds: proposalKinds,
    metadata: {
      asyncJob: true,
      jobId: input.jobLifecycleId,
    },
  });
  const now = new Date().toISOString();
  const created = [];
  for (const suggestion of result.proposals) {
    assertAiOperationalProposalKinds([suggestion.kind]);
    const record = await repository.createAiOperationalProposal({
      id: crypto.randomUUID(),
      firmId: data.firmId,
      matterId: source.matterId,
      kind: suggestion.kind,
      status: "proposed",
      source: {
        sourceType: source.sourceType,
        draftId: source.draftId,
        documentId: source.documentId,
        sourceLabel: source.sourceLabel,
        sourceTextLength: source.sourceText.length,
      },
      providerKey,
      providerModel: result.providerModel,
      proposal: suggestion.proposal,
      createdByUserId: requestedByUserId,
      createdAt: now,
      updatedAt: now,
      metadata: {
        asyncJobId: input.jobLifecycleId,
        requestedKindCount: proposalKinds.length,
        providerMetadataKeyCount: Object.keys(suggestion.metadata ?? {}).length,
        statusOnlyReview: true,
      },
    });
    created.push(record);
    await repository.appendAuditEvent({
      id: crypto.randomUUID(),
      firmId: data.firmId,
      actorId: requestedByUserId,
      occurredAt: now,
      action: "ai_operational_proposal.created",
      resourceType: "ai_proposal",
      resourceId: record.id,
      metadata: compactMetadata(buildAiOperationalProposalAuditMetadata(record)),
    });
  }

  return {
    status: "completed",
    metadata: {
      firmId: data.firmId,
      matterId: source.matterId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      sourceType: source.sourceType,
      draftId: source.draftId,
      documentId: source.documentId,
      proposalKinds: proposalKinds.join(","),
      proposalKindCount: proposalKinds.length,
      proposalCount: created.length,
      provider: providerKey,
      providerModel: result.providerModel,
      sourceTextLength: source.sourceText.length,
      requestedByUserId,
    },
  };
}

async function processReportJob(input: {
  jobName: string;
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
}): Promise<WorkerJobResult> {
  const { data, repository } = input;

  if (input.jobName === "audit_export" && data.resourceType === "audit_export") {
    const audit = await repository.listAuditEvents(data.firmId);
    return {
      status: "completed",
      metadata: {
        firmId: data.firmId,
        resourceType: "audit_export",
        resourceId: data.resourceId,
        reportType: "audit_log",
        reportScope: "firm",
        eventCount: audit.events.length,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  if (input.jobName === "billing_export" && data.resourceType === "billing_export") {
    const matterId = metadataString(data.metadata ?? {}, "matterId");
    const [timeEntries, expenseEntries, invoices, payments, trustTransferRequests] =
      await Promise.all([
        repository.listTimeEntries(data.firmId, matterId ? { matterId } : {}),
        repository.listExpenseEntries(data.firmId, matterId ? { matterId } : {}),
        repository.listInvoices(data.firmId, matterId ? { matterId } : {}),
        repository.listPayments(data.firmId, matterId ? { matterId } : {}),
        repository.listTrustTransferRequests(data.firmId, matterId ? { matterId } : {}),
      ]);
    const recordCount =
      timeEntries.length +
      expenseEntries.length +
      invoices.length +
      payments.length +
      trustTransferRequests.length;
    return {
      status: "completed",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: "billing_export",
        resourceId: data.resourceId,
        reportType: "billing",
        reportScope: matterId ? "matter" : "firm",
        matterId,
        recordCount,
        timeEntryCount: timeEntries.length,
        expenseEntryCount: expenseEntries.length,
        invoiceCount: invoices.length,
        paymentCount: payments.length,
        trustTransferRequestCount: trustTransferRequests.length,
        generatedAt: new Date().toISOString(),
      }),
    };
  }

  if (
    input.jobName === "jurisdictional_trust_export" &&
    data.resourceType === "jurisdictional_trust_export"
  ) {
    const jurisdiction = metadataJurisdiction(data.metadata ?? {});
    return {
      status: "completed",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: "jurisdictional_trust_export",
        resourceId: data.resourceId,
        reportType: "jurisdictional_trust",
        reportScope: "firm",
        jurisdiction,
        generatedAt: new Date().toISOString(),
      }),
    };
  }

  if (input.jobName === "staff_report_export" && data.resourceType === "staff_report_export") {
    const metadata = data.metadata ?? {};
    const reportDefinitionKey = metadataStaffReportDefinitionKey(metadata);
    const exportProfileId = metadataStaffReportExportProfileId(metadata);
    if (!reportDefinitionKey || !exportProfileId) {
      return {
        status: "skipped",
        reason: "Staff report export metadata was incomplete",
        metadata: compactMetadata({
          firmId: data.firmId,
          resourceType: "staff_report_export",
          resourceId: data.resourceId,
          reportType: "staff_reporting",
          reportStatus: "invalid_metadata",
        }),
      };
    }
    const definition = getStaffSavedReportDefinition(reportDefinitionKey);
    const groupingKey = metadataStaffReportGroupingKey(metadata) ?? definition.defaultGrouping;
    const overview = await repository.getOverview(data.firmId);
    const firmWideMatterReader =
      overview.users.find((user) => user.role === "owner_admin") ??
      overview.users.find((user) => user.role === "auditor") ??
      overview.users[0];
    const [matters, invoices, ledger, reconciliations, timeEntries, taskDeadlines] =
      await Promise.all([
        firmWideMatterReader ? repository.listMattersForUser(firmWideMatterReader) : [],
        repository.listInvoices(data.firmId),
        repository.getLedger(data.firmId),
        repository.listLedgerReconciliations(data.firmId),
        repository.listTimeEntries(data.firmId),
        repository.listTaskDeadlines(data.firmId, { includeCompleted: true }),
      ]);
    const projection = buildStaffReportProjection({
      firmId: data.firmId,
      definitionKey: reportDefinitionKey,
      groupingKey,
      matters,
      users: overview.users,
      invoices,
      ledgerAccounts: ledger.accounts,
      reconciliations,
      timeEntries,
      taskDeadlines,
    });
    return {
      status: "completed",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: "staff_report_export",
        resourceId: data.resourceId,
        reportType: "staff_reporting",
        reportDefinitionKey,
        exportProfileId,
        groupingKey,
        rowCount: projection.rowCount,
        generatedAt: projection.generatedAt,
      }),
    };
  }

  if (
    input.jobName === "conversation_thread_export" &&
    data.resourceType === "conversation_thread_export"
  ) {
    const threadId = metadataString(data.metadata ?? {}, "threadId");
    const thread = threadId
      ? await repository.getConversationThread(data.firmId, threadId)
      : undefined;
    if (!thread) {
      return {
        status: "skipped",
        reason: "Conversation thread export target was not found",
        metadata: compactMetadata({
          firmId: data.firmId,
          resourceType: "conversation_thread_export",
          resourceId: data.resourceId,
          reportType: "conversation_thread",
          reportScope: "matter",
          threadId,
          reportStatus: "missing_thread",
        }),
      };
    }
    const messages = await repository.listConversationMessages(data.firmId, {
      threadId: thread.id,
    });
    return {
      status: "completed",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: "conversation_thread_export",
        resourceId: data.resourceId,
        reportType: "conversation_thread",
        reportScope: "matter",
        matterId: thread.matterId,
        threadId: thread.id,
        messageCount: messages.length,
        generatedAt: new Date().toISOString(),
      }),
    };
  }

  return {
    status: "skipped",
    reason: "Unsupported report export job",
    metadata: {
      firmId: data.firmId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      reportStatus: "unsupported",
    },
  };
}

const allowedConnectorEvents = new Set<string>(outboundWebhookEventAllowlist);

function errorSummary(message: string): string {
  return message.length > 180 ? `${message.slice(0, 177)}...` : message;
}

function connectorBatchSize(metadata: Record<string, unknown>): number {
  const value = metadata.batchSize;
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, 25)
    : 10;
}

function connectorLeaseMs(metadata: Record<string, unknown>): number {
  const value = metadata.leaseMs;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 5 * 60 * 1000;
}

function connectorRetryAt(attemptNumber: number, now: string): string {
  const delayMs = Math.min(30 * 60 * 1000, 30_000 * 2 ** Math.max(0, attemptNumber - 1));
  return new Date(Date.parse(now) + delayMs).toISOString();
}

function responseClass(status: number): string {
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500 && status < 600) return "5xx";
  return "other";
}

function connectorDestinationUrl(configSummary: Record<string, unknown>): string | undefined {
  const value = configSummary.deliveryUrl;
  return typeof value === "string" && value.trim() ? value : undefined;
}

function connectorSummaryEnvelope(input: {
  outbox: ConnectorOutboxRecord;
  createdAt: string;
}): Record<string, unknown> {
  return {
    deliveryId: input.outbox.id,
    event: input.outbox.eventType,
    createdAt: input.createdAt,
    data: {
      resourceType: input.outbox.resourceType,
      resourceId: input.outbox.resourceId,
      payloadSummary: input.outbox.payloadSummary,
    },
  };
}

function signConnectorBody(input: { body: string; timestamp: string; secret: string }): string {
  return createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.body}`)
    .digest("hex");
}

async function defaultConnectorDeliverer(
  request: ConnectorDeliveryRequest,
): Promise<ConnectorDeliveryResponse> {
  const destination = validateOutboundWebhookDestination(request.url);
  if (!destination.ok) {
    throw new Error(`Connector destination rejected: ${destination.reason}`);
  }
  const url = new URL(destination.normalizedUrl);
  const guardedLookup: LookupFunction = (hostname, options, callback) => {
    dnsLookup(hostname, {
      all: true,
      family: options.family === 4 || options.family === 6 ? options.family : 0,
      verbatim: true,
    }).then(
      (records) => {
        const blocked = records.some((record) => isDeniedOutboundWebhookAddress(record.address));
        const selected = records.find((record) => !isDeniedOutboundWebhookAddress(record.address));
        if (!selected || blocked) {
          const error = new Error(
            "Connector destination failed socket DNS guardrail validation",
          ) as NodeJS.ErrnoException;
          error.code = blocked ? "PRIVATE_NETWORK_DENIED" : "DNS_RESOLUTION_FAILED";
          callback(error, "", 0);
          return;
        }
        callback(null, selected.address, selected.family);
      },
      (error: NodeJS.ErrnoException) => callback(error, "", 0),
    );
  };

  return await new Promise<ConnectorDeliveryResponse>((resolve, reject) => {
    const outgoing = httpsRequest(
      url,
      {
        method: "POST",
        headers: request.headers,
        lookup: guardedLookup,
      },
      (response) => {
        response.on("error", reject);
        response.on("end", () => resolve({ status: response.statusCode ?? 0 }));
        response.resume();
      },
    );
    outgoing.on("error", reject);
    outgoing.setTimeout(15_000, () => {
      outgoing.destroy(new Error("Connector delivery timed out"));
    });
    outgoing.end(request.body);
  });
}

async function defaultConnectorDnsResolver(hostname: string): Promise<string[]> {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

async function validateConnectorDestinationDns(input: {
  host: string;
  resolver: ConnectorDnsResolver;
}): Promise<
  { ok: true } | { ok: false; reason: "dns_resolution_failed" | "private_network_denied" }
> {
  try {
    const addresses = await input.resolver(input.host);
    if (addresses.length === 0) return { ok: false, reason: "dns_resolution_failed" };
    if (addresses.some((address) => isDeniedOutboundWebhookAddress(address))) {
      return { ok: false, reason: "private_network_denied" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "dns_resolution_failed" };
  }
}

async function processConnectorJob(input: {
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
  connectorSecretResolver?: ConnectorSecretResolver;
  connectorHttpDeliverer?: ConnectorHttpDeliverer;
  connectorDnsResolver?: ConnectorDnsResolver;
  connectorJobQueue?: WorkerJobQueue;
}): Promise<WorkerJobResult> {
  const { data, repository } = input;
  const metadata = data.metadata ?? {};
  const now = new Date().toISOString();
  const leaseId = crypto.randomUUID();
  const leasedUntil = new Date(Date.parse(now) + connectorLeaseMs(metadata)).toISOString();
  const leased = await repository.leaseConnectorOutbox({
    firmId: data.firmId,
    leaseId,
    leasedUntil,
    now,
    limit: connectorBatchSize(metadata),
  });
  const deliveredIds: string[] = [];
  const failedIds: string[] = [];
  const deadLetterIds: string[] = [];
  const retryableFailures: ConnectorOutboxRecord[] = [];

  for (const item of leased) {
    const settled = await deliverConnectorOutbox({
      ...item,
      repository,
      secretResolver: input.connectorSecretResolver,
      dnsResolver: input.connectorDnsResolver ?? defaultConnectorDnsResolver,
      deliverer: input.connectorHttpDeliverer ?? defaultConnectorDeliverer,
    });
    if (settled.status === "delivered") deliveredIds.push(item.outbox.id);
    if (settled.status === "failed") {
      failedIds.push(item.outbox.id);
      retryableFailures.push(settled.outbox);
    }
    if (settled.status === "dead_letter") deadLetterIds.push(item.outbox.id);
  }
  const retryScheduleResults = await scheduleConnectorRetryJobs({
    repository,
    connectorJobQueue: input.connectorJobQueue,
    firmId: data.firmId,
    retryableFailures,
    now: new Date().toISOString(),
  });

  return {
    status: "completed",
    metadata: {
      firmId: data.firmId,
      leasedCount: leased.length,
      deliveredCount: deliveredIds.length,
      failedCount: failedIds.length,
      deadLetterCount: deadLetterIds.length,
      retryScheduledCount: retryScheduleResults.scheduled,
      retryScheduleFailedCount: retryScheduleResults.failed,
      deliveredIds,
      failedIds,
      deadLetterIds,
    },
  };
}

async function deliverConnectorOutbox(input: {
  connector: Awaited<
    ReturnType<OpenPracticeRepository["leaseConnectorOutbox"]>
  >[number]["connector"];
  outbox: Awaited<ReturnType<OpenPracticeRepository["leaseConnectorOutbox"]>>[number]["outbox"];
  attempt: Awaited<ReturnType<OpenPracticeRepository["leaseConnectorOutbox"]>>[number]["attempt"];
  repository: OpenPracticeRepository;
  secretResolver?: ConnectorSecretResolver;
  dnsResolver: ConnectorDnsResolver;
  deliverer: ConnectorHttpDeliverer;
}): Promise<{ status: "delivered" | "failed" | "dead_letter"; outbox: ConnectorOutboxRecord }> {
  const now = new Date().toISOString();
  const destinationUrl = connectorDestinationUrl(input.connector.configSummary);
  const destination = destinationUrl
    ? validateOutboundWebhookDestination(destinationUrl)
    : { ok: false as const, reason: "invalid_url" as const };
  const baseMetadata = {
    eventType: input.outbox.eventType,
    resourceType: input.outbox.resourceType,
    resourceId: input.outbox.resourceId,
    attemptNumber: input.attempt.attemptNumber,
  };

  if (!allowedConnectorEvents.has(input.outbox.eventType)) {
    const result = await input.repository.recordConnectorDeliveryResult({
      firmId: input.outbox.firmId,
      connectorId: input.outbox.connectorId,
      outboxId: input.outbox.id,
      attemptId: input.attempt.id,
      leaseId: input.attempt.leaseId ?? "",
      status: "failed",
      occurredAt: now,
      terminal: true,
      errorSummary: "Connector event type is not allowlisted",
      metadata: { ...baseMetadata, reason: "event_not_allowlisted" },
    });
    return { status: "dead_letter", outbox: result.outbox };
  }

  if (!destination.ok) {
    const result = await input.repository.recordConnectorDeliveryResult({
      firmId: input.outbox.firmId,
      connectorId: input.outbox.connectorId,
      outboxId: input.outbox.id,
      attemptId: input.attempt.id,
      leaseId: input.attempt.leaseId ?? "",
      status: "failed",
      occurredAt: now,
      terminal: true,
      errorSummary: "Connector destination failed HTTPS guardrail validation",
      metadata: { ...baseMetadata, reason: destination.reason },
    });
    return { status: "dead_letter", outbox: result.outbox };
  }

  const dnsValidation = await validateConnectorDestinationDns({
    host: destination.host,
    resolver: input.dnsResolver,
  });
  if (!dnsValidation.ok) {
    const result = await input.repository.recordConnectorDeliveryResult({
      firmId: input.outbox.firmId,
      connectorId: input.outbox.connectorId,
      outboxId: input.outbox.id,
      attemptId: input.attempt.id,
      leaseId: input.attempt.leaseId ?? "",
      status: "failed",
      occurredAt: now,
      terminal: true,
      errorSummary: "Connector destination failed DNS guardrail validation",
      metadata: {
        ...baseMetadata,
        destinationScheme: destination.scheme,
        destinationHost: destination.host,
        destinationPort: destination.port,
        reason: dnsValidation.reason,
      },
    });
    return { status: "dead_letter", outbox: result.outbox };
  }

  const secretReferenceId = input.connector.secretReference?.id;
  const secret = secretReferenceId ? input.secretResolver?.(secretReferenceId) : undefined;
  if (!secret) {
    const result = await input.repository.recordConnectorDeliveryResult({
      firmId: input.outbox.firmId,
      connectorId: input.outbox.connectorId,
      outboxId: input.outbox.id,
      attemptId: input.attempt.id,
      leaseId: input.attempt.leaseId ?? "",
      status: "failed",
      occurredAt: now,
      terminal: true,
      errorSummary: "Connector signing secret is not configured",
      metadata: {
        ...baseMetadata,
        destinationScheme: destination.scheme,
        destinationHost: destination.host,
        destinationPort: destination.port,
        reason: "secret_not_configured",
        secretReferencePresent: Boolean(secretReferenceId),
      },
    });
    return { status: "dead_letter", outbox: result.outbox };
  }

  const envelope = connectorSummaryEnvelope({ outbox: input.outbox, createdAt: now });
  const body = JSON.stringify(envelope);
  const timestamp = now;
  const signature = signConnectorBody({ body, timestamp, secret });
  const deliveryMetadata = {
    ...baseMetadata,
    destinationScheme: destination.scheme,
    destinationHost: destination.host,
    destinationPort: destination.port,
    signingAlgorithm: "hmac-sha256",
  };

  try {
    const response = await input.deliverer({
      url: destination.normalizedUrl,
      body,
      headers: {
        "content-type": "application/json",
        "x-open-practice-delivery-id": input.outbox.id,
        "x-open-practice-event": input.outbox.eventType,
        "x-open-practice-timestamp": timestamp,
        "x-open-practice-signature": signature,
      },
    });
    if (response.status >= 200 && response.status < 300) {
      const result = await input.repository.recordConnectorDeliveryResult({
        firmId: input.outbox.firmId,
        connectorId: input.outbox.connectorId,
        outboxId: input.outbox.id,
        attemptId: input.attempt.id,
        leaseId: input.attempt.leaseId ?? "",
        status: "delivered",
        occurredAt: now,
        metadata: { ...deliveryMetadata, httpStatus: response.status, responseClass: "2xx" },
      });
      return { status: "delivered", outbox: result.outbox };
    }

    const terminal =
      response.status >= 400 && response.status < 500
        ? true
        : input.attempt.attemptNumber >= input.outbox.maxAttempts;
    const result = await input.repository.recordConnectorDeliveryResult({
      firmId: input.outbox.firmId,
      connectorId: input.outbox.connectorId,
      outboxId: input.outbox.id,
      attemptId: input.attempt.id,
      leaseId: input.attempt.leaseId ?? "",
      status: "failed",
      occurredAt: now,
      terminal,
      nextAttemptAt: terminal ? undefined : connectorRetryAt(input.attempt.attemptNumber, now),
      errorSummary: `Connector delivery failed with HTTP ${response.status}`,
      metadata: {
        ...deliveryMetadata,
        httpStatus: response.status,
        responseClass: responseClass(response.status),
      },
    });
    return { status: terminal ? "dead_letter" : "failed", outbox: result.outbox };
  } catch (error) {
    const terminal = input.attempt.attemptNumber >= input.outbox.maxAttempts;
    const result = await input.repository.recordConnectorDeliveryResult({
      firmId: input.outbox.firmId,
      connectorId: input.outbox.connectorId,
      outboxId: input.outbox.id,
      attemptId: input.attempt.id,
      leaseId: input.attempt.leaseId ?? "",
      status: "failed",
      occurredAt: now,
      terminal,
      nextAttemptAt: terminal ? undefined : connectorRetryAt(input.attempt.attemptNumber, now),
      errorSummary: errorSummary(
        error instanceof Error ? error.message : "Connector delivery failed",
      ),
      metadata: { ...deliveryMetadata, reason: "network_or_provider_error" },
    });
    return { status: terminal ? "dead_letter" : "failed", outbox: result.outbox };
  }
}

function connectorRetryDelay(nextAttemptAt: string | undefined, now: string): number | undefined {
  if (!nextAttemptAt) return undefined;
  const delay = Date.parse(nextAttemptAt) - Date.parse(now);
  return Number.isFinite(delay) && delay > 0 ? delay : undefined;
}

async function scheduleConnectorRetryJobs(input: {
  repository: OpenPracticeRepository;
  connectorJobQueue?: WorkerJobQueue;
  firmId: string;
  retryableFailures: ConnectorOutboxRecord[];
  now: string;
}): Promise<{ scheduled: number; failed: number }> {
  if (!input.connectorJobQueue || input.retryableFailures.length === 0) {
    return { scheduled: 0, failed: 0 };
  }

  let scheduled = 0;
  let failed = 0;
  for (const outbox of input.retryableFailures) {
    if (!outbox.nextAttemptAt) continue;
    const jobId = crypto.randomUUID();
    const metadata = {
      resourceType: "connector_outbox",
      resourceId: outbox.id,
      eventCount: 1,
      attemptNumber: outbox.attemptCount,
      maxAttempts: outbox.maxAttempts,
      nextRetryAt: outbox.nextAttemptAt,
      idempotencyKeyPresent: Boolean(outbox.idempotencyKey),
    };
    const job = await input.repository.createJobLifecycleRecord({
      id: jobId,
      firmId: input.firmId,
      queueName: "connectors",
      jobName: CONNECTOR_DELIVERY_JOB_NAME,
      status: "queued",
      targetResourceType: "connector_outbox",
      targetResourceId: outbox.id,
      idempotencyKey: [
        "job",
        input.firmId,
        "connector_outbox",
        outbox.id,
        "connectors.retry",
        outbox.attemptCount,
      ].join(":"),
      attemptsMade: 0,
      maxAttempts: CONNECTOR_JOB_MAX_ATTEMPTS,
      queuedAt: input.now,
      metadata,
    });
    if (job.id !== jobId) continue;
    try {
      const delay = connectorRetryDelay(outbox.nextAttemptAt, input.now);
      const bullJob = await input.connectorJobQueue.add(
        CONNECTOR_DELIVERY_JOB_NAME,
        {
          firmId: input.firmId,
          resourceType: "connector_outbox",
          resourceId: outbox.id,
          metadata,
        },
        delay === undefined ? { jobId } : { jobId, delay },
      );
      await input.repository.updateJobLifecycleRecord(input.firmId, job.id, {
        bullJobId: bullJob.id === undefined ? undefined : String(bullJob.id),
      });
      scheduled += 1;
    } catch (error) {
      failed += 1;
      await input.repository.updateJobLifecycleRecord(input.firmId, job.id, {
        status: "failed",
        attemptsMade: 1,
        failedAt: input.now,
        errorMessage: error instanceof Error ? error.message : "Connector retry enqueue failed",
        metadata: { ...metadata, enqueueStatus: "failed" },
      });
    }
  }
  return { scheduled, failed };
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

async function processEmailJob(input: {
  data: WorkerJobEnvelope;
  jobLifecycleId?: string;
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
  const attemptMetadata = {
    provider: email.metadata.provider,
    templateKey: email.templateKey,
    maxAttempts,
  };
  await repository.recordEmailDeliveryResult({
    firmId: data.firmId,
    emailId,
    status: "sending",
    occurredAt: new Date().toISOString(),
    attemptNumber,
    jobId: input.jobLifecycleId,
    source: "worker",
    metadata: attemptMetadata,
  });

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
    const terminal = attemptNumber >= maxAttempts;
    await repository.recordEmailDeliveryResult({
      firmId: data.firmId,
      emailId,
      status: "failed",
      occurredAt: new Date().toISOString(),
      attemptNumber,
      jobId: input.jobLifecycleId,
      source: "worker",
      terminal,
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        ...attemptMetadata,
        terminal,
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
    attemptNumber,
    jobId: input.jobLifecycleId,
    source: "worker",
    terminal: true,
    metadata: {
      ...attemptMetadata,
      terminal: true,
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
  const rawLanguage = typeof data.metadata?.language === "string" ? data.metadata.language : "";
  const language = isAllowedOcrLanguage(rawLanguage.trim()) ? rawLanguage.trim() : "eng";
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
