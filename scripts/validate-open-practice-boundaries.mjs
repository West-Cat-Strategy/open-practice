#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export const SERVER_RATCHETS = [
  {
    count: (server) =>
      [...server.matchAll(/\bserver\.(get|post|put|patch|delete|route)\s*\(/g)].length,
    limit: 1,
    message: (count) =>
      `apps/api/src/server.ts defines ${count} direct routes; current ratchet allows 1. Move new routes into module-owned registrars.`,
  },
  {
    count: (server) => [...server.matchAll(/\.parse\(request\.(body|query|params)\)/g)].length,
    limit: 0,
    message: (count) =>
      `apps/api/src/server.ts contains ${count} inline request parses; current ratchet allows 0. Use shared validation helpers for new code.`,
  },
  {
    count: (server) =>
      [...server.matchAll(/reply\.status\([^)]*\)\.send\(\s*\{\s*error:/gs)].length,
    limit: 1,
    message: (count) =>
      `apps/api/src/server.ts contains ${count} direct error envelopes; current ratchet allows 1. Use shared response helpers for new code.`,
  },
];

export const REQUIRED_SCAFFOLD = [
  "apps/api/src/http/response.ts",
  "apps/api/src/http/validation.ts",
  "apps/api/src/http/auth-guards.ts",
  "apps/api/src/routes/billing.ts",
  "apps/api/src/routes/documents.ts",
  "apps/api/src/routes/drafts.ts",
  "apps/api/src/routes/intake.ts",
  "apps/api/src/routes/ledger.ts",
  "apps/api/src/routes/queues.ts",
  "apps/api/src/routes/signatures.ts",
  "apps/api/src/routes/auth.ts",
  "apps/api/src/routes/session.ts",
  "apps/api/src/routes/matters.ts",
  "apps/api/src/routes/audit.ts",
  "apps/api/src/routes/types.ts",
  "apps/web/routes/routeCatalog.ts",
  "docs/README.md",
  "docs/testing/TESTING.md",
  "docs/development/getting-started.md",
  "scripts/select-validation.mjs",
];

export const ROUTE_REGISTRARS = [
  ["setup", "apps/api/src/routes/setup.ts", "./routes/setup.js", "registerSetupRoutes"],
  ["WebAuthn", "apps/api/src/routes/webauthn.ts", "./routes/webauthn.js", "registerWebAuthnRoutes"],
  ["recovery", "apps/api/src/routes/recovery.ts", "./routes/recovery.js", "registerRecoveryRoutes"],
  ["contacts", "apps/api/src/routes/contacts.ts", "./routes/contacts.js", "registerContactRoutes"],
  [
    "connectors",
    "apps/api/src/routes/connectors.ts",
    "./routes/connectors.js",
    "registerConnectorRoutes",
  ],
  [
    "conversation threads",
    "apps/api/src/routes/conversation-threads.ts",
    "./routes/conversation-threads.js",
    "registerConversationThreadRoutes",
  ],
  [
    "legal clinics",
    "apps/api/src/routes/legal-clinics.ts",
    "./routes/legal-clinics.js",
    "registerLegalClinicRoutes",
  ],
  ["CalDAV", "apps/api/src/routes/caldav.ts", "./routes/caldav.js", "registerCalDavRoutes"],
  ["calendar", "apps/api/src/routes/calendar.ts", "./routes/calendar.js", "registerCalendarRoutes"],
  [
    "document processing",
    "apps/api/src/routes/document-processing.ts",
    "./routes/document-processing.js",
    "registerDocumentProcessingRoutes",
  ],
  [
    "draft assist",
    "apps/api/src/routes/draft-assist.ts",
    "./routes/draft-assist.js",
    "registerDraftAssistRoutes",
  ],
  ["jobs", "apps/api/src/routes/jobs.ts", "./routes/jobs.js", "registerJobsRoutes"],
  ["email", "apps/api/src/routes/email.ts", "./routes/email.js", "registerEmailRoutes"],
  [
    "inbound email",
    "apps/api/src/routes/inbound-email.ts",
    "./routes/inbound-email.js",
    "registerInboundEmailRoutes",
  ],
  ["shares", "apps/api/src/routes/shares.ts", "./routes/shares.js", "registerShareRoutes"],
  [
    "external uploads",
    "apps/api/src/routes/external-uploads.ts",
    "./routes/external-uploads.js",
    "registerExternalUploadRoutes",
  ],
  [
    "auth extensions",
    "apps/api/src/routes/auth-extensions.ts",
    "./routes/auth-extensions.js",
    "registerAuthExtensionRoutes",
  ],
  [
    "intake forms",
    "apps/api/src/routes/intake-forms.ts",
    "./routes/intake-forms.js",
    "registerIntakeFormRoutes",
  ],
  [
    "operational views",
    "apps/api/src/routes/operational-views.ts",
    "./routes/operational-views.js",
    "registerOperationalViewRoutes",
  ],
  [
    "outbound webhooks",
    "apps/api/src/routes/outbound-webhooks.ts",
    "./routes/outbound-webhooks.js",
    "registerOutboundWebhookRoutes",
  ],
  ["tasks", "apps/api/src/routes/tasks.ts", "./routes/tasks.js", "registerTaskRoutes"],
].map(([family, file, importPath, registrar]) => ({ family, file, importPath, registrar }));

export const FORBIDDEN_SERVER_ROUTE_GROUPS = [
  {
    owner: "billing endpoints in apps/api/src/routes/billing.ts",
    routeLiterals: [
      "/api/time-entries",
      "/api/expense-entries",
      "/api/invoices",
      "/api/payments",
      "/api/billing/trust-transfer-requests",
      "/api/billing/dashboard",
    ],
  },
  {
    owner: "document endpoints in apps/api/src/routes/documents.ts",
    routeLiterals: [
      "/api/documents/presign-upload",
      "/api/documents/:id/upload-complete",
      "/api/documents/:id/scan-status",
    ],
  },
  {
    owner: "signature endpoints in apps/api/src/routes/signatures.ts",
    routeLiterals: [
      "/api/signature-requests",
      "/api/signature-requests/provider-events",
      "/api/signature-requests/:id/embedded-events",
      "/api/signature-requests/:id/events",
    ],
  },
  {
    owner: "intake endpoints in apps/api/src/routes/intake.ts",
    routeLiterals: [
      "/api/intake-sessions",
      "/api/intake-sessions/:id/answer-snapshots",
      "/api/intake-sessions/:id/generated-documents",
    ],
  },
  {
    owner: "ledger endpoints in apps/api/src/routes/ledger.ts",
    routeLiterals: [
      "/api/ledger",
      "/api/ledger/transactions",
      "/api/ledger/transactions/:id/approvals",
      "/api/ledger/reconciliations",
    ],
  },
  { owner: "queue endpoints in apps/api/src/routes/queues.ts", routeLiterals: ["/api/queues"] },
  {
    owner: "auth endpoints in apps/api/src/routes/auth.ts",
    routeLiterals: [
      "/api/auth/login",
      "/api/auth/logout",
      "/api/auth/session",
      "/api/auth/password-setup-tokens",
      "/api/auth/password-setup",
    ],
  },
  {
    owner: "session endpoints in apps/api/src/routes/session.ts",
    routeLiterals: ["/api/session", "/api/capabilities"],
  },
  {
    owner: "matter endpoints in apps/api/src/routes/matters.ts",
    routeLiterals: ["/api/overview", "/api/matters", "/api/conflicts/check"],
  },
  { owner: "audit endpoints in apps/api/src/routes/audit.ts", routeLiterals: ["/api/audit"] },
  {
    owner: "draft endpoints in apps/api/src/routes/drafts.ts",
    routeLiterals: ["/api/drafts", "/api/drafts/:id", "/api/draft-templates"],
  },
];

export const FORBIDDEN_PREFIX_ROUTE_GROUPS = [
  { family: "setup", routeLiterals: ["/api/setup/"] },
  {
    family: "WebAuthn",
    routeLiterals: [
      "/api/auth/register/",
      "/api/auth/login/",
      "/api/auth/credentials",
      "/api/auth/mfa/",
    ],
  },
  { family: "recovery", routeLiterals: ["/api/auth/recovery-codes/"] },
  { family: "auth extension", routeLiterals: ["/api/auth/extensions"] },
  { family: "contact", routeLiterals: ["/api/contacts/"] },
  { family: "connector", routeLiterals: ["/api/connectors"] },
  { family: "conversation thread", routeLiterals: ["/api/conversation-threads"] },
  { family: "legal clinic", routeLiterals: ["/api/legal-clinic/"] },
  { family: "CalDAV", routeLiterals: ["/caldav", "/.well-known/caldav"] },
  { family: "calendar", routeLiterals: ["/api/calendar/"] },
  { family: "document processing", routeLiterals: ["/api/document-processing/"] },
  {
    family: "draft assist",
    routeLiterals: ["/api/draft-assist/", "/api/drafts/:id/assist", "/api/documents/:id/assist"],
  },
  { family: "job", routeLiterals: ["/api/jobs"] },
  { family: "email", routeLiterals: ["/api/email/", "/api/mail/"] },
  { family: "inbound email", routeLiterals: ["/api/inbound-email/"] },
  { family: "share", routeLiterals: ["/api/shares", "/api/portal/shares/"] },
  {
    family: "external upload",
    routeLiterals: ["/api/external-uploads", "/api/portal/external-uploads/"],
  },
  {
    family: "intake form",
    routeLiterals: [
      "/api/intake-templates",
      "/api/intake-form-links",
      "/api/intake-variable-proposals",
      "/api/portal/intake-forms/",
    ],
  },
  { family: "operational view", routeLiterals: ["/api/operational-views"] },
  { family: "outbound webhook", routeLiterals: ["/api/outbound-webhooks/"] },
  { family: "task", routeLiterals: ["/api/tasks/"] },
];

export const REQUIRED_ROUTE_CATALOG_IDS = [
  "matters",
  "billing",
  "documents",
  "signatures",
  "intake",
  "funds",
  "audit",
  "queues",
];

function defaultRead(path, root = ROOT) {
  return readFileSync(join(root, path), "utf8");
}

function defaultExists(path, root = ROOT) {
  return existsSync(join(root, path));
}

export function serverContainsRouteLiteral(server, routeLiteral) {
  return (
    server.includes(`"${routeLiteral}`) ||
    server.includes(`'${routeLiteral}`) ||
    server.includes(`\`${routeLiteral}`)
  );
}

export function collectServerRatchetFailures(server) {
  return SERVER_RATCHETS.flatMap((ratchet) => {
    const count = ratchet.count(server);
    return count <= ratchet.limit ? [] : [ratchet.message(count)];
  });
}

export function collectScaffoldFailures(exists) {
  return REQUIRED_SCAFFOLD.flatMap((required) =>
    exists(required) ? [] : [`${required} must exist as the adoption scaffold.`],
  );
}

export function collectRegistrarFailures(server, exists) {
  return ROUTE_REGISTRARS.flatMap((routeRegistrar) => {
    const failures = [];

    if (!exists(routeRegistrar.file)) {
      failures.push(
        `${routeRegistrar.file} must exist for the ${routeRegistrar.family} route family.`,
      );
    }

    if (
      !server.includes(
        `import { ${routeRegistrar.registrar} } from "${routeRegistrar.importPath}";`,
      )
    ) {
      failures.push(
        `apps/api/src/server.ts must import ${routeRegistrar.registrar} from ${routeRegistrar.importPath}.`,
      );
    }

    if (!server.includes(`${routeRegistrar.registrar}(server`)) {
      failures.push(`apps/api/src/server.ts must wire ${routeRegistrar.registrar}.`);
    }

    return failures;
  });
}

export function collectForbiddenRouteFailures(server) {
  const exactFailures = FORBIDDEN_SERVER_ROUTE_GROUPS.flatMap(({ owner, routeLiterals }) =>
    routeLiterals.flatMap((routeLiteral) =>
      server.includes(routeLiteral)
        ? [`apps/api/src/server.ts still contains route literal ${routeLiteral}; keep ${owner}.`]
        : [],
    ),
  );

  const prefixFailures = FORBIDDEN_PREFIX_ROUTE_GROUPS.flatMap(({ family, routeLiterals }) =>
    routeLiterals.flatMap((routeLiteral) =>
      serverContainsRouteLiteral(server, routeLiteral)
        ? [
            `apps/api/src/server.ts still contains ${family} route literal ${routeLiteral}; keep ${family} endpoints in their module-owned route registrar.`,
          ]
        : [],
    ),
  );

  return [...exactFailures, ...prefixFailures];
}

export function collectRouteCatalogFailures(routeCatalog) {
  return REQUIRED_ROUTE_CATALOG_IDS.flatMap((routeId) =>
    routeCatalog.includes(`id: "${routeId}"`) ? [] : [`route catalog is missing ${routeId}.`],
  );
}

export function evaluateBoundaryPolicy({
  root = ROOT,
  readText = (path) => defaultRead(path, root),
  pathExists = (path) => defaultExists(path, root),
} = {}) {
  const server = readText("apps/api/src/server.ts");
  const routeCatalog = readText("apps/web/routes/routeCatalog.ts");

  return [
    ...collectServerRatchetFailures(server),
    ...collectScaffoldFailures(pathExists),
    ...collectRegistrarFailures(server, pathExists),
    ...collectForbiddenRouteFailures(server),
    ...collectRouteCatalogFailures(routeCatalog),
  ];
}

export function runCli() {
  const failures = evaluateBoundaryPolicy();

  if (failures.length > 0) {
    console.error("Open Practice boundary policy failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("Open Practice boundary policy passed.");
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  runCli();
}
