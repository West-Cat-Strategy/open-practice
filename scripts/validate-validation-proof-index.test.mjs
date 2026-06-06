import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validationProofIndexFailures } from "./validate-validation-proof-index.mjs";

describe("validation proof index check", () => {
  it("flags orphan proof notes and missing linked notes", () => {
    const failures = validationProofIndexFailures({
      readText: () =>
        "[Proof](INDEXED.md)\n[Missing](MISSING.md)\n[Planning](../planning-and-progress.md)\n",
      listDir: () => ["README.md", "INDEXED.md", "ORPHAN.md"],
      pathExists: (file) => !file.endsWith("MISSING.md"),
    });

    assert.deepEqual(failures, [
      "docs/validation/ORPHAN.md is not linked from README.md",
      "README.md links to missing validation proof note: MISSING.md",
    ]);
  });
});
