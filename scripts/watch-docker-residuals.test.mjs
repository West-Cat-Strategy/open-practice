import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  assessWatchResults,
  buildArtifactDir,
  collectDockerResidualPosture,
  dockerResidualCommands,
  extractManifestDigest,
  latestSourceTag,
  parseComposeServiceImages,
  parseDockerfilePosture,
  runDockerResidualWatch,
  sourceTagIsNewer,
  sourceTagsFromLsRemote,
  watchTimestamp,
} from "./watch-docker-residuals.mjs";

const composeFixture = `
services:
  postgres:
    image: open-practice-postgres:18-alpine-su-exec
    build:
      context: ./docker/postgres
  minio:
    image: open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4
    build:
      context: ./docker/minio
  mailpit:
    image: open-practice-mailpit:v1.30.1-go1.26.4
    build:
      context: ./docker/mailpit
`;

const postgresDigest = `sha256:${"a".repeat(64)}`;
const newPostgresDigest = `sha256:${"b".repeat(64)}`;

const postgresDockerfileFixture = `
FROM postgres:18-alpine@${postgresDigest} AS upstream
RUN apk add --no-cache "libcurl>=8.19.0-r0" su-exec
ENV PG_VERSION=18.4
`;

const minioDockerfileFixture = `
FROM golang:1.26.4-alpine3.23@sha256:builder AS builder
ARG MINIO_VERSION=RELEASE.2025-10-15T17-29-55Z
ARG MINIO_COMMIT=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a
FROM alpine:3.23.4@sha256:runtime
`;

const mailpitDockerfileFixture = `
FROM golang:1.26.4-alpine3.23@sha256:builder AS builder
ARG MAILPIT_VERSION=v1.30.1
ARG MAILPIT_SHA256=bda226e88f828215fc3646258494e71ebfaf82074970ea28a319c91a64c068d2
FROM alpine:3.23.4@sha256:runtime
`;

function writeMinimalRepo(cwd) {
  mkdirSync(path.join(cwd, "docker", "postgres"), { recursive: true });
  mkdirSync(path.join(cwd, "docker", "minio"), { recursive: true });
  mkdirSync(path.join(cwd, "docker", "mailpit"), { recursive: true });
  writeFileSync(path.join(cwd, "docker-compose.yml"), composeFixture);
  writeFileSync(path.join(cwd, "docker", "postgres", "Dockerfile"), postgresDockerfileFixture);
  writeFileSync(path.join(cwd, "docker", "minio", "Dockerfile"), minioDockerfileFixture);
  writeFileSync(path.join(cwd, "docker", "mailpit", "Dockerfile"), mailpitDockerfileFixture);
}

function fakeSuccessfulSpawn(command, args) {
  if (command === "git") {
    if (args[0] === "rev-parse") return { status: 0, stdout: "abc123\n", stderr: "" };
    if (args[0] === "branch") return { status: 0, stdout: "codex/docker-watch\n", stderr: "" };
    if (args[0] === "status") return { status: 0, stdout: "", stderr: "" };
    if (args[0] === "ls-remote") {
      const isMinio = args.includes("https://github.com/minio/minio.git");
      return {
        status: 0,
        stdout: isMinio
          ? "9e49 refs/tags/RELEASE.2025-10-15T17-29-55Z\n"
          : "bda226 refs/tags/v1.30.1\n",
        stderr: "",
      };
    }
  }

  if (command === "docker" && args[0] === "buildx") {
    const image = args.at(-1);
    if (image.includes("RELEASE.2025-10-15T17-29-55Z")) {
      return { status: 1, stdout: "", stderr: "not found\n" };
    }
    if (image === "postgres:18-alpine") {
      return {
        status: 0,
        stdout: `Name: postgres:18-alpine\nDigest: ${postgresDigest}\n`,
        stderr: "",
      };
    }
    return {
      status: 0,
      stdout:
        "Name: registry.example/test\nMediaType: application/vnd.oci.image.index.v1+json\nDigest: sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e\n",
      stderr: "",
    };
  }

  if (command === "docker" && args[0] === "scout" && args[1] === "quickview") {
    return { status: 0, stdout: "Target 0C/1H/1M/0L\n", stderr: "" };
  }

  if (command === "docker" && args[0] === "scout" && args[1] === "recommendations") {
    return { status: 0, stdout: "No recommendations\n", stderr: "" };
  }

  return { status: 0, stdout: `ok ${command} ${args.join(" ")}\n`, stderr: "" };
}

