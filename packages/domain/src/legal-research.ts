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

export interface LegalResearchWorkspace {
  matterId: string;
  artifacts: LegalResearchArtifactRecord[];
  summary: LegalResearchWorkspaceSummary;
  policy: LegalResearchWorkspacePolicy;
  provider: {
    status: "disabled";
    reason: "not_configured";
    liveResearchProvider: false;
  };
}

const artifactKindSet = new Set<string>(legalResearchArtifactKinds);
const artifactStatusSet = new Set<string>(legalResearchArtifactStatuses);
const reviewDecisionSet = new Set<string>(legalResearchReviewDecisions);
const sourceTypeSet = new Set<string>(legalResearchSourceTypes);
const maxNoteLength = 4000;

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
    titleLength: record.title.length,
    noteLength: record.note?.length ?? 0,
    createdByUserId: record.createdByUserId,
    reviewedByUserId: record.reviewedByUserId,
    reviewOnly: record.reviewOnly,
  };
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

export function buildLegalResearchWorkspace(input: {
  matterId: string;
  artifacts: LegalResearchArtifactRecord[];
}): LegalResearchWorkspace {
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
    provider: {
      status: "disabled",
      reason: "not_configured",
      liveResearchProvider: false,
    },
  };
}
