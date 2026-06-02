import type {
  AiOperationalProposalKind,
  AiOperationalProposalRecord,
  AiOperationalProposalSummary,
  User,
} from "@open-practice/domain";
import type { AiOperationalProposalsResponse } from "./types";

const aiOperationalProposalKinds: AiOperationalProposalKind[] = [
  "deadline_extraction",
  "task_creation",
  "document_organization",
  "draft_invoice_cue",
  "client_update_draft",
];

function summarizeAiOperationalProposalRecords(
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

export function emptyAiOperationalProposalsResponse(): AiOperationalProposalsResponse {
  return {
    proposals: [],
    summary: summarizeAiOperationalProposalRecords([]),
    generation: {
      status: "disabled",
      reason: "not_configured",
      queue: {
        queueName: "ai_triage",
        status: "reserved",
        reason: "deferred_worker",
      },
      jobName: "operational_action_proposals",
    },
  };
}

export function buildAiOperationalProposalsPath(): string {
  return "/api/ai-operational-proposals";
}

export function buildAiOperationalProposalReviewPath(proposalId: string): string {
  return `/api/ai-operational-proposals/${encodeURIComponent(proposalId)}/review`;
}

export function buildDraftOperationalProposalJobPath(draftId: string): string {
  return `/api/drafts/${encodeURIComponent(draftId)}/operational-proposals/jobs`;
}

export function buildAllDraftOperationalProposalKindsPayload(): {
  proposalKinds: AiOperationalProposalKind[];
} {
  return {
    proposalKinds: [...aiOperationalProposalKinds],
  };
}

export function canReviewAiOperationalProposals(role: User["role"]): boolean {
  return ["owner_admin", "licensee", "firm_member"].includes(role);
}

export function replaceAiOperationalProposal(
  response: AiOperationalProposalsResponse,
  updated: AiOperationalProposalRecord,
): AiOperationalProposalsResponse {
  const proposals = response.proposals.map((proposal) =>
    proposal.id === updated.id ? updated : proposal,
  );
  return {
    ...response,
    proposals,
    summary: summarizeAiOperationalProposalRecords(proposals),
  };
}

export function formatAiOperationalProposalKind(kind: AiOperationalProposalKind): string {
  return kind.replaceAll("_", " ");
}

export function describeAiOperationalProposalGeneration(
  response: Pick<AiOperationalProposalsResponse, "generation">,
): string {
  const generation = response.generation;
  if (generation.status === "configured") {
    return `${generation.provider ?? "AI provider"} queues ${generation.jobName.replaceAll("_", " ")} jobs.`;
  }
  if (generation.reason === "queue_not_configured") {
    return "AI operational proposals are disabled until the AI queue is configured.";
  }
  if (generation.reason === "provider_not_injected") {
    return "AI operational proposals are disabled until a proposal provider is injected.";
  }
  return "AI operational proposals are disabled until an AI provider is enabled.";
}
