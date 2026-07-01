#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DOCKER_DAEMON_BLOCKER_CODE,
  runDockerDaemonPreflight,
} from "./docker-storage-preflight.mjs";

const DEFAULT_ARTIFACT_ROOT = path.join(
  "/tmp",
  "codex-security-scans",
  "open-practice",
  "docker-residual-watch",
);

const SERVICE_ORDER = ["postgres", "minio", "mailpit"];
const MINIO_HARDENED_SERVICES = ["minio", "minio-bucket-init"];
const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;
const WRAPPED_SERVICE_IMAGE_BUILD_TIMEOUT_MS = 1_200_000;
const DOCUMENTED_MINIO_LATEST_DIGEST =
  "sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e";

const SERVICE_DEFINITIONS = {
  postgres: {
    dockerfilePath: "docker/postgres/Dockerfile",
    registryProbes: (posture) => [
      {
        id: "postgres-upstream-18-alpine-manifest",
        image: posture.upstreamImageWithoutDigest ?? "postgres:18-alpine",
        candidateWhenDigestDiffersFrom: posture.upstreamDigest ?? null,
      },
    ],
    sourceProbe: null,
  },
  minio: {
    dockerfilePath: "docker/minio/Dockerfile",
    registryProbes: (posture) => [
      {
        id: "minio-dockerhub-latest-manifest",
        image: "minio/minio:latest",
        candidateWhenDigestDiffersFrom: DOCUMENTED_MINIO_LATEST_DIGEST,
      },
      {
        id: "minio-quay-latest-manifest",
        image: "quay.io/minio/minio:latest",
        candidateWhenDigestDiffersFrom: DOCUMENTED_MINIO_LATEST_DIGEST,
      },
      {
        id: "minio-dockerhub-current-source-manifest",
        image: `minio/minio:${posture.version}`,
        candidateWhenPresent: true,
      },
      {
        id: "minio-quay-current-source-manifest",
        image: `quay.io/minio/minio:${posture.version}`,
        candidateWhenPresent: true,
      },
    ],
    sourceProbe: {
      id: "minio-source-tags",
      command: "git",
      args: [
        "ls-remote",
        "--tags",
        "--refs",
        "https://github.com/minio/minio.git",
        "refs/tags/RELEASE.*",
      ],
      kind: "minio",
    },
    archiveProbe: {
      id: "minio-source-repository-metadata",
      command: "curl",
      args: [
        "-fsSL",
        "--retry",
        "3",
        "--retry-all-errors",
        "--retry-delay",
        "1",
        "-H",
        "User-Agent: open-practice-local-validation",
        "https://api.github.com/repos/minio/minio",
      ],
      kind: "github-repository",
      repository: "minio/minio",
    },
  },
  mailpit: {
    dockerfilePath: "docker/mailpit/Dockerfile",
    registryProbes: (posture) => [
      { id: "mailpit-dockerhub-latest-manifest", image: "axllent/mailpit:latest" },
      {
        id: "mailpit-dockerhub-current-source-manifest",
        image: `axllent/mailpit:${posture.version}`,
      },
    ],
    sourceProbe: {
      id: "mailpit-source-tags",
      command: "git",
      args: [
        "ls-remote",
        "--tags",
        "--refs",
        "https://github.com/axllent/mailpit.git",
        "refs/tags/v*",
      ],
      kind: "semver",
    },
  },
};

function readText(cwd, filePath) {
  return readFileSync(path.join(cwd, filePath), "utf8");
}

