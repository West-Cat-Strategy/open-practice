import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { commandId, parseArgs, runValidationCommands } from "./run-selected-validation.mjs";

describe("selected validation runner", () => {
  it("parses runner options separately from selector arguments", () => {
    assert.deepEqual(
      parseArgs(["--dry-run", "--artifact-root", ".tmp/custom", "--", "--files", "package.json"]),
      {
        help: false,
        artifactRoot: ".tmp/custom",
        dryRun: true,
        selectorArgs: ["--files", "package.json"],
      },
    );
  });

  it("builds stable command log ids", () => {
    assert.equal(
      commandId("pnpm --filter @open-practice/domain build", 0),
      "01-pnpm-filter-open-practice-domain-build",
    );
  });

  it("records dry-run command logs and metadata", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-verify-run-"));
    const metadata = runValidationCommands({
      artifactRoot: ".tmp/validation-runs",
      commands: ["pnpm format:check", "pnpm docs:check"],
      cwd,
      dryRun: true,
      now: new Date("2026-06-19T12:00:00Z"),
      selectorArgs: ["--files", "docs/testing/TESTING.md"],
    });

    assert.equal(metadata.status, "dry-run");
    assert.equal(metadata.commands.length, 2);
    assert.equal(
      metadata.commands.every((command) => command.skipped),
      true,
    );
    assert.equal(existsSync(path.join(metadata.artifactDir, "validation-run.json")), true);
    assert.match(
      readFileSync(path.join(metadata.artifactDir, metadata.commands[0].stdoutPath), "utf8"),
      /Dry run: pnpm format:check/,
    );
  });
});
