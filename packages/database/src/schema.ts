import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const province = pgEnum("province", ["BC", "ON", "CANADA", "OTHER"]);
export const userRole = pgEnum("user_role", [
  "owner_admin",
  "licensee",
  "firm_member",
  "billing_bookkeeper",
  "client_external",
  "auditor",
]);
export const matterStatus = pgEnum("matter_status", [
  "intake",
  "open",
  "paused",
  "closed",
  "archived",
]);
export const contactKind = pgEnum("contact_kind", ["person", "organization"]);
export const partyRole = pgEnum("party_role", [
  "client",
  "prospective_client",
  "opposing_party",
  "opposing_counsel",
  "witness",
  "court",
  "third_party",
  "notary_client",
  "paralegal_client",
]);
export const documentClassification = pgEnum("document_classification", [
  "general",
  "privileged",
  "work_product",
  "financial",
  "identity",
]);
export const providerSettingKind = pgEnum("provider_setting_kind", [
  "smtp",
  "inbound_email",
  "ai",
  "ocr",
  "transcription",
  "media",
  "storage",
]);
export const jobQueueName = pgEnum("job_queue_name", [
  "email",
  "inbound_email",
  "ai_triage",
  "ocr",
  "transcription",
  "media",
]);
export const jobLifecycleStatus = pgEnum("job_lifecycle_status", [
  "queued",
  "active",
  "completed",
  "failed",
  "dead_letter",
  "skipped",
]);
export const authChallengePurpose = pgEnum("auth_challenge_purpose", [
  "passkey_registration",
  "passkey_authentication",
  "totp_setup",
]);
export const authActionTokenPurpose = pgEnum("auth_action_token_purpose", [
  "password_reset",
  "magic_link",
  "account_recovery",
  "email_verification",
]);

export const firms = pgTable("firms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  defaultProvince: province("default_province").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    role: userRole("role").notNull(),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    oidcSubject: text("oidc_subject"),
    practitionerProfile: jsonb("practitioner_profile").$type<{
      regulator: string;
      licenseStatus: string;
      jurisdictions: string[];
    }>(),
  },
  (table) => ({
    firmEmail: uniqueIndex("users_firm_email_idx").on(table.firmId, table.email),
  }),
);

export const firmSettings = pgTable("firm_settings", {
  firmId: text("firm_id")
    .primaryKey()
    .references(() => firms.id),
  businessAddress: jsonb("business_address")
    .$type<{
      line1: string;
      line2?: string;
      city: string;
      province: "BC" | "ON" | "CANADA" | "OTHER";
      postalCode: string;
      country: string;
    }>()
    .notNull(),
  officeEmail: text("office_email").notNull(),
  officePhone: text("office_phone").notNull(),
  practiceAreas: jsonb("practice_areas").$type<string[]>().notNull().default([]),
  invoicePrefix: text("invoice_prefix").notNull(),
  defaultPaymentTermsDays: integer("default_payment_terms_days").notNull(),
  trustAccountLabel: text("trust_account_label").notNull(),
  trustFundsCaveatAcceptedAt: timestamp("trust_funds_caveat_accepted_at", {
    withTimezone: true,
  }).notNull(),
  trustFundsCaveatAcceptedByUserId: text("trust_funds_caveat_accepted_by_user_id")
    .notNull()
    .references(() => users.id),
  website: text("website"),
  description: text("description"),
  businessNumber: text("business_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providerSettings = pgTable(
  "provider_settings",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    kind: providerSettingKind("kind").notNull(),
    key: text("key").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    encryptedConfig: text("encrypted_config").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmKindKey: uniqueIndex("provider_settings_firm_kind_key_idx").on(
      table.firmId,
      table.kind,
      table.key,
    ),
  }),
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    channel: text("channel").notNull(),
    eventKey: text("event_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userEvent: uniqueIndex("notification_preferences_user_event_idx").on(
      table.firmId,
      table.userId,
      table.channel,
      table.eventKey,
    ),
  }),
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    passwordHash: text("password_hash").notNull(),
    passwordUpdatedAt: timestamp("password_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.firmId, table.userId] }),
  }),
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (table) => ({
    tokenHash: uniqueIndex("auth_sessions_token_hash_idx").on(table.tokenHash),
    userExpiry: index("auth_sessions_user_expiry_idx").on(
      table.firmId,
      table.userId,
      table.expiresAt,
    ),
  }),
);

export const authPasswordSetupTokens = pgTable(
  "auth_password_setup_tokens",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => ({
    tokenHash: uniqueIndex("auth_password_setup_tokens_token_hash_idx").on(table.tokenHash),
  }),
);

