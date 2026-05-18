#!/usr/bin/env node

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
import { spawnSync } from "node:child_process";
import path, { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertReferenceIndexExists,
  buildReferenceLock,
  centralPathForReference,
  openPracticeReferences,
  readJson,
  referenceIndexPath,
} from "./reference-governance.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const compatibilityRoot = join(root, ".references", "oss");
const referencesRoot = resolve(
  process.env.REFERENCE_REPOS_ROOT ?? join(root, "..", "reference-repos", "repos"),
);
const lockPath = join(root, "docs", "oss-references.lock.json");

function parseArgs(rawArgs = process.argv.slice(2)) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  const options = {
    check: false,
    dryRun: false,
    includeMetadataOnly: false,
  };

  for (const arg of args) {
    if (arg === "--check") {
      options.check = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--include-metadata-only") {
      options.includeMetadataOnly = true;
      continue;
    }
    if (arg === "--from-index") continue;
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function lstatIfExists(pathname) {
  try {
    return lstatSync(pathname);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function ensureCompatibilityLink(directory, target, { dryRun }) {
  const link = join(root, directory);
  const stat = lstatIfExists(link);
  if (stat) {
    if (stat.isSymbolicLink()) {
      const currentTarget = resolve(dirname(link), readlinkSync(link));
      if (currentTarget === target) return;
      if (dryRun) {
        console.log(`Would replace compatibility link ${directory} -> ${target}`);
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

  if (dryRun) {
    console.log(`Would link ${directory} -> ${target}`);
    return;
  }
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(target, link, "dir");
}

function runGit(args, { cwd }) {
  const result = spawnSync("git", args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed with status ${result.status ?? 1}`);
  }
}

function readCommit(target) {
  const result = spawnSync("git", ["-C", target, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Unable to read commit for ${target}`);
  }
  return result.stdout.trim();
}

function refreshClone(reference, target, { dryRun }) {
  if (reference.curationMode === "metadata_only") {
    console.log(`Metadata-only reference ${reference.id}; skipping clone refresh`);
    return;
  }

  if (existsSync(join(target, ".git"))) {
    if (dryRun) {
      console.log(`Would refresh ${target} to ${reference.upstream.commit}`);
      return;
    }
    console.log(`Refreshing ${target} to ${reference.upstream.commit}`);
    runGit(["-C", target, "fetch", "--depth", "1", "origin", reference.upstream.commit], {
      cwd: root,
    });
    runGit(["-C", target, "reset", "--hard", reference.upstream.commit], { cwd: root });
    return;
  }

  if (dryRun) {
    console.log(
      `Would clone ${reference.upstream.url} -> ${target} at ${reference.upstream.commit}`,
    );
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  console.log(`Cloning ${reference.upstream.url} -> ${target} at ${reference.upstream.commit}`);
  runGit(["clone", "--filter=blob:none", "--no-checkout", reference.upstream.url, target], {
    cwd: root,
  });
  runGit(["-C", target, "fetch", "--depth", "1", "origin", reference.upstream.commit], {
    cwd: root,
  });
  runGit(["-C", target, "reset", "--hard", reference.upstream.commit], { cwd: root });
}

function compareLock(expected) {
  const current = JSON.parse(readFileSync(lockPath, "utf8"));
  const expectedText = `${JSON.stringify(expected, null, 2)}\n`;
  const currentText = `${JSON.stringify(current, null, 2)}\n`;
  return currentText === expectedText;
}

export function runCloneReferences(rawArgs = process.argv.slice(2), env = process.env) {
  const options = parseArgs(rawArgs);
  const indexPath = referenceIndexPath(env);
  assertReferenceIndexExists(indexPath);
  const index = readJson(indexPath);
  const references = openPracticeReferences(index, options);
  const lock = buildReferenceLock({
    index,
    root,
    referencesRoot,
    indexPath,
    includeMetadataOnly: options.includeMetadataOnly,
  });

  if (options.check) {
    if (!compareLock(lock)) {
      console.error(
        "docs/oss-references.lock.json is out of sync with the central reference index.",
      );
      console.error(`Refresh with: REFERENCE_REPOS_INDEX=${indexPath} pnpm refs:clone`);
      process.exit(1);
    }
    console.log(`Reference lock matches ${references.length} Open Practice index entries.`);
    return lock;
  }

  mkdirSync(referencesRoot, { recursive: true });
  mkdirSync(compatibilityRoot, { recursive: true });

  for (const reference of references) {
    const target = centralPathForReference(reference, root, referencesRoot);
    refreshClone(reference, target, options);
    const lockEntry = lock.references.find((entry) => entry.id === reference.id);
    for (const compatibilityPath of lockEntry?.compatibilityPaths ?? []) {
      ensureCompatibilityLink(compatibilityPath, target, options);
    }
    if (!options.dryRun && reference.curationMode !== "metadata_only") {
      const actualCommit = readCommit(target);
      if (actualCommit !== reference.upstream.commit) {
        console.warn(
          `${reference.id} refreshed to ${actualCommit}; central index records ${reference.upstream.commit}`,
        );
      }
    }
  }

  if (options.dryRun) {
    console.log(`Would write ${lockPath} with ${lock.references.length} Open Practice references.`);
    return lock;
  }

  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`Wrote ${lockPath} with ${lock.references.length} Open Practice references.`);
  return lock;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runCloneReferences();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
