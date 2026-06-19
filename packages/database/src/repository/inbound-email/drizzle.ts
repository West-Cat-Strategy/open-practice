import type {
  DocumentRecord,
  InboundEmailAddressRecord,
  InboundEmailAttachmentRecord,
  InboundEmailMessageRecord,
} from "@open-practice/domain";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type {
  InboundAttachmentPromotionInput,
  InboundAttachmentPromotionResult,
  InboundEmailAttachmentListOptions,
} from "../inbound-email-contracts.js";
import {
  mapDocumentRow,
  mapInboundEmailAddressRow,
  mapInboundEmailAttachmentRow,
  mapInboundEmailMessageRow,
} from "../drizzle-mappers.js";

function documentChecksumLockKey(input: {
  firmId: string;
  matterId: string;
  checksumSha256: string;
}): string {
  return `${input.firmId}|${input.matterId}|${input.checksumSha256}`;
}

export async function getDrizzleInboundEmailAddressByAddress(
  db: OpenPracticeDatabase,
  firmId: string,
  address: string,
): Promise<InboundEmailAddressRecord | undefined> {
  const normalized = address.trim().toLowerCase();
  const rows = await db
    .select()
    .from(schema.inboundEmailAddresses)
    .where(eq(schema.inboundEmailAddresses.firmId, firmId));
  return rows
    .map(mapInboundEmailAddressRow)
    .find((candidate) => candidate.address.trim().toLowerCase() === normalized);
}

export async function listDrizzleInboundEmailAddresses(
  db: OpenPracticeDatabase,
  firmId: string,
): Promise<InboundEmailAddressRecord[]> {
  const rows = await db
    .select()
    .from(schema.inboundEmailAddresses)
    .where(eq(schema.inboundEmailAddresses.firmId, firmId))
    .orderBy(asc(schema.inboundEmailAddresses.address));
  return rows.map(mapInboundEmailAddressRow);
}

export async function createDrizzleInboundEmailAddress(
  db: OpenPracticeDatabase,
  address: InboundEmailAddressRecord,
): Promise<InboundEmailAddressRecord> {
  await db.insert(schema.inboundEmailAddresses).values({
    ...address,
    createdAt: new Date(address.createdAt),
  });
  return address;
}

export async function listDrizzleInboundEmailMessages(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterId?: string; status?: InboundEmailMessageRecord["status"] } = {},
): Promise<InboundEmailMessageRecord[]> {
  const conditions = [eq(schema.inboundEmailMessages.firmId, firmId)];
  if (options.matterId) conditions.push(eq(schema.inboundEmailMessages.matterId, options.matterId));
  if (options.status) conditions.push(eq(schema.inboundEmailMessages.status, options.status));
  const rows = await db
    .select()
    .from(schema.inboundEmailMessages)
    .where(and(...conditions))
    .orderBy(desc(schema.inboundEmailMessages.receivedAt));
  return rows.map(mapInboundEmailMessageRow);
}

export async function getDrizzleInboundEmailMessage(
  db: OpenPracticeDatabase,
  firmId: string,
  messageId: string,
): Promise<InboundEmailMessageRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.inboundEmailMessages)
    .where(
      and(
        eq(schema.inboundEmailMessages.firmId, firmId),
        eq(schema.inboundEmailMessages.id, messageId),
      ),
    );
  return row ? mapInboundEmailMessageRow(row) : undefined;
}

export async function createDrizzleInboundEmailMessage(
  db: OpenPracticeDatabase,
  message: InboundEmailMessageRecord,
): Promise<InboundEmailMessageRecord> {
  await db.insert(schema.inboundEmailMessages).values({
    ...message,
    receivedAt: new Date(message.receivedAt),
  });
  return message;
}

export async function updateDrizzleInboundEmailMessage(
  db: OpenPracticeDatabase,
  firmId: string,
  messageId: string,
  updates: Partial<Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">>,
): Promise<InboundEmailMessageRecord> {
  const [row] = await db
    .update(schema.inboundEmailMessages)
    .set(updates)
    .where(
      and(
        eq(schema.inboundEmailMessages.firmId, firmId),
        eq(schema.inboundEmailMessages.id, messageId),
      ),
    )
    .returning();
  if (!row) throw new Error("Inbound email message was not found");
  return mapInboundEmailMessageRow(row);
}

export async function createDrizzleInboundEmailAttachment(
  db: OpenPracticeDatabase,
  attachment: InboundEmailAttachmentRecord,
): Promise<InboundEmailAttachmentRecord> {
  await db.insert(schema.inboundEmailAttachments).values(attachment);
  return attachment;
}

