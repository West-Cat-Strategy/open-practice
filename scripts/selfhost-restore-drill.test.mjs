import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDisposableProjectName,
  assertSetupStatusShape,
  buildMarkerSql,
  buildRestoreEvidenceDir,
  createRedactor,
  inspectRestoreDrillComposeBoundaries,
  parseRestoreDrillArgs,
  restoreDrillTimestamp,
  validateRestoreDrillEnv,
} from "./selfhost-restore-drill.mjs";

const syntheticEnv = {
  OPEN_PRACTICE_SELFHOST_PUBLIC_WEB_ORIGIN: "https://practice.example.test",
  OPEN_PRACTICE_SELFHOST_WEBAUTHN_RP_ID: "practice.example.test",
  OPEN_PRACTICE_SELFHOST_POSTGRES_PASSWORD: "synthetic-selfhost-postgres-password-change-me",
  OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET: "synthetic-selfhost-jwt-secret-change-me-32",
  OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY:
    "base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
  OPEN_PRACTICE_SELFHOST_S3_ENDPOINT: "http://minio:9000",
  OPEN_PRACTICE_SELFHOST_S3_SECRET_KEY: "synthetic-selfhost-s3-secret-change-me",
};

function renderedCompose(serviceEnvironment = {}) {
  return {
    services: {
      api: { environment: serviceEnvironment },
      web: { environment: {} },
      worker: { environment: {} },
    },
  };
}

describe("selfhost restore drill contracts", () => {
  it("builds stable evidence paths and defaults to the disposable synthetic profile", () => {
    const now = new Date("2026-06-23T12:34:56.000Z");
    assert.equal(restoreDrillTimestamp(now), "2026-06-23T12-34-56Z");
    assert.equal(
      buildRestoreEvidenceDir({ cwd: "/repo", now }),
      "/repo/.tmp/open-practice-selfhost-restore-drill/2026-06-23T12-34-56Z",
    );
    assert.deepEqual(parseRestoreDrillArgs([], { cwd: "/repo", pid: 42 }), {
      envFile: "docker/selfhost.example.env",
      evidenceRoot: ".tmp/open-practice-selfhost-restore-drill",
      projectName: "open-practice-selfhost-restore-drill-42",
      allowSyntheticExample: true,
    });
  });

  it("accepts only explicitly disposable Compose project names", () => {
    assert.doesNotThrow(() =>
      assertDisposableProjectName("open-practice-selfhost-restore-drill-worker_a"),
    );
    assert.throws(() => assertDisposableProjectName("open-practice-selfhost"), /disposable/);
    assert.throws(
      () =>
        parseRestoreDrillArgs(["--project-name", "open-practice-selfhost"], {
          cwd: "/repo",
          pid: 1,
        }),
      /disposable/,
    );
  });

  it("validates MinIO-only synthetic restore scope and rejects live/provider flags", () => {
    assert.doesNotThrow(() =>
      validateRestoreDrillEnv(syntheticEnv, syntheticEnv, { allowSyntheticExample: true }),
    );
    assert.throws(
      () =>
        validateRestoreDrillEnv(
          { ...syntheticEnv, OPEN_PRACTICE_SELFHOST_S3_ENDPOINT: "https://s3.example.test" },
          { ...syntheticEnv, OPEN_PRACTICE_SELFHOST_S3_ENDPOINT: "https://s3.example.test" },
          { allowSyntheticExample: true },
        ),
      /MinIO/,
    );
    assert.throws(
      () =>
        validateRestoreDrillEnv(
          { ...syntheticEnv, STRIPE_SECRET_KEY: "sk_live_synthetic" },
          { ...syntheticEnv, STRIPE_SECRET_KEY: "sk_live_synthetic" },
          { allowSyntheticExample: true },
        ),
      /live settlement/,
    );
    assert.throws(
      () =>
        validateRestoreDrillEnv(
          { ...syntheticEnv, AI_PROVIDER: "openai" },
          { ...syntheticEnv, AI_PROVIDER: "openai" },
          { allowSyntheticExample: true },
        ),
      /AI_PROVIDER/,
    );
  });

  it("rejects inherited boundary flags from the merged process environment", () => {
    assert.throws(
      () =>
        validateRestoreDrillEnv(
          syntheticEnv,
          { ...syntheticEnv, OPEN_PRACTICE_ENABLE_LIVE_SETTLEMENT: "true" },
          { allowSyntheticExample: true },
        ),
      /OPEN_PRACTICE_ENABLE_LIVE_SETTLEMENT/,
    );
    assert.throws(
      () =>
        validateRestoreDrillEnv(
          syntheticEnv,
          { ...syntheticEnv, SMTP_HOST: "smtp.example.test" },
          { allowSyntheticExample: true },
        ),
      /SMTP_HOST/,
    );
    assert.throws(
      () =>
        validateRestoreDrillEnv(
          syntheticEnv,
          { ...syntheticEnv, AI_PROVIDER: "openai" },
          { allowSyntheticExample: true },
        ),
      /AI_PROVIDER/,
    );
  });

  it("rejects rendered compose provider and settlement enablement env", () => {
    assert.doesNotThrow(() =>
      inspectRestoreDrillComposeBoundaries(
        renderedCompose({ NODE_ENV: "production", S3_BUCKET: "open-practice-documents" }),
      ),
    );
    assert.throws(
      () => inspectRestoreDrillComposeBoundaries(renderedCompose({ STRIPE_SECRET_KEY: "x" })),
      /STRIPE_SECRET_KEY/,
    );
    assert.throws(
      () =>
        inspectRestoreDrillComposeBoundaries(
          renderedCompose({ OPEN_PRACTICE_TRUST_POSTING_ENABLED: "true" }),
        ),
      /TRUST_POSTING/,
    );
  });

  it("escapes SQL marker literals and validates setup-status response shape", () => {
    const sql = buildMarkerSql({
      markerId: "marker-'one'",
      markerSha256: "abc'123",
    });
    assert.match(sql, /marker-''one''/);
    assert.match(sql, /abc''123/);
    assert.doesNotThrow(() => assertSetupStatusShape({ required: true, blocked: false }));
    assert.throws(() => assertSetupStatusShape({ required: "true", blocked: false }), /boolean/);
  });

  it("redacts known secret values from diagnostic text", () => {
    const redact = createRedactor({
      OPEN_PRACTICE_SELFHOST_POSTGRES_PASSWORD: "postgres-secret",
      OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET: "jwt-secret",
    });
    const text = redact(
      "DATABASE_URL=postgresql://open_practice:postgres-secret@postgres/open_practice token=jwt-secret",
    );
    assert(!text.includes("postgres-secret"));
    assert(!text.includes("jwt-secret"));
    assert.match(text, /\[redacted\]/);
  });
});
