import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COMMANDS,
  changedFilesFromDirty,
  normalizePath,
  normalizePaths,
  parseArgs,
  runSelector,
  selectCommands,
} from "./select-validation.mjs";

describe("select-validation contract", () => {
  it("keeps command selection deterministic and de-duplicated", () => {
    assert.deepEqual(
      selectCommands([
        "docs/testing/TESTING.md",
        "scripts/select-validation.mjs",
        "scripts/select-validation.mjs",
      ]),
      [COMMANDS.formatCheck, COMMANDS.docsCheck, COMMANDS.policyCheck, COMMANDS.test],
    );
  });

  it("normalizes explicit path lists", () => {
    assert.equal(normalizePath("/repo/apps/api/src/server.ts", "/repo"), "apps/api/src/server.ts");
    assert.deepEqual(
      normalizePaths([
        ".\\apps\\web\\app\\page.tsx",
        "./docs/testing/TESTING.md",
        "docs/testing/TESTING.md",
      ]),
      ["apps/web/app/page.tsx", "docs/testing/TESTING.md"],
    );
  });

  it("preserves legacy unknown-path behavior unless strict mode is requested", () => {
    assert.deepEqual(selectCommands(["README.md"]), []);
    assert.throws(
      () => selectCommands(["README.md"], { strict: true }),
      /No validation mapping for path\(s\): README\.md/,
    );
  });

  it("routes runtime configuration changes through docs, policy, and build checks", () => {
    assert.deepEqual(selectCommands(["docker-compose.yml", "docker/prod/Caddyfile"]), [
      COMMANDS.formatCheck,
      COMMANDS.docsCheck,
      COMMANDS.policyCheck,
      COMMANDS.build,
    ]);
  });

  it("parses dirty and strict modes", () => {
    assert.deepEqual(parseArgs(["--strict", "--dirty"]), {
      mode: "dirty",
      base: null,
      files: null,
      strict: true,
    });
  });

  it("selects commands from staged, unstaged, and untracked dirty files", () => {
    const exec = (_command, args) => {
      const key = args.join(" ");
      if (key === "diff --name-only") return "scripts/select-validation.mjs\n";
      if (key === "diff --name-only --cached") return "docs/testing/TESTING.md\n";
      if (key === "ls-files --others --exclude-standard") return "apps/web/app/new-panel.tsx\n";
      throw new Error(`unexpected git args: ${key}`);
    };

    assert.deepEqual(changedFilesFromDirty(exec), [
      "scripts/select-validation.mjs",
      "docs/testing/TESTING.md",
      "apps/web/app/new-panel.tsx",
    ]);
    assert.deepEqual(runSelector(["--dirty"], { cwd: "/repo", exec }), [
      COMMANDS.formatCheck,
      COMMANDS.docsCheck,
      COMMANDS.policyCheck,
      COMMANDS.test,
      COMMANDS.webTest,
      COMMANDS.webTypecheck,
      COMMANDS.build,
    ]);
  });
});
