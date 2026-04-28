import type { BillingStatus } from "./billing.js";

export type Province = "BC" | "ON" | "CANADA" | "OTHER";

export type ProfessionalRole =
  | "owner_admin"
  | "licensee"
  | "firm_member"
  | "billing_bookkeeper"
  | "client_external"
  | "auditor";

export type MatterStatus = "intake" | "open" | "paused" | "closed" | "archived";

export type ContactKind = "person" | "organization";

export type DocumentClassification =
  | "general"
  | "privileged"
  | "work_product"
  | "financial"
  | "identity";

export type DocumentUploadStatus = "intent_created" | "uploaded" | "verified" | "rejected";

export type DocumentChecksumStatus = "pending" | "verified" | "mismatch" | "duplicate";

export type DocumentScanStatus = "pending" | "queued" | "passed" | "failed" | "not_required";

export type PartyRole =
  | "client"
  | "prospective_client"
  | "opposing_party"
  | "opposing_counsel"
  | "witness"
  | "court"
  | "third_party"
  | "notary_client"
  | "paralegal_client";

export interface Firm {
  id: string;
  name: string;
  defaultProvince: Province;
}

export interface FirmBusinessAddress {
  line1: string;
  line2?: string;
  city: string;
  province: Province;
  postalCode: string;
  country: string;
}

export interface FirmSettings {
  firmId: string;
  businessAddress: FirmBusinessAddress;
  officeEmail: string;
  officePhone: string;
  practiceAreas: string[];
  invoicePrefix: string;
  defaultPaymentTermsDays: number;
  trustAccountLabel: string;
  trustFundsCaveatAcceptedAt: string;
  trustFundsCaveatAcceptedByUserId: string;
  website?: string;
  description?: string;
  businessNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PractitionerProfile {
  regulator: string;
  licenseStatus: string;
  jurisdictions: string[];
}

export interface User {
  id: string;
  firmId: string;
  displayName: string;
  email: string;
  role: ProfessionalRole;
  assignedMatterIds: string[];
  mfaEnabled: boolean;
  practitionerProfile?: PractitionerProfile;
}

export interface ContactIdentifier {
  type: "email" | "phone" | "tax_id" | "registry_id";
  value: string;
}

export interface Contact {
  id: string;
  firmId: string;
  kind: ContactKind;
  displayName: string;
  aliases: string[];
  identifiers: ContactIdentifier[];
  notes?: string;
}

export interface Matter {
  id: string;
  firmId: string;
  number: string;
  title: string;
  practiceArea: string;
  status: MatterStatus;
  jurisdiction: Province;
  responsibleUserId: string;
  openedOn?: string;
  closedOn?: string;
}

export interface MatterParty {
  id: string;
  firmId: string;
  matterId: string;
  contactId: string;
  role: PartyRole;
  adverse: boolean;
  confidential: boolean;
}

export interface DocumentRecord {
  id: string;
  firmId: string;
  matterId: string;
  title: string;
  storageKey: string;
  checksumSha256: string;
  version: number;
  classification: DocumentClassification;
  legalHold: boolean;
  uploadStatus: DocumentUploadStatus;
  checksumStatus: DocumentChecksumStatus;
  scanStatus: DocumentScanStatus;
  duplicateOfDocumentId?: string;
  supersedesDocumentId?: string;
  supersededAt?: string;
  uploadedAt?: string;
  verifiedAt?: string;
}

export interface PortalGrant {
  id: string;
  firmId: string;
  matterId: string;
  contactId: string;
  grantedByUserId: string;
  expiresAt?: string;
  revokedAt?: string;
  permissions: Array<"view_documents" | "upload_documents" | "message" | "sign">;
}

export interface TimeEntry {
  id: string;
  firmId: string;
  matterId: string;
  userId: string;
  performedAt: string;
  minutes: number;
  rateCents: number;
  narrative: string;
  billable: boolean;
  billingStatus: BillingStatus;
}

export interface ExpenseEntry {
  id: string;
  firmId: string;
  matterId: string;
  incurredAt: string;
  amountCents: number;
  category: string;
  description: string;
  reimbursable: boolean;
  billingStatus: BillingStatus;
}

export interface ActivityTimelineEntry {
  id: string;
  firmId: string;
  matterId?: string;
  occurredAt: string;
  title: string;
  kind: "audit" | "conflict" | "document" | "portal" | "signature" | "intake" | "task" | "calendar";
  actorId?: string;
  metadata: Record<string, unknown>;
}
