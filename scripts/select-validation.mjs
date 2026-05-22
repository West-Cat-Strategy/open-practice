#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const COMMANDS = {
  apiTest: "pnpm --filter @open-practice/api test",
  apiTypecheck: "pnpm --filter @open-practice/api typecheck",
  build: "pnpm build",
  ciLocal: "pnpm ci:local",
  databaseCheck: "pnpm --filter @open-practice/database db:check",
  databaseTest: "pnpm --filter @open-practice/database test",
  databaseTypecheck: "pnpm --filter @open-practice/database typecheck",
  depsAudit: "pnpm deps:audit",
  depsLicenses: "pnpm deps:licenses",
  docsCheck: "pnpm docs:check",
  domainTest: "pnpm --filter @open-practice/domain test",
  domainTypecheck: "pnpm --filter @open-practice/domain typecheck",
  e2eDocker: "pnpm e2e:docker",
  e2eHost: "pnpm e2e:host",
  formatCheck: "pnpm format:check",
  migrationsCheck: "pnpm migrations:check",
  policyCheck: "pnpm policy:check",
  providersBuild: "pnpm --filter @open-practice/providers build",
  providersTest: "pnpm --filter @open-practice/providers test",
  providersTypecheck: "pnpm --filter @open-practice/providers typecheck",
  test: "pnpm test",
  webTest: "pnpm --filter @open-practice/web test",
  webTypecheck: "pnpm --filter @open-practice/web typecheck",
  workerBuild: "pnpm --filter @open-practice/worker build",
  workerTest: "pnpm --filter @open-practice/worker test",
  workerTypecheck: "pnpm --filter @open-practice/worker typecheck",
};

export const COMMAND_ORDER = [
  COMMANDS.ciLocal,
  COMMANDS.depsAudit,
  COMMANDS.depsLicenses,
  COMMANDS.e2eHost,
  COMMANDS.e2eDocker,
  COMMANDS.formatCheck,
  COMMANDS.docsCheck,
  COMMANDS.policyCheck,
  COMMANDS.test,
  COMMANDS.domainTest,
  COMMANDS.domainTypecheck,
  COMMANDS.databaseTest,
  COMMANDS.databaseCheck,
  COMMANDS.migrationsCheck,
  COMMANDS.databaseTypecheck,
  COMMANDS.apiTest,
  COMMANDS.apiTypecheck,
  COMMANDS.providersTest,
  COMMANDS.providersTypecheck,
  COMMANDS.providersBuild,
  COMMANDS.workerTest,
  COMMANDS.workerTypecheck,
  COMMANDS.workerBuild,
  COMMANDS.webTest,
  COMMANDS.webTypecheck,
  COMMANDS.build,
];

export function usage() {
  return [
    "Usage:",
    "  node scripts/select-validation.mjs [--strict] --base <git-ref>",
    "  node scripts/select-validation.mjs [--strict] --files <paths...>",
    "  node scripts/select-validation.mjs [--strict] --dirty",
  ].join("\n");
}

export function parseArgs(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let base = null;
  let files = null;
  let dirty = false;
  let strict = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    if (arg === "--strict") {
      strict = true;
      continue;
    }

    if (arg === "--base") {
      if (base !== null || files !== null || dirty) {
        throw new Error("Use exactly one input mode: --base, --files, or --dirty.");
      }

      base = args[index + 1];
      index += 1;

      if (!base || base.startsWith("--")) {
        throw new Error("--base requires a git ref.");
      }

      continue;
    }

    if (arg === "--files") {
      if (base !== null || files !== null || dirty) {
        throw new Error("Use exactly one input mode: --base, --files, or --dirty.");
      }

      files = args.slice(index + 1);
      break;
    }

    if (arg === "--dirty") {
      if (base !== null || files !== null || dirty) {
        throw new Error("Use exactly one input mode: --base, --files, or --dirty.");
      }

      dirty = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (base === null && files === null && !dirty) {
    throw new Error("Missing input mode.");
  }

  if (files !== null && files.length === 0) {
    throw new Error("--files requires at least one path.");
  }

  return { mode: dirty ? "dirty" : base === null ? "files" : "base", base, files, strict };
}

function lines(output) {
  return output.split("\n").filter(Boolean);
}

export function changedFilesFromBase(base, exec = execFileSync) {
  const output = exec("git", ["diff", "--name-only", `${base}...HEAD`], {
    encoding: "utf8",
  });

  return lines(output);
}

export function changedFilesFromDirty(exec = execFileSync) {
  return [
    ...lines(exec("git", ["diff", "--name-only"], { encoding: "utf8" })),
    ...lines(exec("git", ["diff", "--name-only", "--cached"], { encoding: "utf8" })),
    ...lines(exec("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" })),
  ];
}

export function normalizePath(path, cwd = process.cwd()) {
  const trimmed = path
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "");

  if (!trimmed) return "";

  const normalizedCwd = cwd.replaceAll("\\", "/");
  const absolutePrefix = `${normalizedCwd}/`;

  if (trimmed === normalizedCwd) return "";
  if (trimmed.startsWith(absolutePrefix)) {
    return relative(cwd, resolve(trimmed)).replaceAll("\\", "/");
  }

  return trimmed;
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
    /^playwright\.config\.(?:[cm]?[jt]s)$/.test(path) ||
    path === ".prettierrc" ||
    path.startsWith(".prettierrc.") ||
    path === ".npmrc" ||
    path.startsWith(".github/") ||
    path.startsWith(".circleci/") ||
    path.startsWith("ci/")
  );
}

