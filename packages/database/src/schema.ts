import {
  boolean,
  check,
  type AnyPgColumn,
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
import type {
  ConnectorSecretReference,
  ConversationThreadRecord,
  DraftAssistRecord,
  EmbeddedIntakeTemplateDefinition,
  IntakeFormReviewRecord,
  IntakeFormItemActionRecord,
  IntakeResolutionSnapshot,
  IntakeVariableProposal,
  ConversationMessageRecord,
  LegalClinicMatterProfile,
  LegalClinicProgram,
  LedgerReconciliationStatementRow,
  SavedOperationalViewDefinition,
} from "@open-practice/domain";

export const province = pgEnum("province", ["BC", "ON", "CANADA", "OTHER"]);
export const legalClinicProgramStatus = pgEnum("legal_clinic_program_status", [
  "active",
  "paused",
  "archived",
]);
export const legalClinicEligibilityStatus = pgEnum("legal_clinic_eligibility_status", [
  "unknown",
  "likely_eligible",
  "ineligible",
  "needs_review",
]);
export const legalClinicReferralStatus = pgEnum("legal_clinic_referral_status", [
  "not_referred",
  "referral_needed",
  "referred",
  "accepted",
  "declined",
]);
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
  "connectors",
  "inbound_email",
  "reports",
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
export const conversationThreadStatus = pgEnum("conversation_thread_status", [
  "open",
  "closed",
  "revoked",
]);
export const conversationThreadExportState = pgEnum("conversation_thread_export_state", [
  "not_requested",
  "requested",
  "exported",
]);
export const conversationThreadNotificationBoundary = pgEnum(
  "conversation_thread_notification_boundary",
  ["disabled", "internal_only"],
);
export const conversationMessageKind = pgEnum("conversation_message_kind", [
  "internal_note",
  "client_message",
  "imported_email",
]);
export const savedOperationalViewSurface = pgEnum("saved_operational_view_surface", ["queues"]);
export const savedOperationalViewStatus = pgEnum("saved_operational_view_status", [
  "active",
  "archived",
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

export const savedOperationalViewDefinitions = pgTable(
  "saved_operational_view_definitions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id),
    surface: savedOperationalViewSurface("surface").notNull(),
    name: text("name").notNull(),
    filters: jsonb("filters").$type<SavedOperationalViewDefinition["filters"]>().notNull(),
    columns: jsonb("columns").$type<SavedOperationalViewDefinition["columns"]>().notNull(),
    sort: jsonb("sort").$type<SavedOperationalViewDefinition["sort"]>().notNull(),
    rowLimit: integer("row_limit").notNull(),
    dashboardBehavior: jsonb("dashboard_behavior")
      .$type<SavedOperationalViewDefinition["dashboardBehavior"]>()
      .notNull(),
    permissionScope: jsonb("permission_scope")
      .$type<SavedOperationalViewDefinition["permissionScope"]>()
      .notNull(),
    status: savedOperationalViewStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => ({
    ownerSurfaceStatus: index("saved_operational_views_owner_surface_status_idx").on(
      table.firmId,
      table.ownerUserId,
      table.surface,
      table.status,
    ),
    firmSurfaceName: index("saved_operational_views_firm_surface_name_idx").on(
      table.firmId,
      table.surface,
      table.name,
    ),
    positiveRowLimit: check("saved_operational_views_positive_row_limit", sql`row_limit > 0`),
  }),
);

export const connectors = pgTable(
  "connectors",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    type: text("type").notNull(),
    key: text("key").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("disabled"),
    secretReference: jsonb("secret_reference").$type<ConnectorSecretReference>(),
    configSummary: jsonb("config_summary").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmKey: uniqueIndex("connectors_firm_key_idx").on(table.firmId, table.key),
    firmTypeStatus: index("connectors_firm_type_status_idx").on(
      table.firmId,
      table.type,
      table.status,
    ),
    statusValue: check(
      "connectors_status_value",
      sql`${table.status} in ('disabled', 'enabled', 'paused', 'error')`,
    ),
    typeValue: check(
      "connectors_type_value",
      sql`${table.type} in ('calendar', 'document_processing', 'email', 'generic', 'inbound_email')`,
    ),
  }),
);

export const connectorOutbox = pgTable(
  "connector_outbox",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    connectorId: text("connector_id")
      .notNull()
      .references(() => connectors.id),
    eventType: text("event_type").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("pending"),
    payloadSummary: jsonb("payload_summary").$type<Record<string, unknown>>().notNull().default({}),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    leaseId: text("lease_id"),
    leasedUntil: timestamp("leased_until", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
    lastErrorSummary: text("last_error_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmIdempotency: uniqueIndex("connector_outbox_firm_idempotency_idx").on(
      table.firmId,
      table.idempotencyKey,
    ),
    firmStatusNextAttempt: index("connector_outbox_firm_status_next_attempt_idx").on(
      table.firmId,
      table.status,
      table.nextAttemptAt,
    ),
    connectorStatus: index("connector_outbox_connector_status_idx").on(
      table.connectorId,
      table.status,
    ),
    statusValue: check(
      "connector_outbox_status_value",
      sql`${table.status} in ('pending', 'leased', 'delivered', 'failed', 'dead_letter', 'cancelled')`,
    ),
  }),
);

