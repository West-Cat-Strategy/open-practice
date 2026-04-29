#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const COMMANDS = {
  apiTest: "pnpm --filter @open-practice/api test",
  apiTypecheck: "pnpm --filter @open-practice/api typecheck",
  build: "pnpm build",
  ciLocal: "pnpm ci:local",
  databaseCheck: "pnpm --filter @open-practice/database db:check",
  databaseTest: "pnpm --filter @open-practice/database test",
  databaseTypecheck: "pnpm --filter @open-practice/database typecheck",
  docsCheck: "pnpm docs:check",
  domainTest: "pnpm --filter @open-practice/domain test",
  domainTypecheck: "pnpm --filter @open-practice/domain typecheck",
  formatCheck: "pnpm format:check",
  policyCheck: "pnpm policy:check",
  test: "pnpm test",
  webTest: "pnpm --filter @open-practice/web test",
  webTypecheck: "pnpm --filter @open-practice/web typecheck",
};

const COMMAND_ORDER = [
  COMMANDS.ciLocal,
  COMMANDS.formatCheck,
  COMMANDS.docsCheck,
  COMMANDS.policyCheck,
  COMMANDS.test,
  COMMANDS.domainTest,
  COMMANDS.domainTypecheck,
  COMMANDS.databaseTest,
  COMMANDS.databaseCheck,
  COMMANDS.databaseTypecheck,
  COMMANDS.apiTest,
  COMMANDS.apiTypecheck,
  COMMANDS.webTest,
  COMMANDS.webTypecheck,
  COMMANDS.build,
];

function usage() {
  return [
    "Usage:",
    "  node scripts/select-validation.mjs --base <git-ref>",
    "  node scripts/select-validation.mjs --files <paths...>",
  ].join("\n");
}

function parseArgs(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let base = null;
  let files = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    if (arg === "--base") {
      if (base !== null || files !== null) {
        throw new Error("Use exactly one input mode: --base or --files.");
      }

      base = args[index + 1];
      index += 1;

      if (!base || base.startsWith("--")) {
        throw new Error("--base requires a git ref.");
      }

      continue;
    }

    if (arg === "--files") {
      if (base !== null || files !== null) {
        throw new Error("Use exactly one input mode: --base or --files.");
      }

      files = args.slice(index + 1);
      break;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (base === null && files === null) {
    throw new Error("Missing input mode.");
  }

  if (files !== null && files.length === 0) {
    throw new Error("--files requires at least one path.");
  }

  return { base, files };
}

function changedFilesFromBase(base) {
  const output = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
    encoding: "utf8",
  });

  return output.split("\n");
}

function normalizePath(path) {
  return path
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "");
}

function isRootConfig(path) {
  return (
    path === "package.json" ||
    path === "pnpm-lock.yaml" ||
    path === "pnpm-workspace.yaml" ||
    path === "turbo.json" ||
    /^tsconfig(?:\.[^/]+)?\.json$/.test(path) ||
    /^eslint\.config\.[cm]?js$/.test(path) ||
    /^prettier\.config\.[cm]?js$/.test(path) ||
    path === ".prettierrc" ||
    path.startsWith(".prettierrc.") ||
    path === ".npmrc" ||
    path.startsWith(".github/") ||
    path.startsWith(".circleci/") ||
    path.startsWith("ci/")
  );
}

function isMigration(path) {
  return path === "migrations" || path.startsWith("migrations/") || path.includes("/migrations/");
}

function isDomainSource(path) {
  return path.startsWith("packages/domain/src/");
}

function selectCommands(paths) {
  const selected = new Set();

  for (const path of paths) {
    if (path.startsWith("apps/api/")) {
      selected.add(COMMANDS.apiTest);
      selected.add(COMMANDS.apiTypecheck);
      selected.add(COMMANDS.policyCheck);
    }

    if (path.startsWith("packages/domain/")) {
      selected.add(COMMANDS.domainTest);
      selected.add(COMMANDS.domainTypecheck);

      if (isDomainSource(path)) {
        selected.add(COMMANDS.apiTest);
      }
    }

    if (path.startsWith("packages/database/") || isMigration(path)) {
      selected.add(COMMANDS.databaseTest);
      selected.add(COMMANDS.databaseCheck);
      selected.add(COMMANDS.databaseTypecheck);
      selected.add(COMMANDS.apiTest);
    }

    if (path.startsWith("apps/web/")) {
      selected.add(COMMANDS.webTest);
      selected.add(COMMANDS.webTypecheck);
      selected.add(COMMANDS.build);
    }

    if (path.startsWith("docs/")) {
      selected.add(COMMANDS.formatCheck);
      selected.add(COMMANDS.docsCheck);
      selected.add(COMMANDS.policyCheck);
    }

    if (path.startsWith("scripts/")) {
      selected.add(COMMANDS.policyCheck);
      selected.add(COMMANDS.test);
    }

    if (isRootConfig(path)) {
      selected.add(COMMANDS.ciLocal);
    }
  }

  return COMMAND_ORDER.filter((command) => selected.has(command));
}

try {
  const { base, files } = parseArgs(process.argv.slice(2));
  const inputFiles = base === null ? files : changedFilesFromBase(base);
  const paths = [...new Set(inputFiles.map(normalizePath).filter(Boolean))].sort();
  const commands = selectCommands(paths);

  console.log("Recommended validation commands:");

  if (commands.length === 0) {
    console.log("(none)");
  } else {
    for (const command of commands) {
      console.log(command);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exit(1);
}