describe("watch-docker-residuals contract", () => {
  it("builds stable local artifact paths", () => {
    const now = new Date("2026-06-05T22:18:19.000Z");
    assert.equal(watchTimestamp(now), "2026-06-05T22-18-19Z");
    assert.equal(
      buildArtifactDir({
        artifactRoot: "/tmp/open-practice-watch",
        now,
      }),
      "/tmp/open-practice-watch/2026-06-05T22-18-19Z",
    );
  });

  it("parses wrapped service posture from Compose and Dockerfiles", () => {
    assert.deepEqual(parseComposeServiceImages(composeFixture), {
      postgres: "open-practice-postgres:18-alpine-su-exec",
      minio: "open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4",
      mailpit: "open-practice-mailpit:v1.30.1-go1.26.4",
    });
    assert.deepEqual(parseDockerfilePosture("postgres", postgresDockerfileFixture), {
      upstreamImage: `postgres:18-alpine@${postgresDigest}`,
      upstreamImageWithoutDigest: "postgres:18-alpine",
      upstreamDigest: postgresDigest,
      pgVersion: "18.4",
      libcurlMinimum: "8.19.0-r0",
    });
    assert.equal(
      parseDockerfilePosture("minio", minioDockerfileFixture).version,
      "RELEASE.2025-10-15T17-29-55Z",
    );
    assert.equal(parseDockerfilePosture("mailpit", mailpitDockerfileFixture).version, "v1.30.1");
  });

  it("derives the residual watch command lane from the current posture", () => {
    const posture = collectDockerResidualPosture({
      composeText: composeFixture,
      dockerfileTexts: {
        postgres: postgresDockerfileFixture,
        minio: minioDockerfileFixture,
        mailpit: mailpitDockerfileFixture,
      },
    });

    const commandIds = dockerResidualCommands(posture).map((command) => command.id);
    assert.deepEqual(commandIds.slice(0, 3), [
      "docker-version",
      "docker-scout-version",
      "compose-images",
    ]);
    assert(commandIds.includes("postgres-scout-recommendations"));
    assert(commandIds.includes("minio-dockerhub-current-source-manifest"));
    assert(commandIds.includes("mailpit-source-tags"));
  });

  it("extracts registry digests and newest source tags", () => {
    assert.equal(
      extractManifestDigest("Name: minio/minio\nDigest: sha256:abc123\n"),
      "sha256:abc123",
    );
    assert.deepEqual(sourceTagsFromLsRemote("aaa refs/tags/v1.30.1\nbbb refs/tags/v1.31.0\n"), [
      "v1.30.1",
      "v1.31.0",
    ]);
    assert.equal(latestSourceTag(["v1.30.1", "v1.31.0"], "semver"), "v1.31.0");
    assert.equal(
      latestSourceTag(["RELEASE.2025-09-07T16-13-09Z", "RELEASE.2025-10-15T17-29-55Z"], "minio"),
      "RELEASE.2025-10-15T17-29-55Z",
    );
    assert.equal(sourceTagIsNewer("v1.31.0", "v1.30.1", "semver"), true);
  });

  it("returns needs-review for newer same-contract candidates", () => {
    const posture = {
      minio: { version: "RELEASE.2025-10-15T17-29-55Z" },
      mailpit: { version: "v1.30.1" },
    };
    const assessment = assessWatchResults({
      posture,
      commandResults: [
        {
          id: "minio-source-tags",
          status: 0,
          stdout:
            "aaa refs/tags/RELEASE.2025-10-15T17-29-55Z\nbbb refs/tags/RELEASE.2025-11-01T00-00-00Z\n",
          stderr: "",
          sourceProbe: { kind: "minio" },
          allowFailurePatterns: [],
        },
        {
          id: "postgres-upstream-18-alpine-manifest",
          status: 0,
          stdout: `Digest: ${newPostgresDigest}\n`,
          stderr: "",
          registryProbe: {
            image: "postgres:18-alpine",
            candidateWhenDigestDiffersFrom: postgresDigest,
          },
          allowFailurePatterns: [],
        },
      ],
    });

    assert.equal(assessment.status, "needs-review");
    assert.equal(assessment.exitCode, 2);
    assert.deepEqual(
      assessment.candidates.map((candidate) => candidate.kind),
      ["newer-upstream-source-tag", "registry-manifest-drift"],
    );
  });

  it("records blockers only for unexpected command failures", () => {
    const assessment = assessWatchResults({
      posture: {},
      commandResults: [
        {
          id: "minio-current-tag",
          status: 1,
          stdout: "",
          stderr: "not found",
          allowFailurePatterns: [/not found/i],
        },
        {
          id: "docker-version",
          status: 1,
          stdout: "",
          stderr: "Cannot connect to Docker",
          stderrPath: "docker-version.stderr.log",
          allowFailurePatterns: [],
        },
      ],
    });

    assert.equal(assessment.status, "blocked");
    assert.equal(assessment.exitCode, 1);
    assert.deepEqual(
      assessment.blockers.map((blocker) => blocker.id),
      ["docker-version"],
    );
  });

  it("writes a passed local artifact with command logs", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "open-practice-docker-watch-repo-"));
    const artifactRoot = mkdtempSync(path.join(tmpdir(), "open-practice-docker-watch-artifacts-"));
    writeMinimalRepo(cwd);

    const metadata = runDockerResidualWatch({
      cwd,
      artifactRoot,
      now: new Date("2026-06-05T22:18:19.000Z"),
      spawn: fakeSuccessfulSpawn,
    });

    assert.equal(metadata.status, "passed");
    assert.equal(metadata.exitCode, 0);
    assert.equal(metadata.git.branch, "codex/docker-watch");
    assert.equal(metadata.blockers.length, 0);
    assert.equal(metadata.candidates.length, 0);

    const written = JSON.parse(
      readFileSync(path.join(metadata.artifactDir, "docker-residual-watch.json"), "utf8"),
    );
    assert.equal(written.status, "passed");
    assert.match(
      readFileSync(path.join(metadata.artifactDir, "README.md"), "utf8"),
      /Docker Residual Watch/,
    );
    assert.match(
      readFileSync(
        path.join(metadata.artifactDir, "commands", "docker-version.stdout.log"),
        "utf8",
      ),
      /ok docker version/,
    );
  });
});
