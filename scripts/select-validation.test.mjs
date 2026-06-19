import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COMMANDS,
  changedFilesFromBasePlusDirty,
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

  it("routes top-level maintenance files through docs and policy checks", () => {
    assert.deepEqual(selectCommands(["README.md", "CONTRIBUTING.md", ".gitignore"]), [
      COMMANDS.formatCheck,
      COMMANDS.docsCheck,
      COMMANDS.policyCheck,
    ]);
  });

  it("preserves unknown-path behavior unless strict mode is requested", () => {
    assert.deepEqual(selectCommands(["notes/random.txt"]), []);
    assert.throws(
      () => selectCommands(["notes/random.txt"], { strict: true }),
      /No validation mapping for path\(s\): notes\/random\.txt/,
    );
  });

  it("routes runtime configuration changes through docs, policy, and build checks", () => {
    assert.deepEqual(
      selectCommands([".dockerignore", "docker-compose.yml", "docker/prod/Caddyfile"]),
      [
        COMMANDS.dockerLint,
        COMMANDS.dockerResidualWatch,
        COMMANDS.dockerAppSmoke,
        COMMANDS.dockerScan,
        COMMANDS.e2eDocker,
        COMMANDS.formatCheck,
        COMMANDS.docsCheck,
        COMMANDS.policyCheck,
        COMMANDS.build,
      ],
    );
  });

  it("routes dependency manifests through audit and license evidence", () => {
    assert.deepEqual(selectCommands(["packages/domain/package.json", "pnpm-lock.yaml"]), [
      COMMANDS.ciLocal,
      COMMANDS.depsAudit,
      COMMANDS.depsLicenses,
      COMMANDS.depsSupplyChain,
      COMMANDS.depsOsv,
      COMMANDS.licenseScan,
      COMMANDS.architectureCheck,
      COMMANDS.domainTest,
      COMMANDS.domainTypecheck,
      COMMANDS.domainBuild,
    ]);
  });

  it("routes domain source changes through domain build before downstream checks", () => {
    assert.deepEqual(selectCommands(["packages/domain/src/index.ts"]), [
      COMMANDS.domainTest,
      COMMANDS.domainTypecheck,
      COMMANDS.domainBuild,
      COMMANDS.apiTest,
      COMMANDS.providersTest,
      COMMANDS.workerTest,
    ]);
  });

  it("routes Playwright and e2e harness changes through every browser lane", () => {
    assert.deepEqual(selectCommands(["playwright.config.ts", "e2e/host.spec.ts"]), [
      COMMANDS.ciLocal,
      COMMANDS.e2eHost,
      COMMANDS.e2eDocker,
      COMMANDS.e2eFirstRun,
      COMMANDS.e2eMatterless,
      COMMANDS.e2eClientPortal,
      COMMANDS.e2eA11y,
    ]);
  });

  it("routes root docs through docs and policy checks", () => {
    assert.deepEqual(selectCommands(["README.md", "CONTRIBUTING.md", "SECURITY.md"]), [
      COMMANDS.formatCheck,
      COMMANDS.docsCheck,
      COMMANDS.policyCheck,
    ]);
  });

  it("routes database migrations through the migration parity check", () => {
    assert.deepEqual(
      selectCommands([
        "packages/database/migrations/0033_saved_operational_view_matters_surface.sql",
      ]),
      [
        COMMANDS.architectureCheck,
        COMMANDS.databaseTest,
        COMMANDS.databaseCheck,
        COMMANDS.migrationsCheck,
        COMMANDS.migrationsLint,
        COMMANDS.databaseTypecheck,
        COMMANDS.databaseBuild,
        COMMANDS.apiTest,
      ],
    );
  });

  it("routes API child route modules through API and policy checks", () => {
    assert.deepEqual(selectCommands(["apps/api/src/routes/billing/controls.ts"]), [
      COMMANDS.architectureCheck,
      COMMANDS.apiContract,
      COMMANDS.policyCheck,
      COMMANDS.apiTest,
      COMMANDS.apiTypecheck,
    ]);
  });

  it("routes database repository implementation modules through database and API checks", () => {
    assert.deepEqual(
      selectCommands([
        "packages/database/src/repository/billing-controls/drizzle.ts",
        "packages/database/src/repository/billing-controls/memory.ts",
      ]),
      [
        COMMANDS.architectureCheck,
        COMMANDS.databaseTest,
        COMMANDS.databaseCheck,
        COMMANDS.migrationsCheck,
        COMMANDS.migrationsLint,
        COMMANDS.databaseTypecheck,
        COMMANDS.databaseBuild,
        COMMANDS.apiTest,
      ],
    );
  });

  it("maps the scripts directory shorthand to script validation", () => {
    assert.deepEqual(selectCommands(["scripts"]), [COMMANDS.policyCheck, COMMANDS.test]);
  });

  it("routes local security tooling changes through the security review packet", () => {
    assert.deepEqual(
      selectCommands([
        "scripts/create-security-review.mjs",
        "scripts/scan-tracked-secrets.mjs",
        "scripts/security-hot-path-rescan.mjs",
      ]),
      [
        COMMANDS.securityReview,
        COMMANDS.securitySecretsHistory,
        COMMANDS.policyCheck,
        COMMANDS.test,
      ],
    );
  });

  it("routes API contract and privacy-rule tooling through their local checks", () => {
    assert.deepEqual(
      selectCommands(["scripts/generate-api-contract.mjs", ".semgrep/open-practice.yml"]),
      [COMMANDS.securityPrivacyRules, COMMANDS.apiContract, COMMANDS.policyCheck, COMMANDS.test],
    );
  });

  it("parses dirty and strict modes", () => {
    assert.deepEqual(parseArgs(["--strict", "--dirty"]), {
      mode: "dirty",
      base: null,
      files: null,
      strict: true,
    });
  });

  it("parses base-plus-dirty mode", () => {
    assert.deepEqual(parseArgs(["--base-plus-dirty", "origin/main"]), {
      mode: "base-plus-dirty",
      base: "origin/main",
      files: null,
      strict: false,
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
      COMMANDS.architectureCheck,
      COMMANDS.formatCheck,
      COMMANDS.docsCheck,
      COMMANDS.policyCheck,
      COMMANDS.test,
      COMMANDS.webTest,
      COMMANDS.webTypecheck,
      COMMANDS.build,
    ]);
  });

  it("selects commands from base diff plus staged, unstaged, and untracked files", () => {
    const exec = (_command, args) => {
      const key = args.join(" ");
      if (key === "diff --name-only origin/main...HEAD") return "packages/domain/src/index.ts\n";
      if (key === "diff --name-only") return "scripts/select-validation.mjs\n";
      if (key === "diff --name-only --cached") return "docs/testing/TESTING.md\n";
      if (key === "ls-files --others --exclude-standard") return "README.md\n";
      throw new Error(`unexpected git args: ${key}`);
    };

    assert.deepEqual(changedFilesFromBasePlusDirty("origin/main", exec), [
      "packages/domain/src/index.ts",
      "scripts/select-validation.mjs",
      "docs/testing/TESTING.md",
      "README.md",
    ]);
    assert.deepEqual(runSelector(["--base-plus-dirty", "origin/main"], { cwd: "/repo", exec }), [
      COMMANDS.formatCheck,
      COMMANDS.docsCheck,
      COMMANDS.policyCheck,
      COMMANDS.test,
      COMMANDS.domainTest,
      COMMANDS.domainTypecheck,
      COMMANDS.domainBuild,
      COMMANDS.apiTest,
      COMMANDS.providersTest,
      COMMANDS.workerTest,
    ]);
  });
});
