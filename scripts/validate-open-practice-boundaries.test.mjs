import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REQUIRED_ROUTE_CATALOG_IDS,
  ROUTE_REGISTRARS,
  collectApiRouteDeclarations,
  collectForbiddenRouteFailures,
  collectPackageExportFailures,
  collectRegistrarTestFailures,
  collectRouteAuthorizationManifestFailures,
  collectSubregistrarWiringFailures,
  collectUntrackedRegistrarFailures,
  collectWorkspaceImportFailures,
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

function validPackageManifest(name = "@open-practice/example") {
  return JSON.stringify({
    name,
    type: "module",
    main: "dist/index.js",
    types: "dist/index.d.ts",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        default: "./dist/index.js",
      },
    },
  });
}

function validBoundaryReadText(path) {
  if (path === "apps/api/src/server.ts") return validServer();
  if (path === "apps/web/routes/routeCatalog.ts") return validRouteCatalog();
  if (path.endsWith("/package.json")) return validPackageManifest();
  throw new Error(`unexpected read: ${path}`);
}

describe("validate-open-practice-boundaries contract", () => {
  it("passes the current registrar and route-catalog contract", () => {
    const failures = evaluateBoundaryPolicy({
      readText: validBoundaryReadText,
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
        if (path.endsWith("/package.json")) return validPackageManifest();
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

  it("requires child route registrars to be imported and called by their parent", () => {
    const routeRegistrars = [
      {
        family: "billing",
        file: "apps/api/src/routes/billing.ts",
        importPath: "./routes/billing.js",
        registrar: "registerBillingRoutes",
        routeFiles: [
          "apps/api/src/routes/billing.ts",
          "apps/api/src/routes/billing/controls.ts",
          "apps/api/src/routes/billing/payments.ts",
        ],
      },
    ];
    const failures = collectSubregistrarWiringFailures({
      routeRegistrars,
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

  it("requires every child route-declaring file to be listed exactly once", () => {
    const routeRegistrars = [
      {
        family: "billing",
        file: "apps/api/src/routes/billing.ts",
        importPath: "./routes/billing.js",
        registrar: "registerBillingRoutes",
        routeFiles: [
          "apps/api/src/routes/billing.ts",
          "apps/api/src/routes/billing/shared-route.ts",
        ],
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
        "apps/api/src/routes/billing/unlisted.ts",
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
        if (path === "apps/api/src/routes/billing/unlisted.ts") {
          return `
export function registerUnlistedBillingRoutes(server) {
  server.get("/api/unlisted", async () => ({}));
}
`;
        }
        throw new Error(`unexpected read: ${path}`);
      },
    });

    assert.deepEqual(failures, [
      "apps/api/src/routes/billing/shared-route.ts declares API routes but is listed under multiple ROUTE_REGISTRARS owners: registerBillingRoutes, registerLedgerRoutes.",
      "apps/api/src/routes/billing/unlisted.ts declares API routes but is not listed in any ROUTE_REGISTRARS routeFiles entry.",
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

  it("collects route declarations from registrar-owned subfiles", () => {
    const declarations = collectApiRouteDeclarations({
      routeRegistrars: [
        {
          family: "billing",
          file: "apps/api/src/routes/billing.ts",
          importPath: "./routes/billing.js",
          registrar: "registerBillingRoutes",
          routeFiles: [
            "apps/api/src/routes/billing.ts",
            "apps/api/src/routes/billing/controls.ts",
            "apps/api/src/routes/billing/dashboard.ts",
            "apps/api/src/routes/billing/expenses.ts",
            "apps/api/src/routes/billing/export-requests.ts",
            "apps/api/src/routes/billing/invoices.ts",
            "apps/api/src/routes/billing/payments.ts",
            "apps/api/src/routes/billing/time-entries.ts",
          ],
        },
        {
          family: "calendar",
          file: "apps/api/src/routes/calendar.ts",
          importPath: "./routes/calendar.js",
          registrar: "registerCalendarRoutes",
          routeFiles: [
            "apps/api/src/routes/calendar.ts",
            "apps/api/src/routes/calendar/attendees.ts",
            "apps/api/src/routes/calendar/credentials.ts",
            "apps/api/src/routes/calendar/feed.ts",
            "apps/api/src/routes/calendar/guest-sessions.ts",
            "apps/api/src/routes/calendar/invitations.ts",
            "apps/api/src/routes/calendar/meeting-links.ts",
            "apps/api/src/routes/calendar/reminders.ts",
          ],
        },
        {
          family: "connectors",
          file: "apps/api/src/routes/connectors.ts",
          importPath: "./routes/connectors.js",
          registrar: "registerConnectorRoutes",
          routeFiles: [
            "apps/api/src/routes/connectors.ts",
            "apps/api/src/routes/connectors/developer-registration.ts",
            "apps/api/src/routes/connectors/developer-recovery.ts",
            "apps/api/src/routes/connectors/outbox.ts",
          ],
        },
        {
          family: "drafts",
          file: "apps/api/src/routes/drafts.ts",
          importPath: "./routes/drafts.js",
          registrar: "registerDraftRoutes",
          routeFiles: [
            "apps/api/src/routes/drafts.ts",
            "apps/api/src/routes/drafts/exports.ts",
            "apps/api/src/routes/drafts/templates.ts",
          ],
        },
        {
          family: "document processing",
          file: "apps/api/src/routes/document-processing.ts",
          importPath: "./routes/document-processing.js",
          registrar: "registerDocumentProcessingRoutes",
          routeFiles: [
            "apps/api/src/routes/document-processing.ts",
            "apps/api/src/routes/document-processing/queue.ts",
            "apps/api/src/routes/document-processing/status.ts",
            "apps/api/src/routes/document-processing/workbench.ts",
          ],
        },
        {
          family: "inbound email",
          file: "apps/api/src/routes/inbound-email.ts",
          importPath: "./routes/inbound-email.js",
          registrar: "registerInboundEmailRoutes",
          routeFiles: [
            "apps/api/src/routes/inbound-email.ts",
            "apps/api/src/routes/inbound-email/attachment-promotion.ts",
            "apps/api/src/routes/inbound-email/mailgun-raw-mime.ts",
            "apps/api/src/routes/inbound-email/messages.ts",
            "apps/api/src/routes/inbound-email/parser-jobs.ts",
            "apps/api/src/routes/inbound-email/status.ts",
            "apps/api/src/routes/inbound-email/triage.ts",
          ],
        },
        {
          family: "intake forms",
          file: "apps/api/src/routes/intake-forms.ts",
          importPath: "./routes/intake-forms.js",
          registrar: "registerIntakeFormRoutes",
          routeFiles: [
            "apps/api/src/routes/intake-forms.ts",
            "apps/api/src/routes/intake-forms/links.ts",
            "apps/api/src/routes/intake-forms/public.ts",
            "apps/api/src/routes/intake-forms/templates.ts",
          ],
        },
        {
          family: "public consultation intakes",
          file: "apps/api/src/routes/public-consultation-intakes.ts",
          importPath: "./routes/public-consultation-intakes.js",
          registrar: "registerPublicConsultationIntakeRoutes",
          routeFiles: [
            "apps/api/src/routes/public-consultation-intakes.ts",
            "apps/api/src/routes/public-consultation-intakes/public.ts",
          ],
        },
        {
          family: "ledger",
          file: "apps/api/src/routes/ledger.ts",
          importPath: "./routes/ledger.js",
          registrar: "registerLedgerRoutes",
          routeFiles: [
            "apps/api/src/routes/ledger.ts",
            "apps/api/src/routes/ledger/read.ts",
            "apps/api/src/routes/ledger/reconciliations.ts",
            "apps/api/src/routes/ledger/reports.ts",
            "apps/api/src/routes/ledger/transactions.ts",
          ],
        },
      ],
      readText: (path) => {
        if (path === "apps/api/src/server.ts") return "";
        if (path === "apps/api/src/routes/billing.ts") {
          return `export function registerBillingRoutes(server) {}`;
        }
        if (path === "apps/api/src/routes/billing/controls.ts") {
          return `
export function registerBillingControlRoutes(server) {
  server.get("/api/billing/period-locks", async () => ({}));
  server.post("/api/billing/period-locks", async () => ({}));
  server.get("/api/billing/rate-rules", async () => ({}));
  server.post("/api/billing/rate-rules", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/billing/dashboard.ts") {
          return `
export function registerBillingDashboardRoutes(server) {
  server.get("/api/billing/dashboard", async () => ({}));
}
	`;
        }
        if (path === "apps/api/src/routes/billing/expenses.ts") {
          return `
export function registerBillingExpenseRoutes(server) {
  server.get("/api/expense-entries", async () => ({}));
  server.post("/api/expense-entries", async () => ({}));
  server.post("/api/expense-entries/review-drafts", async () => ({}));
  server.patch("/api/expense-entries/:id", async () => ({}));
  for (const [route, nextStatus] of [
    ["submit", "submitted"],
    ["approve", "approved"],
    ["write-off", "written_off"],
  ] as const) {
    server.post(\`/api/expense-entries/:id/\${route}\`, async () => ({ nextStatus }));
  }
}
`;
        }
        if (path === "apps/api/src/routes/billing/export-requests.ts") {
          return `
export function registerBillingExportRoutes(server) {
  server.post("/api/billing/export-requests", async () => ({}));
  server.get("/api/billing/export-requests/:exportJobId", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/billing/invoices.ts") {
          return `
export function registerBillingInvoiceRoutes(server) {
  server.get("/api/invoices", async () => ({}));
  server.get("/api/invoices/:id", async () => ({}));
  server.post("/api/invoices", async () => ({}));
  server.post("/api/invoices/:id/approve", async () => ({}));
  server.post("/api/invoices/:id/issue", async () => ({}));
  server.post("/api/invoices/:id/void", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/billing/payments.ts") {
          return `
export function registerBillingPaymentRoutes(server) {
  server.get("/api/payments", async () => ({}));
  server.post("/api/payments", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/billing/time-entries.ts") {
          return `
export function registerBillingTimeEntryRoutes(server) {
  server.get("/api/time-entries", async () => ({}));
  server.post("/api/time-entries", async () => ({}));
  server.post("/api/time-entries/timer-drafts", async () => ({}));
  server.patch("/api/time-entries/:id", async () => ({}));
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
        if (path === "apps/api/src/routes/calendar.ts") {
          return `export function registerCalendarRoutes(server) {}`;
        }
        if (path === "apps/api/src/routes/calendar/attendees.ts") {
          return `
export function registerCalendarAttendeeRoutes(server) {
  server.post("/api/calendar/events/:eventId/attendees", async () => ({}));
  server.patch("/api/calendar/events/:eventId/attendees/:attendeeId", async () => ({}));
  server.delete("/api/calendar/events/:eventId/attendees/:attendeeId", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/calendar/credentials.ts") {
          return `
export function registerCalendarCredentialRoutes(server) {
  server.post("/api/calendar/credentials", async () => ({}));
  server.get("/api/calendar/credentials", async () => ({}));
  server.post("/api/calendar/credentials/:id/revoke", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/calendar/feed.ts") {
          return `
export function registerCalendarFeedRoutes(server) {
  server.get("/api/calendar/matters/:matterId.ics", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/calendar/guest-sessions.ts") {
          return `
export function registerCalendarGuestSessionRoutes(server) {
  server.get("/api/calendar/events/:eventId/guest-sessions", async () => ({}));
  server.post("/api/calendar/events/:eventId/guest-sessions", async () => ({}));
  server.post("/api/calendar/events/:eventId/guest-sessions/:sessionId/open", async () => ({}));
  server.post("/api/calendar/events/:eventId/guest-sessions/:sessionId/lock", async () => ({}));
  server.post("/api/calendar/events/:eventId/guest-sessions/:sessionId/end", async () => ({}));
  server.post("/api/calendar/events/:eventId/guest-sessions/:sessionId/guest-links", async () => ({}));
  server.post("/api/calendar/events/:eventId/guest-sessions/:sessionId/guests/:guestId/admit", async () => ({}));
  server.post("/api/calendar/events/:eventId/guest-sessions/:sessionId/guests/:guestId/deny", async () => ({}));
  server.post("/api/calendar/events/:eventId/guest-sessions/:sessionId/guests/:guestId/revoke", async () => ({}));
  server.get("/api/portal/guest-sessions", async () => ({}));
  server.get("/api/portal/guest-sessions/:token", async () => ({}));
  server.post("/api/portal/guest-sessions/check-in", async () => ({}));
  server.post("/api/portal/guest-sessions/:token/check-in", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/calendar/invitations.ts") {
          return `
export function registerCalendarInvitationRoutes(server) {
  server.post("/api/calendar/events/:eventId/invitations", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/calendar/meeting-links.ts") {
          return `
export function registerCalendarMeetingLinkRoutes(server) {
  server.patch("/api/calendar/events/:eventId/meeting-link", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/calendar/reminders.ts") {
          return `
export function registerCalendarReminderRoutes(server) {
  server.post("/api/calendar/events/:eventId/reminders", async () => ({}));
  server.patch("/api/calendar/events/:eventId/reminders/:reminderId", async () => ({}));
  server.delete("/api/calendar/events/:eventId/reminders/:reminderId", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/connectors.ts") {
          return `export function registerConnectorRoutes(server) {}`;
        }
        if (path === "apps/api/src/routes/connectors/developer-registration.ts") {
          return `
export function registerConnectorDeveloperRegistrationRoutes(server) {
  server.get("/api/connectors/developer/apps", async () => ({}));
  server.post("/api/connectors/developer/apps", async () => ({}));
  server.post("/api/connectors/developer/apps/:appId/credentials", async () => ({}));
  server.post("/api/connectors/developer/credentials/:credentialId/revoke", async () => ({}));
  server.post("/api/connectors/developer/apps/:appId/webhook-subscriptions", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/connectors/developer-recovery.ts") {
          return `
export function registerConnectorDeveloperRecoveryRoutes(server) {
  server.get("/api/connectors/developer/apps/:appId/delivery-history", async () => ({}));
  server.post("/api/connectors/developer/apps/:appId/webhook-replays", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/connectors/outbox.ts") {
          return `
export function registerConnectorOutboxRoutes(server) {
  server.get("/api/connectors/outbox", async () => ({}));
  server.post("/api/connectors/outbox", async () => ({}));
  server.post("/api/connectors/outbox/:outboxId/dead-letter", async () => ({}));
  server.post("/api/connectors/outbox/:outboxId/retry", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/document-processing.ts") {
          return `export function registerDocumentProcessingRoutes(server) {}`;
        }
        if (path === "apps/api/src/routes/document-processing/queue.ts") {
          return `
export function registerDocumentProcessingQueueRoutes(server) {
  server.post("/api/document-processing/documents/:id/queue", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/document-processing/status.ts") {
          return `
export function registerDocumentProcessingStatusRoutes(server) {
  server.get("/api/document-processing/status", async () => ({}));
  server.put("/api/document-processing/ocr-provider", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/document-processing/workbench.ts") {
          return `
export function registerDocumentProcessingWorkbenchRoutes(server) {
  server.get("/api/document-processing/workbench", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/drafts.ts") {
          return `export function registerDraftRoutes(server) {}`;
        }
        if (path === "apps/api/src/routes/drafts/exports.ts") {
          return `
export function registerDraftExportRoutes(server) {
  server.post("/api/drafts/:id/exports", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/drafts/templates.ts") {
          return `
export function registerDraftTemplateRoutes(server) {
  server.get("/api/draft-templates", async () => ({}));
  server.post("/api/draft-templates", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/inbound-email.ts") {
          return `export function registerInboundEmailRoutes(server) {}`;
        }
        if (path === "apps/api/src/routes/inbound-email/attachment-promotion.ts") {
          return `
export function registerInboundEmailAttachmentPromotionRoutes(server) {
  server.post("/api/inbound-email/messages/:id/attachments/:attachmentId/promote-document", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/inbound-email/messages.ts") {
          return `
export function registerInboundEmailMessageRoutes(server) {
  server.get("/api/inbound-email/messages", async () => ({}));
  server.get("/api/inbound-email/messages/:id", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/inbound-email/parser-jobs.ts") {
          return `
export function registerInboundEmailParserJobRoutes(server) {
  server.post("/api/inbound-email/parser-jobs/:jobId/retry", async () => ({}));
  server.post("/api/inbound-email/parser-jobs/:jobId/dead-letter", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/inbound-email/mailgun-raw-mime.ts") {
          return `
export function registerInboundEmailRawMimeRoutes(server) {
  server.post("/api/inbound-email/provider-webhooks/mailgun/raw-mime", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/inbound-email/status.ts") {
          return `
export function registerInboundEmailStatusRoutes(server) {
  server.get("/api/inbound-email/status", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/inbound-email/triage.ts") {
          return `
export function registerInboundEmailTriageRoutes(server) {
  server.patch("/api/communications/inbox/inbound-email/:id", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/intake-forms.ts") {
          return `export function registerIntakeFormRoutes(server) {}`;
        }
        if (path === "apps/api/src/routes/intake-forms/links.ts") {
          return `
export function registerIntakeFormLinkRoutes(server) {
  server.get("/api/intake-form-links", async () => ({}));
  server.post("/api/intake-form-links", async () => ({}));
  server.post("/api/intake-form-links/:id/revoke", async () => ({}));
  server.get("/api/intake-form-links/:id/review", async () => ({}));
  server.post("/api/intake-form-links/:id/review/accept", async () => ({}));
  server.post("/api/intake-form-links/:id/review/reject", async () => ({}));
  server.post("/api/intake-form-links/:id/review/request-more-info", async () => ({}));
  server.get("/api/intake-variable-proposals", async () => ({}));
  server.post("/api/intake-variable-proposals/:id/approve", async () => ({}));
  server.post("/api/intake-variable-proposals/:id/reject", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/intake-forms/public.ts") {
          return `
export function registerPublicIntakeFormRoutes(server) {
  server.get("/api/portal/intake-forms", async () => ({}));
  server.get("/api/portal/intake-forms/:token", async () => ({}));
  server.post("/api/portal/intake-forms/draft", async () => ({}));
  server.post("/api/portal/intake-forms/:token/draft", async () => ({}));
  server.post("/api/portal/intake-forms/submit", async () => ({}));
  server.post("/api/portal/intake-forms/:token/submit", async () => ({}));
  server.post("/api/portal/intake-forms/items/:itemId/uploads", async () => ({}));
  server.post("/api/portal/intake-forms/:token/items/:itemId/uploads", async () => ({}));
  server.post("/api/portal/intake-forms/items/:itemId/documents/:documentId/complete", async () => ({}));
  server.post("/api/portal/intake-forms/:token/items/:itemId/documents/:documentId/complete", async () => ({}));
  server.post("/api/portal/intake-forms/items/:itemId/signature", async () => ({}));
  server.post("/api/portal/intake-forms/:token/items/:itemId/signature", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/intake-forms/templates.ts") {
          return `
export function registerIntakeTemplateRoutes(server) {
  server.post("/api/intake-templates", async () => ({}));
  server.patch("/api/intake-templates/:id", async () => ({}));
  server.post("/api/intake-templates/preview", async () => ({}));
  server.get("/api/intake-templates/:id/qa-preview", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/public-consultation-intakes.ts") {
          return `export function registerPublicConsultationIntakeRoutes(server) {}`;
        }
        if (path === "apps/api/src/routes/public-consultation-intakes/public.ts") {
          return `
export function registerPublicConsultationSubmissionRoutes(server) {
  server.post("/api/public/consultation-intakes", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/ledger.ts") {
          return `export function registerLedgerRoutes(server) {}`;
        }
        if (path === "apps/api/src/routes/ledger/read.ts") {
          return `
export function registerLedgerReadRoutes(server) {
  server.get("/api/ledger", async () => ({}));
  server.get("/api/ledger/controls", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/ledger/reconciliations.ts") {
          return `
export function registerLedgerReconciliationRoutes(server) {
  server.get("/api/ledger/accounting-review-profiles", async () => ({}));
  server.post("/api/ledger/accounting-review-profiles", async () => ({}));
  server.get("/api/ledger/reconciliation-exception-resolutions", async () => ({}));
  server.post("/api/ledger/reconciliation-exception-resolutions", async () => ({}));
  server.post("/api/ledger/reconciliations", async () => ({}));
  server.post("/api/ledger/reconciliations/preview", async () => ({}));
  server.get("/api/ledger/reconciliations/import-batches", async () => ({}));
  server.post("/api/ledger/reconciliations/import-batches", async () => ({}));
  server.get("/api/ledger/reconciliations/match-rule-profiles", async () => ({}));
  server.post("/api/ledger/reconciliations/match-rule-profiles", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/ledger/reports.ts") {
          return `
export function registerLedgerReportRoutes(server) {
  server.get("/api/ledger/reports/jurisdictional-trust", async () => ({}));
  server.post("/api/ledger/reports/jurisdictional-trust/export-requests", async () => ({}));
  server.get("/api/ledger/reports/jurisdictional-trust/export-requests/:exportJobId", async () => ({}));
  server.get("/api/ledger/reports/jurisdictional-trust/export-requests/:exportJobId/download", async () => ({}));
}
`;
        }
        if (path === "apps/api/src/routes/ledger/transactions.ts") {
          return `
export function registerLedgerTransactionRoutes(server) {
  server.post("/api/ledger/transactions", async () => ({}));
  server.post("/api/ledger/transactions/:id/approvals", async () => ({}));
}
`;
        }
        throw new Error(`unexpected read: ${path}`);
      },
    });

    assert.deepEqual(
      declarations.map((declaration) => `${declaration.method} ${declaration.path}`),
      [
        "DELETE /api/calendar/events/:eventId/attendees/:attendeeId",
        "DELETE /api/calendar/events/:eventId/reminders/:reminderId",
        "GET /api/billing/dashboard",
        "GET /api/billing/export-requests/:exportJobId",
        "GET /api/billing/period-locks",
        "GET /api/billing/rate-rules",
        "GET /api/calendar/credentials",
        "GET /api/calendar/events/:eventId/guest-sessions",
        "GET /api/calendar/matters/:matterId.ics",
        "GET /api/connectors/developer/apps",
        "GET /api/connectors/developer/apps/:appId/delivery-history",
        "GET /api/connectors/outbox",
        "GET /api/document-processing/status",
        "GET /api/document-processing/workbench",
        "GET /api/draft-templates",
        "GET /api/expense-entries",
        "GET /api/inbound-email/messages",
        "GET /api/inbound-email/messages/:id",
        "GET /api/inbound-email/status",
        "GET /api/intake-form-links",
        "GET /api/intake-form-links/:id/review",
        "GET /api/intake-templates/:id/qa-preview",
        "GET /api/intake-variable-proposals",
        "GET /api/invoices",
        "GET /api/invoices/:id",
        "GET /api/ledger",
        "GET /api/ledger/accounting-review-profiles",
        "GET /api/ledger/controls",
        "GET /api/ledger/reconciliation-exception-resolutions",
        "GET /api/ledger/reconciliations/import-batches",
        "GET /api/ledger/reconciliations/match-rule-profiles",
        "GET /api/ledger/reports/jurisdictional-trust",
        "GET /api/ledger/reports/jurisdictional-trust/export-requests/:exportJobId",
        "GET /api/ledger/reports/jurisdictional-trust/export-requests/:exportJobId/download",
        "GET /api/payments",
        "GET /api/portal/guest-sessions",
        "GET /api/portal/guest-sessions/:token",
        "GET /api/portal/intake-forms",
        "GET /api/portal/intake-forms/:token",
        "GET /api/time-entries",
        "PATCH /api/calendar/events/:eventId/attendees/:attendeeId",
        "PATCH /api/calendar/events/:eventId/meeting-link",
        "PATCH /api/calendar/events/:eventId/reminders/:reminderId",
        "PATCH /api/communications/inbox/inbound-email/:id",
        "PATCH /api/expense-entries/:id",
        "PATCH /api/intake-templates/:id",
        "PATCH /api/time-entries/:id",
        "POST /api/billing/export-requests",
        "POST /api/billing/period-locks",
        "POST /api/billing/rate-rules",
        "POST /api/calendar/credentials",
        "POST /api/calendar/credentials/:id/revoke",
        "POST /api/calendar/events/:eventId/attendees",
        "POST /api/calendar/events/:eventId/guest-sessions",
        "POST /api/calendar/events/:eventId/guest-sessions/:sessionId/end",
        "POST /api/calendar/events/:eventId/guest-sessions/:sessionId/guest-links",
        "POST /api/calendar/events/:eventId/guest-sessions/:sessionId/guests/:guestId/admit",
        "POST /api/calendar/events/:eventId/guest-sessions/:sessionId/guests/:guestId/deny",
        "POST /api/calendar/events/:eventId/guest-sessions/:sessionId/guests/:guestId/revoke",
        "POST /api/calendar/events/:eventId/guest-sessions/:sessionId/lock",
        "POST /api/calendar/events/:eventId/guest-sessions/:sessionId/open",
        "POST /api/calendar/events/:eventId/invitations",
        "POST /api/calendar/events/:eventId/reminders",
        "POST /api/connectors/developer/apps",
        "POST /api/connectors/developer/apps/:appId/credentials",
        "POST /api/connectors/developer/apps/:appId/webhook-replays",
        "POST /api/connectors/developer/apps/:appId/webhook-subscriptions",
        "POST /api/connectors/developer/credentials/:credentialId/revoke",
        "POST /api/connectors/outbox",
        "POST /api/connectors/outbox/:outboxId/dead-letter",
        "POST /api/connectors/outbox/:outboxId/retry",
        "POST /api/document-processing/documents/:id/queue",
        "POST /api/draft-templates",
        "POST /api/drafts/:id/exports",
        "POST /api/expense-entries",
        "POST /api/expense-entries/:id/approve",
        "POST /api/expense-entries/:id/submit",
        "POST /api/expense-entries/:id/write-off",
        "POST /api/expense-entries/review-drafts",
        "POST /api/inbound-email/messages/:id/attachments/:attachmentId/promote-document",
        "POST /api/inbound-email/parser-jobs/:jobId/dead-letter",
        "POST /api/inbound-email/parser-jobs/:jobId/retry",
        "POST /api/inbound-email/provider-webhooks/mailgun/raw-mime",
        "POST /api/intake-form-links",
        "POST /api/intake-form-links/:id/review/accept",
        "POST /api/intake-form-links/:id/review/reject",
        "POST /api/intake-form-links/:id/review/request-more-info",
        "POST /api/intake-form-links/:id/revoke",
        "POST /api/intake-templates",
        "POST /api/intake-templates/preview",
        "POST /api/intake-variable-proposals/:id/approve",
        "POST /api/intake-variable-proposals/:id/reject",
        "POST /api/invoices",
        "POST /api/invoices/:id/approve",
        "POST /api/invoices/:id/issue",
        "POST /api/invoices/:id/void",
        "POST /api/ledger/accounting-review-profiles",
        "POST /api/ledger/reconciliation-exception-resolutions",
        "POST /api/ledger/reconciliations",
        "POST /api/ledger/reconciliations/import-batches",
        "POST /api/ledger/reconciliations/match-rule-profiles",
        "POST /api/ledger/reconciliations/preview",
        "POST /api/ledger/reports/jurisdictional-trust/export-requests",
        "POST /api/ledger/transactions",
        "POST /api/ledger/transactions/:id/approvals",
        "POST /api/payments",
        "POST /api/portal/guest-sessions/:token/check-in",
        "POST /api/portal/guest-sessions/check-in",
        "POST /api/portal/intake-forms/:token/draft",
        "POST /api/portal/intake-forms/:token/items/:itemId/documents/:documentId/complete",
        "POST /api/portal/intake-forms/:token/items/:itemId/signature",
        "POST /api/portal/intake-forms/:token/items/:itemId/uploads",
        "POST /api/portal/intake-forms/:token/submit",
        "POST /api/portal/intake-forms/draft",
        "POST /api/portal/intake-forms/items/:itemId/documents/:documentId/complete",
        "POST /api/portal/intake-forms/items/:itemId/signature",
        "POST /api/portal/intake-forms/items/:itemId/uploads",
        "POST /api/portal/intake-forms/submit",
        "POST /api/public/consultation-intakes",
        "POST /api/time-entries",
        "POST /api/time-entries/:id/approve",
        "POST /api/time-entries/:id/submit",
        "POST /api/time-entries/:id/write-off",
        "POST /api/time-entries/timer-drafts",
        "PUT /api/document-processing/ocr-provider",
      ],
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

  it("blocks app imports that bypass package exports and disallowed workspace edges", () => {
    const failures = collectWorkspaceImportFailures({
      sourceFiles: [
        "apps/api/src/routes/example.test.ts",
        "apps/web/app/example.tsx",
        "packages/domain/src/example.ts",
      ],
      readText: (path) => {
        if (path === "apps/api/src/routes/example.test.ts") {
          return `
            import { InMemoryOpenPracticeRepository } from "../../../../packages/database/src/repository/memory.js";
            import { FakeDraftAssistProvider } from "@open-practice/providers";
          `;
        }
        if (path === "apps/web/app/example.tsx") {
          return `
            import type { User } from "@open-practice/domain";
            import { InMemoryOpenPracticeRepository } from "@open-practice/database";
          `;
        }
        if (path === "packages/domain/src/example.ts") {
          return `import { InMemoryOpenPracticeRepository } from "@open-practice/database";`;
        }
        throw new Error(`unexpected read: ${path}`);
      },
      webDomainRootImportLimit: 0,
    });

    assert.ok(
      failures.includes(
        "apps/api/src/routes/example.test.ts imports ../../../../packages/database/src/repository/memory.js; app code must use package exports instead of package source paths.",
      ),
    );
    assert.ok(
      failures.includes(
        "apps/web/app/example.tsx imports @open-practice/database; apps/web may only import @open-practice/domain.",
      ),
    );
    assert.ok(
      failures.includes(
        "packages/domain/src/example.ts imports @open-practice/database; packages/domain may only import no @open-practice workspace packages.",
      ),
    );
    assert.ok(
      failures.includes(
        "apps/web has 1 root @open-practice/domain imports; current ratchet allows 0. Use web-safe domain subpaths for new browser-facing imports.",
      ),
    );
  });

  it("requires workspace packages to expose a consistent root export", () => {
    const failures = collectPackageExportFailures({
      packageManifests: ["packages/database/package.json", "packages/providers/package.json"],
      readText: (path) => {
        if (path === "packages/database/package.json") {
          return JSON.stringify({
            name: "@open-practice/database",
            main: "dist/index.js",
            types: "dist/index.d.ts",
          });
        }
        if (path === "packages/providers/package.json") {
          return JSON.stringify({
            name: "@open-practice/providers",
            main: "dist/index.js",
            types: "dist/index.d.ts",
            exports: {
              ".": {
                types: "./wrong.d.ts",
                default: "./wrong.js",
              },
            },
          });
        }
        throw new Error(`unexpected read: ${path}`);
      },
    });

    assert.deepEqual(failures, [
      'packages/database/package.json must declare exports["."].',
      'packages/providers/package.json exports["."].types must point to ./dist/index.d.ts; found ./wrong.d.ts.',
      'packages/providers/package.json exports["."].default must point to ./dist/index.js; found ./wrong.js.',
    ]);
  });
});
