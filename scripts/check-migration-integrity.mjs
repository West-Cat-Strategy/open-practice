#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_MIGRATIONS_DIR = "packages/database/migrations";
const DEFAULT_JOURNAL_PATH = "packages/database/migrations/meta/_journal.json";
const DEFAULT_LOCAL_DATABASE_URL =
  "postgresql://open_practice:open_practice@localhost:35432/open_practice";
const MIGRATION_FILE_RE = /^(\d{4})_[a-z0-9][a-z0-9_]*\.sql$/;
const MIGRATION_TAG_RE = /^(\d{4})_[a-z0-9][a-z0-9_]*$/;
const REPLAY_DATABASE_RE = /^open_practice_migration_replay_[a-z0-9_]+$/;
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);

function repoRootFromModule() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeJsonType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

export function collectSqlMigrations({ rootDir = repoRootFromModule(), migrationsDir = DEFAULT_MIGRATIONS_DIR } = {}) {
  const absoluteMigrationsDir = path.resolve(rootDir, migrationsDir);
  const invalidNames = [];
  const migrations = [];

  for (const entry of readdirSync(absoluteMigrationsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) continue;

    const match = MIGRATION_FILE_RE.exec(entry.name);
    if (!match) {
      invalidNames.push(entry.name);
      continue;
    }

    const idx = Number(match[1]);
    migrations.push({
      idx,
      tag: entry.name.slice(0, -".sql".length),
      file: entry.name,
      path: path.join(migrationsDir, entry.name).replaceAll("\\", "/"),
    });
  }

  migrations.sort((left, right) => left.idx - right.idx || left.tag.localeCompare(right.tag));
  invalidNames.sort();

  return { migrations, invalidNames };
}

function validateIndexSequence(items, { label, failures }) {
  const byIndex = new Map();

  for (const item of items) {
    if (!Number.isInteger(item.idx) || item.idx < 0) continue;
    const existing = byIndex.get(item.idx) ?? [];
    existing.push(item);
    byIndex.set(item.idx, existing);
  }

  for (const [idx, duplicates] of byIndex) {
    if (duplicates.length > 1) {
      failures.push(
        `${label} idx ${idx} is duplicated by ${duplicates.map((item) => item.tag ?? item.file ?? "<unknown>").join(", ")}.`,
      );
    }
  }

  const sortedIndexes = [...byIndex.keys()].sort((left, right) => left - right);
  const expectedLength = items.length;
  const missing = [];

  for (let idx = 0; idx < expectedLength; idx += 1) {
    if (!byIndex.has(idx)) missing.push(idx);
  }

  const outOfRange = sortedIndexes.filter((idx) => idx >= expectedLength);

  if (missing.length > 0 || outOfRange.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`missing ${missing.join(", ")}`);
    if (outOfRange.length > 0) parts.push(`out-of-range ${outOfRange.join(", ")}`);
    failures.push(`${label} indexes must be contiguous from 0 through ${expectedLength - 1}; ${parts.join("; ")}.`);
  }
}

function validateJournalShape(journal, failures) {
  if (!isPlainObject(journal)) {
    failures.push(`Journal root must be an object, got ${safeJsonType(journal)}.`);
    return [];
  }

  if (typeof journal.version !== "string" || journal.version.length === 0) {
    failures.push("Journal root version must be a non-empty string.");
  }

  if (journal.dialect !== "postgresql") {
    failures.push('Journal root dialect must be "postgresql".');
  }

  if (!Array.isArray(journal.entries)) {
    failures.push("Journal entries must be an array.");
    return [];
  }

  const validEntries = [];
  const expectedKeys = ["breakpoints", "idx", "tag", "version", "when"];

  journal.entries.forEach((entry, position) => {
    const label = `Journal entry ${position}`;

    if (!isPlainObject(entry)) {
      failures.push(`${label} must be an object, got ${safeJsonType(entry)}.`);
      return;
    }

    const keys = Object.keys(entry).sort();
    if (keys.join(",") !== expectedKeys.join(",")) {
      failures.push(`${label} must contain exactly ${expectedKeys.join(", ")}.`);
      return;
    }

    const entryFailures = [];

    if (!Number.isInteger(entry.idx) || entry.idx < 0) {
      entryFailures.push("idx must be a non-negative integer");
    }

    if (entry.version !== journal.version) {
      entryFailures.push(`version must match journal version ${journal.version}`);
    }

    if (!Number.isSafeInteger(entry.when) || entry.when <= 0) {
      entryFailures.push("when must be a positive safe integer");
    }

    if (typeof entry.tag !== "string" || !MIGRATION_TAG_RE.test(entry.tag)) {
      entryFailures.push("tag must match NNNN_lowercase_slug");
    }

    if (typeof entry.breakpoints !== "boolean") {
      entryFailures.push("breakpoints must be boolean");
    }

    if (entryFailures.length > 0) {
      failures.push(`${label} is invalid: ${entryFailures.join("; ")}.`);
      return;
    }

    validEntries.push({ ...entry, position });
  });

  return validEntries;
}

