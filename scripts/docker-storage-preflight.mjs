#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const DEFAULT_MIN_FREE_GIB = 8;
export const KIB_PER_GIB = 1024 * 1024;

const COMMON_LOCAL_IMAGE_REPOSITORIES = new Set([
  "postgres",
  "redis",
  "minio/minio",
  "axllent/mailpit",
  "alpine",
  "busybox",
  "node",
]);

export class DockerStoragePreflightError extends Error {
  constructor(message, result) {
    super(message);
    this.name = "DockerStoragePreflightError";
    this.result = result;
  }
}

function preview(value) {
  return String(value ?? "")
    .trim()
    .slice(0, 1000);
}

function runDocker(args, { cwd = process.cwd(), env = process.env, spawn = spawnSync } = {}) {
  const result = spawn("docker", args, {
    cwd,
    encoding: "utf8",
    env,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    signal: result.signal ?? null,
    error: result.error instanceof Error ? result.error.message : null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parseJsonLines(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function parseDockerSystemDf(text) {
  return parseJsonLines(text).map((entry) => ({
    type: entry.Type,
    totalCount: entry.TotalCount,
    active: entry.Active,
    size: entry.Size,
    reclaimable: entry.Reclaimable,
  }));
}

export function parseDockerImageList(text) {
  return parseJsonLines(text).map((entry) => ({
    id: entry.ID,
    repository: entry.Repository,
    tag: entry.Tag,
    size: entry.Size,
  }));
}

function isNonDanglingImage(image) {
  return image.repository && image.tag && image.repository !== "<none>" && image.tag !== "<none>";
}

function imageRef(image) {
  if (isNonDanglingImage(image)) return `${image.repository}:${image.tag}`;
  return image.id || "";
}

function isOpenPracticeImage(image) {
  return /^open-practice(?:-|$)/.test(image.repository ?? "");
}

function isCommonLocalServiceImage(image) {
  return COMMON_LOCAL_IMAGE_REPOSITORIES.has(image.repository ?? "");
}

export function selectProbeImageRefs(images) {
  const nonDangling = images.filter(isNonDanglingImage);
  const ordered = [
    ...nonDangling.filter(isOpenPracticeImage),
    ...nonDangling.filter(isCommonLocalServiceImage),
    ...nonDangling,
  ];
  const seen = new Set();
  return ordered
    .map(imageRef)
    .filter(Boolean)
    .filter((ref) => {
      if (seen.has(ref)) return false;
      seen.add(ref);
      return true;
    });
}

export function parseMinimumFreeKib(env = process.env) {
  const raw = env.OPEN_PRACTICE_DOCKER_MIN_FREE_GIB;
  if (raw === undefined || raw === "") return DEFAULT_MIN_FREE_GIB * KIB_PER_GIB;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("OPEN_PRACTICE_DOCKER_MIN_FREE_GIB must be a positive number.");
  }
  return Math.ceil(value * KIB_PER_GIB);
}

export function parseDfPk(output) {
  const lines = String(output).trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("df output did not include a filesystem row.");

  const fields = lines.at(-1).trim().split(/\s+/);
  if (fields.length < 6) throw new Error(`Could not parse df output row: ${lines.at(-1)}`);

  const [filesystem, blocks, used, available, capacity, mountedOn] = fields;
  const totalKib = Number(blocks);
  const usedKib = Number(used);
  const availableKib = Number(available);
  if (![totalKib, usedKib, availableKib].every(Number.isFinite)) {
    throw new Error(`Could not parse numeric df values: ${lines.at(-1)}`);
  }
  return { filesystem, totalKib, usedKib, availableKib, capacity, mountedOn };
}

export function formatKib(kib) {
  if (!Number.isFinite(kib)) return "unknown";
  return `${(kib / KIB_PER_GIB).toFixed(1)} GiB`;
}

function diagnosticSummary(systemDf) {
  if (!systemDf?.length) return "Docker system df was unavailable.";
  return systemDf
    .map((entry) => `${entry.type}: size ${entry.size}, reclaimable ${entry.reclaimable}`)
    .join("; ");
}

function makeResult(overrides) {
  return {
    phase: overrides.phase,
    soft: overrides.soft,
    status: overrides.status,
    minimumFreeKib: overrides.minimumFreeKib,
    systemDf: overrides.systemDf ?? [],
    probeImage: overrides.probeImage ?? null,
    df: overrides.df ?? null,
    attempts: overrides.attempts ?? [],
    reason: overrides.reason ?? null,
    message: overrides.message ?? null,
  };
}

function preflightFailure(message, result) {
  return new DockerStoragePreflightError(message, { ...result, message });
}

export function summarizeDockerStoragePreflight(result) {
  return {
    phase: result.phase,
    status: result.status,
    soft: result.soft,
    minimumFreeKib: result.minimumFreeKib,
    minimumFree: formatKib(result.minimumFreeKib),
    availableKib: result.df?.availableKib ?? null,
    available: result.df ? formatKib(result.df.availableKib) : null,
    probeImage: result.probeImage,
    reason: result.reason,
    systemDf: result.systemDf,
    attempts: result.attempts.map((attempt) => ({
      image: attempt.image,
      status: attempt.status,
      stderrPreview: attempt.stderrPreview,
    })),
  };
}

export function runDockerStoragePreflight({
  cwd = process.cwd(),
  env = process.env,
  spawn = spawnSync,
  phase = "docker storage preflight",
  soft = false,
  log = console.log,
  warn = console.warn,
} = {}) {
  const minimumFreeKib = parseMinimumFreeKib(env);
  const dockerOptions = { cwd, env, spawn };

  const info = runDocker(["info"], dockerOptions);
  if (info.status !== 0) {
    const result = makeResult({
      phase,
      soft,
      status: "failed",
      minimumFreeKib,
      reason: "docker_unreachable",
    });
    throw preflightFailure(
      [
        `Docker storage preflight failed during ${phase}: Docker daemon is not reachable.`,
        preview(info.stderr || info.stdout || info.error),
      ]
        .filter(Boolean)
        .join("\n"),
      result,
    );
  }

  const systemDfResult = runDocker(["system", "df", "--format", "{{json .}}"], dockerOptions);
  const systemDf = systemDfResult.status === 0 ? parseDockerSystemDf(systemDfResult.stdout) : [];

  const imageList = runDocker(["image", "ls", "--format", "{{json .}}"], dockerOptions);
  if (imageList.status !== 0) {
    const result = makeResult({
      phase,
      soft,
      status: "failed",
      minimumFreeKib,
      systemDf,
      reason: "image_list_failed",
    });
    throw preflightFailure(
      [
        `Docker storage preflight failed during ${phase}: could not list local Docker images.`,
        preview(imageList.stderr || imageList.stdout || imageList.error),
      ]
        .filter(Boolean)
        .join("\n"),
      result,
    );
  }

  const candidates = selectProbeImageRefs(parseDockerImageList(imageList.stdout));
  if (candidates.length === 0) {
    const result = makeResult({
      phase,
      soft,
      status: soft ? "skipped" : "failed",
      minimumFreeKib,
      systemDf,
      reason: "no_local_probe_image",
    });
    const message = [
      `Docker storage preflight could not measure capacity during ${phase}: no non-dangling local Docker image is available for a pull-free df probe.`,
      `Diagnostic context: ${diagnosticSummary(systemDf)}`,
      "Run a Docker build or pull a local probe image, then rerun the Docker validation command.",
    ].join("\n");
    if (soft) {
      warn(message);
      return { ...result, message };
    }
    throw preflightFailure(message, result);
  }

  const attempts = [];
  for (const image of candidates) {
    const probe = runDocker(
      ["run", "--rm", "--pull=never", "--entrypoint", "df", image, "-Pk", "/"],
      dockerOptions,
    );
    if (probe.status !== 0) {
      attempts.push({
        image,
        status: probe.status,
        stderrPreview: preview(probe.stderr || probe.stdout || probe.error),
      });
      continue;
    }

    let df;
    try {
      df = parseDfPk(probe.stdout);
    } catch (error) {
      attempts.push({
        image,
        status: 1,
        stderrPreview: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const result = makeResult({
      phase,
      soft,
      status: df.availableKib >= minimumFreeKib ? "passed" : "failed",
      minimumFreeKib,
      systemDf,
      probeImage: image,
      df,
      attempts,
    });

    if (df.availableKib < minimumFreeKib) {
      throw preflightFailure(
        [
          `Docker storage preflight failed during ${phase}: Docker has ${formatKib(df.availableKib)} free, below the required ${formatKib(minimumFreeKib)}.`,
          `Probe image: ${image}`,
          `Diagnostic context: ${diagnosticSummary(systemDf)}`,
          "Reclaim Docker storage, for example by pruning unused build cache or unused images, then rerun the Docker validation command.",
          "This preflight never prunes or deletes Docker data automatically.",
        ].join("\n"),
        result,
      );
    }

    log(
      `Docker storage preflight passed during ${phase}: ${formatKib(df.availableKib)} free with ${image}; minimum ${formatKib(minimumFreeKib)}.`,
    );
    return result;
  }

  const result = makeResult({
    phase,
    soft,
    status: soft ? "skipped" : "failed",
    minimumFreeKib,
    systemDf,
    attempts,
    reason: "probe_failed",
  });
  const message = [
    `Docker storage preflight could not measure capacity during ${phase}: every local probe image failed the pull-free df probe.`,
    `Diagnostic context: ${diagnosticSummary(systemDf)}`,
    "Run a Docker build or make a local image with df available, then rerun the Docker validation command.",
  ].join("\n");
  if (soft) {
    warn(message);
    return { ...result, message };
  }
  throw preflightFailure(message, result);
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  try {
    runDockerStoragePreflight({ phase: "manual Docker storage preflight" });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
