import type {
  SavedOperationalViewDefinition,
  SavedOperationalViewDefinitionInput,
} from "@open-practice/domain";
import { clone } from "../contracts.js";

export interface MemoryOperationalViewsStore {
  savedOperationalViewDefinitions: SavedOperationalViewDefinition[];
}

export function listMemorySavedOperationalViewDefinitions(
  store: MemoryOperationalViewsStore,
  firmId: string,
  options: {
    ownerUserId: string;
    surface?: SavedOperationalViewDefinition["surface"];
    includeArchived?: boolean;
  },
): SavedOperationalViewDefinition[] {
  return clone(
    store.savedOperationalViewDefinitions
      .filter(
        (definition) =>
          definition.firmId === firmId &&
          definition.ownerUserId === options.ownerUserId &&
          (!options.surface || definition.surface === options.surface) &&
          (options.includeArchived || definition.status === "active"),
      )
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name) || left.createdAt.localeCompare(right.createdAt),
      ),
  );
}

export function getMemorySavedOperationalViewDefinition(
  store: MemoryOperationalViewsStore,
  firmId: string,
  id: string,
): SavedOperationalViewDefinition | undefined {
  return clone(
    store.savedOperationalViewDefinitions.find(
      (definition) => definition.firmId === firmId && definition.id === id,
    ),
  );
}

export function createMemorySavedOperationalViewDefinition(
  store: MemoryOperationalViewsStore,
  input: SavedOperationalViewDefinitionInput,
): SavedOperationalViewDefinition {
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
  store.savedOperationalViewDefinitions.push(clone(definition));
  return clone(definition);
}

export function updateMemorySavedOperationalViewDefinition(
  store: MemoryOperationalViewsStore,
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
): SavedOperationalViewDefinition | undefined {
  const index = store.savedOperationalViewDefinitions.findIndex(
    (definition) => definition.firmId === firmId && definition.id === id,
  );
  if (index === -1) return undefined;
  const updated = {
    ...store.savedOperationalViewDefinitions[index]!,
    ...clone(updates),
    updatedAt: updates.updatedAt ?? new Date().toISOString(),
  };
  store.savedOperationalViewDefinitions[index] = clone(updated);
  return clone(updated);
}

export function archiveMemorySavedOperationalViewDefinition(
  store: MemoryOperationalViewsStore,
  input: {
    firmId: string;
    id: string;
    archivedAt: string;
  },
): SavedOperationalViewDefinition | undefined {
  const index = store.savedOperationalViewDefinitions.findIndex(
    (definition) => definition.firmId === input.firmId && definition.id === input.id,
  );
  if (index === -1) return undefined;
  const archived: SavedOperationalViewDefinition = {
    ...store.savedOperationalViewDefinitions[index]!,
    status: "archived",
    archivedAt: input.archivedAt,
    updatedAt: input.archivedAt,
  };
  store.savedOperationalViewDefinitions[index] = clone(archived);
  return clone(archived);
}
