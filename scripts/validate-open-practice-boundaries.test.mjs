import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REQUIRED_ROUTE_CATALOG_IDS,
  ROUTE_REGISTRARS,
  collectApiRouteDeclarations,
  collectForbiddenRouteFailures,
  collectRepositoryCapabilityFailures,
  collectRegistrarTestFailures,
  collectRouteAuthorizationManifestFailures,
  collectSubregistrarWiringFailures,
  collectUntrackedRegistrarFailures,
  evaluateBoundaryPolicy,
} from "./validate-open-practice-boundaries.mjs";
import {
  ROUTE_AUTHORIZATION_MANIFEST,
  routeAuthorizationKey,
} from "./route-authorization-manifest.mjs";
import {
  BILLING_ROUTE_AUTHORIZATION_MANIFEST,
  INVOICE_GUARD_RESOURCE,
  PAYMENT_GUARD_RESOURCE,
} from "./route-authorization/billing.mjs";

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
      sourceFiles: [],
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
      sourceFiles: [],
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

  it("derives child route ownership from the parent registrar directory", () => {
    const failures = collectSubregistrarWiringFailures({
      routeRegistrars: [
        {
          family: "billing",
          file: "apps/api/src/routes/billing.ts",
          importPath: "./routes/billing.js",
          registrar: "registerBillingRoutes",
        },
      ],
      sourceFiles: [
        "apps/api/src/routes/billing/controls.ts",
        "apps/api/src/routes/billing/payments.ts",
      ],
      pathExists: () => true,
      readText: (path) => {
        if (path === "apps/api/src/routes/billing.ts") {
          return `
import { registerBillingControlRoutes } from "./billing/controls.js";

export function registerBillingRoutes(server, dependencies) {
  registerBillingPaymentRoutes(server, dependencies);
}
`;
        }
        if (path === "apps/api/src/routes/billing/controls.ts") {
          return `
export function registerBillingControlRoutes(server) {
  server.get("/api/billing/period-locks", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/billing/payments.ts") {
          return `
export function registerBillingPaymentRoutes(server) {
  server.get("/api/payments", async () => ({}));
}
`;
        }
        throw new Error(`unexpected read: ${path}`);
      },
    });

    assert.deepEqual(failures, [
      "registerBillingRoutes must call registerBillingControlRoutes(server...) to wire apps/api/src/routes/billing/controls.ts.",
      "registerBillingRoutes must import registerBillingPaymentRoutes from ./billing/payments.js to wire apps/api/src/routes/billing/payments.ts.",
    ]);
  });

  it("requires route-declaring child files to have exactly one owner", () => {
    const routeRegistrars = [
      {
        family: "billing",
        file: "apps/api/src/routes/billing.ts",
        importPath: "./routes/billing.js",
        registrar: "registerBillingRoutes",
      },
      {
        family: "ledger",
        file: "apps/api/src/routes/ledger.ts",
        importPath: "./routes/ledger.js",
        registrar: "registerLedgerRoutes",
        routeFiles: [
          "apps/api/src/routes/ledger.ts",
          "apps/api/src/routes/billing/shared-route.ts",
        ],
      },
    ];
    const failures = collectSubregistrarWiringFailures({
      routeRegistrars,
      sourceFiles: [
        "apps/api/src/routes/billing/shared-route.ts",
        "apps/api/src/routes/unregistered/unlisted.ts",
      ],
      pathExists: () => true,
      readText: (path) => {
        if (path === "apps/api/src/routes/billing.ts") {
          return `
import { registerSharedRouteRoutes } from "./billing/shared-route.js";

export function registerBillingRoutes(server, dependencies) {
  registerSharedRouteRoutes(server, dependencies);
}
`;
        }
        if (path === "apps/api/src/routes/ledger.ts") {
          return `
import { registerSharedRouteRoutes } from "./billing/shared-route.js";

export function registerLedgerRoutes(server, dependencies) {
  registerSharedRouteRoutes(server, dependencies);
}
`;
        }
        if (path === "apps/api/src/routes/billing/shared-route.ts") {
          return `
export function registerSharedRouteRoutes(server) {
  server.get("/api/shared-route", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/unregistered/unlisted.ts") {
          return `
export function registerUnlistedRoutes(server) {
  server.get("/api/unlisted", async () => ({}));
}
`;
        }
        throw new Error(`unexpected read: ${path}`);
      },
    });

    assert.deepEqual(failures, [
      "apps/api/src/routes/billing/shared-route.ts declares API routes but is owned by multiple ROUTE_REGISTRARS entries: registerBillingRoutes, registerLedgerRoutes.",
      "apps/api/src/routes/unregistered/unlisted.ts declares API routes but is not owned by any ROUTE_REGISTRARS parent directory or routeFiles entry.",
    ]);
  });

  it("allows helper-only route submodules without child registrar wiring", () => {
    const failures = collectSubregistrarWiringFailures({
      routeRegistrars: [
        {
          family: "billing",
          file: "apps/api/src/routes/billing.ts",
          importPath: "./routes/billing.js",
          registrar: "registerBillingRoutes",
        },
      ],
      sourceFiles: ["apps/api/src/routes/billing/shared.ts"],
      pathExists: () => true,
      readText: (path) => {
        if (path === "apps/api/src/routes/billing.ts") {
          return `export function registerBillingRoutes(server, dependencies) {}`;
        }
        if (path === "apps/api/src/routes/billing/shared.ts") {
          return `export function billingRoutePrefix() { return "/api/billing"; }`;
        }
        throw new Error(`unexpected read: ${path}`);
      },
    });

    assert.deepEqual(failures, []);
  });

  it("requires database repository capability contracts, implementation pairs, and aggregate imports", () => {
    const failures = collectRepositoryCapabilityFailures({
      sourceFiles: [
        "packages/database/src/repository/billing-controls/drizzle.ts",
        "packages/database/src/repository/connectors/drizzle.ts",
        "packages/database/src/repository/connectors/memory.ts",
        "packages/database/src/repository/contacts/drizzle.ts",
        "packages/database/src/repository/contacts/memory.ts",
        "packages/database/src/repository/calendar-event-details/read.ts",
      ],
      pathExists: (path) =>
        ![
          "packages/database/src/repository/billing-controls-contracts.ts",
          "packages/database/src/repository/billing-controls/memory.ts",
          "packages/database/src/repository/connector-contracts.ts",
        ].includes(path),
      readText: (path) => {
        if (path === "packages/database/src/repository/drizzle.ts") {
          return `
import { createDrizzleBillingControlsRepository } from "./billing-controls/drizzle.js";
import { createDrizzleConnectorRepository } from "./connectors/drizzle.js";
`;
        }
        if (path === "packages/database/src/repository/memory.ts") {
          return `
import { createMemoryContactRepository } from "./contacts/memory.js";
`;
        }
        throw new Error(`unexpected read: ${path}`);
      },
    });

    assert.deepEqual(failures, [
      "billing-controls repository capability must declare packages/database/src/repository/billing-controls-contracts.ts.",
      "billing-controls repository capability must include packages/database/src/repository/billing-controls/memory.ts.",
      "connectors repository capability must declare packages/database/src/repository/connector-contracts.ts.",
      "packages/database/src/repository/memory.ts must import ./connectors/memory.js for the connectors repository capability.",
      "packages/database/src/repository/drizzle.ts must import ./contacts/drizzle.js for the contacts repository capability.",
    ]);
  });

  it("allows support-only repository subdirectories without facade contracts", () => {
    const failures = collectRepositoryCapabilityFailures({
      sourceFiles: ["packages/database/src/repository/calendar-event-details/read.ts"],
      pathExists: () => false,
      readText: () => {
        throw new Error("support-only folders should not require aggregate reads");
      },
    });

    assert.deepEqual(failures, []);
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
        {
          method: "GET",
          path: "/api/document-assembly/workbench",
          registrar: "registerDocumentAssemblyRoutes",
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
          path: "/api/document-assembly/workbench",
          registrar: "registerDocumentAssemblyRoutes",
          testFile: "apps/api/src/routes/document-assembly.test.ts",
          auth: {
            kind: "authenticated",
            guards: [
              { resource: "document", action: "read", matterScope: "required" },
              { resource: "signature_request", action: "read", matterScope: "required" },
            ],
          },
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
        "GET /api/document-assembly/workbench manifest must declare at least one auth guard.",
      ) === false,
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

  it("detects registered billing submodule routes missing from the authorization manifest", () => {
    const routeRegistrars = [
      {
        family: "billing",
        file: "apps/api/src/routes/billing.ts",
        importPath: "./routes/billing.js",
        registrar: "registerBillingRoutes",
      },
    ];
    const failures = collectRouteAuthorizationManifestFailures({
      routeRegistrars,
      sourceFiles: [
        "apps/api/src/routes/billing.ts",
        "apps/api/src/routes/billing/payment-import-review-records.ts",
      ],
      readText: (path) => {
        if (path === "apps/api/src/server.ts") return "";
        if (path === "apps/api/src/routes/billing.ts") {
          return `
import { registerBillingPaymentImportReviewRoutes } from "./billing/payment-import-review-records.js";

export function registerBillingRoutes(server, dependencies) {
  registerBillingPaymentImportReviewRoutes(server, dependencies);
}
`;
        }
        if (path === "apps/api/src/routes/billing/payment-import-review-records.ts") {
          return `
export function registerBillingPaymentImportReviewRoutes(server) {
  server.get("/api/billing/payment-import-review-records", async () => ({ records: [] }));
  server.post(
    "/api/billing/payment-import-review-records/:recordId/synthetic-split-reviews",
    async () => ({ reviewOnly: true }),
  );
}
`;
        }
        throw new Error(`unexpected read: ${path}`);
      },
      manifest: [
        {
          method: "GET",
          path: "/api/billing/payment-import-review-records",
          registrar: "registerBillingRoutes",
          testFile: "apps/api/src/routes/billing.test.ts",
          auth: {
            kind: "authenticated",
            resource: "expense_entry",
            action: "read",
            matterScope: "optional",
          },
        },
      ],
      pathExists: (path) => path === "apps/api/src/routes/billing.test.ts",
      isPublicRoute: () => false,
      publicRouteSamples: [],
    });

    assert.deepEqual(failures, [
      "POST /api/billing/payment-import-review-records/:recordId/synthetic-split-reviews from registerBillingRoutes is missing from route authorization manifest.",
    ]);
  });

  it("flattens billing helper entries into the root route authorization manifest", () => {
    const exportedBillingEntries = ROUTE_AUTHORIZATION_MANIFEST.filter(
      (entry) => entry.registrar === "registerBillingRoutes",
    );

    assert.equal(exportedBillingEntries.length, BILLING_ROUTE_AUTHORIZATION_MANIFEST.length);
    assert.deepEqual(
      exportedBillingEntries.map(routeAuthorizationKey),
      BILLING_ROUTE_AUTHORIZATION_MANIFEST.map(routeAuthorizationKey),
    );
    assert.deepEqual(exportedBillingEntries, BILLING_ROUTE_AUTHORIZATION_MANIFEST);
  });

  it("keeps invoice and payment billing guards on the existing permission resources", () => {
    assert.equal(INVOICE_GUARD_RESOURCE, "time_entry");
    assert.equal(PAYMENT_GUARD_RESOURCE, "expense_entry");

    const invoiceEntries = BILLING_ROUTE_AUTHORIZATION_MANIFEST.filter(
      (entry) => entry.path === "/api/invoices" || entry.path.startsWith("/api/invoices/"),
    );
    const paymentEntries = BILLING_ROUTE_AUTHORIZATION_MANIFEST.filter(
      (entry) =>
        entry.path === "/api/payments" ||
        entry.path.startsWith("/api/payments/") ||
        entry.path === "/api/billing/payment-requests" ||
        entry.path.startsWith("/api/billing/payment-requests/"),
    );

    assert.ok(invoiceEntries.length > 0);
    assert.ok(paymentEntries.length > 0);
    assert.deepEqual(
      new Set(invoiceEntries.map((entry) => entry.auth.resource)),
      new Set(["time_entry"]),
    );
    assert.deepEqual(
      new Set(paymentEntries.map((entry) => entry.auth.resource)),
      new Set(["expense_entry"]),
    );
  });

  it("expands literal tuple loops when collecting registered routes", () => {
    const declarations = collectApiRouteDeclarations({
      routeRegistrars: [
        {
          family: "billing",
          file: "apps/api/src/routes/billing.ts",
          importPath: "./routes/billing.js",
          registrar: "registerBillingRoutes",
        },
      ],
      readText: (path) => {
        if (path === "apps/api/src/server.ts") return "";
        if (path === "apps/api/src/routes/billing.ts") {
          return `
export function registerBillingRoutes(server) {
  for (const [route, nextStatus] of [
    ["submit", "submitted"],
    ["approve", "approved"],
    ["write-off", "written_off"],
  ] as const) {
    server.post(\`/api/time-entries/:id/\${route}\`, async () => ({ nextStatus }));
  }
}
`;
        }
        throw new Error(`unexpected read: ${path}`);
      },
    });

    assert.deepEqual(
      declarations.map((declaration) => `${declaration.method} ${declaration.path}`),
      [
        "POST /api/time-entries/:id/approve",
        "POST /api/time-entries/:id/submit",
        "POST /api/time-entries/:id/write-off",
      ],
    );
  });

  it("collects route declarations from directory-owned child route files", () => {
    const declarations = collectApiRouteDeclarations({
      routeRegistrars: [
        {
          family: "billing",
          file: "apps/api/src/routes/billing.ts",
          importPath: "./routes/billing.js",
          registrar: "registerBillingRoutes",
        },
      ],
      sourceFiles: ["apps/api/src/routes/billing/controls.ts"],
      readText: (path) => {
        if (path === "apps/api/src/server.ts") return "";
        if (path === "apps/api/src/routes/billing.ts") {
          return `export function registerBillingRoutes(server) {}`;
        }
        if (path === "apps/api/src/routes/billing/controls.ts") {
          return `
export function registerBillingControlRoutes(server) {
  server.get("/api/billing/period-locks", async () => ({}));
}
`;
        }
        throw new Error(`unexpected read: ${path}`);
      },
    });

    assert.deepEqual(
      declarations.map(
        (declaration) => `${declaration.registrar} ${declaration.method} ${declaration.path}`,
      ),
      ["registerBillingRoutes GET /api/billing/period-locks"],
    );
  });

  it("reverse-checks public helper samples against public manifest entries", () => {
    const failures = collectRouteAuthorizationManifestFailures({
      actualRoutes: [
        {
          method: "GET",
          path: "/api/portal/email-receipts/:token",
          registrar: "registerEmailRoutes",
        },
      ],
      manifest: [
        {
          method: "GET",
          path: "/api/portal/email-receipts/:token",
          registrar: "registerEmailRoutes",
          testFile: "apps/api/src/routes/email.test.ts",
          auth: { kind: "token", tokenScope: "email-receipt:view" },
        },
      ],
      publicRouteSamples: [
        { method: "GET", path: "/api/portal/email-receipts/sample" },
        { method: "POST", path: "/api/portal/mail/receipts/sample/acknowledge" },
      ],
      pathExists: () => true,
      isPublicRoute: (method, path) =>
        (method === "GET" && path === "/api/portal/email-receipts/sample") ||
        (method === "POST" && path === "/api/portal/mail/receipts/sample/acknowledge"),
    });

    assert.ok(
      failures.includes(
        "POST /api/portal/mail/receipts/sample/acknowledge is public in auth helper samples but missing from manifest.",
      ),
    );
  });
});
