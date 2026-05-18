import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REQUIRED_ROUTE_CATALOG_IDS,
  ROUTE_REGISTRARS,
  collectForbiddenRouteFailures,
  collectRegistrarTestFailures,
  collectRouteAuthorizationManifestFailures,
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
      validateRouteAuthorizationManifest: false,
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
      validateRouteAuthorizationManifest: false,
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

  it("requires route authorization manifest coverage and valid auth declarations", () => {
    const failures = collectRouteAuthorizationManifestFailures({
      actualRoutes: [
        { method: "GET", path: "/api/shares", registrar: "registerShareRoutes" },
        { method: "GET", path: "/api/setup/status", registrar: "registerSetupRoutes" },
        { method: "GET", path: "/api/portal/shares/:token", registrar: "registerShareRoutes" },
        {
          method: "POST",
          path: "/api/documents/:id/upload-complete",
          registrar: "registerDocumentRoutes",
        },
      ],
      manifest: [
        {
          method: "GET",
          path: "/api/setup/status",
          registrar: "registerSetupRoutes",
          testFile: "apps/api/src/server.test.ts",
          auth: { kind: "authenticated", resource: "firm", action: "read" },
        },
        {
          method: "GET",
          path: "/api/portal/shares/:token",
          registrar: "registerShareRoutes",
          testFile: "apps/api/src/routes/shares.test.ts",
          auth: { kind: "token", tokenScope: "share:mutation" },
        },
        {
          method: "POST",
          path: "/api/documents/:id/upload-complete",
          registrar: "registerDocumentRoutes",
          testFile: "apps/api/src/routes/documents.test.ts",
          auth: { kind: "authenticated", resource: "document", action: "update" },
        },
        {
          method: "GET",
          path: "/api/ghost",
          registrar: "registerGhostRoutes",
          testFile: "apps/api/src/routes/ghost.test.ts",
          auth: { kind: "authenticated", resource: "ghost", action: "read" },
        },
      ],
      pathExists: (path) => path !== "apps/api/src/routes/ghost.test.ts",
      isPublicRoute: (method, path) =>
        (method === "GET" && path === "/api/setup/status") ||
        (method === "GET" && path === "/api/portal/shares/sample"),
    });

    assert.ok(
      failures.includes(
        "GET /api/shares from registerShareRoutes is missing from route authorization manifest.",
      ),
    );
    assert.ok(
      failures.includes(
        "GET /api/setup/status public-route mismatch: auth helper says public but manifest says authenticated.",
      ),
    );
    assert.ok(
      failures.includes(
        "GET /api/portal/shares/:token portal route must use publicTokenPolicyOptions.",
      ),
    );
    assert.ok(
      failures.includes(
        "GET /api/portal/shares/:token tokenScope share:mutation does not match publicTokenPolicyOptions undefined.",
      ) === false,
    );
    assert.ok(
      failures.includes(
        "POST /api/documents/:id/upload-complete manifest resource document must declare matterScope.",
      ),
    );
    assert.ok(
      failures.includes(
        "GET /api/ghost manifest references unknown registrar registerGhostRoutes.",
      ),
    );
    assert.ok(
      failures.includes(
        "GET /api/ghost manifest test file must exist: apps/api/src/routes/ghost.test.ts.",
      ),
    );
    assert.ok(
      failures.includes("GET /api/ghost manifest resource ghost is not a valid ResourceKind."),
    );
    assert.ok(
      failures.includes(
        "GET /api/ghost in route authorization manifest is not registered by API route files.",
      ),
    );
  });
});
