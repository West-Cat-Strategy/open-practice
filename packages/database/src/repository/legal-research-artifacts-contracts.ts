import type {
  LegalResearchArtifactKind,
  LegalResearchArtifactRecord,
  LegalResearchArtifactStatus,
} from "@open-practice/domain";

export interface LegalResearchArtifactListOptions {
  matterId?: string;
  status?: LegalResearchArtifactStatus;
  kind?: LegalResearchArtifactKind;
}

export interface LegalResearchArtifactRepository {
  listLegalResearchArtifacts(
    firmId: string,
    options?: LegalResearchArtifactListOptions,
  ): Promise<LegalResearchArtifactRecord[]>;
  getLegalResearchArtifact(
    firmId: string,
    id: string,
  ): Promise<LegalResearchArtifactRecord | undefined>;
  createLegalResearchArtifact(
    record: LegalResearchArtifactRecord,
  ): Promise<LegalResearchArtifactRecord>;
  updateLegalResearchArtifact(
    record: LegalResearchArtifactRecord,
  ): Promise<LegalResearchArtifactRecord>;
}
