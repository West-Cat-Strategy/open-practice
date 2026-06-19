import type {
  DocumentRecord,
  InboundEmailAddressRecord,
  InboundEmailAttachmentRecord,
  InboundEmailMessageRecord,
} from "@open-practice/domain";
import { clone } from "../contracts.js";
import type {
  InboundAttachmentPromotionInput,
  InboundAttachmentPromotionResult,
  InboundEmailAttachmentListOptions,
} from "../inbound-email-contracts.js";

export interface MemoryInboundEmailStore {
  inboundEmailAddresses: InboundEmailAddressRecord[];
  inboundEmailMessages: InboundEmailMessageRecord[];
  inboundEmailAttachments: InboundEmailAttachmentRecord[];
  documents: DocumentRecord[];
}

export function getMemoryInboundEmailAddressByAddress(
  store: MemoryInboundEmailStore,
  firmId: string,
  address: string,
): InboundEmailAddressRecord | undefined {
  const normalized = address.trim().toLowerCase();
  return clone(
    store.inboundEmailAddresses.find(
      (candidate) =>
        candidate.firmId === firmId && candidate.address.trim().toLowerCase() === normalized,
    ),
  );
}

export function listMemoryInboundEmailAddresses(
  store: MemoryInboundEmailStore,
  firmId: string,
): InboundEmailAddressRecord[] {
  return clone(store.inboundEmailAddresses.filter((address) => address.firmId === firmId));
}

export function createMemoryInboundEmailAddress(
  store: MemoryInboundEmailStore,
  address: InboundEmailAddressRecord,
): InboundEmailAddressRecord {
  const normalized = address.address.trim().toLowerCase();
  if (
    store.inboundEmailAddresses.some(
      (candidate) =>
        candidate.firmId === address.firmId &&
        candidate.address.trim().toLowerCase() === normalized,
    )
  ) {
    throw new Error("Inbound email address already exists");
  }
  store.inboundEmailAddresses.push(clone(address));
  return clone(address);
}

export function listMemoryInboundEmailMessages(
  store: MemoryInboundEmailStore,
  firmId: string,
  options: { matterId?: string; status?: InboundEmailMessageRecord["status"] } = {},
): InboundEmailMessageRecord[] {
  return clone(
    store.inboundEmailMessages
      .filter(
        (message) =>
          message.firmId === firmId &&
          (!options.matterId || message.matterId === options.matterId) &&
          (!options.status || message.status === options.status),
      )
      .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)),
  );
}

export function getMemoryInboundEmailMessage(
  store: MemoryInboundEmailStore,
  firmId: string,
  messageId: string,
): InboundEmailMessageRecord | undefined {
  return clone(
    store.inboundEmailMessages.find(
      (message) => message.firmId === firmId && message.id === messageId,
    ),
  );
}

export function createMemoryInboundEmailMessage(
  store: MemoryInboundEmailStore,
  message: InboundEmailMessageRecord,
): InboundEmailMessageRecord {
  store.inboundEmailMessages.push(clone(message));
  return clone(message);
}

export function updateMemoryInboundEmailMessage(
  store: MemoryInboundEmailStore,
  firmId: string,
  messageId: string,
  updates: Partial<Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">>,
): InboundEmailMessageRecord {
  const index = store.inboundEmailMessages.findIndex(
    (message) => message.firmId === firmId && message.id === messageId,
  );
  if (index === -1) throw new Error("Inbound email message was not found");
  const updated = { ...store.inboundEmailMessages[index]!, ...clone(updates) };
  store.inboundEmailMessages[index] = updated;
  return clone(updated);
}

export function createMemoryInboundEmailAttachment(
  store: MemoryInboundEmailStore,
  attachment: InboundEmailAttachmentRecord,
): InboundEmailAttachmentRecord {
  store.inboundEmailAttachments.push(clone(attachment));
  return clone(attachment);
}

export function listMemoryInboundEmailAttachments(
  store: MemoryInboundEmailStore,
  firmId: string,
  options: string | InboundEmailAttachmentListOptions,
): InboundEmailAttachmentRecord[] {
  const inboundMessageIds =
    typeof options === "string"
      ? [options]
      : options.inboundMessageId
        ? [options.inboundMessageId]
        : options.inboundMessageIds;
  if (inboundMessageIds?.length === 0) return [];
  return clone(
    store.inboundEmailAttachments.filter(
      (attachment) =>
        attachment.firmId === firmId &&
        (!inboundMessageIds || inboundMessageIds.includes(attachment.inboundMessageId)),
    ),
  );
}

export function promoteMemoryInboundEmailAttachmentToDocument(
  store: MemoryInboundEmailStore,
  input: InboundAttachmentPromotionInput,
): InboundAttachmentPromotionResult {
  const attachmentIndex = store.inboundEmailAttachments.findIndex(
    (attachment) =>
      attachment.firmId === input.firmId &&
      attachment.inboundMessageId === input.messageId &&
      attachment.id === input.attachmentId,
  );
  if (attachmentIndex === -1) throw new Error("Inbound email attachment was not found");
  const attachment = store.inboundEmailAttachments[attachmentIndex]!;
  if (!attachment.checksumSha256) {
    throw new Error("Inbound email attachment checksum is required for document promotion");
  }
  if (attachment.documentId) {
    const document = store.documents.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === attachment.documentId,
    );
    if (!document) throw new Error("Promoted document was not found");
    return { attachment: clone(attachment), document: clone(document), created: false };
  }

  const duplicate = store.documents.find(
    (candidate) =>
      candidate.firmId === input.firmId &&
      candidate.matterId === input.matterId &&
      candidate.checksumSha256 === attachment.checksumSha256 &&
      candidate.checksumStatus === "verified",
  );
  const now = input.now ?? new Date().toISOString();
  const document: DocumentRecord = {
    id: crypto.randomUUID(),
    firmId: input.firmId,
    matterId: input.matterId,
    title: input.title,
    storageKey: attachment.storageKey,
    checksumSha256: attachment.checksumSha256,
    version: 1,
    classification: input.classification,
    legalHold: input.legalHold,
    uploadStatus: "verified",
    checksumStatus: duplicate ? "duplicate" : "verified",
    scanStatus: "queued",
    reviewStatus: "not_required",
    reviewDecision: undefined,
    reviewReason: duplicate ? "duplicate" : "other",
    reviewMetadata: duplicate
      ? { automatedOutcome: "duplicate_detected", duplicateOfDocumentId: duplicate.id }
      : { source: "inbound_email_promotion" },
    duplicateOfDocumentId: duplicate?.id,
    uploadedAt: now,
    verifiedAt: now,
  };
  store.documents.push(clone(document));
  const updatedAttachment = { ...attachment, documentId: document.id };
  store.inboundEmailAttachments[attachmentIndex] = clone(updatedAttachment);
  return {
    attachment: clone(updatedAttachment),
    document: clone(document),
    created: true,
  };
}
