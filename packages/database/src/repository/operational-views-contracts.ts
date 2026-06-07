import type {
  SavedOperationalViewDefinition,
  SavedOperationalViewDefinitionInput,
} from "@open-practice/domain";

export interface OperationalViewsRepository {
  listSavedOperationalViewDefinitions(
    firmId: string,
    options: {
      ownerUserId: string;
      surface?: SavedOperationalViewDefinition["surface"];
      includeArchived?: boolean;
    },
  ): Promise<SavedOperationalViewDefinition[]>;
  getSavedOperationalViewDefinition(
    firmId: string,
    id: string,
  ): Promise<SavedOperationalViewDefinition | undefined>;
  createSavedOperationalViewDefinition(
    input: SavedOperationalViewDefinitionInput,
  ): Promise<SavedOperationalViewDefinition>;
  updateSavedOperationalViewDefinition(
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
  ): Promise<SavedOperationalViewDefinition | undefined>;
  archiveSavedOperationalViewDefinition(input: {
    firmId: string;
    id: string;
    archivedAt: string;
  }): Promise<SavedOperationalViewDefinition | undefined>;
}
