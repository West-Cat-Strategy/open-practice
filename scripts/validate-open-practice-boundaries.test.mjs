import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REQUIRED_ROUTE_CATALOG_IDS,
  ROUTE_REGISTRARS,
  collectForbiddenRouteFailures,
  collectRegistrarTestFailures,
  collectUntrackedRegistrarFailures,
  evaluateBoundaryPolicy,
} from "./validate-open-practice-boundaries.mjs";

function validServer() {
  const imports = ROUTE_REGISTRARS.map(
    ({ registrar, importPath }) => `import { ${registrar} } from "${importPath}";`,
  ).join("\n");
  const wires = ROUTE_REGISTRARS.map(({ registrar }) => `${registrar}(server, dependencies);`).join(
    "\n",
  );

  return `
${imports}

export function registerRoutes(server, dependencies) {
  ${wires}
}
`;
}

function validRouteCatalog() {
  return REQUIRED_ROUTE_CATALOG_IDS.map((routeId) => `{ id: "${routeId}" }`).join("\n");
}

describe("validate-open-practice-boundaries contract", () => {
  it("passes the current registrar and route-catalog contract", () => {
    const failures = evaluateBoundaryPolicy({
      readText: (path) => {
        if (path === "apps/api/src/server.ts") return validServer();
        if (path === "apps/web/routes/routeCatalog.ts") return validRouteCatalog();
        throw new Error(`unexpected read: ${path}`);
      },
      pathExists: () => true,
    });

    assert.deepEqual(failures, []);
  });

  it("reports missing registrar wiring and route catalog ids", () => {
    const failures = evaluateBoundaryPolicy({
      readText: (path) => {
        if (path === "apps/api/src/server.ts")
          return validServer().replace("registerTaskRoutes(server", "// missing");
        if (path === "apps/web/routes/routeCatalog.ts")
          return validRouteCatalog().replace('{ id: "queues" }', "");
        throw new Error(`unexpected read: ${path}`);
      },
      pathExists: (path) => path !== "apps/api/src/routes/tasks.ts",
    });

    assert.ok(
      failures.includes("apps/api/src/routes/tasks.ts must exist for the tasks route family."),
    );
    assert.ok(failures.includes("apps/api/src/server.ts must wire registerTaskRoutes."));
    assert.ok(failures.includes("route catalog is missing queues."));
  });

  it("requires every server route import to be tracked by the boundary registry", () => {
    const failures = collectUntrackedRegistrarFailures(`
      import { registerCommunicationsRoutes } from "./routes/communications.js";
      import { registerUnreviewedRoutes } from "./routes/unreviewed.js";
    `);

    assert.deepEqual(failures, [
      "registerUnreviewedRoutes from ./routes/unreviewed.js must be represented in ROUTE_REGISTRARS so the boundary gate owns its route family.",
    ]);
  });

  it("requires tracked route families to keep at least one route test file", () => {
    const failures = collectRegistrarTestFailures(
      (path) => path !== "apps/api/src/routes/providers-status.test.ts",
    );

    assert.deepEqual(failures, [
      "registerProviderStatusRoutes must keep at least one route test file for provider status: apps/api/src/routes/providers-status.test.ts.",
    ]);
  });

  it("keeps route family literals out of server.ts", () => {
    const failures = collectForbiddenRouteFailures(`
      server.get("/api/invoices", handler);
      server.get("/api/providers/status", handler);
      server.post("/api/tasks/assignments", handler);
    `);

    assert.ok(
      failures.includes(
        "apps/api/src/server.ts still contains route literal /api/invoices; keep billing endpoints in apps/api/src/routes/billing.ts.",
      ),
    );
    assert.ok(
      failures.includes(
        "apps/api/src/server.ts still contains route literal /api/providers/status; keep provider status endpoints in apps/api/src/routes/providers-status.ts.",
      ),
    );
    assert.ok(
      failures.includes(
        "apps/api/src/server.ts still contains task route literal /api/tasks/; keep task endpoints in their module-owned route registrar.",
      ),
    );
  });
});