export const connectorDeliveryAttempts = pgTable(
  "connector_delivery_attempts",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    connectorId: text("connector_id")
      .notNull()
      .references(() => connectors.id),
    outboxId: text("outbox_id")
      .notNull()
      .references(() => connectorOutbox.id),
    attemptNumber: integer("attempt_number").notNull(),
    status: text("status").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    leaseId: text("lease_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorSummary: text("error_summary"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    outboxAttempt: uniqueIndex("connector_delivery_attempts_outbox_attempt_idx").on(
      table.outboxId,
      table.attemptNumber,
    ),
    firmConnectorStarted: index("connector_delivery_attempts_firm_connector_started_idx").on(
      table.firmId,
      table.connectorId,
      table.startedAt,
    ),
    statusValue: check(
      "connector_delivery_attempts_status_value",
      sql`${table.status} in ('leased', 'delivered', 'failed')`,
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

export const calendarCredentials = pgTable(
  "calendar_credentials",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    username: text("username").notNull(),
    label: text("label").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    username: uniqueIndex("calendar_credentials_username_idx").on(table.username),
    userActive: index("calendar_credentials_user_active_idx").on(
      table.firmId,
      table.userId,
      table.revokedAt,
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

export const legalClinicPrograms = pgTable(
  "legal_clinic_programs",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    name: text("name").notNull(),
    status: legalClinicProgramStatus("status").notNull().default("active"),
    serviceArea: text("service_area").notNull(),
    eligibilitySummary: text("eligibility_summary").notNull(),
    defaultReferralSource: text("default_referral_source"),
    defaultReferralStatus: legalClinicReferralStatus("default_referral_status")
      .notNull()
      .default("not_referred"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<LegalClinicProgram["metadata"]>().notNull().default({}),
  },
  (table) => ({
    firmName: uniqueIndex("legal_clinic_programs_firm_name_idx").on(table.firmId, table.name),
    firmStatus: index("legal_clinic_programs_firm_status_idx").on(table.firmId, table.status),
  }),
);

export const legalClinicMatterProfiles = pgTable(
  "legal_clinic_matter_profiles",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    programId: text("program_id")
      .notNull()
      .references(() => legalClinicPrograms.id),
    eligibilityStatus: legalClinicEligibilityStatus("eligibility_status")
      .notNull()
      .default("unknown"),
    referralSource: text("referral_source"),
    referralStatus: legalClinicReferralStatus("referral_status").notNull().default("not_referred"),
    referralDate: timestamp("referral_date", { withTimezone: true }),
    nextReviewDate: timestamp("next_review_date", { withTimezone: true }),
    clinicRelationshipRole: text("clinic_relationship_role").notNull(),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
    metadata: jsonb("metadata").$type<LegalClinicMatterProfile["metadata"]>().notNull().default({}),
  },
  (table) => ({
    firmMatter: uniqueIndex("legal_clinic_matter_profiles_firm_matter_idx").on(
      table.firmId,
      table.matterId,
    ),
    firmProgramStatus: index("legal_clinic_matter_profiles_program_status_idx").on(
      table.firmId,
      table.programId,
      table.referralStatus,
    ),
    matterReview: index("legal_clinic_matter_profiles_review_idx").on(
      table.firmId,
      table.nextReviewDate,
    ),
  }),
);

export const conversationThreads = pgTable(
  "conversation_threads",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    topic: text("topic").notNull(),
    status: conversationThreadStatus("status").notNull().default("open"),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    exportState: conversationThreadExportState("export_state").notNull().default("not_requested"),
    accessRevokedAt: timestamp("access_revoked_at", { withTimezone: true }),
    notificationBoundary: conversationThreadNotificationBoundary("notification_boundary")
      .notNull()
      .default("disabled"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
    metadata: jsonb("metadata").$type<ConversationThreadRecord["metadata"]>().notNull().default({}),
  },
  (table) => ({
    firmMatterUpdated: index("conversation_threads_firm_matter_updated_idx").on(
      table.firmId,
      table.matterId,
      table.updatedAt,
    ),
    firmMatterTopic: uniqueIndex("conversation_threads_firm_matter_topic_idx").on(
      table.firmId,
      table.matterId,
      table.topic,
    ),
  }),
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    threadId: text("thread_id")
      .notNull()
      .references(() => conversationThreads.id),
    kind: conversationMessageKind("kind").notNull().default("internal_note"),
    bodyText: text("body_text").notNull(),
    authoredAt: timestamp("authored_at", { withTimezone: true }).notNull(),
    authoredByUserId: text("authored_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    metadata: jsonb("metadata")
      .$type<ConversationMessageRecord["metadata"]>()
      .notNull()
      .default({}),
  },
  (table) => ({
    firmMatterThreadAuthored: index("conversation_messages_firm_matter_thread_authored_idx").on(
      table.firmId,
      table.matterId,
      table.threadId,
      table.authoredAt,
    ),
  }),
);

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
  reviewStatus: text("review_status").notNull().default("not_required"),
  reviewDecision: text("review_decision"),
  reviewReason: text("review_reason"),
  reviewMetadata: jsonb("review_metadata").$type<Record<string, unknown>>().notNull().default({}),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  externalUploadLinkId: text("external_upload_link_id").references(() => externalUploadLinks.id),
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
    idempotencyKey: text("idempotency_key"),
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
    firmIdempotency: uniqueIndex("external_upload_links_firm_idempotency_idx").on(
      table.firmId,
      table.idempotencyKey,
    ),
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
    intakeFormLinkId: text("intake_form_link_id").references(() => intakeFormLinks.id),
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

export const trustClientBalances = pgTable(
  "trust_client_balances",
  {
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    clientId: text("client_id")
      .notNull()
      .references(() => contacts.id),
    balanceCents: integer("balance_cents").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.firmId, table.matterId, table.clientId] }),
    nonNegativeBalance: check(
      "trust_client_balances_non_negative_balance",
      sql`${table.balanceCents} >= 0`,
    ),
  }),
);

