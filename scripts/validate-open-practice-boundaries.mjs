#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import {
  MATTER_SCOPED_AUTH_RESOURCES,
  ROUTE_AUTHORIZATION_MANIFEST,
  VALID_AUTH_ACTIONS,
  VALID_AUTH_RESOURCES,
  VALID_MATTER_SCOPES,
  publicRouteSamplePath,
  routeAuthorizationKey,
} from "./route-authorization-manifest.mjs";

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);

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
  ["auth", "apps/api/src/routes/auth.ts", "./routes/auth.js", "registerAuthRoutes"],
  ["recovery", "apps/api/src/routes/recovery.ts", "./routes/recovery.js", "registerRecoveryRoutes"],
  ["session", "apps/api/src/routes/session.ts", "./routes/session.js", "registerSessionRoutes"],
  ["matters", "apps/api/src/routes/matters.ts", "./routes/matters.js", "registerMatterRoutes"],
  ["contacts", "apps/api/src/routes/contacts.ts", "./routes/contacts.js", "registerContactRoutes"],
  [
    "connectors",
    "apps/api/src/routes/connectors.ts",
    "./routes/connectors.js",
    "registerConnectorRoutes",
  ],
  [
    "communications",
    "apps/api/src/routes/communications.ts",
    "./routes/communications.js",
    "registerCommunicationsRoutes",
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
  ["ledger", "apps/api/src/routes/ledger.ts", "./routes/ledger.js", "registerLedgerRoutes"],
  ["billing", "apps/api/src/routes/billing.ts", "./routes/billing.js", "registerBillingRoutes"],
  ["CalDAV", "apps/api/src/routes/caldav.ts", "./routes/caldav.js", "registerCalDavRoutes"],
  ["calendar", "apps/api/src/routes/calendar.ts", "./routes/calendar.js", "registerCalendarRoutes"],
  [
    "client portal",
    "apps/api/src/routes/client-portal.ts",
    "./routes/client-portal.js",
    "registerClientPortalRoutes",
  ],
  [
    "documents",
    "apps/api/src/routes/documents.ts",
    "./routes/documents.js",
    "registerDocumentRoutes",
  ],
  [
    "e2e support",
    "apps/api/src/routes/e2e-support.ts",
    "./routes/e2e-support.js",
    "registerE2ESupportRoutes",
  ],
  [
    "document processing",
    "apps/api/src/routes/document-processing.ts",
    "./routes/document-processing.js",
    "registerDocumentProcessingRoutes",
  ],
  [
    "document assembly",
    "apps/api/src/routes/document-assembly.ts",
    "./routes/document-assembly.js",
    "registerDocumentAssemblyRoutes",
  ],
  ["drafts", "apps/api/src/routes/drafts.ts", "./routes/drafts.js", "registerDraftRoutes"],
  [
    "draft assist",
    "apps/api/src/routes/draft-assist.ts",
    "./routes/draft-assist.js",
    "registerDraftAssistRoutes",
  ],
  [
    "AI operational proposals",
    "apps/api/src/routes/ai-operational-proposals.ts",
    "./routes/ai-operational-proposals.js",
    "registerAiOperationalProposalRoutes",
  ],
  [
    "legal research",
    "apps/api/src/routes/legal-research.ts",
    "./routes/legal-research.js",
    "registerLegalResearchRoutes",
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
  ["audit", "apps/api/src/routes/audit.ts", "./routes/audit.js", "registerAuditRoutes"],
  [
    "signatures",
    "apps/api/src/routes/signatures.ts",
    "./routes/signatures.js",
    "registerSignatureRoutes",
  ],
  ["intake", "apps/api/src/routes/intake.ts", "./routes/intake.js", "registerIntakeRoutes"],
  [
    "intake pipeline",
    "apps/api/src/routes/intake-pipeline.ts",
    "./routes/intake-pipeline.js",
    "registerIntakePipelineRoutes",
  ],
  [
    "intake forms",
    "apps/api/src/routes/intake-forms.ts",
    "./routes/intake-forms.js",
    "registerIntakeFormRoutes",
  ],
  [
    "public consultation intakes",
    "apps/api/src/routes/public-consultation-intakes.ts",
    "./routes/public-consultation-intakes.js",
    "registerPublicConsultationIntakeRoutes",
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
  [
    "provider status",
    "apps/api/src/routes/providers-status.ts",
    "./routes/providers-status.js",
    "registerProviderStatusRoutes",
  ],
  ["tasks", "apps/api/src/routes/tasks.ts", "./routes/tasks.js", "registerTaskRoutes"],
  ["queues", "apps/api/src/routes/queues.ts", "./routes/queues.js", "registerQueuesRoutes"],
  ["reports", "apps/api/src/routes/reports.ts", "./routes/reports.js", "registerReportRoutes"],
].map(([family, file, importPath, registrar]) => ({ family, file, importPath, registrar }));

export const ROUTE_REGISTRAR_TEST_FILES = {
  registerAuditRoutes: ["apps/api/src/routes/audit.test.ts"],
  registerAuthExtensionRoutes: ["apps/api/src/routes/auth-extensions.test.ts"],
  registerAuthRoutes: ["apps/api/src/server.test.ts", "apps/api/src/routes/mfa.test.ts"],
  registerBillingRoutes: ["apps/api/src/routes/billing.test.ts"],
  registerCalDavRoutes: ["apps/api/src/routes/caldav.test.ts"],
  registerCalendarRoutes: ["apps/api/src/routes/calendar.test.ts"],
  registerClientPortalRoutes: ["apps/api/src/routes/client-portal.test.ts"],
  registerCommunicationsRoutes: ["apps/api/src/routes/communications.test.ts"],
  registerConnectorRoutes: ["apps/api/src/routes/connectors.test.ts"],
  registerContactRoutes: ["apps/api/src/routes/contacts.test.ts"],
  registerConversationThreadRoutes: ["apps/api/src/routes/conversation-threads.test.ts"],
  registerDocumentAssemblyRoutes: ["apps/api/src/routes/document-assembly.test.ts"],
  registerDocumentProcessingRoutes: ["apps/api/src/routes/document-processing.test.ts"],
  registerDocumentRoutes: ["apps/api/src/routes/documents.test.ts"],
  registerE2ESupportRoutes: ["apps/api/src/routes/e2e-support.test.ts"],
  registerDraftAssistRoutes: ["apps/api/src/routes/draft-assist.test.ts"],
  registerAiOperationalProposalRoutes: ["apps/api/src/routes/ai-operational-proposals.test.ts"],
  registerDraftRoutes: ["apps/api/src/routes/drafts.test.ts"],
  registerEmailRoutes: ["apps/api/src/routes/email.test.ts"],
  registerExternalUploadRoutes: ["apps/api/src/routes/external-uploads.test.ts"],
  registerInboundEmailRoutes: ["apps/api/src/routes/inbound-email.test.ts"],
  registerIntakeFormRoutes: ["apps/api/src/routes/intake-forms.test.ts"],
  registerIntakePipelineRoutes: ["apps/api/src/routes/intake-pipeline.test.ts"],
  registerIntakeRoutes: ["apps/api/src/routes/intake.test.ts"],
  registerJobsRoutes: ["apps/api/src/routes/jobs.test.ts"],
  registerLedgerRoutes: ["apps/api/src/routes/ledger.test.ts"],
  registerLegalClinicRoutes: ["apps/api/src/routes/legal-clinics.test.ts"],
  registerLegalResearchRoutes: ["apps/api/src/routes/legal-research.test.ts"],
  registerMatterRoutes: ["apps/api/src/server.test.ts"],
  registerOperationalViewRoutes: ["apps/api/src/routes/operational-views.test.ts"],
  registerOutboundWebhookRoutes: ["apps/api/src/routes/outbound-webhooks.test.ts"],
  registerProviderStatusRoutes: ["apps/api/src/routes/providers-status.test.ts"],
  registerPublicConsultationIntakeRoutes: [
    "apps/api/src/routes/public-consultation-intakes.test.ts",
  ],
  registerQueuesRoutes: ["apps/api/src/routes/queues.test.ts"],
  registerReportRoutes: ["apps/api/src/routes/reports.test.ts"],
  registerRecoveryRoutes: ["apps/api/src/routes/mfa.test.ts"],
  registerSessionRoutes: ["apps/api/src/server.test.ts"],
  registerSetupRoutes: ["apps/api/src/server.test.ts"],
  registerShareRoutes: ["apps/api/src/routes/shares.test.ts"],
  registerSignatureRoutes: ["apps/api/src/routes/signatures.test.ts"],
  registerTaskRoutes: ["apps/api/src/routes/tasks.test.ts"],
  registerWebAuthnRoutes: ["apps/api/src/routes/webauthn.test.ts"],
};

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
      "/api/documents/upload-intents",
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
      "/api/ledger/reconciliations/preview",
      "/api/ledger/reconciliations/import-batches",
      "/api/ledger/reconciliations/match-rule-profiles",
      "/api/ledger/accounting-review-profiles",
      "/api/ledger/reconciliation-exception-resolutions",
      "/api/ledger/reconciliations",
    ],
  },
  { owner: "queue endpoints in apps/api/src/routes/queues.ts", routeLiterals: ["/api/queues"] },
  {
    owner: "report endpoints in apps/api/src/routes/reports.ts",
    routeLiterals: [
      "/api/reports/workspace",
      "/api/reports/export-requests",
      "/api/reports/export-requests/:exportJobId",
      "/api/reports/export-requests/:exportJobId/download",
    ],
  },
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
  {
    owner: "communications endpoints in apps/api/src/routes/communications.ts",
    routeLiterals: ["/api/communications/inbox"],
  },
  {
    owner: "provider status endpoints in apps/api/src/routes/providers-status.ts",
    routeLiterals: ["/api/providers/status"],
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
  {
    family: "AI operational proposal",
    routeLiterals: [
      "/api/ai-operational-proposals",
      "/api/drafts/:id/operational-proposals/jobs",
      "/api/documents/:id/operational-proposals/jobs",
    ],
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

export function collectRegistrarTestFailures(exists) {
  return ROUTE_REGISTRARS.flatMap(({ family, registrar }) => {
    const testFiles = ROUTE_REGISTRAR_TEST_FILES[registrar] ?? [];

    if (testFiles.length === 0) {
      return [`${registrar} must declare at least one test file for the ${family} route family.`];
    }

    const existingTestFiles = testFiles.filter((testFile) => exists(testFile));
    if (existingTestFiles.length > 0) return [];

    return [
      `${registrar} must keep at least one route test file for ${family}: ${testFiles.join(", ")}.`,
    ];
  });
}

export function collectUntrackedRegistrarFailures(server) {
  const tracked = new Set(ROUTE_REGISTRARS.map(({ registrar }) => registrar));
  const importedRegistrars = [
    ...server.matchAll(
      /import \{\s*(register[A-Za-z0-9]+Routes)\s*\} from "(\.\/routes\/[^"]+)";/g,
    ),
  ].map((match) => ({ registrar: match[1], importPath: match[2] }));

  return importedRegistrars.flatMap(({ registrar, importPath }) =>
    tracked.has(registrar)
      ? []
      : [
          `${registrar} from ${importPath} must be represented in ROUTE_REGISTRARS so the boundary gate owns its route family.`,
        ],
  );
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

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isSatisfiesExpression?.(current)
  ) {
    current = current.expression;
  }
  return current;
}

