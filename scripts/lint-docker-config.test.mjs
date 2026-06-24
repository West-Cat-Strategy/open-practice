import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkovArgs, hadolintArgs } from "./lint-docker-config.mjs";

describe("docker static lint command shape", () => {
  it("records hadolint warnings without failing below error severity", () => {
    assert.deepEqual(hadolintArgs().slice(0, 2), ["--failure-threshold", "error"]);
  });

  it("uses current Checkov framework names for Docker and Compose-adjacent YAML", () => {
    assert.deepEqual(checkovArgs(), [
      "--quiet",
      "--framework",
      "dockerfile",
      "--framework",
      "yaml",
      "--directory",
      ".",
    ]);
  });
});
