import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { imageArtifactId, scanDockerImages, trivyImageArgs } from "./scan-docker-images.mjs";

describe("Docker image scanner wrapper", () => {
  it("sanitizes image names for per-image artifacts", () => {
    assert.equal(
      imageArtifactId("open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4"),
      "open-practice-minio_RELEASE.2025-10-15T17-29-55Z-go1.26.4",
    );
  });

  it("builds one Trivy image command for one target image", () => {
    assert.deepEqual(trivyImageArgs("open-practice-dev-api", "/tmp/api.json"), [
      "image",
      "--scanners",
      "vuln",
      "--severity",
      "HIGH,CRITICAL",
      "--exit-code",
      "1",
      "--no-progress",
      "--format",
      "json",
      "--output",
      "/tmp/api.json",
      "open-practice-dev-api",
    ]);
  });

  it("scans images individually and records per-image evidence", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-docker-scan-"));
    const calls = [];
    const spawn = (command, args) => {
      calls.push({ command, args });
      if (args[0] === "--version") {
        return { status: 0, signal: null, stdout: "Version: 0.68.1\n", stderr: "" };
      }
      return { status: 0, signal: null, stdout: "", stderr: "" };
    };

    const report = scanDockerImages({
      artifactRoot: ".tmp/docker/trivy",
      cwd,
      images: ["open-practice-dev-api", "open-practice-dev-web"],
      now: new Date("2026-06-23T12:34:56Z"),
      spawn,
    });

    assert.equal(report.status, "passed");
    assert.equal(report.images.length, 2);
    assert.deepEqual(
      calls.filter((call) => call.args[0] === "image").map((call) => call.args.at(-1)),
      ["open-practice-dev-api", "open-practice-dev-web"],
    );
    assert.ok(existsSync(path.join(report.artifactDir, "docker-scan.json")));
    assert.equal(
      JSON.parse(readFileSync(path.join(report.artifactDir, "docker-scan.json"), "utf8")).images[0]
        .outputPath,
      "open-practice-dev-api.json",
    );
  });

  it("preserves the skipped report when Trivy is unavailable", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-docker-scan-skip-"));
    const report = scanDockerImages({
      cwd,
      images: ["open-practice-dev-api"],
      now: new Date("2026-06-23T12:34:56Z"),
      spawn: () => ({ status: 1, signal: null, stdout: "", stderr: "missing" }),
    });

    assert.equal(report.status, "skipped");
    assert.match(report.skippedReason, /trivy is not installed locally/);
  });
});
