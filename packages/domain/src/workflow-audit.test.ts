import { describe, expect, it } from "vitest";
import { appendAuditEvent, type AuditEvent } from "./audit.js";
import type { JobLifecycleRecord } from "./operations.js";
import { buildWorkflowAuditMetadata, buildWorkflowHistoryProjection } from "./workflow-audit.js";

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

function auditEvent(input: {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}): AuditEvent {
  return appendAuditEvent(undefined, {
    id: input.id,
    firmId: "firm-west-legal",
    actorId: "user-licensee",
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    occurredAt: input.occurredAt,
    metadata: input.metadata,
  });
}

describe("workflow history projection", () => {
  it("groups workflow audit envelopes and linked job runs into ordered redacted histories", () => {
    const jobs: JobLifecycleRecord[] = [
      {
        id: "job-ocr-001",
        firmId: "firm-west-legal",
        queueName: "ocr",
        jobName: "extract_document_text",
        status: "completed",
        targetResourceType: "document",
        targetResourceId: "doc-001",
        attemptsMade: 1,
        maxAttempts: 3,
        queuedAt: "2026-05-02T10:00:05.000Z",
        finishedAt: "2026-05-02T10:01:00.000Z",
        idempotencyKey: "private-idempotency-key",
        metadata: {
          requestId: "req-ocr-001",
          matterId: "matter-001",
          documentId: "doc-001",
          task: "ocr",
          rawBody: "Synthetic raw document text",
          storageKey: "matters/matter-001/private.pdf",
          token: "synthetic-token",
        },
      },
    ];
    const auditEvents = [
      auditEvent({
        id: "audit-ocr-queued",
        action: "document_processing.ocr.queued",
        resourceType: "document",
        resourceId: "doc-001",
        occurredAt: "2026-05-02T10:00:00.000Z",
        metadata: {
          requestId: "req-ocr-001",
          actorType: "licensee",
          actorId: "user-licensee",
          matterId: "matter-001",
          workflowStatus: "queued",
          beforeStatus: "verified",
          expectedStatus: "queued",
          afterStatus: "queued",
          idempotencyKeyPresent: true,
          rawBody: "Synthetic raw audit body",
          evidence: { private: true },
        },
      }),
    ];

    const projection = buildWorkflowHistoryProjection({
      jobs,
      auditEvents,
      generatedAt: "2026-05-02T10:02:00.000Z",
    });

    expect(projection).toMatchObject({
      status: "available",
      summary: { total: 1, active: 0, failed: 0, terminal: 1 },
      workflows: [
        {
          id: "request:req-ocr-001",
          status: "succeeded",
          matterIds: ["matter-001"],
          queueNames: ["ocr"],
          jobIds: ["job-ocr-001"],
          stepCount: 2,
        },
      ],
    });
    expect(projection.workflows[0]!.steps.map((step) => step.source)).toEqual(["audit", "job"]);
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain("Synthetic raw");
    expect(serialized).not.toContain("private.pdf");
    expect(serialized).not.toContain("synthetic-token");
    expect(serialized).not.toContain("private-idempotency-key");
  });

  it("keeps job-only histories and supports matter, queue, and status filters", () => {
    const jobs: JobLifecycleRecord[] = [
      {
        id: "job-report-hidden",
        firmId: "firm-west-legal",
        queueName: "reports",
        jobName: "audit_export",
        status: "completed",
        targetResourceType: "audit_export",
        targetResourceId: "audit-export-001",
        attemptsMade: 1,
        maxAttempts: 1,
        queuedAt: "2026-05-02T09:00:00.000Z",
        finishedAt: "2026-05-02T09:01:00.000Z",
        metadata: { reportType: "audit_log", reportScope: "firm" },
      },
      {
        id: "job-ocr-failed",
        firmId: "firm-west-legal",
        queueName: "ocr",
        jobName: "extract_document_text",
        status: "failed",
        targetResourceType: "document",
        targetResourceId: "doc-001",
        attemptsMade: 2,
        maxAttempts: 3,
        queuedAt: "2026-05-02T10:00:00.000Z",
        failedAt: "2026-05-02T10:05:00.000Z",
        errorMessage: "Synthetic provider failure with private content",
        metadata: {
          matterId: "matter-001",
          documentId: "doc-001",
          nextRetryAt: "2026-05-02T10:10:00.000Z",
          storageKey: "private/storage/key",
        },
      },
    ];

    const projection = buildWorkflowHistoryProjection({
      jobs,
      auditEvents: [],
      matterId: "matter-001",
      queueName: "ocr",
      status: "failed",
    });

    expect(projection).toMatchObject({
      status: "available",
      summary: { total: 1, active: 0, failed: 1, terminal: 0 },
      workflows: [
        expect.objectContaining({
          id: "job:job-ocr-failed",
          status: "failed",
          matterIds: ["matter-001"],
          queueNames: ["ocr"],
          jobIds: ["job-ocr-failed"],
        }),
      ],
    });
    expect(JSON.stringify(projection)).not.toContain("private/storage");
    expect(JSON.stringify(projection)).not.toContain("private content");
  });
});
