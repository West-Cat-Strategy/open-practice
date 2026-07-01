import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

  it("uses the latest complete app-smoke image set when default dev image tags are absent", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-docker-scan-smoke-"));
    const calls = [];
    const spawn = (command, args) => {
      calls.push({ command, args });
      if (command === "trivy" && args[0] === "--version") {
        return { status: 0, signal: null, stdout: "Version: 0.68.1\n", stderr: "" };
      }
      if (command === "docker") {
        return {
          status: 0,
          signal: null,
          stdout: [
            "open-practice-app-smoke-222-web:latest",
            "open-practice-app-smoke-222-api:latest",
            "open-practice-app-smoke-222-worker:latest",
            "open-practice-app-smoke-111-api:latest",
            "open-practice-app-smoke-111-web:latest",
            "open-practice-postgres:18-alpine-su-exec",
            "open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4",
            "open-practice-mailpit:v1.30.3-go1.26.4",
          ].join("\n"),
          stderr: "",
        };
      }
      return { status: 0, signal: null, stdout: "", stderr: "" };
    };

    const report = scanDockerImages({
      artifactRoot: ".tmp/docker/trivy",
      cwd,
      now: new Date("2026-06-23T12:34:56Z"),
      spawn,
    });

    assert.equal(report.status, "passed");
    assert.deepEqual(
      calls
        .filter((call) => call.command === "trivy" && call.args[0] === "image")
        .map((call) => call.args.at(-1)),
      [
        "open-practice-app-smoke-222-api:latest",
        "open-practice-app-smoke-222-web:latest",
        "open-practice-app-smoke-222-worker:latest",
        "open-practice-postgres:18-alpine-su-exec",
        "open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4",
        "open-practice-mailpit:v1.30.3-go1.26.4",
      ],
    );
  });

  it("accepts MinIO-only Trivy findings when residual-watch proves bundled MinIO eligibility", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-docker-scan-minio-"));
    const spawn = (command, args) => {
      if (args[0] === "--version") {
        return { status: 0, signal: null, stdout: "Version: 0.68.1\n", stderr: "" };
      }
      if (command === "docker" && args[0] === "info") {
        return { status: 0, signal: null, stdout: "Server OK\n", stderr: "" };
      }
      const outputPath = args[args.indexOf("--output") + 1];
      writeFileSync(
        outputPath,
        JSON.stringify({
          Results: [
            {
              Vulnerabilities: [
                { VulnerabilityID: "CVE-1", Severity: "CRITICAL" },
                { VulnerabilityID: "CVE-2", Severity: "HIGH" },
              ],
            },
          ],
        }),
      );
      return { status: 1, signal: null, stdout: "", stderr: "" };
    };

    const report = scanDockerImages({
      cwd,
      images: ["open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4"],
      now: new Date("2026-06-23T12:34:56Z"),
      residualWatchRunner: () => ({
        artifactDir: "/tmp/open-practice-residual-watch",
        status: "passed",
        minioHardening: { acceptsBundledMinioResiduals: true },
        acceptedResiduals: [
          {
            id: "minio-scout-quickview",
            serviceName: "minio",
            kind: "critical-high-cves",
            basis: ["hardening proof"],
          },
        ],
      }),
      spawn,
    });

    assert.equal(report.status, "passed");
    assert.equal(report.acceptedResiduals.length, 1);
    assert.equal(report.acceptedResiduals[0].kind, "trivy-critical-high-vulnerabilities");
    assert.equal(report.residualWatch.status, "passed");
  });

  it("keeps non-MinIO Trivy findings red", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-docker-scan-api-"));
    const spawn = (command, args) => {
      if (args[0] === "--version") {
        return { status: 0, signal: null, stdout: "Version: 0.68.1\n", stderr: "" };
      }
      if (command === "docker" && args[0] === "info") {
        return { status: 0, signal: null, stdout: "Server OK\n", stderr: "" };
      }
      const outputPath = args[args.indexOf("--output") + 1];
      writeFileSync(
        outputPath,
        JSON.stringify({
          Results: [
            {
              Vulnerabilities: [{ VulnerabilityID: "CVE-1", Severity: "HIGH" }],
            },
          ],
        }),
      );
      return { status: 1, signal: null, stdout: "", stderr: "" };
    };

    const report = scanDockerImages({
      cwd,
      images: ["open-practice-dev-api"],
      now: new Date("2026-06-23T12:34:56Z"),
      residualWatchRunner: () => {
        throw new Error("residual-watch should not run for non-MinIO scan failures");
      },
      spawn,
    });

    assert.equal(report.status, "failed");
    assert.deepEqual(report.acceptedResiduals, []);
  });

  it("blocks deterministically when Trivy is available but Docker is unreachable", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-docker-scan-blocked-"));
    const calls = [];
    const spawn = (command, args) => {
      calls.push({ command, args });
      if (command === "trivy" && args[0] === "--version") {
        return { status: 0, signal: null, stdout: "Version: 0.68.1\n", stderr: "" };
      }
      if (command === "docker" && args[0] === "info") {
        return {
          status: 1,
          signal: null,
          stdout: "",
          stderr: "Cannot connect to the Docker daemon.",
        };
      }
      throw new Error(`unexpected command: ${command} ${args.join(" ")}`);
    };

    const report = scanDockerImages({
      cwd,
      images: ["open-practice-dev-api"],
      now: new Date("2026-07-01T12:34:56Z"),
      spawn,
    });

    assert.equal(report.status, "blocked");
    assert.deepEqual(report.images, []);
    assert.deepEqual(report.targetImages, ["open-practice-dev-api"]);
    assert.deepEqual(
      {
        id: report.blockers[0].id,
        kind: report.blockers[0].kind,
        code: report.blockers[0].code,
        reason: report.blockers[0].reason,
      },
      {
        id: "docker-daemon-preflight",
        kind: "local-environment",
        code: "docker_daemon_unavailable",
        reason: "docker_unreachable",
      },
    );
    assert.deepEqual(
      calls.map((call) => [call.command, call.args]),
      [
        ["trivy", ["--version"]],
        ["docker", ["info"]],
      ],
    );
    assert.equal(
      JSON.parse(readFileSync(path.join(report.artifactDir, "docker-scan.json"), "utf8")).status,
      "blocked",
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
