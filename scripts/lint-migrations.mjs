#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DESTRUCTIVE_PATTERNS = [
  { name: "drop_table", regex: /\bDROP\s+TABLE\b/i },
  { name: "drop_column", regex: /\bDROP\s+COLUMN\b/i },
  { name: "truncate", regex: /\bTRUNCATE\b/i },
  { name: "destructive_delete", regex: /\bDELETE\s+FROM\b/i },
];

function changedMigrationFiles(exec = execFileSync) {
  const output = exec(
    "git",
    ["diff", "--name-only", "HEAD", "--", "packages/database/migrations"],
    {
      encoding: "utf8",
    },
  );
  return output
    .split("\n")
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export function lintMigrationText(file, text) {
  const findings = [];
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.regex.test(text)) {
      findings.push({
        file,
        type: pattern.name,
        message: `${file} contains ${pattern.name}; document review/rollback posture before merging.`,
      });
    }
  }
  if (/\bADD\s+COLUMN\b[\s\S]{0,160}\bNOT\s+NULL\b/i.test(text) && !/\bDEFAULT\b/i.test(text)) {
    findings.push({
      file,
      type: "not_null_without_default",
      message: `${file} adds a NOT NULL column without an obvious DEFAULT in the same migration.`,
    });
  }
  return findings;
}

export function lintMigrationFiles({ files, read = readFileSync } = {}) {
  return files.flatMap((file) => lintMigrationText(file, read(file, "utf8")));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const files = changedMigrationFiles();
    const findings = lintMigrationFiles({ files });
    if (findings.length > 0) {
      console.error("Migration lint found review-required SQL patterns:");
      for (const finding of findings) console.error(`- ${finding.type}: ${finding.message}`);
      process.exit(1);
    }
    console.log(`Migration lint passed: ${files.length} changed SQL migration file(s) reviewed.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
