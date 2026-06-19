import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatDoctorReport,
  parseEnvExample,
  playwrightCacheCandidates,
  runDoctor,
} from "./dev-doctor.mjs";

describe("dev-doctor contract", () => {
  it("parses env examples without exposing comments", () => {
    assert.deepEqual(
      [...parseEnvExample(["# comment", "DATABASE_URL=postgres://local", "EMPTY=", ""].join("\n"))],
      [
        ["DATABASE_URL", "postgres://local"],
        ["EMPTY", ""],
      ],
    );
  });

  it("builds deterministic Playwright cache candidates", () => {
    assert.deepEqual(
      playwrightCacheCandidates({
        env: { PLAYWRIGHT_BROWSERS_PATH: "/custom/browsers" },
        home: "/home/dev",
        cwd: "/repo",
      }),
      [
        "/custom/browsers",
        "/home/dev/Library/Caches/ms-playwright",
        "/home/dev/.cache/ms-playwright",
        "/repo/node_modules/.cache/ms-playwright",
      ],
    );
  });

  it("reports pass and warning states without mutating files", async () => {
    const execCalls = [];
    const checks = await runDoctor({
      cwd: "/repo",
      env: {},
      nodeVersion: "24.1.0",
      home: "/home/dev",
      ports: [["web", 33000]],
      exec: (_command, args) => {
        execCalls.push(args);
        if (args.join(" ") === "--version") return "11.5.3\n";
        if (args.join(" ") === "info") return "docker ok\n";
        if (args.join(" ") === "compose config") return "compose ok\n";
        throw new Error(`unexpected command ${args.join(" ")}`);
      },
      readText: () =>
        [
          "DATABASE_URL=postgres://open_practice:open_practice@127.0.0.1:35432/open_practice",
          "OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY=",
        ].join("\n"),
      pathExists: (candidate) => candidate === "/home/dev/.cache/ms-playwright",
      checkPort: async () => ({ available: false, error: "EADDRINUSE" }),
    });

    assert.deepEqual(execCalls, [["--version"], ["info"], ["compose", "config"]]);
    assert.equal(checks.find((check) => check.label === "node").status, "pass");
    assert.equal(checks.find((check) => check.label === "env").status, "warn");
    assert.equal(checks.find((check) => check.label === "playwright").status, "pass");
    assert.equal(checks.find((check) => check.label === "port:web").status, "warn");
    assert.match(formatDoctorReport(checks), /Summary: 5 pass, 2 warn, 0 fail/);
  });

  it("reports fail states for unsupported Node and missing Docker", async () => {
    const checks = await runDoctor({
      cwd: "/repo",
      env: { OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: "local-synthetic-key" },
      nodeVersion: "23.9.0",
      home: "/home/dev",
      ports: [],
      exec: (_command, args) => {
        if (args.join(" ") === "--version") return "10.0.0\n";
        throw new Error("missing binary");
      },
      readText: () =>
        ["DATABASE_URL=postgres://open_practice:open_practice@127.0.0.1:35432/open_practice"].join(
          "\n",
        ),
      pathExists: () => false,
    });

    assert.equal(checks.find((check) => check.label === "node").status, "fail");
    assert.equal(checks.find((check) => check.label === "pnpm").status, "warn");
    assert.equal(checks.find((check) => check.label === "docker").status, "fail");
    assert.equal(checks.find((check) => check.label === "compose").status, "fail");
    assert.equal(checks.find((check) => check.label === "env").status, "pass");
    assert.equal(checks.find((check) => check.label === "playwright").status, "warn");
  });
});
