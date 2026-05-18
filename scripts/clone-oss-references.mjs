import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const compatibilityRoot = join(root, ".references", "oss");
const referencesRoot = resolve(
  process.env.REFERENCE_REPOS_ROOT ?? join(root, "..", "reference-repos", "repos"),
);
const sourceFamily = "open-practice";
const lockOnly = process.argv.includes("--lock-only");
const referenceIndexPath = resolve(
  process.env.REFERENCE_REPOS_INDEX ?? join(root, "..", "reference-repos", "docs", "index.json"),
);

function loadReferenceIndex() {
  const index = JSON.parse(readFileSync(referenceIndexPath, "utf8"));
  const repos = Array.isArray(index.repos) ? index.repos : [];
  const references = repos
    .filter((repo) => repo.sourceFamilies?.includes(sourceFamily))
    .filter((repo) => repo.upstream?.url && repo.upstream?.commit)
    .sort((left, right) => left.id.localeCompare(right.id));

  if (references.length === 0) {
    throw new Error(`No ${sourceFamily} entries found in ${referenceIndexPath}`);
  }

  return { index, references };
}

function centralDirectoryName(url) {
  const parsed = new URL(url);
  const [owner, repo] = parsed.pathname.replace(/^\/|\.git$/g, "").split("/");
  return `${owner.toLowerCase()}__${repo.toLowerCase()}`;
}

function openPracticeAlias(reference) {
  return reference.aliases?.find((alias) => alias.family === sourceFamily)?.compatibilityPath;
}

function compatibilityPath(reference) {
  const alias = openPracticeAlias(reference);
  if (alias) return `.references/oss/${alias.split("/").at(-1)}`;
  return `.references/oss/${reference.id}`;
}

function lstatIfExists(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function ensureCompatibilityLink(directory, target) {
  const link = join(compatibilityRoot, directory);
  const stat = lstatIfExists(link);
  if (stat) {
    if (stat.isSymbolicLink()) {
      const currentTarget = resolve(dirname(link), readlinkSync(link));
      if (currentTarget === target) {
        return;
      }
      rmSync(link);
    } else if (existsSync(join(link, ".git"))) {
      console.warn(`${link} is a local clone; leaving it in place instead of replacing it`);
      return;
    } else {
      throw new Error(`${link} exists but is not a reference repo or symlink`);
    }
  }

  symlinkSync(target, link, "dir");
}

function relativeCentralPath(url) {
  return `../reference-repos/repos/${centralDirectoryName(url)}`;
}

function runGit(args) {
  const result = spawnSync("git", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed with status ${result.status ?? 1}`);
  }
}

function cloneOrRefresh(reference, target) {
  if (existsSync(join(target, ".git"))) {
    console.log(`Refreshing ${target}`);
    runGit(["-C", target, "fetch", "--depth", "1", "origin", reference.upstream.branch]);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    console.log(`Cloning ${reference.upstream.url} -> ${target}`);
    runGit([
      "clone",
      "--depth",
      "1",
      "--filter=blob:none",
      "--branch",
      reference.upstream.branch,
      reference.upstream.url,
      target,
    ]);
  }

  runGit(["-C", target, "reset", "--hard", reference.upstream.commit]);
}

function lockEntry(reference) {
  return {
    id: reference.id,
    displayName: reference.displayName,
    url: reference.upstream.url,
    branch: reference.upstream.branch,
    commit: reference.upstream.commit,
    shortCommit: reference.upstream.shortCommit,
    committedAt: reference.upstream.committedAt,
    license: reference.license,
    licenseRisk: reference.licenseRisk,
    reuseClass: reference.reuseClass,
    domains: reference.domains ?? [],
    guardrail: reference.guardrail,
    centralPath: relativeCentralPath(reference.upstream.url),
    compatibilityPath: compatibilityPath(reference),
    sourceIndexDoc: reference.paths?.doc,
  };
}

mkdirSync(referencesRoot, { recursive: true });
mkdirSync(compatibilityRoot, { recursive: true });

const lockEntries = [];
const { index, references } = loadReferenceIndex();

for (const reference of references) {
  const target = join(referencesRoot, centralDirectoryName(reference.upstream.url));
  if (!lockOnly) {
    cloneOrRefresh(reference, target);
    ensureCompatibilityLink(compatibilityPath(reference).split("/").at(-1), target);
  }
  lockEntries.push(lockEntry(reference));
}

if (!process.exitCode) {
  writeFileSync(
    join(root, "docs", "oss-references.lock.json"),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        generatedAt: index.generatedAt,
        generatedFrom: "pnpm refs:clone",
        sourceFamily,
        sourceIndex: {
          path: referenceIndexPath,
          schemaVersion: index.schemaVersion,
          generatedAt: index.generatedAt,
          roots: index.roots,
        },
        references: lockEntries,
      },
      null,
      2,
    )}\n`,
  );
}
