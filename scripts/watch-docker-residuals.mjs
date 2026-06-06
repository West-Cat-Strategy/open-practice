#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ARTIFACT_ROOT = path.join(
  "/tmp",
  "codex-security-scans",
  "open-practice",
  "docker-residual-watch",
);

const SERVICE_ORDER = ["postgres", "minio", "mailpit"];
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

export function dockerResidualCommands(posture) {
  const commands = [
    command("docker-version", "docker", [
      "version",
      "--format",
      "{{.Client.Version}} {{.Server.Version}}",
    ]),
    command("docker-scout-version", "docker", ["scout", "version"]),
    command("compose-images", "docker", ["compose", "config", "--images"]),
  ];

  for (const serviceName of SERVICE_ORDER) {
    const servicePosture = posture[serviceName];
    commands.push(
      command(`${serviceName}-scout-quickview`, "docker", [
        "scout",
        "quickview",
        servicePosture.composeImage,
      ]),
      command(`${serviceName}-scout-critical-high-cves`, "docker", [
        "scout",
        "cves",
        "--only-severity",
        "critical,high",
        servicePosture.composeImage,
      ]),
      command(`${serviceName}-scout-recommendations`, "docker", [
        "scout",
        "recommendations",
        servicePosture.composeImage,
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
  }

  return commands;
}

function runCommand(commandSpec, { cwd, outputDir, spawn = spawnSync }) {
  const startedAt = new Date().toISOString();
  const result = spawn(commandSpec.command, commandSpec.args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    timeout: 120_000,
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
    stdout,
    stderr,
    stdoutPath: `${commandSpec.id}.stdout.log`,
    stderrPath: `${commandSpec.id}.stderr.log`,
    startedAt,
    finishedAt,
    registryProbe: commandSpec.registryProbe ?? null,
    sourceProbe: commandSpec.sourceProbe ?? null,
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
  const match = output.match(/(\d+)C\/(\d+)H\/(\d+)M\/(\d+)L/);
  if (!match) return null;
  return {
    critical: Number.parseInt(match[1], 10),
    high: Number.parseInt(match[2], 10),
    medium: Number.parseInt(match[3], 10),
    low: Number.parseInt(match[4], 10),
  };
}

function scoutRecommendationNeedsReview(output) {
  const text = output.trim();
  if (!text || /no recommendations/i.test(text)) return false;

  const reductionPattern =
    /\b(?:critical|high)\b[^\n]*(?:->|→|to)[^\n]*\b0\b|\b0\b[^\n]*(?:critical|high)[^\n]*(?:fix|remediat|resolv)/i;
  return reductionPattern.test(text);
}

export function assessWatchResults({ posture, commandResults }) {
  const candidates = [];
  const blockers = [];
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

    const quickviewMatch = result.id.match(/^(.+)-scout-quickview$/);
    if (quickviewMatch && result.status === 0) {
      scout[quickviewMatch[1]] = {
        ...(scout[quickviewMatch[1]] ?? {}),
        quickview: quickviewCounts(result.stdout),
      };
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

  return {
    status: blockers.length > 0 ? "blocked" : candidates.length > 0 ? "needs-review" : "passed",
    exitCode: blockers.length > 0 ? 1 : candidates.length > 0 ? 2 : 0,
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

  if (metadata.blockers.length > 0) {
    lines.push("## Blockers", "");
    for (const blocker of metadata.blockers) {
      lines.push(`- ${blocker.id}: status ${blocker.status}; see commands/${blocker.stderrPath}`);
    }
    lines.push("");
  }

  lines.push(
    "See `docker-residual-watch.json` and `commands/*.log` for local command evidence.",
    "",
  );
  writeFileSync(path.join(metadata.artifactDir, "README.md"), lines.join("\n"));
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

  const posture = collectDockerResidualPosture({ cwd });
  const commandSpecs = dockerResidualCommands(posture);
  const commandResults = commandSpecs.map((commandSpec) =>
    runCommand(commandSpec, { cwd, outputDir: commandsDir, spawn }),
  );
  const assessment = assessWatchResults({ posture, commandResults });
  const metadata = {
    generatedAt: now.toISOString(),
    artifactDir,
    status: assessment.status,
    exitCode: assessment.exitCode,
    git: gitMetadata(cwd, spawn),
    posture,
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
    if (metadata.blockers.length > 0) {
      console.error(`Blocked checks: ${metadata.blockers.map((blocker) => blocker.id).join(", ")}`);
    }
    process.exit(metadata.exitCode);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
