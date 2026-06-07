import type {
  SavedOperationalViewDefinition,
  SavedOperationalViewDefinitionInput,
} from "@open-practice/domain";
import { and, asc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import {
  mapSavedOperationalViewDefinitionRow,
  savedOperationalViewDefinitionInsert,
} from "../drizzle-mappers.js";

export async function listDrizzleSavedOperationalViewDefinitions(
  db: OpenPracticeDatabase,
  firmId: string,
  options: {
    ownerUserId: string;
    surface?: SavedOperationalViewDefinition["surface"];
    includeArchived?: boolean;
  },
): Promise<SavedOperationalViewDefinition[]> {
  const conditions = [
    eq(schema.savedOperationalViewDefinitions.firmId, firmId),
    eq(schema.savedOperationalViewDefinitions.ownerUserId, options.ownerUserId),
  ];
  if (options.surface) {
    conditions.push(eq(schema.savedOperationalViewDefinitions.surface, options.surface));
  }
  if (!options.includeArchived) {
    conditions.push(eq(schema.savedOperationalViewDefinitions.status, "active"));
  }
  const rows = await db
    .select()
    .from(schema.savedOperationalViewDefinitions)
    .where(and(...conditions))
    .orderBy(asc(schema.savedOperationalViewDefinitions.name));
  return rows.map(mapSavedOperationalViewDefinitionRow);
}

export async function getDrizzleSavedOperationalViewDefinition(
  db: OpenPracticeDatabase,
  firmId: string,
  id: string,
): Promise<SavedOperationalViewDefinition | undefined> {
  const [row] = await db
    .select()
    .from(schema.savedOperationalViewDefinitions)
    .where(
      and(
        eq(schema.savedOperationalViewDefinitions.firmId, firmId),
        eq(schema.savedOperationalViewDefinitions.id, id),
      ),
    );
  return row ? mapSavedOperationalViewDefinitionRow(row) : undefined;
}

export async function createDrizzleSavedOperationalViewDefinition(
  db: OpenPracticeDatabase,
  input: SavedOperationalViewDefinitionInput,
): Promise<SavedOperationalViewDefinition> {
  const now = new Date().toISOString();
  const definition: SavedOperationalViewDefinition = {
    id: input.id ?? crypto.randomUUID(),
    firmId: input.firmId,
    ownerUserId: input.ownerUserId,
    surface: input.surface,
    name: input.name,
    filters: input.filters ?? {},
    columns: input.columns ?? [],
    sort: input.sort ?? {},
    rowLimit: input.rowLimit ?? 25,
    dashboardBehavior: input.dashboardBehavior ?? {},
    permissionScope: input.permissionScope ?? ["matter:read"],
    status: input.status ?? "active",
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    archivedAt: input.archivedAt,
  };
  const [row] = await db
    .insert(schema.savedOperationalViewDefinitions)
    .values(savedOperationalViewDefinitionInsert(definition))
    .returning();
  return mapSavedOperationalViewDefinitionRow(row);
}

export async function updateDrizzleSavedOperationalViewDefinition(
  db: OpenPracticeDatabase,
  firmId: string,
  id: string,
  updates: Partial<
    Pick<
      SavedOperationalViewDefinition,
      | "name"
      | "filters"
      | "columns"
      | "sort"
      | "rowLimit"
      | "dashboardBehavior"
      | "permissionScope"
      | "updatedAt"
    >
  >,
): Promise<SavedOperationalViewDefinition | undefined> {
  const [row] = await db
    .update(schema.savedOperationalViewDefinitions)
    .set({
      ...updates,
      updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : new Date(),
    })
    .where(
      and(
        eq(schema.savedOperationalViewDefinitions.firmId, firmId),
        eq(schema.savedOperationalViewDefinitions.id, id),
      ),
    )
    .returning();
  return row ? mapSavedOperationalViewDefinitionRow(row) : undefined;
}

export async function archiveDrizzleSavedOperationalViewDefinition(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    id: string;
    archivedAt: string;
  },
): Promise<SavedOperationalViewDefinition | undefined> {
  const archivedAt = new Date(input.archivedAt);
  const [row] = await db
    .update(schema.savedOperationalViewDefinitions)
    .set({ status: "archived", archivedAt, updatedAt: archivedAt })
    .where(
      and(
        eq(schema.savedOperationalViewDefinitions.firmId, input.firmId),
        eq(schema.savedOperationalViewDefinitions.id, input.id),
      ),
    )
    .returning();
  return row ? mapSavedOperationalViewDefinitionRow(row) : undefined;
}
