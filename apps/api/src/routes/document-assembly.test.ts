import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type {
  DocumentAssemblyPackageRecord,
  DocumentAssemblySetDefinitionRecord,
  DocumentRecord,
  GeneratedDocumentRecord,
  SignatureEnvelopeRecord,
  SignatureRequestRecord,
} from "@open-practice/domain";
import { ApiHttpError } from "../http/response.js";
import { createApiServer, type ApiAuthContext } from "../server.js";
import {
  assertDocumentAssemblyWorkbenchAccess,
  type DocumentAssemblyWorkbenchAccessGuard,
} from "./document-assembly.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];

function testServer(overrides: Partial<CreateServerOptions> = {}) {
  const repository = overrides.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    webAuthn: {
      rpName: "Test RP",
      rpID: "localhost",
      origin: "http://localhost:3000",
    },
    ...overrides,
  });
  servers.push(server);
  return server;
}

class PoisonedDocumentAssemblyRepository extends InMemoryOpenPracticeRepository {
  async listMatterDocuments(firmId: string, matterId: string): Promise<DocumentRecord[]> {
    const records = await super.listMatterDocuments(firmId, matterId);
    return records.map((record) => ({
      ...record,
      storageKey: "poison-api-document-storage-key",
      checksumSha256: "poison-api-document-checksum",
      reviewMetadata: { rawInternalReviewValue: "poison-api-document-review-metadata" },
    }));
  }

  async listGeneratedDocuments(
    firmId: string,
    options: { matterId?: string; documentId?: string } = {},
  ): Promise<GeneratedDocumentRecord[]> {
    const records = await super.listGeneratedDocuments(firmId, options);
    return records.map((record) => ({
      ...record,
      provider: "docassemble",
      externalId: "poison-api-generated-external-id",
      packageId: "poison-api-generated-package-id",
      packageDocumentId: "poison-api-generated-package-document-id",
      storageKey: "poison-api-generated-storage-key",
      checksumSha256: "poison-api-generated-checksum",
      evidence: { source: "poison-api-generated-evidence" },
    }));
  }