export const webAuthnCredentials = pgTable(
  "webauthn_credentials",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: jsonb("transports").$type<string[]>().notNull().default([]),
    deviceType: text("device_type")
      .$type<"singleDevice" | "multiDevice">()
      .notNull()
      .default("singleDevice"),
    backedUp: boolean("backed_up").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
  },
  (table) => ({
    credentialId: uniqueIndex("webauthn_credentials_credential_id_idx").on(table.credentialId),
    userCredential: index("webauthn_credentials_user_idx").on(table.firmId, table.userId),
  }),
);

export const authChallenges = pgTable(
  "auth_challenges",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id").references(() => firms.id),
    userId: text("user_id").references(() => users.id),
    challengeHash: text("challenge_hash").notNull(),
    purpose: authChallengePurpose("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    challengeHash: uniqueIndex("auth_challenges_challenge_hash_idx").on(table.challengeHash),
    firmPurpose: index("auth_challenges_firm_purpose_idx").on(table.firmId, table.purpose),
  }),
);

export const authActionTokens = pgTable(
  "auth_action_tokens",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    purpose: authActionTokenPurpose("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHash: uniqueIndex("auth_action_tokens_token_hash_idx").on(table.tokenHash),
    userPurpose: index("auth_action_tokens_user_purpose_idx").on(
      table.firmId,
      table.userId,
      table.purpose,
    ),
  }),
);

export const totpCredentials = pgTable(
  "totp_credentials",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    encryptedSecret: text("encrypted_secret").notNull(),
    label: text("label").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userActive: index("totp_credentials_user_active_idx").on(
      table.firmId,
      table.userId,
      table.disabledAt,
    ),
  }),
);

export const recoveryCodes = pgTable(
  "recovery_codes",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeHash: uniqueIndex("recovery_codes_code_hash_idx").on(table.codeHash),
    userUnused: index("recovery_codes_user_unused_idx").on(
      table.firmId,
      table.userId,
      table.usedAt,
    ),
  }),
);

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    kind: contactKind("kind").notNull(),
    displayName: text("display_name").notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    identifiers: jsonb("identifiers")
      .$type<Array<{ type: string; value: string }>>()
      .notNull()
      .default([]),
    notes: text("notes"),
  },
  (table) => ({
    firmName: index("contacts_firm_name_idx").on(table.firmId, table.displayName),
  }),
);

export const matters = pgTable(
  "matters",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    number: text("number").notNull(),
    title: text("title").notNull(),
    practiceArea: text("practice_area").notNull(),
    status: matterStatus("status").notNull(),
    jurisdiction: province("jurisdiction").notNull(),
    responsibleUserId: text("responsible_user_id")
      .notNull()
      .references(() => users.id),
    openedOn: timestamp("opened_on", { withTimezone: true }),
    closedOn: timestamp("closed_on", { withTimezone: true }),
  },
  (table) => ({
    firmNumber: uniqueIndex("matters_firm_number_idx").on(table.firmId, table.number),
  }),
);

export const matterAssignments = pgTable(
  "matter_assignments",
  {
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.matterId, table.userId] }),
  }),
);

export const matterParties = pgTable("matter_parties", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  role: partyRole("role").notNull(),
  adverse: boolean("adverse").notNull().default(false),
  confidential: boolean("confidential").notNull().default(false),
});

export const conflictChecks = pgTable("conflict_checks", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  requestedByUserId: text("requested_by_user_id")
    .notNull()
    .references(() => users.id),
  prospectiveName: text("prospective_name").notNull(),
  querySnapshot: jsonb("query_snapshot").notNull(),
  resultSnapshot: jsonb("result_snapshot").notNull(),
  disposition: text("disposition").notNull().default("pending_review"),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  title: text("title").notNull(),
  storageKey: text("storage_key").notNull(),
  checksumSha256: text("checksum_sha256").notNull(),
  version: integer("version").notNull().default(1),
  classification: documentClassification("classification").notNull(),
  legalHold: boolean("legal_hold").notNull().default(false),
  uploadStatus: text("upload_status").notNull().default("intent_created"),
  checksumStatus: text("checksum_status").notNull().default("pending"),
  scanStatus: text("scan_status").notNull().default("pending"),
  duplicateOfDocumentId: text("duplicate_of_document_id"),
  supersedesDocumentId: text("supersedes_document_id"),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentVersions = pgTable(
  "document_versions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    version: integer("version").notNull(),
    storageKey: text("storage_key"),
    editorJson: jsonb("editor_json").$type<Record<string, unknown>>(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentVersion: uniqueIndex("document_versions_document_version_idx").on(
      table.documentId,
      table.version,
    ),
  }),
);