function validateJournalEntries(entries, failures) {
  validateIndexSequence(entries, { label: "Journal", failures });

  for (const entry of entries) {
    if (entry.idx !== entry.position) {
      failures.push(`Journal entry ${entry.position} has idx ${entry.idx}; entries must be ordered by idx.`);
    }

    const tagIndex = Number(entry.tag.slice(0, 4));
    if (tagIndex !== entry.idx) {
      failures.push(`Journal entry ${entry.position} tag ${entry.tag} does not match idx ${entry.idx}.`);
    }
  }

  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];

    if (current.when <= previous.when) {
      failures.push(
        `Journal entry ${current.tag} has non-increasing when ${current.when}; previous ${previous.tag} has ${previous.when}.`,
      );
    }
  }
}

function validateSqlMigrations({ migrations, invalidNames }, failures) {
  if (invalidNames.length > 0) {
    failures.push(`Unrecognized SQL migration ${pluralize(invalidNames.length, "name")}: ${invalidNames.join(", ")}.`);
  }

  validateIndexSequence(migrations, { label: "SQL migration", failures });

  for (const migration of migrations) {
    const tagIndex = Number(migration.tag.slice(0, 4));
    if (tagIndex !== migration.idx) {
      failures.push(`SQL migration ${migration.file} tag prefix does not match parsed idx ${migration.idx}.`);
    }
  }
}

function validateSqlJournalParity(migrations, entries, failures) {
  const sqlTags = migrations.map((migration) => migration.tag);
  const journalTags = entries.map((entry) => entry.tag);
  const sqlTagSet = new Set(sqlTags);
  const journalTagSet = new Set(journalTags);
  const missingJournalEntries = sqlTags.filter((tag) => !journalTagSet.has(tag));
  const missingSqlFiles = journalTags.filter((tag) => !sqlTagSet.has(tag));

  if (missingJournalEntries.length > 0) {
    failures.push(`SQL/journal drift: SQL files missing journal entries: ${missingJournalEntries.join(", ")}.`);
  }

  if (missingSqlFiles.length > 0) {
    failures.push(`SQL/journal drift: journal entries missing SQL files: ${missingSqlFiles.join(", ")}.`);
  }

  if (
    missingJournalEntries.length === 0 &&
    missingSqlFiles.length === 0 &&
    sqlTags.join("\n") !== journalTags.join("\n")
  ) {
    failures.push("SQL/journal drift: SQL migration order does not match journal order.");
  }
}

export function checkMigrationParity({
  rootDir = repoRootFromModule(),
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  journalPath = DEFAULT_JOURNAL_PATH,
} = {}) {
  const failures = [];
  const sql = collectSqlMigrations({ rootDir, migrationsDir });
  const journal = readJson(path.resolve(rootDir, journalPath));
  const journalEntries = validateJournalShape(journal, failures);

  validateSqlMigrations(sql, failures);
  validateJournalEntries(journalEntries, failures);
  validateSqlJournalParity(sql.migrations, journalEntries, failures);

  return {
    status: failures.length === 0 ? "passed" : "failed",
    failures,
    sqlMigrations: sql.migrations,
    invalidSqlNames: sql.invalidNames,
    journalEntries,
    migrationsDir,
    journalPath,
  };
}

