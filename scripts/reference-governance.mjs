import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_REFERENCE_INDEX = "/Users/bryan/projects/reference-repos/docs/index.json";
export const OPEN_PRACTICE_SOURCE_FAMILY = "open-practice";

export function referenceIndexPath(env = process.env) {
  return env.REFERENCE_REPOS_INDEX ?? DEFAULT_REFERENCE_INDEX;
}

export function readJson(pathname) {
  return JSON.parse(readFileSync(pathname, "utf8"));
}

export function referenceReposFromIndex(index) {
  if (Array.isArray(index.repos)) return index.repos;
  if (Array.isArray(index.repositories)) return index.repositories;
  throw new Error("Reference index must contain a repos array.");
}

export function openPracticeReferences(index, { includeMetadataOnly = false } = {}) {
  return referenceReposFromIndex(index)
    .filter((reference) => reference.sourceFamilies?.includes(OPEN_PRACTICE_SOURCE_FAMILY))
    .filter((reference) => includeMetadataOnly || reference.curationMode !== "metadata_only")
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function centralDirectoryName(url) {
  const parsed = new URL(url);
  const [owner, repo] = parsed.pathname.replace(/^\/|\.git$/g, "").split("/");
  return `${owner.toLowerCase()}__${repo.toLowerCase()}`;
}

export function repoRelativePath(root, target) {
  const relative = path.relative(root, target).replaceAll("\\", "/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

export function centralPathForReference(reference, root, referencesRoot) {
  const central =
    reference.paths?.central ??
    path.join(referencesRoot, centralDirectoryName(reference.upstream.url));
  return path.isAbsolute(central) ? central : path.resolve(root, central);
}

function openPracticeAlias(reference) {
  return reference.aliases?.find((alias) => alias.family === OPEN_PRACTICE_SOURCE_FAMILY);
}

export function compatibilityPathsForReference(reference, root) {
  const indexed = (reference.paths?.compatibilityAliases ?? [])
    .filter((aliasPath) => aliasPath.includes("/open-practice/.references/oss/"))
    .map((aliasPath) => repoRelativePath(root, aliasPath).replace(/^\.\//, ""));

  if (indexed.length > 0) return indexed;

  const legacyName = openPracticeAlias(reference)?.legacyName ?? reference.id;
  return [path.posix.join(".references/oss", legacyName)];
}

export function referenceLockEntry({
  reference,
  root,
  referencesRoot,
  indexPath,
  includeMetadataOnly = false,
}) {
  const centralPath = centralPathForReference(reference, root, referencesRoot);
  const compatibilityPaths = compatibilityPathsForReference(reference, root);
  const curationMode = reference.curationMode ?? "clone_on_demand";
  return {
    id: reference.id,
    name: openPracticeAlias(reference)?.legacyName ?? reference.id,
    displayName: reference.displayName,
    url: reference.upstream.url,
    commit: reference.upstream.commit,
    branch: reference.upstream.branch,
    committedAt: reference.upstream.committedAt,
    centralPath: repoRelativePath(root, centralPath).replace(/^\.\//, ""),
    compatibilityPath: compatibilityPaths[0],
    compatibilityPaths,
    sourceFamilies: reference.sourceFamilies ?? [],
    reuseClass: reference.reuseClass,
    license: reference.license,
    licenseRisk: reference.licenseRisk,
    curationMode,
    metadataOnly: curationMode === "metadata_only",
    centralIndex: {
      path: indexPath,
      doc: reference.paths?.doc,
      sourceFamily: OPEN_PRACTICE_SOURCE_FAMILY,
      includeMetadataOnly,
    },
    domains: reference.domains ?? [],
    guardrail: reference.guardrail,
  };
}

export function buildReferenceLock({
  index,
  root,
  referencesRoot,
  indexPath,
  includeMetadataOnly = false,
}) {
  return {
    generatedFrom: "pnpm refs:clone -- --from-index",
    referenceIndex: {
      path: indexPath,
      sourceFamily: OPEN_PRACTICE_SOURCE_FAMILY,
      includeMetadataOnly,
    },
    references: openPracticeReferences(index, { includeMetadataOnly }).map((reference) =>
      referenceLockEntry({ reference, root, referencesRoot, indexPath, includeMetadataOnly }),
    ),
  };
}

export function assertReferenceIndexExists(indexPath) {
  if (!existsSync(indexPath)) {
    throw new Error(`Reference index was not found: ${indexPath}`);
  }
}