function stringValue(node) {
  const current = unwrapExpression(node);
  if (ts.isStringLiteralLike(current)) return current.text;
  return undefined;
}

function cartesianPathValues(paths, span, sourceFile, templateValues) {
  const expressionText = span.expression.getText(sourceFile);
  const replacements = templateValues.get(expressionText);
  const values = replacements ?? [`\${${expressionText}}`];
  return paths.flatMap((path) => values.map((value) => `${path}${value}${span.literal.text}`));
}

function routePathValues(node, sourceFile, templateValues = new Map()) {
  const current = unwrapExpression(node);
  if (ts.isStringLiteralLike(current)) return [current.text];
  if (ts.isNoSubstitutionTemplateLiteral(current)) return [current.text];
  if (!ts.isTemplateExpression(current)) return [];

  return current.templateSpans.reduce(
    (paths, span) => cartesianPathValues(paths, span, sourceFile, templateValues),
    [current.head.text],
  );
}

function routeMethods(node) {
  const current = unwrapExpression(node);
  if (ts.isStringLiteralLike(current)) return [current.text.toUpperCase()];
  if (!ts.isArrayLiteralExpression(current)) return [];
  return current.elements.flatMap((element) => {
    const value = stringValue(element);
    return value ? [value.toUpperCase()] : [];
  });
}

