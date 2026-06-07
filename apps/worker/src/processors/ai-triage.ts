import type {
  AiOperationalProposalKind,
  AiOperationalProposalProvider,
  DocumentTextExtractionRecord,
  DraftAssistProvider,
  DraftAssistRecord,
} from "@open-practice/domain";
import {
  assertAiOperationalProposalKinds,
  assertDraftAssistTask,
  buildAiOperationalProposalAuditMetadata,
  buildDraftAssistAuditMetadata,
  extractTipTapPlainText,
  legalResearchProviderJobName,
} from "@open-practice/domain";
import type { OpenPracticeRepository } from "@open-practice/database";
import { sanitizeJobMetadata } from "../queues.js";
import { compactMetadata, metadataString } from "./metadata.js";
import type { WorkerJobEnvelope, WorkerJobResult } from "./types.js";

export async function processAiTriageJob(input: {
  jobName: string;
  data: WorkerJobEnvelope;
  jobLifecycleId?: string;
  repository: OpenPracticeRepository;
  aiOperationalProposalProvider?: AiOperationalProposalProvider;
  draftAssistProvider?: DraftAssistProvider;
}): Promise<WorkerJobResult | undefined> {
  if (input.jobName === "draft_assist_suggestion") {
    return processDraftAssistJob(input);
  }
  if (input.jobName === "operational_action_proposals") {
    return processOperationalProposalJob(input);
  }
  if (input.jobName === legalResearchProviderJobName) {
    return processLegalResearchProviderReviewJob(input);
  }
  return undefined;
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
