import { describe, expect, it } from "vitest";
import {
  buildDocumentAssemblyWorkspace,
  validateSignatureEnvelope,
  type DocumentAssemblyPackageRecord,
  type DocumentAssemblySetDefinitionRecord,
  type SignatureEnvelopeRecord,
} from "./document-assembly.js";
import type { DocumentRecord } from "./models.js";
import type { GeneratedDocumentRecord, SignatureRequestRecord } from "./signatures.js";

const document: DocumentRecord = {
  id: "doc-assembly-001",
  firmId: "firm-001",
  matterId: "matter-001",
  title: "Synthetic retainer.pdf",
  storageKey: "poison-document-storage-key",
  checksumSha256: "poison-document-checksum",
  version: 1,
  classification: "work_product",
  legalHold: true,
  uploadStatus: "verified",
  checksumStatus: "verified",
  scanStatus: "passed",
  reviewStatus: "not_required",
  reviewMetadata: { rawInternalReviewValue: "poison-document-review-metadata" },
};

const generatedDocument: GeneratedDocumentRecord = {
  id: "generated-assembly-001",
  firmId: "firm-001",
  matterId: "matter-001",
  provider: "docassemble",
  externalId: "poison-generated-external-id",
  title: "Synthetic retainer",
  documentId: document.id,
  packageId: "poison-generated-package-id",
  packageDocumentId: "poison-generated-package-document-id",
  storageKey: "poison-generated-storage-key",
  checksumSha256: "poison-generated-checksum",
  evidence: { source: "poison-generated-evidence", draftId: "poison-evidence-draft-id" },
  createdAt: "2026-05-29T17:00:00.000Z",
};

const signature: SignatureRequestRecord = {
  id: "signature-assembly-001",
  firmId: "firm-001",
  matterId: "matter-001",
  documentId: document.id,
  title: "Synthetic retainer",
  requestedByUserId: "poison-signature-requested-by-user-id",
  provider: "docuseal",
  externalId: "poison-signature-external-id",
  status: "sent",
  signingUrl: "https://signing.example.test/poison-signature-signing-url",
  consentText: "poison-signature-consent-text",
  evidence: { mode: "poison-signature-evidence" },
  createdAt: "2026-05-29T17:05:00.000Z",
};

const definition: DocumentAssemblySetDefinitionRecord = {
  id: "set-001",
  firmId: "firm-001",
  name: "Synthetic retainer package",
  practiceArea: "general",
  documentRefs: [
    {
      id: "retainer",
      title: "Retainer",
      sourceKind: "draft_template",
      sourceId: "poison-definition-source-id",
      required: true,
      signerRoles: ["client"],
    },
  ],
  requiredMergeFields: ["poison.definition.raw.merge.field", "poison.definition.raw.anchor"],
  active: true,
  createdAt: "2026-05-29T16:00:00.000Z",
  updatedAt: "2026-05-29T16:00:00.000Z",
  metadata: { rawInternalDefinitionValue: "poison-definition-metadata" },
};

const assemblyPackage: DocumentAssemblyPackageRecord = {
  id: "assembly-package-001",
  firmId: "firm-001",
  matterId: "matter-001",
  definitionId: definition.id,
  title: "Synthetic retainer package",
  status: "assembled",
  populationStatus: "populated",
  sourceDraftId: "poison-source-draft-id",
  intakeSessionId: "poison-source-intake-session-id",
  packageId: "poison-provider-package-id",
  documentIds: [document.id],
  generatedDocumentIds: [generatedDocument.id],
  signatureRequestIds: [signature.id],
  createdByUserId: "poison-package-created-by-user-id",
  createdAt: "2026-05-29T17:10:00.000Z",
  updatedAt: "2026-05-29T17:10:00.000Z",
  metadata: {
    rawInternalPackageValue: "poison-package-metadata",
    populatedValues: { clientDisplayName: "poison-raw-populated-value" },
    sourceIntakeSessionId: "poison-source-intake-session-id",
  },
};

const envelope: SignatureEnvelopeRecord = {
  id: "envelope-001",
  firmId: "firm-001",
  matterId: "matter-001",
  assemblyPackageId: assemblyPackage.id,
  signatureRequestId: signature.id,
  title: "Synthetic retainer envelope",
  status: "sent",
  signerOrder: [{ role: "client", order: 1, required: true }],
  fieldPlacements: [
    {
      id: "client-signature",
      role: "client",
      fieldType: "signature",
      page: 1,
      required: true,
      documentId: document.id,
      anchor: "poison-field-anchor",
      xPercent: 72,
      yPercent: 84,
    },
  ],
  validationStatus: "valid",
  createdByUserId: "poison-envelope-created-by-user-id",
  createdAt: "2026-05-29T17:12:00.000Z",
  updatedAt: "2026-05-29T17:12:00.000Z",
  metadata: {
    rawInternalEnvelopeValue: "poison-envelope-metadata",
    signerUserId: "poison-signer-user-id",
  },
};