export async function listDrizzleInboundEmailAttachments(
  db: OpenPracticeDatabase,
  firmId: string,
  options: string | InboundEmailAttachmentListOptions,
): Promise<InboundEmailAttachmentRecord[]> {
  const inboundMessageIds =
    typeof options === "string"
      ? [options]
      : options.inboundMessageId
        ? [options.inboundMessageId]
        : options.inboundMessageIds;
  if (inboundMessageIds?.length === 0) return [];
  const filters = [eq(schema.inboundEmailAttachments.firmId, firmId)];
  if (inboundMessageIds) {
    filters.push(inArray(schema.inboundEmailAttachments.inboundMessageId, inboundMessageIds));
  }
  const rows = await db
    .select()
    .from(schema.inboundEmailAttachments)
    .where(and(...filters));
  return rows.map(mapInboundEmailAttachmentRow);
}

export async function promoteDrizzleInboundEmailAttachmentToDocument(
  db: OpenPracticeDatabase,
  input: InboundAttachmentPromotionInput,
): Promise<InboundAttachmentPromotionResult> {
  return db.transaction(async (tx) => {
    const [attachmentRow] = await tx
      .select()
      .from(schema.inboundEmailAttachments)
      .where(
        and(
          eq(schema.inboundEmailAttachments.firmId, input.firmId),
          eq(schema.inboundEmailAttachments.inboundMessageId, input.messageId),
          eq(schema.inboundEmailAttachments.id, input.attachmentId),
        ),
      )
      .for("update");
    if (!attachmentRow) throw new Error("Inbound email attachment was not found");
    const attachment = mapInboundEmailAttachmentRow(attachmentRow);
    if (!attachment.checksumSha256) {
      throw new Error("Inbound email attachment checksum is required for document promotion");
    }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${documentChecksumLockKey({
        firmId: input.firmId,
        matterId: input.matterId,
        checksumSha256: attachment.checksumSha256,
      })}, 0))`,
    );
    if (attachment.documentId) {
      const [documentRow] = await tx
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.firmId, input.firmId),
            eq(schema.documents.id, attachment.documentId),
          ),
        );
      if (!documentRow) throw new Error("Promoted document was not found");
      return {
        attachment,
        document: mapDocumentRow(documentRow),
        created: false,
      };
    }

    const [duplicateRow] = await tx
      .select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.firmId, input.firmId),
          eq(schema.documents.matterId, input.matterId),
          eq(schema.documents.checksumSha256, attachment.checksumSha256),
          eq(schema.documents.checksumStatus, "verified"),
        ),
      )
      .limit(1);
    const now = new Date(input.now ?? new Date().toISOString());
    const document = {
      id: crypto.randomUUID(),
      firmId: input.firmId,
      matterId: input.matterId,
      title: input.title,
      storageKey: attachment.storageKey,
      checksumSha256: attachment.checksumSha256,
      version: 1,
      classification: input.classification,
      legalHold: input.legalHold,
      uploadStatus: "verified" as const,
      checksumStatus: duplicateRow ? ("duplicate" as const) : ("verified" as const),
      scanStatus: "queued" as const,
      reviewStatus: "not_required" as const,
      reviewDecision: undefined,
      reviewReason: duplicateRow ? ("duplicate" as const) : ("other" as const),
      reviewMetadata: duplicateRow
        ? { automatedOutcome: "duplicate_detected", duplicateOfDocumentId: duplicateRow.id }
        : { source: "inbound_email_promotion" },
      duplicateOfDocumentId: duplicateRow?.id,
      uploadedAt: now,
      verifiedAt: now,
    } satisfies typeof schema.documents.$inferInsert;
    const [documentRow] = await tx.insert(schema.documents).values(document).returning();
    if (!documentRow) throw new Error("Promoted document was not created");
    const [updatedAttachmentRow] = await tx
      .update(schema.inboundEmailAttachments)
      .set({ documentId: document.id })
      .where(
        and(
          eq(schema.inboundEmailAttachments.firmId, input.firmId),
          eq(schema.inboundEmailAttachments.inboundMessageId, input.messageId),
          eq(schema.inboundEmailAttachments.id, input.attachmentId),
          isNull(schema.inboundEmailAttachments.documentId),
        ),
      )
      .returning();
    if (!updatedAttachmentRow) throw new Error("Inbound email attachment was not linked");
    return {
      attachment: mapInboundEmailAttachmentRow(updatedAttachmentRow),
      document: mapDocumentRow(documentRow) as DocumentRecord,
      created: true,
    };
  });
}
