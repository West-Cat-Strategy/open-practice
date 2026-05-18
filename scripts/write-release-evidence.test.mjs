import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildReleaseEvidence } from "./write-release-evidence.mjs";

describe("release evidence artifact", () => {
  it("records local validation, dependency, license, and package-inventory evidence", () => {
    const evidence = buildReleaseEvidence({
      rootDir: process.cwd(),
      generatedAt: "2026-05-16T00:00:00.000Z",
    });

    assert.equal(evidence.scope, "local_release_handoff");
    assert.equal(evidence.privacy, "synthetic_metadata_only");
    assert.deepEqual(evidence.validationCommands, [
      "pnpm deps:audit",
      "pnpm deps:licenses -- --json-output <release artifact dir>/dependency-licenses.json",
      "pnpm ci:local",
      "pnpm migrations:replay",
      "pnpm security:scan -- --path <release artifact dir>",
      "git diff --check",
    ]);
    assert.match(evidence.dependencyEvidence.lockfile.sha256, /^[a-f0-9]{64}$/);
    assert.equal(evidence.sbomInventory.format, "open-practice-package-inventory-v1");
    assert.ok(evidence.sbomInventory.packages.some((item) => item.name === "@open-practice/api"));
  });
});
