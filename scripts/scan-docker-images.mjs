#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DOCKER_DAEMON_BLOCKER_CODE,
  runDockerDaemonPreflight,
} from "./docker-storage-preflight.mjs";
import { commandAvailable, toolingTimestamp, writeJsonReport } from "./optional-tooling.mjs";
import { runDockerResidualWatch } from "./watch-docker-residuals.mjs";

const DEFAULT_ARTIFACT_ROOT = ".tmp/docker/trivy";
export const DEFAULT_IMAGES = [
  "open-practice-dev-api",
  "open-practice-dev-web",
  "open-practice-dev-worker",
  "open-practice-postgres:18-alpine-su-exec",
  "open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4",
  "open-practice-mailpit:v1.30.3-go1.26.4",
];
const DEFAULT_APP_IMAGE_ROLES = new Map([
  ["open-practice-dev-api", "api"],
  ["open-practice-dev-web", "web"],
  ["open-practice-dev-worker", "worker"],
]);
const APP_SMOKE_IMAGE_PATTERN =
  /^open-practice-app-smoke-(?<project>.+)-(?<role>api|web|worker):latest$/;
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

function trivyCriticalHighCounts(artifactDir, scan) {
  let report;
  try {
    report = JSON.parse(readFileSync(path.join(artifactDir, scan.outputPath), "utf8"));
  } catch {
    return null;
  }

  const counts = { critical: 0, high: 0 };
  for (const result of report.Results ?? []) {
    for (const vulnerability of result.Vulnerabilities ?? []) {
      if (vulnerability.Severity === "CRITICAL") counts.critical += 1;
      if (vulnerability.Severity === "HIGH") counts.high += 1;
    }
  }
  return counts.critical + counts.high > 0 ? counts : null;
}

function isMinioScan(scan) {
  return scan.image.startsWith("open-practice-minio:");
}

function imageWithImplicitLatestTag(image) {
  const finalSegment = image.split("/").at(-1) ?? image;
  return finalSegment.includes(":") ? image : `${image}:latest`;
}

function isDefaultImageSet(images) {
  return (
    images.length === DEFAULT_IMAGES.length &&
    images.every((image, index) => image === DEFAULT_IMAGES[index])
  );
}