  async listSignatureRequests(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<SignatureRequestRecord[]> {
    const records = await super.listSignatureRequests(firmId, options);
    return records.map((record) => ({
      ...record,
      requestedByUserId: "poison-api-signature-requested-by-user-id",
      provider: "docuseal",
      externalId: "poison-api-signature-external-id",
      signingUrl: "https://signing.example.test/poison-api-signature-signing-url",
      consentText: "poison-api-signature-consent-text",
      evidence: { source: "poison-api-signature-evidence" },
    }));
  }

  async listDocumentAssemblySetDefinitions(
    firmId: string,
    options: { activeOnly?: boolean } = {},
  ): Promise<DocumentAssemblySetDefinitionRecord[]> {
    const records = await super.listDocumentAssemblySetDefinitions(firmId, options);
    return records.map((record) => ({
      ...record,
      documentRefs: record.documentRefs.map((documentRef) => ({
        ...documentRef,
        sourceId: "poison-api-definition-source-id",
      })),
      requiredMergeFields: ["poison.api.definition.raw.merge.field"],
      metadata: { rawInternalDefinitionValue: "poison-api-definition-metadata" },
    }));
  }

  async listDocumentAssemblyPackages(
    firmId: string,
    options: { matterId?: string; definitionId?: string } = {},
  ): Promise<DocumentAssemblyPackageRecord[]> {
    const records = await super.listDocumentAssemblyPackages(firmId, options);
    return records.map((record) => ({
      ...record,
      sourceDraftId: "poison-api-source-draft-id",
      intakeSessionId: "poison-api-source-intake-session-id",
      packageId: "poison-api-provider-package-id",
      createdByUserId: "poison-api-package-created-by-user-id",
      metadata: {
        rawInternalPackageValue: "poison-api-package-metadata",
        populatedValues: { clientDisplayName: "poison-api-raw-populated-value" },
        sourceIntakeSessionId: "poison-api-source-intake-session-id",
      },
    }));
  }

  async listSignatureEnvelopes(
    firmId: string,
    options: { matterId?: string; assemblyPackageId?: string; signatureRequestId?: string } = {},
  ): Promise<SignatureEnvelopeRecord[]> {
    const records = await super.listSignatureEnvelopes(firmId, options);
    return records.map((record) => ({
      ...record,
      createdByUserId: "poison-api-envelope-created-by-user-id",
      fieldPlacements: record.fieldPlacements.map((field) => ({
        ...field,
        id: "poison-api-field-placement-id",
        anchor: "poison-api-field-anchor",
      })),
      metadata: {
        rawInternalEnvelopeValue: "poison-api-envelope-metadata",
        signerUserId: "poison-api-signer-user-id",
      },
    }));
  }
}

const poisonedInternalValues = [
  "poison-api-document-storage-key",
  "poison-api-document-checksum",
  "poison-api-document-review-metadata",
  "docassemble",
  "poison-api-generated-external-id",
  "poison-api-generated-package-id",
  "poison-api-generated-package-document-id",
  "poison-api-generated-storage-key",
  "poison-api-generated-checksum",
  "poison-api-generated-evidence",
  "docuseal",
  "poison-api-signature-requested-by-user-id",
  "poison-api-signature-external-id",
  "poison-api-signature-signing-url",
  "poison-api-signature-consent-text",
  "poison-api-signature-evidence",
  "poison-api-definition-source-id",
  "poison.api.definition.raw.merge.field",
  "poison-api-definition-metadata",
  "poison-api-source-draft-id",
  "poison-api-source-intake-session-id",
  "poison-api-provider-package-id",
  "poison-api-package-created-by-user-id",
  "poison-api-package-metadata",
  "poison-api-raw-populated-value",
  "poison-api-envelope-created-by-user-id",
  "poison-api-field-placement-id",
  "poison-api-field-anchor",
  "poison-api-envelope-metadata",
  "poison-api-signer-user-id",
  "ada@example.test",
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

const authContext: ApiAuthContext = {
  firmId: "firm-west-legal",
  user: {
    id: "user-staff",
    firmId: "firm-west-legal",
    displayName: "Jordan Lee",
    email: "jordan@example.test",
    role: "firm_member",
    assignedMatterIds: ["matter-001"],
    mfaEnabled: false,
  },
};

function expectNoRawInternals(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const poison of poisonedInternalValues) {
    expect(serialized).not.toContain(poison);
  }
  for (const propertyName of rawInternalPropertyNames) {
    expect(serialized).not.toContain(`"${propertyName}"`);
  }
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("document assembly routes", () => {
  it("requires both document and signature request read access for the workbench", () => {
    const calls: string[] = [];
    const guard: DocumentAssemblyWorkbenchAccessGuard = (context, request) => {
      calls.push(`${request.resource}:${request.action}:${request.matterId}`);
      if (request.resource === "signature_request") {
        return {
          ok: false,
          error: new ApiHttpError(
            403,
            "SIGNATURE_REQUEST_ACCESS_REQUIRED",
            "Signature request access required",
          ),
        };
      }
      return { ok: true, data: { context } };
    };

    expect(() => assertDocumentAssemblyWorkbenchAccess(authContext, "matter-001", guard)).toThrow(
      "Signature request access required",
    );
    expect(calls).toEqual(["document:read:matter-001", "signature_request:read:matter-001"]);
  });

  it("returns a matter-scoped workbench without raw document or signature evidence", async () => {
    const server = testServer({ repository: new PoisonedDocumentAssemblyRepository() });

    const response = await server.inject({
      method: "GET",
      url: "/api/document-assembly/workbench?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{
      status: string;
      summary: {
        packageCount: number;
        envelopeCount: number;
        validEnvelopeCount: number;
      };
      definitions: Array<{
        name: string;
        requiredMergeFieldCount: number;
      }>;
      packages: Array<{
        package: { title: string; status: string; populationStatus: string };
        definition?: { name: string; documentCount: number; signerRoles: string[] };
        envelopes: Array<{
          envelope: {
            signerOrder: Array<{ role: string; order: number; required: boolean }>;
            fieldSummaries: Array<{ fieldType: string; count: number; requiredCount: number }>;
          };
        }>;
        readiness: { blockedReasons: string[] };
      }>;
    }>();
    expect(payload.status).toBe("available");
    expect(payload.summary).toMatchObject({
      packageCount: 1,
      envelopeCount: 1,
      validEnvelopeCount: 1,
    });
    expect(payload.packages[0]).toMatchObject({
      package: {
        title: "BC tenancy retainer signature package",
        status: "assembled",
        populationStatus: "populated",
      },
      definition: {
        name: "BC tenancy retainer signature package",
        documentCount: 1,
        signerRoles: ["client"],
      },
      envelopes: [
        {
          envelope: {
            signerOrder: [{ role: "client", order: 1, required: true }],
            fieldSummaries: [
              { fieldType: "date", count: 1, requiredCount: 1 },
              { fieldType: "signature", count: 1, requiredCount: 1 },
            ],
          },
        },
      ],
      readiness: { blockedReasons: [] },
    });
    expectNoRawInternals(payload);
  });

  it("keeps unassigned matter document assembly behind matter access", async () => {
    const server = testServer({ devUserId: "user-staff" });

    const response = await server.inject({
      method: "GET",
      url: "/api/document-assembly/workbench?matterId=matter-002",
    });

    expect(response.statusCode).toBe(403);
  });
});
