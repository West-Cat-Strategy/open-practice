#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const MINIMUM_NODE_MAJOR = 24;

export function parsePackageManager(value) {
  const match = /^pnpm@(\d+\.\d+\.\d+)$/.exec(value ?? "");
  if (!match) {
    throw new Error(`packageManager must be pinned as pnpm@x.y.z; received ${value ?? "missing"}`);
  }
  return { name: "pnpm", version: match[1] };
}

export function majorVersion(version) {
  const major = Number(String(version).replace(/^v/, "").split(".")[0]);
  if (!Number.isInteger(major)) throw new Error(`Invalid semantic version: ${version}`);
  return major;
}

export function dockerPnpmVersion(dockerfile) {
  const match = dockerfile.match(/^ARG\s+PNPM_VERSION=([^\s]+)$/m);
  if (!match) throw new Error("Dockerfile must declare ARG PNPM_VERSION=<packageManager version>.");
  return match[1];
}

export function collectToolchainFailures({
  dockerfile,
  nodeVersion = process.versions.node,
  packageJson,
  pnpmVersion,
}) {
  const failures = [];
  const packageManager = parsePackageManager(packageJson.packageManager);
  const dockerVersion = dockerPnpmVersion(dockerfile);

  if (majorVersion(nodeVersion) < MINIMUM_NODE_MAJOR) {
    failures.push(`Node.js ${nodeVersion} is below the local validation floor >=24.`);
  }

  if (pnpmVersion !== packageManager.version) {
    failures.push(
      `pnpm --version (${pnpmVersion}) must match packageManager (${packageManager.version}).`,
    );
  }

  if (dockerVersion !== packageManager.version) {
    failures.push(
      `Dockerfile PNPM_VERSION (${dockerVersion}) must match packageManager (${packageManager.version}).`,
    );
  }

  return {
    failures,
    packageManager,
    nodeVersion,
    pnpmVersion,
    dockerPnpmVersion: dockerVersion,
  };
}

export function checkToolchain({
  cwd = process.cwd(),
  exec = execFileSync,
  nodeVersion = process.versions.node,
} = {}) {
  const packageJson = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
  const dockerfile = readFileSync(join(cwd, "Dockerfile"), "utf8");
  const pnpmVersion = exec("pnpm", ["--version"], { encoding: "utf8" }).trim();
  return collectToolchainFailures({ dockerfile, nodeVersion, packageJson, pnpmVersion });
}

function runCli() {
  const result = checkToolchain();
  if (result.failures.length > 0) {
    console.error("Toolchain policy validation failed:");
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(
    `Toolchain policy passed: Node.js ${result.nodeVersion}, pnpm ${result.pnpmVersion}, Dockerfile PNPM_VERSION ${result.dockerPnpmVersion}.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
