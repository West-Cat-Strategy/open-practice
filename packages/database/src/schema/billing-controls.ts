import { boolean, check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { BillingRateRuleRecord } from "@open-practice/domain";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";

export const billingPeriodLocks = pgTable(
  "billing_period_locks",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    reason: text("reason"),
    lockedByUserId: text("locked_by_user_id")
      .notNull()
      .references(() => users.id),
    lockedAt: timestamp("locked_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    firmPeriod: index("billing_period_locks_firm_period_idx").on(
      table.firmId,
      table.periodStart,
      table.periodEnd,
    ),
    validPeriod: check(
      "billing_period_locks_valid_period",
      sql`${table.periodEnd} > ${table.periodStart}`,
    ),
  }),
);

export const billingRateRules = pgTable(
  "billing_rate_rules",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    label: text("label").notNull(),
    matterId: text("matter_id").references(() => matters.id),
    userId: text("user_id").references(() => users.id),
    role: text("role"),
    scope: text("scope").$type<BillingRateRuleRecord["scope"]>().notNull(),
    rateCents: integer("rate_cents").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmScopeActive: index("billing_rate_rules_firm_scope_active_idx").on(
      table.firmId,
      table.scope,
      table.active,
    ),
    scopeValue: check(
      "billing_rate_rules_scope_value",
      sql`${table.scope} in ('firm', 'role', 'user', 'matter', 'matter_user')`,
    ),
    nonNegativeRate: check("billing_rate_rules_non_negative_rate", sql`${table.rateCents} >= 0`),
    validEffectivePeriod: check(
      "billing_rate_rules_valid_effective_period",
      sql`${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
  }),
);
