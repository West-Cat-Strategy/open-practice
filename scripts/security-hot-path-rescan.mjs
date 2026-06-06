#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { selectCommands } from "./select-validation.mjs";

export const SOURCE_REPORT_PATH =
  "/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/report.md";

export const HOT_PATHS = Object.freeze([
  "apps/api/src/routes/inbound-email.ts",
  "apps/api/src/routes/calendar.ts",
  "packages/database/src/repository/drizzle.ts",
]);

const DEFAULT_ARTIFACT_ROOT = path.join(".tmp", "security-hot-path-rescan");

const COMMAND_ID_BY_RECOMMENDED_COMMAND = new Map([
  ["pnpm policy:check", "selector-policy-check"],
  ["pnpm --filter @open-practice/database test", "selector-database-test"],
  ["pnpm --filter @open-practice/database db:check", "selector-database-db-check"],
  ["pnpm migrations:check", "selector-migrations-check"],
  ["pnpm --filter @open-practice/database typecheck", "selector-database-typecheck"],
  ["pnpm --filter @open-practice/api test", "selector-api-test"],
  ["pnpm --filter @open-practice/api typecheck", "selector-api-typecheck"],
]);

export function usage() {
  return [
    "Usage:",
    "  node scripts/security-hot-path-rescan.mjs [--dry-run] [--artifact-root <path>]",
  ].join("\n");
}

export function parseArgs(rawArgs = []) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let dryRun = false;
  let artifactRoot = DEFAULT_ARTIFACT_ROOT;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      return { help: true, dryRun, artifactRoot };
    }

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

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help: false, dryRun, artifactRoot };
}