export const trustTransactionApprovals = pgTable(
  "trust_transaction_approvals",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => trustTransactions.id),
    decidedByUserId: text("decided_by_user_id")
      .notNull()
      .references(() => users.id),
    decision: text("decision").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
  },
  (table) => ({
    reviewerDecision: uniqueIndex("trust_transaction_approvals_reviewer_decision_idx").on(
      table.firmId,
      table.transactionId,
      table.decidedByUserId,
    ),
    decisionValue: check(
      "trust_transaction_approvals_decision_value",
      sql`${table.decision} in ('approved', 'rejected')`,
    ),
  }),
);

export const trustReconciliations = pgTable(
  "trust_reconciliations",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    accountId: text("account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    statementPeriodStart: timestamp("statement_period_start", { withTimezone: true }).notNull(),
    statementPeriodEnd: timestamp("statement_period_end", { withTimezone: true }).notNull(),
    beginningBalanceCents: integer("beginning_balance_cents").notNull(),
    endingBalanceCents: integer("ending_balance_cents").notNull(),
    expectedBalanceCents: integer("expected_balance_cents").notNull(),
    actualBalanceCents: integer("actual_balance_cents").notNull(),
    status: text("status").notNull(),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    statementRows: jsonb("statement_rows")
      .$type<LedgerReconciliationStatementRow[]>()
      .notNull()
      .default([]),
    varianceExplanation: text("variance_explanation"),
    evidence: jsonb("evidence").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    validPeriod: check(
      "trust_reconciliations_valid_period",
      sql`${table.statementPeriodEnd} > ${table.statementPeriodStart}`,
    ),
    statusValue: check(
      "trust_reconciliations_status_value",
      sql`${table.status} in ('draft', 'matched', 'exception', 'reviewed')`,
    ),
  }),
);

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
    idempotencyKey: text("idempotency_key"),
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
    firmIdempotency: uniqueIndex("job_lifecycle_records_firm_idempotency_idx").on(
      table.firmId,
      table.idempotencyKey,
    ),
  }),
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    idempotencyKey: text("idempotency_key"),
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
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    terminalFailureAt: timestamp("terminal_failure_at", { withTimezone: true }),
    terminalFailureReason: text("terminal_failure_reason"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmIdempotency: uniqueIndex("email_outbox_firm_idempotency_idx").on(
      table.firmId,
      table.idempotencyKey,
    ),
    firmStatus: index("email_outbox_firm_status_idx").on(table.firmId, table.status),
    firmMatterQueued: index("email_outbox_firm_matter_queued_idx").on(
      table.firmId,
      table.matterId,
      table.queuedAt,
    ),
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
    attemptNumber: integer("attempt_number"),
    jobId: text("job_id"),
    source: text("source").notNull().default("api"),
    errorMessage: text("error_message"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    emailEvent: index("email_events_email_event_idx").on(table.emailId, table.eventType),
    emailOccurred: index("email_events_email_occurred_idx").on(table.emailId, table.occurredAt),
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

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    uid: text("uid").notNull(),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    description: text("description"),
    location: text("location"),
    status: text("status").notNull().default("confirmed"),
    sequence: integer("sequence").notNull().default(0),
    meetingLinkMode: text("meeting_link_mode").notNull().default("blank"),
    meetingLinkUrl: text("meeting_link_url"),
    meetingRoomId: text("meeting_room_id"),
    meetingProviderKey: text("meeting_provider_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    firmMatterUid: uniqueIndex("calendar_events_firm_matter_uid_idx")
      .on(table.firmId, table.matterId, table.uid)
      .where(sql`${table.deletedAt} is null`),
    matterStart: index("calendar_events_matter_start_idx").on(
      table.firmId,
      table.matterId,
      table.startsAt,
    ),
    meetingLinkModeValue: check(
      "calendar_events_meeting_link_mode_value",
      sql`${table.meetingLinkMode} in ('blank', 'external_url', 'hosted_webrtc')`,
    ),
  }),
);

