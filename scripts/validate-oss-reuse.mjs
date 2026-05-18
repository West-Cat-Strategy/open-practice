import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReferenceLock, readJson, referenceIndexPath } from "./reference-governance.mjs";

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
const indexPath = referenceIndexPath();
const expectedLock = buildReferenceLock({
  index: readJson(indexPath),
  root,
  referencesRoot: join(root, "..", "reference-repos", "repos"),
  indexPath,
  includeMetadataOnly: Boolean(lock.referenceIndex?.includeMetadataOnly),
});

assert(gitignore.includes(".references/oss/"), ".references/oss/ must remain ignored");
assert(
  matrix.includes("../reference-repos/repos") && matrix.includes("REFERENCE_REPOS_ROOT"),
  "Matrix must document the default reference repo root and override",
);
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
  "Documenso",
  "j-lawyer.org",
  "ArkCase",
  "paperless-ngx",
  "Papermerge",
  "Mayan EDMS",
  "OpenContracts",
  "Kimai",
  "Apache Fineract",
  "Blnk",
  "Midaz",
  "LedgerSMB",
  "Nextcloud Server",
  "EspoCRM",
  "SuiteCRM",
  "Twenty",
  "Chatwoot",
  "Zulip",
  "Jitsi Meet",
  "Matrix Synapse",
  "Mattermost",
  "Cal.diy",
  "Activepieces",
  "SurveyJS form library",
  "Apache Camel",
  "Temporal",
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
    reference.id && reference.name && reference.url && reference.commit,
    "Every lock entry needs id/name/url/commit",
  );
  assert(
    reference.centralPath &&
      !isAbsolute(reference.centralPath) &&
      reference.centralPath.startsWith("../reference-repos/repos/"),
    `${reference.name} centralPath must use the repo-relative default reference store`,
  );
  assert(
    reference.compatibilityPath?.startsWith(".references/oss/"),
    `${reference.name} compatibilityPath must use .references/oss`,
  );
  assert(
    Array.isArray(reference.compatibilityPaths) &&
      reference.compatibilityPaths.every((compatibilityPath) =>
        compatibilityPath.startsWith(".references/oss/"),
      ),
    `${reference.name} compatibilityPaths must use .references/oss`,
  );
  assert(
    reference.sourceFamilies?.includes("open-practice"),
    `${reference.name} must be indexed for the Open Practice source family`,
  );
  assert(reference.reuseClass, `${reference.name} must record reuseClass`);
  assert(reference.licenseRisk, `${reference.name} must record licenseRisk`);
  assert(reference.curationMode, `${reference.name} must record curationMode`);
  assert(
    reference.centralIndex?.path === indexPath &&
      reference.centralIndex?.sourceFamily === "open-practice",
    `${reference.name} must record the central reference index source`,
  );
}

const expectedById = new Map(expectedLock.references.map((reference) => [reference.id, reference]));
const actualById = new Map(lock.references.map((reference) => [reference.id, reference]));

for (const expected of expectedLock.references) {
  const actual = actualById.get(expected.id);
  assert(actual, `Reference lock is missing central index entry ${expected.id}`);
  if (!actual) continue;
  for (const field of [
    "url",
    "commit",
    "branch",
    "reuseClass",
    "license",
    "licenseRisk",
    "curationMode",
    "centralPath",
  ]) {
    assert(
      actual[field] === expected[field],
      `${expected.id} lock ${field} must match the central reference index`,
    );
  }
  assert(
    JSON.stringify(actual.sourceFamilies) === JSON.stringify(expected.sourceFamilies),
    `${expected.id} sourceFamilies must match the central reference index`,
  );
  assert(
    JSON.stringify(actual.compatibilityPaths) === JSON.stringify(expected.compatibilityPaths),
    `${expected.id} compatibilityPaths must match the central reference index`,
  );
}

for (const actual of lock.references) {
  assert(
    expectedById.has(actual.id),
    `Reference lock contains non-index Open Practice entry ${actual.id}`,
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
    for (const marker of [".references/oss", "reference-repos/repos"]) {
      assert(
        !contents.includes(marker),
        `${path} must not import or read implementation code from ${marker}`,
      );
    }
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