function isDependencyManifest(path) {
  return path === "package.json" || path.endsWith("/package.json") || path === "pnpm-lock.yaml";
}

function isRuntimeConfig(path) {
  return (
    path === "Dockerfile" ||
    path.startsWith("Dockerfile.") ||
    path === "docker-compose.yml" ||
    path.startsWith("docker-compose.") ||
    path.startsWith("docker/") ||
    path === ".env.example" ||
    path.endsWith(".env.example")
  );
}

function isMigration(path) {
  return path === "migrations" || path.startsWith("migrations/") || path.includes("/migrations/");
}

function isDomainSource(path) {
  return path.startsWith("packages/domain/src/");
}

function isE2EPath(path) {
  return (
    path === "e2e" || path.startsWith("e2e/") || /^playwright\.config\.(?:[cm]?[jt]s)$/.test(path)
  );
}

export function normalizePaths(paths, cwd = process.cwd()) {
  return [...new Set(paths.map((path) => normalizePath(path, cwd)).filter(Boolean))].sort();
}

export function classifyPath(path) {
  const commands = new Set();

  if (path.startsWith("apps/api/")) {
    commands.add(COMMANDS.apiTest);
    commands.add(COMMANDS.apiTypecheck);
    commands.add(COMMANDS.policyCheck);
  }

  if (path.startsWith("apps/worker/")) {
    commands.add(COMMANDS.workerTest);
    commands.add(COMMANDS.workerTypecheck);
    commands.add(COMMANDS.workerBuild);
    commands.add(COMMANDS.policyCheck);
  }

  if (path.startsWith("packages/domain/")) {
    commands.add(COMMANDS.domainTest);
    commands.add(COMMANDS.domainTypecheck);

    if (isDomainSource(path)) {
      commands.add(COMMANDS.apiTest);
      commands.add(COMMANDS.providersTest);
      commands.add(COMMANDS.workerTest);
    }
  }

  if (path.startsWith("packages/database/") || isMigration(path)) {
    commands.add(COMMANDS.databaseTest);
    commands.add(COMMANDS.databaseCheck);
    commands.add(COMMANDS.migrationsCheck);
    commands.add(COMMANDS.databaseTypecheck);
    commands.add(COMMANDS.apiTest);
  }

  if (path.startsWith("packages/providers/")) {
    commands.add(COMMANDS.providersTest);
    commands.add(COMMANDS.providersTypecheck);
    commands.add(COMMANDS.providersBuild);
    commands.add(COMMANDS.apiTest);
    commands.add(COMMANDS.workerTest);
    commands.add(COMMANDS.workerTypecheck);
  }

  if (path.startsWith("apps/web/")) {
    commands.add(COMMANDS.webTest);
    commands.add(COMMANDS.webTypecheck);
    commands.add(COMMANDS.build);
  }

  if (isE2EPath(path)) {
    commands.add(COMMANDS.e2eHost);
    commands.add(COMMANDS.e2eDocker);
  }

  if (path.startsWith("docs/")) {
    commands.add(COMMANDS.formatCheck);
    commands.add(COMMANDS.docsCheck);
    commands.add(COMMANDS.policyCheck);
  }

  if (path === "scripts" || path.startsWith("scripts/")) {
    commands.add(COMMANDS.policyCheck);
    commands.add(COMMANDS.test);
  }

  if (isRootConfig(path)) {
    commands.add(COMMANDS.ciLocal);
  }

  if (isDependencyManifest(path)) {
    commands.add(COMMANDS.depsAudit);
    commands.add(COMMANDS.depsLicenses);
  }

  if (isRuntimeConfig(path)) {
    commands.add(COMMANDS.formatCheck);
    commands.add(COMMANDS.docsCheck);
    commands.add(COMMANDS.policyCheck);
    commands.add(COMMANDS.build);
  }

  return { commands: [...commands], known: commands.size > 0 };
}

export function selectCommands(paths, { strict = false } = {}) {
  const selected = new Set();
  const unknownPaths = [];

  for (const path of paths) {
    const classification = classifyPath(path);
    for (const command of classification.commands) selected.add(command);
    if (!classification.known) unknownPaths.push(path);
  }

  if (strict && unknownPaths.length > 0) {
    throw new Error(`No validation mapping for path(s): ${unknownPaths.join(", ")}`);
  }

  return COMMAND_ORDER.filter((command) => selected.has(command));
}

export function resolveInputFiles(options, exec = execFileSync) {
  if (options.mode === "base") return changedFilesFromBase(options.base, exec);
  if (options.mode === "dirty") return changedFilesFromDirty(exec);
  return options.files;
}

export function formatRecommendedCommands(commands) {
  const lines = ["Recommended validation commands:"];

  if (commands.length === 0) {
    lines.push("(none)");
  } else {
    lines.push(...commands);
  }

  return lines.join("\n");
}

export function runSelector(rawArgs, { cwd = process.cwd(), exec = execFileSync } = {}) {
  const options = parseArgs(rawArgs);
  const inputFiles = resolveInputFiles(options, exec);
  const paths = normalizePaths(inputFiles, cwd);
  return selectCommands(paths, { strict: options.strict });
}

export function runCli(rawArgs = process.argv.slice(2)) {
  const commands = runSelector(rawArgs);
  console.log(formatRecommendedCommands(commands));
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
