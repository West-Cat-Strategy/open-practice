import type {
  DocumentAssemblyPackageRecord,
  DocumentAssemblySetDefinitionRecord,
  GeneratedDocumentRecord,
  SignatureEnvelopeRecord,
} from "@open-practice/domain";

export interface DocumentAssemblyRepository {
  listGeneratedDocuments(
    firmId: string,
    options?: { matterId?: string; documentId?: string },
  ): Promise<GeneratedDocumentRecord[]>;
  createGeneratedDocument(document: GeneratedDocumentRecord): Promise<GeneratedDocumentRecord>;
  listDocumentAssemblySetDefinitions(
    firmId: string,
    options?: { activeOnly?: boolean },
  ): Promise<DocumentAssemblySetDefinitionRecord[]>;
  listDocumentAssemblyPackages(
    firmId: string,
    options?: { matterId?: string; definitionId?: string },
  ): Promise<DocumentAssemblyPackageRecord[]>;
  listSignatureEnvelopes(
    firmId: string,
    options?: { matterId?: string; assemblyPackageId?: string; signatureRequestId?: string },
  ): Promise<SignatureEnvelopeRecord[]>;
}
