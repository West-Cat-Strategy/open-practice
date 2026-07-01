import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DOCKER_DAEMON_BLOCKER_CODE,
  DOCKER_DAEMON_BLOCKER_KIND,
  KIB_PER_GIB,
  parseDfPk,
  parseDockerSystemDf,
  parseMinimumFreeKib,
  runDockerDaemonPreflight,
  runDockerStoragePreflight,
  selectProbeImageRefs,
} from "./docker-storage-preflight.mjs";

function jsonLines(values) {
  return values.map((value) => JSON.stringify(value)).join("\n");
}

function fakeSpawn(handler) {
  const calls = [];
  const spawn = (command, args) => {
    calls.push([command, args]);
    return handler(command, args);
  };
  spawn.calls = calls;
  return spawn;
}

describe("docker storage preflight contract", () => {
  it("parses df output and local threshold overrides", () => {
    assert.deepEqual(
      parseDfPk(
        "Filesystem 1024-blocks Used Available Capacity Mounted on\noverlay 100 25 75 25% /\n",
      ),
      {
        filesystem: "overlay",
        totalKib: 100,
        usedKib: 25,
        availableKib: 75,
        capacity: "25%",
        mountedOn: "/",
      },
    );
    assert.equal(parseMinimumFreeKib({}), 8 * KIB_PER_GIB);
    assert.equal(
      parseMinimumFreeKib({ OPEN_PRACTICE_DOCKER_MIN_FREE_GIB: "0.5" }),
      Math.ceil(0.5 * KIB_PER_GIB),
    );
    assert.throws(
      () => parseMinimumFreeKib({ OPEN_PRACTICE_DOCKER_MIN_FREE_GIB: "nope" }),
      /positive number/,
    );
  });

  it("parses Docker system df diagnostics", () => {
    assert.deepEqual(
      parseDockerSystemDf(
        jsonLines([
          {
            Type: "Images",
            TotalCount: "12",
            Active: "1",
            Size: "5GB",
            Reclaimable: "2GB (40%)",
          },
        ]),
      ),
      [
        {
          type: "Images",
          totalCount: "12",
          active: "1",
          size: "5GB",
          reclaimable: "2GB (40%)",
        },
      ],
    );
  });

  it("prefers Open Practice images before common service and generic local images", () => {
    assert.deepEqual(
      selectProbeImageRefs([
        { repository: "node", tag: "26", id: "node", size: "1GB" },
        { repository: "<none>", tag: "<none>", id: "dangling", size: "10MB" },
        { repository: "open-practice-minio", tag: "local", id: "op", size: "100MB" },
        { repository: "custom/tooling", tag: "latest", id: "tool", size: "100MB" },
        { repository: "redis", tag: "8-alpine", id: "redis", size: "50MB" },
      ]),
      ["open-practice-minio:local", "node:26", "redis:8-alpine", "custom/tooling:latest"],
    );
  });

  it("passes the Docker daemon preflight when Docker is reachable", () => {
    const spawn = fakeSpawn((_command, args) => {
      const key = args.join(" ");
      if (key === "info") return { status: 0, stdout: "Server OK\n", stderr: "" };
      throw new Error(`unexpected docker args: ${key}`);
    });

    const result = runDockerDaemonPreflight({
      spawn,
      phase: "test daemon pass",
    });

    assert.equal(result.status, "passed");
    assert.equal(result.reason, null);
    assert.equal(spawn.calls.length, 1);
    assert.deepEqual(spawn.calls[0], ["docker", ["info"]]);
  });

  it("reports a stable local-environment blocker when the Docker daemon is unreachable", () => {
    const spawn = fakeSpawn((_command, args) => {
      const key = args.join(" ");
      if (key === "info") {
        return {
          status: 1,
          stdout: "",
          stderr:
            "Cannot connect to the Docker daemon at unix:///Users/bryan/.docker/run/docker.sock.",
        };
      }
      throw new Error(`unexpected docker args: ${key}`);
    });

    assert.throws(
      () =>
        runDockerDaemonPreflight({
          spawn,
          phase: "test daemon blocked",
        }),
      (error) => {
        assert.equal(error.name, "DockerStoragePreflightError");
        assert.equal(error.result.status, "blocked");
        assert.equal(error.result.code, DOCKER_DAEMON_BLOCKER_CODE);
        assert.equal(error.result.kind, DOCKER_DAEMON_BLOCKER_KIND);
        assert.equal(error.result.reason, "docker_unreachable");
        assert.match(error.message, /Start Docker Desktop or set DOCKER_HOST/);
        assert.match(error.message, /Cannot connect to the Docker daemon/);
        return true;
      },
    );
  });

  it("keeps soft storage preflight hard-blocked when the Docker daemon is unreachable", () => {
    const spawn = fakeSpawn((_command, args) => {
      const key = args.join(" ");
      if (key === "info") {
        return {
          status: 1,
          stdout: "",
          stderr: "Cannot connect to the Docker daemon.",
        };
      }
      throw new Error(`unexpected docker args: ${key}`);
    });

    assert.throws(
      () =>
        runDockerStoragePreflight({
          spawn,
          env: {},
          phase: "test soft daemon blocked",
          soft: true,
          log: () => {},
          warn: () => {},
        }),
      (error) => {
        assert.equal(error.result.status, "blocked");
        assert.equal(error.result.code, DOCKER_DAEMON_BLOCKER_CODE);
        assert.equal(error.result.kind, DOCKER_DAEMON_BLOCKER_KIND);
        assert.equal(error.result.reason, "docker_unreachable");
        assert.deepEqual(spawn.calls, [["docker", ["info"]]]);
        return true;
      },
    );
  });

  it("fails early when measured Docker free space is below the threshold", () => {
    const spawn = fakeSpawn((_command, args) => {
      const key = args.join(" ");
      if (key === "info") return { status: 0, stdout: "ok\n", stderr: "" };
      if (key === "system df --format {{json .}}") {
        return {
          status: 0,
          stdout: jsonLines([
            { Type: "Build Cache", TotalCount: "4", Active: "0", Size: "7GB", Reclaimable: "6GB" },
          ]),
          stderr: "",
        };
      }
      if (key === "image ls --format {{json .}}") {
        return {
          status: 0,
          stdout: jsonLines([
            { Repository: "open-practice-api", Tag: "latest", ID: "abc", Size: "500MB" },
          ]),
          stderr: "",
        };
      }
      if (key === "run --rm --pull=never --entrypoint df open-practice-api:latest -Pk /") {
        return {
          status: 0,
          stdout:
            "Filesystem 1024-blocks Used Available Capacity Mounted on\noverlay 10000000 9000000 1000000 90% /\n",
          stderr: "",
        };
      }
      throw new Error(`unexpected docker args: ${key}`);
    });

    assert.throws(
      () =>
        runDockerStoragePreflight({
          spawn,
          env: {},
          phase: "test low space",
          log: () => {},
          warn: () => {},
        }),
      /below the required 8.0 GiB/,
    );
  });

  it("allows soft preflight to continue when no local probe image exists", () => {
    const warnings = [];
    const spawn = fakeSpawn((_command, args) => {
      const key = args.join(" ");
      if (key === "info") return { status: 0, stdout: "ok\n", stderr: "" };
      if (key === "system df --format {{json .}}") {
        return {
          status: 0,
          stdout: jsonLines([
            { Type: "Images", TotalCount: "0", Active: "0", Size: "0B", Reclaimable: "0B" },
          ]),
          stderr: "",
        };
      }
      if (key === "image ls --format {{json .}}") return { status: 0, stdout: "", stderr: "" };
      throw new Error(`unexpected docker args: ${key}`);
    });

    const result = runDockerStoragePreflight({
      spawn,
      env: {},
      phase: "test pre-build",
      soft: true,
      log: () => {},
      warn: (message) => warnings.push(message),
    });

    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "no_local_probe_image");
    assert.match(warnings.join("\n"), /no non-dangling local Docker image/);
  });

  it("passes when measured free space satisfies the threshold", () => {
    const spawn = fakeSpawn((_command, args) => {
      const key = args.join(" ");
      if (key === "info") return { status: 0, stdout: "ok\n", stderr: "" };
      if (key === "system df --format {{json .}}") return { status: 0, stdout: "", stderr: "" };
      if (key === "image ls --format {{json .}}") {
        return {
          status: 0,
          stdout: jsonLines([{ Repository: "redis", Tag: "8-alpine", ID: "redis", Size: "50MB" }]),
          stderr: "",
        };
      }
      if (key === "run --rm --pull=never --entrypoint df redis:8-alpine -Pk /") {
        return {
          status: 0,
          stdout:
            "Filesystem 1024-blocks Used Available Capacity Mounted on\noverlay 20000000 1000000 12000000 8% /\n",
          stderr: "",
        };
      }
      throw new Error(`unexpected docker args: ${key}`);
    });

    const result = runDockerStoragePreflight({
      spawn,
      env: {},
      phase: "test pass",
      log: () => {},
      warn: () => {},
    });

    assert.equal(result.status, "passed");
    assert.equal(result.probeImage, "redis:8-alpine");
  });
});