export function watchTimestamp(now = new Date()) {
  return now
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildArtifactDir({ artifactRoot = DEFAULT_ARTIFACT_ROOT, now = new Date() } = {}) {
  return path.join(artifactRoot, watchTimestamp(now));
}

function extractServiceBlock(composeText, serviceName) {
  const pattern = new RegExp(`^  ${serviceName}:\\n(?<block>(?:    .*(?:\\n|$))*)`, "m");
  const match = composeText.match(pattern);
  if (!match?.groups?.block) {
    throw new Error(`Could not find ${serviceName} service in docker-compose.yml.`);
  }

  const lines = [];
  for (const line of match.groups.block.split("\n")) {
    if (line.startsWith("  ") && !line.startsWith("    ")) break;
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

export function parseComposeServiceImages(composeText, serviceNames = SERVICE_ORDER) {
  return Object.fromEntries(
    serviceNames.map((serviceName) => {
      const block = extractServiceBlock(composeText, serviceName);
      const image = block.match(/^\s+image:\s*"?([^"\n]+)"?\s*$/m)?.[1]?.trim();
      if (!image) {
        throw new Error(`Could not find ${serviceName} image in docker-compose.yml.`);
      }
      return [serviceName, image];
    }),
  );
}

function serviceHasTmpfsMount(block, mountPath) {
  const match = block.match(/^    tmpfs:\n(?<values>(?:      - .*(?:\n|$))*)/m);
  if (!match?.groups?.values) return false;
  return match.groups.values
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^-\s*/, "")
        .replace(/^["']|["']$/g, ""),
    )
    .some((value) => value.split(":")[0] === mountPath);
}

function parseServiceHardening(composeText, serviceName) {
  const block = extractServiceBlock(composeText, serviceName);
  return {
    readOnlyRootFilesystem: /^\s+read_only:\s*true\s*$/m.test(block),
    tmpfsTmp: serviceHasTmpfsMount(block, "/tmp"),
  };
}

export function assessMinioComposeHardening({ composeTexts } = {}) {
  const fileAssessments = Object.entries(composeTexts ?? {}).map(([filePath, composeText]) => {
    const services = Object.fromEntries(
      MINIO_HARDENED_SERVICES.map((serviceName) => [
        serviceName,
        parseServiceHardening(composeText, serviceName),
      ]),
    );
    return {
      path: filePath,
      services,
      passed: Object.values(services).every(
        (service) => service.readOnlyRootFilesystem && service.tmpfsTmp,
      ),
    };
  });

  const missing = [];
  for (const file of fileAssessments) {
    for (const [serviceName, checks] of Object.entries(file.services)) {
      if (!checks.readOnlyRootFilesystem) {
        missing.push(`${file.path}:${serviceName}:read_only`);
      }
      if (!checks.tmpfsTmp) {
        missing.push(`${file.path}:${serviceName}:tmpfs:/tmp`);
      }
    }
  }

  return {
    eligible: missing.length === 0,
    missing,
    files: fileAssessments,
  };
}

function firstMatch(text, regex, label) {
  const match = text.match(regex);
  if (!match?.[1]) throw new Error(`Could not parse ${label}.`);
  return match[1];
}

function parseFromImages(dockerfileText) {
  return [...dockerfileText.matchAll(/^FROM\s+([^\s]+)(?:\s+AS\s+(\S+))?/gim)].map((match) => ({
    image: match[1],
    stage: match[2] ?? null,
  }));
}

function splitImageDigest(image) {
  const [imageWithoutDigest, digest] = image.split("@");
  return { imageWithoutDigest, digest: digest ?? null };
}

export function parseDockerfilePosture(serviceName, dockerfileText) {
  if (serviceName === "postgres") {
    const from = parseFromImages(dockerfileText)[0];
    if (!from) throw new Error("Could not parse Postgres upstream image.");
    const { imageWithoutDigest, digest } = splitImageDigest(from.image);
    return {
      upstreamImage: from.image,
      upstreamImageWithoutDigest: imageWithoutDigest,
      upstreamDigest: digest,
      pgVersion: firstMatch(dockerfileText, /^ENV\s+PG_VERSION=([^\s]+)$/m, "PG_VERSION"),
      libcurlMinimum:
        dockerfileText.match(/"libcurl>=([^"]+)"/)?.[1] ??
        dockerfileText.match(/\blibcurl>=([^\s\\]+)/)?.[1] ??
        null,
    };
  }

  if (serviceName === "minio") {
    const froms = parseFromImages(dockerfileText);
    return {
      version: firstMatch(dockerfileText, /^ARG\s+MINIO_VERSION=([^\s]+)$/m, "MINIO_VERSION"),
      commit: firstMatch(dockerfileText, /^ARG\s+MINIO_COMMIT=([^\s]+)$/m, "MINIO_COMMIT"),
      builderImage: froms[0]?.image ?? null,
      runtimeImage: froms[1]?.image ?? null,
    };
  }

  if (serviceName === "mailpit") {
    const froms = parseFromImages(dockerfileText);
    return {
      version: firstMatch(dockerfileText, /^ARG\s+MAILPIT_VERSION=([^\s]+)$/m, "MAILPIT_VERSION"),
      archiveSha256: firstMatch(
        dockerfileText,
        /^ARG\s+MAILPIT_SHA256=([^\s]+)$/m,
        "MAILPIT_SHA256",
      ),
      builderImage: froms[0]?.image ?? null,
      runtimeImage: froms[1]?.image ?? null,
    };
  }

  throw new Error(`Unsupported service: ${serviceName}`);
}

export function collectDockerResidualPosture({
  cwd = process.cwd(),
  composeText = readText(cwd, "docker-compose.yml"),
  dockerfileTexts = Object.fromEntries(
    SERVICE_ORDER.map((serviceName) => [
      serviceName,
      readText(cwd, SERVICE_DEFINITIONS[serviceName].dockerfilePath),
    ]),
  ),
} = {}) {
  const composeImages = parseComposeServiceImages(composeText);
  return Object.fromEntries(
    SERVICE_ORDER.map((serviceName) => [
      serviceName,
      {
        serviceName,
        composeImage: composeImages[serviceName],
        dockerfilePath: SERVICE_DEFINITIONS[serviceName].dockerfilePath,
        ...parseDockerfilePosture(serviceName, dockerfileTexts[serviceName]),
      },
    ]),
  );
}

function command(id, commandName, args, options = {}) {
  return { id, command: commandName, args, required: true, ...options };
}

function scoutImageTarget(image) {
  return image.startsWith("local://") ? image : `local://${image}`;
}

export function dockerResidualCommands(posture) {
  const commands = [
    command("docker-version", "docker", [
      "version",
      "--format",
      "{{.Client.Version}} {{.Server.Version}}",
    ]),
    command("docker-scout-version", "docker", ["scout", "version"]),
    command("compose-images", "docker", ["compose", "config", "--images"]),
    command(
      "wrapped-service-images-build",
      "docker",
      ["compose", "build", "postgres", "minio", "mailpit"],
      {
        timeoutMs: WRAPPED_SERVICE_IMAGE_BUILD_TIMEOUT_MS,
      },
    ),
  ];

  for (const serviceName of SERVICE_ORDER) {
    const servicePosture = posture[serviceName];
    const scoutTarget = scoutImageTarget(servicePosture.composeImage);
    commands.push(
      command(`${serviceName}-scout-quickview`, "docker", ["scout", "quickview", scoutTarget]),
      command(`${serviceName}-scout-critical-high-cves`, "docker", [
        "scout",
        "cves",
        "--only-severity",
        "critical,high",
        scoutTarget,
      ]),
      command(`${serviceName}-scout-recommendations`, "docker", [
        "scout",
        "recommendations",
        scoutTarget,
      ]),
    );

    for (const probe of SERVICE_DEFINITIONS[serviceName].registryProbes(servicePosture)) {
      commands.push(
        command(probe.id, "docker", ["buildx", "imagetools", "inspect", probe.image], {
          registryProbe: probe,
          allowFailurePatterns: [
            /not found/i,
            /manifest unknown/i,
            /no such manifest/i,
            /name unknown/i,
            /pull access denied/i,
          ],
        }),
      );
    }

    const sourceProbe = SERVICE_DEFINITIONS[serviceName].sourceProbe;
    if (sourceProbe) {
      commands.push(
        command(sourceProbe.id, sourceProbe.command, sourceProbe.args, { sourceProbe }),
      );
    }

    const archiveProbe = SERVICE_DEFINITIONS[serviceName].archiveProbe;
    if (archiveProbe) {
      commands.push(
        command(archiveProbe.id, archiveProbe.command, archiveProbe.args, { archiveProbe }),
      );
    }
  }

  return commands;
}

function runCommand(commandSpec, { cwd, outputDir, spawn = spawnSync }) {
  const startedAt = new Date().toISOString();
  const result = spawn(commandSpec.command, commandSpec.args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    timeout: commandSpec.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
  });
  const finishedAt = new Date().toISOString();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  writeFileSync(path.join(outputDir, `${commandSpec.id}.stdout.log`), stdout);
  writeFileSync(path.join(outputDir, `${commandSpec.id}.stderr.log`), stderr);

  return {
    id: commandSpec.id,
    command: commandSpec.command,
    args: commandSpec.args,
    required: commandSpec.required,
    status: result.status ?? 1,
    signal: result.signal ?? null,
    error: result.error instanceof Error ? result.error.message : null,
    timeoutMs: commandSpec.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
    stdout,
    stderr,
    stdoutPath: `${commandSpec.id}.stdout.log`,
    stderrPath: `${commandSpec.id}.stderr.log`,
    startedAt,
    finishedAt,
    registryProbe: commandSpec.registryProbe ?? null,
    sourceProbe: commandSpec.sourceProbe ?? null,
    archiveProbe: commandSpec.archiveProbe ?? null,
    allowFailurePatterns: commandSpec.allowFailurePatterns ?? [],
  };
}

