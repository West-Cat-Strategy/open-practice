import { describe, expect, it } from "vitest";
import { buildWorkflowAuditMetadata } from "./workflow-audit.js";

describe("workflow audit metadata", () => {
  it("builds a compact redacted workflow envelope", () => {
    expect(
      buildWorkflowAuditMetadata({
        requestId: "req-001",
        actorType: "licensee",
        actorId: "user-licensee",
        matterId: "matter-001",
        matterIds: ["matter-001", "matter-001", "matter-002", ""],
        workflowStatus: "queued",
        beforeStatus: "failed",
        expectedStatus: "queued",
        afterStatus: "queued",
        attemptNumber: 0,
        maxAttempts: 3,
        retryOfJobId: "job-failed-001",
        nextAttemptAt: "2026-05-05T12:00:00.000Z",
        idempotencyKeyPresent: true,
        errorSummary: "queue_enqueue_failed",
      }),
    ).toEqual({
      requestId: "req-001",
      actorType: "licensee",
      actorId: "user-licensee",
      matterId: "matter-001",
      matterIds: ["matter-001", "matter-002"],
      workflowStatus: "queued",
      beforeStatus: "failed",
      expectedStatus: "queued",
      afterStatus: "queued",
      attemptNumber: 0,
      maxAttempts: 3,
      retryOfJobId: "job-failed-001",
      nextAttemptAt: "2026-05-05T12:00:00.000Z",
      idempotencyKeyPresent: true,
      errorSummary: "queue_enqueue_failed",
    });
  });

  it("drops non-envelope fields and unsafe value shapes", () => {
    const unsafePayload = {
      requestId: " req-002 ",
      actorType: "unknown_role",
      actorId: "",
      matterId: undefined,
      matterIds: ["matter-001", 42, "matter-002"],
      workflowStatus: "raw_exception_text",
      attemptNumber: -1,
      maxAttempts: 3.5,
      idempotencyKeyPresent: "true",
      subject: "Synthetic private subject",
      body: "Synthetic private body",
      to: ["client@example.test"],
      token: "private-token",
      storageKey: "matters/matter-001/doc.pdf",
      checksumSha256: "a".repeat(64),
      providerPayload: { raw: true },
      ip: "192.0.2.1",
      userAgent: "Synthetic browser",
      evidence: "Synthetic private evidence",
      error: new Error("Redis unavailable with private connection details"),
    } as unknown as Parameters<typeof buildWorkflowAuditMetadata>[0];

    const metadata = buildWorkflowAuditMetadata(unsafePayload);

    expect(metadata).toEqual({
      requestId: "req-002",
      matterIds: ["matter-001", "matter-002"],
    });
    expect(JSON.stringify(metadata)).not.toContain("Synthetic private subject");
    expect(JSON.stringify(metadata)).not.toContain("private connection details");
    expect(metadata).not.toHaveProperty("token");
    expect(metadata).not.toHaveProperty("storageKey");
    expect(metadata).not.toHaveProperty("checksumSha256");
    expect(metadata).not.toHaveProperty("providerPayload");
  });
});
