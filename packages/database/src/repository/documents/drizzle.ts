import type { DocumentRecord, DocumentTextExtractionRecord } from "@open-practice/domain";
import { and, eq, ne, sql } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type { DocumentRepository, DocumentUploadIntent } from "../documents-contracts.js";
import { mapDocumentRow, mapDocumentTextExtractionRow } from "../drizzle-mappers.js";

function documentChecksumLockKey(input: {
  firmId: string;
  matterId: string;
  checksumSha256: string;
}): string {
  return `${input.firmId}|${input.matterId}|${input.checksumSha256}`;
}

export async function getDrizzleDocument(
  db: OpenPracticeDatabase,
  firmId: string,
  documentId: string,
): Promise<DocumentRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.firmId, firmId), eq(schema.documents.id, documentId)));
  return row ? mapDocumentRow(row) : undefined;
}

export async function listDrizzleMatterDocuments(
  db: OpenPracticeDatabase,
  firmId: string,
  matterId: string,
): Promise<DocumentRecord[]> {
  const rows = await db
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.firmId, firmId), eq(schema.documents.matterId, matterId)));
  return rows.map(mapDocumentRow);
}

export async function createDrizzleDocumentUploadIntent(
  db: OpenPracticeDatabase,
  input: DocumentUploadIntent,
): Promise<DocumentRecord> {
  const supersededDocument = input.supersedesDocumentId
    ? await getDrizzleDocument(db, input.firmId, input.supersedesDocumentId)
    : undefined;
  if (
    input.supersedesDocumentId &&
    (!supersededDocument || supersededDocument.matterId !== input.matterId)
  ) {
    throw new Error(`Unknown superseded document ${input.supersedesDocumentId}`);
  }
  const now = new Date();
  const document = {
    id: input.id,
    firmId: input.firmId,
    matterId: input.matterId,
    title: input.title,
    storageKey: input.storageKey,
    checksumSha256: input.checksumSha256,
    sizeBytes: input.sizeBytes,
    version: supersededDocument ? supersededDocument.version + 1 : 1,
    classification: input.classification,
    legalHold: input.legalHold,
    uploadStatus: "intent_created" as const,
    checksumStatus: "pending" as const,
    scanStatus: "pending" as const,
    reviewStatus: input.reviewStatus ?? ("not_required" as const),
    reviewMetadata: {},
    externalUploadLinkId: input.externalUploadLinkId,
    supersedesDocumentId: input.supersedesDocumentId,
  };
  await db.transaction(async (tx) => {
    if (supersededDocument) {
      await tx
        .update(schema.documents)
        .set({ supersededAt: now })
        .where(
          and(
            eq(schema.documents.firmId, input.firmId),
            eq(schema.documents.id, supersededDocument.id),
          ),
        );
    }
    await tx.insert(schema.documents).values(document);
  });
  return document;
}

