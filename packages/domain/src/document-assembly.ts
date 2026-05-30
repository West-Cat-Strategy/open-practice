import type { DocumentRecord } from "./models.js";
import type { GeneratedDocumentRecord, SignatureRequestRecord } from "./signatures.js";

export const documentAssemblyPackageStatuses = [
  "planning",
  "ready_for_generation",
  "assembled",
  "blocked",
] as const;

export type DocumentAssemblyPackageStatus = (typeof documentAssemblyPackageStatuses)[number];

export const documentAssemblyPopulationStatuses = [
  "needs_review",
  "ready",
  "populated",
  "blocked",
] as const;

export type DocumentAssemblyPopulationStatus = (typeof documentAssemblyPopulationStatuses)[number];

export const signatureEnvelopeStatuses = [
  "draft",
  "ready",
  "sent",
  "completed",
  "blocked",
] as const;

export type SignatureEnvelopeStatus = (typeof signatureEnvelopeStatuses)[number];

export const signatureEnvelopeValidationStatuses = [
  "unchecked",
  "valid",
  "needs_review",
  "invalid",
] as const;

export type SignatureEnvelopeValidationStatus =
  (typeof signatureEnvelopeValidationStatuses)[number];

export type DocumentAssemblySourceKind =
  | "draft_template"
  | "draft"
  | "document"
  | "generated_document"
  | "intake_package";

export interface DocumentAssemblySetDocumentRef {
  id: string;
  title: string;
  sourceKind: DocumentAssemblySourceKind;
  sourceId?: string;
  required: boolean;
  signerRoles?: string[];
}

