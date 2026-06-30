import type { JobLifecycleRecord, OpenPracticeJobStatus } from "./operations.js";

export const legalResearchArtifactKinds = [
  "cited_source_note",
  "matter_context_attachment",
  "document_analysis_status",
  "strategy_timeline_note",
  "review_checkpoint",
] as const;

export type LegalResearchArtifactKind = (typeof legalResearchArtifactKinds)[number];

export const legalResearchArtifactStatuses = [
  "draft",
  "ready_for_review",
  "reviewed",
  "rejected",
] as const;

export type LegalResearchArtifactStatus = (typeof legalResearchArtifactStatuses)[number];

export const legalResearchReviewDecisions = ["reviewed", "rejected"] as const;
export type LegalResearchReviewDecision = (typeof legalResearchReviewDecisions)[number];

export const legalResearchProviderJobName = "legal_research_provider_review" as const;

export const legalResearchProviderJobRequestTypes = ["citation_review"] as const;
export type LegalResearchProviderJobRequestType =
  (typeof legalResearchProviderJobRequestTypes)[number];

export const legalResearchSourceTypes = [
  "case_law",
  "statute",
  "regulation",
  "policy",
  "secondary_source",
  "internal_note",
  "unknown",
] as const;

export type LegalResearchSourceType = (typeof legalResearchSourceTypes)[number];

export interface LegalResearchSourceReference {
  sourceType: LegalResearchSourceType;
  label: string;
  jurisdiction?: string;
  staffCitationLabel?: string;
  locator?: string;
}

export type LegalResearchContextResourceType =
  | "matter"
  | "document"
  | "legal_research_artifact"
  | "draft"
  | "contact"
  | "task"
  | "calendar_event"
  | "intake_session";

export interface LegalResearchContextLink {
  resourceType: LegalResearchContextResourceType;
  resourceId: string;
  label?: string;
}

export interface LegalResearchDocumentAnalysis {
  documentId: string;
  status: "not_started" | "in_review" | "ready_for_review" | "blocked";
  extractionStatus?: "not_requested" | "pending" | "completed" | "failed";
  artifactStatus?: "metadata_only" | "summary_available";
  sourceTextLength?: number;
}

export interface LegalResearchTimelineNote {
  noteType: "strategy" | "timeline" | "issue" | "next_step";
  eventDate?: string;
  dueAt?: string;
}

export interface LegalResearchCheckpoint {
  checkpointType:
    | "source_review"
    | "matter_context"
    | "document_analysis"
    | "strategy_review"
    | "supervising_lawyer_review";
  assignedUserId?: string;
  dueAt?: string;
}

export interface LegalResearchArtifactRecord {
  id: string;
  firmId: string;
  matterId: string;
  kind: LegalResearchArtifactKind;
  status: LegalResearchArtifactStatus;
  title: string;
  note?: string;
  sourceReferences: LegalResearchSourceReference[];
  contextLinks: LegalResearchContextLink[];
  documentAnalysis?: LegalResearchDocumentAnalysis;
  timeline?: LegalResearchTimelineNote;
  checkpoint?: LegalResearchCheckpoint;
  reviewDecision?: LegalResearchReviewDecision;
  reviewedByUserId?: string;
  reviewedAt?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  reviewOnly: true;
  metadata: Record<string, unknown>;
}

export interface LegalResearchWorkspaceSummary {
  total: number;
  draft: number;
  readyForReview: number;
  reviewed: number;
  rejected: number;
  sourceReferenceCount: number;
  contextLinkCount: number;
  documentAnalysisCount: number;
  strategyTimelineCount: number;
  openCheckpointCount: number;
  byKind: Record<LegalResearchArtifactKind, number>;
  reviewOnly: true;
}

export interface LegalResearchWorkspacePolicy {
  liveResearchProvider: false;
  scrapedAuthorityStorage: false;
  automatedLegalAdvice: false;
  citationVerificationClaims: false;
  downstreamMutation: false;
}

