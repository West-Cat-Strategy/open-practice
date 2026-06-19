#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ARTIFACT_ROOT = ".tmp/open-practice-dependency-review";

export function dependencyReviewTimestamp(now = new Date()) {
  return now
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildDependencyReviewDir({
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  cwd = process.cwd(),
  now = new Date(),
} = {}) {
  return path.resolve(cwd, artifactRoot, dependencyReviewTimestamp(now));
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function readJsonFile(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function runCommand({ args, command, cwd, id, outputDir, spawn = spawnSync }) {
  const startedAt = new Date().toISOString();
  const result = spawn(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  const finishedAt = new Date().toISOString();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const stdoutPath = path.join(outputDir, `${id}.stdout.log`);
  const stderrPath = path.join(outputDir, `${id}.stderr.log`);
  writeFileSync(stdoutPath, stdout);
  writeFileSync(stderrPath, stderr);
  return {
    id,
    command,
    args,
    status: result.status ?? 1,
    signal: result.signal ?? null,
    error: result.error instanceof Error ? result.error.message : null,
    startedAt,
    finishedAt,
    stdoutPath: path.relative(path.dirname(outputDir), stdoutPath),
    stderrPath: path.relative(path.dirname(outputDir), stderrPath),
  };
}

export function dependencyReviewCommands({ licenseJsonPath }) {
  return [
    { id: "pnpm-version", command: "pnpm", args: ["--version"] },
    { id: "outdated", command: "pnpm", args: ["outdated", "-r"] },
    { id: "audit-prod", command: "pnpm", args: ["audit", "--prod"] },
    { id: "audit-dev", command: "pnpm", args: ["audit", "--dev"] },
    {
      id: "license-evidence",
      command: "pnpm",
      args: ["deps:licenses", "--", "--json-output", licenseJsonPath],
    },
  ];
}

export function createDependencyReview({
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  cwd = process.cwd(),
  now = new Date(),
  spawn = spawnSync,
} = {}) {
  const artifactDir = buildDependencyReviewDir({ artifactRoot, cwd, now });
  const commandsDir = path.join(artifactDir, "commands");
  mkdirSync(commandsDir, { recursive: true });

  const packageJsonPath = path.join(cwd, "package.json");
  const lockfilePath = path.join(cwd, "pnpm-lock.yaml");
  const packageJson = readJsonFile(packageJsonPath);
  const lockfile = readFileSync(lockfilePath, "utf8");
  const licenseJsonPath = path.join(artifactDir, "dependency-licenses.json");
  const commands = dependencyReviewCommands({ licenseJsonPath }).map((command) =>
    runCommand({ ...command, cwd, outputDir: commandsDir, spawn }),
  );

  const metadata = {
    generatedAt: now.toISOString(),
    artifactDir,
    scope: "local_dependency_review",
    privacy: "synthetic_metadata_only",
    packageManager: packageJson.packageManager,
    lockfile: {
      path: "pnpm-lock.yaml",
      sha256: sha256Text(lockfile),
    },
    commands,
  };

  writeFileSync(
    path.join(artifactDir, "dependency-review.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  writeFileSync(
    path.join(artifactDir, "README.md"),
    [
      "# Open Practice Dependency Review",
      "",
      `Generated: ${metadata.generatedAt}`,
      "",
      "This local artifact records dependency-maintenance evidence only. Do not add client, matter, credential, payment, privileged document, private deployment, or private audit details here.",
      "",
      "Review `dependency-review.json`, `dependency-licenses.json`, and `commands/*.log` for package-manager, audit, outdated, and license evidence.",
      "",
    ].join("\n"),
  );

  return metadata;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const metadata = createDependencyReview();
    console.log(`Dependency review artifact: ${metadata.artifactDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
