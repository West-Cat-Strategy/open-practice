#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const INFRA_SERVICES = ["postgres", "redis", "minio", "mailpit", "minio-bucket-init"];

export function usage() {
  return [
    "Usage:",
    "  node scripts/dev-stack.mjs infra",
    "  node scripts/dev-stack.mjs stack",
    "  node scripts/dev-stack.mjs ps",
    "  node scripts/dev-stack.mjs logs [service]",
    "  node scripts/dev-stack.mjs reset [--volumes --yes]",
  ].join("\n");
}

export function parseArgs(rawArgs) {
  const args = rawArgs.filter((arg) => arg !== "--");
  const subcommand = args[0];
  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    return { subcommand: "help", service: null, volumes: false, yes: false };
  }
  return {
    subcommand,
    service: subcommand === "logs" && args[1] && !args[1].startsWith("--") ? args[1] : null,
    volumes: args.includes("--volumes"),
    yes: args.includes("--yes"),
  };
}

export function buildDevStackCommand(options) {
  const compose = ["compose"];

  if (options.subcommand === "infra") {
    return { command: "docker", args: [...compose, "up", "-d", ...INFRA_SERVICES] };
  }

  if (options.subcommand === "stack") {
    return { command: "docker", args: [...compose, "up", "-d"] };
  }

  if (options.subcommand === "ps") {
    return { command: "docker", args: [...compose, "ps"] };
  }

  if (options.subcommand === "logs") {
    return {
      command: "docker",
      args: [
        ...compose,
        "logs",
        "--tail",
        "200",
        "-f",
        ...(options.service ? [options.service] : []),
      ],
    };
  }

  if (options.subcommand === "reset") {
    if (options.volumes && !options.yes) {
      throw new Error("Volume deletion requires reset --volumes --yes.");
    }
    return {
      command: "docker",
      args: [...compose, "down", "--remove-orphans", ...(options.volumes ? ["--volumes"] : [])],
    };
  }

  throw new Error(`Unknown dev-stack subcommand: ${options.subcommand}`);
}

export function runDevStack(rawArgs = process.argv.slice(2), { spawn = spawnSync } = {}) {
  const options = parseArgs(rawArgs);
  if (options.subcommand === "help") {
    console.log(usage());
    return 0;
  }
  const command = buildDevStackCommand(options);
  const result = spawn(command.command, command.args, { stdio: "inherit" });
  return result.status ?? (result.error ? 1 : 0);
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  try {
    process.exitCode = runDevStack();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  }
}
