import { describe, expect, it } from "vitest";
import {
  buildDocumentAssemblyWorkspace,
  type DocumentAssemblyPackageRecord,
  type DocumentAssemblySetDefinitionRecord,
  type GeneratedDocumentRecord,
  type SignatureEnvelopeRecord,
} from "@open-practice/domain";
import {
  sampleDocumentAssemblyPackages,
  sampleDocumentAssemblySetDefinitions,
  sampleGeneratedDocuments,
  sampleSignatureEnvelopes,
} from "@open-practice/domain/sample-data";
import { DrizzleOpenPracticeRepository } from "../src/repository/drizzle.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import * as schema from "../src/schema.js";

type DrizzleDb = ConstructorParameters<typeof DrizzleOpenPracticeRepository>[0];
type DocumentAssemblyTable =
  | typeof schema.documentAssemblySetDefinitions
  | typeof schema.documentAssemblyPackages
  | typeof schema.generatedDocuments
  | typeof schema.signatureEnvelopes;

function nullable<T>(value: T | undefined): T | null {
  return value ?? null;
}

function generatedDocumentRow(document: GeneratedDocumentRecord) {
  return {
    ...document,
    intakeSessionId: nullable(document.intakeSessionId),
    documentId: nullable(document.documentId),
    packageId: nullable(document.packageId),
    packageDocumentId: nullable(document.packageDocumentId),
    storageKey: nullable(document.storageKey),
    checksumSha256: nullable(document.checksumSha256),
    createdAt: new Date(document.createdAt),
  };
}

function documentAssemblySetDefinitionRow(definition: DocumentAssemblySetDefinitionRecord) {
  return {
    ...definition,
    description: nullable(definition.description),
    practiceArea: nullable(definition.practiceArea),
    createdAt: new Date(definition.createdAt),
    updatedAt: new Date(definition.updatedAt),
  };
}

