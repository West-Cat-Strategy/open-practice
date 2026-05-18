#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024;

export const patterns = [
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

export function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"]);
  return output.toString("utf8").split("\0").filter(Boolean);
}

export function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

export function lineAndColumn(text, index) {
  const prefix = text.slice(0, index);
  const lines = prefix.split("\n");
  return {
    line: lines.length,
    column: lines.at(-1).length + 1,
  };
}

function scanTextFile(file, findings) {
  if (!existsSync(file)) return;

  const buffer = readFileSync(file);
  if (buffer.length > MAX_TEXT_FILE_BYTES || isBinary(buffer)) return;

  const text = buffer.toString("utf8");
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
}

function scanPath(path, findings) {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if ([".git", "node_modules", ".next", ".turbo"].includes(entry)) continue;
      scanPath(join(path, entry), findings);
    }
    return;
  }
  if (stat.isFile()) scanTextFile(path, findings);
}

export function scanTrackedSecrets() {
  const findings = [];
  for (const file of trackedFiles()) scanTextFile(file, findings);
  return findings;
}

export function scanArtifactPaths(paths) {
  const findings = [];
  for (const path of paths) scanPath(path, findings);
  return findings;
}

function parseArgs(rawArgs) {
  const artifactPaths = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--artifact") {
      const path = rawArgs[index + 1];
      index += 1;
      if (!path) throw new Error("--artifact requires a path");
      artifactPaths.push(path);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { artifactPaths };
}

function reportFindings(findings, label) {
  if (findings.length === 0) return;
  console.error(`Potential ${label} secrets found:`);
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line}:${finding.column} ${finding.type}`);
  }
}

function runCli() {
  const { artifactPaths } = parseArgs(process.argv.slice(2));
  const trackedFindings = scanTrackedSecrets();
  const artifactFindings = scanArtifactPaths(artifactPaths);
  reportFindings(trackedFindings, "tracked");
  reportFindings(artifactFindings, "artifact");

  if (trackedFindings.length > 0 || artifactFindings.length > 0) {
    console.error(
      "Remove the secret from tracked content or local artifact and rotate it before publishing.",
    );
    process.exit(1);
  }

  if (artifactPaths.length > 0) {
    console.log("No high-confidence tracked or artifact secrets found.");
  } else {
    console.log("No high-confidence tracked secrets found.");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Usage: node scripts/scan-tracked-secrets.mjs [--artifact path]");
    process.exit(1);
  }
}
