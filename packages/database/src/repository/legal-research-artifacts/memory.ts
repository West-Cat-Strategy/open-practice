import {
  validateLegalResearchArtifactRecord,
  type LegalResearchArtifactRecord,
} from "@open-practice/domain";
import { clone } from "../contracts.js";
import type { LegalResearchArtifactListOptions } from "../legal-research-artifacts-contracts.js";

export interface MemoryLegalResearchArtifactStore {
  legalResearchArtifacts: LegalResearchArtifactRecord[];
}

export function listMemoryLegalResearchArtifacts(
  store: MemoryLegalResearchArtifactStore,
  firmId: string,
  options: LegalResearchArtifactListOptions = {},
): LegalResearchArtifactRecord[] {
  return clone(
    store.legalResearchArtifacts
      .filter(
        (record) =>
          record.firmId === firmId &&
          (!options.matterId || record.matterId === options.matterId) &&
          (!options.status || record.status === options.status) &&
          (!options.kind || record.kind === options.kind),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  );
}

export function getMemoryLegalResearchArtifact(
  store: MemoryLegalResearchArtifactStore,
  firmId: string,
  id: string,
): LegalResearchArtifactRecord | undefined {
  return clone(
    store.legalResearchArtifacts.find((record) => record.firmId === firmId && record.id === id),
  );
}

export function createMemoryLegalResearchArtifact(
  store: MemoryLegalResearchArtifactStore,
  record: LegalResearchArtifactRecord,
): LegalResearchArtifactRecord {
  validateLegalResearchArtifactRecord(record);
  if (store.legalResearchArtifacts.some((candidate) => candidate.id === record.id)) {
    throw new Error("Legal research artifact already exists");
  }
  store.legalResearchArtifacts.push(clone(record));
  return clone(record);
}

export function updateMemoryLegalResearchArtifact(
  store: MemoryLegalResearchArtifactStore,
  record: LegalResearchArtifactRecord,
): LegalResearchArtifactRecord {
  validateLegalResearchArtifactRecord(record);
  const index = store.legalResearchArtifacts.findIndex(
    (candidate) => candidate.firmId === record.firmId && candidate.id === record.id,
  );
  if (index === -1) {
    throw new Error(`Legal research artifact ${record.id} was not found`);
  }
  store.legalResearchArtifacts[index] = clone(record);
  return clone(record);
}
