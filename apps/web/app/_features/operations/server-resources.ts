import {
  buildAiOperationalProposalsPath,
  emptyAiOperationalProposalsResponse,
} from "../../ai-operational-proposals-dashboard";
import {
  buildProvidersStatusPath,
  emptyProvidersStatusResponse,
} from "../../provider-status-dashboard";
import { emptyStaffReportingWorkspace } from "../../reporting-dashboard";
import {
  buildWorkerHealthPath,
  buildWorkerRunsPath,
  emptyWorkerHealthResponse,
  emptyWorkerRunsResponse,
} from "../../worker-runs-dashboard";
import { apiGetOptional } from "../../_shared/server-api";
import type {
  AiOperationalProposalsResponse,
  OperationalViewDefinitionsResponse,
  OperationalViewsResponse,
  ProvidersStatusResponse,
  StaffReportingWorkspaceResponse,
  TaskDeadlineWorkbenchResponse,
  WorkerHealthResponse,
  WorkerRunsDashboardResponse,
  WorkerRunsResponse,
} from "../../types";

export interface OperationsDashboardResources {
  aiOperationalProposals: AiOperationalProposalsResponse;
  operationalViewDefinitions: OperationalViewDefinitionsResponse;
  operationalViews: OperationalViewsResponse;
  providerStatus: ProvidersStatusResponse;
  reportingWorkspace: StaffReportingWorkspaceResponse;
  taskWorkbench: TaskDeadlineWorkbenchResponse;
  workerHealth: WorkerHealthResponse;
  workerRuns: WorkerRunsDashboardResponse;
}

function emptyTaskDeadlineWorkbench(): TaskDeadlineWorkbenchResponse {
  return {
    tasks: [],
    counters: {
      my: { overdue: 0, today: 0, upcoming: 0 },
      team: { overdue: 0, today: 0, upcoming: 0 },
      matterQueues: [],
      contactQueues: [],
    },
    focusQueues: {
      myOverdueTaskIds: [],
      teamTodayTaskIds: [],
      upcomingTaskIds: [],
      unassignedTaskIds: [],
    },
    taskReview: {
      summary: {
        total: 0,
        open: 0,
        completed: 0,
        highPriority: 0,
        mediumPriority: 0,
        lowPriority: 0,
        overdue: 0,
        dueToday: 0,
        unassigned: 0,
        myOpen: 0,
        schedulingReviewCount: 0,
      },
      items: [],
    },
    suggestedFollowUps: [],
  };
}

export async function loadOperationsDashboardResources(
  headers: Record<string, string>,
): Promise<OperationsDashboardResources> {
  const taskWorkbench = await apiGetOptional<TaskDeadlineWorkbenchResponse>(
    "/api/tasks/workbench",
    emptyTaskDeadlineWorkbench(),
    headers,
  );
  const workerRuns: WorkerRunsDashboardResponse = {
    all: await apiGetOptional<WorkerRunsResponse>(
      buildWorkerRunsPath("all"),
      emptyWorkerRunsResponse(),
      headers,
      emptyWorkerRunsResponse("access_denied"),
    ),
    email: await apiGetOptional<WorkerRunsResponse>(
      buildWorkerRunsPath("email"),
      emptyWorkerRunsResponse(),
      headers,
      emptyWorkerRunsResponse("access_denied"),
    ),
    ocr: await apiGetOptional<WorkerRunsResponse>(
      buildWorkerRunsPath("ocr"),
      emptyWorkerRunsResponse(),
      headers,
      emptyWorkerRunsResponse("access_denied"),
    ),
  };
  const workerHealth = await apiGetOptional<WorkerHealthResponse>(
    buildWorkerHealthPath(),
    emptyWorkerHealthResponse(),
    headers,
    emptyWorkerHealthResponse(),
  );
  const providerStatus = await apiGetOptional<ProvidersStatusResponse>(
    buildProvidersStatusPath(),
    emptyProvidersStatusResponse(),
    headers,
    emptyProvidersStatusResponse("access_denied"),
  );
  const operationalViews = await apiGetOptional<OperationalViewsResponse>(
    "/api/operational-views",
    { views: [] },
    headers,
    { views: [] },
  );
  const operationalViewDefinitions = await apiGetOptional<OperationalViewDefinitionsResponse>(
    "/api/operational-views/definitions",
    { definitions: [] },
    headers,
    { definitions: [] },
  );
  const aiOperationalProposals = await apiGetOptional<AiOperationalProposalsResponse>(
    buildAiOperationalProposalsPath(),
    emptyAiOperationalProposalsResponse(),
    headers,
    emptyAiOperationalProposalsResponse(),
  );
  const reportingWorkspace = await apiGetOptional<StaffReportingWorkspaceResponse>(
    "/api/reports/workspace",
    emptyStaffReportingWorkspace(),
    headers,
    emptyStaffReportingWorkspace(),
  );

  return {
    aiOperationalProposals,
    operationalViewDefinitions,
    operationalViews,
    providerStatus,
    reportingWorkspace,
    taskWorkbench,
    workerHealth,
    workerRuns,
  };
}
