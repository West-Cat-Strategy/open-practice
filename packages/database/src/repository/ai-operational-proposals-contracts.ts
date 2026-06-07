import type {
  AiOperationalProposalKind,
  AiOperationalProposalRecord,
  AiOperationalProposalStatus,
} from "@open-practice/domain";

export interface AiOperationalProposalListOptions {
  matterId?: string;
  status?: AiOperationalProposalStatus;
  kind?: AiOperationalProposalKind;
}

export interface AiOperationalProposalRepository {
  listAiOperationalProposals(
    firmId: string,
    options?: AiOperationalProposalListOptions,
  ): Promise<AiOperationalProposalRecord[]>;
  getAiOperationalProposal(
    firmId: string,
    id: string,
  ): Promise<AiOperationalProposalRecord | undefined>;
  createAiOperationalProposal(
    record: AiOperationalProposalRecord,
  ): Promise<AiOperationalProposalRecord>;
  updateAiOperationalProposal(
    record: AiOperationalProposalRecord,
  ): Promise<AiOperationalProposalRecord>;
}
