import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COMMANDS } from "./select-validation.mjs";
import {
  extractPathList,
  parseArgs,
  reconcileValidationProof,
  validateProof,
} from "./reconcile-validation-proof.mjs";

function proof({
  paths = ["docs/testing/TESTING.md", "scripts/select-validation.mjs"],
  selector = true,
  commands = [COMMANDS.formatCheck, COMMANDS.docsCheck, COMMANDS.policyCheck, COMMANDS.test],
  skippedLine = "Skipped checks: none.",
} = {}) {
  return [
    "# OP Local Tooling Proof",
    "",
    "This proof uses synthetic data only and preserves privacy, matter, client, and credential boundaries.",
    "",
    "## Final Changed Paths",
    ...paths.map((path) => `- \`${path}\``),
    "",
    "## Selector",
    selector
      ? "`pnpm verify:select -- --files docs/testing/TESTING.md scripts/select-validation.mjs`"
      : "Selector was discussed but not pasted.",
    "",
    ...(selector ? ["Recommended validation commands:", ...commands] : []),
    "",
    "## Final Validation",
    "| Command | Result | Notes |",
    "| --- | --- | --- |",
    ...commands.map((command) => `| \`${command}\` | Passed | Local check. |`),
    skippedLine,
    "",
  ].join("\n");
}

describe("reconcile-validation-proof contract", () => {
  it("parses proof path plus selector mode", () => {
    assert.deepEqual(
      parseArgs(["--proof", "docs/validation/PROOF.md", "--base-plus-dirty", "main"]),
      {
        proofPath: "docs/validation/PROOF.md",
        selectorOptions: {
          mode: "base-plus-dirty",
          base: "main",
          files: null,
          strict: false,
        },
      },
    );
  });

  it("extracts final changed paths from a proof section", () => {
    assert.deepEqual(
      extractPathList(
        proof({
          paths: [
            "docker-compose.selfhost.yml",
            "docs/testing/TESTING.md",
            "scripts/select-validation.mjs",
          ],
        }),
      ),
      ["docker-compose.selfhost.yml", "docs/testing/TESTING.md", "scripts/select-validation.mjs"],
    );
  });

  it("passes when proof paths and selected commands match the actual path set", () => {
    const result = validateProof({
      proofText: proof(),
      actualPaths: ["scripts/select-validation.mjs", "docs/testing/TESTING.md"],
      expectedCommands: [
        COMMANDS.formatCheck,
        COMMANDS.docsCheck,
        COMMANDS.policyCheck,
        COMMANDS.test,
      ],
    });

    assert.deepEqual(result.failures, []);
  });

  it("fails when proof final paths drift from the actual path set", () => {
    const result = validateProof({
      proofText: proof({ paths: ["scripts/select-validation.mjs"] }),
      actualPaths: ["scripts/select-validation.mjs", "docs/testing/TESTING.md"],
      expectedCommands: [
        COMMANDS.formatCheck,
        COMMANDS.docsCheck,
        COMMANDS.policyCheck,
        COMMANDS.test,
      ],
    });

    assert.match(result.failures.join("\n"), /Proof final changed paths do not match actual paths/);
  });

  it("fails when selector output is missing", () => {
    const result = validateProof({
      proofText: proof({ selector: false }),
      actualPaths: ["scripts/select-validation.mjs", "docs/testing/TESTING.md"],
      expectedCommands: [
        COMMANDS.formatCheck,
        COMMANDS.docsCheck,
        COMMANDS.policyCheck,
        COMMANDS.test,
      ],
    });

    assert.match(result.failures.join("\n"), /missing selector command\/output evidence/);
  });

  it("fails when a skipped check has no explicit reason", () => {
    const result = validateProof({
      proofText: proof({ skippedLine: "| `pnpm e2e:docker` | Skipped | |" }),
      actualPaths: ["scripts/select-validation.mjs", "docs/testing/TESTING.md"],
      expectedCommands: [
        COMMANDS.formatCheck,
        COMMANDS.docsCheck,
        COMMANDS.policyCheck,
        COMMANDS.test,
      ],
    });

    assert.match(result.failures.join("\n"), /skipped\/blocked checks without an explicit reason/);
  });

  it("reconciles from --files input with injected filesystem and git readers", () => {
    const result = reconcileValidationProof({
      proofPath: "docs/validation/PROOF.md",
      selectorOptions: {
        mode: "files",
        base: null,
        files: ["docs/testing/TESTING.md", "scripts/select-validation.mjs"],
        strict: false,
      },
      cwd: "/repo",
      readText: () => proof(),
    });

    assert.deepEqual(result.failures, []);
  });
});
