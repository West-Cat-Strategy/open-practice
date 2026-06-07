import {
  validateAiOperationalProposalRecord,
  type AiOperationalProposalRecord,
} from "@open-practice/domain";
import { clone } from "../contracts.js";
import type { AiOperationalProposalListOptions } from "../ai-operational-proposals-contracts.js";

export interface MemoryAiOperationalProposalStore {
  aiOperationalProposals: AiOperationalProposalRecord[];
}

export function listMemoryAiOperationalProposals(
  store: MemoryAiOperationalProposalStore,
  firmId: string,
  options: AiOperationalProposalListOptions = {},
): AiOperationalProposalRecord[] {
  return clone(
    store.aiOperationalProposals
      .filter(
        (record) =>
          record.firmId === firmId &&
          (!options.matterId || record.matterId === options.matterId) &&
          (!options.status || record.status === options.status) &&
          (!options.kind || record.kind === options.kind),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  );
}

export function getMemoryAiOperationalProposal(
  store: MemoryAiOperationalProposalStore,
  firmId: string,
  id: string,
): AiOperationalProposalRecord | undefined {
  return clone(
    store.aiOperationalProposals.find((record) => record.firmId === firmId && record.id === id),
  );
}

export function createMemoryAiOperationalProposal(
  store: MemoryAiOperationalProposalStore,
  record: AiOperationalProposalRecord,
): AiOperationalProposalRecord {
  validateAiOperationalProposalRecord(record);
  if (store.aiOperationalProposals.some((candidate) => candidate.id === record.id)) {
    throw new Error("AI operational proposal already exists");
  }
  store.aiOperationalProposals.push(clone(record));
  return clone(record);
}

export function updateMemoryAiOperationalProposal(
  store: MemoryAiOperationalProposalStore,
  record: AiOperationalProposalRecord,
): AiOperationalProposalRecord {
  validateAiOperationalProposalRecord(record);
  const index = store.aiOperationalProposals.findIndex(
    (candidate) => candidate.firmId === record.firmId && candidate.id === record.id,
  );
  if (index === -1) {
    throw new Error(`AI operational proposal ${record.id} was not found`);
  }
  store.aiOperationalProposals[index] = clone(record);
  return clone(record);
}
