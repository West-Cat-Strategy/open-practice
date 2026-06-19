import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertSetupStatusShape } from "./docker-app-smoke.mjs";

describe("docker app smoke setup-status proof", () => {
  it("accepts setup-status JSON with boolean required and blocked fields", () => {
    assert.doesNotThrow(() => assertSetupStatusShape({ required: true, blocked: false }));
  });

  it("rejects setup-status JSON without the required boolean shape", () => {
    assert.throws(
      () => assertSetupStatusShape({ required: "true", blocked: false }),
      /boolean required and blocked/,
    );
  });
});
