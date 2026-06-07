import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { BillingRateSnapshot, HostedPaymentRequestRecord } from "@open-practice/domain";
import { billingRateRules } from "./billing-controls.js";
import { contacts } from "./contacts.js";
import { firms, users } from "./core.js";
import { trustTransactions } from "./ledger.js";
import { matters } from "./matters.js";

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
  rateRuleId: text("rate_rule_id").references(() => billingRateRules.id),
  rateSnapshot: jsonb("rate_snapshot").$type<BillingRateSnapshot>(),
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

export const hostedPaymentRequests = pgTable(
  "hosted_payment_requests",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id),
    clientContactId: text("client_contact_id").references(() => contacts.id),
    status: text("status").$type<HostedPaymentRequestRecord["status"]>().notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").$type<HostedPaymentRequestRecord["currency"]>().notNull(),
    hostedPath: text("hosted_path").notNull(),
    delivery: jsonb("delivery_state")
      .$type<HostedPaymentRequestRecord["delivery"]>()
      .notNull()
      .default({ status: "not_sent", channel: "none", recipientCount: 0 }),
    reminder: jsonb("reminder_state")
      .$type<HostedPaymentRequestRecord["reminder"]>()
      .notNull()
      .default({ status: "not_scheduled", reminderCount: 0 }),
    paymentPlan: jsonb("payment_plan_placeholder")
      .$type<HostedPaymentRequestRecord["paymentPlan"]>()
      .notNull()
      .default({ status: "not_offered", enforcement: "none" }),
    creditWriteOffPosture: jsonb("credit_write_off_posture")
      .$type<HostedPaymentRequestRecord["creditWriteOffPosture"]>()
      .notNull()
      .default({ status: "none", movement: "none" }),
    processor: jsonb("processor_state")
      .$type<HostedPaymentRequestRecord["processor"]>()
      .notNull()
      .default({ status: "not_started" }),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => ({
    firmInvoice: index("hosted_payment_requests_firm_invoice_idx").on(
      table.firmId,
      table.invoiceId,
    ),
    matterStatus: index("hosted_payment_requests_matter_status_idx").on(
      table.firmId,
      table.matterId,
      table.status,
    ),
    hostedPath: uniqueIndex("hosted_payment_requests_hosted_path_idx").on(table.hostedPath),
    statusValue: check(
      "hosted_payment_requests_status_value",
      sql`${table.status} in ('ready_to_send', 'sent', 'viewed', 'cancelled', 'expired')`,
    ),
    positiveAmount: check("hosted_payment_requests_positive_amount", sql`${table.amountCents} > 0`),
    cadCurrency: check("hosted_payment_requests_cad_currency", sql`${table.currency} = 'CAD'`),
  }),
);

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