function outputText(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function failureWasAllowed(result) {
  if (result.status === 0) return true;
  return result.allowFailurePatterns.some((pattern) => pattern.test(outputText(result)));
}

export function extractManifestDigest(output) {
  return output.match(/^Digest:\s*(sha256:[a-f0-9]+)/im)?.[1] ?? null;
}

export function sourceTagsFromLsRemote(output) {
  return output
    .split("\n")
    .map((line) => line.match(/refs\/tags\/([^\s^{}]+)$/)?.[1])
    .filter(Boolean);
}

function minioTagValue(tag) {
  return tag.match(/^RELEASE\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)$/)?.[1] ?? null;
}

function semverParts(tag) {
  const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  return match.slice(1, 4).map((value) => Number.parseInt(value, 10));
}

function compareNumberArrays(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function latestSourceTag(tags, kind) {
  if (kind === "minio") {
    return tags
      .filter((tag) => minioTagValue(tag) !== null)
      .sort((left, right) => minioTagValue(left).localeCompare(minioTagValue(right)))
      .at(-1);
  }

  if (kind === "semver") {
    return tags
      .filter((tag) => semverParts(tag) !== null)
      .sort((left, right) => compareNumberArrays(semverParts(left), semverParts(right)))
      .at(-1);
  }

  throw new Error(`Unsupported source tag kind: ${kind}`);
}

export function sourceTagIsNewer(latest, current, kind) {
  if (!latest) return false;
  if (kind === "minio") return minioTagValue(latest) > minioTagValue(current);
  if (kind === "semver") return compareNumberArrays(semverParts(latest), semverParts(current)) > 0;
  throw new Error(`Unsupported source tag kind: ${kind}`);
}

function quickviewCounts(output) {
  const match = output.match(/(\d+)C(?:\/|\s+)(\d+)H(?:\/|\s+)(\d+)M(?:\/|\s+)(\d+)L/);
  if (!match) return null;
  return {
    critical: Number.parseInt(match[1], 10),
    high: Number.parseInt(match[2], 10),
    medium: Number.parseInt(match[3], 10),
    low: Number.parseInt(match[4], 10),
  };
}

function criticalHighCveCounts(output) {
  const overviewMatch = output.match(/\bvulnerabilities\b[^\n]*?\b(\d+)C\s+(\d+)H\b/i);
  if (overviewMatch) {
    return {
      critical: Number.parseInt(overviewMatch[1], 10),
      high: Number.parseInt(overviewMatch[2], 10),
    };
  }

  const critical = output.match(/(?:^|\n)\s*(?:✗\s*)?CRITICAL\s+CVE-/gi)?.length ?? 0;
  const high = output.match(/(?:^|\n)\s*(?:✗\s*)?HIGH\s+CVE-/gi)?.length ?? 0;
  if (critical + high === 0) return null;
  return { critical, high };
}

function scoutRecommendationNeedsReview(output) {
  const text = output.trim();
  if (!text || /no recommendations/i.test(text)) return false;

  const reductionPattern =
    /\b(?:critical|high)\b[^\n]*(?:->|→|to)[^\n]*\b0\b|\b0\b[^\n]*(?:critical|high)[^\n]*(?:fix|remediat|resolv)/i;
  return reductionPattern.test(text);
}

function archivedRepositoryPosture(output) {
  try {
    const metadata = JSON.parse(output);
    return metadata?.archived === true;
  } catch {
    return false;
  }
}

function minioCandidateIds(candidates) {
  return candidates
    .filter((candidate) => candidate.id?.startsWith("minio-") || candidate.serviceName === "minio")
    .map((candidate) => candidate.id);
}

function minioSourceStatus({ posture, commandResults }) {
  const result = commandResults.find((commandResult) => commandResult.id === "minio-source-tags");
  if (!result || result.status !== 0) {
    return {
      checked: false,
      current: false,
      currentVersion: posture.minio?.version ?? null,
      latestVersion: null,
    };
  }

  const tags = sourceTagsFromLsRemote(result.stdout);
  const latestVersion = latestSourceTag(tags, result.sourceProbe?.kind ?? "minio") ?? null;
  const currentVersion = posture.minio?.version ?? null;
  return {
    checked: true,
    current: latestVersion === currentVersion,
    currentVersion,
    latestVersion,
  };
}

function minioSourceOnlyStatus(commandResults) {
  const currentSourceManifestIds = commandResults
    .filter(
      (result) => result.id.startsWith("minio-") && result.id.endsWith("current-source-manifest"),
    )
    .filter((result) => result.status === 0)
    .map((result) => result.id);
  return {
    sourceOnly: currentSourceManifestIds.length === 0,
    currentSourceManifestIds,
  };
}

function minioScoutCriticalHigh(scout) {
  const quickview = scout.minio?.quickview ?? null;
  return {
    quickview,
    critical: quickview?.critical ?? null,
    high: quickview?.high ?? null,
  };
}

function acceptedMinioResidualBasis(minioHardening) {
  return [
    "local and self-host Compose MinIO services use read-only root filesystems and /tmp tmpfs",
    "MinIO source tag is current",
    "official current-source container manifests are unavailable",
    "no same-contract MinIO remediation candidate was reported",
    "Docker, Scout, registry, and source probes completed",
  ];
}

function annotateAcceptedResidual(finding, minioHardening) {
  return {
    ...finding,
    basis: acceptedMinioResidualBasis(minioHardening),
  };
}

export function assessWatchResults({ posture, commandResults, minioHardening }) {
  const candidates = [];
  const blockers = [];
  const readinessFindings = [];
  const scout = {};

  for (const result of commandResults) {
    if (result.status !== 0 && !failureWasAllowed(result)) {
      blockers.push({
        id: result.id,
        status: result.status,
        signal: result.signal,
        error: result.error,
        stderrPath: result.stderrPath,
      });
      continue;
    }

    if (result.registryProbe && result.status === 0) {
      const digest = extractManifestDigest(outputText(result));
      if (
        result.registryProbe.candidateWhenDigestDiffersFrom &&
        digest &&
        digest !== result.registryProbe.candidateWhenDigestDiffersFrom
      ) {
        candidates.push({
          id: result.id,
          kind: "registry-manifest-drift",
          image: result.registryProbe.image,
          currentDigest: result.registryProbe.candidateWhenDigestDiffersFrom,
          observedDigest: digest,
        });
      }
      if (result.registryProbe.candidateWhenPresent) {
        candidates.push({
          id: result.id,
          kind: "same-contract-registry-tag-published",
          image: result.registryProbe.image,
          observedDigest: digest,
        });
      }
    }

    if (result.sourceProbe && result.status === 0) {
      const tags = sourceTagsFromLsRemote(result.stdout);
      const latest = latestSourceTag(tags, result.sourceProbe.kind);
      const serviceName = result.id.split("-")[0];
      const current = posture[serviceName].version;
      if (sourceTagIsNewer(latest, current, result.sourceProbe.kind)) {
        candidates.push({
          id: result.id,
          kind: "newer-upstream-source-tag",
          current,
          latest,
        });
      }
    }

    if (result.archiveProbe && result.status === 0) {
      if (archivedRepositoryPosture(result.stdout)) {
        readinessFindings.push({
          id: result.id,
          serviceName: "minio",
          kind: "archived-upstream-source",
          repository: result.archiveProbe.repository,
          detail:
            "Bundled MinIO cannot clear private-pilot readiness while the upstream source repository is archived.",
        });
      }
    }

    const quickviewMatch = result.id.match(/^(.+)-scout-quickview$/);
    if (quickviewMatch && result.status === 0) {
      const counts = quickviewCounts(result.stdout);
      scout[quickviewMatch[1]] = {
        ...(scout[quickviewMatch[1]] ?? {}),
        quickview: counts,
      };
      if (quickviewMatch[1] === "minio" && counts && counts.critical + counts.high > 0) {
        readinessFindings.push({
          id: result.id,
          serviceName: "minio",
          kind: "critical-high-cves",
          critical: counts.critical,
          high: counts.high,
          detail: `Bundled MinIO reports ${counts.critical} critical and ${counts.high} high findings in Docker Scout quickview.`,
        });
      }
    }

    const criticalHighMatch = result.id.match(/^(.+)-scout-critical-high-cves$/);
    if (criticalHighMatch && result.status === 0) {
      const counts = criticalHighCveCounts(result.stdout);
      if (criticalHighMatch[1] === "minio" && counts && counts.critical + counts.high > 0) {
        readinessFindings.push({
          id: result.id,
          serviceName: "minio",
          kind: "critical-high-cves",
          critical: counts.critical,
          high: counts.high,
          detail: `Bundled MinIO reports ${counts.critical} critical and ${counts.high} high findings in Docker Scout CVE evidence.`,
        });
      }
    }

    const recommendationMatch = result.id.match(/^(.+)-scout-recommendations$/);
    if (recommendationMatch && result.status === 0) {
      const serviceName = recommendationMatch[1];
      if (scoutRecommendationNeedsReview(result.stdout)) {
        candidates.push({
          id: result.id,
          kind: "scout-critical-high-recommendation",
          serviceName,
        });
      }
    }
  }

  const sourceStatus = minioSourceStatus({ posture, commandResults });
  const sourceOnlyStatus = minioSourceOnlyStatus(commandResults);
  const sameContractCandidateIds = minioCandidateIds(candidates);
  const minioHardeningAssessment = {
    ...(minioHardening ?? {
      eligible: false,
      missing: ["minio-hardening:not-evaluated"],
      files: [],
    }),
    sourceChecked: sourceStatus.checked,
    sourceCurrent: sourceStatus.current,
    currentVersion: sourceStatus.currentVersion,
    latestVersion: sourceStatus.latestVersion,
    sourceOnly: sourceOnlyStatus.sourceOnly,
    currentSourceManifestIds: sourceOnlyStatus.currentSourceManifestIds,
    sameContractCandidateIds,
    scoutCriticalHigh: minioScoutCriticalHigh(scout),
  };
  minioHardeningAssessment.acceptsBundledMinioResiduals =
    minioHardeningAssessment.eligible &&
    minioHardeningAssessment.sourceChecked &&
    minioHardeningAssessment.sourceCurrent &&
    minioHardeningAssessment.sourceOnly &&
    sameContractCandidateIds.length === 0 &&
    blockers.length === 0;

  const acceptedResiduals = minioHardeningAssessment.acceptsBundledMinioResiduals
    ? readinessFindings.map((finding) =>
        annotateAcceptedResidual(finding, minioHardeningAssessment),
      )
    : [];
  const readinessBlockers =
    acceptedResiduals.length === readinessFindings.length ? [] : readinessFindings;

  const status =
    blockers.length > 0
      ? "blocked"
      : readinessBlockers.length > 0
        ? "readiness-blocked"
        : candidates.length > 0
          ? "needs-review"
          : "passed";
  return {
    status,
    exitCode: blockers.length > 0 ? 1 : status === "passed" ? 0 : 2,
    minioHardening: minioHardeningAssessment,
    acceptedResiduals,
    readinessBlockers,
    candidates,
    blockers,
    scout,
  };
}

function gitMetadata(cwd, spawn = spawnSync) {
  const git = (args) =>
    spawn("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  const read = (args) => {
    const result = git(args);
    return result.status === 0 ? result.stdout.trim() : null;
  };
  return {
    head: read(["rev-parse", "HEAD"]),
    branch: read(["branch", "--show-current"]),
    statusShort: read(["status", "--short"]) ?? "",
  };
}

function publicCommandResult(result) {
  const { stdout, stderr, allowFailurePatterns, ...rest } = result;
  return rest;
}

function writeReadme(metadata) {
  const lines = [
    "# Open Practice Docker Residual Watch",
    "",
    `Generated: ${metadata.generatedAt}`,
    `Status: ${metadata.status}`,
    `Git branch: ${metadata.git.branch ?? "unknown"}`,
    `Git HEAD: ${metadata.git.head ?? "unknown"}`,
    "",
    "This local artifact re-checks wrapped Mailpit, MinIO, and Postgres service-image residuals only. It does not include credentials, client data, matter data, payment data, private deployment details, or raw audit exports.",
    "",
  ];

  if (metadata.candidates.length > 0) {
    lines.push("## Review Candidates", "");
    for (const candidate of metadata.candidates) {
      lines.push(`- ${candidate.id}: ${candidate.kind}`);
    }
    lines.push("");
  }

  if (metadata.readinessBlockers.length > 0) {
    lines.push("## Readiness Blockers", "");
    for (const blocker of metadata.readinessBlockers) {
      lines.push(`- ${blocker.id}: ${blocker.kind}; ${blocker.detail}`);
    }
    lines.push("");
  }

  if (metadata.acceptedResiduals.length > 0) {
    lines.push("## Accepted Residuals", "");
    for (const residual of metadata.acceptedResiduals) {
      lines.push(`- ${residual.id}: ${residual.kind}; ${residual.detail}`);
    }
    lines.push("");
  }

  if (metadata.blockers.length > 0) {
    lines.push("## Blockers", "");
    for (const blocker of metadata.blockers) {
      const detail = blocker.stderrPath
        ? `see commands/${blocker.stderrPath}`
        : (blocker.detail ?? blocker.message ?? blocker.reason ?? blocker.code ?? "see metadata");
      const label = blocker.code ?? `status ${blocker.status}`;
      lines.push(`- ${blocker.id}: ${label}; ${detail}`);
    }
    lines.push("");
  }

  const evidenceLine =
    metadata.commands.length > 0
      ? "See `docker-residual-watch.json` and `commands/*.log` for local command evidence."
      : "See `docker-residual-watch.json` for local blocker evidence.";
  lines.push(evidenceLine, "");
  writeFileSync(path.join(metadata.artifactDir, "README.md"), lines.join("\n"));
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

export function runDockerResidualWatch({
  cwd = process.cwd(),
  now = new Date(),
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  spawn = spawnSync,
} = {}) {
  const artifactDir = buildArtifactDir({ artifactRoot, now });
  const commandsDir = path.join(artifactDir, "commands");
  mkdirSync(commandsDir, { recursive: true });

  const composeTexts = {
    "docker-compose.yml": readText(cwd, "docker-compose.yml"),
    "docker-compose.selfhost.yml": readText(cwd, "docker-compose.selfhost.yml"),
  };
  const minioHardening = assessMinioComposeHardening({ composeTexts });
  const posture = collectDockerResidualPosture({
    cwd,
    composeText: composeTexts["docker-compose.yml"],
  });

  try {
    runDockerDaemonPreflight({ cwd, spawn, phase: "docker:residual-watch" });
  } catch (error) {
    const daemonBlocker = daemonBlockerFromError(error);
    if (!daemonBlocker) throw error;
    const metadata = {
      generatedAt: now.toISOString(),
      artifactDir,
      status: "blocked",
      exitCode: 1,
      git: gitMetadata(cwd, spawn),
      posture,
      minioHardening: {
        ...minioHardening,
        sourceChecked: false,
        sourceCurrent: false,
        currentVersion: posture.minio?.version ?? null,
        latestVersion: null,
        sourceOnly: false,
        currentSourceManifestIds: [],
        sameContractCandidateIds: [],
        scoutCriticalHigh: {
          quickview: null,
          critical: null,
          high: null,
        },
        acceptsBundledMinioResiduals: false,
      },
      acceptedResiduals: [],
      readinessBlockers: [],
      candidates: [],
      blockers: [daemonBlocker],
      scout: {},
      commands: [],
    };

    writeFileSync(
      path.join(artifactDir, "docker-residual-watch.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
    writeReadme(metadata);
    return metadata;
  }

  const commandSpecs = dockerResidualCommands(posture);
  const commandResults = commandSpecs.map((commandSpec) =>
    runCommand(commandSpec, { cwd, outputDir: commandsDir, spawn }),
  );
  const assessment = assessWatchResults({ posture, commandResults, minioHardening });
  const metadata = {
    generatedAt: now.toISOString(),
    artifactDir,
    status: assessment.status,
    exitCode: assessment.exitCode,
    git: gitMetadata(cwd, spawn),
    posture,
    minioHardening: assessment.minioHardening,
    acceptedResiduals: assessment.acceptedResiduals,
    readinessBlockers: assessment.readinessBlockers,
    candidates: assessment.candidates,
    blockers: assessment.blockers,
    scout: assessment.scout,
    commands: commandResults.map(publicCommandResult),
  };

  writeFileSync(
    path.join(artifactDir, "docker-residual-watch.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  writeReadme(metadata);
  return metadata;
}

function isMainModule() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  try {
    const metadata = runDockerResidualWatch();
    console.log(`Docker residual watch ${metadata.status}: ${metadata.artifactDir}`);
    if (metadata.candidates.length > 0) {
      console.log(`Review candidates: ${metadata.candidates.length}`);
    }
    if (metadata.readinessBlockers.length > 0) {
      console.error(`Readiness blockers: ${metadata.readinessBlockers.length}`);
    }
    if (metadata.acceptedResiduals.length > 0) {
      console.log(`Accepted residuals: ${metadata.acceptedResiduals.length}`);
    }
    if (metadata.blockers.length > 0) {
      console.error(`Blocked checks: ${metadata.blockers.map((blocker) => blocker.id).join(", ")}`);
    }
    process.exit(metadata.exitCode);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
