import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  checkMigrationParity,
  collectSqlMigrations,
  formatParityReport,
  parseArgs,
  runMigrationReplay,
} from "./check-migration-integrity.mjs";

function makeFixture() {
  const rootDir = mkdtempSync(path.join(tmpdir(), "open-practice-migrations-"));
  const migrationsDir = "packages/database/migrations";
  const metaDir = path.join(rootDir, migrationsDir, "meta");
  mkdirSync(metaDir, { recursive: true });
  return { rootDir, migrationsDir, journalPath: `${migrationsDir}/meta/_journal.json` };
}

function writeMigration(fixture, fileName, sql = "SELECT 1;") {
  writeFileSync(path.join(fixture.rootDir, fixture.migrationsDir, fileName), `${sql}\n`);
}

function writeJournal(fixture, entries) {
  writeFileSync(
    path.join(fixture.rootDir, fixture.journalPath),
    `${JSON.stringify({ version: "7", dialect: "postgresql", entries }, null, 2)}\n`,
  );
}

function entry(idx, tag, when = 1000 + idx) {
  return {
    idx,
    version: "7",
    when,
    tag,
    breakpoints: true,
  };
}

describe("migration integrity parity", () => {
  it("passes when SQL files and journal entries match exactly", () => {
    const fixture = makeFixture();
    writeMigration(fixture, "0000_initial_setup.sql");
    writeMigration(fixture, "0001_add_matters.sql");
    writeJournal(fixture, [entry(0, "0000_initial_setup"), entry(1, "0001_add_matters")]);

    const report = checkMigrationParity(fixture);

    assert.equal(report.status, "passed");
    assert.equal(
      formatParityReport(report),
      "Migration parity passed: 2 SQL files match 2 journal entries.",
    );
  });

  it("detects SQL and journal drift plus unrecognized SQL names", () => {
    const fixture = makeFixture();
    writeMigration(fixture, "0000_initial_setup.sql");
    writeMigration(fixture, "0001_add_matters.sql");
    writeMigration(fixture, "manual_fix.sql");
    writeJournal(fixture, [entry(0, "0000_initial_setup"), entry(1, "0001_stale_tag")]);

    const report = checkMigrationParity(fixture);

    assert.equal(report.status, "failed");
    assert.match(report.failures.join("\n"), /Unrecognized SQL migration name: manual_fix\.sql/);
    assert.match(report.failures.join("\n"), /SQL files missing journal entries: 0001_add_matters/);
    assert.match(report.failures.join("\n"), /journal entries missing SQL files: 0001_stale_tag/);
  });

  it("detects duplicate and gapped indexes for SQL files and journal entries", () => {
    const fixture = makeFixture();
    writeMigration(fixture, "0000_initial_setup.sql");
    writeMigration(fixture, "0000_duplicate_setup.sql");
    writeMigration(fixture, "0002_add_matters.sql");
    writeJournal(fixture, [
      entry(0, "0000_initial_setup"),
      entry(0, "0000_duplicate_setup"),
      entry(2, "0002_add_matters"),
    ]);

    const report = checkMigrationParity(fixture);
    const failures = report.failures.join("\n");

    assert.equal(report.status, "failed");
    assert.match(failures, /SQL migration idx 0 is duplicated/);
    assert.match(failures, /SQL migration indexes must be contiguous from 0 through 2; missing 1/);
    assert.match(failures, /Journal idx 0 is duplicated/);
    assert.match(failures, /Journal indexes must be contiguous from 0 through 2; missing 1/);
  });

  it("detects invalid journal entry shape, tag/index mismatch, and non-increasing timestamps", () => {
    const fixture = makeFixture();
    writeMigration(fixture, "0000_initial_setup.sql");
    writeMigration(fixture, "0001_add_matters.sql");
    writeJournal(fixture, [
      { idx: 0, version: "7", when: 1000, tag: "0000_initial_setup", breakpoints: true },
      {
        idx: 1,
        version: "7",
        when: 1000,
        tag: "0002_add_matters",
        breakpoints: true,
      },
      { idx: "2", version: "7", when: 1002, tag: "bad-tag", breakpoints: "yes" },
    ]);

    const report = checkMigrationParity(fixture);
    const failures = report.failures.join("\n");

    assert.equal(report.status, "failed");
    assert.match(failures, /Journal entry 2 is invalid/);
    assert.match(failures, /tag 0002_add_matters does not match idx 1/);
    assert.match(failures, /non-increasing when 1000/);
  });

  it("collects SQL migrations in numeric order and reports invalid names separately", () => {
    const fixture = makeFixture();
    writeMigration(fixture, "0002_late.sql");
    writeMigration(fixture, "0000_first.sql");
    writeMigration(fixture, "bad.sql");

    const result = collectSqlMigrations(fixture);

    assert.deepEqual(
      result.migrations.map((migration) => migration.tag),
      ["0000_first", "0002_late"],
    );
    assert.deepEqual(result.invalidNames, ["bad.sql"]);
  });
});

