import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SOURCE_LICENSE_SCAN_IGNORES, sourceLicenseScanArgs } from "./run-license-source-scan.mjs";

describe("source license scan wrapper", () => {
  it("ignores local evidence, dependency, cache, report, and build-output folders", () => {
    const args = sourceLicenseScanArgs({ artifactDir: "/repo/.tmp/license/scancode/run" });
    for (const ignoredPath of [
      ".git",
      ".tmp",
      ".references/oss",
      "artifacts",
      "output",
      "report",
      "reports",
      ".cache",
      "cache",
      "node_modules",
      ".pnpm-store",
      ".next",
      ".turbo",
      "dist",
      "build",
      "out",
    ]) {
      assert.ok(SOURCE_LICENSE_SCAN_IGNORES.includes(ignoredPath));
      assert.ok(args.includes(ignoredPath));
    }

    assert.deepEqual(args.slice(0, 3), ["--license", "--copyright", "--info"]);
    assert.deepEqual(args.slice(-3), [
      "--json-pp",
      "/repo/.tmp/license/scancode/run/scancode.json",
      ".",
    ]);
  });
});