function documentAssemblyPackageRow(item: DocumentAssemblyPackageRecord) {
  return {
    ...item,
    definitionId: nullable(item.definitionId),
    sourceDraftId: nullable(item.sourceDraftId),
    intakeSessionId: nullable(item.intakeSessionId),
    packageId: nullable(item.packageId),
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

function signatureEnvelopeRow(envelope: SignatureEnvelopeRecord) {
  return {
    ...envelope,
    assemblyPackageId: nullable(envelope.assemblyPackageId),
    signatureRequestId: nullable(envelope.signatureRequestId),
    createdAt: new Date(envelope.createdAt),
    updatedAt: new Date(envelope.updatedAt),
  };
}

function drizzleRepositoryWithRows(rows: Map<DocumentAssemblyTable, Record<string, unknown>[]>) {
  const db = {
    select: () => ({
      from: (table: DocumentAssemblyTable) => ({
        where: () => ({
          orderBy: async () => rows.get(table) ?? [],
        }),
      }),
    }),
  } as unknown as DrizzleDb;
  return new DrizzleOpenPracticeRepository(db);
}

function seededDrizzleRepository() {
  return drizzleRepositoryWithRows(
    new Map<DocumentAssemblyTable, Record<string, unknown>[]>([
      [schema.generatedDocuments, sampleGeneratedDocuments.map(generatedDocumentRow)],
      [
        schema.documentAssemblySetDefinitions,
        sampleDocumentAssemblySetDefinitions.map(documentAssemblySetDefinitionRow),
      ],
      [
        schema.documentAssemblyPackages,
        sampleDocumentAssemblyPackages.map(documentAssemblyPackageRow),
      ],
      [schema.signatureEnvelopes, sampleSignatureEnvelopes.map(signatureEnvelopeRow)],
    ]),
  );
}

function expectNoRawInternals(value: unknown, hiddenValues: string[]): void {
  const serialized = JSON.stringify(value);
  for (const hiddenValue of hiddenValues) {
    expect(serialized).not.toContain(hiddenValue);
  }
  for (const propertyName of [
    "metadata",
    "sourceDraftId",
    "intakeSessionId",
    "createdByUserId",
    "storageKey",
    "checksumSha256",
    "externalId",
    "evidence",
    "consentText",
    "requiredMergeFields",
    "documentRefs",
    "fieldPlacements",
    "anchor",
    "xPercent",
    "yPercent",
    "packageId",
  ]) {
    expect(serialized).not.toContain(`"${propertyName}"`);
  }
}

describe("document assembly repository records", () => {
  it("lists seeded OP-authored assembly metadata for matter-scoped projection", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    const [definitions, packages, envelopes, documents, generatedDocuments, signatures] =
      await Promise.all([
        repository.listDocumentAssemblySetDefinitions("firm-west-legal", { activeOnly: true }),
        repository.listDocumentAssemblyPackages("firm-west-legal", { matterId: "matter-001" }),
        repository.listSignatureEnvelopes("firm-west-legal", { matterId: "matter-001" }),
        repository.listMatterDocuments("firm-west-legal", "matter-001"),
        repository.listGeneratedDocuments("firm-west-legal", { matterId: "matter-001" }),
        repository.listSignatureRequests("firm-west-legal", { matterId: "matter-001" }),
      ]);

    const workspace = buildDocumentAssemblyWorkspace({
      matterId: "matter-001",
      definitions,
      packages,
      envelopes,
      documents,
      generatedDocuments,
      signatureRequests: signatures,
    });

    expect(workspace.summary).toMatchObject({
      packageCount: 1,
      envelopeCount: 1,
      validEnvelopeCount: 1,
    });
    expect(workspace.packages[0]?.package.title).toBe("Retainer signature package");
    expect(workspace.packages[0]?.readiness).toMatchObject({
      documentCount: 1,
      generatedDocumentCount: 1,
      signatureRequestCount: 1,
      missingDefinition: false,
    });
    expectNoRawInternals(workspace, [
      "matters/matter-001",
      "I consent to electronic signature.",
      "client.displayName",
      "template-general-retainer",
      "user-licensee",
    ]);
  });

  it("keeps seeded memory and Drizzle list projections aligned", async () => {
    const memory = new InMemoryOpenPracticeRepository();
    const drizzle = seededDrizzleRepository();

    const [memoryDefinitions, drizzleDefinitions] = await Promise.all([
      memory.listDocumentAssemblySetDefinitions("firm-west-legal", { activeOnly: true }),
      drizzle.listDocumentAssemblySetDefinitions("firm-west-legal", { activeOnly: true }),
    ]);
    const [memoryPackages, drizzlePackages] = await Promise.all([
      memory.listDocumentAssemblyPackages("firm-west-legal", { matterId: "matter-001" }),
      drizzle.listDocumentAssemblyPackages("firm-west-legal", { matterId: "matter-001" }),
    ]);
    const [memoryEnvelopes, drizzleEnvelopes] = await Promise.all([
      memory.listSignatureEnvelopes("firm-west-legal", { matterId: "matter-001" }),
      drizzle.listSignatureEnvelopes("firm-west-legal", { matterId: "matter-001" }),
    ]);
    const [memoryGeneratedDocuments, drizzleGeneratedDocuments] = await Promise.all([
      memory.listGeneratedDocuments("firm-west-legal", { matterId: "matter-001" }),
      drizzle.listGeneratedDocuments("firm-west-legal", { matterId: "matter-001" }),
    ]);

    expect(drizzleDefinitions).toEqual(memoryDefinitions);
    expect(drizzlePackages).toEqual(memoryPackages);
    expect(drizzleEnvelopes).toEqual(memoryEnvelopes);
    expect(drizzleGeneratedDocuments).toEqual(memoryGeneratedDocuments);
  });

  it("keeps hidden Drizzle metadata out of workbench inputs", async () => {
    const poisonedDefinition: DocumentAssemblySetDefinitionRecord = {
      ...sampleDocumentAssemblySetDefinitions[0],
      documentRefs: sampleDocumentAssemblySetDefinitions[0].documentRefs.map((documentRef) => ({
        ...documentRef,
        sourceId: "poison-drizzle-definition-source-id",
      })),
      requiredMergeFields: ["poison.drizzle.raw.merge.field"],
      metadata: { rawInternalDefinitionValue: "poison-drizzle-definition-metadata" },
    };
    const poisonedPackage: DocumentAssemblyPackageRecord = {
      ...sampleDocumentAssemblyPackages[0],
      sourceDraftId: "poison-drizzle-source-draft-id",
      intakeSessionId: "poison-drizzle-intake-session-id",
      packageId: "poison-drizzle-provider-package-id",
      createdByUserId: "poison-drizzle-package-created-by-user-id",
      metadata: { rawInternalPackageValue: "poison-drizzle-package-metadata" },
    };
    const poisonedEnvelope: SignatureEnvelopeRecord = {
      ...sampleSignatureEnvelopes[0],
      createdByUserId: "poison-drizzle-envelope-created-by-user-id",
      fieldPlacements: sampleSignatureEnvelopes[0].fieldPlacements.map((field) => ({
        ...field,
        id: "poison-drizzle-field-id",
        anchor: "poison-drizzle-field-anchor",
        xPercent: 12,
        yPercent: 34,
      })),
      metadata: { rawInternalEnvelopeValue: "poison-drizzle-envelope-metadata" },
    };
    const poisonedGeneratedDocument: GeneratedDocumentRecord = {
      ...sampleGeneratedDocuments[0],
      externalId: "poison-drizzle-generated-external-id",
      packageId: "poison-drizzle-generated-package-id",
      packageDocumentId: "poison-drizzle-generated-package-document-id",
      storageKey: "poison-drizzle-generated-storage-key",
      checksumSha256: "poison-drizzle-generated-checksum",
      evidence: { rawInternalEvidenceValue: "poison-drizzle-generated-evidence" },
    };
    const repository = drizzleRepositoryWithRows(
      new Map<DocumentAssemblyTable, Record<string, unknown>[]>([
        [schema.generatedDocuments, [generatedDocumentRow(poisonedGeneratedDocument)]],
        [
          schema.documentAssemblySetDefinitions,
          [documentAssemblySetDefinitionRow(poisonedDefinition)],
        ],
        [schema.documentAssemblyPackages, [documentAssemblyPackageRow(poisonedPackage)]],
        [schema.signatureEnvelopes, [signatureEnvelopeRow(poisonedEnvelope)]],
      ]),
    );
    const memory = new InMemoryOpenPracticeRepository();
    const [definitions, packages, envelopes, documents, generatedDocuments, signatureRequests] =
      await Promise.all([
        repository.listDocumentAssemblySetDefinitions("firm-west-legal", { activeOnly: true }),
        repository.listDocumentAssemblyPackages("firm-west-legal", { matterId: "matter-001" }),
        repository.listSignatureEnvelopes("firm-west-legal", { matterId: "matter-001" }),
        memory.listMatterDocuments("firm-west-legal", "matter-001"),
        repository.listGeneratedDocuments("firm-west-legal", { matterId: "matter-001" }),
        memory.listSignatureRequests("firm-west-legal", { matterId: "matter-001" }),
      ]);

    const workspace = buildDocumentAssemblyWorkspace({
      matterId: "matter-001",
      definitions,
      packages,
      envelopes,
      documents,
      generatedDocuments,
      signatureRequests,
    });

    expect(workspace.summary).toMatchObject({ packageCount: 1, envelopeCount: 1 });
    expectNoRawInternals(workspace, [
      "poison-drizzle-definition-source-id",
      "poison.drizzle.raw.merge.field",
      "poison-drizzle-definition-metadata",
      "poison-drizzle-source-draft-id",
      "poison-drizzle-intake-session-id",
      "poison-drizzle-provider-package-id",
      "poison-drizzle-package-created-by-user-id",
      "poison-drizzle-package-metadata",
      "poison-drizzle-envelope-created-by-user-id",
      "poison-drizzle-field-id",
      "poison-drizzle-field-anchor",
      "poison-drizzle-envelope-metadata",
      "poison-drizzle-generated-external-id",
      "poison-drizzle-generated-package-id",
      "poison-drizzle-generated-package-document-id",
      "poison-drizzle-generated-storage-key",
      "poison-drizzle-generated-checksum",
      "poison-drizzle-generated-evidence",
    ]);
  });
});