function propertyValue(objectLiteral, propertyName) {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name;
    if (
      (ts.isIdentifier(name) && name.text === propertyName) ||
      (ts.isStringLiteral(name) && name.text === propertyName)
    ) {
      return property.initializer;
    }
  }
  return undefined;
}

function tokenPolicyScopeFromExpression(node) {
  const current = unwrapExpression(node);
  if (!ts.isCallExpression(current)) return undefined;
  const expression = unwrapExpression(current.expression);
  if (!ts.isIdentifier(expression) || expression.text !== "publicTokenPolicyOptions") {
    return undefined;
  }
  const family = current.arguments[0] ? stringValue(current.arguments[0]) : undefined;
  const scope = current.arguments[1] ? stringValue(current.arguments[1]) : undefined;
  return family && scope ? `${family}:${scope}` : undefined;
}

function routeDeclarationsFromCall(call, sourceFile, registrar, templateValues = new Map()) {
  const expression = unwrapExpression(call.expression);
  if (!ts.isPropertyAccessExpression(expression)) return [];
  if (expression.expression.getText(sourceFile) !== "server") return [];

  const methodName = expression.name.text;
  if (["get", "post", "put", "patch", "delete"].includes(methodName)) {
    const paths = call.arguments[0]
      ? routePathValues(call.arguments[0], sourceFile, templateValues)
      : [];
    if (paths.length === 0) return [];
    const tokenPolicyScope = call.arguments
      .slice(1)
      .map((argument) => tokenPolicyScopeFromExpression(argument))
      .find(Boolean);
    return paths.map((path) => ({
      method: methodName.toUpperCase(),
      path,
      registrar,
      tokenPolicyScope,
    }));
  }

  if (methodName !== "route") return [];
  const routeOptions = call.arguments[0] ? unwrapExpression(call.arguments[0]) : undefined;
  if (!routeOptions || !ts.isObjectLiteralExpression(routeOptions)) return [];
  const urlNode = propertyValue(routeOptions, "url");
  const methodNode = propertyValue(routeOptions, "method");
  const paths = urlNode ? routePathValues(urlNode, sourceFile, templateValues) : [];
  if (paths.length === 0 || !methodNode) return [];
  return routeMethods(methodNode).flatMap((method) =>
    paths.map((path) => ({ method, path, registrar })),
  );
}

