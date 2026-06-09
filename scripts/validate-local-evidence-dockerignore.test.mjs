import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  missingLocalEvidenceDockerignoreEntries,
  parseDockerignoreEntries,
} from "./validate-local-evidence-dockerignore.mjs";

describe("local evidence Docker ignore validation", () => {
  it("normalizes comments and trailing slashes", () => {
    assert.deepEqual(
      parseDockerignoreEntries(".tmp/\nartifacts # local proof\nartifacts/release-local/\n.ssh/\n"),
      new Set([".tmp", "artifacts", "artifacts/release-local", ".ssh"]),
    );
  });

  it("requires local proof and credential directories to stay out of Docker context", () => {
    assert.deepEqual(missingLocalEvidenceDockerignoreEntries(".tmp\n"), [
      ".aws",
      ".netrc",
      ".npmrc",
      ".pnpmrc",
      ".secrets",
      ".ssh",
      ".yarnrc",
      "artifacts",
      "artifacts/release-local",
      "output",
    ]);
  });
});
