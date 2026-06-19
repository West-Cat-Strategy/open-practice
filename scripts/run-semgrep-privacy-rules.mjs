#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { runOptionalTool } from "./optional-tooling.mjs";

const DEFAULT_ARTIFACT_ROOT = ".tmp/security/semgrep-privacy";

export function runSemgrepPrivacyRules({
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  cwd = process.cwd(),
} = {}) {
  return runOptionalTool({
    artifactRoot,
    command: "semgrep",
    args: ({ artifactDir }) => [
      "scan",
      "--config",
      ".semgrep/open-practice.yml",
      "--json",
      "--output",
      path.join(artifactDir, "semgrep.json"),
    ],
    cwd,
    missingMessage:
      "semgrep is not installed locally; install it to run OP-specific privacy/security policy rules.",
    reportFile: "privacy-rules.json",
    scope: "open_practice_privacy_policy_as_code",
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = runSemgrepPrivacyRules();
    console.log(`Semgrep privacy rules ${result.status}: ${result.artifactDir}`);
    process.exitCode = result.status === "failed" ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