export function formatParityReport(report) {
  if (report.status === "passed") {
    return `Migration parity passed: ${report.sqlMigrations.length} SQL ${pluralize(
      report.sqlMigrations.length,
      "file",
    )} match ${report.journalEntries.length} journal ${pluralize(report.journalEntries.length, "entry", "entries")}.`;
  }

  return ["Migration parity failed:", ...report.failures.map((failure) => `- ${failure}`)].join("\n");
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function migrationReplayDatabaseName(now = new Date(), pid = process.pid) {
  const timestamp = now
    .toISOString()
    .replace(/\.\d{3}Z$/, "")
    .replaceAll(/[^0-9]/g, "");
  return `open_practice_migration_replay_${pid}_${timestamp}`.slice(0, 63);
}

function assertReplayDatabaseName(databaseName) {
  if (!REPLAY_DATABASE_RE.test(databaseName) || databaseName.length > 63) {
    throw new Error(
      `Replay database name must match ${REPLAY_DATABASE_RE} and fit PostgreSQL's 63-byte identifier limit.`,
    );
  }
}

function resolveReplayDatabaseUrl(input, env = process.env) {
  return (
    input ??
    env.MIGRATION_REPLAY_DATABASE_URL ??
    env.DATABASE_URL ??
    DEFAULT_LOCAL_DATABASE_URL
  );
}

function assertLocalDatabaseUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("Migration replay requires a postgres:// or postgresql:// database URL.");
  }

  if (!LOCAL_DATABASE_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `Migration replay refuses non-local database host ${parsed.hostname}; use a local disposable Postgres server.`,
    );
  }

  return parsed;
}

function withDatabaseName(databaseUrl, databaseName) {
  const parsed = new URL(databaseUrl.toString());
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

function redactDatabaseUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.password) parsed.password = "***";
  return parsed.toString();
}

function spawnChecked(spawn, command, args, options, failureMessage) {
  const result = spawn(command, args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });

  if ((result.status ?? 1) !== 0) {
    const detail = [result.stderr, result.stdout, result.error?.message]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(detail ? `${failureMessage}\n${detail}` : failureMessage);
  }

  return result;
}

function chooseAdminClient({ requestedClient, spawn, cwd }) {
  if (requestedClient !== "auto") return requestedClient;

  const psql = spawn("psql", ["--version"], { cwd, encoding: "utf8" });
  if ((psql.status ?? 1) === 0) return "psql";

  const docker = spawn("docker", ["compose", "version"], { cwd, encoding: "utf8" });
  if ((docker.status ?? 1) === 0) return "docker";

  throw new Error(
    "Migration replay requires either local psql or Docker Compose access to the postgres service.",
  );
}

function dockerPsqlArgs(databaseUrl, sql) {
  const parsed = new URL(databaseUrl);
  const user = decodeURIComponent(parsed.username || "open_practice");
  const database = decodeURIComponent(parsed.pathname.slice(1) || "open_practice");
  return [
    "compose",
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    user,
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ];
}

function runAdminSql({ adminClient, databaseUrl, sql, spawn, cwd }) {
  if (adminClient === "psql") {
    return spawnChecked(
      spawn,
      "psql",
      ["-v", "ON_ERROR_STOP=1", databaseUrl, "-c", sql],
      { cwd },
      "Failed to run migration replay admin SQL.",
    );
  }

  if (adminClient === "docker") {
    return spawnChecked(
      spawn,
      "docker",
      dockerPsqlArgs(databaseUrl, sql),
      { cwd },
      "Failed to run migration replay admin SQL through Docker Compose.",
    );
  }

  throw new Error(`Unknown migration replay admin client: ${adminClient}`);
}