export const documentTextExtractions = pgTable(
  "document_text_extractions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    engine: text("engine").notNull(),
    status: text("status").notNull().default("queued"),
    language: text("language").notNull().default("eng"),
    confidence: integer("confidence"),
    textStorageKey: text("text_storage_key"),
    extractedText: text("extracted_text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    documentStatus: index("document_text_extractions_document_status_idx").on(
      table.documentId,
      table.status,
    ),
  }),
);

export const mediaTranscripts = pgTable(
  "media_transcripts",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    engine: text("engine").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull().default("queued"),
    transcriptStorageKey: text("transcript_storage_key"),
    text: text("text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    documentStatus: index("media_transcripts_document_status_idx").on(
      table.documentId,
      table.status,
    ),
  }),
);

export const mediaDerivatives = pgTable(
  "media_derivatives",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentKind: uniqueIndex("media_derivatives_document_kind_idx").on(
      table.documentId,
      table.kind,
    ),
  }),
);

export const portalGrants = pgTable("portal_grants", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  grantedByUserId: text("granted_by_user_id")
    .notNull()
    .references(() => users.id),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const shareLinks = pgTable(
  "share_links",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    tokenHash: text("token_hash").notNull(),
    grantedByUserId: text("granted_by_user_id")
      .notNull()
      .references(() => users.id),
    permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
    requireEmailVerification: boolean("require_email_verification").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHash: uniqueIndex("share_links_token_hash_idx").on(table.tokenHash),
    matterExpiry: index("share_links_matter_expiry_idx").on(table.matterId, table.expiresAt),
  }),
);

export const externalUploadLinks = pgTable(
  "external_upload_links",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    tokenHash: text("token_hash").notNull(),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    maxUploads: integer("max_uploads").notNull().default(1),
    usedUploads: integer("used_uploads").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHash: uniqueIndex("external_upload_links_token_hash_idx").on(table.tokenHash),
    matterExpiry: index("external_upload_links_matter_expiry_idx").on(
      table.matterId,
      table.expiresAt,
    ),
  }),
);

export const accessLogs = pgTable(
  "access_logs",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    actorId: text("actor_id").references(() => users.id),
    shareLinkId: text("share_link_id").references(() => shareLinks.id),
    externalUploadLinkId: text("external_upload_link_id").references(() => externalUploadLinks.id),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    action: text("action").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmResource: index("access_logs_firm_resource_idx").on(
      table.firmId,
      table.resourceType,
      table.resourceId,
    ),
  }),
);

export const ledgerAccountType = pgEnum("ledger_account_type", [
  "trust_asset",
  "client_liability",
  "operating_revenue",
  "expense",
]);

export const ledgerAccounts = pgTable("ledger_accounts", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  name: text("name").notNull(),
  type: ledgerAccountType("type").notNull(),
});

export const trustTransactions = pgTable(
  "trust_transactions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    postedByUserId: text("posted_by_user_id")
      .notNull()
      .references(() => users.id),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    reversesTransactionId: text("reverses_transaction_id"),
  },
  (table) => ({
    firmIdempotency: uniqueIndex("trust_transactions_idempotency_idx").on(
      table.firmId,
      table.idempotencyKey,
    ),
  }),
);

export const trustLedgerEntries = pgTable(
  "trust_ledger_entries",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => trustTransactions.id),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    clientId: text("client_id")
      .notNull()
      .references(() => contacts.id),
    accountId: text("account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    debitCents: integer("debit_cents").notNull(),
    creditCents: integer("credit_cents").notNull(),
    memo: text("memo").notNull(),
  },
  (table) => ({
    nonNegativeAmounts: check(
      "trust_ledger_entries_non_negative_amounts",
      sql`${table.debitCents} >= 0 and ${table.creditCents} >= 0`,
    ),
    oneSidedAmount: check(
      "trust_ledger_entries_one_sided_amount",
      sql`(${table.debitCents} > 0 and ${table.creditCents} = 0) or (${table.creditCents} > 0 and ${table.debitCents} = 0)`,
    ),
  }),
);

export const trustTransactionApprovals = pgTable("trust_transaction_approvals", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  transactionId: text("transaction_id").notNull(),
  decidedByUserId: text("decided_by_user_id")
    .notNull()
    .references(() => users.id),
  decision: text("decision").notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
  notes: text("notes"),
});