export const calendarEventAttendees = pgTable(
  "calendar_event_attendees",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    eventId: text("event_id")
      .notNull()
      .references(() => calendarEvents.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("required"),
    responseStatus: text("response_status").notNull().default("needs_action"),
    invitationStatus: text("invitation_status").notNull().default("not_sent"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    invitationEmailId: text("invitation_email_id").references(() => emailOutbox.id),
    invitationJobId: text("invitation_job_id").references(() => jobLifecycleRecords.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    firmEventEmail: uniqueIndex("calendar_event_attendees_firm_event_email_idx")
      .on(table.firmId, table.eventId, table.email)
      .where(sql`${table.deletedAt} is null`),
    eventActive: index("calendar_event_attendees_event_active_idx").on(
      table.firmId,
      table.matterId,
      table.eventId,
      table.deletedAt,
    ),
    roleValue: check(
      "calendar_event_attendees_role_value",
      sql`${table.role} in ('required', 'optional')`,
    ),
    responseStatusValue: check(
      "calendar_event_attendees_response_status_value",
      sql`${table.responseStatus} in ('needs_action', 'accepted', 'tentative', 'declined')`,
    ),
    invitationStatusValue: check(
      "calendar_event_attendees_invitation_status_value",
      sql`${table.invitationStatus} in ('not_sent', 'queued', 'skipped')`,
    ),
  }),
);

export const calendarEventReminders = pgTable(
  "calendar_event_reminders",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    eventId: text("event_id")
      .notNull()
      .references(() => calendarEvents.id),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    channel: text("channel").notNull().default("dashboard"),
    status: text("status").notNull().default("pending"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    eventActive: index("calendar_event_reminders_event_active_idx").on(
      table.firmId,
      table.matterId,
      table.eventId,
      table.deletedAt,
    ),
    statusDue: index("calendar_event_reminders_status_due_idx").on(
      table.firmId,
      table.status,
      table.remindAt,
    ),
    channelValue: check(
      "calendar_event_reminders_channel_value",
      sql`${table.channel} in ('dashboard')`,
    ),
    statusValue: check(
      "calendar_event_reminders_status_value",
      sql`${table.status} in ('pending', 'acknowledged', 'dismissed', 'cancelled')`,
    ),
  }),
);

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
  description: text("description"),
  category: text("category").notNull().default("general"),
  provider: text("provider").notNull(),
  externalTemplateId: text("external_template_id").notNull(),
  active: boolean("active").notNull().default(true),
  definitionVersion: integer("definition_version").notNull().default(1),
  definition: jsonb("definition").$type<EmbeddedIntakeTemplateDefinition>().notNull().default({
    schemaVersion: 1,
    questions: [],
    branchRules: [],
    packages: [],
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
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
  resolution: jsonb("resolution").$type<IntakeResolutionSnapshot>().notNull().default({
    templateId: "",
    templateVersion: 1,
    visibleQuestionIds: [],
    matchedBranchRuleIds: [],
    eligiblePackageIds: [],
    selectedPackageIds: [],
    packageSummaries: [],
    packageDocuments: [],
  }),
});

