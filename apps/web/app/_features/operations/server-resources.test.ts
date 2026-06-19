import { afterEach, describe, expect, it, vi } from "vitest";
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
  buildWorkflowHistoryPath,
  emptyWorkerHealthResponse,
  emptyWorkerRunsResponse,
  emptyWorkflowHistoryResponse,
} from "../../worker-runs-dashboard";
import { loadOperationsDashboardResources } from "./server-resources";

afterEach(() => {
  vi.restoreAllMocks();
});

function statusResponse(status: number): Response {
  return new Response(null, { status });
}

function requestPath(input: RequestInfo | URL): string {
  const url = new URL(input instanceof Request ? input.url : String(input));
  return `${url.pathname}${url.search}`;
}

function deferredResponse(): {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
} {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

const operationsPaths = [
  "/api/tasks/workbench",
  buildWorkerRunsPath("all"),
  buildWorkerRunsPath("email"),
  buildWorkerRunsPath("ocr"),
  buildWorkerHealthPath(),
  buildWorkflowHistoryPath(),
  buildProvidersStatusPath(),
  "/api/operational-views",
  "/api/operational-views/definitions",
  buildAiOperationalProposalsPath(),
  "/api/reports/workspace",
];

describe("operations server resources", () => {
  it("starts independent operations requests before any one response resolves", async () => {
    const headers = { "x-open-practice-user-id": "user-admin" };
    const pendingByPath = new Map<string, ReturnType<typeof deferredResponse>>();
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const path = requestPath(input);
      expect(init).toEqual(expect.objectContaining({ cache: "no-store", headers }));
      const pending = deferredResponse();
      pendingByPath.set(path, pending);
      return pending.promise;
    });

    const resourcesPromise = loadOperationsDashboardResources(headers);
    await Promise.resolve();

    expect([...pendingByPath.keys()]).toEqual(operationsPaths);

    for (const path of operationsPaths) {
      pendingByPath.get(path)!.resolve(statusResponse(404));
    }

    await expect(resourcesPromise).resolves.toMatchObject({
      aiOperationalProposals: emptyAiOperationalProposalsResponse(),
      operationalViewDefinitions: { definitions: [] },
      operationalViews: { views: [] },
      providerStatus: emptyProvidersStatusResponse(),
      reportingWorkspace: emptyStaffReportingWorkspace(),
      taskWorkbench: { tasks: [] },
      workerHealth: emptyWorkerHealthResponse(),
      workflowHistory: emptyWorkflowHistoryResponse(),
      workerRuns: {
        all: emptyWorkerRunsResponse(),
        email: emptyWorkerRunsResponse(),
        ocr: emptyWorkerRunsResponse(),
      },
    });
  });

  it("keeps access-denied fallbacks distinct from missing operations resources", async () => {
    const headers = { "x-open-practice-user-id": "user-admin" };
    const statusesByPath = new Map<string, number>([
      [buildWorkerRunsPath("all"), 403],
      [buildWorkerRunsPath("email"), 404],
      [buildWorkerRunsPath("ocr"), 403],
      [buildWorkflowHistoryPath(), 403],
      [buildProvidersStatusPath(), 403],
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = requestPath(input);
      expect(init).toEqual(expect.objectContaining({ cache: "no-store", headers }));
      return statusResponse(statusesByPath.get(path) ?? 404);
    });

    await expect(loadOperationsDashboardResources(headers)).resolves.toMatchObject({
      aiOperationalProposals: emptyAiOperationalProposalsResponse(),
      operationalViewDefinitions: { definitions: [] },
      operationalViews: { views: [] },
      providerStatus: emptyProvidersStatusResponse("access_denied"),
      reportingWorkspace: emptyStaffReportingWorkspace(),
      taskWorkbench: { tasks: [] },
      workerHealth: emptyWorkerHealthResponse(),
      workflowHistory: emptyWorkflowHistoryResponse("access_denied"),
      workerRuns: {
        all: emptyWorkerRunsResponse("access_denied"),
        email: emptyWorkerRunsResponse(),
        ocr: emptyWorkerRunsResponse("access_denied"),
      },
    });
  });
});