export interface LegalResearchCitationReviewControls {
  staffReviewRequired: true;
  citationVerificationClaims: false;
  providerEvidenceStored: false;
  sourceTextSubmittedToProvider: false;
  promptSubmittedToProvider: false;
  downstreamMutation: false;
  reviewOnly: true;
}

export interface LegalResearchProviderJobBoundary {
  queueName: "ai_triage";
  jobName: typeof legalResearchProviderJobName;
  status: "reserved";
  reason: "deferred_worker";
  providerConfigured: false;
  liveResearchProvider: false;
  reviewOnly: true;
}

export interface LegalResearchProviderJobRecord {
  id: string;
  queueName: "ai_triage";
  jobName: typeof legalResearchProviderJobName;
  status: OpenPracticeJobStatus;
  bullJobId?: string;
  targetResourceType?: string;
  targetResourceId?: string;
  queuedAt: string;
  finishedAt?: string;
  failedAt?: string;
  terminal: boolean;
  idempotencyKeyPresent: boolean;
  metadata: Record<string, unknown>;
}

export interface LegalResearchProviderJobSummary {
  total: number;
  queued: number;
  active: number;
  completed: number;
  skipped: number;
  failed: number;
  deadLetter: number;
  latestQueuedAt?: string;
  reviewOnly: true;
}

export type LegalResearchCitationPacketReadinessBlockedReason =
  | "no_source_references"
  | "no_ready_for_review_artifacts"
  | "open_checkpoints";

export interface LegalResearchCitationPacketReadiness {
  sourceReferenceCount: number;
  sourceReferenceCountsByType: Record<LegalResearchSourceType, number>;
  readyForReviewArtifactCount: number;
  readyForReviewArtifactIds: string[];
  openCheckpointCount: number;
  openCheckpointArtifactIds: string[];
  contextLinkCount: number;
  contextLinkCountsByType: Record<LegalResearchContextResourceType, number>;
  staffReviewReady: boolean;
  blockedReasons: LegalResearchCitationPacketReadinessBlockedReason[];
  reservedProviderJobPosture: "reserved_no_provider_execution";
  providerExecuted: false;
  authorityScraped: false;
  sourceTextStored: false;
  promptStored: false;
  providerEvidenceStored: false;
  citationVerificationClaimed: false;
  legalAdviceGenerated: false;
  downstreamMutation: false;
  reviewOnly: true;
}

export interface LegalResearchWorkspace {
  matterId: string;
  artifacts: LegalResearchArtifactRecord[];
  summary: LegalResearchWorkspaceSummary;
  policy: LegalResearchWorkspacePolicy;
  citationReview: LegalResearchCitationReviewControls;
  provider: {
    status: "disabled";
    reason: "not_configured";
    liveResearchProvider: false;
  };
  providerJobBoundary: LegalResearchProviderJobBoundary;
  providerJobs: LegalResearchProviderJobRecord[];
  providerJobSummary: LegalResearchProviderJobSummary;
  citationPacketReadiness: LegalResearchCitationPacketReadiness;
}

export interface DocumentConversionSemanticReviewCheckpointMetadataInput {
  matterId: string;
  documentId: string;
  conversionReviewArtifactId: string;
  jobId?: string;
  sourceTextLength?: number;
  wordCount?: number;
  lineCount?: number;
  nonEmptyLineCount?: number;
  pageBreakCount?: number;
  estimatedPageCount?: number;
  conversionReviewStatus: string;
  artifactStatus: string;
  createdByUserId: string;
  assignedUserId: string;
  createdAt: string;
  conversionReviewReviewedAt?: string;
  conversionReviewReviewedByUserId?: string;
}

