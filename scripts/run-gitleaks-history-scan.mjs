#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { runOptionalTool } from "./optional-tooling.mjs";

const DEFAULT_ARTIFACT_ROOT = ".tmp/security/gitleaks";
export const DEFAULT_GITLEAKS_IGNORE_PATH = ".gitleaksignore";

export function parseArgs(rawArgs = process.argv.slice(2)) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let artifactRoot = DEFAULT_ARTIFACT_ROOT;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--artifact-root") {
      const value = args[index + 1];
      index += 1;
      if (!value || value.startsWith("--")) throw new Error("--artifact-root requires a path.");
      artifactRoot = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { artifactRoot };
}

export function gitleaksHistoryScanArgs({
  artifactDir,
  ignorePath = DEFAULT_GITLEAKS_IGNORE_PATH,
  reportPath = "gitleaks-report.json",
} = {}) {
  return [
    "detect",
    "--source",
    ".",
    "--redact",
    "--no-banner",
    "--gitleaks-ignore-path",
    ignorePath,
    "--report-format",
    "json",
    "--report-path",
    path.join(artifactDir, reportPath),
  ];
}

export function runGitleaksHistoryScan({
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  cwd = process.cwd(),
} = {}) {
  const result = runOptionalTool({
    artifactRoot,
    command: "gitleaks",
    args: ({ artifactDir }) => gitleaksHistoryScanArgs({ artifactDir }),
    cwd,
    missingMessage:
      "gitleaks is not installed locally; install it to run the optional Git history/diff secret scan.",
    reportFile: "secrets-history.json",
    scope: "local_git_history_secret_scan",
  });
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = runGitleaksHistoryScan(parseArgs());
    const status = result.status === "failed" ? "review-required" : result.status;
    console.log(`Gitleaks history scan ${status}: ${result.artifactDir}`);
    process.exitCode = 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