function loopTemplateValues(node) {
  if (!ts.isForOfStatement(node)) return undefined;
  const initializer = node.initializer;
  if (!ts.isVariableDeclarationList(initializer)) return undefined;
  const declaration = initializer.declarations[0];
  if (!declaration || !ts.isArrayBindingPattern(declaration.name)) return undefined;
  const loopExpression = unwrapExpression(node.expression);
  if (!ts.isArrayLiteralExpression(loopExpression)) return undefined;

  const bindings = declaration.name.elements
    .map((element) =>
      ts.isBindingElement(element) && ts.isIdentifier(element.name) ? element.name.text : undefined,
    )
    .filter(Boolean);
  if (bindings.length === 0) return undefined;

  const values = new Map();
  for (const binding of bindings) values.set(binding, []);

  for (const tuple of loopExpression.elements) {
    const current = unwrapExpression(tuple);
    if (!ts.isArrayLiteralExpression(current)) continue;
    bindings.forEach((binding, index) => {
      const value = current.elements[index] ? stringValue(current.elements[index]) : undefined;
      if (value) values.get(binding)?.push(value);
    });
  }

  for (const binding of bindings) {
    if ((values.get(binding) ?? []).length === 0) values.delete(binding);
  }
  return values.size > 0 ? values : undefined;
}

function mergeTemplateValues(parentValues, nextValues) {
  if (!nextValues) return parentValues;
  const merged = new Map(parentValues);
  for (const [key, value] of nextValues) merged.set(key, value);
  return merged;
}

export function collectApiRouteDeclarations({
  readText = defaultRead,
  routeRegistrars = ROUTE_REGISTRARS,
} = {}) {
  const routeOwners = [
    { registrar: "serverHealth", file: "apps/api/src/server.ts" },
    ...routeRegistrars.map(({ registrar, file }) => ({ registrar, file })),
  ];
  const declarations = [];

  for (const owner of routeOwners) {
    const sourceText = readText(owner.file);
    const sourceFile = ts.createSourceFile(owner.file, sourceText, ts.ScriptTarget.Latest, true);
    const visit = (node, templateValues = new Map()) => {
      const scopedTemplateValues = mergeTemplateValues(templateValues, loopTemplateValues(node));
      if (ts.isCallExpression(node)) {
        declarations.push(
          ...routeDeclarationsFromCall(node, sourceFile, owner.registrar, scopedTemplateValues),
        );
      }
      ts.forEachChild(node, (child) => visit(child, scopedTemplateValues));
    };
    visit(sourceFile);
  }

  declarations.sort((left, right) =>
    routeAuthorizationKey(left).localeCompare(routeAuthorizationKey(right)),
  );
  return declarations;
}