export const intakeFormLinks = pgTable(
  "intake_form_links",
  {
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
    tokenHash: text("token_hash").notNull(),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    clientContactId: text("client_contact_id").references(() => contacts.id),
    parentFormLinkId: text("parent_form_link_id").references((): AnyPgColumn => intakeFormLinks.id),
    answerSnapshotId: text("answer_snapshot_id").references(() => answerSnapshots.id),
    clientSubmissionId: text("client_submission_id"),
    submissionFingerprint: text("submission_fingerprint"),
    draftAnswers: jsonb("draft_answers").$type<Record<string, unknown>>(),
    draftUpdatedAt: timestamp("draft_updated_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHash: uniqueIndex("intake_form_links_token_hash_idx").on(table.tokenHash),
    matterExpiry: index("intake_form_links_matter_expiry_idx").on(table.matterId, table.expiresAt),
    parent: index("intake_form_links_parent_idx").on(table.parentFormLinkId),
    snapshot: index("intake_form_links_snapshot_idx").on(table.answerSnapshotId),
    submission: index("intake_form_links_submission_idx").on(table.id, table.clientSubmissionId),
  }),
);

export const intakeFormReviews = pgTable(
  "intake_form_reviews",
  {
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
    formLinkId: text("form_link_id")
      .notNull()
      .references(() => intakeFormLinks.id),
    answerSnapshotId: text("answer_snapshot_id")
      .notNull()
      .references(() => answerSnapshots.id),
    decision: text("decision").$type<IntakeFormReviewRecord["decision"]>().notNull(),
    decidedByUserId: text("decided_by_user_id")
      .notNull()
      .references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    followUpFormLinkId: text("follow_up_form_link_id").references(() => intakeFormLinks.id),
  },
  (table) => ({
    formLink: uniqueIndex("intake_form_reviews_form_link_idx").on(table.formLinkId),
    snapshot: index("intake_form_reviews_snapshot_idx").on(table.answerSnapshotId),
    matterDecision: index("intake_form_reviews_matter_decision_idx").on(
      table.matterId,
      table.decision,
    ),
  }),
);

