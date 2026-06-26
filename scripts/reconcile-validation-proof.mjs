#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  formatRecommendedCommands,
  normalizePaths,
  parseArgs as parseSelectorArgs,
  resolveInputFiles,
  selectCommands,
} from "./select-validation.mjs";

const PATH_PATTERN =
  /(?:^|[\s`])((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+|(?:README|CONTRIBUTING)\.md|Dockerfile|docker-compose(?:\.[A-Za-z0-9_.-]+)?\.ya?ml|\.gitignore|\.dockerignore|\.env\.example|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json)(?=$|[\s`,])/g;

export function usage() {
  return [
    "Usage:",
    "  node scripts/reconcile-validation-proof.mjs --proof <path> [--strict] --files <paths...>",
    "  node scripts/reconcile-validation-proof.mjs --proof <path> [--strict] --dirty",
    "  node scripts/reconcile-validation-proof.mjs --proof <path> [--strict] --base <git-ref>",
    "  node scripts/reconcile-validation-proof.mjs --proof <path> [--strict] --base-plus-dirty <git-ref>",
  ].join("\n");
}

export function parseArgs(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  const proofIndex = args.indexOf("--proof");
  if (proofIndex < 0) throw new Error("--proof requires a proof note path.");
  const proofPath = args[proofIndex + 1];
  if (!proofPath || proofPath.startsWith("--")) {
    throw new Error("--proof requires a proof note path.");
  }
  const selectorArgs = [...args.slice(0, proofIndex), ...args.slice(proofIndex + 2)];
  return { proofPath, selectorOptions: parseSelectorArgs(selectorArgs) };
}

function extractHeadingSection(text, headingPattern) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start < 0) return "";
  const section = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,6}\s+/.test(lines[index])) break;
    section.push(lines[index]);
  }
  return section.join("\n");
}

export function extractPathList(text) {
  const section =
    extractHeadingSection(text, /^#{1,6}\s+Final Changed Paths?\b/i) ||
    extractHeadingSection(text, /^#{1,6}\s+Final Path Set\b/i) ||
    extractHeadingSection(text, /^#{1,6}\s+Changed Paths?\b/i);

  if (!section) return [];

  const paths = [];
  for (const match of section.matchAll(PATH_PATTERN)) {
    paths.push(match[1]);
  }
  return normalizePaths(paths);
}

function hasSelectorEvidence(text) {
  return (
    /\b(?:pnpm verify:select|node scripts\/select-validation\.mjs)\b/.test(text) &&
    /Recommended validation commands:/i.test(text)
  );
}

function hasPrivacyEvidence(text) {
  return (
    /synthetic/i.test(text) && /(privacy|private|matter|client|credential|boundary)/i.test(text)
  );
}

function skippedOrBlockedWithoutReason(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => /\b(?:skipped|blocked)\b/i.test(line))
    .filter(
      (line) =>
        !/\b(?:reason|because|unavailable|blocked by|not available|no .*available|none)\b/i.test(
          line,
        ),
    );
}

export function validateProof({ proofText, actualPaths, expectedCommands }) {
  const failures = [];
  const proofPaths = extractPathList(proofText);
  const normalizedActualPaths = normalizePaths(actualPaths);

  if (proofPaths.length === 0) {
    failures.push("Proof note is missing a parseable final changed paths section.");
  } else if (proofPaths.join("\n") !== normalizedActualPaths.join("\n")) {
    failures.push(
      [
        "Proof final changed paths do not match actual paths.",
        `Expected:\n${normalizedActualPaths.join("\n") || "(none)"}`,
        `Found:\n${proofPaths.join("\n") || "(none)"}`,
      ].join("\n"),
    );
  }

  if (!hasSelectorEvidence(proofText)) {
    failures.push("Proof note is missing selector command/output evidence.");
  }

  for (const command of expectedCommands) {
    if (!proofText.includes(command)) {
      failures.push(`Proof note is missing selected validation command: ${command}`);
    }
  }

  const skippedFailures = skippedOrBlockedWithoutReason(proofText);
  if (skippedFailures.length > 0) {
    failures.push(
      `Proof note has skipped/blocked checks without an explicit reason: ${skippedFailures.join(" | ")}`,
    );
  }

  if (!hasPrivacyEvidence(proofText)) {
    failures.push("Proof note is missing synthetic data and privacy/boundary language.");
  }

  return { failures, proofPaths, actualPaths: normalizedActualPaths, expectedCommands };
}

export function reconcileValidationProof({
  proofPath,
  selectorOptions,
  cwd = process.cwd(),
  exec,
  readText = (file) => readFileSync(file, "utf8"),
} = {}) {
  const inputFiles = resolveInputFiles(selectorOptions, exec);
  const actualPaths = normalizePaths(inputFiles, cwd);
  const expectedCommands = selectCommands(actualPaths, { strict: selectorOptions.strict });
  const proofText = readText(path.resolve(cwd, proofPath));
  return validateProof({ proofText, actualPaths, expectedCommands });
}

export function formatReport(result) {
  const lines = [
    "Validation proof reconciliation:",
    `Paths: ${result.actualPaths.length}`,
    formatRecommendedCommands(result.expectedCommands),
  ];
  if (result.failures.length === 0) {
    lines.push("Result: passed");
  } else {
    lines.push("Result: failed", ...result.failures.map((failure) => `- ${failure}`));
  }
  return lines.join("\n");
}

export function runCli(rawArgs = process.argv.slice(2)) {
  const options = parseArgs(rawArgs);
  const result = reconcileValidationProof(options);
  console.log(formatReport(result));
  if (result.failures.length > 0) process.exitCode = 1;
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  }
}
