import type {
  DocumentAssemblyPackageRecord,
  DocumentAssemblySetDefinitionRecord,
  GeneratedDocumentRecord,
  SignatureEnvelopeRecord,
} from "@open-practice/domain";
import { clone } from "../contracts.js";

export interface MemoryDocumentAssemblyStore {
  generatedDocuments: GeneratedDocumentRecord[];
  documentAssemblySetDefinitions: DocumentAssemblySetDefinitionRecord[];
  documentAssemblyPackages: DocumentAssemblyPackageRecord[];
  signatureEnvelopes: SignatureEnvelopeRecord[];
}

export function listMemoryGeneratedDocuments(
  store: MemoryDocumentAssemblyStore,
  firmId: string,
  options: { matterId?: string; documentId?: string } = {},
): GeneratedDocumentRecord[] {
  return clone(
    store.generatedDocuments
      .filter(
        (document) =>
          document.firmId === firmId &&
          (!options.matterId || document.matterId === options.matterId) &&
          (!options.documentId || document.documentId === options.documentId),
      )
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
  );
}

export function createMemoryGeneratedDocument(
  store: MemoryDocumentAssemblyStore,
  document: GeneratedDocumentRecord,
): GeneratedDocumentRecord {
  store.generatedDocuments = [...store.generatedDocuments, clone(document)];
  return clone(document);
}

export function listMemoryDocumentAssemblySetDefinitions(
  store: MemoryDocumentAssemblyStore,
  firmId: string,
  options: { activeOnly?: boolean } = {},
): DocumentAssemblySetDefinitionRecord[] {
  return clone(
    store.documentAssemblySetDefinitions
      .filter(
        (definition) => definition.firmId === firmId && (!options.activeOnly || definition.active),
      )
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
}

export function listMemoryDocumentAssemblyPackages(
  store: MemoryDocumentAssemblyStore,
  firmId: string,
  options: { matterId?: string; definitionId?: string } = {},
): DocumentAssemblyPackageRecord[] {
  return clone(
    store.documentAssemblyPackages
      .filter(
        (item) =>
          item.firmId === firmId &&
          (!options.matterId || item.matterId === options.matterId) &&
          (!options.definitionId || item.definitionId === options.definitionId),
      )
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
  );
}

export function listMemorySignatureEnvelopes(
  store: MemoryDocumentAssemblyStore,
  firmId: string,
  options: { matterId?: string; assemblyPackageId?: string; signatureRequestId?: string } = {},
): SignatureEnvelopeRecord[] {
  return clone(
    store.signatureEnvelopes
      .filter(
        (envelope) =>
          envelope.firmId === firmId &&
          (!options.matterId || envelope.matterId === options.matterId) &&
          (!options.assemblyPackageId ||
            envelope.assemblyPackageId === options.assemblyPackageId) &&
          (!options.signatureRequestId ||
            envelope.signatureRequestId === options.signatureRequestId),
      )
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
  );
}
