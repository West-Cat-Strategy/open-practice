#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ARTIFACT_ROOT = path.join("artifacts", "release-local");

export function releaseTimestamp(now = new Date()) {
  return now
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildReleaseArtifactDir({
  cwd,
  now = new Date(),
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
} = {}) {
  return path.resolve(cwd ?? process.cwd(), artifactRoot, releaseTimestamp(now));
}

export function releaseProofCommands({
  sbomPath,
  licenseJsonPath,
  artifactDir,
  privatePilot = false,
} = {}) {
  const commands = [
    {
      id: "changed-path-selector",
      command: "pnpm",
      args: ["verify:select", "--", "--dirty"],
      required: false,
    },
    { id: "dependency-audit", command: "pnpm", args: ["deps:audit"], required: true },
    {
      id: "license-evidence",
      command: "pnpm",
      args: [
        "deps:licenses",
        "--",
        "--json-output",
        licenseJsonPath ?? path.join(DEFAULT_ARTIFACT_ROOT, "dependency-licenses.json"),
      ],
      required: true,
    },
    {
      id: "cyclonedx-sbom",
      command: "pnpm",
      args: [
        "exec",
        "cyclonedx-npm",
        "--ignore-npm-errors",
        "--output-format",
        "JSON",
        "--output-file",
        sbomPath ?? path.join(DEFAULT_ARTIFACT_ROOT, "sbom.cdx.json"),
      ],
      env: {
        npm_config_user_agent: "npm/11.0.0 node/v26.0.0 open-practice-release-proof",
        npm_execpath: "",
      },
      required: true,
    },
    { id: "local-ci-gate", command: "pnpm", args: ["ci:local"], required: true },
    { id: "migration-replay", command: "pnpm", args: ["migrations:replay"], required: true },
  ];

  if (privatePilot) {
    commands.push({
      id: "docker-residual-watch",
      command: "pnpm",
      args: ["docker:residual-watch"],
      required: true,
    });
  }

  commands.push({
    id: "artifact-secret-scan",
    command: "pnpm",
    args: [
      "security:scan",
      "--",
      "--path",
      artifactDir ?? DEFAULT_ARTIFACT_ROOT,
      "--fail-on-skipped",
      "--scan-large-files",
    ],
    required: true,
  });

  return commands;
}

function run(command, args, { cwd, outputDir, id, env = {}, spawn = spawnSync }) {
  const startedAt = new Date().toISOString();
  const result = spawn(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
    maxBuffer: 128 * 1024 * 1024,
  });
  const finishedAt = new Date().toISOString();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  writeFileSync(path.join(outputDir, `${id}.stdout.log`), stdout);
  writeFileSync(path.join(outputDir, `${id}.stderr.log`), stderr);
  return {
    id,
    command,
    args,
    status: result.status ?? 1,
    signal: result.signal ?? null,
    error: result.error instanceof Error ? result.error.message : null,
    startedAt,
    finishedAt,
    stdoutPath: `${id}.stdout.log`,
    stderrPath: `${id}.stderr.log`,
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

export function createReleaseProof({
  cwd = process.cwd(),
  now = new Date(),
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  spawn = spawnSync,
  privatePilot = false,
} = {}) {
  const artifactDir = buildReleaseArtifactDir({ cwd, now, artifactRoot });
  const commandsDir = path.join(artifactDir, "commands");
  mkdirSync(commandsDir, { recursive: true });
  const sbomPath = path.join(artifactDir, "sbom.cdx.json");
  const licenseJsonPath = path.join(artifactDir, "dependency-licenses.json");
  const metadata = {
    generatedAt: now.toISOString(),
    privatePilot,
    artifactDir,
    git: gitMetadata(cwd, spawn),
    skippedChecks: [],
    commands: [],
  };

  for (const command of releaseProofCommands({
    sbomPath,
    licenseJsonPath,
    artifactDir,
    privatePilot,
  })) {
    const result = run(command.command, command.args, {
      cwd,
      outputDir: commandsDir,
      id: command.id,
      env: command.env,
      spawn,
    });
    metadata.commands.push({
      id: command.id,
      command: command.command,
      args: command.args,
      required: command.required,
      ...result,
    });
  }

  const failedRequired = metadata.commands.filter(
    (command) => command.required && command.status !== 0,
  );
  metadata.status = failedRequired.length > 0 ? "failed" : "passed";
  metadata.failedRequiredCommandIds = failedRequired.map((command) => command.id);

  writeFileSync(path.join(artifactDir, "release-proof.json"), JSON.stringify(metadata, null, 2));
  writeFileSync(
    path.join(artifactDir, "README.md"),
    [
      "# Open Practice Local Release Proof",
      "",
      `Generated: ${metadata.generatedAt}`,
      `Status: ${metadata.status}`,
      `Git branch: ${metadata.git.branch ?? "unknown"}`,
      `Git HEAD: ${metadata.git.head ?? "unknown"}`,
      "",
      "This local artifact records command status and dependency evidence only. It must not include environment values, credentials, client data, matter data, private deployment details, raw audit exports, or privileged document content.",
      "",
      "See `release-proof.json`, `dependency-licenses.json`, `sbom.cdx.json`, and `commands/*.log` for the captured local proof.",
      "",
    ].join("\n"),
  );

  return metadata;
}

export function parseReleaseProofArgs(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let privatePilot = false;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") return { help: true, privatePilot };
    if (arg === "--private-pilot") {
      privatePilot = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help: false, privatePilot };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/create-release-proof.mjs [--private-pilot]",
    "",
    "Private-pilot mode adds Docker residual watch as a required local release blocker gate.",
  ].join("\n");
}

function isMainModule() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  let options;
  try {
    options = parseReleaseProofArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  }
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }
  const metadata = createReleaseProof({ privatePilot: options.privatePilot });
  console.log(`Release proof ${metadata.status}: ${metadata.artifactDir}`);
  if (metadata.status !== "passed") {
    console.error(`Failed required commands: ${metadata.failedRequiredCommandIds.join(", ")}`);
    process.exit(1);
  }
}