const artifactKindSet = new Set<string>(legalResearchArtifactKinds);
const artifactStatusSet = new Set<string>(legalResearchArtifactStatuses);
const reviewDecisionSet = new Set<string>(legalResearchReviewDecisions);
const sourceTypeSet = new Set<string>(legalResearchSourceTypes);
const providerJobRequestTypeSet = new Set<string>(legalResearchProviderJobRequestTypes);
const maxNoteLength = 4000;
const legalResearchContextResourceTypes = [
  "matter",
  "document",
  "draft",
  "contact",
  "task",
  "calendar_event",
  "intake_session",
] as const satisfies LegalResearchContextResourceType[];

function compactRecord(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function safeNonNegativeInteger(value: number | undefined): number | undefined {
  if (typeof value !== "number") return undefined;
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function assertLegalResearchArtifactKind(
  value: string,
): asserts value is LegalResearchArtifactKind {
  if (!artifactKindSet.has(value)) {
    throw new Error(`Unsupported legal research artifact kind: ${value}`);
  }
}

export function assertLegalResearchArtifactStatus(
  value: string,
): asserts value is LegalResearchArtifactStatus {
  if (!artifactStatusSet.has(value)) {
    throw new Error(`Unsupported legal research artifact status: ${value}`);
  }
}

export function assertLegalResearchProviderJobRequestType(
  value: string,
): asserts value is LegalResearchProviderJobRequestType {
  if (!providerJobRequestTypeSet.has(value)) {
    throw new Error(`Unsupported legal research provider job request type: ${value}`);
  }
}

export function reviewLegalResearchArtifactRecord(input: {
  record: LegalResearchArtifactRecord;
  decision: LegalResearchReviewDecision;
  reviewedByUserId: string;
  reviewedAt: string;
}): LegalResearchArtifactRecord {
  if (!reviewDecisionSet.has(input.decision)) {
    throw new Error(`Unsupported legal research review decision: ${input.decision}`);
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

export function validateLegalResearchArtifactRecord(record: LegalResearchArtifactRecord): void {
  if (!record.id.trim()) throw new Error("Legal research artifact id is required");
  if (!record.firmId.trim()) throw new Error("Legal research artifact firm id is required");
  if (!record.matterId.trim()) throw new Error("Legal research artifact matter id is required");
  if (!artifactKindSet.has(record.kind)) {
    throw new Error(`Unsupported legal research artifact kind: ${record.kind}`);
  }
  if (!artifactStatusSet.has(record.status)) {
    throw new Error(`Unsupported legal research artifact status: ${record.status}`);
  }
  if (!record.title.trim()) throw new Error("Legal research artifact title is required");
  if (record.note && record.note.length > maxNoteLength) {
    throw new Error(`Legal research artifact note must be ${maxNoteLength} characters or fewer`);
  }
  if (record.reviewOnly !== true) {
    throw new Error("Legal research artifacts are review-only records");
  }
  for (const source of record.sourceReferences) {
    if (!sourceTypeSet.has(source.sourceType)) {
      throw new Error(`Unsupported legal research source type: ${source.sourceType}`);
    }
    if (!source.label.trim()) throw new Error("Legal research source labels are required");
  }
  for (const link of record.contextLinks) {
    if (!link.resourceId.trim()) throw new Error("Legal research context resource id is required");
  }
  if (record.documentAnalysis) {
    if (!record.documentAnalysis.documentId.trim()) {
      throw new Error("Legal research document analysis requires documentId");
    }
    if (
      record.documentAnalysis.sourceTextLength !== undefined &&
      (!Number.isInteger(record.documentAnalysis.sourceTextLength) ||
        record.documentAnalysis.sourceTextLength < 0)
    ) {
      throw new Error("Legal research source text length must be a non-negative integer");
    }
  }
  if (record.status === "reviewed" || record.status === "rejected") {
    if (record.reviewDecision !== record.status || !record.reviewedByUserId || !record.reviewedAt) {
      throw new Error("Reviewed legal research artifacts require matching review metadata");
    }
  } else if (record.reviewDecision || record.reviewedByUserId || record.reviewedAt) {
    throw new Error("Unreviewed legal research artifacts cannot include review metadata");
  }
  if (Number.isNaN(Date.parse(record.createdAt)) || Number.isNaN(Date.parse(record.updatedAt))) {
    throw new Error("Legal research artifact timestamps must be ISO-compatible");
  }
}

export function buildLegalResearchArtifactAuditMetadata(
  record: LegalResearchArtifactRecord,
): Record<string, unknown> {
  return {
    matterId: record.matterId,
    artifactId: record.id,
    artifactKind: record.kind,
    status: record.status,
    decision: record.reviewDecision,
    sourceReferenceCount: record.sourceReferences.length,
    sourceTypes: [...new Set(record.sourceReferences.map((source) => source.sourceType))],
    contextLinkCount: record.contextLinks.length,
    documentId: record.documentAnalysis?.documentId,
    documentAnalysisStatus: record.documentAnalysis?.status,
    sourceTextLength: record.documentAnalysis?.sourceTextLength,
    checkpointType: record.checkpoint?.checkpointType,
    checkpointAssignedUserId: record.checkpoint?.assignedUserId,
    titleLength: record.title.length,
    noteLength: record.note?.length ?? 0,
    createdByUserId: record.createdByUserId,
    reviewedByUserId: record.reviewedByUserId,
    reviewOnly: record.reviewOnly,
  };
}

export function buildDocumentConversionSemanticReviewCheckpointMetadata(
  input: DocumentConversionSemanticReviewCheckpointMetadataInput,
): Record<string, unknown> {
  const counts = compactRecord({
    sourceTextLength: safeNonNegativeInteger(input.sourceTextLength),
    wordCount: safeNonNegativeInteger(input.wordCount),
    lineCount: safeNonNegativeInteger(input.lineCount),
    nonEmptyLineCount: safeNonNegativeInteger(input.nonEmptyLineCount),
    pageBreakCount: safeNonNegativeInteger(input.pageBreakCount),
    estimatedPageCount: safeNonNegativeInteger(input.estimatedPageCount),
  });

  return compactRecord({
    source: "document_conversion_semantic_review_checkpoint",
    matterId: input.matterId,
    documentId: input.documentId,
    conversionReviewArtifactId: input.conversionReviewArtifactId,
    jobId: input.jobId,
    counts: Object.keys(counts).length > 0 ? counts : undefined,
    conversionReviewStatus: input.conversionReviewStatus,
    artifactStatus: input.artifactStatus,
    checkpointType: "document_analysis",
    checkpointStatus: "ready_for_review",
    createdByUserId: input.createdByUserId,
    assignedUserId: input.assignedUserId,
    createdAt: input.createdAt,
    conversionReviewReviewedAt: input.conversionReviewReviewedAt,
    conversionReviewReviewedByUserId: input.conversionReviewReviewedByUserId,
    semanticReviewReady: true,
    staffReviewRequired: true,
    metadataOnly: true,
    reviewOnly: true,
    providerActivated: false,
    downstreamMutation: false,
    providerEvidenceStored: false,
    rawTextStored: false,
    rawTextReturned: false,
    rawOcrTextReturned: false,
    rawOcrTextStoredInMetadata: false,
    rawMarkdownStored: false,
    convertedMarkdownStored: false,
    annotationBodiesStored: false,
    annotationSpansStored: false,
    chunksStored: false,
    embeddingsStored: false,
    promptsStored: false,
    providerPayloadsStored: false,
    storageKeysStored: false,
    objectBodiesStored: false,
    generatedSummariesStored: false,
  });
}

export function summarizeLegalResearchArtifacts(
  records: LegalResearchArtifactRecord[],
): LegalResearchWorkspaceSummary {
  const byKind = Object.fromEntries(legalResearchArtifactKinds.map((kind) => [kind, 0])) as Record<
    LegalResearchArtifactKind,
    number
  >;
  let draft = 0;
  let readyForReview = 0;
  let reviewed = 0;
  let rejected = 0;
  let sourceReferenceCount = 0;
  let contextLinkCount = 0;
  let documentAnalysisCount = 0;
  let strategyTimelineCount = 0;
  let openCheckpointCount = 0;

  for (const record of records) {
    byKind[record.kind] += 1;
    sourceReferenceCount += record.sourceReferences.length;
    contextLinkCount += record.contextLinks.length;
    if (record.documentAnalysis) documentAnalysisCount += 1;
    if (record.timeline) strategyTimelineCount += 1;
    if (record.checkpoint && record.status !== "reviewed" && record.status !== "rejected") {
      openCheckpointCount += 1;
    }

    if (record.status === "draft") draft += 1;
    else if (record.status === "ready_for_review") readyForReview += 1;
    else if (record.status === "reviewed") reviewed += 1;
    else rejected += 1;
  }

  return {
    total: records.length,
    draft,
    readyForReview,
    reviewed,
    rejected,
    sourceReferenceCount,
    contextLinkCount,
    documentAnalysisCount,
    strategyTimelineCount,
    openCheckpointCount,
    byKind,
    reviewOnly: true,
  };
}

export function buildLegalResearchProviderJobMetadata(input: {
  matterId: string;
  requestType: LegalResearchProviderJobRequestType;
  sourceTypes?: LegalResearchSourceType[];
  citationReferenceCount?: number;
  contextLinkCount?: number;
  artifactCount?: number;
  requestedByUserId: string;
  jurisdiction?: string;
  enqueueStatus?: string;
}): Record<string, unknown> {
  const sourceTypes = [...new Set(input.sourceTypes ?? [])].join(",");
  return {
    matterId: input.matterId,
    requestType: input.requestType,
    sourceTypes,
    sourceTypeCount: sourceTypes ? sourceTypes.split(",").length : 0,
    citationReferenceCount: input.citationReferenceCount ?? 0,
    contextLinkCount: input.contextLinkCount ?? 0,
    artifactCount: input.artifactCount ?? 0,
    requestedByUserId: input.requestedByUserId,
    jurisdiction: input.jurisdiction,
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
    enqueueStatus: input.enqueueStatus,
  };
}

export function summarizeLegalResearchProviderJobs(
  jobs: LegalResearchProviderJobRecord[],
): LegalResearchProviderJobSummary {
  return {
    total: jobs.length,
    queued: jobs.filter((job) => job.status === "queued").length,
    active: jobs.filter((job) => job.status === "active").length,
    completed: jobs.filter((job) => job.status === "completed").length,
    skipped: jobs.filter((job) => job.status === "skipped").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    deadLetter: jobs.filter((job) => job.status === "dead_letter").length,
    latestQueuedAt: jobs[0]?.queuedAt,
    reviewOnly: true,
  };
}

export function buildLegalResearchCitationPacketReadiness(
  records: LegalResearchArtifactRecord[],
): LegalResearchCitationPacketReadiness {
  const sourceReferenceCountsByType = Object.fromEntries(
    legalResearchSourceTypes.map((sourceType) => [sourceType, 0]),
  ) as Record<LegalResearchSourceType, number>;
  const contextLinkCountsByType = Object.fromEntries(
    legalResearchContextResourceTypes.map((resourceType) => [resourceType, 0]),
  ) as Record<LegalResearchContextResourceType, number>;
  const readyForReviewArtifactIds: string[] = [];
  const openCheckpointArtifactIds: string[] = [];

  for (const record of records) {
    for (const source of record.sourceReferences) {
      sourceReferenceCountsByType[source.sourceType] += 1;
    }
    for (const link of record.contextLinks) {
      contextLinkCountsByType[link.resourceType] += 1;
    }
    if (record.status === "ready_for_review") {
      readyForReviewArtifactIds.push(record.id);
    }
    if (record.checkpoint && record.status !== "reviewed" && record.status !== "rejected") {
      openCheckpointArtifactIds.push(record.id);
    }
  }

  const sourceReferenceCount = records.reduce(
    (total, record) => total + record.sourceReferences.length,
    0,
  );
  const openCheckpointCount = openCheckpointArtifactIds.length;
  const readyForReviewArtifactCount = readyForReviewArtifactIds.length;
  const blockedReasons: LegalResearchCitationPacketReadinessBlockedReason[] = [];
  if (sourceReferenceCount === 0) blockedReasons.push("no_source_references");
  if (readyForReviewArtifactCount === 0) blockedReasons.push("no_ready_for_review_artifacts");
  if (openCheckpointCount > 0) blockedReasons.push("open_checkpoints");

  return {
    sourceReferenceCount,
    sourceReferenceCountsByType,
    readyForReviewArtifactCount,
    readyForReviewArtifactIds,
    openCheckpointCount,
    openCheckpointArtifactIds,
    contextLinkCount: records.reduce((total, record) => total + record.contextLinks.length, 0),
    contextLinkCountsByType,
    staffReviewReady: blockedReasons.length === 0,
    blockedReasons,
    reservedProviderJobPosture: "reserved_no_provider_execution",
    providerExecuted: false,
    authorityScraped: false,
    sourceTextStored: false,
    promptStored: false,
    providerEvidenceStored: false,
    citationVerificationClaimed: false,
    legalAdviceGenerated: false,
    downstreamMutation: false,
    reviewOnly: true,
  };
}

export function serializeLegalResearchProviderJob(
  job: JobLifecycleRecord,
  metadata: Record<string, unknown>,
): LegalResearchProviderJobRecord {
  return {
    id: job.id,
    queueName: "ai_triage",
    jobName: legalResearchProviderJobName,
    status: job.status,
    bullJobId: job.bullJobId,
    targetResourceType: job.targetResourceType,
    targetResourceId: job.targetResourceId,
    queuedAt: job.queuedAt,
    finishedAt: job.finishedAt,
    failedAt: job.failedAt,
    terminal:
      job.status === "completed" || job.status === "dead_letter" || job.status === "skipped",
    idempotencyKeyPresent: Boolean(job.idempotencyKey),
    metadata,
  };
}

export function buildLegalResearchWorkspace(input: {
  matterId: string;
  artifacts: LegalResearchArtifactRecord[];
  providerJobs?: LegalResearchProviderJobRecord[];
}): LegalResearchWorkspace {
  const providerJobs = input.providerJobs ?? [];
  return {
    matterId: input.matterId,
    artifacts: input.artifacts,
    summary: summarizeLegalResearchArtifacts(input.artifacts),
    policy: {
      liveResearchProvider: false,
      scrapedAuthorityStorage: false,
      automatedLegalAdvice: false,
      citationVerificationClaims: false,
      downstreamMutation: false,
    },
    citationReview: {
      staffReviewRequired: true,
      citationVerificationClaims: false,
      providerEvidenceStored: false,
      sourceTextSubmittedToProvider: false,
      promptSubmittedToProvider: false,
      downstreamMutation: false,
      reviewOnly: true,
    },
    provider: {
      status: "disabled",
      reason: "not_configured",
      liveResearchProvider: false,
    },
    providerJobBoundary: {
      queueName: "ai_triage",
      jobName: legalResearchProviderJobName,
      status: "reserved",
      reason: "deferred_worker",
      providerConfigured: false,
      liveResearchProvider: false,
      reviewOnly: true,
    },
    providerJobs,
    providerJobSummary: summarizeLegalResearchProviderJobs(providerJobs),
    citationPacketReadiness: buildLegalResearchCitationPacketReadiness(input.artifacts),
  };
}
