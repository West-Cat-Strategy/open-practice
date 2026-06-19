#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ARTIFACT_ROOT = ".tmp/open-practice-security-review";

export function securityReviewTimestamp(now = new Date()) {
  return now
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildSecurityReviewDir({
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  cwd = process.cwd(),
  now = new Date(),
} = {}) {
  return path.resolve(cwd, artifactRoot, securityReviewTimestamp(now));
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function readJsonFile(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function gitMetadata(cwd, spawn = spawnSync) {
  const read = (args) => {
    const result = spawn("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    return result.status === 0 ? result.stdout.trim() : null;
  };

  return {
    head: read(["rev-parse", "HEAD"]),
    branch: read(["branch", "--show-current"]),
    statusShort: read(["status", "--short"]) ?? "",
  };
}

export function securityReviewCommands({ artifactDir }) {
  const licenseJsonPath = path.join(artifactDir, "dependency-licenses.json");
  const sbomPath = path.join(artifactDir, "sbom.cdx.json");
  const trackedSecretJsonPath = path.join(artifactDir, "tracked-secret-scan.json");
  const hotPathArtifactRoot = path.join(artifactDir, "hot-path-rescan");

  return [
    {
      id: "changed-path-selector",
      command: "pnpm",
      args: ["verify:select", "--", "--dirty"],
      required: true,
    },
    {
      id: "tracked-secret-scan",
      command: "pnpm",
      args: ["security:scan", "--", "--fail-on-skipped", "--json-output", trackedSecretJsonPath],
      required: true,
    },
    {
      id: "secrets-history-scan",
      command: "pnpm",
      args: ["security:secrets-history"],
      required: false,
    },
    {
      id: "privacy-rule-scan",
      command: "pnpm",
      args: ["security:privacy-rules"],
      required: false,
    },
    { id: "lockfile-supply-chain", command: "pnpm", args: ["deps:supply-chain"], required: true },
    { id: "dependency-audit", command: "pnpm", args: ["deps:audit"], required: true },
    { id: "osv-advisory-scan", command: "pnpm", args: ["deps:osv"], required: false },
    {
      id: "license-evidence",
      command: "pnpm",
      args: ["deps:licenses", "--", "--json-output", licenseJsonPath],
      required: true,
    },
    { id: "source-license-scan", command: "pnpm", args: ["license:scan"], required: false },
    {
      id: "cyclonedx-sbom",
      command: "pnpm",
      args: [
        "exec",
        "cyclonedx-npm",
        "--ignore-npm-errors",
        "--output-format",
        "JSON",
        "--output-file",
        sbomPath,
      ],
      env: {
        npm_config_user_agent: "npm/11.0.0 node/v26.0.0 open-practice-security-review",
        npm_execpath: "",
      },
      required: true,
    },
    { id: "policy-check", command: "pnpm", args: ["policy:check"], required: true },
    {
      id: "hot-path-rescan",
      command: "node",
      args: ["scripts/security-hot-path-rescan.mjs", "--artifact-root", hotPathArtifactRoot],
      required: true,
    },
    {
      id: "docker-residual-watch",
      command: "pnpm",
      args: ["docker:residual-watch"],
      required: true,
    },
    { id: "docker-static-lint", command: "pnpm", args: ["docker:lint"], required: false },
    { id: "docker-image-scan", command: "pnpm", args: ["docker:scan"], required: false },
    {
      id: "artifact-secret-scan",
      command: "pnpm",
      args: [
        "security:scan",
        "--",
        "--path",
        artifactDir,
        "--fail-on-skipped",
        "--scan-large-files",
      ],
      required: true,
    },
  ];
}

function formatCommand(command) {
  return [command.command, ...command.args].join(" ");
}

function runCommand(command, { cwd, outputDir, spawn = spawnSync }) {
  const startedAt = new Date().toISOString();
  const result = spawn(command.command, command.args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...(command.env ?? {}) },
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

export function parseArgs(rawArgs = process.argv.slice(2)) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let artifactRoot = DEFAULT_ARTIFACT_ROOT;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") return { help: true, artifactRoot, dryRun };
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

  return { help: false, artifactRoot, dryRun };
}

export function usage() {
  return [
    "Usage:",
    "  node scripts/create-security-review.mjs [--dry-run] [--artifact-root <path>]",
  ].join("\n");
}

export function createSecurityReview({
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  cwd = process.cwd(),
  dryRun = false,
  now = new Date(),
  spawn = spawnSync,
} = {}) {
  const artifactDir = buildSecurityReviewDir({ artifactRoot, cwd, now });
  const commandsDir = path.join(artifactDir, "commands");
  mkdirSync(commandsDir, { recursive: true });

  const packageJson = readJsonFile(path.join(cwd, "package.json"));
  const lockfile = readFileSync(path.join(cwd, "pnpm-lock.yaml"), "utf8");
  const commands = securityReviewCommands({ artifactDir }).map((command) =>
    dryRun
      ? dryRunCommand(command, { outputDir: commandsDir })
      : runCommand(command, { cwd, outputDir: commandsDir, spawn }),
  );
  const failedRequired = commands.filter((command) => command.required && command.status !== 0);
  const metadata = {
    generatedAt: now.toISOString(),
    artifactDir,
    scope: "local_security_review",
    privacy: "synthetic_metadata_only",
    status: dryRun ? "dry-run" : failedRequired.length > 0 ? "failed" : "passed",
    dryRun,
    git: gitMetadata(cwd, spawn),
    packageManager: packageJson.packageManager,
    lockfile: {
      path: "pnpm-lock.yaml",
      sha256: sha256Text(lockfile),
    },
    failedRequiredCommandIds: failedRequired.map((command) => command.id),
    commands,
  };

  writeFileSync(
    path.join(artifactDir, "security-review.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  writeFileSync(
    path.join(artifactDir, "README.md"),
    [
      "# Open Practice Local Security Review",
      "",
      `Generated: ${metadata.generatedAt}`,
      `Status: ${metadata.status}`,
      "",
      "This local artifact records security-review command status and dependency metadata only. Do not add client, matter, credential, payment, privileged document, private deployment, or private audit details here.",
      "",
      "Review `security-review.json`, `tracked-secret-scan.json`, `dependency-licenses.json`, `sbom.cdx.json`, and `commands/*.log` for local evidence.",
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

  const metadata = createSecurityReview(options);
  console.log(`Security review ${metadata.status}: ${metadata.artifactDir}`);
  if (metadata.failedRequiredCommandIds.length > 0) {
    console.error(`Failed required commands: ${metadata.failedRequiredCommandIds.join(", ")}`);
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