export const trustReconciliations = pgTable("trust_reconciliations", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  accountId: text("account_id")
    .notNull()
    .references(() => ledgerAccounts.id),
  statementPeriodStart: timestamp("statement_period_start", { withTimezone: true }).notNull(),
  statementPeriodEnd: timestamp("statement_period_end", { withTimezone: true }).notNull(),
  expectedBalanceCents: integer("expected_balance_cents").notNull(),
  actualBalanceCents: integer("actual_balance_cents").notNull(),
  status: text("status").notNull(),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  evidence: jsonb("evidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").notNull(),
  previousHash: text("previous_hash").notNull(),
  hash: text("hash").notNull(),
});

export const jobLifecycleRecords = pgTable(
  "job_lifecycle_records",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    queueName: jobQueueName("queue_name").notNull(),
    jobName: text("job_name").notNull(),
    bullJobId: text("bull_job_id"),
    status: jobLifecycleStatus("status").notNull().default("queued"),
    targetResourceType: text("target_resource_type"),
    targetResourceId: text("target_resource_id"),
    attemptsMade: integer("attempts_made").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmStatus: index("job_lifecycle_records_firm_status_idx").on(table.firmId, table.status),
    bullJobId: index("job_lifecycle_records_bull_job_id_idx").on(table.bullJobId),
  }),
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    templateKey: text("template_key").notNull(),
    status: text("status").notNull().default("queued"),
    to: jsonb("to_addresses").$type<string[]>().notNull().default([]),
    cc: jsonb("cc_addresses").$type<string[]>().notNull().default([]),
    bcc: jsonb("bcc_addresses").$type<string[]>().notNull().default([]),
    from: text("from_address").notNull(),
    subject: text("subject").notNull(),
    htmlBody: text("html_body").notNull(),
    textBody: text("text_body").notNull(),
    relatedResourceType: text("related_resource_type"),
    relatedResourceId: text("related_resource_id"),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmStatus: index("email_outbox_firm_status_idx").on(table.firmId, table.status),
  }),
);

export const emailEvents = pgTable(
  "email_events",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    emailId: text("email_id")
      .notNull()
      .references(() => emailOutbox.id),
    eventType: text("event_type").notNull(),
    providerMessageId: text("provider_message_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    emailEvent: index("email_events_email_event_idx").on(table.emailId, table.eventType),
  }),
);

export const inboundEmailAddresses = pgTable(
  "inbound_email_addresses",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    address: text("address").notNull(),
    matterId: text("matter_id").references(() => matters.id),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmAddress: uniqueIndex("inbound_email_addresses_firm_address_idx").on(
      table.firmId,
      table.address,
    ),
  }),
);

export const inboundEmailMessages = pgTable(
  "inbound_email_messages",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    addressId: text("address_id").references(() => inboundEmailAddresses.id),
    matterId: text("matter_id").references(() => matters.id),
    messageId: text("message_id"),
    fromAddress: text("from_address").notNull(),
    toAddresses: jsonb("to_addresses").$type<string[]>().notNull().default([]),
    subject: text("subject").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    rawStorageKey: text("raw_storage_key").notNull(),
    parsedText: text("parsed_text"),
    parsedHtmlStorageKey: text("parsed_html_storage_key"),
    labels: jsonb("labels").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("received"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmReceived: index("inbound_email_messages_firm_received_idx").on(
      table.firmId,
      table.receivedAt,
    ),
  }),
);

export const inboundEmailAttachments = pgTable("inbound_email_attachments", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  inboundMessageId: text("inbound_message_id")
    .notNull()
    .references(() => inboundEmailMessages.id),
  documentId: text("document_id").references(() => documents.id),
  filename: text("filename").notNull(),
  contentType: text("content_type"),
  sizeBytes: integer("size_bytes"),
  storageKey: text("storage_key").notNull(),
  checksumSha256: text("checksum_sha256"),
});

export const aiTriageRecords = pgTable(
  "ai_triage_records",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull().default("pending"),
    classification: text("classification"),
    confidence: integer("confidence"),
    extractedEntities: jsonb("extracted_entities")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    suggestedActions: jsonb("suggested_actions").$type<string[]>().notNull().default([]),
    suggestedDraft: text("suggested_draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  },
  (table) => ({
    firmSource: index("ai_triage_records_firm_source_idx").on(
      table.firmId,
      table.sourceType,
      table.sourceId,
    ),
  }),
);

export const timeEntries = pgTable("time_entries", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
  minutes: integer("minutes").notNull(),
  rateCents: integer("rate_cents").notNull(),
  narrative: text("narrative").notNull(),
  billable: boolean("billable").notNull().default(true),
  billingStatus: text("billing_status").notNull().default("draft"),
});

