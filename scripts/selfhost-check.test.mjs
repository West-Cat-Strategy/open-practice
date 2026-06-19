import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inspectRenderedCompose, parseEnvFile, validateSelfhostEnv } from "./selfhost-check.mjs";

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

const productionEnv = {
  ...syntheticEnv,
  OPEN_PRACTICE_SELFHOST_POSTGRES_PASSWORD: "postgres-production-secret-value",
  OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET: "long-production-jwt-secret-value-1234567890",
  OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY:
    "base64:MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
  OPEN_PRACTICE_SELFHOST_S3_SECRET_KEY: "s3-production-secret-value",
};

function renderedCompose(overrides = {}) {
  const baseEnvironment = {
    NODE_ENV: "production",
    OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: syntheticEnv.OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY,
    S3_SERVER_SIDE_ENCRYPTION: "AES256",
  };
  return {
    services: {
      postgres: { environment: {}, ports: [] },
      redis: { environment: {}, ports: [] },
      "minio-bucket-init": { environment: {}, ports: [] },
      minio: { environment: {}, ports: [{ host_ip: "127.0.0.1", target: 9000 }] },
      "db-migrate": { environment: {}, ports: [] },
      api: {
        environment: { ...baseEnvironment },
        ports: [{ host_ip: "127.0.0.1", target: 4000 }],
      },
      web: {
        environment: {
          NODE_ENV: "production",
          API_BASE_URL: "http://api:4000",
          OPEN_PRACTICE_BROWSER_API_MODE: "same-origin",
        },
        ports: [{ host_ip: "127.0.0.1", target: 3000 }],
      },
      worker: { environment: { ...baseEnvironment }, ports: [] },
      ...overrides,
    },
  };
}

describe("selfhost-check", () => {
  it("parses simple env files", () => {
    assert.deepEqual(parseEnvFile("A=1\n# comment\nB='two words'\n"), {
      A: "1",
      B: "two words",
    });
  });

  it("allows the synthetic example only when explicitly requested", () => {
    assert.doesNotThrow(() => validateSelfhostEnv(syntheticEnv, { allowSyntheticExample: true }));
    assert.throws(() => validateSelfhostEnv(syntheticEnv), /https|placeholder|unique/);
  });

  it("requires the WebAuthn RP ID to match the public web origin host", () => {
    assert.throws(
      () =>
        validateSelfhostEnv(
          { ...syntheticEnv, OPEN_PRACTICE_SELFHOST_WEBAUTHN_RP_ID: "other.example.test" },
          { allowSyntheticExample: true },
        ),
      /WEBAUTHN_RP_ID/,
    );
  });

  it("allows only private HTTP MinIO or HTTPS object storage endpoints", () => {
    assert.doesNotThrow(() => validateSelfhostEnv(productionEnv));
    assert.doesNotThrow(() =>
      validateSelfhostEnv({
        ...productionEnv,
        OPEN_PRACTICE_SELFHOST_S3_ENDPOINT: "https://s3.practice.example.test",
      }),
    );
    assert.throws(
      () =>
        validateSelfhostEnv({
          ...productionEnv,
          OPEN_PRACTICE_SELFHOST_S3_ENDPOINT: "http://storage.example.test",
        }),
      /S3_ENDPOINT/,
    );
  });

  it("accepts the rendered self-host compose posture", () => {
    assert.doesNotThrow(() => inspectRenderedCompose(renderedCompose()));
  });

  it("rejects dev-only services, flags, and public infra ports", () => {
    assert.throws(
      () => inspectRenderedCompose(renderedCompose({ mailpit: { environment: {}, ports: [] } })),
      /Mailpit/,
    );
    assert.throws(
      () =>
        inspectRenderedCompose(
          renderedCompose({
            api: {
              environment: {
                NODE_ENV: "production",
                OPEN_PRACTICE_DEV_SEED: "true",
                OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY:
                  syntheticEnv.OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY,
                S3_SERVER_SIDE_ENCRYPTION: "AES256",
              },
              ports: [{ host_ip: "127.0.0.1", target: 4000 }],
            },
          }),
        ),
      /OPEN_PRACTICE_DEV_SEED/,
    );
    assert.throws(
      () =>
        inspectRenderedCompose(
          renderedCompose({
            web: {
              environment: {
                NODE_ENV: "production",
                API_BASE_URL: "http://api:4000",
                OPEN_PRACTICE_BROWSER_API_MODE: "same-origin",
              },
              ports: [{ host_ip: "0.0.0.0", target: 3000 }],
            },
          }),
        ),
      /non-loopback/,
    );
  });
});
