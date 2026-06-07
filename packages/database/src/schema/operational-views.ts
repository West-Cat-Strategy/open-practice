import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { SavedOperationalViewDefinition } from "@open-practice/domain";
import { firms, users } from "./core.js";

export const savedOperationalViewSurface = pgEnum("saved_operational_view_surface", [
  "queues",
  "matters",
]);
export const savedOperationalViewStatus = pgEnum("saved_operational_view_status", [
  "active",
  "archived",
]);

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
