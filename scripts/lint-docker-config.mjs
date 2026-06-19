#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { commandAvailable, toolingTimestamp, writeJsonReport } from "./optional-tooling.mjs";

const DEFAULT_ARTIFACT_ROOT = ".tmp/docker/lint";

function run(command, args, { artifactDir, cwd = process.cwd(), id }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  const stdoutPath = path.join(artifactDir, `${id}.stdout.log`);
  const stderrPath = path.join(artifactDir, `${id}.stderr.log`);
  writeFileSync(stdoutPath, result.stdout ?? "");
  writeFileSync(stderrPath, result.stderr ?? "");
  return {
    id,
    command,
    args,
    status: result.status ?? 1,
    error: result.error instanceof Error ? result.error.message : null,
    stdoutPath: path.relative(artifactDir, stdoutPath),
    stderrPath: path.relative(artifactDir, stderrPath),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const artifactDir = path.resolve(DEFAULT_ARTIFACT_ROOT, toolingTimestamp());
  mkdirSync(artifactDir, { recursive: true });
  const commands = [];
  const skipped = [];

  const hadolint = commandAvailable("hadolint");
  if (hadolint.available) {
    commands.push(
      run(
        "hadolint",
        [
          "Dockerfile",
          "docker/postgres/Dockerfile",
          "docker/minio/Dockerfile",
          "docker/mailpit/Dockerfile",
        ],
        { artifactDir, id: "hadolint" },
      ),
    );
  } else {
    skipped.push({ command: "hadolint", reason: "hadolint is not installed locally." });
  }

  const checkov = commandAvailable("checkov");
  if (checkov.available) {
    commands.push(
      run(
        "checkov",
        [
          "--quiet",
          "--framework",
          "dockerfile",
          "--framework",
          "docker_compose",
          "--directory",
          ".",
        ],
        { artifactDir, id: "checkov" },
      ),
    );
  } else {
    skipped.push({ command: "checkov", reason: "checkov is not installed locally." });
  }

  const failed = commands.filter((command) => command.status !== 0);
  const report = {
    generatedAt: new Date().toISOString(),
    artifactDir,
    scope: "local_docker_static_lint",
    status: failed.length > 0 ? "failed" : commands.length === 0 ? "skipped" : "passed",
    commands,
    skipped,
  };
  writeJsonReport(path.join(artifactDir, "docker-lint.json"), report);
  console.log(`Docker static lint ${report.status}: ${artifactDir}`);
  process.exitCode = report.status === "failed" ? 1 : 0;
}
