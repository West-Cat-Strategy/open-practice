import type {
  DocumentAssemblyPackageRecord,
  DocumentAssemblySetDefinitionRecord,
  GeneratedDocumentRecord,
  SignatureEnvelopeRecord,
} from "@open-practice/domain";
import { and, asc, desc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import {
  mapDocumentAssemblyPackageRow,
  mapDocumentAssemblySetDefinitionRow,
  mapGeneratedDocumentRow,
  mapSignatureEnvelopeRow,
} from "../drizzle-mappers.js";

export async function listDrizzleGeneratedDocuments(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterId?: string; documentId?: string } = {},
): Promise<GeneratedDocumentRecord[]> {
  const conditions = [eq(schema.generatedDocuments.firmId, firmId)];
  if (options.matterId) conditions.push(eq(schema.generatedDocuments.matterId, options.matterId));
  if (options.documentId) {
    conditions.push(eq(schema.generatedDocuments.documentId, options.documentId));
  }
  const rows = await db
    .select()
    .from(schema.generatedDocuments)
    .where(and(...conditions))
    .orderBy(desc(schema.generatedDocuments.createdAt));
  return rows.map(mapGeneratedDocumentRow);
}

export async function createDrizzleGeneratedDocument(
  db: OpenPracticeDatabase,
  document: GeneratedDocumentRecord,
): Promise<GeneratedDocumentRecord> {
  await db.insert(schema.generatedDocuments).values({
    ...document,
    intakeSessionId: document.intakeSessionId ?? null,
    createdAt: new Date(document.createdAt),
  });
  return document;
}

export async function listDrizzleDocumentAssemblySetDefinitions(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { activeOnly?: boolean } = {},
): Promise<DocumentAssemblySetDefinitionRecord[]> {
  const conditions = [eq(schema.documentAssemblySetDefinitions.firmId, firmId)];
  if (options.activeOnly) {
    conditions.push(eq(schema.documentAssemblySetDefinitions.active, true));
  }
  const rows = await db
    .select()
    .from(schema.documentAssemblySetDefinitions)
    .where(and(...conditions))
    .orderBy(asc(schema.documentAssemblySetDefinitions.name));
  return rows.map(mapDocumentAssemblySetDefinitionRow);
}

export async function listDrizzleDocumentAssemblyPackages(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterId?: string; definitionId?: string } = {},
): Promise<DocumentAssemblyPackageRecord[]> {
  const conditions = [eq(schema.documentAssemblyPackages.firmId, firmId)];
  if (options.matterId) {
    conditions.push(eq(schema.documentAssemblyPackages.matterId, options.matterId));
  }
  if (options.definitionId) {
    conditions.push(eq(schema.documentAssemblyPackages.definitionId, options.definitionId));
  }
  const rows = await db
    .select()
    .from(schema.documentAssemblyPackages)
    .where(and(...conditions))
    .orderBy(desc(schema.documentAssemblyPackages.updatedAt));
  return rows.map(mapDocumentAssemblyPackageRow);
}

export async function listDrizzleSignatureEnvelopes(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterId?: string; assemblyPackageId?: string; signatureRequestId?: string } = {},
): Promise<SignatureEnvelopeRecord[]> {
  const conditions = [eq(schema.signatureEnvelopes.firmId, firmId)];
  if (options.matterId) {
    conditions.push(eq(schema.signatureEnvelopes.matterId, options.matterId));
  }
  if (options.assemblyPackageId) {
    conditions.push(eq(schema.signatureEnvelopes.assemblyPackageId, options.assemblyPackageId));
  }
  if (options.signatureRequestId) {
    conditions.push(eq(schema.signatureEnvelopes.signatureRequestId, options.signatureRequestId));
  }
  const rows = await db
    .select()
    .from(schema.signatureEnvelopes)
    .where(and(...conditions))
    .orderBy(desc(schema.signatureEnvelopes.updatedAt));
  return rows.map(mapSignatureEnvelopeRow);
}
