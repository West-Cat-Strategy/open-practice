import type { StaffReportingWorkspaceResponse } from "./types";

export function emptyStaffReportingWorkspace(): StaffReportingWorkspaceResponse {
  return {
    generatedAt: new Date(0).toISOString(),
    definitions: [],
    exportProfiles: [],
    reports: [],
    history: [],
    scheduleReadinessSummary: {
      totalDefinitions: 0,
      manualExportReadyDefinitions: 0,
      manualOnlyDefinitionKeys: [],
      recentExportRequestCount: 0,
      scheduledDefinitionCount: 0,
      automaticExecution: false,
      scheduledEmailDeliveryEnabled: false,
      rawReportBodyStorage: false,
    },
    reportBuilderPosture: {
      status: "metadata_only",
      savedDefinitionsOnly: true,
      filterCount: 0,
      groupingCount: 0,
      exportProfileCount: 0,
      customSql: false,
      biEmbeds: false,
      broadReportExecution: false,
      mutableDefinitionBuilder: false,
      rawReportBodyStorage: false,
    },
    exportJobPosture: {
      queueName: "reports",
      jobName: "staff_report_export",
      historyCount: 0,
      boundedMetadataOnly: true,
      storesReportBodiesInJobMetadata: false,
      downloadsRegenerateProjection: true,
      scheduledDeliveryJobs: false,
    },
    workspacePolicy: {
      customSql: false,
      biEmbeds: false,
      scheduledEmailDelivery: false,
      rawReportBodiesInJobMetadata: false,
    },
  };
}
