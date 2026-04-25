import { readFileSync, readdirSync, statSync } from "node:fs";
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

const gitignore = read(".gitignore");
const matrix = read("docs/oss-references.md");
const policy = read("docs/reuse-decision-policy.md");
const lock = JSON.parse(read("docs/oss-references.lock.json"));

assert(gitignore.includes(".references/oss/"), ".references/oss/ must remain ignored");
assert(
  /\|\s*Midaz\s*\|\s*Ledger architecture concepts\s*\|\s*Elastic License 2\.0/.test(matrix),
  "Midaz must be documented as Elastic License 2.0",
);
assert(
  matrix.includes("No project should be forked in the next phase."),
  "Matrix must state that no project is approved for forking",
);

for (const required of [
  "docassemble",
  "DocuSeal",
  "j-lawyer.org",
  "ArkCase",
  "paperless-ngx",
  "Kimai",
  "Apache Fineract",
  "Blnk",
  "Midaz",
  "LedgerSMB",
  "Open Collective",
  "CiviCRM",
  "OpenLawOffice",
  "Anika Legal Clerk",
  "LegalEase",
]) {
  assert(matrix.includes(required), `Matrix is missing ${required}`);
}

for (const required of ["Adopt", "Wrap", "Fork", "Reference-Only", "Avoid", "Defer"]) {
  assert(policy.includes(`**${required}**`), `Reuse policy is missing ${required}`);
}

for (const reference of lock.references) {
  assert(
    reference.name && reference.url && reference.commit,
    "Every lock entry needs name/url/commit",
  );
}

function scanSourceTree(directory) {
  for (const entry of readdirSync(join(root, directory))) {
    const path = join(directory, entry);
    const absolutePath = join(root, path);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      if (["node_modules", "dist", ".next", ".turbo"].includes(entry)) continue;
      scanSourceTree(path);
      continue;
    }
    const contents = read(path);
    assert(
      !contents.includes(".references/oss"),
      `${path} must not import or read implementation code from .references/oss`,
    );
  }
}

for (const directory of ["apps", "packages"]) {
  scanSourceTree(directory);
}

if (failures.length > 0) {
  console.error("OSS reuse policy validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("OSS reuse policy validation passed.");