export const intakeFormItemActions = pgTable(
  "intake_form_item_actions",
  {
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
    formLinkId: text("form_link_id")
      .notNull()
      .references(() => intakeFormLinks.id),
    itemId: text("item_id").notNull(),
    kind: text("kind").$type<IntakeFormItemActionRecord["kind"]>().notNull(),
    status: text("status").$type<IntakeFormItemActionRecord["status"]>().notNull(),
    documentId: text("document_id").references(() => documents.id),
    signatureRequestId: text("signature_request_id").references(() => signatureRequests.id),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    linkItem: index("intake_form_item_actions_link_item_idx").on(table.formLinkId, table.itemId),
  }),
);

export const intakeVariableProposals = pgTable(
  "intake_variable_proposals",
  {
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
    answerSnapshotId: text("answer_snapshot_id")
      .notNull()
      .references(() => answerSnapshots.id),
    sourceQuestionId: text("source_question_id").notNull(),
    targetScope: text("target_scope").$type<IntakeVariableProposal["targetScope"]>().notNull(),
    targetField: text("target_field").$type<IntakeVariableProposal["targetField"]>().notNull(),
    targetRecordId: text("target_record_id").notNull(),
    proposedValue: text("proposed_value").notNull(),
    status: text("status").$type<IntakeVariableProposal["status"]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (table) => ({
    matterStatus: index("intake_variable_proposals_matter_status_idx").on(
      table.matterId,
      table.status,
    ),
    snapshot: index("intake_variable_proposals_snapshot_idx").on(table.answerSnapshotId),
  }),
);

export const generatedDocuments = pgTable("generated_documents", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  intakeSessionId: text("intake_session_id").references(() => intakeSessions.id),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  documentId: text("document_id").references(() => documents.id),
  packageId: text("package_id"),
  packageDocumentId: text("package_document_id"),
  storageKey: text("storage_key"),
  checksumSha256: text("checksum_sha256"),
  evidence: jsonb("evidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const drafts = pgTable(
  "drafts",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id").references(() => matters.id),
    title: text("title").notNull(),
    editorJson: jsonb("editor_json").$type<Record<string, unknown>>().notNull(),
    renderedHtml: text("rendered_html"),
    version: integer("version").notNull().default(1),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmMatter: index("drafts_firm_matter_idx").on(table.firmId, table.matterId),
  }),
);

export const draftTemplates = pgTable(
  "draft_templates",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    name: text("name").notNull(),
    description: text("description"),
    editorJson: jsonb("editor_json").$type<Record<string, unknown>>().notNull(),
    category: text("category").notNull().default("general"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmCategory: index("draft_templates_firm_category_idx").on(table.firmId, table.category),
  }),
);

export const draftAssistRecords = pgTable(
  "draft_assist_records",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    sourceType: text("source_type").notNull(),
    draftId: text("draft_id").references(() => drafts.id),
    documentId: text("document_id").references(() => documents.id),
    task: text("task").notNull(),
    providerKey: text("provider_key").notNull(),
    providerModel: text("provider_model").notNull(),
    status: text("status").notNull(),
    suggestedText: text("suggested_text").notNull(),
    summary: text("summary"),
    reviewDecision: text("review_decision"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<DraftAssistRecord["metadata"]>().notNull().default({}),
  },
  (table) => ({
    firmMatter: index("draft_assist_records_firm_matter_idx").on(table.firmId, table.matterId),
    firmDraft: index("draft_assist_records_firm_draft_idx").on(table.firmId, table.draftId),
    firmDocument: index("draft_assist_records_firm_document_idx").on(
      table.firmId,
      table.documentId,
    ),
  }),
);
