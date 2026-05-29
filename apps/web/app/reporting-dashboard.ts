import type { StaffReportingWorkspaceResponse } from "./types";

export function emptyStaffReportingWorkspace(): StaffReportingWorkspaceResponse {
  return {
    generatedAt: new Date(0).toISOString(),
    definitions: [],
    exportProfiles: [],
    reports: [],
    history: [],
    workspacePolicy: {
      customSql: false,
      biEmbeds: false,
      scheduledEmailDelivery: false,
      rawReportBodiesInJobMetadata: false,
    },
  };
}