export interface DocumentAssemblySetDefinitionRecord {
  id: string;
  firmId: string;
  name: string;
  description?: string;
  practiceArea?: string;
  documentRefs: DocumentAssemblySetDocumentRef[];
  requiredMergeFields: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface DocumentAssemblyPackageRecord {
  id: string;
  firmId: string;
  matterId: string;
  definitionId?: string;
  title: string;
  status: DocumentAssemblyPackageStatus;
  populationStatus: DocumentAssemblyPopulationStatus;
  sourceDraftId?: string;
  intakeSessionId?: string;
  packageId?: string;
  documentIds: string[];
  generatedDocumentIds: string[];
  signatureRequestIds: string[];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export type SignatureEnvelopeFieldType = "signature" | "initials" | "date" | "text";

export interface SignatureEnvelopeSignerOrder {
  role: string;
  order: number;
  required: boolean;
}

export interface SignatureEnvelopeFieldPlacement {
  id: string;
  role: string;
  fieldType: SignatureEnvelopeFieldType;
  page: number;
  required: boolean;
  documentId?: string;
  generatedDocumentId?: string;
  anchor?: string;
  xPercent?: number;
  yPercent?: number;
}

export interface SignatureEnvelopeRecord {
  id: string;
  firmId: string;
  matterId: string;
  assemblyPackageId?: string;
  signatureRequestId?: string;
  title: string;
  status: SignatureEnvelopeStatus;
  signerOrder: SignatureEnvelopeSignerOrder[];
  fieldPlacements: SignatureEnvelopeFieldPlacement[];
  validationStatus: SignatureEnvelopeValidationStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface DocumentAssemblyDocumentSummary {
  id: string;
  title: string;
  classification: DocumentRecord["classification"];
  version: number;
  uploadStatus: DocumentRecord["uploadStatus"];
  scanStatus: DocumentRecord["scanStatus"];
  reviewStatus: DocumentRecord["reviewStatus"];
}

export interface DocumentAssemblyGeneratedDocumentSummary {
  id: string;
  title: string;
  documentId?: string;
  createdAt: string;
}

export interface DocumentAssemblySignatureSummary {
  id: string;
  documentId: string;
  title: string;
  status: SignatureRequestRecord["status"];
  createdAt: string;
}

export interface DocumentAssemblySetDefinitionSummary {
  id: string;
  name: string;
  description?: string;
  practiceArea?: string;
  documentCount: number;
  requiredDocumentCount: number;
  signerRoles: string[];
  requiredMergeFieldCount: number;
}

export interface DocumentAssemblyPackageSummary {
  id: string;
  title: string;
  status: DocumentAssemblyPackageStatus;
  populationStatus: DocumentAssemblyPopulationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SignatureEnvelopeSignerSummary {
  role: string;
  order: number;
  required: boolean;
}

export interface SignatureEnvelopeFieldSummary {
  fieldType: SignatureEnvelopeFieldType;
  count: number;
  requiredCount: number;
}

export interface SignatureEnvelopeSummary {
  id: string;
  title: string;
  status: SignatureEnvelopeStatus;
  validationStatus: SignatureEnvelopeValidationStatus;
  signerOrder: SignatureEnvelopeSignerSummary[];
  fieldSummaries: SignatureEnvelopeFieldSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface SignatureEnvelopeDossier {
  envelope: SignatureEnvelopeSummary;
  linkedSignature?: DocumentAssemblySignatureSummary;
  validationIssues: string[];
}

export interface DocumentAssemblyPackageDossier {
  package: DocumentAssemblyPackageSummary;
  definition?: DocumentAssemblySetDefinitionSummary;
  documents: DocumentAssemblyDocumentSummary[];
  generatedDocuments: DocumentAssemblyGeneratedDocumentSummary[];
  signatureRequests: DocumentAssemblySignatureSummary[];
  envelopes: SignatureEnvelopeDossier[];
  readiness: {
    blockedReasons: string[];
    documentCount: number;
    generatedDocumentCount: number;
    signatureRequestCount: number;
    missingDefinition: boolean;
  };
}

export interface DocumentAssemblyWorkspace {
  matterId: string;
  definitions: DocumentAssemblySetDefinitionSummary[];
  packages: DocumentAssemblyPackageDossier[];
  summary: {
    packageCount: number;
    activeDefinitionCount: number;
    blockedPackageCount: number;
    envelopeCount: number;
    validEnvelopeCount: number;
  };
}

export interface BuildDocumentAssemblyWorkspaceInput {
  matterId: string;
  definitions: DocumentAssemblySetDefinitionRecord[];
  packages: DocumentAssemblyPackageRecord[];
  envelopes: SignatureEnvelopeRecord[];
  documents: DocumentRecord[];
  generatedDocuments: GeneratedDocumentRecord[];
  signatureRequests: SignatureRequestRecord[];
}

export function validateSignatureEnvelope(envelope: SignatureEnvelopeRecord): string[] {
  const issues: string[] = [];
  const roles = new Set<string>();
  const orders = new Set<number>();

  if (envelope.signerOrder.length === 0) {
    issues.push("Signer order is required before sending.");
  }

  for (const signer of envelope.signerOrder) {
    if (signer.order < 1 || !Number.isInteger(signer.order)) {
      issues.push(`Signer role ${signer.role} has an invalid signing order.`);
    }
    if (orders.has(signer.order)) {
      issues.push(`Signing order ${signer.order} is assigned more than once.`);
    }
    orders.add(signer.order);
    if (roles.has(signer.role)) {
      issues.push(`Signer role ${signer.role} is duplicated.`);
    }
    roles.add(signer.role);
  }

  for (const field of envelope.fieldPlacements) {
    if (!roles.has(field.role)) {
      issues.push(`Field ${field.id} references signer role ${field.role} outside signer order.`);
    }
    if (field.page < 1 || !Number.isInteger(field.page)) {
      issues.push(`Field ${field.id} has an invalid page.`);
    }
    if (field.xPercent !== undefined && (field.xPercent < 0 || field.xPercent > 100)) {
      issues.push(`Field ${field.id} has an invalid horizontal placement.`);
    }
    if (field.yPercent !== undefined && (field.yPercent < 0 || field.yPercent > 100)) {
      issues.push(`Field ${field.id} has an invalid vertical placement.`);
    }
    if (!field.documentId && !field.generatedDocumentId) {
      issues.push(`Field ${field.id} is not linked to a package document.`);
    }
  }

  return [...new Set(issues)].sort();
}

function summarizeDefinition(
  definition: DocumentAssemblySetDefinitionRecord,
): DocumentAssemblySetDefinitionSummary {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    practiceArea: definition.practiceArea,
    documentCount: definition.documentRefs.length,
    requiredDocumentCount: definition.documentRefs.filter((documentRef) => documentRef.required)
      .length,
    signerRoles: [
      ...new Set(definition.documentRefs.flatMap((documentRef) => documentRef.signerRoles ?? [])),
    ].sort(),
    requiredMergeFieldCount: definition.requiredMergeFields.length,
  };
}

function summarizePackage(item: DocumentAssemblyPackageRecord): DocumentAssemblyPackageSummary {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    populationStatus: item.populationStatus,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function summarizeSignatureEnvelope(envelope: SignatureEnvelopeRecord): SignatureEnvelopeSummary {
  const fieldsByType = new Map<SignatureEnvelopeFieldType, SignatureEnvelopeFieldPlacement[]>();
  for (const field of envelope.fieldPlacements) {
    fieldsByType.set(field.fieldType, [...(fieldsByType.get(field.fieldType) ?? []), field]);
  }

  return {
    id: envelope.id,
    title: envelope.title,
    status: envelope.status,
    validationStatus: envelope.validationStatus,
    signerOrder: envelope.signerOrder
      .map((signer) => ({
        role: signer.role,
        order: signer.order,
        required: signer.required,
      }))
      .sort((left, right) => left.order - right.order || left.role.localeCompare(right.role)),
    fieldSummaries: [...fieldsByType.entries()]
      .map(([fieldType, fields]) => ({
        fieldType,
        count: fields.length,
        requiredCount: fields.filter((field) => field.required).length,
      }))
      .sort((left, right) => left.fieldType.localeCompare(right.fieldType)),
    createdAt: envelope.createdAt,
    updatedAt: envelope.updatedAt,
  };
}

function safeSignatureEnvelopeValidationIssues(envelope: SignatureEnvelopeRecord): string[] {
  const issues: string[] = [];
  const roles = new Set<string>();
  const orders = new Set<number>();

  if (envelope.signerOrder.length === 0) {
    issues.push("Signer order is required before sending.");
  }

  for (const signer of envelope.signerOrder) {
    if (signer.order < 1 || !Number.isInteger(signer.order)) {
      issues.push("A signer role has an invalid signing order.");
    }
    if (orders.has(signer.order)) {
      issues.push("A signing order is assigned more than once.");
    }
    orders.add(signer.order);
    if (roles.has(signer.role)) {
      issues.push("A signer role is duplicated.");
    }
    roles.add(signer.role);
  }

  for (const field of envelope.fieldPlacements) {
    if (!roles.has(field.role)) {
      issues.push("A field references a signer role outside signer order.");
    }
    if (field.page < 1 || !Number.isInteger(field.page)) {
      issues.push("A field has an invalid page.");
    }
    if (field.xPercent !== undefined && (field.xPercent < 0 || field.xPercent > 100)) {
      issues.push("A field has an invalid horizontal placement.");
    }
    if (field.yPercent !== undefined && (field.yPercent < 0 || field.yPercent > 100)) {
      issues.push("A field has an invalid vertical placement.");
    }
    if (!field.documentId && !field.generatedDocumentId) {
      issues.push("A field is not linked to a package document.");
    }
  }

  return [...new Set(issues)].sort();
}

export function buildDocumentAssemblyWorkspace(
  input: BuildDocumentAssemblyWorkspaceInput,
): DocumentAssemblyWorkspace {
  const rawDefinitions = input.definitions
    .filter((definition) => definition.firmId && definition.active)
    .sort((left, right) => left.name.localeCompare(right.name));
  const definitionsById = new Map(rawDefinitions.map((definition) => [definition.id, definition]));
  const documentsById = new Map(
    input.documents
      .filter((document) => document.matterId === input.matterId)
      .map((document) => [document.id, document]),
  );
  const generatedDocumentsById = new Map(
    input.generatedDocuments
      .filter((document) => document.matterId === input.matterId)
      .map((document) => [document.id, document]),
  );
  const signaturesById = new Map(
    input.signatureRequests
      .filter((signature) => signature.matterId === input.matterId)
      .map((signature) => [signature.id, signature]),
  );
  const envelopesByPackageId = new Map<string, SignatureEnvelopeRecord[]>();

  for (const envelope of input.envelopes.filter((item) => item.matterId === input.matterId)) {
    if (!envelope.assemblyPackageId) continue;
    envelopesByPackageId.set(envelope.assemblyPackageId, [
      ...(envelopesByPackageId.get(envelope.assemblyPackageId) ?? []),
      envelope,
    ]);
  }

  const packages = input.packages
    .filter((item) => item.matterId === input.matterId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .map((item): DocumentAssemblyPackageDossier => {
      const definition = item.definitionId ? definitionsById.get(item.definitionId) : undefined;
      const documents = item.documentIds.flatMap((documentId) => {
        const document = documentsById.get(documentId);
        return document
          ? [
              {
                id: document.id,
                title: document.title,
                classification: document.classification,
                version: document.version,
                uploadStatus: document.uploadStatus,
                scanStatus: document.scanStatus,
                reviewStatus: document.reviewStatus,
              },
            ]
          : [];
      });
      const generatedDocuments = item.generatedDocumentIds.flatMap((documentId) => {
        const document = generatedDocumentsById.get(documentId);
        return document
          ? [
              {
                id: document.id,
                title: document.title,
                documentId: document.documentId,
                createdAt: document.createdAt,
              },
            ]
          : [];
      });
      const signatureRequests = item.signatureRequestIds.flatMap((signatureId) => {
        const signature = signaturesById.get(signatureId);
        return signature
          ? [
              {
                id: signature.id,
                documentId: signature.documentId,
                title: signature.title,
                status: signature.status,
                createdAt: signature.createdAt,
              },
            ]
          : [];
      });
      const envelopes = (envelopesByPackageId.get(item.id) ?? [])
        .sort((left, right) => left.title.localeCompare(right.title))
        .map((envelope) => {
          const linkedSignature = envelope.signatureRequestId
            ? signaturesById.get(envelope.signatureRequestId)
            : undefined;
          return {
            envelope: summarizeSignatureEnvelope(envelope),
            linkedSignature: linkedSignature
              ? {
                  id: linkedSignature.id,
                  documentId: linkedSignature.documentId,
                  title: linkedSignature.title,
                  status: linkedSignature.status,
                  createdAt: linkedSignature.createdAt,
                }
              : undefined,
            validationIssues: safeSignatureEnvelopeValidationIssues(envelope),
          };
        });
      const blockedReasons = [
        definition ? undefined : "Document set definition is missing or inactive.",
        item.populationStatus === "blocked" ? "Matter-data population is blocked." : undefined,
        item.status === "blocked" ? "Package assembly is blocked." : undefined,
        documents.length === 0 && generatedDocuments.length === 0
          ? "No linked package documents are available."
          : undefined,
        ...envelopes.flatMap((envelope) => envelope.validationIssues),
      ].filter((reason): reason is string => Boolean(reason));

      return {
        package: summarizePackage(item),
        definition: definition ? summarizeDefinition(definition) : undefined,
        documents,
        generatedDocuments,
        signatureRequests,
        envelopes,
        readiness: {
          blockedReasons: [...new Set(blockedReasons)].sort(),
          documentCount: documents.length,
          generatedDocumentCount: generatedDocuments.length,
          signatureRequestCount: signatureRequests.length,
          missingDefinition: Boolean(item.definitionId && !definition),
        },
      };
    });

  const envelopes = packages.flatMap((item) => item.envelopes);

  return {
    matterId: input.matterId,
    definitions: rawDefinitions.map(summarizeDefinition),
    packages,
    summary: {
      packageCount: packages.length,
      activeDefinitionCount: rawDefinitions.length,
      blockedPackageCount: packages.filter((item) => item.readiness.blockedReasons.length > 0)
        .length,
      envelopeCount: envelopes.length,
      validEnvelopeCount: envelopes.filter((item) => item.validationIssues.length === 0).length,
    },
  };
}
