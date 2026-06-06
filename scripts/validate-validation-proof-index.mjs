#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VALIDATION_DIR = path.join("docs", "validation");
const VALIDATION_INDEX = path.join(VALIDATION_DIR, "README.md");

function markdownLinks(text) {
  const links = [];
  const pattern = /(?<!!)\[[^\]]+\]\(([^)#]+\.md)(?:#[^)]+)?\)/g;
  for (const match of text.matchAll(pattern)) {
    const target = match[1].replace(/^\.\//, "");
    if (target.includes("/")) continue;
    links.push(path.basename(target));
  }
  return links;
}

export function validationProofIndexFailures({
  readText = (file) => readFileSync(file, "utf8"),
  listDir = (dir) => readdirSync(dir),
  pathExists = (file) => existsSync(file),
} = {}) {
  if (!pathExists(VALIDATION_INDEX)) {
    return [`Missing validation index: ${VALIDATION_INDEX}`];
  }
  const indexed = new Set(markdownLinks(readText(VALIDATION_INDEX)));
  const proofNotes = listDir(VALIDATION_DIR)
    .filter((entry) => entry.endsWith(".md") && entry !== "README.md")
    .sort();
  const failures = [];
  for (const note of proofNotes) {
    if (!indexed.has(note)) failures.push(`docs/validation/${note} is not linked from README.md`);
  }
  for (const note of indexed) {
    if (note !== "README.md" && !pathExists(path.join(VALIDATION_DIR, note))) {
      failures.push(`README.md links to missing validation proof note: ${note}`);
    }
  }
  return failures;
}

export function runValidationProofIndexValidation() {
  const failures = validationProofIndexFailures();
  if (failures.length > 0) {
    console.error("Validation proof index check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return failures;
  }
  console.log("Validation proof index check passed.");
  return [];
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  runValidationProofIndexValidation();
}
