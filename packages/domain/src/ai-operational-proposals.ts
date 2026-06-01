export const aiOperationalProposalKinds = [
  "deadline_extraction",
  "task_creation",
  "document_organization",
  "draft_invoice_cue",
  "client_update_draft",
] as const;

export type AiOperationalProposalKind = (typeof aiOperationalProposalKinds)[number];

export const aiOperationalProposalStatuses = ["proposed", "approved", "rejected"] as const;
export type AiOperationalProposalStatus = (typeof aiOperationalProposalStatuses)[number];

export const aiOperationalProposalReviewDecisions = ["approved", "rejected"] as const;
export type AiOperationalProposalReviewDecision =
  (typeof aiOperationalProposalReviewDecisions)[number];

export const aiOperationalProposalSourceTypes = ["draft", "document"] as const;
export type AiOperationalProposalSourceType = (typeof aiOperationalProposalSourceTypes)[number];

export interface AiOperationalProposalSourceContext {
  sourceType: AiOperationalProposalSourceType;
  draftId?: string;
  documentId?: string;
  sourceLabel?: string;
  sourceTextLength: number;
  confidence?: "low" | "medium" | "high";
}

export interface AiOperationalProposalPayload {
  title: string;
  summary: string;
  proposedAction: string;
  details?: string;
  deadline?: {
    suggestedDueAt?: string;
    sourceCue?: string;
  };
  task?: {
    title?: string;
    suggestedAssigneeUserId?: string;
    suggestedDueAt?: string;
  };
  documentOrganization?: {
    category?: string;
    suggestedFolder?: string;
  };
  invoiceCue?: {
    cueType?: "time" | "expense" | "payment" | "review";
    amountCents?: number;
  };
  clientUpdate?: {
    tone?: "neutral" | "reassuring" | "urgent";
    audience?: "client" | "internal";
  };
}

