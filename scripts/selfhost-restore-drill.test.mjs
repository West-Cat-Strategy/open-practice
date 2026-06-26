import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  assertDisposableProjectName,
  assertSetupStatusShape,
  backupExternalS3Marker,
  bootstrapOperatorEnvFile,
  buildMarkerSql,
  buildRestoreEvidenceDir,
  createRedactor,
  externalS3MarkerKey,
  inspectRestoreDrillComposeBoundaries,
  parseRestoreDrillArgs,
  preflightRestoreDrillEnv,
  restoreDrillObjectStorageMode,
  restoreExternalS3Marker,
  restoreDrillTimestamp,
  runRestoreDrill,
  validateRestoreDrillEnv,
  verifyExternalS3Marker,
  writeExternalS3Marker,
} from "./selfhost-restore-drill.mjs";

const syntheticEnv = {
  OPEN_PRACTICE_SELFHOST_PUBLIC_WEB_ORIGIN: "https://practice.example.test",
  OPEN_PRACTICE_SELFHOST_PUBLIC_API_ORIGIN: "https://practice.example.test",
  OPEN_PRACTICE_SELFHOST_WEBAUTHN_RP_ID: "practice.example.test",
  OPEN_PRACTICE_SELFHOST_POSTGRES_PASSWORD: "synthetic-selfhost-postgres-password-change-me",
  OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET: "synthetic-selfhost-jwt-secret-change-me-32",
  OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY:
    "base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
  OPEN_PRACTICE_SELFHOST_S3_ENDPOINT: "http://minio:9000",
  OPEN_PRACTICE_SELFHOST_S3_SECRET_KEY: "synthetic-selfhost-s3-secret-change-me",
};

