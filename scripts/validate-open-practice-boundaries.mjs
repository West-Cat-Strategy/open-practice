import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function serverContainsRouteLiteral(routeLiteral) {
  return (
    server.includes(`"${routeLiteral}`) ||
    server.includes(`'${routeLiteral}`) ||
    server.includes(`\`${routeLiteral}`)
  );
}

const server = read("apps/api/src/server.ts");
const routeCount = [...server.matchAll(/\bserver\.(get|post|put|patch|delete|route)\s*\(/g)].length;
const inlineRequestParses = [...server.matchAll(/\.parse\(request\.(body|query|params)\)/g)].length;
const directErrorEnvelopes = [...server.matchAll(/reply\.status\([^)]*\)\.send\(\s*\{\s*error:/gs)]
  .length;

assert(
  routeCount <= 1,
  `apps/api/src/server.ts defines ${routeCount} direct routes; current ratchet allows 1. Move new routes into module-owned registrars.`,
);
assert(
  inlineRequestParses <= 0,
  `apps/api/src/server.ts contains ${inlineRequestParses} inline request parses; current ratchet allows 0. Use shared validation helpers for new code.`,
);
assert(
  directErrorEnvelopes <= 1,
  `apps/api/src/server.ts contains ${directErrorEnvelopes} direct error envelopes; current ratchet allows 1. Use shared response helpers for new code.`,
);

for (const required of [
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
]) {
  assert(existsSync(join(root, required)), `${required} must exist as the adoption scaffold.`);
}

for (const routeRegistrar of [
  {
    family: "setup",
    file: "apps/api/src/routes/setup.ts",
    importPath: "./routes/setup.js",
    registrar: "registerSetupRoutes",
  },
  {
    family: "WebAuthn",
    file: "apps/api/src/routes/webauthn.ts",
    importPath: "./routes/webauthn.js",
    registrar: "registerWebAuthnRoutes",
  },
  {
    family: "recovery",
    file: "apps/api/src/routes/recovery.ts",
    importPath: "./routes/recovery.js",
    registrar: "registerRecoveryRoutes",
  },
  {
    family: "contacts",
    file: "apps/api/src/routes/contacts.ts",
    importPath: "./routes/contacts.js",
    registrar: "registerContactRoutes",
  },
  {
    family: "connectors",
    file: "apps/api/src/routes/connectors.ts",
    importPath: "./routes/connectors.js",
    registrar: "registerConnectorRoutes",
  },
  {
    family: "conversation threads",
    file: "apps/api/src/routes/conversation-threads.ts",
    importPath: "./routes/conversation-threads.js",
    registrar: "registerConversationThreadRoutes",
  },
  {
    family: "legal clinics",
    file: "apps/api/src/routes/legal-clinics.ts",
    importPath: "./routes/legal-clinics.js",
    registrar: "registerLegalClinicRoutes",
  },
  {
    family: "CalDAV",
    file: "apps/api/src/routes/caldav.ts",
    importPath: "./routes/caldav.js",
    registrar: "registerCalDavRoutes",
  },
  {
    family: "calendar",
    file: "apps/api/src/routes/calendar.ts",
    importPath: "./routes/calendar.js",
    registrar: "registerCalendarRoutes",
  },
  {
    family: "document processing",
    file: "apps/api/src/routes/document-processing.ts",
    importPath: "./routes/document-processing.js",
    registrar: "registerDocumentProcessingRoutes",
  },
  {
    family: "draft assist",
    file: "apps/api/src/routes/draft-assist.ts",
    importPath: "./routes/draft-assist.js",
    registrar: "registerDraftAssistRoutes",
  },
  {
    family: "jobs",
    file: "apps/api/src/routes/jobs.ts",
    importPath: "./routes/jobs.js",
    registrar: "registerJobsRoutes",
  },
  {
    family: "email",
    file: "apps/api/src/routes/email.ts",
    importPath: "./routes/email.js",
    registrar: "registerEmailRoutes",
  },
  {
    family: "inbound email",
    file: "apps/api/src/routes/inbound-email.ts",
    importPath: "./routes/inbound-email.js",
    registrar: "registerInboundEmailRoutes",
  },
  {
    family: "shares",
    file: "apps/api/src/routes/shares.ts",
    importPath: "./routes/shares.js",
    registrar: "registerShareRoutes",
  },
  {
    family: "external uploads",
    file: "apps/api/src/routes/external-uploads.ts",
    importPath: "./routes/external-uploads.js",
    registrar: "registerExternalUploadRoutes",
  },
  {
    family: "auth extensions",
    file: "apps/api/src/routes/auth-extensions.ts",
    importPath: "./routes/auth-extensions.js",
    registrar: "registerAuthExtensionRoutes",
  },
  {
    family: "intake forms",
    file: "apps/api/src/routes/intake-forms.ts",
    importPath: "./routes/intake-forms.js",
    registrar: "registerIntakeFormRoutes",
  },
  {
    family: "operational views",
    file: "apps/api/src/routes/operational-views.ts",
    importPath: "./routes/operational-views.js",
    registrar: "registerOperationalViewRoutes",
  },
  {
    family: "outbound webhooks",
    file: "apps/api/src/routes/outbound-webhooks.ts",
    importPath: "./routes/outbound-webhooks.js",
    registrar: "registerOutboundWebhookRoutes",
  },
  {
    family: "tasks",
    file: "apps/api/src/routes/tasks.ts",
    importPath: "./routes/tasks.js",
    registrar: "registerTaskRoutes",
  },
]) {
  assert(
    existsSync(join(root, routeRegistrar.file)),
    `${routeRegistrar.file} must exist for the ${routeRegistrar.family} route family.`,
  );
  assert(
    server.includes(`import { ${routeRegistrar.registrar} } from "${routeRegistrar.importPath}";`),
    `apps/api/src/server.ts must import ${routeRegistrar.registrar} from ${routeRegistrar.importPath}.`,
  );
  assert(
    server.includes(`${routeRegistrar.registrar}(server`),
    `apps/api/src/server.ts must wire ${routeRegistrar.registrar}.`,
  );
}

for (const billingRoute of [
  "/api/time-entries",
  "/api/expense-entries",
  "/api/invoices",
  "/api/payments",
  "/api/billing/trust-transfer-requests",
  "/api/billing/dashboard",
]) {
  assert(
    !server.includes(billingRoute),
    `apps/api/src/server.ts still contains billing route literal ${billingRoute}; keep billing endpoints in apps/api/src/routes/billing.ts.`,
  );
}

for (const documentRoute of [
  "/api/documents/presign-upload",
  "/api/documents/:id/upload-complete",
  "/api/documents/:id/scan-status",
]) {
  assert(
    !server.includes(documentRoute),
    `apps/api/src/server.ts still contains document route literal ${documentRoute}; keep document endpoints in apps/api/src/routes/documents.ts.`,
  );
}

for (const signatureRoute of [
  "/api/signature-requests",
  "/api/signature-requests/provider-events",
  "/api/signature-requests/:id/embedded-events",
  "/api/signature-requests/:id/events",
]) {
  assert(
    !server.includes(signatureRoute),
    `apps/api/src/server.ts still contains signature route literal ${signatureRoute}; keep signature endpoints in apps/api/src/routes/signatures.ts.`,
  );
}

for (const intakeRoute of [
  "/api/intake-sessions",
  "/api/intake-sessions/:id/answer-snapshots",
  "/api/intake-sessions/:id/generated-documents",
]) {
  assert(
    !server.includes(intakeRoute),
    `apps/api/src/server.ts still contains intake route literal ${intakeRoute}; keep intake endpoints in apps/api/src/routes/intake.ts.`,
  );
}

for (const ledgerRoute of [
  "/api/ledger",
  "/api/ledger/transactions",
  "/api/ledger/transactions/:id/approvals",
  "/api/ledger/reconciliations",
]) {
  assert(
    !server.includes(ledgerRoute),
    `apps/api/src/server.ts still contains ledger route literal ${ledgerRoute}; keep ledger endpoints in apps/api/src/routes/ledger.ts.`,
  );
}

assert(
  !server.includes("/api/queues"),
  "apps/api/src/server.ts still contains queue route literal /api/queues; keep queue endpoints in apps/api/src/routes/queues.ts.",
);

for (const authRoute of [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/auth/password-setup-tokens",
  "/api/auth/password-setup",
]) {
  assert(
    !server.includes(authRoute),
    `apps/api/src/server.ts still contains auth route literal ${authRoute}; keep auth endpoints in apps/api/src/routes/auth.ts.`,
  );
}

for (const sessionRoute of ["/api/session", "/api/capabilities"]) {
  assert(
    !server.includes(sessionRoute),
    `apps/api/src/server.ts still contains session route literal ${sessionRoute}; keep session endpoints in apps/api/src/routes/session.ts.`,
  );
}

for (const matterRoute of ["/api/overview", "/api/matters", "/api/conflicts/check"]) {
  assert(
    !server.includes(matterRoute),
    `apps/api/src/server.ts still contains matter route literal ${matterRoute}; keep matter endpoints in apps/api/src/routes/matters.ts.`,
  );
}

assert(
  !server.includes("/api/audit"),
  "apps/api/src/server.ts still contains audit route literal /api/audit; keep audit endpoints in apps/api/src/routes/audit.ts.",
);

for (const draftRoute of ["/api/drafts", "/api/drafts/:id", "/api/draft-templates"]) {
  assert(
    !server.includes(draftRoute),
    `apps/api/src/server.ts still contains draft route literal ${draftRoute}; keep draft endpoints in apps/api/src/routes/drafts.ts.`,
  );
}

for (const { family, routeLiterals } of [
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
]) {
  for (const routeLiteral of routeLiterals) {
    assert(
      !serverContainsRouteLiteral(routeLiteral),
      `apps/api/src/server.ts still contains ${family} route literal ${routeLiteral}; keep ${family} endpoints in their module-owned route registrar.`,
    );
  }
}

const routeCatalog = read("apps/web/routes/routeCatalog.ts");
for (const routeId of [
  "matters",
  "billing",
  "documents",
  "signatures",
  "intake",
  "funds",
  "audit",
  "queues",
]) {
  assert(routeCatalog.includes(`id: "${routeId}"`), `route catalog is missing ${routeId}.`);
}

if (failures.length > 0) {
  console.error("Open Practice boundary policy failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Open Practice boundary policy passed.");
