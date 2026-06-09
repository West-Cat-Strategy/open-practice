import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emptyJurisdictionalTrustReport,
  emptyTrustControlsDashboard,
} from "../../trust-controls-dashboard";
import type { MatterSummary } from "../../types";
import { loadDashboardCoreResources, loadDashboardTrustResources } from "./server-resources";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestPath(input: RequestInfo | URL): string {
  const url = new URL(input instanceof Request ? input.url : String(input));
  return `${url.pathname}${url.search}`;
}

describe("dashboard server resources", () => {
  const mattersWithFirstMatter = [{ id: "matter-001" }] as unknown as MatterSummary[];

  it("loads the core dashboard resources from the existing staff endpoints", async () => {
    const headers = { "x-open-practice-user-id": "user-admin" };
    const capabilities = { sections: [] };
    const overview = { firm: { id: "firm-west-legal" }, metrics: {}, users: [] };
    const matters = [{ id: "matter-001" }];
    const signatures = { requests: [] };
    const intake = { templates: [], sessions: [] };
    const queues = { lawyerReview: [], staffReview: [] };
    const contactDossiers = [{ contact: { id: "contact-001" } }];
    const responses: Record<string, unknown> = {
      "/api/capabilities": capabilities,
      "/api/overview": overview,
      "/api/matters": matters,
      "/api/signature-requests": signatures,
      "/api/intake-sessions": intake,
      "/api/queues": queues,
      "/api/contacts/dossiers": contactDossiers,
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const body = responses[requestPath(input)];
      if (!body) return jsonResponse({ error: "unexpected path" }, 500);
      expect(init).toEqual(expect.objectContaining({ cache: "no-store", headers }));
      return jsonResponse(body);
    });

    await expect(loadDashboardCoreResources(headers)).resolves.toEqual({
      capabilities,
      overview,
      matters,
      signatures,
      intake,
      queues,
      contactDossiers,
    });

    expect(fetchMock.mock.calls.map(([input]) => requestPath(input))).toEqual([
      "/api/capabilities",
      "/api/overview",
      "/api/matters",
      "/api/signature-requests",
      "/api/intake-sessions",
      "/api/queues",
      "/api/contacts/dossiers",
    ]);
  });

  it("keeps trust controls empty when no matter is available", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, 404));

    await expect(loadDashboardTrustResources({ headers: {}, matters: [] })).resolves.toEqual({
      trustControls: emptyTrustControlsDashboard(),
      jurisdictionalTrustReport: emptyJurisdictionalTrustReport(),
    });

    expect(fetchMock.mock.calls.map(([input]) => requestPath(input))).toEqual([
      "/api/ledger/reports/jurisdictional-trust",
    ]);
  });

  it("maps denied trust-control access to the existing empty dashboard fallback", async () => {
    const report = {
      summaries: [
        {
          jurisdiction: "BC",
          matterCount: 1,
          trustBalanceCents: 5000,
          pendingApprovalCount: 0,
          rejectedApprovalCount: 0,
          exceptionReconciliationCount: 0,
          importedStatementRowCount: 0,
          matchedStatementRowCount: 0,
          unmatchedStatementRowCount: 0,
          totalVarianceCents: 0,
          unreconciledAccountCount: 0,
          overdrawnBalanceCount: 0,
          compliancePosture: "operational_controls_only_not_jurisdiction_certified",
        },
      ],
      compliancePosture: "operational_controls_only_not_jurisdiction_certified",
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = requestPath(input);
      if (path === "/api/ledger/controls?matterId=matter-001") return jsonResponse({}, 403);
      if (path === "/api/ledger/reports/jurisdictional-trust") return jsonResponse(report);
      return jsonResponse({}, 500);
    });

    await expect(
      loadDashboardTrustResources({
        headers: {},
        matters: mattersWithFirstMatter,
      }),
    ).resolves.toEqual({
      trustControls: emptyTrustControlsDashboard(),
      jurisdictionalTrustReport: report,
    });
  });

  it("keeps the jurisdictional trust report fallback for missing or denied report access", async () => {
    for (const status of [403, 404]) {
      vi.restoreAllMocks();
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const path = requestPath(input);
        if (path === "/api/ledger/controls?matterId=matter-001") {
          return jsonResponse(emptyTrustControlsDashboard());
        }
        if (path === "/api/ledger/reports/jurisdictional-trust") return jsonResponse({}, status);
        return jsonResponse({}, 500);
      });

      await expect(
        loadDashboardTrustResources({
          headers: {},
          matters: mattersWithFirstMatter,
        }),
      ).resolves.toEqual({
        trustControls: emptyTrustControlsDashboard(),
        jurisdictionalTrustReport: emptyJurisdictionalTrustReport(),
      });
    }
  });
});
