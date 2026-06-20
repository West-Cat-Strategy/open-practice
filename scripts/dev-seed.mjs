#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SEED_EVAL = [
  "import { createDatabaseRuntime } from '@open-practice/database/runtime';",
  "import { seedSampleData } from '@open-practice/database/seed';",
  "const databaseUrl = process.env.DATABASE_URL;",
  "if (!databaseUrl) throw new Error('DATABASE_URL is required for dev:seed.');",
  "const runtime = createDatabaseRuntime(databaseUrl);",
  "try { await seedSampleData(runtime.db); } finally { await runtime.close(); }",
  "console.log('Seeded Open Practice synthetic sample data.');",
].join("\n");

export function usage() {
  return [
    "Usage:",
    "  node scripts/dev-seed.mjs [--database-url <url>] [--skip-build]",
    "",
    "Seeds the configured local PostgreSQL database with existing synthetic sample data.",
  ].join("\n");
}

export function parseArgs(rawArgs) {
  const args = rawArgs.filter((arg) => arg !== "--");
  const options = { databaseUrl: null, skipBuild: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") return { ...options, help: true };
    if (arg === "--skip-build") {
      options.skipBuild = true;
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
    throw new Error(`Unknown dev-seed argument: ${arg}`);
  }
  return options;
}

export function seedCommands({ skipBuild = false } = {}) {
  return [
    ...(skipBuild
      ? []
      : [
          { command: "pnpm", args: ["--filter", "@open-practice/domain", "build"] },
          { command: "pnpm", args: ["--filter", "@open-practice/database", "build"] },
        ]),
    { command: "node", args: ["--input-type=module", "--eval", SEED_EVAL] },
  ];
}

export function runDevSeed(
  rawArgs = process.argv.slice(2),
  { env = process.env, spawn = spawnSync } = {},
) {
  const options = parseArgs(rawArgs);
  if (options.help) {
    console.log(usage());
    return 0;
  }
  const databaseUrl = options.databaseUrl ?? env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for dev:seed.");

  for (const command of seedCommands({ skipBuild: options.skipBuild })) {
    const result = spawn(command.command, command.args, {
      stdio: "inherit",
      env: { ...env, DATABASE_URL: databaseUrl },
    });
    if ((result.status ?? 1) !== 0) return result.status ?? 1;
  }
  return 0;
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  try {
    process.exitCode = runDevSeed();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  }
}
