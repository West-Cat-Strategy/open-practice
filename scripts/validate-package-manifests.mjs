#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

function findPackageManifests() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", ":(glob)**/package.json"],
    { encoding: "utf8" },
  );

  return output.split("\n").filter(Boolean).sort();
}

function collectLatestRanges(rootDirectory) {
  const findings = [];
  const manifests = findPackageManifests();

  for (const manifestPath of manifests) {
    const fullPath = join(rootDirectory, manifestPath);
    const manifest = JSON.parse(readFileSync(fullPath, "utf8"));

    for (const field of DEPENDENCY_FIELDS) {
      const dependencies = manifest[field];

      if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) {
        continue;
      }

      for (const [dependencyName, range] of Object.entries(dependencies)) {
        if (range !== "latest") {
          continue;
        }

        findings.push({ manifestPath, field, dependencyName });
      }
    }
  }

  return findings;
}

try {
  const findings = collectLatestRanges(process.cwd());

  if (findings.length > 0) {
    console.error('New dependency version ranges must not use "latest":');

    for (const finding of findings) {
      console.error(`- ${finding.manifestPath} ${finding.field}.${finding.dependencyName}`);
    }

    process.exit(1);
  }

  console.log("Package manifest dependency policy passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
