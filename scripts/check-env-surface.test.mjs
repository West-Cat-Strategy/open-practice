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

  it("parses .env.example assignment names only", () => {
    assert.deepEqual([...envExampleNames("# comment\nAPI_PORT=34000\n\nBAD\n")], ["API_PORT"]);
  });
});
