#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runSelector } from "./select-validation.mjs";

const DEFAULT_ARTIFACT_ROOT = ".tmp/validation-runs";

export function validationRunTimestamp(now = new Date()) {
  return now
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

export function commandId(command, index) {
  return `${String(index + 1).padStart(2, "0")}-${command
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)}`;
}

export function parseArgs(rawArgs = process.argv.slice(2)) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  const selectorArgs = [];
  let artifactRoot = DEFAULT_ARTIFACT_ROOT;
  let dryRun = false;
  let selectorMode = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (selectorMode) {
      selectorArgs.push(arg);
      continue;
    }
    if (arg === "--help" || arg === "-h") return { help: true, artifactRoot, dryRun, selectorArgs };
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--artifact-root") {
      const value = args[index + 1];
      index += 1;
      if (!value || value.startsWith("--")) {
        throw new Error("--artifact-root requires a path.");
      }
      artifactRoot = value;
      continue;
    }
    if (arg === "--") {
      selectorMode = true;
      continue;
    }
    selectorArgs.push(arg);
  }

  return { help: false, artifactRoot, dryRun, selectorArgs };
}

export function usage() {
  return [
    "Usage:",
    "  node scripts/run-selected-validation.mjs [--dry-run] [--artifact-root <path>] -- --files <paths...>",
    "  node scripts/run-selected-validation.mjs [--dry-run] [--artifact-root <path>] -- --base <git-ref>",
    "  node scripts/run-selected-validation.mjs [--dry-run] [--artifact-root <path>] -- --dirty",
  ].join("\n");
}

function runCommand(command, { cwd, outputDir, index, spawn = spawnSync }) {
  const id = commandId(command, index);
  const startedAt = new Date().toISOString();
  const result = spawn(command, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
    shell: true,
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
    status: result.status ?? 1,
    signal: result.signal ?? null,
    error: result.error instanceof Error ? result.error.message : null,
    startedAt,
    finishedAt,
    stdoutPath: path.relative(path.dirname(outputDir), stdoutPath),
    stderrPath: path.relative(path.dirname(outputDir), stderrPath),
    skipped: false,
  };
}

function dryRunCommand(command, { outputDir, index }) {
  const id = commandId(command, index);
  const now = new Date().toISOString();
  const stdoutPath = path.join(outputDir, `${id}.stdout.log`);
  const stderrPath = path.join(outputDir, `${id}.stderr.log`);
  writeFileSync(stdoutPath, `Dry run: ${command}\n`);
  writeFileSync(stderrPath, "");
  return {
    id,
    command,
    status: 0,
    signal: null,
    error: null,
    startedAt: now,
    finishedAt: now,
    stdoutPath: path.relative(path.dirname(outputDir), stdoutPath),
    stderrPath: path.relative(path.dirname(outputDir), stderrPath),
    skipped: true,
  };
}

export function runValidationCommands({
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  commands,
  cwd = process.cwd(),
  dryRun = false,
  now = new Date(),
  selectorArgs,
  spawn = spawnSync,
} = {}) {
  const artifactDir = path.resolve(cwd, artifactRoot, validationRunTimestamp(now));
  const commandsDir = path.join(artifactDir, "commands");
  mkdirSync(commandsDir, { recursive: true });

  const commandResults = commands.map((command, index) =>
    dryRun
      ? dryRunCommand(command, { outputDir: commandsDir, index })
      : runCommand(command, { cwd, outputDir: commandsDir, index, spawn }),
  );
  const failed = commandResults.filter((command) => command.status !== 0);
  const metadata = {
    generatedAt: now.toISOString(),
    artifactDir,
    scope: "selected_validation_run",
    privacy: "synthetic_metadata_only",
    status: dryRun ? "dry-run" : failed.length > 0 ? "failed" : "passed",
    dryRun,
    selectorArgs,
    selectedCommands: commands,
    failedCommandIds: failed.map((command) => command.id),
    commands: commandResults,
  };

  writeFileSync(
    path.join(artifactDir, "validation-run.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  writeFileSync(
    path.join(artifactDir, "README.md"),
    [
      "# Open Practice Selected Validation Run",
      "",
      `Generated: ${metadata.generatedAt}`,
      `Status: ${metadata.status}`,
      "",
      "This local artifact records command status and logs for selector-chosen validation. Do not add client, matter, credential, payment, privileged document, private deployment, or private audit details.",
      "",
      "Review `validation-run.json` and `commands/*.log` for local evidence.",
      "",
    ].join("\n"),
  );

  return metadata;
}

export function runCli(rawArgs = process.argv.slice(2)) {
  const options = parseArgs(rawArgs);
  if (options.help) {
    console.log(usage());
    return 0;
  }
  if (options.selectorArgs.length === 0) {
    throw new Error("Missing selector arguments.");
  }

  const commands = runSelector(options.selectorArgs);
  const metadata = runValidationCommands({ ...options, commands });
  console.log(`Selected validation ${metadata.status}: ${metadata.artifactDir}`);
  if (metadata.failedCommandIds.length > 0) {
    console.error(`Failed commands: ${metadata.failedCommandIds.join(", ")}`);
    return 1;
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  }
}
