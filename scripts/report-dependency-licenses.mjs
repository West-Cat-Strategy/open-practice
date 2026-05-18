#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

export function loadLicenseReport() {
  const output = execFileSync("pnpm", ["licenses", "list", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });

  return JSON.parse(output);
}

export function normalizeLicenseGroup(licenseGroup) {
  return licenseGroup.trim().toUpperCase();
}

export function isBlockedLicenseGroup(licenseGroup) {
  return BLOCKED_LICENSE_GROUPS.has(normalizeLicenseGroup(licenseGroup));
}

export function needsReview(licenseGroup) {
  return REVIEW_REQUIRED_LICENSE_PATTERNS.some((pattern) => pattern.test(licenseGroup));
}

export function packageLicenseEntries(report) {
  return Object.entries(report)
    .flatMap(([licenseGroup, packages]) =>
      packages.flatMap((packageEntry) =>
        packageEntry.versions.map((version) => ({
          name: packageEntry.name,
          version,
          licenseGroup,
          reviewRequired: needsReview(licenseGroup),
          blocked: isBlockedLicenseGroup(licenseGroup),
        })),
      ),
    )
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.version.localeCompare(right.version),
    );
}

export function summarizeLicenseGroups(report) {
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

export function buildDependencyLicenseReport(report) {
  const groups = summarizeLicenseGroups(report);
  const packages = packageLicenseEntries(report);
  return {
    generatedFrom: "pnpm licenses list --json",
    totals: {
      licenseGroups: groups.length,
      packages: groups.reduce((total, entry) => total + entry.packageCount, 0),
      packageVersions: groups.reduce((total, entry) => total + entry.versionCount, 0),
      blockedGroups: groups.filter((entry) => entry.blocked).length,
      reviewRequiredGroups: groups.filter((entry) => entry.reviewRequired && !entry.blocked).length,
    },
    groups,
    packages,
  };
}

function parseArgs(rawArgs = process.argv.slice(2)) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  const options = { jsonOnly: false, jsonOutput: null };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      options.jsonOnly = true;
      continue;
    }
    if (arg === "--json-output") {
      options.jsonOutput = args[index + 1];
      index += 1;
      if (!options.jsonOutput || options.jsonOutput.startsWith("--")) {
        throw new Error("--json-output requires a path.");
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHumanReport(report) {
  console.log(
    `Dependency license report: ${report.totals.packages} packages, ${report.totals.packageVersions} versions.`,
  );
  console.log("License groups:");
  for (const entry of report.groups) {
    const marker = entry.blocked ? "blocked" : entry.reviewRequired ? "review" : "ok";
    console.log(
      `- ${entry.licenseGroup}: ${entry.packageCount} packages, ${entry.versionCount} versions (${marker})`,
    );
  }

  const reviewGroups = report.groups.filter((entry) => entry.reviewRequired && !entry.blocked);
  if (reviewGroups.length > 0) {
    console.log("Review-required license groups:");
    for (const entry of reviewGroups) console.log(`- ${entry.licenseGroup}`);
  }
}

export function runDependencyLicenseReport({
  rawArgs = process.argv.slice(2),
  loadReport = loadLicenseReport,
} = {}) {
  const options = parseArgs(rawArgs);
  const report = buildDependencyLicenseReport(loadReport());
  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (options.jsonOutput) writeFileSync(options.jsonOutput, json);

  if (options.jsonOnly) {
    process.stdout.write(json);
  } else {
    printHumanReport(report);
    if (options.jsonOutput) console.log(`Package-level license JSON: ${options.jsonOutput}`);
  }

  const blockedGroups = report.groups.filter((entry) => entry.blocked);
  if (blockedGroups.length > 0) {
    console.error("Dependency license report found blocked license groups:");
    for (const entry of blockedGroups) console.error(`- ${entry.licenseGroup}`);
    process.exitCode = 1;
  }

  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runDependencyLicenseReport();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