export function rescanTimestamp(now = new Date()) {
  return now
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildArtifactDir({
  cwd = process.cwd(),
  now = new Date(),
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
} = {}) {
  return path.resolve(cwd, artifactRoot, rescanTimestamp(now));
}

function commandToId(command) {
  return (
    COMMAND_ID_BY_RECOMMENDED_COMMAND.get(command) ??
    `selector-${command
      .replaceAll("@", "")
      .replaceAll("/", "-")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()}`
  );
}

function commandFromString(command) {
  const [program, ...args] = command.split(/\s+/).filter(Boolean);
  return { command: program, args };
}

export function hotPathSelectorCommand() {
  return {
    id: "hot-path-selector",
    command: "pnpm",
    args: ["verify:select", "--", "--files", ...HOT_PATHS],
    required: true,
  };
}

export function scopedSecretScanCommand() {
  return {
    id: "scoped-secret-scan",
    command: "pnpm",
    args: ["security:scan", "--", ...HOT_PATHS.flatMap((hotPath) => ["--path", hotPath])],
    required: true,
  };
}

export function focusedRegressionCommands() {
  return [
    {
      id: "api-hot-path-regressions",
      command: "pnpm",
      args: [
        "--filter",
        "@open-practice/api",
        "exec",
        "vitest",
        "run",
        "src/routes/inbound-email.test.ts",
        "src/routes/calendar.test.ts",
        "--pool",
        "forks",
        "--fileParallelism=false",
      ],
      required: true,
    },
    {
      id: "database-hot-path-regressions",
      command: "pnpm",
      args: [
        "--filter",
        "@open-practice/database",
        "exec",
        "vitest",
        "run",
        "test/repository.test.ts",
        "test/repository.inbound-email.test.ts",
        "--pool",
        "forks",
        "--fileParallelism=false",
      ],
      required: true,
    },
  ];
}

export function selectorGateCommands() {
  return selectCommands(HOT_PATHS).map((recommendedCommand) => ({
    id: commandToId(recommendedCommand),
    ...commandFromString(recommendedCommand),
    required: true,
  }));
}

export function securityHotPathRescanCommands() {
  return [
    hotPathSelectorCommand(),
    scopedSecretScanCommand(),
    ...focusedRegressionCommands(),
    ...selectorGateCommands(),
  ];
}

function formatCommand(command) {
  return [command.command, ...command.args].join(" ");
}

function writeScopeNote({ artifactDir, generatedAt, dryRun }) {
  const scopeNotePath = path.join(artifactDir, "codex-security-scoped-rescan.md");
  const sourceReportExists = existsSync(SOURCE_REPORT_PATH);
  const content = [
    "# Codex Security Scoped Rescan Prompt",
    "",
    `Generated at: ${generatedAt}`,
    `Dry run: ${dryRun ? "yes" : "no"}`,
    `Source report: ${SOURCE_REPORT_PATH}`,
    `Source report present: ${sourceReportExists ? "yes" : "no"}`,
    "",
    "Use this as the scoped-path rescan prompt for future Codex Security follow-up after edits to inbound email redaction, public guest-session token logging, audit append semantics, or document checksum/advisory-lock code.",
    "",
    "## Scope",
    "",
    ...HOT_PATHS.map((hotPath) => `- ${hotPath}`),
    "",
    "## Review Focus",
    "",
    "- Inbound email responses must not expose staff triage private-note text or raw MIME/storage material.",
    "- Public guest-session token probes must keep generic responses and redacted `calendar_guest_link` audit metadata.",
    "- Drizzle audit append code must recompute sequence and hash-chain fields instead of trusting caller-supplied values.",
    "- Direct upload completion and inbound attachment promotion must keep same-matter checksum duplicate checks inside advisory-locked transactions.",
    "",
    "## Local Evidence Command",
    "",
    "```bash",
    "node scripts/security-hot-path-rescan.mjs",
    "```",
    "",
  ].join("\n");

  writeFileSync(scopeNotePath, content);
  return scopeNotePath;
}

function runCommand(command, { cwd, outputDir, spawn = spawnSync }) {
  const startedAt = new Date().toISOString();
  const result = spawn(command.command, command.args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
  });
  const finishedAt = new Date().toISOString();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const stdoutPath = path.join(outputDir, `${command.id}.stdout.log`);
  const stderrPath = path.join(outputDir, `${command.id}.stderr.log`);

  writeFileSync(stdoutPath, stdout);
  writeFileSync(stderrPath, stderr);

  return {
    ...command,
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

function dryRunCommand(command, { outputDir }) {
  const now = new Date().toISOString();
  const stdoutPath = path.join(outputDir, `${command.id}.stdout.log`);
  const stderrPath = path.join(outputDir, `${command.id}.stderr.log`);

  writeFileSync(stdoutPath, `Dry run: ${formatCommand(command)}\n`);
  writeFileSync(stderrPath, "");

  return {
    ...command,
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

export function createSecurityHotPathRescan({
  cwd = process.cwd(),
  now = new Date(),
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  dryRun = false,
  spawn = spawnSync,
} = {}) {
  const artifactDir = buildArtifactDir({ cwd, now, artifactRoot });
  const commandsDir = path.join(artifactDir, "commands");
  mkdirSync(commandsDir, { recursive: true });

  const generatedAt = now.toISOString();
  const scopeNotePath = writeScopeNote({ artifactDir, generatedAt, dryRun });
  const commands = securityHotPathRescanCommands().map((command) =>
    dryRun
      ? dryRunCommand(command, { outputDir: commandsDir })
      : runCommand(command, { cwd, outputDir: commandsDir, spawn }),
  );
  const failedRequired = commands.filter((command) => command.required && command.status !== 0);
  const proof = {
    generatedAt,
    status: dryRun ? "dry-run" : failedRequired.length > 0 ? "failed" : "passed",
    dryRun,
    artifactDir,
    sourceReportPath: SOURCE_REPORT_PATH,
    sourceReportExists: existsSync(SOURCE_REPORT_PATH),
    hotPaths: HOT_PATHS,
    scopeNotePath: path.relative(artifactDir, scopeNotePath),
    failedRequiredCommandIds: failedRequired.map((command) => command.id),
    commands,
  };

  writeFileSync(path.join(artifactDir, "rescan-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
  return proof;
}

export function runCli(rawArgs = process.argv.slice(2)) {
  const options = parseArgs(rawArgs);

  if (options.help) {
    console.log(usage());
    return 0;
  }

  const proof = createSecurityHotPathRescan(options);
  console.log(`Security hot-path rescan proof: ${proof.artifactDir}`);
  console.log(`Status: ${proof.status}`);

  if (proof.failedRequiredCommandIds.length > 0) {
    console.error(`Failed required commands: ${proof.failedRequiredCommandIds.join(", ")}`);
    return 1;
  }

  return 0;
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  }
}
