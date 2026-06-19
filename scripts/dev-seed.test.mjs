import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseArgs, runDevSeed, seedCommands } from "./dev-seed.mjs";

describe("dev-seed contract", () => {
  it("parses database URL and skip-build options", () => {
    assert.deepEqual(parseArgs(["--database-url", "postgres://local", "--skip-build"]), {
      databaseUrl: "postgres://local",
      skipBuild: true,
    });
  });

  it("builds domain and database packages before seeding by default", () => {
    assert.deepEqual(
      seedCommands().map((command) => [command.command, command.args.slice(0, 2)]),
      [
        ["pnpm", ["--filter", "@open-practice/domain"]],
        ["pnpm", ["--filter", "@open-practice/database"]],
        ["node", ["--input-type=module", "--eval"]],
      ],
    );
  });

  it("supports skip-build for already-built local worktrees", () => {
    assert.deepEqual(
      seedCommands({ skipBuild: true }).map((command) => command.command),
      ["node"],
    );
  });

  it("requires a configured database URL", () => {
    assert.throws(() => runDevSeed([], { env: {}, spawn: () => ({ status: 0 }) }), /DATABASE_URL/);
  });

  it("spawns commands without printing or changing the database URL", () => {
    const calls = [];
    const status = runDevSeed(["--database-url", "postgres://local", "--skip-build"], {
      env: {},
      spawn: (command, args, options) => {
        calls.push([command, args.slice(0, 2), options.env.DATABASE_URL]);
        return { status: 0 };
      },
    });

    assert.equal(status, 0);
    assert.deepEqual(calls, [["node", ["--input-type=module", "--eval"], "postgres://local"]]);
  });
});
