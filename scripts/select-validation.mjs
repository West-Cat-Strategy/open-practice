#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const COMMANDS = {
  apiContract: "pnpm api:contract",
  apiTest: "pnpm --filter @open-practice/api test",
  apiTypecheck: "pnpm --filter @open-practice/api typecheck",
  architectureCheck: "pnpm architecture:check",
  build: "pnpm build",
  ciLocal: "pnpm ci:local",
  databaseBuild: "pnpm --filter @open-practice/database build",
  databaseCheck: "pnpm --filter @open-practice/database db:check",
  databaseTest: "pnpm --filter @open-practice/database test",
  databaseTypecheck: "pnpm --filter @open-practice/database typecheck",
  depsAudit: "pnpm deps:audit",
  depsLicenses: "pnpm deps:licenses",
  depsOsv: "pnpm deps:osv",
  depsSupplyChain: "pnpm deps:supply-chain",
  dockerLint: "pnpm docker:lint",
  dockerScan: "pnpm docker:scan",
  dockerAppSmoke: "pnpm docker:app-smoke",
  dockerResidualWatch: "pnpm docker:residual-watch",
  docsCheck: "pnpm docs:check",
  domainBuild: "pnpm --filter @open-practice/domain build",
  domainTest: "pnpm --filter @open-practice/domain test",
  domainTypecheck: "pnpm --filter @open-practice/domain typecheck",
  e2eA11y: "pnpm e2e:a11y",
  e2eClientPortal: "pnpm e2e:client-portal",
  e2eDocker: "pnpm e2e:docker",
  e2eFirstRun: "node scripts/run-e2e.mjs first-run",
  e2eHost: "pnpm e2e:host",
  e2eMatterless: "pnpm e2e:matterless",
  formatCheck: "pnpm format:check",
  licenseScan: "pnpm license:scan",
  migrationsCheck: "pnpm migrations:check",
  migrationsLint: "pnpm migrations:lint",
  policyCheck: "pnpm policy:check",
  providersBuild: "pnpm --filter @open-practice/providers build",
  providersTest: "pnpm --filter @open-practice/providers test",
  providersTypecheck: "pnpm --filter @open-practice/providers typecheck",
  securityPrivacyRules: "pnpm security:privacy-rules",
  securityReview: "pnpm security:review",
  securitySecretsHistory: "pnpm security:secrets-history",
  selfhostCheck:
    "pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example",
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
  COMMANDS.depsSupplyChain,
  COMMANDS.depsOsv,
  COMMANDS.licenseScan,
  COMMANDS.securityReview,
  COMMANDS.securitySecretsHistory,
  COMMANDS.securityPrivacyRules,
  COMMANDS.architectureCheck,
  COMMANDS.apiContract,
  COMMANDS.dockerLint,
  COMMANDS.dockerResidualWatch,
  COMMANDS.dockerAppSmoke,
  COMMANDS.dockerScan,
  COMMANDS.selfhostCheck,
  COMMANDS.e2eHost,
  COMMANDS.e2eDocker,
  COMMANDS.e2eFirstRun,
  COMMANDS.e2eMatterless,
  COMMANDS.e2eClientPortal,
  COMMANDS.e2eA11y,
  COMMANDS.formatCheck,
  COMMANDS.docsCheck,
  COMMANDS.policyCheck,
  COMMANDS.test,
  COMMANDS.domainTest,
  COMMANDS.domainTypecheck,
  COMMANDS.domainBuild,
  COMMANDS.databaseTest,
  COMMANDS.databaseCheck,
  COMMANDS.migrationsCheck,
  COMMANDS.migrationsLint,
  COMMANDS.databaseTypecheck,
  COMMANDS.databaseBuild,
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
    "  node scripts/select-validation.mjs [--strict] --base-plus-dirty <git-ref>",
    "  node scripts/select-validation.mjs [--strict] --files <paths...>",
    "  node scripts/select-validation.mjs [--strict] --dirty",
  ].join("\n");
}

