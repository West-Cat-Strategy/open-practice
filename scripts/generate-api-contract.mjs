#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ROUTE_AUTHORIZATION_MANIFEST,
  routeAuthorizationKey,
} from "./route-authorization-manifest.mjs";

const DEFAULT_OUTPUT = ".tmp/api-contract/openapi.json";

function openApiPath(routePath) {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function parameterEntries(routePath) {
  return [...routePath.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

function operationId(route) {
  return `${route.method.toLowerCase()}_${route.path
    .replace(/^\//, "")
    .replace(/[:{}]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;
}

export function buildOpenApiContract({
  generatedAt = new Date().toISOString(),
  manifest = ROUTE_AUTHORIZATION_MANIFEST,
} = {}) {
  const paths = {};
  const seen = new Set();
  const duplicates = [];

  for (const route of manifest) {
    const key = routeAuthorizationKey(route);
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
    const apiPath = openApiPath(route.path);
    const method = route.method.toLowerCase();
    paths[apiPath] ??= {};
    paths[apiPath][method] = {
      operationId: operationId(route),
      tags: [route.registrar],
      summary: `${route.method} ${route.path}`,
      parameters: parameterEntries(route.path),
      responses: {
        200: {
          description:
            "Implemented route response. See route tests and docs/api-and-state-machines.md for behavior details.",
        },
      },
      "x-open-practice-auth": route.auth,
      "x-open-practice-registrar": route.registrar,
      "x-open-practice-test-file": route.testFile,
    };
  }

  if (duplicates.length > 0) {
    throw new Error(`Duplicate route authorization entries: ${duplicates.join(", ")}`);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Open Practice Local API Contract Inventory",
      version: "0.0.0-local",
      description:
        "Generated local route inventory from scripts/route-authorization-manifest.mjs. It records route, auth, registrar, and test metadata only; examples must remain synthetic.",
    },
    "x-open-practice-generated-at": generatedAt,
    "x-open-practice-source": "scripts/route-authorization-manifest.mjs",
    paths,
  };
}

export function parseArgs(rawArgs = process.argv.slice(2)) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let output = DEFAULT_OUTPUT;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--output") {
      const value = args[index + 1];
      index += 1;
      if (!value || value.startsWith("--")) throw new Error("--output requires a path.");
      output = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { output };
}

export function writeApiContract({ cwd = process.cwd(), output = DEFAULT_OUTPUT } = {}) {
  const contract = buildOpenApiContract();
  const outputPath = path.resolve(cwd, output);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(contract, null, 2)}\n`);
  return { contract, outputPath };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = writeApiContract(parseArgs());
    console.log(
      `API contract inventory wrote ${result.outputPath} with ${Object.keys(result.contract.paths).length} paths.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
