import type {
  DocumentRecord,
  InboundEmailAddressRecord,
  InboundEmailAttachmentRecord,
  InboundEmailMessageRecord,
} from "@open-practice/domain";

export interface InboundAttachmentPromotionInput {
  firmId: string;
  messageId: string;
  attachmentId: string;
  matterId: string;
  title: string;
  classification: DocumentRecord["classification"];
  legalHold: boolean;
  now?: string;
}

export interface InboundAttachmentPromotionResult {
  attachment: InboundEmailAttachmentRecord;
  document: DocumentRecord;
  created: boolean;
}

export interface InboundEmailAttachmentListOptions {
  inboundMessageId?: string;
  inboundMessageIds?: string[];
}

export interface InboundEmailRepository {
  getInboundEmailAddressByAddress(
    firmId: string,
    address: string,
  ): Promise<InboundEmailAddressRecord | undefined>;
  listInboundEmailAddresses(firmId: string): Promise<InboundEmailAddressRecord[]>;
  createInboundEmailAddress(address: InboundEmailAddressRecord): Promise<InboundEmailAddressRecord>;
  listInboundEmailMessages(
    firmId: string,
    options?: { matterId?: string; status?: InboundEmailMessageRecord["status"] },
  ): Promise<InboundEmailMessageRecord[]>;
  getInboundEmailMessage(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailMessageRecord | undefined>;
  createInboundEmailMessage(message: InboundEmailMessageRecord): Promise<InboundEmailMessageRecord>;
  updateInboundEmailMessage(
    firmId: string,
    messageId: string,
    updates: Partial<
      Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">
    >,
  ): Promise<InboundEmailMessageRecord>;
  createInboundEmailAttachment(
    attachment: InboundEmailAttachmentRecord,
  ): Promise<InboundEmailAttachmentRecord>;
  listInboundEmailAttachments(
    firmId: string,
    options: string | InboundEmailAttachmentListOptions,
  ): Promise<InboundEmailAttachmentRecord[]>;
  promoteInboundEmailAttachmentToDocument(
    input: InboundAttachmentPromotionInput,
  ): Promise<InboundAttachmentPromotionResult>;
}
