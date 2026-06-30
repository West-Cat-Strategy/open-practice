import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  commandId,
  formatValidationPlan,
  parseArgs,
  runCli,
  runValidationCommands,
} from "./run-selected-validation.mjs";

describe("selected validation runner", () => {
  it("parses runner options separately from selector arguments", () => {
    assert.deepEqual(
      parseArgs(["--dry-run", "--artifact-root", ".tmp/custom", "--", "--files", "package.json"]),
      {
        help: false,
        artifactRoot: ".tmp/custom",
        dryRun: true,
        plan: false,
        selectorArgs: ["--files", "package.json"],
      },
    );
  });

  it("parses print-only planner mode separately from selector arguments", () => {
    assert.deepEqual(parseArgs(["--plan", "--files", "docs/testing/TESTING.md"]), {
      help: false,
      artifactRoot: ".tmp/validation-runs",
      dryRun: false,
      plan: true,
      selectorArgs: ["--files", "docs/testing/TESTING.md"],
    });
  });

  it("rejects planner mode with artifact-writing runner options", () => {
    assert.throws(
      () => parseArgs(["--plan", "--dry-run", "--files", "README.md"]),
      /--plan cannot be combined with --dry-run/,
    );
    assert.throws(
      () => parseArgs(["--plan", "--artifact-root", ".tmp/custom", "--files", "README.md"]),
      /--plan cannot be combined with --artifact-root/,
    );
  });

  it("builds stable command log ids", () => {
    assert.equal(
      commandId("pnpm --filter @open-practice/domain build", 0),
      "01-pnpm-filter-open-practice-domain-build",
    );
  });

  it("formats deterministic print-only planner output", () => {
    assert.equal(
      formatValidationPlan(["pnpm format:check", "pnpm docs:check"]),
      [
        "Selected validation plan (print-only; no commands run; no artifacts written):",
        "pnpm format:check",
        "pnpm docs:check",
      ].join("\n"),
    );
    assert.equal(
      formatValidationPlan([]),
      [
        "Selected validation plan (print-only; no commands run; no artifacts written):",
        "(none)",
      ].join("\n"),
    );
  });

  it("prints selected commands without creating validation-run artifacts", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-verify-plan-"));
    const originalCwd = process.cwd();
    const originalLog = console.log;
    const messages = [];

    try {
      process.chdir(cwd);
      console.log = (message) => messages.push(message);
      assert.equal(runCli(["--plan", "--files", "docs/testing/TESTING.md"]), 0);
    } finally {
      console.log = originalLog;
      process.chdir(originalCwd);
    }

    assert.deepEqual(messages, [
      [
        "Selected validation plan (print-only; no commands run; no artifacts written):",
        "pnpm format:check",
        "pnpm docs:check",
        "pnpm policy:check",
      ].join("\n"),
    ]);
    assert.equal(existsSync(path.join(cwd, ".tmp", "validation-runs")), false);
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
