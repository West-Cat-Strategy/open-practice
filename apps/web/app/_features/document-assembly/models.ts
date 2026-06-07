export type DocumentAssemblyWorkbenchStatus = "available" | "access_denied" | "unavailable";

export type DocumentAssemblyDocumentClassification =
  | "general"
  | "privileged"
  | "work_product"
  | "financial"
  | "identity";

export type DocumentAssemblyUploadStatus = "intent_created" | "uploaded" | "verified" | "rejected";

export type DocumentAssemblyScanStatus =
  | "pending"
  | "queued"
  | "passed"
  | "failed"
  | "not_required";

export type DocumentAssemblyReviewStatus =
  | "not_required"
  | "pending_review"
  | "needs_metadata"
  | "accepted"
  | "retry_requested"
  | "discarded";

export type DocumentAssemblyPackageStatus =
  | "planning"
  | "ready_for_generation"
  | "assembled"
  | "blocked";

export type DocumentAssemblyPopulationStatus = "needs_review" | "ready" | "populated" | "blocked";

export type SignatureEnvelopeStatus = "draft" | "ready" | "sent" | "completed" | "blocked";

export type SignatureEnvelopeValidationStatus = "unchecked" | "valid" | "needs_review" | "invalid";

export type SignatureEnvelopeFieldType = "signature" | "initials" | "date" | "text";

export interface DocumentAssemblyDocumentSummary {
  id: string;
  title: string;
  classification: DocumentAssemblyDocumentClassification;
  version: number;
  uploadStatus: DocumentAssemblyUploadStatus;
  scanStatus: DocumentAssemblyScanStatus;
  reviewStatus: DocumentAssemblyReviewStatus;
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
  status: string;
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

export interface DocumentAssemblyWorkbenchResponse {
  status: DocumentAssemblyWorkbenchStatus;
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

export interface DocumentAssemblyDashboardResponse {
  workbenchesByMatterId: Record<string, DocumentAssemblyWorkbenchResponse>;
}
