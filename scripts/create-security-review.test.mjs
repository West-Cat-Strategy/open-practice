import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
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
      selectorInput: { mode: "dirty", args: ["--dirty"] },
    });
    assert.deepEqual(parseArgs(["--base", "origin/main"]).selectorInput, {
      mode: "base",
      args: ["--base", "origin/main"],
      base: "origin/main",
    });
    assert.deepEqual(parseArgs(["--base-plus-dirty", "origin/main"]).selectorInput, {
      mode: "base-plus-dirty",
      args: ["--base-plus-dirty", "origin/main"],
      base: "origin/main",
    });
    assert.deepEqual(parseArgs(["--files", "scripts/create-security-review.mjs"]).selectorInput, {
      mode: "files",
      args: ["--files", "scripts/create-security-review.mjs"],
      files: ["scripts/create-security-review.mjs"],
    });
    assert.throws(() => parseArgs(["--artifact-root"]), /--artifact-root requires a path/);
    assert.throws(() => parseArgs(["--dirty", "--base", "origin/main"]), /at most one/);
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
    assert.deepEqual(commands[0].args, ["verify:select", "--", "--dirty"]);
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
    assert.equal(
      commands.some((command) => command.id === "release-attest"),
      false,
    );
    assert.equal(
      commands.some((command) => command.args.includes("cosign")),
      false,
    );
  });

  it("passes explicit selector input through the changed-path selector", () => {
    const commands = securityReviewCommands({
      artifactDir: "/repo/.tmp/security/run",
      selectorArgs: ["--base-plus-dirty", "origin/main"],
    });
    assert.deepEqual(commands[0].args, ["verify:select", "--", "--base-plus-dirty", "origin/main"]);
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
    assert.deepEqual(metadata.evidenceSummary.selectorInput, {
      mode: "dirty",
      args: ["--dirty"],
    });
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

  it("normalizes evidence summaries from generated review artifacts", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-security-review-summary-"));
    writeMinimalRepo(cwd);
    const optionalArtifacts = {
      "security:secrets-history": {
        label: "Gitleaks history scan review-required",
        dir: path.join(cwd, ".tmp/security/gitleaks/2026-06-19T12-34-56Z"),
        report: "secrets-history.json",
        body: {
          status: "failed",
        },
      },
      "security:privacy-rules": {
        label: "Semgrep privacy rules skipped",
        dir: path.join(cwd, ".tmp/security/semgrep-privacy/2026-06-19T12-34-56Z"),
        report: "privacy-rules.json",
        body: {
          status: "skipped",
          skippedReason:
            "semgrep is not installed locally; install it to run OP-specific privacy/security policy rules.",
        },
      },
      "deps:osv": {
        label: "OSV advisory scan skipped",
        dir: path.join(cwd, ".tmp/security/osv/2026-06-19T12-34-56Z"),
        report: "osv-review.json",
        body: {
          status: "skipped",
          skippedReason:
            "osv-scanner is not installed locally; install it to run the optional OSV advisory scan.",
        },
      },
      "license:scan": {
        label: "Source license scan skipped",
        dir: path.join(cwd, ".tmp/license/scancode/2026-06-19T12-34-56Z"),
        report: "license-source-scan.json",
        body: {
          status: "skipped",
          skippedReason:
            "scancode is not installed locally; install ScanCode Toolkit to run the optional copied-source/license-text scan.",
        },
      },
      "docker:lint": {
        label: "Docker static lint skipped",
        dir: path.join(cwd, ".tmp/docker/lint/2026-06-19T12-34-56Z"),
        report: "docker-lint.json",
        body: {
          status: "skipped",
          skipped: [
            { command: "hadolint", reason: "hadolint is not installed locally." },
            { command: "checkov", reason: "checkov is not installed locally." },
          ],
        },
      },
      "docker:scan": {
        label: "Docker image scan skipped",
        dir: path.join(cwd, ".tmp/docker/trivy/2026-06-19T12-34-56Z"),
        report: "docker-scan.json",
        body: {
          status: "skipped",
          skippedReason:
            "trivy is not installed locally; install it to run the optional local image scan after docker:app-smoke.",
        },
      },
    };
    const spawn = (command, args) => {
      if (command === "git") {
        return { status: 0, signal: null, stdout: "", stderr: "" };
      }

      const joinedArgs = args.join(" ");
      if (joinedArgs.includes("--json-output")) {
        const outputPath = args.at(-1);
        if (args.includes("security:scan")) {
          writeJson(outputPath, {
            scope: { mode: "tracked_git_files", fileCount: 42 },
            findings: [{ file: "scripts/example.mjs", line: 1, column: 1, type: "GitHub token" }],
            skipped: [{ file: "large.log", reason: "large_file", sizeBytes: 6000000 }],
          });
        }
        if (args.includes("deps:licenses")) {
          writeJson(outputPath, {
            totals: {
              licenseGroups: 5,
              packages: 12,
              packageVersions: 14,
              blockedGroups: 0,
              reviewRequiredGroups: 1,
            },
          });
        }
      }

      const script = args[0];
      const optional = optionalArtifacts[script];
      if (optional) {
        writeJson(path.join(optional.dir, optional.report), optional.body);
        return {
          status: 0,
          signal: null,
          stdout: `${optional.label}: ${optional.dir}\n`,
          stderr: "",
        };
      }

      return { status: 0, signal: null, stdout: `ok ${args.join(" ")}\n`, stderr: "" };
    };

    const metadata = createSecurityReview({
      artifactRoot: ".tmp/security",
      cwd,
      now: new Date("2026-06-19T12:34:56Z"),
      selectorInput: { mode: "files", args: ["--files", "scripts/create-security-review.mjs"] },
      spawn,
    });

    assert.equal(metadata.status, "passed");
    assert.deepEqual(metadata.evidenceSummary.selectorInput, {
      mode: "files",
      args: ["--files", "scripts/create-security-review.mjs"],
    });
    assert.deepEqual(metadata.evidenceSummary.trackedSecrets.counts, {
      findings: 1,
      skippedFiles: 1,
      scannedFiles: 42,
    });
    assert.deepEqual(metadata.evidenceSummary.dependencyLicenses.totals, {
      licenseGroups: 5,
      packages: 12,
      packageVersions: 14,
      blockedGroups: 0,
      reviewRequiredGroups: 1,
    });
    assert.equal(
      metadata.evidenceSummary.optionalScanners.find(
        (scanner) => scanner.id === "source-license-scan",
      ).artifactPath,
      ".tmp/license/scancode/2026-06-19T12-34-56Z",
    );
    assert.equal(
      metadata.evidenceSummary.optionalScanners.find(
        (scanner) => scanner.id === "secrets-history-scan",
      ).status,
      "review-required",
    );
    assert.deepEqual(
      metadata.evidenceSummary.skippedReasons
        .filter((entry) => entry.scannerId === "docker-static-lint")
        .map((entry) => entry.command),
      ["hadolint", "checkov"],
    );
    assert.equal(metadata.evidenceSummary.artifactPaths.sbom, "sbom.cdx.json");
  });
});
