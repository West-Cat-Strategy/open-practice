import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDevStackCommand, parseArgs, runDevStack } from "./dev-stack.mjs";

describe("dev-stack contract", () => {
  it("builds the infrastructure startup command", () => {
    assert.deepEqual(buildDevStackCommand(parseArgs(["infra"])), {
      command: "docker",
      args: ["compose", "up", "-d", "postgres", "redis", "minio", "mailpit", "minio-bucket-init"],
    });
  });

  it("builds logs commands with an optional service", () => {
    assert.deepEqual(buildDevStackCommand(parseArgs(["logs", "api"])), {
      command: "docker",
      args: ["compose", "logs", "--tail", "200", "-f", "api"],
    });
  });

  it("keeps reset non-destructive by default", () => {
    assert.deepEqual(buildDevStackCommand(parseArgs(["reset"])), {
      command: "docker",
      args: ["compose", "down", "--remove-orphans"],
    });
  });

  it("requires explicit confirmation for volume deletion", () => {
    assert.throws(() => buildDevStackCommand(parseArgs(["reset", "--volumes"])), /--volumes --yes/);
    assert.deepEqual(buildDevStackCommand(parseArgs(["reset", "--volumes", "--yes"])), {
      command: "docker",
      args: ["compose", "down", "--remove-orphans", "--volumes"],
    });
  });

  it("spawns the constructed command", () => {
    const calls = [];
    const status = runDevStack(["ps"], {
      spawn: (command, args) => {
        calls.push([command, args]);
        return { status: 0 };
      },
    });

    assert.equal(status, 0);
    assert.deepEqual(calls, [["docker", ["compose", "ps"]]]);
  });
});
