import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_GITLEAKS_IGNORE_PATH,
  gitleaksHistoryScanArgs,
  parseArgs,
} from "./run-gitleaks-history-scan.mjs";

describe("gitleaks history scan wrapper", () => {
  it("uses the reviewed fingerprint ignore file explicitly", () => {
    const args = gitleaksHistoryScanArgs({ artifactDir: "/repo/.tmp/security/gitleaks/run" });

    assert.deepEqual(args, [
      "detect",
      "--source",
      ".",
      "--redact",
      "--no-banner",
      "--gitleaks-ignore-path",
      DEFAULT_GITLEAKS_IGNORE_PATH,
      "--report-format",
      "json",
      "--report-path",
      "/repo/.tmp/security/gitleaks/run/gitleaks-report.json",
    ]);
  });

  it("parses only the artifact root option", () => {
    assert.deepEqual(parseArgs(["--artifact-root", ".tmp/custom-gitleaks"]), {
      artifactRoot: ".tmp/custom-gitleaks",
    });
    assert.throws(() => parseArgs(["--artifact-root"]), /--artifact-root requires a path/);
    assert.throws(() => parseArgs(["--unknown"]), /Unknown argument: --unknown/);
  });
});
