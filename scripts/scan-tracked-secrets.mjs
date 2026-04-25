#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024;

const patterns = [
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

const findings = [];

for (const file of trackedFiles()) {
  const buffer = readFileSync(file);
  if (buffer.length > MAX_TEXT_FILE_BYTES || isBinary(buffer)) continue;

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

if (findings.length > 0) {
  console.error("Potential tracked secrets found:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line}:${finding.column} ${finding.type}`);
  }
  console.error("Remove the secret from tracked content and rotate it before publishing.");
  process.exit(1);
}

console.log("No high-confidence tracked secrets found.");
