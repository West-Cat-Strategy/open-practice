#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEFAULT_LOCKFILE = "pnpm-lock.yaml";
const DEFAULT_WORKSPACE = "pnpm-workspace.yaml";
const ALLOWED_TARBALL_HOSTS = new Set(["registry.npmjs.org"]);

function unquote(value) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function packageNameFromLockKey(rawKey) {
  const key = unquote(rawKey).replace(/^\//, "").replace(/\(.+$/, "");
  if (key.startsWith("@")) {
    const versionAt = key.indexOf("@", 1);
    return versionAt > 0 ? key.slice(0, versionAt) : key;
  }
  const versionAt = key.indexOf("@");
  return versionAt > 0 ? key.slice(0, versionAt) : key;
}

export function collectAllowBuilds(workspaceText) {
  const allowBuilds = new Map();
  const lines = workspaceText.split(/\r?\n/);
  let inAllowBuilds = false;

  for (const line of lines) {
    if (/^allowBuilds:\s*$/.test(line)) {
      inAllowBuilds = true;
      continue;
    }
    if (inAllowBuilds && /^\S/.test(line)) break;
    if (!inAllowBuilds) continue;

    const match = line.match(/^\s{2}(.+?):\s*(true|false)\s*$/);
    if (match) allowBuilds.set(unquote(match[1]), match[2] === "true");
  }

  return allowBuilds;
}

export function collectPackageEntries(lockfileText) {
  const lines = lockfileText.split(/\r?\n/);
  const entries = [];
  let inPackages = false;
  let current = null;

  for (const line of lines) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^\S/.test(line)) break;
    if (!inPackages) continue;

    const match = line.match(/^  (.+?):\s*$/);
    if (match) {
      if (current) entries.push(current);
      current = { key: unquote(match[1]), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }

  if (current) entries.push(current);
  return entries;
}

function isAllowedLinkReference(reference) {
  return reference.startsWith("link:../../packages/") || reference.startsWith("workspace:");
}

function disallowedReferenceFinding(line, lineNumber) {
  const match = line.match(/\b(?:specifier|version|tarball):\s*["']?([^"'\s]+)/);
  if (!match) return null;
  const reference = match[1];
  if (isAllowedLinkReference(reference)) return null;

  const scheme = reference.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (!scheme) return null;
  if (scheme === "https" || scheme === "http") {
    if (!line.includes("tarball:")) {
      return {
        type: "remote_dependency_reference",
        line: lineNumber,
        message: `Dependency reference uses ${scheme}: instead of the npm registry lockfile shape.`,
      };
    }
    const host = new URL(reference).host;
    if (!ALLOWED_TARBALL_HOSTS.has(host)) {
      return {
        type: "registry_drift",
        line: lineNumber,
        message: `Tarball host ${host} is not in the allowed registry host set.`,
      };
    }
    return null;
  }
  if (["file", "git", "git+https", "git+ssh", "github", "patch", "portal"].includes(scheme)) {
    return {
      type: "non_registry_dependency_reference",
      line: lineNumber,
      message: `Dependency reference uses disallowed ${scheme}: source.`,
    };
  }
  return null;
}

export function validateLockfileSupplyChain({ lockfileText, workspaceText }) {
  const findings = [];
  const allowBuilds = collectAllowBuilds(workspaceText);
  const lockfileLines = lockfileText.split(/\r?\n/);

  lockfileLines.forEach((line, index) => {
    const finding = disallowedReferenceFinding(line, index + 1);
    if (finding) findings.push(finding);
  });

  for (const entry of collectPackageEntries(lockfileText)) {
    const body = entry.lines.join("\n");
    const packageName = packageNameFromLockKey(entry.key);
    if (body.includes("resolution:") && !body.includes("integrity:")) {
      findings.push({
        type: "missing_integrity",
        packageName,
        lockfileKey: entry.key,
        message: `${entry.key} has a resolution block without an integrity field.`,
      });
    }
    if (/requiresBuild:\s*true/.test(body) && allowBuilds.get(packageName) !== true) {
      findings.push({
        type: "native_build_not_approved",
        packageName,
        lockfileKey: entry.key,
        message: `${packageName} requires a native build but is not explicitly approved in pnpm-workspace.yaml allowBuilds.`,
      });
    }
  }

  const staleAllowBuilds = [...allowBuilds.entries()]
    .filter(([, approved]) => approved)
    .map(([packageName]) => packageName)
    .filter(
      (packageName) =>
        !collectPackageEntries(lockfileText).some(
          (entry) => packageNameFromLockKey(entry.key) === packageName,
        ),
    );

  return {
    allowBuilds: [...allowBuilds.entries()].map(([packageName, approved]) => ({
      packageName,
      approved,
    })),
    findings,
    staleAllowBuilds,
  };
}

export function checkLockfileSupplyChain({
  lockfilePath = DEFAULT_LOCKFILE,
  read = readFileSync,
  workspacePath = DEFAULT_WORKSPACE,
} = {}) {
  return validateLockfileSupplyChain({
    lockfileText: read(lockfilePath, "utf8"),
    workspaceText: read(workspacePath, "utf8"),
  });
}

function runCli() {
  const result = checkLockfileSupplyChain();
  if (result.findings.length > 0) {
    console.error("Lockfile supply-chain policy failed:");
    for (const finding of result.findings) {
      console.error(`- ${finding.type}: ${finding.message}`);
    }
    process.exit(1);
  }

  const stale = result.staleAllowBuilds.length
    ? ` Stale approved native-build entries to review: ${result.staleAllowBuilds.join(", ")}.`
    : "";
  console.log(
    `Lockfile supply-chain policy passed: ${result.allowBuilds.length} native-build approval entries reviewed.${stale}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
