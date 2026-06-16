import { describe, expect, it } from "vitest";
import {
  type SignatureProviderEventRecord,
  type SignatureRequestRecord,
  type SignatureRequestSignerRecord,
} from "@open-practice/domain";
import {
  sampleSignatureProviderEvents,
  sampleSignatureRequestSigners,
  sampleSignatureRequests,
} from "@open-practice/domain/sample-data";
import { DrizzleOpenPracticeRepository } from "../src/repository/drizzle.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import * as schema from "../src/schema.js";

type DrizzleDb = ConstructorParameters<typeof DrizzleOpenPracticeRepository>[0];
type SignatureTable =
  | typeof schema.signatureRequests
  | typeof schema.signatureRequestSigners
  | typeof schema.signatureProviderEvents;

function nullable<T>(value: T | undefined): T | null {
  return value ?? null;
}

function signatureRequestRow(request: SignatureRequestRecord) {
  return {
    ...request,
    signingUrl: nullable(request.signingUrl),
    signerOrder: request.signerOrder ?? [],
    fieldPlacements: request.fieldPlacements ?? [],
    validationStatus: request.validationStatus ?? "unchecked",
    completedAt: request.completedAt ? new Date(request.completedAt) : null,
    declinedAt: request.declinedAt ? new Date(request.declinedAt) : null,
    createdAt: new Date(request.createdAt),
  };
}

function signatureSignerRow(signer: SignatureRequestSignerRecord) {
  return {
    ...signer,
    signingUrl: nullable(signer.signingUrl),
    completedAt: signer.completedAt ? new Date(signer.completedAt) : null,
  };
}

function signatureEventRow(event: SignatureProviderEventRecord) {
  return {
    ...event,
    occurredAt: new Date(event.occurredAt),
  };
}

function drizzleRepositoryWithRows(rows: Map<SignatureTable, Record<string, unknown>[]>) {
  const queryResult = (table: SignatureTable) => ({
    then: (resolve: (value: Record<string, unknown>[]) => unknown) =>
      resolve(rows.get(table) ?? []),
    orderBy: async () => rows.get(table) ?? [],
  });
  const db = {
    select: () => ({
      from: (table: SignatureTable) => ({
        where: () => queryResult(table),
      }),
    }),
  } as unknown as DrizzleDb;
  return new DrizzleOpenPracticeRepository(db);
}

describe("signature repository records", () => {
  it("keeps seeded memory and Drizzle signature envelope metadata aligned", async () => {
    const memory = new InMemoryOpenPracticeRepository();
    const drizzle = drizzleRepositoryWithRows(
      new Map<SignatureTable, Record<string, unknown>[]>([
        [schema.signatureRequests, sampleSignatureRequests.map(signatureRequestRow)],
        [schema.signatureRequestSigners, sampleSignatureRequestSigners.map(signatureSignerRow)],
        [schema.signatureProviderEvents, sampleSignatureProviderEvents.map(signatureEventRow)],
      ]),
    );

    const [memoryRequests, drizzleRequests] = await Promise.all([
      memory.listSignatureRequests("firm-west-legal", { matterId: "matter-001" }),
      drizzle.listSignatureRequests("firm-west-legal", { matterId: "matter-001" }),
    ]);
    const [memorySigners, drizzleSigners] = await Promise.all([
      memory.listSignatureRequestSigners("firm-west-legal", "sig-001"),
      drizzle.listSignatureRequestSigners("firm-west-legal", "sig-001"),
    ]);
    const [memoryEvents, drizzleEvents] = await Promise.all([
      memory.listSignatureProviderEvents("firm-west-legal", { signatureRequestId: "sig-001" }),
      drizzle.listSignatureProviderEvents("firm-west-legal", { signatureRequestId: "sig-001" }),
    ]);

    expect(drizzleRequests).toEqual(memoryRequests);
    expect(drizzleRequests[0]).toMatchObject({
      signerOrder: [{ role: "client", order: 1, required: true }],
      fieldPlacements: expect.arrayContaining([
        expect.objectContaining({
          id: "client-signature",
          role: "client",
          fieldType: "signature",
          documentId: "doc-001",
        }),
      ]),
      validationStatus: "valid",
    });
    expect(drizzleSigners).toEqual(memorySigners);
    expect(drizzleEvents).toEqual(memoryEvents);
  });

  it("stores cloned request-level metadata in memory", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const createdAt = "2026-06-15T10:00:00.000Z";

    await repository.createSignatureRequest({
      request: {
        id: "sig-new",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        documentId: "doc-001",
        title: "Synthetic retainer signature",
        requestedByUserId: "user-admin",
        provider: "embedded",
        externalId: "embedded:matter-001:doc-001",
        status: "sent",
        consentText: "Synthetic consent.",
        evidence: { mode: "test" },
        signerOrder: [{ role: "client", order: 1, required: true }],
        fieldPlacements: [
          {
            id: "client-signature",
            role: "client",
            fieldType: "signature",
            page: 1,
            required: true,
            documentId: "doc-001",
          },
        ],
        validationStatus: "valid",
        createdAt,
      },
      signers: [
        {
          id: "sig-new-signer",
          firmId: "firm-west-legal",
          signatureRequestId: "sig-new",
          name: "Synthetic Client",
          email: "client@example.test",
          role: "client",
          status: "sent",
        },
      ],
      event: {
        id: "sig-new-event",
        firmId: "firm-west-legal",
        signatureRequestId: "sig-new",
        provider: "embedded",
        externalId: "embedded:matter-001:doc-001",
        status: "sent",
        occurredAt: createdAt,
        evidence: { mode: "test" },
      },
    });

    const [request] = await repository.listSignatureRequests("firm-west-legal", {
      matterId: "matter-001",
    });
    expect(request).toMatchObject({
      id: "sig-new",
      signerOrder: [{ role: "client", order: 1, required: true }],
      validationStatus: "valid",
    });
  });
});