let cachedDefaultIsPublicRoute;
let cachedDefaultPublicRouteSamples;

function authHelperExports(readText) {
  const source = readText("apps/api/src/http/auth-helpers.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    require,
    module,
    exports: module.exports,
  });
  return module.exports;
}

function defaultIsPublicRoute(readText) {
  if (cachedDefaultIsPublicRoute) return cachedDefaultIsPublicRoute;
  cachedDefaultIsPublicRoute = authHelperExports(readText).isPublicRoute;
  return cachedDefaultIsPublicRoute;
}

function defaultPublicRouteSamples(readText) {
  if (cachedDefaultPublicRouteSamples) return cachedDefaultPublicRouteSamples;
  cachedDefaultPublicRouteSamples = authHelperExports(readText).PUBLIC_ROUTE_SAMPLES ?? [];
  return cachedDefaultPublicRouteSamples;
}

function manifestAuthUsesGlobalPublic(auth) {
  return auth.kind === "public" || auth.kind === "token" || auth.globalPublic === true;
}

function authGuardEntries(auth) {
  if (!auth || (auth.kind !== "authenticated" && auth.kind !== "basic")) return [];
  if (Array.isArray(auth.guards)) return auth.guards;
  return [
    {
      resource: auth.resource,
      action: auth.action,
      matterScope: auth.matterScope,
      hasMatterScope: "matterScope" in auth,
    },
  ];
}

function validateAuthGuardEntry(key, guard, failures) {
  if (!guard || typeof guard !== "object") {
    failures.push(`${key} manifest guard must be an object.`);
    return;
  }

  if (!VALID_AUTH_RESOURCES.includes(guard.resource)) {
    failures.push(
      `${key} manifest resource ${guard.resource ?? "<missing>"} is not a valid ResourceKind.`,
    );
  }

  if (!VALID_AUTH_ACTIONS.includes(guard.action)) {
    failures.push(`${key} manifest action ${guard.action ?? "<missing>"} is not a valid Action.`);
  }

  const hasMatterScope = guard.hasMatterScope ?? "matterScope" in guard;
  if (MATTER_SCOPED_AUTH_RESOURCES.includes(guard.resource) && !hasMatterScope) {
    failures.push(`${key} manifest resource ${guard.resource} must declare matterScope.`);
  }

  if (hasMatterScope && !VALID_MATTER_SCOPES.includes(guard.matterScope)) {
    failures.push(`${key} manifest matterScope ${guard.matterScope} is not supported.`);
  }
}

function validateAuthEntry(entry, failures, pathExists, knownRegistrars) {
  const key = routeAuthorizationKey(entry);

  if (!knownRegistrars.has(entry.registrar)) {
    failures.push(`${key} manifest references unknown registrar ${entry.registrar}.`);
  }

  if (!entry.testFile || !pathExists(entry.testFile)) {
    failures.push(`${key} manifest test file must exist: ${entry.testFile ?? "<missing>"}.`);
  }

  const auth = entry.auth;
  if (!auth || typeof auth.kind !== "string") {
    failures.push(`${key} manifest must declare an auth kind.`);
    return;
  }

  if (auth.kind === "public") return;

  if (auth.kind === "token") {
    if (!auth.tokenScope || typeof auth.tokenScope !== "string") {
      failures.push(`${key} token route must declare tokenScope.`);
    }
    return;
  }

  if (auth.kind !== "authenticated" && auth.kind !== "basic") {
    failures.push(`${key} manifest has unsupported auth kind ${auth.kind}.`);
    return;
  }

  const guards = authGuardEntries(auth);
  if (guards.length === 0) {
    failures.push(`${key} manifest must declare at least one auth guard.`);
    return;
  }
  for (const guard of guards) validateAuthGuardEntry(key, guard, failures);
}