const externalS3Env = {
  ...syntheticEnv,
  OPEN_PRACTICE_SELFHOST_POSTGRES_PASSWORD: "postgres-production-secret-value",
  OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET: "long-production-jwt-secret-value-1234567890",
  OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY:
    "base64:MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
  OPEN_PRACTICE_SELFHOST_S3_ENDPOINT: "https://s3.practice.example.test",
  OPEN_PRACTICE_SELFHOST_S3_ACCESS_KEY: "external-access-key",
  OPEN_PRACTICE_SELFHOST_S3_BUCKET: "external-restore-bucket",
  OPEN_PRACTICE_SELFHOST_S3_SECRET_KEY: "s3-production-secret-value",
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function envText(env) {
  return `${Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
}

class PutObjectCommand {
  constructor(input) {
    this.input = input;
  }
}

class GetObjectCommand {
  constructor(input) {
    this.input = input;
  }
}

function fakeS3() {
  const calls = [];
  const objects = new Map();
  const client = {
    async send(command) {
      calls.push({ name: command.constructor.name, input: command.input });
      const objectId = `${command.input.Bucket}/${command.input.Key}`;
      if (command instanceof PutObjectCommand) {
        objects.set(objectId, Buffer.from(command.input.Body));
        return {};
      }
      if (command instanceof GetObjectCommand) {
        return { Body: objects.get(objectId) ?? Buffer.alloc(0) };
      }
      throw new Error(`Unexpected command: ${command.constructor.name}`);
    },
  };
  return {
    calls,
    objects,
    s3: { client, GetObjectCommand, PutObjectCommand },
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
      bootstrapEnvFile: null,
      evidenceRoot: ".tmp/open-practice-selfhost-restore-drill",
      projectName: "open-practice-selfhost-restore-drill-42",
      allowSyntheticExample: true,
      preflightOnly: false,
    });
    assert.deepEqual(
      parseRestoreDrillArgs(["--bootstrap-env-file", ".env.selfhost.local"], {
        cwd: "/repo",
        pid: 42,
      }),
      {
        envFile: "docker/selfhost.example.env",
        bootstrapEnvFile: ".env.selfhost.local",
        evidenceRoot: ".tmp/open-practice-selfhost-restore-drill",
        projectName: "open-practice-selfhost-restore-drill-42",
        allowSyntheticExample: true,
        preflightOnly: false,
      },
    );
    assert.equal(
      parseRestoreDrillArgs(["--env-file", ".env.selfhost.local", "--preflight-only"], {
        cwd: "/repo",
        pid: 42,
      }).preflightOnly,
      true,
    );
    assert.throws(
      () =>
        parseRestoreDrillArgs(["--bootstrap-env-file", ".env.selfhost.local", "--preflight-only"], {
          cwd: "/repo",
          pid: 42,
        }),
      /cannot be combined/,
    );
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

  it("validates bundled MinIO and external HTTPS object storage scope", () => {
    assert.equal(
      validateRestoreDrillEnv(syntheticEnv, syntheticEnv, { allowSyntheticExample: true }),
      "bundled_minio",
    );
    assert.equal(validateRestoreDrillEnv(externalS3Env, externalS3Env), "external_https_s3");
    assert.equal(restoreDrillObjectStorageMode(syntheticEnv), "bundled_minio");
    assert.equal(restoreDrillObjectStorageMode(externalS3Env), "external_https_s3");
    assert.throws(
      () =>
        validateRestoreDrillEnv(
          { ...syntheticEnv, OPEN_PRACTICE_SELFHOST_S3_ENDPOINT: "http://storage.example.test" },
          { ...syntheticEnv, OPEN_PRACTICE_SELFHOST_S3_ENDPOINT: "http://storage.example.test" },
          { allowSyntheticExample: true },
        ),
      /https/,
    );
  });

  it("bootstraps only an ignored external S3 operator env template and never overwrites", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-operator-env-"));
    const result = bootstrapOperatorEnvFile(".env.selfhost.local", {
      cwd,
      checkIgnored: () => true,
    });
    const envPath = path.join(cwd, ".env.selfhost.local");

    assert.deepEqual(result, {
      file: ".env.selfhost.local",
      mode: "external_https_s3_template",
      valuesRedacted: true,
    });
    assert.equal(statSync(envPath).mode & 0o777, 0o600);
    const template = readFileSync(envPath, "utf8");
    assert.match(template, /OPEN_PRACTICE_SELFHOST_S3_ENDPOINT=https:\/\/change-me-s3/);
    assert.match(template, /OPEN_PRACTICE_SELFHOST_S3_SECRET_KEY=change-me-secret-key/);
    assert.throws(
      () =>
        bootstrapOperatorEnvFile(".env.selfhost.local", {
          cwd,
          checkIgnored: () => true,
        }),
      /already exists/,
    );
  });

  it("refuses to bootstrap operator secrets into tracked paths", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-tracked-env-"));
    assert.throws(
      () =>
        bootstrapOperatorEnvFile("tracked.env", {
          cwd,
          checkIgnored: () => false,
        }),
      /must be ignored/,
    );
  });

  it("preflights only ignored external HTTPS S3 operator env files", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-preflight-env-"));
    writeFileSync(path.join(cwd, ".env.selfhost.local"), envText(externalS3Env));

    assert.deepEqual(
      preflightRestoreDrillEnv(".env.selfhost.local", {
        cwd,
        checkIgnored: () => true,
      }),
      {
        env: {
          file: ".env.selfhost.local",
          valuesRedacted: true,
          ignored: true,
        },
        objectStorage: {
          mode: "external_https_s3",
          endpointRedacted: true,
          bucketRedacted: true,
        },
        status: "passed",
      },
    );
  });

  it("rejects placeholder and bundled-MinIO operator preflight envs", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-preflight-blocked-"));
    writeFileSync(
      path.join(cwd, ".env.selfhost.local"),
      envText({
        ...externalS3Env,
        OPEN_PRACTICE_SELFHOST_S3_SECRET_KEY: "change-me-secret",
      }),
    );
    assert.throws(
      () =>
        preflightRestoreDrillEnv(".env.selfhost.local", {
          cwd,
          checkIgnored: () => true,
        }),
      /placeholder value/,
    );

    writeFileSync(
      path.join(cwd, ".env.selfhost.local"),
      envText({
        ...externalS3Env,
        OPEN_PRACTICE_SELFHOST_S3_ENDPOINT: "http://minio:9000",
      }),
    );
    assert.throws(
      () =>
        preflightRestoreDrillEnv(".env.selfhost.local", {
          cwd,
          checkIgnored: () => true,
        }),
      /external HTTPS S3-compatible endpoint/,
    );
  });

  it("rejects inherited live/provider flags during operator preflight", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-preflight-inherited-"));
    writeFileSync(path.join(cwd, ".env.selfhost.local"), envText(externalS3Env));
    const previous = process.env.OPEN_PRACTICE_ENABLE_LIVE_SETTLEMENT;
    process.env.OPEN_PRACTICE_ENABLE_LIVE_SETTLEMENT = "true";
    try {
      assert.throws(
        () =>
          preflightRestoreDrillEnv(".env.selfhost.local", {
            cwd,
            checkIgnored: () => true,
          }),
        /OPEN_PRACTICE_ENABLE_LIVE_SETTLEMENT/,
      );
    } finally {
      if (previous === undefined) {
        delete process.env.OPEN_PRACTICE_ENABLE_LIVE_SETTLEMENT;
      } else {
        process.env.OPEN_PRACTICE_ENABLE_LIVE_SETTLEMENT = previous;
      }
    }
  });

  it("returns from preflight before allocating ports or touching Docker and S3", async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-run-preflight-"));
    writeFileSync(path.join(cwd, ".env.selfhost.local"), envText(externalS3Env));

    const result = await runRestoreDrill(
      ["--env-file", ".env.selfhost.local", "--preflight-only"],
      {
        cwd,
        checkIgnored: () => true,
        allocatePorts: async () => {
          throw new Error("preflight must not allocate ports");
        },
        s3Module: {
          S3Client: class {
            constructor() {
              throw new Error("preflight must not create an S3 client");
            }
          },
        },
      },
    );

    assert.equal(result.status, "preflight-passed");
    assert.equal(result.objectStorage.mode, "external_https_s3");
  });

  it("rejects live/provider flags for bundled and external restore drills", () => {
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
          { ...externalS3Env, STRIPE_SECRET_KEY: "sk_live_synthetic" },
          { ...externalS3Env, STRIPE_SECRET_KEY: "sk_live_synthetic" },
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

  it("backs up, disturbs, and restores external S3 markers without list or delete permissions", async () => {
    const { calls, s3 } = fakeS3();
    const markerBody = "Open Practice restore drill synthetic object marker.\n";
    const disturbedMarkerBody = "changed marker\n";
    const bucket = "external-restore-bucket";
    const key = externalS3MarkerKey("restore-drill-test");
    const backupDir = mkdtempSync(path.join(tmpdir(), "open-practice-s3-marker-"));
    const backupPath = path.join(backupDir, "external-s3-marker.txt");

    await writeExternalS3Marker({ s3, bucket, key, markerBody });
    const artifact = await backupExternalS3Marker({ s3, bucket, key, backupPath });
    await writeExternalS3Marker({ s3, bucket, key, markerBody: disturbedMarkerBody });
    await verifyExternalS3Marker({
      s3,
      bucket,
      key,
      markerSha256: sha256(disturbedMarkerBody),
    });
    await restoreExternalS3Marker({ s3, bucket, key, backupPath });
    await verifyExternalS3Marker({
      s3,
      bucket,
      key,
      markerSha256: sha256(markerBody),
    });

    assert.equal(readFileSync(backupPath, "utf8"), markerBody);
    assert.deepEqual(artifact, {
      path: "external-s3-marker.txt",
      sizeBytes: Buffer.byteLength(markerBody),
      sha256: "[redacted]",
    });
    assert.deepEqual(
      calls.map((call) => call.name),
      [
        "PutObjectCommand",
        "GetObjectCommand",
        "PutObjectCommand",
        "GetObjectCommand",
        "PutObjectCommand",
        "GetObjectCommand",
      ],
    );
    const putBodies = calls
      .filter((call) => call.name === "PutObjectCommand")
      .map((call) => Buffer.from(call.input.Body).toString("utf8"));
    assert.deepEqual(putBodies, [markerBody, disturbedMarkerBody, markerBody]);
    assert.equal(
      calls.some((call) => /List|Delete/.test(call.name)),
      false,
    );
    for (const putCall of calls.filter((call) => call.name === "PutObjectCommand")) {
      assert.equal(putCall.input.ServerSideEncryption, "AES256");
    }
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
      OPEN_PRACTICE_SELFHOST_S3_ENDPOINT: "https://s3.private.example.test",
      OPEN_PRACTICE_SELFHOST_S3_BUCKET: "private-bucket",
    });
    const text = redact(
      "DATABASE_URL=postgresql://open_practice:postgres-secret@postgres/open_practice token=jwt-secret endpoint=https://s3.private.example.test host=s3.private.example.test bucket=private-bucket",
    );
    assert(!text.includes("postgres-secret"));
    assert(!text.includes("jwt-secret"));
    assert(!text.includes("s3.private.example.test"));
    assert(!text.includes("private-bucket"));
    assert.match(text, /\[redacted\]/);
  });
});
