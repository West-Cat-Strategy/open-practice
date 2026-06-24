#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { runOptionalTool } from "./optional-tooling.mjs";

const DEFAULT_ARTIFACT_ROOT = ".tmp/license/scancode";
export const SOURCE_LICENSE_SCAN_IGNORES = [
  ".git",
  ".tmp",
  ".references/oss",
  "artifacts",
  "artifact",
  "output",
  "outputs",
  "report",
  "reports",
  "coverage",
  "playwright-report",
  "test-results",
  ".cache",
  "cache",
  "node_modules",
  ".pnpm-store",
  ".next",
  ".turbo",
  "dist",
  "build",
  "out",
  "storybook-static",
];

export function sourceLicenseScanArgs({ artifactDir }) {
  return [
    "--license",
    "--copyright",
    "--info",
    ...SOURCE_LICENSE_SCAN_IGNORES.flatMap((ignoredPath) => ["--ignore", ignoredPath]),
    "--json-pp",
    path.join(artifactDir, "scancode.json"),
    ".",
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = runOptionalTool({
      artifactRoot: DEFAULT_ARTIFACT_ROOT,
      command: "scancode",
      args: sourceLicenseScanArgs,
      missingMessage:
        "scancode is not installed locally; install ScanCode Toolkit to run the optional copied-source/license-text scan.",
      reportFile: "license-source-scan.json",
      scope: "local_source_license_scan",
    });
    console.log(`Source license scan ${result.status}: ${result.artifactDir}`);
    process.exitCode = result.status === "failed" ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