export function collectRouteAuthorizationManifestFailures({
  manifest = ROUTE_AUTHORIZATION_MANIFEST,
  actualRoutes,
  readText = defaultRead,
  pathExists = defaultExists,
  routeRegistrars = ROUTE_REGISTRARS,
  isPublicRoute,
  publicRouteSamples,
} = {}) {
  const failures = [];
  const knownRegistrars = new Set([
    "serverHealth",
    ...routeRegistrars.map(({ registrar }) => registrar),
  ]);
  const actual = actualRoutes ?? collectApiRouteDeclarations({ readText, routeRegistrars });
  const actualByKey = new Map();
  const manifestByKey = new Map();
  const publicRouteCheck = isPublicRoute ?? defaultIsPublicRoute(readText);
  const helperPublicRouteSamples =
    publicRouteSamples ?? (actualRoutes === undefined ? defaultPublicRouteSamples(readText) : []);

  for (const routeDeclaration of actual) {
    const key = routeAuthorizationKey(routeDeclaration);
    if (actualByKey.has(key)) {
      failures.push(`${key} is registered more than once in API route files.`);
    }
    actualByKey.set(key, routeDeclaration);
  }

  for (const entry of manifest) {
    const key = routeAuthorizationKey(entry);
    if (manifestByKey.has(key)) {
      failures.push(`${key} appears more than once in the route authorization manifest.`);
    }
    manifestByKey.set(key, entry);
    validateAuthEntry(entry, failures, pathExists, knownRegistrars);
  }

  for (const routeDeclaration of actual) {
    const key = routeAuthorizationKey(routeDeclaration);
    if (!manifestByKey.has(key)) {
      failures.push(
        `${key} from ${routeDeclaration.registrar} is missing from route authorization manifest.`,
      );
    }
  }

  for (const entry of manifest) {
    const key = routeAuthorizationKey(entry);
    const routeDeclaration = actualByKey.get(key);
    if (!routeDeclaration) {
      failures.push(`${key} in route authorization manifest is not registered by API route files.`);
      continue;
    }

    if (entry.registrar !== routeDeclaration.registrar) {
      failures.push(
        `${key} manifest registrar ${entry.registrar} does not match registered owner ${routeDeclaration.registrar}.`,
      );
    }

    const authHelperPublic = publicRouteCheck(entry.method, publicRouteSamplePath(entry.path));
    const manifestPublic = manifestAuthUsesGlobalPublic(entry.auth);
    if (authHelperPublic !== manifestPublic) {
      failures.push(
        `${key} public-route mismatch: auth helper says ${authHelperPublic ? "public" : "authenticated"} but manifest says ${manifestPublic ? "public" : "authenticated"}.`,
      );
    }

    if (entry.path.startsWith("/api/portal/")) {
      if (!routeDeclaration.tokenPolicyScope) {
        failures.push(`${key} portal route must use publicTokenPolicyOptions.`);
      }
      if (entry.auth.kind !== "token") {
        failures.push(`${key} portal route must declare token auth.`);
      } else if (
        routeDeclaration.tokenPolicyScope &&
        entry.auth.tokenScope !== routeDeclaration.tokenPolicyScope
      ) {
        failures.push(
          `${key} tokenScope ${entry.auth.tokenScope} does not match publicTokenPolicyOptions ${routeDeclaration.tokenPolicyScope}.`,
        );
      }
    }
  }

  const manifestPublicSamples = new Set(
    manifest
      .filter((entry) => manifestAuthUsesGlobalPublic(entry.auth))
      .map((entry) => `${entry.method} ${publicRouteSamplePath(entry.path)}`),
  );
  for (const sample of helperPublicRouteSamples) {
    if (!publicRouteCheck(sample.method, sample.path)) {
      failures.push(
        `${sample.method} ${sample.path} is listed as a public-route helper sample but isPublicRoute returns false.`,
      );
      continue;
    }
    const sampleKey = `${sample.method} ${sample.path}`;
    if (!manifestPublicSamples.has(sampleKey)) {
      failures.push(`${sampleKey} is public in auth helper samples but missing from manifest.`);
    }
  }

  return failures;
}

export function evaluateBoundaryPolicy({
  root = ROOT,
  readText = (path) => defaultRead(path, root),
  pathExists = (path) => defaultExists(path, root),
  validateRouteAuthorizationManifest = true,
} = {}) {
  const server = readText("apps/api/src/server.ts");
  const routeCatalog = readText("apps/web/routes/routeCatalog.ts");

  return [
    ...collectServerRatchetFailures(server),
    ...collectScaffoldFailures(pathExists),
    ...collectRegistrarFailures(server, pathExists),
    ...collectRegistrarTestFailures(pathExists),
    ...collectUntrackedRegistrarFailures(server),
    ...collectForbiddenRouteFailures(server),
    ...collectRouteCatalogFailures(routeCatalog),
    ...(validateRouteAuthorizationManifest
      ? [
          ...collectRouteAuthorizationManifestFailures({
            readText,
            pathExists,
          }),
        ]
      : []),
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