export function runMigrationReplay({
  rootDir = repoRootFromModule(),
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  journalPath = DEFAULT_JOURNAL_PATH,
  databaseUrl,
  databaseName = migrationReplayDatabaseName(),
  keepDatabase = false,
  adminClient = "auto",
  spawn = spawnSync,
  env = process.env,
} = {}) {
  const parity = checkMigrationParity({ rootDir, migrationsDir, journalPath });
  if (parity.status !== "passed") {
    throw new Error(formatParityReport(parity));
  }

  assertReplayDatabaseName(databaseName);
  const baseDatabaseUrl = assertLocalDatabaseUrl(resolveReplayDatabaseUrl(databaseUrl, env));
  const targetDatabaseUrl = withDatabaseName(baseDatabaseUrl, databaseName);
  const resolvedAdminClient = chooseAdminClient({ requestedClient: adminClient, spawn, cwd: rootDir });
  const cleanupSql = [
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${quoteLiteral(
      databaseName,
    )} AND pid <> pg_backend_pid()`,
    `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`,
  ];
  const commands = [];
  let created = false;
  let migrationResult = null;
  let cleanupError = null;

  try {
    runAdminSql({
      adminClient: resolvedAdminClient,
      databaseUrl: baseDatabaseUrl.toString(),
      sql: `CREATE DATABASE ${quoteIdentifier(databaseName)}`,
      spawn,
      cwd: rootDir,
    });
    commands.push({ id: "create-database", status: 0 });
    created = true;

    migrationResult = spawn("pnpm", ["--filter", "@open-practice/database", "db:migrate"], {
      cwd: rootDir,
      encoding: "utf8",
      env: { ...env, DATABASE_URL: targetDatabaseUrl },
      maxBuffer: 128 * 1024 * 1024,
    });
    commands.push({
      id: "drizzle-migrate",
      status: migrationResult.status ?? 1,
      signal: migrationResult.signal ?? null,
    });

    if ((migrationResult.status ?? 1) !== 0) {
      const detail = [migrationResult.stderr, migrationResult.stdout, migrationResult.error?.message]
        .filter(Boolean)
        .join("\n")
        .trim();
      throw new Error(detail ? `Migration replay failed.\n${detail}` : "Migration replay failed.");
    }
  } finally {
    if (created && !keepDatabase) {
      try {
        for (const sql of cleanupSql) {
          runAdminSql({
            adminClient: resolvedAdminClient,
            databaseUrl: baseDatabaseUrl.toString(),
            sql,
            spawn,
            cwd: rootDir,
          });
        }
        commands.push({ id: "cleanup-database", status: 0 });
      } catch (error) {
        cleanupError = error;
        commands.push({ id: "cleanup-database", status: 1 });
      }
    }
  }

  if (cleanupError) {
    throw cleanupError;
  }

  return {
    status: "passed",
    databaseName,
    databaseUrl: redactDatabaseUrl(targetDatabaseUrl),
    adminClient: resolvedAdminClient,
    keptDatabase: keepDatabase,
    parity,
    commands,
  };
}

export function formatReplayReport(report) {
  return [
    `Migration replay passed: ${report.parity.sqlMigrations.length} migrations applied to disposable database ${report.databaseName}.`,
    `Admin client: ${report.adminClient}`,
    `Database cleaned up: ${report.keptDatabase ? "no" : "yes"}`,
  ].join("\n");
}

export function usage() {
  return [
    "Usage:",
    "  node scripts/check-migration-integrity.mjs [--mode parity]",
    "  node scripts/check-migration-integrity.mjs --mode replay [--database-url URL] [--database-name NAME] [--admin-client auto|psql|docker] [--keep-database]",
  ].join("\n");
}

export function parseArgs(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  const options = {
    mode: "parity",
    databaseUrl: null,
    databaseName: null,
    keepDatabase: false,
    adminClient: "auto",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      return { ...options, help: true };
    }

    if (arg === "parity" || arg === "replay") {
      options.mode = arg;
      continue;
    }

    if (arg === "--mode") {
      const mode = args[index + 1];
      index += 1;
      if (mode !== "parity" && mode !== "replay") throw new Error("--mode must be parity or replay.");
      options.mode = mode;
      continue;
    }

    if (arg === "--database-url") {
      options.databaseUrl = args[index + 1];
      index += 1;
      if (!options.databaseUrl || options.databaseUrl.startsWith("--")) {
        throw new Error("--database-url requires a value.");
      }
      continue;
    }

    if (arg === "--database-name") {
      options.databaseName = args[index + 1];
      index += 1;
      if (!options.databaseName || options.databaseName.startsWith("--")) {
        throw new Error("--database-name requires a value.");
      }
      continue;
    }

    if (arg === "--admin-client") {
      options.adminClient = args[index + 1];
      index += 1;
      if (!["auto", "psql", "docker"].includes(options.adminClient)) {
        throw new Error("--admin-client must be auto, psql, or docker.");
      }
      continue;
    }

    if (arg === "--keep-database") {
      options.keepDatabase = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

export function runCli(rawArgs = process.argv.slice(2), runnerOptions = {}) {
  const options = parseArgs(rawArgs);

  if (options.help) {
    console.log(usage());
    return { status: "help" };
  }

  if (options.mode === "parity") {
    const report = checkMigrationParity(runnerOptions);
    console.log(formatParityReport(report));
    if (report.status !== "passed") process.exitCode = 1;
    return report;
  }

  const report = runMigrationReplay({
    ...runnerOptions,
    databaseUrl: options.databaseUrl,
    databaseName: options.databaseName ?? undefined,
    keepDatabase: options.keepDatabase,
    adminClient: options.adminClient,
  });
  console.log(formatReplayReport(report));
  return report;
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  }
}
