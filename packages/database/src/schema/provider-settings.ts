import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { firms } from "./core.js";

export const providerSettingKind = pgEnum("provider_setting_kind", [
  "smtp",
  "inbound_email",
  "public_intake",
  "ai",
  "ocr",
  "transcription",
  "media",
  "storage",
]);

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
