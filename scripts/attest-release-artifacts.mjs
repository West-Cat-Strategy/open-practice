#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { commandAvailable, toolingTimestamp, writeJsonReport } from "./optional-tooling.mjs";

const DEFAULT_ARTIFACT_ROOT = ".tmp/release-attest";

function parseArgs(rawArgs = process.argv.slice(2)) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let artifact = null;
  let key = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--artifact") {
      artifact = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--key") {
      key = args[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { artifact, key };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs();
    const artifactDir = path.resolve(DEFAULT_ARTIFACT_ROOT, toolingTimestamp());
    mkdirSync(artifactDir, { recursive: true });
    const cosign = commandAvailable("cosign");
    const report = {
      generatedAt: new Date().toISOString(),
      artifactDir,
      scope: "local_release_artifact_attestation",
      status: "skipped",
      command: "cosign",
      skippedReason: null,
    };

    if (!cosign.available) {
      report.skippedReason = "cosign is not installed locally.";
    } else if (!options.artifact || !existsSync(options.artifact)) {
      report.skippedReason = "Pass --artifact <path> to sign a local release artifact.";
    } else if (!options.key) {
      report.skippedReason =
        "Pass --key <local-key-path-or-env://COSIGN_PRIVATE_KEY>. No transparency-log publication is attempted by default.";
    } else {
      const bundlePath = path.join(artifactDir, `${path.basename(options.artifact)}.bundle`);
      const result = spawnSync(
        "cosign",
        [
          "sign-blob",
          "--yes",
          "--tlog-upload=false",
          "--key",
          options.key,
          "--bundle",
          bundlePath,
          options.artifact,
        ],
        { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
      );
      const stdoutPath = path.join(artifactDir, "cosign.stdout.log");
      const stderrPath = path.join(artifactDir, "cosign.stderr.log");
      writeFileSync(stdoutPath, result.stdout ?? "");
      writeFileSync(stderrPath, result.stderr ?? "");
      Object.assign(report, {
        status: result.status === 0 ? "passed" : "failed",
        artifact: options.artifact,
        bundlePath,
        exitStatus: result.status ?? 1,
        stdoutPath: path.relative(artifactDir, stdoutPath),
        stderrPath: path.relative(artifactDir, stderrPath),
      });
    }

    writeJsonReport(path.join(artifactDir, "release-attest.json"), report);
    console.log(`Release attestation ${report.status}: ${artifactDir}`);
    process.exitCode = report.status === "failed" ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