export async function completeDrizzleDocumentUpload(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    documentId: string;
    checksumSha256: string;
    scanStatus?: DocumentRecord["scanStatus"];
  },
): Promise<DocumentRecord> {
  return db.transaction(async (tx) => {
    const [documentRow] = await tx
      .select()
      .from(schema.documents)
      .where(
        and(eq(schema.documents.firmId, input.firmId), eq(schema.documents.id, input.documentId)),
      )
      .for("update");
    if (!documentRow) throw new Error(`Unknown document ${input.documentId}`);
    const document = mapDocumentRow(documentRow);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${documentChecksumLockKey({
        firmId: input.firmId,
        matterId: document.matterId,
        checksumSha256: input.checksumSha256,
      })}, 0))`,
    );
    const [duplicateRow] = await tx
      .select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.firmId, input.firmId),
          ne(schema.documents.id, input.documentId),
          eq(schema.documents.matterId, document.matterId),
          eq(schema.documents.checksumSha256, input.checksumSha256),
          eq(schema.documents.checksumStatus, "verified"),
        ),
      )
      .limit(1);
    const duplicate = duplicateRow ? mapDocumentRow(duplicateRow) : undefined;
    const now = new Date();
    const checksumMatches = document.checksumSha256 === input.checksumSha256;
    const [row] = await tx
      .update(schema.documents)
      .set({
        uploadStatus: checksumMatches ? "verified" : "rejected",
        checksumStatus: checksumMatches ? (duplicate ? "duplicate" : "verified") : "mismatch",
        scanStatus: checksumMatches ? (input.scanStatus ?? "queued") : "failed",
        reviewStatus: document.externalUploadLinkId
          ? checksumMatches
            ? "pending_review"
            : "retry_requested"
          : "not_required",
        reviewReason: checksumMatches ? (duplicate ? "duplicate" : null) : "checksum_mismatch",
        reviewMetadata: checksumMatches
          ? duplicate
            ? { automatedOutcome: "duplicate_detected", duplicateOfDocumentId: duplicate.id }
            : {}
          : document.externalUploadLinkId
            ? { automatedOutcome: "checksum_mismatch" }
            : {},
        duplicateOfDocumentId: duplicate?.id,
        uploadedAt: now,
        verifiedAt: now,
      })
      .where(
        and(eq(schema.documents.firmId, input.firmId), eq(schema.documents.id, input.documentId)),
      )
      .returning();
    if (!row) throw new Error(`Unknown document ${input.documentId}`);
    return mapDocumentRow(row);
  });
}

export async function reviewDrizzleUploadedDocument(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    documentId: string;
    status: DocumentRecord["reviewStatus"];
    decision: DocumentRecord["reviewDecision"];
    reason?: DocumentRecord["reviewReason"];
    metadata: Record<string, unknown>;
    reviewedByUserId: string;
    reviewedAt: string;
  },
): Promise<DocumentRecord> {
  const [row] = await db
    .update(schema.documents)
    .set({
      reviewStatus: input.status,
      reviewDecision: input.decision,
      reviewReason: input.reason ?? null,
      reviewMetadata: input.metadata,
      reviewedByUserId: input.reviewedByUserId,
      reviewedAt: new Date(input.reviewedAt),
    })
    .where(
      and(eq(schema.documents.firmId, input.firmId), eq(schema.documents.id, input.documentId)),
    )
    .returning();
  if (!row) throw new Error(`Unknown document ${input.documentId}`);
  return mapDocumentRow(row);
}

export async function updateDrizzleDocumentScanStatus(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    documentId: string;
    scanStatus: DocumentRecord["scanStatus"];
  },
): Promise<DocumentRecord> {
  const [row] = await db
    .update(schema.documents)
    .set({ scanStatus: input.scanStatus })
    .where(
      and(eq(schema.documents.firmId, input.firmId), eq(schema.documents.id, input.documentId)),
    )
    .returning();
  if (!row) throw new Error(`Unknown document ${input.documentId}`);
  return mapDocumentRow(row);
}

export async function recordDrizzleDocumentRetentionHoldReviewDecision(
  db: OpenPracticeDatabase,
  input: Parameters<DocumentRepository["recordDocumentRetentionHoldReviewDecision"]>[0],
): Promise<DocumentRecord> {
  const document = await getDrizzleDocument(db, input.firmId, input.documentId);
  if (!document) throw new Error(`Unknown document ${input.documentId}`);
  const [row] = await db
    .update(schema.documents)
    .set({
      reviewMetadata: {
        ...document.reviewMetadata,
        retentionHoldReview: {
          decision: input.decision,
          reason: input.reason,
          ...(input.reviewAfter ? { reviewAfter: input.reviewAfter } : {}),
          ...(input.minimumRetainThrough
            ? { minimumRetainThrough: input.minimumRetainThrough }
            : {}),
          recordedByUserId: input.recordedByUserId,
          recordedAt: input.recordedAt,
          sourceCueCounts: input.sourceCueCounts,
        },
      },
    })
    .where(
      and(eq(schema.documents.firmId, input.firmId), eq(schema.documents.id, input.documentId)),
    )
    .returning();
  if (!row) throw new Error(`Unknown document ${input.documentId}`);
  return mapDocumentRow(row);
}

export async function createDrizzleDocumentTextExtraction(
  db: OpenPracticeDatabase,
  extraction: DocumentTextExtractionRecord,
): Promise<DocumentTextExtractionRecord> {
  await db.insert(schema.documentTextExtractions).values({
    ...extraction,
    createdAt: new Date(extraction.createdAt),
    completedAt: extraction.completedAt ? new Date(extraction.completedAt) : null,
  });
  return extraction;
}

export async function getDrizzleDocumentTextExtractions(
  db: OpenPracticeDatabase,
  firmId: string,
  documentId: string,
): Promise<DocumentTextExtractionRecord[]> {
  const rows = await db
    .select()
    .from(schema.documentTextExtractions)
    .where(
      and(
        eq(schema.documentTextExtractions.firmId, firmId),
        eq(schema.documentTextExtractions.documentId, documentId),
      ),
    );
  return rows.map(mapDocumentTextExtractionRow);
}
