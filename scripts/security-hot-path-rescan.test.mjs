import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  HOT_PATHS,
  SOURCE_REPORT_PATH,
  buildArtifactDir,
  createSecurityHotPathRescan,
  parseArgs,
  rescanTimestamp,
  securityHotPathRescanCommands,
} from "./security-hot-path-rescan.mjs";

describe("security-hot-path-rescan contract", () => {
  it("pins the 2026-06-05 report and scoped hot paths", () => {
    assert.equal(
      SOURCE_REPORT_PATH,
      "/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/report.md",
    );
    assert.deepEqual(HOT_PATHS, [
      "apps/api/src/routes/inbound-email.ts",
      "apps/api/src/routes/calendar.ts",
      "packages/database/src/repository/drizzle.ts",
    ]);
  });

  it("builds deterministic local artifact paths", () => {
    const now = new Date("2026-06-05T21:59:20.000Z");
    assert.equal(rescanTimestamp(now), "2026-06-05T21-59-20Z");
    assert.equal(
      buildArtifactDir({
        cwd: "/repo",
        artifactRoot: ".tmp/security-hot-path-rescan",
        now,
      }),
      "/repo/.tmp/security-hot-path-rescan/2026-06-05T21-59-20Z",
    );
  });

  it("parses dry-run and artifact-root options", () => {
    assert.deepEqual(parseArgs(["--dry-run", "--artifact-root", ".tmp/custom"]), {
      help: false,
      dryRun: true,
      artifactRoot: ".tmp/custom",
    });
    assert.throws(() => parseArgs(["--artifact-root"]), /--artifact-root requires a path/);
  });

  it("runs selector, scoped scan, focused regressions, then selector gates", () => {
    assert.deepEqual(
      securityHotPathRescanCommands().map((command) => ({
        id: command.id,
        command: command.command,
        args: command.args,
      })),
      [
        {
          id: "hot-path-selector",
          command: "pnpm",
          args: ["verify:select", "--", "--files", ...HOT_PATHS],
        },
        {
          id: "scoped-secret-scan",
          command: "pnpm",
          args: ["security:scan", "--", ...HOT_PATHS.flatMap((hotPath) => ["--path", hotPath])],
        },
        {
          id: "api-hot-path-regressions",
          command: "pnpm",
          args: [
            "--filter",
            "@open-practice/api",
            "exec",
            "vitest",
            "run",
            "src/routes/inbound-email.test.ts",
            "src/routes/calendar.test.ts",
            "--pool",
            "forks",
            "--fileParallelism=false",
          ],
        },
        {
          id: "database-hot-path-regressions",
          command: "pnpm",
          args: [
            "--filter",
            "@open-practice/database",
            "exec",
            "vitest",
            "run",
            "test/repository.test.ts",
            "test/repository.inbound-email.test.ts",
            "--pool",
            "forks",
            "--fileParallelism=false",
          ],
        },
        { id: "selector-policy-check", command: "pnpm", args: ["policy:check"] },
        {
          id: "selector-database-test",
          command: "pnpm",
          args: ["--filter", "@open-practice/database", "test"],
        },
        {
          id: "selector-database-db-check",
          command: "pnpm",
          args: ["--filter", "@open-practice/database", "db:check"],
        },
        { id: "selector-migrations-check", command: "pnpm", args: ["migrations:check"] },
        {
          id: "selector-database-typecheck",
          command: "pnpm",
          args: ["--filter", "@open-practice/database", "typecheck"],
        },
        {
          id: "selector-api-test",
          command: "pnpm",
          args: ["--filter", "@open-practice/api", "test"],
        },
        {
          id: "selector-api-typecheck",
          command: "pnpm",
          args: ["--filter", "@open-practice/api", "typecheck"],
        },
      ],
    );
  });

  it("writes dry-run proof without invoking commands", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-hot-path-dry-run-"));
    const spawn = () => {
      throw new Error("dry-run should not spawn commands");
    };

    const proof = createSecurityHotPathRescan({
      cwd,
      now: new Date("2026-06-05T21:59:20.000Z"),
      dryRun: true,
      spawn,
    });

    assert.equal(proof.status, "dry-run");
    assert.equal(proof.commands.length, securityHotPathRescanCommands().length);
    assert.equal(
      proof.commands.every((command) => command.skipped),
      true,
    );

    const writtenProof = JSON.parse(
      readFileSync(path.join(proof.artifactDir, "rescan-proof.json"), "utf8"),
    );
    assert.equal(writtenProof.status, "dry-run");
    assert.match(
      readFileSync(path.join(proof.artifactDir, "codex-security-scoped-rescan.md"), "utf8"),
      /Codex Security Scoped Rescan Prompt/,
    );
    assert.match(
      readFileSync(
        path.join(proof.artifactDir, "commands", "hot-path-selector.stdout.log"),
        "utf8",
      ),
      /Dry run: pnpm verify:select/,
    );
  });

  it("records failed required commands in proof", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-hot-path-failed-"));
    const calls = [];
    const spawn = (command, args) => {
      calls.push([command, args]);
      const isScopedScan = args.includes("security:scan");
      return {
        status: isScopedScan ? 1 : 0,
        signal: null,
        stdout: isScopedScan ? "" : `ok ${args.join(" ")}\n`,
        stderr: isScopedScan ? "secret scan failed\n" : "",
      };
    };

    const proof = createSecurityHotPathRescan({
      cwd,
      now: new Date("2026-06-05T21:59:20.000Z"),
      spawn,
    });

    assert.equal(proof.status, "failed");
    assert.deepEqual(proof.failedRequiredCommandIds, ["scoped-secret-scan"]);
    assert.equal(calls.length, securityHotPathRescanCommands().length);
    assert.match(
      readFileSync(
        path.join(proof.artifactDir, "commands", "scoped-secret-scan.stderr.log"),
        "utf8",
      ),
      /secret scan failed/,
    );
  });
});
