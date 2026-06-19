import type {
  CalendarEventRecord,
  CalendarGuestLinkRecord,
  Contact,
  ConversationThreadRecord,
  DocumentRecord,
  EmailOutboxRecord,
  EmailReceiptTokenRecord,
  ExternalUploadLinkRecord,
  HostedPaymentRequestRecord,
  IntakeFormItemActionRecord,
  IntakeFormLinkRecord,
  PortalDocumentAccess,
  PortalGrant,
  ShareLinkRecord,
  SignatureProviderEventRecord,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
} from "@open-practice/domain";
import type { InvoiceWithLines } from "./billing-invoices-payments-contracts.js";

export interface ClientPortalGrantContactPair {
  grant: PortalGrant;
  contact: Contact;
}

export interface ClientPortalWorkspaceBatch {
  intakeLinks: IntakeFormLinkRecord[];
  itemActions: IntakeFormItemActionRecord[];
  emails: EmailOutboxRecord[];
  receiptTokens: EmailReceiptTokenRecord[];
  shareLinks: ShareLinkRecord[];
  externalUploadLinks: ExternalUploadLinkRecord[];
  documents: DocumentRecord[];
  guestLinks: CalendarGuestLinkRecord[];
  calendarEvents: CalendarEventRecord[];
  conversationThreads: ConversationThreadRecord[];
  invoices: InvoiceWithLines[];
  paymentRequests: HostedPaymentRequestRecord[];
  portalDocumentAccess: PortalDocumentAccess[];
  signatureRequests: SignatureRequestRecord[];
  signatureSigners: SignatureRequestSignerRecord[];
  signatureEvents: SignatureProviderEventRecord[];
}

export interface ClientPortalWorkspaceRepository {
  listClientPortalGrantContactPairs(input: {
    firmId: string;
    userId: string;
    userEmail: string;
    now: string;
  }): Promise<ClientPortalGrantContactPair[]>;
  listClientPortalWorkspaceBatch(
    firmId: string,
    options: { matterIds: string[]; emailOutboxLimitPerMatter: number },
  ): Promise<ClientPortalWorkspaceBatch>;
}
