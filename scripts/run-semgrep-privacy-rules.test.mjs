import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { runSemgrepPrivacyRules } from "./run-semgrep-privacy-rules.mjs";

const RULE_ID = "open-practice-inbound-email-recovery-raw-storage-key-metadata";
const CONFIG_PATH = new URL("../.semgrep/open-practice.yml", import.meta.url);

function privacyConfigText() {
  return readFileSync(CONFIG_PATH, "utf8");
}

function inboundRecoveryRuleBlock() {
  const config = privacyConfigText();
  const start = config.indexOf(`- id: ${RULE_ID}`);
  assert.notEqual(start, -1);
  const nextRule = config.indexOf("\n  - id:", start + 1);
  return nextRule === -1 ? config.slice(start) : config.slice(start, nextRule);
}

function writeFixture(root, file, contents) {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

describe("Semgrep privacy rules", () => {
  it("keeps the inbound-email recovery raw object pointer rule scoped and anchored", () => {
    const rule = inboundRecoveryRuleBlock();

    assert.match(rule, new RegExp(`id: ${RULE_ID}`));
    assert.match(rule, /inbound-email raw object pointers/);
    assert.match(rule, /\/apps\/api\/src\/\*\*\/\*\.ts/);
    assert.match(rule, /\/apps\/worker\/src\/\*\*\/\*\.ts/);
    assert.match(rule, /\*\*\/\*\.test\.ts/);
    assert.match(rule, /createJobLifecycleRecord/);
    assert.match(rule, /updateJobLifecycleRecord/);
    assert.match(rule, /appendRouteAuditEvent/);
    assert.match(rule, /rawStorageKey\\b/);
  });

  it("flags durable inbound-email rawStorageKey metadata without blocking safe markers or queue handoff", (test) => {
    const root = mkdtempSync(path.join(tmpdir(), "open-practice-semgrep-privacy-"));
    writeFixture(root, ".semgrep/open-practice.yml", privacyConfigText());
    writeFixture(
      root,
      "apps/api/src/routes/inbound-email/bad-create.ts",
      `
export async function persistRawPointer(repository: any, rawStorageKey: string) {
  await repository.createJobLifecycleRecord({
    id: "job_synthetic_create",
    firmId: "firm_synthetic",
    queueName: "inbound_email",
    jobName: "parse_inbound_email",
    metadata: {
      recoveryPosture: "owner_reviewed_raw_object_replay",
      rawStorageKey,
    },
  });
}
`,
    );
    writeFixture(
      root,
      "apps/api/src/routes/inbound-email/bad-update.ts",
      `
export async function updateRawPointer(repository: any, rawStorageKey: string) {
  await repository.updateJobLifecycleRecord("firm_synthetic", "job_synthetic_update", {
    status: "queued",
    metadata: {
      ownerReviewRequired: true,
      rawStorageKey,
    },
  });
}
`,
    );
    writeFixture(
      root,
      "apps/api/src/routes/inbound-email/bad-audit.ts",
      `
export async function auditRawPointer(repository: any, request: any, rawStorageKey: string) {
  await appendRouteAuditEvent(repository, request.auth, {
    action: "inbound_email.parser_job.manual_retry",
    resourceType: "inbound_email",
    resourceId: "job_synthetic_audit",
    metadata: {
      requestType: "inbound_email_parser_safe_replay",
      rawStorageKey,
    },
  });
}
`,
    );
    writeFixture(
      root,
      "apps/api/src/routes/inbound-email/good-marker.ts",
      `
export async function persistSafeMarker(repository: any) {
  await repository.createJobLifecycleRecord({
    id: "job_synthetic_marker",
    firmId: "firm_synthetic",
    queueName: "inbound_email",
    jobName: "parse_inbound_email",
    metadata: {
      recoveryPosture: "owner_reviewed_raw_object_replay",
      rawStorageKeyPresent: true,
    },
  });
}
`,
    );
    writeFixture(
      root,
      "apps/worker/src/processors/good-queue-handoff.ts",
      `
export async function enqueueParserJob(queue: any, job: any, rawStorageKey: string) {
  await queue.add(
    "parse_inbound_email",
    { metadata: { ...job.metadata, rawStorageKey } },
    { jobId: "job_synthetic_queue" },
  );
}
`,
    );
    writeFixture(
      root,
      "apps/api/src/routes/inbound-email/ignored.test.ts",
      `
export async function ignoredTestFixture(repository: any, rawStorageKey: string) {
  await repository.createJobLifecycleRecord({
    id: "job_synthetic_test",
    firmId: "firm_synthetic",
    metadata: { rawStorageKey },
  });
}
`,
    );

    const result = runSemgrepPrivacyRules({
      artifactRoot: ".tmp/security/semgrep-privacy-fixture",
      cwd: root,
    });
    if (result.status === "skipped") {
      test.skip(result.skippedReason);
      return;
    }

    assert.equal(result.status, "passed");
    const semgrepReport = JSON.parse(
      readFileSync(path.join(result.artifactDir, "semgrep.json"), "utf8"),
    );
    const paths = semgrepReport.results
      .filter((result) => result.check_id.endsWith(RULE_ID))
      .map((result) => result.path.replaceAll("\\", "/"))
      .sort();

    assert.deepEqual(paths, [
      "apps/api/src/routes/inbound-email/bad-audit.ts",
      "apps/api/src/routes/inbound-email/bad-create.ts",
      "apps/api/src/routes/inbound-email/bad-update.ts",
    ]);
    assert.equal(JSON.stringify(semgrepReport).includes("private-object"), false);
  });
});
