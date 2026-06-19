import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { firms } from "./core.js";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    sequence: integer("sequence").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").notNull(),
    previousHash: text("previous_hash").notNull(),
    hash: text("hash").notNull(),
  },
  (table) => ({
    firmSequence: uniqueIndex("audit_events_firm_sequence_idx").on(table.firmId, table.sequence),
    firmActionSequence: index("audit_events_firm_action_sequence_idx").on(
      table.firmId,
      table.action,
      table.sequence,
    ),
    firmResourceSequence: index("audit_events_firm_resource_sequence_idx").on(
      table.firmId,
      table.resourceType,
      table.resourceId,
      table.sequence,
    ),
  }),
);
