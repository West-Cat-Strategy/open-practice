import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildSecretScanReport,
  runSecretScan,
  scanSecretPaths,
  scanTextForSecrets,
} from "./scan-tracked-secrets.mjs";

const openAiKeyFixture = `sk-proj-${"1234567890abcdefghijklmnopqrstuvwxyz"}`;
const stripeLiveRestrictedKeyFixture = `rk_${"live"}_${"1234567890abcdef"}`;

describe("secret scanner", () => {
  it("reports high-confidence secret patterns with line and column", () => {
    const findings = scanTextForSecrets(
      "artifact.log",
      `safe\nOPENAI_API_KEY=${openAiKeyFixture}\n`,
    );

    assert.deepEqual(findings, [
      {
        file: "artifact.log",
        line: 2,
        column: 16,
        type: "OpenAI API key",
      },
    ]);
  });

  it("scans explicit artifact directories recursively", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "open-practice-secret-scan-"));
    const artifactDir = path.join(dir, "release");
    mkdirSync(artifactDir);
    writeFileSync(path.join(artifactDir, "safe.log"), "no secret here\n");
    writeFileSync(
      path.join(artifactDir, "unsafe.log"),
      `stripe=${stripeLiveRestrictedKeyFixture}\n`,
    );

    assert.deepEqual(scanSecretPaths([artifactDir]).findings, [
      {
        file: path.join(artifactDir, "unsafe.log"),
        line: 1,
        column: 8,
        type: "Stripe live secret key",
      },
    ]);
  });

  it("reports large skipped files unless large-file scanning is requested", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "open-practice-secret-scan-"));
    const artifactDir = path.join(dir, "release");
    const largeFile = path.join(artifactDir, "large.log");
    mkdirSync(artifactDir);
    writeFileSync(largeFile, `${"x".repeat(5 * 1024 * 1024 + 1)}\n`);

    assert.deepEqual(scanSecretPaths([artifactDir]).skipped, [
      { file: largeFile, reason: "large_file", sizeBytes: 5 * 1024 * 1024 + 2 },
    ]);
    assert.deepEqual(scanSecretPaths([artifactDir], { scanLargeFiles: true }).skipped, []);
  });

  it("builds JSON reports without matched secret values", () => {
    const report = buildSecretScanReport({
      explicitPaths: ["artifact.log"],
      files: ["artifact.log"],
      findings: scanTextForSecrets("artifact.log", `token=${openAiKeyFixture}\n`),
      skipped: [],
    });

    const serialized = JSON.stringify(report);
    assert.equal(report.scope.mode, "explicit_paths");
    assert.deepEqual(report.findings, [
      {
        file: "artifact.log",
        line: 1,
        column: 7,
        type: "OpenAI API key",
      },
    ]);
    assert.equal(serialized.includes(openAiKeyFixture), false);
  });

  it("writes JSON output before returning failed findings", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "open-practice-secret-json-"));
    const artifactDir = path.join(dir, "release");
    const unsafeFile = path.join(artifactDir, "unsafe.log");
    const jsonPath = path.join(dir, "scan.json");
    mkdirSync(artifactDir);
    writeFileSync(unsafeFile, `stripe=${stripeLiveRestrictedKeyFixture}\n`);

    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    try {
      const result = runSecretScan(["--path", artifactDir, "--json-output", jsonPath]);
      assert.equal(process.exitCode, 1);
      assert.equal(result.findings.length, 1);
    } finally {
      process.exitCode = previousExitCode;
    }

    const saved = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(saved.scope.mode, "explicit_paths");
    assert.equal(saved.findings[0].type, "Stripe live secret key");
    assert.equal(JSON.stringify(saved).includes(stripeLiveRestrictedKeyFixture), false);
  });
});
