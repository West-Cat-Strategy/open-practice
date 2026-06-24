import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildReleaseArtifactDir,
  createReleaseProof,
  parseReleaseProofArgs,
  releaseProofCommands,
  releaseTimestamp,
} from "./create-release-proof.mjs";

describe("create-release-proof contract", () => {
  it("builds stable local artifact paths", () => {
    const now = new Date("2026-05-16T12:34:56.000Z");
    assert.equal(releaseTimestamp(now), "2026-05-16T12-34-56Z");
    assert.equal(
      buildReleaseArtifactDir({
        cwd: "/repo",
        artifactRoot: "artifacts/release-local",
        now,
      }),
      "/repo/artifacts/release-local/2026-05-16T12-34-56Z",
    );
  });

  it("keeps the SBOM command pinned to the local CycloneDX executable", () => {
    const sbomPath = "/repo/artifacts/release-local/run/sbom.cdx.json";
    const licenseJsonPath = "/repo/artifacts/release-local/run/dependency-licenses.json";
    assert.deepEqual(
      releaseProofCommands({ licenseJsonPath }).find(
        (command) => command.id === "license-evidence",
      ),
      {
        id: "license-evidence",
        command: "pnpm",
        args: ["deps:licenses", "--", "--json-output", licenseJsonPath],
        required: true,
      },
    );
    assert.deepEqual(
      releaseProofCommands({ sbomPath }).find((command) => command.id === "cyclonedx-sbom"),
      {
        id: "cyclonedx-sbom",
        command: "pnpm",
        args: [
          "exec",
          "cyclonedx-npm",
          "--ignore-npm-errors",
          "--output-format",
          "JSON",
          "--output-file",
          sbomPath,
        ],
        env: {
          npm_config_user_agent: "npm/11.0.0 node/v26.0.0 open-practice-release-proof",
          npm_execpath: "",
        },
        required: true,
      },
    );
    assert.deepEqual(
      releaseProofCommands({ sbomPath, artifactDir: "/repo/artifacts/release-local/run" }).find(
        (command) => command.id === "artifact-secret-scan",
      ),
      {
        id: "artifact-secret-scan",
        command: "pnpm",
        args: [
          "security:scan",
          "--",
          "--path",
          "/repo/artifacts/release-local/run",
          "--fail-on-skipped",
          "--scan-large-files",
        ],
        required: true,
      },
    );
  });

  it("keeps default release commands unchanged and adds the restore drill only for private pilot", () => {
    assert.equal(
      releaseProofCommands().some((command) => command.id === "selfhost-restore-drill"),
      false,
    );
    assert.deepEqual(parseReleaseProofArgs(["--private-pilot"]), {
      help: false,
      privatePilot: true,
    });
    assert.deepEqual(parseReleaseProofArgs(["--", "--private-pilot"]), {
      help: false,
      privatePilot: true,
    });
    assert.deepEqual(
      releaseProofCommands({ privatePilot: true }).find(
        (command) => command.id === "selfhost-restore-drill",
      ),
      {
        id: "selfhost-restore-drill",
        command: "pnpm",
        args: ["selfhost:restore-drill"],
        required: true,
      },
    );
  });

  it("writes partial proof and fails when a required command fails", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-release-proof-"));
    const calls = [];
    const spawn = (command, args) => {
      calls.push([command, args]);
      if (command === "git") {
        if (args[0] === "rev-parse") return { status: 0, stdout: "abc123\n", stderr: "" };
        if (args[0] === "branch") return { status: 0, stdout: "codex/test\n", stderr: "" };
        if (args[0] === "status") return { status: 0, stdout: " M package.json\n", stderr: "" };
      }
      const id = args.includes("ci:local")
        ? "local-ci-gate"
        : args.includes("migrations:replay")
          ? "migration-replay"
          : args.includes("security:scan")
            ? "artifact-secret-scan"
            : args.includes("deps:licenses")
              ? "license-evidence"
              : args.at(-1);
      return {
        status: args.includes("deps:audit") ? 1 : 0,
        stdout: `stdout for ${id}\n`,
        stderr: args.includes("deps:audit") ? "audit failed\n" : "",
      };
    };

    const metadata = createReleaseProof({
      cwd,
      now: new Date("2026-05-16T12:34:56.000Z"),
      spawn,
    });

    assert.equal(metadata.status, "failed");
    assert.deepEqual(metadata.failedRequiredCommandIds, ["dependency-audit"]);
    assert.deepEqual(calls[0], ["git", ["rev-parse", "HEAD"]]);

    const proof = JSON.parse(
      readFileSync(path.join(metadata.artifactDir, "release-proof.json"), "utf8"),
    );
    assert.equal(proof.git.branch, "codex/test");
    assert.equal(proof.commands.length, 7);
    assert.match(
      readFileSync(
        path.join(metadata.artifactDir, "commands", "dependency-audit.stderr.log"),
        "utf8",
      ),
      /audit failed/,
    );
    assert.deepEqual(proof.commands.find((command) => command.id === "license-evidence").args, [
      "deps:licenses",
      "--",
      "--json-output",
      path.join(metadata.artifactDir, "dependency-licenses.json"),
    ]);
  });

  it("records the private-pilot restore drill in release proof metadata", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-private-pilot-proof-"));
    const calls = [];
    const spawn = (command, args) => {
      calls.push([command, args]);
      if (command === "git") return { status: 0, stdout: "abc123\n", stderr: "" };
      return { status: 0, stdout: "ok\n", stderr: "" };
    };

    const metadata = createReleaseProof({
      cwd,
      now: new Date("2026-06-23T12:34:56.000Z"),
      privatePilot: true,
      spawn,
    });

    assert.equal(metadata.status, "passed");
    assert.equal(metadata.privatePilot, true);
    assert(metadata.commands.some((command) => command.id === "selfhost-restore-drill"));
    assert.deepEqual(
      calls.find((call) => call[1][0] === "selfhost:restore-drill"),
      ["pnpm", ["selfhost:restore-drill"]],
    );

    const proof = JSON.parse(
      readFileSync(path.join(metadata.artifactDir, "release-proof.json"), "utf8"),
    );
    assert.equal(proof.privatePilot, true);
    assert.equal(proof.commands.length, 8);
  });
});
