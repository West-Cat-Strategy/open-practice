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

const server = read("apps/api/src/server.ts");
const routeCount = [...server.matchAll(/\bserver\.(get|post|put|patch|delete)\s*\(/g)].length;
const inlineRequestParses = [...server.matchAll(/\.parse\(request\.(body|query|params)\)/g)].length;
const directErrorEnvelopes = [...server.matchAll(/reply\.status\([^)]*\)\.send\(\s*\{\s*error:/gs)]
  .length;

assert(
  routeCount <= 12,
  `apps/api/src/server.ts defines ${routeCount} direct routes; current ratchet allows 12. Move new routes into module-owned registrars.`,
);
assert(
  inlineRequestParses <= 4,
  `apps/api/src/server.ts contains ${inlineRequestParses} inline request parses; current ratchet allows 4. Use shared validation helpers for new code.`,
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
  "apps/api/src/routes/intake.ts",
  "apps/api/src/routes/ledger.ts",
  "apps/api/src/routes/queues.ts",
  "apps/api/src/routes/signatures.ts",
  "apps/api/src/routes/types.ts",
  "apps/web/routes/routeCatalog.ts",
  "docs/README.md",
  "docs/testing/TESTING.md",
  "docs/development/getting-started.md",
  "scripts/select-validation.mjs",
]) {
  assert(existsSync(join(root, required)), `${required} must exist as the adoption scaffold.`);
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