export interface AiOperationalProposalRecord {
  id: string;
  firmId: string;
  matterId: string;
  kind: AiOperationalProposalKind;
  status: AiOperationalProposalStatus;
  source: AiOperationalProposalSourceContext;
  providerKey: string;
  providerModel: string;
  proposal: AiOperationalProposalPayload;
  reviewDecision?: AiOperationalProposalReviewDecision;
  reviewedByUserId?: string;
  reviewedAt?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface AiOperationalProposalRequest {
  firmId: string;
  matterId: string;
  sourceType: AiOperationalProposalSourceType;
  draftId?: string;
  documentId?: string;
  sourceLabel?: string;
  sourceText: string;
  requestedKinds: AiOperationalProposalKind[];
  metadata?: Record<string, unknown>;
}

export interface AiOperationalProposalProviderSuggestion {
  kind: AiOperationalProposalKind;
  proposal: AiOperationalProposalPayload;
  metadata?: Record<string, unknown>;
}

export interface AiOperationalProposalProviderResult {
  providerKey: string;
  providerModel: string;
  proposals: AiOperationalProposalProviderSuggestion[];
}

export interface AiOperationalProposalProvider {
  createOperationalProposals(
    request: AiOperationalProposalRequest,
  ): Promise<AiOperationalProposalProviderResult>;
}

export interface AiOperationalProposalSummary {
  total: number;
  proposed: number;
  approved: number;
  rejected: number;
  byKind: Record<AiOperationalProposalKind, number>;
  statusOnlyReview: true;
}

const proposalKindSet = new Set<string>(aiOperationalProposalKinds);
const proposalStatusSet = new Set<string>(aiOperationalProposalStatuses);
const proposalReviewDecisionSet = new Set<string>(aiOperationalProposalReviewDecisions);
const proposalSourceTypeSet = new Set<string>(aiOperationalProposalSourceTypes);

export function assertAiOperationalProposalKind(
  value: string,
): asserts value is AiOperationalProposalKind {
  if (!proposalKindSet.has(value)) {
    throw new Error(`Unsupported AI operational proposal kind: ${value}`);
  }
}

export function assertAiOperationalProposalKinds(
  values: string[],
): asserts values is AiOperationalProposalKind[] {
  if (values.length === 0) {
    throw new Error("At least one AI operational proposal kind is required");
  }
  for (const value of values) assertAiOperationalProposalKind(value);
}

export function reviewAiOperationalProposalRecord(input: {
  record: AiOperationalProposalRecord;
  decision: AiOperationalProposalReviewDecision;
  reviewedByUserId: string;
  reviewedAt: string;
}): AiOperationalProposalRecord {
  if (!proposalReviewDecisionSet.has(input.decision)) {
    throw new Error(`Unsupported AI operational proposal review decision: ${input.decision}`);
  }
  return {
    ...input.record,
    status: input.decision,
    reviewDecision: input.decision,
    reviewedByUserId: input.reviewedByUserId,
    reviewedAt: input.reviewedAt,
    updatedAt: input.reviewedAt,
  };
}

export function validateAiOperationalProposalRecord(record: AiOperationalProposalRecord): void {
  if (!record.id.trim()) throw new Error("AI operational proposal id is required");
  if (!record.firmId.trim()) throw new Error("AI operational proposal firm id is required");
  if (!record.matterId.trim()) throw new Error("AI operational proposal matter id is required");
  if (!proposalKindSet.has(record.kind)) {
    throw new Error(`Unsupported AI operational proposal kind: ${record.kind}`);
  }
  if (!proposalStatusSet.has(record.status)) {
    throw new Error(`Unsupported AI operational proposal status: ${record.status}`);
  }
  if (!proposalSourceTypeSet.has(record.source.sourceType)) {
    throw new Error(`Unsupported AI operational proposal source type: ${record.source.sourceType}`);
  }
  if (record.source.sourceType === "draft" && !record.source.draftId) {
    throw new Error("Draft-sourced AI operational proposals require draftId");
  }
  if (record.source.sourceType === "document" && !record.source.documentId) {
    throw new Error("Document-sourced AI operational proposals require documentId");
  }
  if (!Number.isInteger(record.source.sourceTextLength) || record.source.sourceTextLength < 0) {
    throw new Error("AI operational proposal source text length must be a non-negative integer");
  }
  if (!record.providerKey.trim()) {
    throw new Error("AI operational proposal provider key is required");
  }
  if (!record.providerModel.trim()) {
    throw new Error("AI operational proposal provider model is required");
  }
  if (!record.proposal.title.trim()) {
    throw new Error("AI operational proposal title is required");
  }
  if (!record.proposal.summary.trim()) {
    throw new Error("AI operational proposal summary is required");
  }
  if (!record.proposal.proposedAction.trim()) {
    throw new Error("AI operational proposal proposed action is required");
  }
  if (record.status === "proposed") {
    if (record.reviewDecision || record.reviewedByUserId || record.reviewedAt) {
      throw new Error("Proposed AI operational proposals cannot include review metadata");
    }
  } else {
    if (record.reviewDecision !== record.status || !record.reviewedByUserId || !record.reviewedAt) {
      throw new Error("Reviewed AI operational proposals require matching review metadata");
    }
  }
  if (Number.isNaN(Date.parse(record.createdAt)) || Number.isNaN(Date.parse(record.updatedAt))) {
    throw new Error("AI operational proposal timestamps must be ISO-compatible");
  }
}

export function buildAiOperationalProposalAuditMetadata(
  record: AiOperationalProposalRecord,
): Record<string, unknown> {
  return {
    matterId: record.matterId,
    proposalId: record.id,
    proposalKind: record.kind,
    status: record.status,
    decision: record.reviewDecision,
    sourceType: record.source.sourceType,
    draftId: record.source.draftId,
    documentId: record.source.documentId,
    provider: record.providerKey,
    model: record.providerModel,
    createdByUserId: record.createdByUserId,
    reviewedByUserId: record.reviewedByUserId,
    sourceTextLength: record.source.sourceTextLength,
    proposalTitleLength: record.proposal.title.length,
    proposalSummaryLength: record.proposal.summary.length,
  };
}

export function summarizeAiOperationalProposals(
  records: AiOperationalProposalRecord[],
): AiOperationalProposalSummary {
  const byKind = Object.fromEntries(aiOperationalProposalKinds.map((kind) => [kind, 0])) as Record<
    AiOperationalProposalKind,
    number
  >;
  let proposed = 0;
  let approved = 0;
  let rejected = 0;

  for (const record of records) {
    byKind[record.kind] += 1;
    if (record.status === "approved") approved += 1;
    else if (record.status === "rejected") rejected += 1;
    else proposed += 1;
  }

  return {
    total: records.length,
    proposed,
    approved,
    rejected,
    byKind,
    statusOnlyReview: true,
  };
}
