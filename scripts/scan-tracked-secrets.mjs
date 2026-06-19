#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024;
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", ".next", ".turbo", "dist"]);

export const secretPatterns = [
  {
    name: "private key",
    regex: /-----BEGIN (?:(?:RSA|OPENSSH|EC|DSA) )?PRIVATE KEY-----/g,
  },
  {
    name: "GitHub token",
    regex: /\b(?:gh[pousr]_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{22,}_[A-Za-z0-9_]{59,})\b/g,
  },
  {
    name: "AWS access key id",
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    name: "OpenAI API key",
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g,
  },
  {
    name: "Stripe live secret key",
    regex: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g,
  },
  {
    name: "Slack token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
  {
    name: "SendGrid API key",
    regex: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
  },
];

function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"]);
  return output.toString("utf8").split("\0").filter(Boolean);
}

function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

function lineAndColumn(text, index) {
  const prefix = text.slice(0, index);
  const lines = prefix.split("\n");
  return {
    line: lines.length,
    column: lines.at(-1).length + 1,
  };
}

export function scanTextForSecrets(file, text, patterns = secretPatterns) {
  const findings = [];
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      const location = lineAndColumn(text, match.index ?? 0);
      findings.push({
        file,
        line: location.line,
        column: location.column,
        type: pattern.name,
      });
    }
  }
  return findings;
}

function scanFile(file, options = {}) {
  if (!existsSync(file)) return { findings: [], skipped: [] };
  const buffer = readFileSync(file);
  if (isBinary(buffer)) return { findings: [], skipped: [] };
  if (buffer.length > MAX_TEXT_FILE_BYTES && !options.scanLargeFiles) {
    return {
      findings: [],
      skipped: [{ file, reason: "large_file", sizeBytes: buffer.length }],
    };
  }
  return { findings: scanTextForSecrets(file, buffer.toString("utf8")), skipped: [] };
}

function collectFilesFromPath(inputPath) {
  if (!existsSync(inputPath)) return [];
  const stat = statSync(inputPath);
  if (stat.isFile()) return [inputPath];
  if (!stat.isDirectory()) return [];

  const files = [];
  for (const entry of readdirSync(inputPath)) {
    if (SKIPPED_DIRECTORIES.has(entry)) continue;
    files.push(...collectFilesFromPath(path.join(inputPath, entry)));
  }
  return files;
}

export function scanSecretPaths(paths, options = {}) {
  const findings = [];
  const skipped = [];
  for (const inputPath of paths) {
    for (const file of collectFilesFromPath(inputPath)) {
      const result = scanFile(file, options);
      findings.push(...result.findings);
      skipped.push(...result.skipped);
    }
  }
  return { findings, skipped };
}

function parseArgs(rawArgs = process.argv.slice(2)) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  const explicitPaths = [];
  let failOnSkipped = false;
  let scanLargeFiles = false;
  let jsonOutputPath = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--path") {
      const explicitPath = args[index + 1];
      index += 1;
      if (!explicitPath || explicitPath.startsWith("--")) {
        throw new Error("--path requires a file or directory.");
      }
      explicitPaths.push(explicitPath);
      continue;
    }
    if (arg === "--fail-on-skipped") {
      failOnSkipped = true;
      continue;
    }
    if (arg === "--scan-large-files") {
      scanLargeFiles = true;
      continue;
    }
    if (arg === "--json-output") {
      const outputPath = args[index + 1];
      index += 1;
      if (!outputPath || outputPath.startsWith("--")) {
        throw new Error("--json-output requires a path.");
      }
      jsonOutputPath = outputPath;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { explicitPaths, failOnSkipped, scanLargeFiles, jsonOutputPath };
}

export function buildSecretScanReport({
  explicitPaths = [],
  failOnSkipped = false,
  files = [],
  findings = [],
  generatedAt = new Date().toISOString(),
  scanLargeFiles = false,
  skipped = [],
} = {}) {
  return {
    generatedAt,
    scope:
      explicitPaths.length > 0
        ? { mode: "explicit_paths", paths: explicitPaths, pathCount: explicitPaths.length }
        : { mode: "tracked_git_files", fileCount: files.length },
    options: { failOnSkipped, scanLargeFiles },
    findings: findings.map(({ column, file, line, type }) => ({ file, line, column, type })),
    skipped: skipped.map(({ file, reason, sizeBytes }) => ({ file, reason, sizeBytes })),
  };
}

function writeJsonOutput(outputPath, report) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}

export function runSecretScan(rawArgs = process.argv.slice(2)) {
  const { explicitPaths, failOnSkipped, scanLargeFiles, jsonOutputPath } = parseArgs(rawArgs);
  const files = explicitPaths.length > 0 ? explicitPaths : trackedFiles();
  const result =
    explicitPaths.length > 0
      ? scanSecretPaths(files, { scanLargeFiles })
      : files.reduce(
          (accumulator, file) => {
            const fileResult = scanFile(file, { scanLargeFiles });
            accumulator.findings.push(...fileResult.findings);
            accumulator.skipped.push(...fileResult.skipped);
            return accumulator;
          },
          { findings: [], skipped: [] },
        );
  const { findings, skipped } = result;
  const report = buildSecretScanReport({
    explicitPaths,
    failOnSkipped,
    files,
    findings,
    scanLargeFiles,
    skipped,
  });

  if (jsonOutputPath) writeJsonOutput(jsonOutputPath, report);

  if (findings.length > 0) {
    console.error("Potential tracked secrets found:");
    for (const finding of findings) {
      console.error(`- ${finding.file}:${finding.line}:${finding.column} ${finding.type}`);
    }
    console.error("Remove the secret from tracked content and rotate it before publishing.");
    process.exitCode = 1;
    return { ...result, report };
  }

  if (skipped.length > 0) {
    console.error("Secret scan skipped files:");
    for (const skip of skipped) {
      console.error(`- ${skip.file}: ${skip.reason} (${skip.sizeBytes} bytes)`);
    }
    if (failOnSkipped) {
      console.error("Rerun with --scan-large-files or remove skipped files from the scan scope.");
      process.exitCode = 1;
      return { ...result, report };
    }
  }

  console.log(
    explicitPaths.length > 0
      ? "No high-confidence secrets found in requested paths."
      : "No high-confidence tracked secrets found.",
  );
  return { ...result, report };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runSecretScan();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
