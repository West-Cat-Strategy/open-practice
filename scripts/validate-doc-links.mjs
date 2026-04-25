import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

function walk(directory) {
  const entries = [];
  for (const entry of readdirSync(directory)) {
    if (
      entry === "node_modules" ||
      entry === ".git" ||
      entry === ".next" ||
      entry === ".turbo" ||
      entry === ".references" ||
      entry === "dist"
    ) {
      continue;
    }
    const absolute = join(directory, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      entries.push(...walk(absolute));
    } else if (extname(entry) === ".md") {
      entries.push(absolute);
    }
  }
  return entries;
}

function stripAnchor(target) {
  return target.split("#")[0];
}

function isExternal(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("mailto:");
}

for (const file of walk(root)) {
  const text = readFileSync(file, "utf8");
  const linkPattern = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of text.matchAll(linkPattern)) {
    const rawTarget = match[1].trim();
    const target = stripAnchor(rawTarget.replace(/^<|>$/g, ""));
    if (!target || isExternal(target)) continue;
    const resolved = normalize(join(dirname(file), target));
    if (!resolved.startsWith(root) || !existsSync(resolved)) {
      failures.push(`${file.slice(root.length + 1)} links to missing local target: ${rawTarget}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Documentation link validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Documentation link validation passed.");
