#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_GRAPH_PATH = ".tmp/architecture/workspace-imports.dot";

const WORKSPACE_ROOTS = {
  "packages/domain": { label: "@open-practice/domain", allowed: [] },
  "packages/database": { label: "@open-practice/database", allowed: ["@open-practice/domain"] },
  "packages/providers": { label: "@open-practice/providers", allowed: ["@open-practice/domain"] },
  "apps/api": {
    label: "@open-practice/api",
    allowed: ["@open-practice/domain", "@open-practice/database", "@open-practice/providers"],
  },
  "apps/worker": {
    label: "@open-practice/worker",
    allowed: ["@open-practice/domain", "@open-practice/database", "@open-practice/providers"],
  },
  "apps/web": { label: "@open-practice/web", allowed: ["@open-practice/domain"] },
};

function trackedSourceFiles(exec = execFileSync) {
  return exec(
    "git",
    ["ls-files", "--", "apps/**/*.ts", "apps/**/*.tsx", "packages/**/*.ts", "packages/**/*.tsx"],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
}

function ownerForPath(file) {
  return Object.keys(WORKSPACE_ROOTS)
    .sort((left, right) => right.length - left.length)
    .find((root) => file.startsWith(`${root}/`));
}

function workspaceImports(text) {
  const imports = new Set();
  const patterns = [
    /\bimport(?:\s+type)?(?:[^'"]*from\s*)?["'](@open-practice\/[^/'"]+)/g,
    /\bexport(?:\s+type)?[^'"]*from\s*["'](@open-practice\/[^/'"]+)/g,
    /\bawait\s+import\(["'](@open-practice\/[^/'"]+)["']\)/g,
    /\brequire\(["'](@open-practice\/[^/'"]+)["']\)/g,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) imports.add(match[1]);
  }

  return [...imports].sort();
}

export function collectWorkspaceImportGraph({
  cwd = process.cwd(),
  exec = execFileSync,
  read = readFileSync,
} = {}) {
  const edges = [];
  const violations = [];

  for (const file of trackedSourceFiles(exec)) {
    const ownerRoot = ownerForPath(file);
    if (!ownerRoot) continue;
    const owner = WORKSPACE_ROOTS[ownerRoot];
    for (const imported of workspaceImports(read(path.join(cwd, file), "utf8"))) {
      edges.push({ from: owner.label, to: imported, file });
      if (!owner.allowed.includes(imported)) {
        violations.push({
          file,
          from: owner.label,
          to: imported,
          message: `${owner.label} may not import ${imported} according to docs/development/repo-guide.md.`,
        });
      }
    }
  }

  return {
    edges: edges.sort(
      (left, right) =>
        left.from.localeCompare(right.from) ||
        left.to.localeCompare(right.to) ||
        left.file.localeCompare(right.file),
    ),
    violations,
  };
}

export function buildDot(graph) {
  const uniqueEdges = [
    ...new Set(graph.edges.map((edge) => `"${edge.from}" -> "${edge.to}"`)),
  ].sort();
  return [
    "digraph OpenPracticeWorkspaceImports {",
    "  rankdir=LR;",
    ...uniqueEdges.map((edge) => `  ${edge};`),
    "}",
    "",
  ].join("\n");
}

export function parseArgs(rawArgs = process.argv.slice(2)) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let mode = "check";
  let output = DEFAULT_GRAPH_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") {
      mode = "check";
      continue;
    }
    if (arg === "--graph") {
      mode = "graph";
      continue;
    }
    if (arg === "--output") {
      const value = args[index + 1];
      index += 1;
      if (!value || value.startsWith("--")) throw new Error("--output requires a path.");
      output = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { mode, output };
}

export function runArchitectureCheck(options = {}) {
  const graph = collectWorkspaceImportGraph(options);
  if (options.mode === "graph") {
    const outputPath = path.resolve(
      options.cwd ?? process.cwd(),
      options.output ?? DEFAULT_GRAPH_PATH,
    );
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, buildDot(graph));
    return { ...graph, outputPath };
  }
  return graph;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs();
    const result = runArchitectureCheck(options);
    if (result.violations.length > 0) {
      console.error("Architecture import policy failed:");
      for (const violation of result.violations) {
        console.error(`- ${violation.file}: ${violation.message}`);
      }
      process.exit(1);
    }
    if (result.outputPath) console.log(`Architecture graph wrote ${result.outputPath}`);
    else
      console.log(
        `Architecture import policy passed: ${result.edges.length} workspace import edges reviewed.`,
      );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
