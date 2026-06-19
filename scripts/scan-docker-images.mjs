#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { runOptionalTool } from "./optional-tooling.mjs";

const DEFAULT_ARTIFACT_ROOT = ".tmp/docker/trivy";
const DEFAULT_IMAGES = [
  "open-practice-dev-api",
  "open-practice-dev-web",
  "open-practice-dev-worker",
  "open-practice-postgres:18-alpine-su-exec",
  "open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4",
  "open-practice-mailpit:v1.30.2-go1.26.4",
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = runOptionalTool({
      artifactRoot: DEFAULT_ARTIFACT_ROOT,
      command: "trivy",
      args: ({ artifactDir }) => [
        "image",
        "--format",
        "json",
        "--output",
        path.join(artifactDir, "trivy-images.json"),
        ...DEFAULT_IMAGES,
      ],
      missingMessage:
        "trivy is not installed locally; install it to run the optional local image scan after docker:app-smoke.",
      reportFile: "docker-scan.json",
      scope: "local_docker_image_vulnerability_scan",
    });
    console.log(`Docker image scan ${result.status}: ${result.artifactDir}`);
    process.exitCode = result.status === "failed" ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