export function parseArgs(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let base = null;
  let basePlusDirty = null;
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
      if (base !== null || basePlusDirty !== null || files !== null || dirty) {
        throw new Error(
          "Use exactly one input mode: --base, --base-plus-dirty, --files, or --dirty.",
        );
      }

      base = args[index + 1];
      index += 1;

      if (!base || base.startsWith("--")) {
        throw new Error("--base requires a git ref.");
      }

      continue;
    }

    if (arg === "--base-plus-dirty") {
      if (base !== null || basePlusDirty !== null || files !== null || dirty) {
        throw new Error(
          "Use exactly one input mode: --base, --base-plus-dirty, --files, or --dirty.",
        );
      }

      basePlusDirty = args[index + 1];
      index += 1;

      if (!basePlusDirty || basePlusDirty.startsWith("--")) {
        throw new Error("--base-plus-dirty requires a git ref.");
      }

      continue;
    }

    if (arg === "--files") {
      if (base !== null || basePlusDirty !== null || files !== null || dirty) {
        throw new Error(
          "Use exactly one input mode: --base, --base-plus-dirty, --files, or --dirty.",
        );
      }

      files = args.slice(index + 1);
      break;
    }

    if (arg === "--dirty") {
      if (base !== null || basePlusDirty !== null || files !== null || dirty) {
        throw new Error(
          "Use exactly one input mode: --base, --base-plus-dirty, --files, or --dirty.",
        );
      }

      dirty = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (base === null && basePlusDirty === null && files === null && !dirty) {
    throw new Error("Missing input mode.");
  }

  if (files !== null && files.length === 0) {
    throw new Error("--files requires at least one path.");
  }

  return {
    mode: dirty
      ? "dirty"
      : basePlusDirty !== null
        ? "base-plus-dirty"
        : base === null
          ? "files"
          : "base",
    base: base ?? basePlusDirty,
    files,
    strict,
  };
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

export function changedFilesFromBasePlusDirty(base, exec = execFileSync) {
  return [...changedFilesFromBase(base, exec), ...changedFilesFromDirty(exec)];
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
  return (
    path === "package.json" ||
    path.endsWith("/package.json") ||
    path === "pnpm-lock.yaml" ||
    path === "pnpm-workspace.yaml"
  );
}

function isLicensePolicyPath(path) {
  return path === "docs/license-policy.md" || path === "docs/reuse-decision-policy.md";
}

function isRootDoc(path) {
  return path === "README.md" || path === "CONTRIBUTING.md" || path === "SECURITY.md";
}

function isRuntimeConfig(path) {
  return (
    path === ".dockerignore" ||
    path === "Dockerfile" ||
    path.startsWith("Dockerfile.") ||
    path === "docker-compose.yml" ||
    path.startsWith("docker-compose.") ||
    path.startsWith("docker/") ||
    path === ".env.example" ||
    path.endsWith(".env.example")
  );
}

function isTopLevelMaintenance(path) {
  return path === "README.md" || path === "CONTRIBUTING.md" || path === ".gitignore";
}

function isMigration(path) {
  return path === "migrations" || path.startsWith("migrations/") || path.includes("/migrations/");
}

function isDomainSource(path) {
  return path.startsWith("packages/domain/src/");
}

function isArchitectureSource(path) {
  return (
    path.startsWith("apps/api/") ||
    path.startsWith("apps/worker/") ||
    path.startsWith("apps/web/") ||
    path.startsWith("packages/domain/") ||
    path.startsWith("packages/database/") ||
    path.startsWith("packages/providers/")
  );
}

function isApiSource(path) {
  return path.startsWith("apps/api/") || /^apps\/api\/src\/routes\/[^/]+\/[^/]+\.ts$/.test(path);
}

function isDatabaseSource(path) {
  return (
    path.startsWith("packages/database/") ||
    /^packages\/database\/src\/repository\/[^/]+\/(?:drizzle|memory)\.ts$/.test(path)
  );
}

function isE2EPath(path) {
  return (
    path === "e2e" || path.startsWith("e2e/") || /^playwright\.config\.(?:[cm]?[jt]s)$/.test(path)
  );
}

function isSecurityReviewTooling(path) {
  return [
    "scripts/create-security-review.mjs",
    "scripts/create-security-review.test.mjs",
    "scripts/run-gitleaks-history-scan.mjs",
    "scripts/run-semgrep-privacy-rules.mjs",
    "scripts/scan-tracked-secrets.mjs",
    "scripts/scan-tracked-secrets.test.mjs",
    "scripts/security-hot-path-rescan.mjs",
    "scripts/security-hot-path-rescan.test.mjs",
  ].includes(path);
}

function isDockerResidualWatchTooling(path) {
  return [
    "scripts/watch-docker-residuals.mjs",
    "scripts/watch-docker-residuals.test.mjs",
    "scripts/create-release-proof.mjs",
    "scripts/create-release-proof.test.mjs",
  ].includes(path);
}

function isApiContractTooling(path) {
  return (
    path === "scripts/generate-api-contract.mjs" ||
    path === "scripts/route-authorization-manifest.mjs"
  );
}

function isDockerLocalWebApiRouting(path) {
  return path === "apps/web/next.config.mjs" || path === "apps/web/app/api-base-urls.ts";
}

export function normalizePaths(paths, cwd = process.cwd()) {
  return [...new Set(paths.map((path) => normalizePath(path, cwd)).filter(Boolean))].sort();
}

export function classifyPath(path) {
  const commands = new Set();

  if (isApiSource(path)) {
    commands.add(COMMANDS.apiTest);
    commands.add(COMMANDS.apiTypecheck);
    commands.add(COMMANDS.apiContract);
    commands.add(COMMANDS.policyCheck);
  }

  if (isArchitectureSource(path)) {
    commands.add(COMMANDS.architectureCheck);
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
    commands.add(COMMANDS.domainBuild);

    if (isDomainSource(path)) {
      commands.add(COMMANDS.domainBuild);
      commands.add(COMMANDS.apiTest);
      commands.add(COMMANDS.providersTest);
      commands.add(COMMANDS.workerTest);
    }
  }

  if (isDatabaseSource(path) || isMigration(path)) {
    commands.add(COMMANDS.databaseTest);
    commands.add(COMMANDS.databaseCheck);
    commands.add(COMMANDS.migrationsCheck);
    commands.add(COMMANDS.migrationsLint);
    commands.add(COMMANDS.databaseTypecheck);
    commands.add(COMMANDS.databaseBuild);
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

  if (isDockerLocalWebApiRouting(path)) {
    commands.add(COMMANDS.dockerAppSmoke);
    commands.add(COMMANDS.e2eDocker);
  }

  if (isE2EPath(path)) {
    commands.add(COMMANDS.e2eHost);
    commands.add(COMMANDS.e2eDocker);
    commands.add(COMMANDS.e2eFirstRun);
    commands.add(COMMANDS.e2eMatterless);
    commands.add(COMMANDS.e2eClientPortal);
    commands.add(COMMANDS.e2eA11y);
  }

  if (path.startsWith("docs/")) {
    commands.add(COMMANDS.formatCheck);
    commands.add(COMMANDS.docsCheck);
    commands.add(COMMANDS.policyCheck);
  }

  if (isLicensePolicyPath(path)) {
    commands.add(COMMANDS.licenseScan);
  }

  if (isRootDoc(path) || isTopLevelMaintenance(path)) {
    commands.add(COMMANDS.formatCheck);
    commands.add(COMMANDS.docsCheck);
    commands.add(COMMANDS.policyCheck);
  }

  if (path === "scripts" || path.startsWith("scripts/")) {
    commands.add(COMMANDS.policyCheck);
    commands.add(COMMANDS.test);
  }

  if (isSecurityReviewTooling(path)) {
    commands.add(COMMANDS.securityReview);
    commands.add(COMMANDS.securitySecretsHistory);
  }

  if (isDockerResidualWatchTooling(path)) {
    commands.add(COMMANDS.dockerResidualWatch);
  }

  if (isApiContractTooling(path)) {
    commands.add(COMMANDS.apiContract);
  }

  if (path.startsWith(".semgrep/")) {
    commands.add(COMMANDS.securityPrivacyRules);
  }

  if (isRootConfig(path)) {
    commands.add(COMMANDS.ciLocal);
  }

  if (isDependencyManifest(path)) {
    commands.add(COMMANDS.ciLocal);
    commands.add(COMMANDS.depsAudit);
    commands.add(COMMANDS.depsLicenses);
    commands.add(COMMANDS.depsSupplyChain);
    commands.add(COMMANDS.depsOsv);
    commands.add(COMMANDS.licenseScan);
  }

  if (isRuntimeConfig(path)) {
    commands.add(COMMANDS.dockerLint);
    commands.add(COMMANDS.dockerResidualWatch);
    commands.add(COMMANDS.dockerAppSmoke);
    commands.add(COMMANDS.dockerScan);
    commands.add(COMMANDS.selfhostCheck);
    commands.add(COMMANDS.e2eDocker);
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
  if (options.mode === "base-plus-dirty") return changedFilesFromBasePlusDirty(options.base, exec);
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
