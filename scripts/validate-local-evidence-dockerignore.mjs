#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const REQUIRED_LOCAL_EVIDENCE_DOCKERIGNORE_ENTRIES = [
  ".aws",
  ".netrc",
  ".npmrc",
  ".pnpmrc",
  ".secrets",
  ".ssh",
  ".yarnrc",
  ".tmp",
  "artifacts",
  "artifacts/release-local",
  "output",
];

function normalizeIgnoreEntry(entry) {
  return entry.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

export function parseDockerignoreEntries(text) {
  return new Set(
    text
      .split("\n")
      .map((line) => line.replace(/\s+#.*$/, "").trim())
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"))
      .map(normalizeIgnoreEntry),
  );
}

export function missingLocalEvidenceDockerignoreEntries(text) {
  const entries = parseDockerignoreEntries(text);
  return REQUIRED_LOCAL_EVIDENCE_DOCKERIGNORE_ENTRIES.filter(
    (required) => !entries.has(normalizeIgnoreEntry(required)),
  );
}

export function runLocalEvidenceDockerignoreValidation({
  readText = (file) => readFileSync(file, "utf8"),
} = {}) {
  const missing = missingLocalEvidenceDockerignoreEntries(readText(".dockerignore"));
  if (missing.length > 0) {
    console.error("Local evidence directories must be excluded from Docker build context:");
    for (const entry of missing) console.error(`- .dockerignore missing ${entry}`);
    process.exitCode = 1;
    return missing;
  }
  console.log("Local evidence Docker ignore validation passed.");
  return [];
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  runLocalEvidenceDockerignoreValidation();
}
