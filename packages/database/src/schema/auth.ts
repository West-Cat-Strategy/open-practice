import {
  boolean,
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
import { firms, users } from "./core.js";

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
    freshAuthenticatedAt: timestamp("fresh_authenticated_at", { withTimezone: true }),
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