const poisonedInternalValues = [
  "poison-document-storage-key",
  "poison-document-checksum",
  "poison-document-review-metadata",
  "docassemble",
  "poison-generated-external-id",
  "poison-generated-package-id",
  "poison-generated-package-document-id",
  "poison-generated-storage-key",
  "poison-generated-checksum",
  "poison-generated-evidence",
  "poison-evidence-draft-id",
  "docuseal",
  "poison-signature-requested-by-user-id",
  "poison-signature-external-id",
  "poison-signature-signing-url",
  "poison-signature-consent-text",
  "poison-signature-evidence",
  "poison-definition-source-id",
  "poison.definition.raw.merge.field",
  "poison.definition.raw.anchor",
  "poison-definition-metadata",
  "poison-source-draft-id",
  "poison-source-intake-session-id",
  "poison-provider-package-id",
  "poison-package-created-by-user-id",
  "poison-package-metadata",
  "poison-raw-populated-value",
  "poison-field-anchor",
  "client-signature",
  "poison-envelope-created-by-user-id",
  "poison-envelope-metadata",
  "poison-signer-user-id",
];

const rawInternalPropertyNames = [
  "metadata",
  "createdByUserId",
  "requestedByUserId",
  "sourceDraftId",
  "intakeSessionId",
  "sourceIntakeSessionId",
  "storageKey",
  "checksumSha256",
  "evidence",
  "consentText",
  "signingUrl",
  "externalId",
  "provider",
  "sourceId",
  "requiredMergeFields",
  "documentRefs",
  "fieldPlacements",
  "anchor",
  "xPercent",
  "yPercent",
  "assemblyPackageId",
  "signatureRequestId",
  "packageDocumentId",
  "populatedValues",
];

function expectNoRawInternals(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const poison of poisonedInternalValues) {
    expect(serialized).not.toContain(poison);
  }
  for (const propertyName of rawInternalPropertyNames) {
    expect(serialized).not.toContain(`"${propertyName}"`);
  }
}

describe("document assembly workspace", () => {
  it("projects package, generated document, and signature-envelope metadata without raw evidence", () => {
    const workspace = buildDocumentAssemblyWorkspace({
      matterId: "matter-001",
      definitions: [definition],
      packages: [assemblyPackage],
      envelopes: [envelope],
      documents: [document],
      generatedDocuments: [generatedDocument],
      signatureRequests: [signature],
    });

    expect(workspace.summary).toMatchObject({
      packageCount: 1,
      activeDefinitionCount: 1,
      blockedPackageCount: 0,
      envelopeCount: 1,
      validEnvelopeCount: 1,
    });
    expect(workspace.definitions[0]).toMatchObject({
      id: definition.id,
      name: definition.name,
      documentCount: 1,
      requiredDocumentCount: 1,
      signerRoles: ["client"],
      requiredMergeFieldCount: 2,
    });
    expect(workspace.packages[0]).toMatchObject({
      package: {
        id: assemblyPackage.id,
        title: assemblyPackage.title,
        status: "assembled",
        populationStatus: "populated",
      },
      definition: { id: definition.id, name: definition.name },
      documents: [expect.objectContaining({ id: document.id, title: document.title })],
      generatedDocuments: [
        expect.objectContaining({ id: generatedDocument.id, documentId: document.id }),
      ],
      signatureRequests: [
        expect.objectContaining({
          id: signature.id,
          status: "sent",
          documentId: document.id,
          title: signature.title,
        }),
      ],
      envelopes: [
        expect.objectContaining({
          envelope: expect.objectContaining({
            id: envelope.id,
            signerOrder: [{ role: "client", order: 1, required: true }],
            fieldSummaries: [{ fieldType: "signature", count: 1, requiredCount: 1 }],
          }),
          linkedSignature: expect.objectContaining({
            id: signature.id,
            status: "sent",
            documentId: document.id,
            title: signature.title,
          }),
          validationIssues: [],
        }),
      ],
      readiness: { blockedReasons: [] },
    });
    expectNoRawInternals(workspace);
  });

  it("surfaces validation issues for incomplete signer ordering and placements", () => {
    const issues = validateSignatureEnvelope({
      ...envelope,
      signerOrder: [{ role: "client", order: 1, required: true }],
      fieldPlacements: [
        {
          id: "orphan-field",
          role: "witness",
          fieldType: "signature",
          page: 0,
          required: true,
        },
      ],
      validationStatus: "needs_review",
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        "Field orphan-field has an invalid page.",
        "Field orphan-field is not linked to a package document.",
        "Field orphan-field references signer role witness outside signer order.",
      ]),
    );
  });

  it("returns safe validation issues without raw field placement identifiers", () => {
    const workspace = buildDocumentAssemblyWorkspace({
      matterId: "matter-001",
      definitions: [definition],
      packages: [assemblyPackage],
      envelopes: [
        {
          ...envelope,
          fieldPlacements: [
            {
              id: "poison-invalid-field-id",
              role: "witness",
              fieldType: "signature",
              page: 0,
              required: true,
              anchor: "poison-invalid-field-anchor",
            },
          ],
          validationStatus: "needs_review",
        },
      ],
      documents: [document],
      generatedDocuments: [generatedDocument],
      signatureRequests: [signature],
    });

    expect(workspace.packages[0]?.envelopes[0]?.validationIssues).toEqual(
      expect.arrayContaining([
        "A field has an invalid page.",
        "A field is not linked to a package document.",
        "A field references a signer role outside signer order.",
      ]),
    );
    expect(JSON.stringify(workspace)).not.toContain("poison-invalid-field-id");
    expect(JSON.stringify(workspace)).not.toContain("poison-invalid-field-anchor");
    expectNoRawInternals(workspace);
  });
});