export const expenseEntries = pgTable("expense_entries", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  incurredAt: timestamp("incurred_at", { withTimezone: true }).notNull().defaultNow(),
  amountCents: integer("amount_cents").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  reimbursable: boolean("reimbursable").notNull().default(true),
  billingStatus: text("billing_status").notNull().default("draft"),
});

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    clientContactId: text("client_contact_id").references(() => contacts.id),
    invoiceNumber: text("invoice_number").notNull(),
    status: text("status").notNull().default("draft"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    memo: text("memo"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    paidCents: integer("paid_cents").notNull().default(0),
    balanceDueCents: integer("balance_due_cents").notNull().default(0),
  },
  (table) => ({
    firmNumber: uniqueIndex("invoices_firm_number_idx").on(table.firmId, table.invoiceNumber),
    matterStatus: index("invoices_matter_status_idx").on(table.matterId, table.status),
  }),
);

export const invoiceLines = pgTable("invoice_lines", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  kind: text("kind").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitAmountCents: integer("unit_amount_cents").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  taxName: text("tax_name"),
  taxRateBps: integer("tax_rate_bps").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  timeEntryId: text("time_entry_id").references(() => timeEntries.id),
  expenseEntryId: text("expense_entry_id").references(() => expenseEntries.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const manualPayments = pgTable("manual_payments", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  invoiceId: text("invoice_id").references(() => invoices.id),
  clientContactId: text("client_contact_id").references(() => contacts.id),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  status: text("status").notNull().default("received"),
  receivedByUserId: text("received_by_user_id")
    .notNull()
    .references(() => users.id),
  notes: text("notes"),
  evidence: jsonb("evidence").notNull().default({}),
});

export const paymentAllocations = pgTable("payment_allocations", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  paymentId: text("payment_id")
    .notNull()
    .references(() => manualPayments.id),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  amountCents: integer("amount_cents").notNull(),
  allocatedAt: timestamp("allocated_at", { withTimezone: true }).notNull(),
});

export const billingTrustTransferRequests = pgTable("billing_trust_transfer_requests", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  clientContactId: text("client_contact_id").references(() => contacts.id),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  requestedByUserId: text("requested_by_user_id")
    .notNull()
    .references(() => users.id),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("pending_approval"),
  reason: text("reason"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  ledgerTransactionId: text("ledger_transaction_id").references(() => trustTransactions.id),
  evidence: jsonb("evidence").notNull().default({}),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  assignedToUserId: text("assigned_to_user_id").references(() => users.id),
  title: text("title").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const calendarEvents = pgTable("calendar_events", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id").references(() => matters.id),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
});

export const signatureRequests = pgTable("signature_requests", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id),
  title: text("title").notNull(),
  requestedByUserId: text("requested_by_user_id")
    .notNull()
    .references(() => users.id),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  status: text("status").notNull(),
  signingUrl: text("signing_url"),
  consentText: text("consent_text").notNull().default(""),
  evidence: jsonb("evidence").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  declinedAt: timestamp("declined_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const signatureRequestSigners = pgTable("signature_request_signers", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  signatureRequestId: text("signature_request_id")
    .notNull()
    .references(() => signatureRequests.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
  signingUrl: text("signing_url"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const signatureProviderEvents = pgTable("signature_provider_events", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  signatureRequestId: text("signature_request_id")
    .notNull()
    .references(() => signatureRequests.id),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  status: text("status").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  evidence: jsonb("evidence").notNull(),
});

export const signatureWebhookAttempts = pgTable("signature_webhook_attempts", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  payload: jsonb("payload").notNull(),
});

export const intakeTemplates = pgTable("intake_templates", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  externalTemplateId: text("external_template_id").notNull(),
  active: boolean("active").notNull().default(true),
});

export const intakeSessions = pgTable("intake_sessions", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  templateId: text("template_id")
    .notNull()
    .references(() => intakeTemplates.id),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  status: text("status").notNull(),
  clientContactId: text("client_contact_id").references(() => contacts.id),
  interviewUrl: text("interview_url"),
  evidence: jsonb("evidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const answerSnapshots = pgTable("answer_snapshots", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  intakeSessionId: text("intake_session_id")
    .notNull()
    .references(() => intakeSessions.id),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  answers: jsonb("answers").notNull(),
});

export const generatedDocuments = pgTable("generated_documents", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  intakeSessionId: text("intake_session_id")
    .notNull()
    .references(() => intakeSessions.id),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  documentId: text("document_id").references(() => documents.id),
  storageKey: text("storage_key"),
  checksumSha256: text("checksum_sha256"),
  evidence: jsonb("evidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
