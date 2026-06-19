import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildSecurityReviewDir,
  createSecurityReview,
  parseArgs,
  securityReviewCommands,
  securityReviewTimestamp,
} from "./create-security-review.mjs";

function writeMinimalRepo(root) {
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@11.5.3" }));
  writeFileSync(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
}

describe("local security review artifact", () => {
  it("uses stable local artifact timestamps and parses options", () => {
    const now = new Date("2026-06-19T12:34:56.789Z");
    assert.equal(securityReviewTimestamp(now), "2026-06-19T12-34-56Z");
    assert.equal(
      buildSecurityReviewDir({ cwd: "/repo", artifactRoot: ".tmp/security", now }),
      "/repo/.tmp/security/2026-06-19T12-34-56Z",
    );
    assert.deepEqual(parseArgs(["--dry-run", "--artifact-root", ".tmp/custom"]), {
      help: false,
      artifactRoot: ".tmp/custom",
      dryRun: true,
    });
    assert.throws(() => parseArgs(["--artifact-root"]), /--artifact-root requires a path/);
  });

  it("captures the full local security command lane", () => {
    const commands = securityReviewCommands({ artifactDir: "/repo/.tmp/security/run" });
    assert.deepEqual(
      commands.map((command) => command.id),
      [
        "changed-path-selector",
        "tracked-secret-scan",
        "secrets-history-scan",
        "privacy-rule-scan",
        "lockfile-supply-chain",
        "dependency-audit",
        "osv-advisory-scan",
        "license-evidence",
        "source-license-scan",
        "cyclonedx-sbom",
        "policy-check",
        "hot-path-rescan",
        "docker-residual-watch",
        "docker-static-lint",
        "docker-image-scan",
        "artifact-secret-scan",
      ],
    );
    assert.deepEqual(commands[1].args, [
      "security:scan",
      "--",
      "--fail-on-skipped",
      "--json-output",
      "/repo/.tmp/security/run/tracked-secret-scan.json",
    ]);
    assert.deepEqual(commands.find((command) => command.id === "hot-path-rescan").args, [
      "scripts/security-hot-path-rescan.mjs",
      "--artifact-root",
      "/repo/.tmp/security/run/hot-path-rescan",
    ]);
    assert.deepEqual(commands.at(-1).args, [
      "security:scan",
      "--",
      "--path",
      "/repo/.tmp/security/run",
      "--fail-on-skipped",
      "--scan-large-files",
    ]);
  });

  it("writes dry-run evidence without spawning commands", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-security-review-dry-run-"));
    writeMinimalRepo(cwd);
    const spawn = (command) => {
      if (command === "git") {
        return { status: 0, signal: null, stdout: "", stderr: "" };
      }
      throw new Error("dry-run should not spawn commands");
    };

    const metadata = createSecurityReview({
      artifactRoot: ".tmp/security",
      cwd,
      dryRun: true,
      now: new Date("2026-06-19T12:34:56Z"),
      spawn,
    });

    assert.equal(metadata.status, "dry-run");
    assert.equal(
      metadata.commands.every((command) => command.skipped),
      true,
    );
    assert.ok(existsSync(path.join(metadata.artifactDir, "security-review.json")));
    assert.match(
      readFileSync(
        path.join(metadata.artifactDir, "commands", "changed-path-selector.stdout.log"),
        "utf8",
      ),
      /Dry run: pnpm verify:select/,
    );
  });

  it("keeps running after failures and records failed required command ids", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-security-review-fail-"));
    writeMinimalRepo(cwd);
    const calls = [];
    const spawn = (command, args) => {
      calls.push([command, args]);
      if (command === "git") {
        return { status: 0, signal: null, stdout: "", stderr: "" };
      }
      const failed = args.includes("deps:audit");
      return {
        status: failed ? 1 : 0,
        signal: null,
        stdout: failed ? "" : `ok ${args.join(" ")}\n`,
        stderr: failed ? "audit failed\n" : "",
      };
    };

    const metadata = createSecurityReview({
      artifactRoot: ".tmp/security",
      cwd,
      now: new Date("2026-06-19T12:34:56Z"),
      spawn,
    });

    assert.equal(metadata.status, "failed");
    assert.deepEqual(metadata.failedRequiredCommandIds, ["dependency-audit"]);
    assert.equal(
      metadata.commands.filter((command) => !command.skipped).length,
      securityReviewCommands({ artifactDir: metadata.artifactDir }).length,
    );
    assert.equal(calls.filter(([command]) => command !== "git").length, metadata.commands.length);
    assert.match(metadata.lockfile.sha256, /^[a-f0-9]{64}$/);

    const saved = JSON.parse(
      readFileSync(path.join(metadata.artifactDir, "security-review.json"), "utf8"),
    );
    assert.equal(saved.privacy, "synthetic_metadata_only");
    assert.deepEqual(saved.failedRequiredCommandIds, ["dependency-audit"]);
  });
});
