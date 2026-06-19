import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  createDependencyReview,
  dependencyReviewCommands,
  dependencyReviewTimestamp,
} from "./create-dependency-review.mjs";

describe("dependency review artifact", () => {
  it("uses stable local artifact timestamps", () => {
    assert.equal(
      dependencyReviewTimestamp(new Date("2026-06-19T12:34:56.789Z")),
      "2026-06-19T12-34-56Z",
    );
  });

  it("captures audit, outdated, license, and package-manager commands", () => {
    const commands = dependencyReviewCommands({ licenseJsonPath: "licenses.json" });
    assert.deepEqual(
      commands.map((command) => command.id),
      ["pnpm-version", "outdated", "audit-prod", "audit-dev", "license-evidence"],
    );
    assert.deepEqual(commands.at(-1).args, [
      "deps:licenses",
      "--",
      "--json-output",
      "licenses.json",
    ]);
  });

  it("writes non-gating command evidence and lockfile metadata", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-deps-review-"));
    writeFileSync(
      path.join(cwd, "package.json"),
      JSON.stringify({ packageManager: "pnpm@11.5.3" }),
    );
    writeFileSync(path.join(cwd, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

    const spawn = (_command, args) => ({
      status: args.includes("outdated") ? 1 : 0,
      signal: null,
      stdout: args.join(" "),
      stderr: "",
    });

    const metadata = createDependencyReview({
      artifactRoot: ".tmp/review",
      cwd,
      now: new Date("2026-06-19T12:34:56Z"),
      spawn,
    });

    assert.equal(metadata.packageManager, "pnpm@11.5.3");
    assert.equal(metadata.commands.find((command) => command.id === "outdated").status, 1);
    assert.match(metadata.lockfile.sha256, /^[a-f0-9]{64}$/);
    assert.ok(existsSync(path.join(metadata.artifactDir, "dependency-review.json")));
    assert.ok(existsSync(path.join(metadata.artifactDir, "README.md")));

    const saved = JSON.parse(
      readFileSync(path.join(metadata.artifactDir, "dependency-review.json"), "utf8"),
    );
    assert.equal(saved.privacy, "synthetic_metadata_only");
  });
});
