#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const BLOCKED_LICENSE_GROUPS = new Set(["", "UNKNOWN", "UNLICENSED"]);
const REVIEW_REQUIRED_LICENSE_PATTERNS = [
  /(^|\b)AGPL/i,
  /(^|\b)GPL/i,
  /LGPL/i,
  /EUPL/i,
  /CC-BY/i,
  /BlueOak/i,
  /Unlicense/i,
];

function loadLicenseReport() {
  const output = execFileSync("pnpm", ["licenses", "list", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });

  return JSON.parse(output);
}

function normalizeLicenseGroup(licenseGroup) {
  return licenseGroup.trim().toUpperCase();
}

function isBlockedLicenseGroup(licenseGroup) {
  return BLOCKED_LICENSE_GROUPS.has(normalizeLicenseGroup(licenseGroup));
}

function needsReview(licenseGroup) {
  return REVIEW_REQUIRED_LICENSE_PATTERNS.some((pattern) => pattern.test(licenseGroup));
}

function summarizeLicenseGroups(report) {
  return Object.entries(report)
    .map(([licenseGroup, packages]) => ({
      licenseGroup,
      packageCount: packages.length,
      versionCount: packages.reduce(
        (total, packageEntry) => total + packageEntry.versions.length,
        0,
      ),
      reviewRequired: needsReview(licenseGroup),
      blocked: isBlockedLicenseGroup(licenseGroup),
    }))
    .sort((left, right) => {
      if (left.blocked !== right.blocked) return left.blocked ? -1 : 1;
      if (left.reviewRequired !== right.reviewRequired) return left.reviewRequired ? -1 : 1;
      return left.licenseGroup.localeCompare(right.licenseGroup);
    });
}

function buildLicenseEvidence({ generatedAt = new Date().toISOString() } = {}) {
  const report = loadLicenseReport();
  const licenseGroups = summarizeLicenseGroups(report);
  const blockedGroups = licenseGroups.filter((entry) => entry.blocked);
  const reviewGroups = licenseGroups.filter((entry) => entry.reviewRequired && !entry.blocked);
  return {
    generatedAt,
    command: "pnpm licenses list --json",
    policy: {
      blockedLicenseGroups: [...BLOCKED_LICENSE_GROUPS],
      reviewRequiredPatterns: REVIEW_REQUIRED_LICENSE_PATTERNS.map((pattern) => pattern.source),
    },
    totals: {
      packageGroups: licenseGroups.reduce((total, entry) => total + entry.packageCount, 0),
      versions: licenseGroups.reduce((total, entry) => total + entry.versionCount, 0),
      licenseGroups: licenseGroups.length,
      blockedLicenseGroups: blockedGroups.length,
      reviewRequiredLicenseGroups: reviewGroups.length,
    },
    licenseGroups,
  };
}

function parseArgs(rawArgs) {
  const options = { json: false, outputPath: null };
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--output") {
      options.outputPath = rawArgs[index + 1];
      index += 1;
      if (!options.outputPath) throw new Error("--output requires a path");
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const evidence = buildLicenseEvidence();
  const summary = evidence.licenseGroups;
  const blockedGroups = summary.filter((entry) => entry.blocked);
  const reviewGroups = summary.filter((entry) => entry.reviewRequired && !entry.blocked);

  if (options.json || options.outputPath) {
    const json = `${JSON.stringify(evidence, null, 2)}\n`;
    if (options.outputPath) writeFileSync(options.outputPath, json);
    if (options.json) process.stdout.write(json);
  } else {
    console.log(
      `Dependency license report: ${evidence.totals.packageGroups} packages, ${evidence.totals.versions} versions.`,
    );
    console.log("License groups:");
    for (const entry of summary) {
      const marker = entry.blocked ? "blocked" : entry.reviewRequired ? "review" : "ok";
      console.log(
        `- ${entry.licenseGroup}: ${entry.packageCount} packages, ${entry.versionCount} versions (${marker})`,
      );
    }

    if (reviewGroups.length > 0) {
      console.log("Review-required license groups:");
      for (const entry of reviewGroups) console.log(`- ${entry.licenseGroup}`);
    }
  }

  if (blockedGroups.length > 0) {
    console.error("Dependency license report found blocked license groups:");
    for (const entry of blockedGroups) console.error(`- ${entry.licenseGroup}`);
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
