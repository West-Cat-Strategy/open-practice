import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export function toolingTimestamp(now = new Date()) {
  return now
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

export function commandAvailable(command, { cwd = process.cwd(), spawn = spawnSync } = {}) {
  const result = spawn(command, ["--version"], {
    cwd,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  return {
    available: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
    error: result.error instanceof Error ? result.error.message : null,
  };
}

export function writeJsonReport(outputPath, report) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}

export function runOptionalTool({
  args,
  artifactRoot,
  command,
  cwd = process.cwd(),
  missingMessage,
  now = new Date(),
  reportFile = "review.json",
  scope,
  spawn = spawnSync,
} = {}) {
  const artifactDir = path.resolve(cwd, artifactRoot, toolingTimestamp(now));
  mkdirSync(artifactDir, { recursive: true });
  const resolvedArgs = typeof args === "function" ? args({ artifactDir }) : args;
  const availability = commandAvailable(command, { cwd, spawn });

  if (!availability.available) {
    const report = {
      generatedAt: now.toISOString(),
      artifactDir,
      scope,
      status: "skipped",
      skippedReason: missingMessage ?? `${command} is not installed or not on PATH.`,
      command,
      availability,
    };
    writeJsonReport(path.join(artifactDir, reportFile), report);
    return report;
  }

  const startedAt = new Date().toISOString();
  const result = spawn(command, resolvedArgs, {
    cwd,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  const finishedAt = new Date().toISOString();
  const stdoutPath = path.join(artifactDir, `${command}.stdout.log`);
  const stderrPath = path.join(artifactDir, `${command}.stderr.log`);
  writeFileSync(stdoutPath, result.stdout ?? "");
  writeFileSync(stderrPath, result.stderr ?? "");
  const report = {
    generatedAt: now.toISOString(),
    artifactDir,
    scope,
    status: result.status === 0 ? "passed" : "failed",
    command,
    args: resolvedArgs,
    startedAt,
    finishedAt,
    exitStatus: result.status ?? 1,
    signal: result.signal ?? null,
    error: result.error instanceof Error ? result.error.message : null,
    stdoutPath: path.relative(artifactDir, stdoutPath),
    stderrPath: path.relative(artifactDir, stderrPath),
  };
  writeJsonReport(path.join(artifactDir, reportFile), report);
  return report;
}
