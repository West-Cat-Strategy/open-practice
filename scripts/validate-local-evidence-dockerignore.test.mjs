import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  missingLocalEvidenceDockerignoreEntries,
  parseDockerignoreEntries,
} from "./validate-local-evidence-dockerignore.mjs";

describe("local evidence Docker ignore validation", () => {
  it("normalizes comments and trailing slashes", () => {
    assert.deepEqual(
      parseDockerignoreEntries(".tmp/\nartifacts # local proof\nartifacts/release-local/\n"),
      new Set([".tmp", "artifacts", "artifacts/release-local"]),
    );
  });

  it("requires local proof directories to stay out of Docker context", () => {
    assert.deepEqual(missingLocalEvidenceDockerignoreEntries(".tmp\n"), [
      "artifacts",
      "artifacts/release-local",
    ]);
  });
});