describe("migration integrity replay", () => {
  it("runs parity before creating a disposable database", () => {
    const fixture = makeFixture();
    writeMigration(fixture, "0000_initial_setup.sql");
    writeJournal(fixture, [entry(0, "0000_stale_setup")]);
    const calls = [];

    assert.throws(
      () =>
        runMigrationReplay({
          ...fixture,
          databaseName: "open_practice_migration_replay_test",
          adminClient: "psql",
          spawn: (command, args) => {
            calls.push([command, args]);
            return { status: 0, stdout: "", stderr: "" };
          },
          env: {
            DATABASE_URL: "postgresql://open_practice:open_practice@localhost:35432/open_practice",
          },
        }),
      /Migration parity failed/,
    );
    assert.deepEqual(calls, []);
  });

  it("creates, migrates, and cleans up a local replay database", () => {
    const fixture = makeFixture();
    writeMigration(fixture, "0000_initial_setup.sql");
    writeJournal(fixture, [entry(0, "0000_initial_setup")]);
    const calls = [];
    const spawn = (command, args, options) => {
      calls.push({ command, args, env: options?.env });
      return { status: 0, stdout: "", stderr: "" };
    };

    const report = runMigrationReplay({
      ...fixture,
      databaseName: "open_practice_migration_replay_test",
      adminClient: "psql",
      spawn,
      env: {
        DATABASE_URL: "postgresql://open_practice:open_practice@localhost:35432/open_practice",
      },
    });

    assert.equal(report.status, "passed");
    assert.equal(report.adminClient, "psql");
    assert.deepEqual(
      calls.map((call) => [call.command, call.args[0], call.args.at(-1)]),
      [
        ["psql", "-v", 'CREATE DATABASE "open_practice_migration_replay_test"'],
        ["pnpm", "--filter", "db:migrate"],
        [
          "psql",
          "-v",
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'open_practice_migration_replay_test' AND pid <> pg_backend_pid()",
        ],
        [
          "psql",
          "-v",
          'DROP DATABASE IF EXISTS "open_practice_migration_replay_test" WITH (FORCE)',
        ],
      ],
    );
    assert.equal(
      calls[1].env.DATABASE_URL,
      "postgresql://open_practice:open_practice@localhost:35432/open_practice_migration_replay_test",
    );
  });

  it("cleans up the replay database when migration fails", () => {
    const fixture = makeFixture();
    writeMigration(fixture, "0000_initial_setup.sql");
    writeJournal(fixture, [entry(0, "0000_initial_setup")]);
    const calls = [];
    const spawn = (command, args, options) => {
      calls.push({ command, args, env: options?.env });
      if (command === "pnpm") {
        return { status: 1, stdout: "", stderr: "migration failed\n" };
      }
      return { status: 0, stdout: "", stderr: "" };
    };

    assert.throws(
      () =>
        runMigrationReplay({
          ...fixture,
          databaseName: "open_practice_migration_replay_test",
          adminClient: "psql",
          spawn,
          env: {
            DATABASE_URL: "postgresql://open_practice:open_practice@localhost:35432/open_practice",
          },
        }),
      /Migration replay failed/,
    );
    assert.equal(
      calls.at(-1).args.at(-1),
      'DROP DATABASE IF EXISTS "open_practice_migration_replay_test" WITH (FORCE)',
    );
  });

  it("refuses non-local database URLs", () => {
    const fixture = makeFixture();
    writeMigration(fixture, "0000_initial_setup.sql");
    writeJournal(fixture, [entry(0, "0000_initial_setup")]);

    assert.throws(
      () =>
        runMigrationReplay({
          ...fixture,
          databaseName: "open_practice_migration_replay_test",
          adminClient: "psql",
          spawn: () => ({ status: 0, stdout: "", stderr: "" }),
          env: {
            DATABASE_URL: "postgresql://open_practice:open_practice@example.com/open_practice",
          },
        }),
      /refuses non-local database host example\.com/,
    );
  });

  it("parses replay CLI options", () => {
    assert.deepEqual(
      parseArgs(["--mode", "replay", "--admin-client", "docker", "--keep-database"]),
      {
        mode: "replay",
        databaseUrl: null,
        databaseName: null,
        keepDatabase: true,
        adminClient: "docker",
      },
    );
  });
});
