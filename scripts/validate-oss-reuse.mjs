import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceFamily = "open-practice";
const referenceIndexPath = resolve(
  process.env.REFERENCE_REPOS_INDEX ?? join(root, "..", "reference-repos", "docs", "index.json"),
);
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
const referenceIndex = JSON.parse(readFileSync(referenceIndexPath, "utf8"));
const sourceReferences = referenceIndex.repos
  .filter((reference) => reference.sourceFamilies?.includes(sourceFamily))
  .sort((left, right) => left.id.localeCompare(right.id));

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

assert(lock.schemaVersion === 2, "OSS reference lockfile must use schemaVersion 2");
assert(lock.sourceFamily === sourceFamily, `OSS reference lockfile must target ${sourceFamily}`);
assert(
  lock.sourceIndex?.schemaVersion === referenceIndex.schemaVersion,
  "OSS reference lockfile must record the source index schema version",
);
assert(
  lock.sourceIndex?.generatedAt === referenceIndex.generatedAt,
  "OSS reference lockfile must record the source index generation timestamp",
);
assert(
  lock.references.length === sourceReferences.length,
  `OSS reference lockfile must include all ${sourceReferences.length} ${sourceFamily} index entries`,
);

const lockById = new Map(lock.references.map((reference) => [reference.id, reference]));

for (const sourceReference of sourceReferences) {
  const reference = lockById.get(sourceReference.id);
  assert(reference, `OSS reference lockfile is missing ${sourceReference.id}`);
  if (!reference) continue;

  assert(reference.id, "Every lock entry needs id");
  assert(
    reference.displayName && reference.url && reference.branch && reference.commit,
    `${reference.id} needs displayName/url/branch/commit`,
  );
  assert(
    reference.url === sourceReference.upstream.url,
    `${reference.id} url must match the central reference index`,
  );
  assert(
    reference.branch === sourceReference.upstream.branch,
    `${reference.id} branch must match the central reference index`,
  );
  assert(
    reference.commit === sourceReference.upstream.commit,
    `${reference.id} commit must match the central reference index`,
  );
  assert(
    reference.license === sourceReference.license,
    `${reference.id} license must match the central reference index`,
  );
  assert(
    reference.licenseRisk === sourceReference.licenseRisk,
    `${reference.id} licenseRisk must match the central reference index`,
  );
  assert(
    reference.reuseClass === sourceReference.reuseClass,
    `${reference.id} reuseClass must match the central reference index`,
  );
  assert(
    Array.isArray(reference.domains),
    `${reference.id} domains must be an array from the central reference index`,
  );
  assert(
    reference.centralPath &&
      !isAbsolute(reference.centralPath) &&
      reference.centralPath.startsWith("../reference-repos/repos/"),
    `${reference.name} centralPath must use the repo-relative default reference store`,
  );
  assert(
    reference.compatibilityPath?.startsWith(".references/oss/"),
    `${reference.id} compatibilityPath must use .references/oss`,
  );
  assert(
    matrix.includes(reference.displayName) || matrix.includes(reference.id),
    `Matrix is missing ${reference.displayName}`,
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
