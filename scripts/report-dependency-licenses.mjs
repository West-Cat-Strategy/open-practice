#!/usr/bin/env node

import { execFileSync } from "node:child_process";

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

try {
  const report = loadLicenseReport();
  const summary = summarizeLicenseGroups(report);
  const blockedGroups = summary.filter((entry) => entry.blocked);
  const reviewGroups = summary.filter((entry) => entry.reviewRequired && !entry.blocked);
  const totalPackages = summary.reduce((total, entry) => total + entry.packageCount, 0);
  const totalVersions = summary.reduce((total, entry) => total + entry.versionCount, 0);

  console.log(`Dependency license report: ${totalPackages} packages, ${totalVersions} versions.`);
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

  if (blockedGroups.length > 0) {
    console.error("Dependency license report found blocked license groups:");
    for (const entry of blockedGroups) console.error(`- ${entry.licenseGroup}`);
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
