import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts.js";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";

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
    emailVerificationCodeHash: text("email_verification_code_hash"),
    emailVerificationExpiresAt: timestamp("email_verification_expires_at", { withTimezone: true }),
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
