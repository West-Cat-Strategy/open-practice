#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultOutputPath = ".tmp/open-practice-release/release-evidence.json";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function packageInventory(rootDir, packagePaths) {
  return packagePaths.map((path) => {
    const manifest = readJson(join(rootDir, path));
    return {
      name: manifest.name,
      version: manifest.version,
      private: Boolean(manifest.private),
      license: manifest.license,
      path,
      dependencyNames: Object.keys(manifest.dependencies ?? {}).sort(),
      devDependencyNames: Object.keys(manifest.devDependencies ?? {}).sort(),
    };
  });
}

export function buildReleaseEvidence(input = {}) {
  const rootDir = input.rootDir ?? process.cwd();
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const packagePaths = [
    "package.json",
    "apps/api/package.json",
    "apps/web/package.json",
    "apps/worker/package.json",
    "packages/database/package.json",
    "packages/domain/package.json",
    "packages/providers/package.json",
  ];
  const lockfilePath = "pnpm-lock.yaml";

  return {
    generatedAt,
    scope: "local_release_handoff",
    privacy: "synthetic_metadata_only",
    validationCommands: [
      "pnpm deps:audit",
      "pnpm deps:licenses",
      "pnpm ci:local",
      "git diff --check",
    ],
    dependencyEvidence: {
      packageManager: readJson(join(rootDir, "package.json")).packageManager,
      lockfile: {
        path: lockfilePath,
        sha256: sha256(join(rootDir, lockfilePath)),
      },
      licenseCommand: "pnpm deps:licenses",
      auditCommand: "pnpm deps:audit",
    },
    sbomInventory: {
      format: "open-practice-package-inventory-v1",
      packages: packageInventory(rootDir, packagePaths),
    },
  };
}

export function writeReleaseEvidence(input = {}) {
  const rootDir = input.rootDir ?? process.cwd();
  const outputPath = input.outputPath ?? defaultOutputPath;
  const absoluteOutputPath = join(rootDir, outputPath);
  const evidence = buildReleaseEvidence({ rootDir, generatedAt: input.generatedAt });
  mkdirSync(dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  return { outputPath, evidence };
}

export function runCli(rawArgs = process.argv.slice(2)) {
  const outputIndex = rawArgs.indexOf("--output");
  const outputPath = outputIndex >= 0 ? rawArgs[outputIndex + 1] : defaultOutputPath;
  if (outputIndex >= 0 && !outputPath) throw new Error("--output requires a path");
  const result = writeReleaseEvidence({ outputPath });
  console.log(`Wrote ${relative(process.cwd(), join(process.cwd(), result.outputPath))}`);
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(
      `Usage: node scripts/${basename(fileURLToPath(import.meta.url))} [--output path]`,
    );
    process.exit(1);
  }
}
