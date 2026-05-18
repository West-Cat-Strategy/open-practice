import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { scanSecretPaths, scanTextForSecrets } from "./scan-tracked-secrets.mjs";

const openAiKeyFixture = `sk-proj-${"1234567890abcdefghijklmnopqrstuvwxyz"}`;
const stripeLiveRestrictedKeyFixture = `rk_${"live"}_${"1234567890abcdef"}`;

describe("secret scanner", () => {
  it("reports high-confidence secret patterns with line and column", () => {
    const findings = scanTextForSecrets(
      "artifact.log",
      `safe\nOPENAI_API_KEY=${openAiKeyFixture}\n`,
    );

    assert.deepEqual(findings, [
      {
        file: "artifact.log",
        line: 2,
        column: 16,
        type: "OpenAI API key",
      },
    ]);
  });

  it("scans explicit artifact directories recursively", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "open-practice-secret-scan-"));
    const artifactDir = path.join(dir, "release");
    mkdirSync(artifactDir);
    writeFileSync(path.join(artifactDir, "safe.log"), "no secret here\n");
    writeFileSync(
      path.join(artifactDir, "unsafe.log"),
      `stripe=${stripeLiveRestrictedKeyFixture}\n`,
    );

    assert.deepEqual(scanSecretPaths([artifactDir]), [
      {
        file: path.join(artifactDir, "unsafe.log"),
        line: 1,
        column: 8,
        type: "Stripe live secret key",
      },
    ]);
  });
});
