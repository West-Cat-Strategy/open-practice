import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectEnvSurface, envExampleNames, envNamesFromText } from "./check-env-surface.mjs";

describe("environment surface check", () => {
  it("extracts env names from runtime code and Compose-style config", () => {
    assert.deepEqual(
      [
        ...envNamesFromText(
          [
            "process.env.API_BASE_URL",
            "process.env['REDIS_URL']",
            "env.OPEN_PRACTICE_DEV_SEED",
            "${OPEN_PRACTICE_DOCKER_WEB_HOST_PORT:-33000}",
            "ARG PNPM_VERSION=11.5.3",
            "ENV OPEN_PRACTICE_IMAGE_PROFILE=production",
          ].join("\n"),
        ),
      ].sort(),
      [
        "API_BASE_URL",
        "OPEN_PRACTICE_DEV_SEED",
        "OPEN_PRACTICE_DOCKER_WEB_HOST_PORT",
        "OPEN_PRACTICE_IMAGE_PROFILE",
        "PNPM_VERSION",
        "REDIS_URL",
      ],
    );
  });

  it("uses context-aware JavaScript extraction", () => {
    assert.deepEqual(
      [
        ...envNamesFromText(
          [
            "process.env.API_BASE_URL",
            "process.env['REDIS_URL']",
            "env.OPEN_PRACTICE_DEV_SEED",
            "const DISPOSABLE_PROJECT_PREFIX = 'open-practice-'",
            "const sql = `SELECT * FROM ${RESTORE_MARKER_TABLE}`;",
            "const marker = REDACTED;",
          ].join("\n"),
          { mode: "javascript" },
        ),
      ].sort(),
      ["API_BASE_URL", "OPEN_PRACTICE_DEV_SEED", "REDIS_URL"],
    );
  });

  it("passes documented and allowlisted environment variables", () => {
    const result = collectEnvSurface({
      allowlist: { E2E_MODE: "test harness marker" },
      exampleText: "NODE_ENV=development\nDATABASE_URL=\n",
      files: {
        "apps/api/src/server.ts": "process.env.NODE_ENV; env.DATABASE_URL; env.E2E_MODE;",
      },
    });

    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.staleAllowlist, []);
  });

  it("reports missing docs and stale allowlist entries", () => {
    const result = collectEnvSurface({
      allowlist: { UNUSED_ENV: "old exception" },
      exampleText: "NODE_ENV=development\n",
      files: {
        "apps/api/src/server.ts": "process.env.NODE_ENV; process.env.NEW_RUNTIME_ENV;",
      },
    });

    assert.deepEqual(result.missing, ["NEW_RUNTIME_ENV"]);
    assert.deepEqual(result.staleAllowlist, ["UNUSED_ENV"]);
  });

  it("accepts self-host env names documented in docker/selfhost.example.env", () => {
    const result = collectEnvSurface({
      allowlist: {},
      exampleText: "NODE_ENV=development\nPUBLIC_WEB_BASE_URL=http://localhost:33000\n",
      selfhostExampleText:
        "OPEN_PRACTICE_SELFHOST_PUBLIC_WEB_ORIGIN=https://practice.example.test\n",
      files: {
        "docker-compose.selfhost.yml":
          "environment:\n  NODE_ENV: production\n  PUBLIC_WEB_BASE_URL: ${OPEN_PRACTICE_SELFHOST_PUBLIC_WEB_ORIGIN:?Set origin}\n",
      },
    });

    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.missingSelfhost, []);
    assert.deepEqual(
      result.usedSelfhost.map((entry) => entry.name),
      ["OPEN_PRACTICE_SELFHOST_PUBLIC_WEB_ORIGIN"],
    );
  });

  it("reports self-host env names missing from docker/selfhost.example.env", () => {
    const result = collectEnvSurface({
      allowlist: {},
      exampleText: "NODE_ENV=development\nWEB_PORT=33000\n",
      selfhostExampleText: "",
      files: {
        "docker-compose.selfhost.yml":
          "environment:\n  NODE_ENV: production\n  WEB_PORT: ${OPEN_PRACTICE_SELFHOST_WEB_HOST_PORT:-33080}\n",
      },
    });

    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.missingSelfhost, ["OPEN_PRACTICE_SELFHOST_WEB_HOST_PORT"]);
  });

  it("reports self-host allowlist coverage and stale entries", () => {
    const result = collectEnvSurface({
      allowlist: {},
      selfhostAllowlist: {
        OPEN_PRACTICE_SELFHOST_INTENTIONAL_EXCEPTION: "documented self-host exception",
        OPEN_PRACTICE_SELFHOST_STALE_EXCEPTION: "old self-host exception",
      },
      exampleText: "VALUE=\n",
      selfhostExampleText: "",
      files: {
        "docker-compose.selfhost.yml":
          "environment:\n  VALUE: ${OPEN_PRACTICE_SELFHOST_INTENTIONAL_EXCEPTION:-synthetic}\n",
      },
    });

    assert.deepEqual(result.missingSelfhost, []);
    assert.deepEqual(result.staleSelfhostAllowlist, ["OPEN_PRACTICE_SELFHOST_STALE_EXCEPTION"]);
  });

  it("parses .env.example assignment names only", () => {
    assert.deepEqual([...envExampleNames("# comment\nAPI_PORT=34000\n\nBAD\n")], ["API_PORT"]);
  });
});
