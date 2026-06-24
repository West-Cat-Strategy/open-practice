#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ARTIFACT_ROOT = ".tmp/open-practice-security-review";
const DEFAULT_SELECTOR_INPUT = { mode: "dirty", args: ["--dirty"] };
const OPTIONAL_SCANNER_REPORTS = new Map([
  ["secrets-history-scan", "secrets-history.json"],
  ["privacy-rule-scan", "privacy-rules.json"],
  ["osv-advisory-scan", "osv-review.json"],
  ["source-license-scan", "license-source-scan.json"],
  ["docker-static-lint", "docker-lint.json"],
  ["docker-image-scan", "docker-scan.json"],
]);

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

function readJsonFileIfPresent(file) {
  if (!file || !existsSync(file)) return null;
  return readJsonFile(file);
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

export function securityReviewCommands({
  artifactDir,
  selectorArgs = DEFAULT_SELECTOR_INPUT.args,
}) {
  const licenseJsonPath = path.join(artifactDir, "dependency-licenses.json");
  const sbomPath = path.join(artifactDir, "sbom.cdx.json");
  const trackedSecretJsonPath = path.join(artifactDir, "tracked-secret-scan.json");
  const hotPathArtifactRoot = path.join(artifactDir, "hot-path-rescan");

  return [
    {
      id: "changed-path-selector",
      command: "pnpm",
      args: ["verify:select", "--", ...selectorArgs],
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

function parseSelectorMode(args, index, currentSelectorInput) {
  if (currentSelectorInput.explicit) {
    throw new Error(
      "Use at most one selector input mode: --dirty, --files, --base, or --base-plus-dirty.",
    );
  }

  const arg = args[index];
  if (arg === "--dirty") {
    return { index, selectorInput: { mode: "dirty", args: ["--dirty"], explicit: true } };
  }

  if (arg === "--base" || arg === "--base-plus-dirty") {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${arg} requires a git ref.`);
    }
    return {
      index: index + 1,
      selectorInput: {
        mode: arg === "--base" ? "base" : "base-plus-dirty",
        args: [arg, value],
        explicit: true,
        base: value,
      },
    };
  }

  const files = args.slice(index + 1);
  if (files.length === 0) {
    throw new Error("--files requires at least one path.");
  }
  return {
    index: args.length,
    selectorInput: { mode: "files", args: ["--files", ...files], explicit: true, files },
  };
}

export function parseArgs(rawArgs = process.argv.slice(2)) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let artifactRoot = DEFAULT_ARTIFACT_ROOT;
  let dryRun = false;
  let selectorInput = { ...DEFAULT_SELECTOR_INPUT, explicit: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      return { help: true, artifactRoot, dryRun, selectorInput: cleanSelectorInput(selectorInput) };
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--dirty" || arg === "--base" || arg === "--base-plus-dirty" || arg === "--files") {
      const parsed = parseSelectorMode(args, index, selectorInput);
      selectorInput = parsed.selectorInput;
      index = parsed.index;
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

  return { help: false, artifactRoot, dryRun, selectorInput: cleanSelectorInput(selectorInput) };
}

export function usage() {
  return [
    "Usage:",
    "  node scripts/create-security-review.mjs [--dry-run] [--artifact-root <path>] [--dirty]",
    "  node scripts/create-security-review.mjs [--dry-run] [--artifact-root <path>] --files <paths...>",
    "  node scripts/create-security-review.mjs [--dry-run] [--artifact-root <path>] --base <git-ref>",
    "  node scripts/create-security-review.mjs [--dry-run] [--artifact-root <path>] --base-plus-dirty <git-ref>",
  ].join("\n");
}

function cleanSelectorInput(selectorInput) {
  const { explicit: _explicit, ...cleaned } = selectorInput;
  return cleaned;
}

function relativeArtifactPath(targetPath, { artifactDir, cwd }) {
  if (!targetPath) return null;
  const resolved = path.resolve(cwd, targetPath);
  const relativeToReview = path.relative(artifactDir, resolved).replaceAll("\\", "/");
  if (relativeToReview && !relativeToReview.startsWith("..") && relativeToReview !== ".") {
    return relativeToReview;
  }
  const relativeToCwd = path.relative(cwd, resolved).replaceAll("\\", "/");
  if (relativeToCwd && !relativeToCwd.startsWith("..") && relativeToCwd !== ".") {
    return relativeToCwd;
  }
  return resolved;
}

function readCommandOutput(command, artifactDir, stream) {
  const logPath = command[`${stream}Path`];
  if (!logPath) return "";
  const absoluteLogPath = path.resolve(artifactDir, logPath);
  if (!existsSync(absoluteLogPath)) return "";
  return readFileSync(absoluteLogPath, "utf8");
}

function extractArtifactDirFromStdout(stdout) {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const match = line.match(/:\s*(.+)$/);
    if (match) return match[1];
  }
  return null;
}

function summarizeSkippedReasons({ command, report }) {
  const reasons = [];
  if (command.skipped) {
    reasons.push({ reason: "dry_run" });
  }
  if (report?.skippedReason) {
    reasons.push({ reason: report.skippedReason });
  }
  if (Array.isArray(report?.skipped)) {
    for (const skipped of report.skipped) {
      reasons.push({
        command: skipped.command ?? null,
        reason: skipped.reason ?? "skipped",
      });
    }
  }
  return reasons;
}

function commandReviewStatus(command, report) {
  if (command.skipped) return "dry-run";
  if (!command.required && command.status === 0 && report?.status === "failed") {
    return "review-required";
  }
  if (report?.status) return report.status;
  if (command.status === 0) return "passed";
  return "failed";
}

function buildTrackedSecretSummary({ artifactDir, command, cwd }) {
  const reportPath = path.join(artifactDir, "tracked-secret-scan.json");
  const report = readJsonFileIfPresent(reportPath);
  return {
    status: commandReviewStatus(command, report),
    reportPath: relativeArtifactPath(reportPath, { artifactDir, cwd }),
    counts: {
      findings: report?.findings?.length ?? null,
      skippedFiles: report?.skipped?.length ?? null,
      scannedFiles:
        report?.scope?.mode === "tracked_git_files"
          ? report.scope.fileCount
          : report?.scope?.mode === "explicit_paths"
            ? report.scope.pathCount
            : null,
    },
    skippedReasons: summarizeSkippedReasons({ command, report }),
  };
}

function buildDependencyLicenseSummary({ artifactDir, command, cwd }) {
  const reportPath = path.join(artifactDir, "dependency-licenses.json");
  const report = readJsonFileIfPresent(reportPath);
  return {
    status: commandReviewStatus(command, report),
    reportPath: relativeArtifactPath(reportPath, { artifactDir, cwd }),
    totals: report?.totals ?? null,
  };
}

function buildOptionalScannerSummaries({ artifactDir, commands, cwd }) {
  return commands
    .filter((command) => OPTIONAL_SCANNER_REPORTS.has(command.id))
    .map((command) => {
      const stdout = readCommandOutput(command, artifactDir, "stdout");
      const scannerArtifactDir = extractArtifactDirFromStdout(stdout);
      const reportFile = OPTIONAL_SCANNER_REPORTS.get(command.id);
      const absoluteReportPath = scannerArtifactDir
        ? path.join(scannerArtifactDir, reportFile)
        : null;
      const report = readJsonFileIfPresent(absoluteReportPath);
      const skippedReasons = summarizeSkippedReasons({ command, report });
      return {
        id: command.id,
        status: commandReviewStatus(command, report),
        required: command.required,
        exitStatus: command.status,
        artifactPath: scannerArtifactDir
          ? relativeArtifactPath(scannerArtifactDir, { artifactDir, cwd })
          : null,
        reportPath: absoluteReportPath
          ? relativeArtifactPath(absoluteReportPath, { artifactDir, cwd })
          : null,
        stdoutPath: command.stdoutPath,
        stderrPath: command.stderrPath,
        skippedReasons,
      };
    });
}

function buildEvidenceSummary({ artifactDir, commands, cwd, selectorInput }) {
  const commandById = new Map(commands.map((command) => [command.id, command]));
  const trackedSecretCommand = commandById.get("tracked-secret-scan");
  const licenseCommand = commandById.get("license-evidence");
  const sbomPath = path.join(artifactDir, "sbom.cdx.json");
  const hotPathArtifactRoot = path.join(artifactDir, "hot-path-rescan");
  const optionalScanners = buildOptionalScannerSummaries({ artifactDir, commands, cwd });

  return {
    selectorInput,
    artifactPaths: {
      review: "security-review.json",
      readme: "README.md",
      trackedSecretScan: "tracked-secret-scan.json",
      dependencyLicenses: "dependency-licenses.json",
      sbom: relativeArtifactPath(sbomPath, { artifactDir, cwd }),
      hotPathRescan: relativeArtifactPath(hotPathArtifactRoot, { artifactDir, cwd }),
      commands: "commands",
    },
    trackedSecrets: trackedSecretCommand
      ? buildTrackedSecretSummary({ artifactDir, command: trackedSecretCommand, cwd })
      : null,
    dependencyLicenses: licenseCommand
      ? buildDependencyLicenseSummary({ artifactDir, command: licenseCommand, cwd })
      : null,
    optionalScanners,
    skippedReasons: optionalScanners.flatMap((scanner) =>
      scanner.skippedReasons.map((skipped) => ({ scannerId: scanner.id, ...skipped })),
    ),
  };
}

export function createSecurityReview({
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  cwd = process.cwd(),
  dryRun = false,
  now = new Date(),
  selectorInput = DEFAULT_SELECTOR_INPUT,
  spawn = spawnSync,
} = {}) {
  const artifactDir = buildSecurityReviewDir({ artifactRoot, cwd, now });
  const commandsDir = path.join(artifactDir, "commands");
  mkdirSync(commandsDir, { recursive: true });

  const packageJson = readJsonFile(path.join(cwd, "package.json"));
  const lockfile = readFileSync(path.join(cwd, "pnpm-lock.yaml"), "utf8");
  const normalizedSelectorInput = cleanSelectorInput({
    ...DEFAULT_SELECTOR_INPUT,
    ...selectorInput,
  });
  const commands = securityReviewCommands({
    artifactDir,
    selectorArgs: normalizedSelectorInput.args,
  }).map((command) =>
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
  metadata.evidenceSummary = buildEvidenceSummary({
    artifactDir,
    commands,
    cwd,
    selectorInput: normalizedSelectorInput,
  });

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
      "Cosign release attestation is intentionally release-only; use `pnpm release:attest` only for release artifacts.",
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
