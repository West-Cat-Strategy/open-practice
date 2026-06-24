#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { commandAvailable, toolingTimestamp, writeJsonReport } from "./optional-tooling.mjs";

const DEFAULT_ARTIFACT_ROOT = ".tmp/docker/trivy";
export const DEFAULT_IMAGES = [
  "open-practice-dev-api",
  "open-practice-dev-web",
  "open-practice-dev-worker",
  "open-practice-postgres:18-alpine-su-exec",
  "open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4",
  "open-practice-mailpit:v1.30.2-go1.26.4",
];
export const MISSING_TRIVY_MESSAGE =
  "trivy is not installed locally; install it to run the optional local image scan after docker:app-smoke.";

export function imageArtifactId(image) {
  return image.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "image";
}

export function trivyImageArgs(image, outputPath) {
  return [
    "image",
    "--scanners",
    "vuln",
    "--severity",
    "HIGH,CRITICAL",
    "--exit-code",
    "1",
    "--no-progress",
    "--format",
    "json",
    "--output",
    outputPath,
    image,
  ];
}

function runImageScan({ artifactDir, cwd, image, spawn }) {
  const id = imageArtifactId(image);
  const outputPath = path.join(artifactDir, `${id}.json`);
  const stdoutPath = path.join(artifactDir, `${id}.stdout.log`);
  const stderrPath = path.join(artifactDir, `${id}.stderr.log`);
  const startedAt = new Date().toISOString();
  const result = spawn("trivy", trivyImageArgs(image, outputPath), {
    cwd,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  const finishedAt = new Date().toISOString();

  writeFileSync(stdoutPath, result.stdout ?? "");
  writeFileSync(stderrPath, result.stderr ?? "");

  return {
    image,
    id,
    command: "trivy",
    args: trivyImageArgs(image, outputPath),
    startedAt,
    finishedAt,
    status: result.status ?? 1,
    signal: result.signal ?? null,
    error: result.error instanceof Error ? result.error.message : null,
    outputPath: path.relative(artifactDir, outputPath),
    stdoutPath: path.relative(artifactDir, stdoutPath),
    stderrPath: path.relative(artifactDir, stderrPath),
  };
}

export function scanDockerImages({
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  cwd = process.cwd(),
  images = DEFAULT_IMAGES,
  now = new Date(),
  spawn = spawnSync,
} = {}) {
  const artifactDir = path.resolve(cwd, artifactRoot, toolingTimestamp(now));
  mkdirSync(artifactDir, { recursive: true });
  const availability = commandAvailable("trivy", { cwd, spawn });

  if (!availability.available) {
    const report = {
      generatedAt: now.toISOString(),
      artifactDir,
      scope: "local_docker_image_vulnerability_scan",
      status: "skipped",
      skippedReason: MISSING_TRIVY_MESSAGE,
      command: "trivy",
      availability,
      images,
    };
    writeJsonReport(path.join(artifactDir, "docker-scan.json"), report);
    return report;
  }

  const scans = images.map((image) => runImageScan({ artifactDir, cwd, image, spawn }));
  const report = {
    generatedAt: now.toISOString(),
    artifactDir,
    scope: "local_docker_image_vulnerability_scan",
    status: scans.some((scan) => scan.status !== 0) ? "failed" : "passed",
    command: "trivy",
    images: scans,
  };
  writeJsonReport(path.join(artifactDir, "docker-scan.json"), report);
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = scanDockerImages();
    console.log(`Docker image scan ${result.status}: ${result.artifactDir}`);
    process.exitCode = result.status === "failed" ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