function listLocalDockerImages({ cwd, spawn }) {
  const result = spawn("docker", ["image", "ls", "--format", "{{.Repository}}:{{.Tag}}"], {
    cwd,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) return [];

  return (result.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.includes("<none>"));
}

function newestCompleteAppSmokeImageSet(localImages) {
  const smokeProjects = new Map();
  for (const [index, image] of localImages.entries()) {
    const match = APP_SMOKE_IMAGE_PATTERN.exec(image);
    if (!match?.groups) continue;

    const project = match.groups.project;
    const projectImages = smokeProjects.get(project) ?? {
      firstIndex: index,
      roles: new Map(),
    };
    projectImages.firstIndex = Math.min(projectImages.firstIndex, index);
    projectImages.roles.set(match.groups.role, image);
    smokeProjects.set(project, projectImages);
  }

  return [...smokeProjects.values()]
    .filter(({ roles }) => roles.has("api") && roles.has("web") && roles.has("worker"))
    .sort((left, right) => left.firstIndex - right.firstIndex)[0];
}

function resolveDockerScanImages({ cwd, images, spawn }) {
  if (!isDefaultImageSet(images)) return images;

  const localImages = listLocalDockerImages({ cwd, spawn });
  if (localImages.length === 0) return images;

  const localImageSet = new Set(localImages);
  const smokeImageSet = newestCompleteAppSmokeImageSet(localImages);
  return images.map((image) => {
    if (
      !DEFAULT_APP_IMAGE_ROLES.has(image) ||
      localImageSet.has(image) ||
      localImageSet.has(imageWithImplicitLatestTag(image))
    ) {
      return image;
    }

    return smokeImageSet?.roles.get(DEFAULT_APP_IMAGE_ROLES.get(image)) ?? image;
  });
}

function acceptsBundledMinioScanResiduals(residualWatch) {
  return (
    residualWatch?.status === "passed" &&
    residualWatch.minioHardening?.acceptsBundledMinioResiduals === true &&
    (residualWatch.acceptedResiduals ?? []).some(
      (residual) => residual.serviceName === "minio" && residual.kind === "critical-high-cves",
    )
  );
}

function assessAcceptedScanResiduals({
  artifactDir,
  cwd,
  failedScans,
  now,
  residualWatchRunner,
  spawn,
}) {
  if (failedScans.length === 0) return { acceptedResiduals: [], residualWatch: null };
  if (!failedScans.every(isMinioScan)) return { acceptedResiduals: [], residualWatch: null };

  const minioScans = failedScans
    .map((scan) => ({ scan, counts: trivyCriticalHighCounts(artifactDir, scan) }))
    .filter(({ counts }) => counts !== null);
  if (minioScans.length !== failedScans.length) {
    return { acceptedResiduals: [], residualWatch: null };
  }

  const residualWatch = residualWatchRunner({ cwd, now, spawn });
  if (!acceptsBundledMinioScanResiduals(residualWatch)) {
    return { acceptedResiduals: [], residualWatch };
  }

  const basis = residualWatch.acceptedResiduals.find(
    (residual) => residual.serviceName === "minio",
  )?.basis;
  return {
    acceptedResiduals: minioScans.map(({ scan, counts }) => ({
      id: scan.id,
      serviceName: "minio",
      kind: "trivy-critical-high-vulnerabilities",
      detail: `Trivy reported ${counts.critical} critical and ${counts.high} high findings for the bundled MinIO image.`,
      basis: basis ?? [],
    })),
    residualWatch: {
      artifactDir: residualWatch.artifactDir,
      status: residualWatch.status,
      acceptedResiduals: residualWatch.acceptedResiduals,
      minioHardening: residualWatch.minioHardening,
    },
  };
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

function daemonBlockerFromError(error) {
  const result = error?.result;
  if (result?.code !== DOCKER_DAEMON_BLOCKER_CODE) return null;
  return {
    id: "docker-daemon-preflight",
    kind: result.kind,
    code: result.code,
    reason: result.reason,
    status: result.docker?.status ?? 1,
    signal: result.docker?.signal ?? null,
    error: result.docker?.error ?? null,
    detail: result.message ?? (error instanceof Error ? error.message : String(error)),
    stderrPreview: result.docker?.stderrPreview ?? "",
    stdoutPreview: result.docker?.stdoutPreview ?? "",
  };
}

export function scanDockerImages({
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  cwd = process.cwd(),
  images = DEFAULT_IMAGES,
  now = new Date(),
  residualWatchRunner = runDockerResidualWatch,
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

  try {
    runDockerDaemonPreflight({ cwd, spawn, phase: "docker:scan" });
  } catch (error) {
    const daemonBlocker = daemonBlockerFromError(error);
    if (!daemonBlocker) throw error;
    const report = {
      generatedAt: now.toISOString(),
      artifactDir,
      scope: "local_docker_image_vulnerability_scan",
      status: "blocked",
      command: "trivy",
      availability,
      targetImages: images,
      images: [],
      blockers: [daemonBlocker],
    };
    writeJsonReport(path.join(artifactDir, "docker-scan.json"), report);
    return report;
  }

  const resolvedImages = resolveDockerScanImages({ cwd, images, spawn });
  const scans = resolvedImages.map((image) => runImageScan({ artifactDir, cwd, image, spawn }));
  const failedScans = scans.filter((scan) => scan.status !== 0);
  const scanResiduals = assessAcceptedScanResiduals({
    artifactDir,
    cwd,
    failedScans,
    now,
    residualWatchRunner,
    spawn,
  });
  const unacceptedFailedScans = failedScans.filter(
    (scan) => !scanResiduals.acceptedResiduals.some((residual) => residual.id === scan.id),
  );
  const report = {
    generatedAt: now.toISOString(),
    artifactDir,
    scope: "local_docker_image_vulnerability_scan",
    status: unacceptedFailedScans.length > 0 ? "failed" : "passed",
    command: "trivy",
    images: scans,
    acceptedResiduals: scanResiduals.acceptedResiduals,
    residualWatch: scanResiduals.residualWatch,
  };
  writeJsonReport(path.join(artifactDir, "docker-scan.json"), report);
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = scanDockerImages();
    console.log(`Docker image scan ${result.status}: ${result.artifactDir}`);
    process.exitCode = result.status === "passed" || result.status === "skipped" ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
