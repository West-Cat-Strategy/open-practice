#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { runOptionalTool } from "./optional-tooling.mjs";

const DEFAULT_ARTIFACT_ROOT = ".tmp/security/osv";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = runOptionalTool({
      artifactRoot: DEFAULT_ARTIFACT_ROOT,
      command: "osv-scanner",
      args: ({ artifactDir }) => [
        "scan",
        "--lockfile",
        "pnpm-lock.yaml",
        "--format",
        "json",
        "--output-file",
        path.join(artifactDir, "osv.json"),
      ],
      missingMessage:
        "osv-scanner is not installed locally; install it to run the optional OSV advisory scan.",
      reportFile: "osv-review.json",
      scope: "local_lockfile_osv_advisory_scan",
    });
    console.log(`OSV advisory scan ${result.status}: ${result.artifactDir}`);
    process.exitCode = result.status === "failed" ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
