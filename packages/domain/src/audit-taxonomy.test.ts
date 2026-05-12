import { describe, expect, it } from "vitest";
import { appendAuditEvent, verifyAuditChain, type AuditEvent } from "./audit.js";
import { classifyAuditEvent, summarizeAuditEventTaxonomy } from "./audit-taxonomy.js";
import { sampleAuditEvents } from "./sample-data.js";

function auditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "audit-test-001",
    firmId: "firm-west-legal",
    actorId: "user-admin",
    action: "email_outbox.queued",
    resourceType: "email_outbox",
    resourceId: "email-001",
    occurredAt: "2026-05-02T12:00:00.000Z",
    metadata: { matterId: "matter-001", recipientCount: 1, jobId: "job-001" },
    previousHash: "0".repeat(64),
    hash: "1".repeat(64),
    ...overrides,
  };
}

describe("audit event taxonomy", () => {
  it("classifies known route audit events with safe metadata hints", () => {
    const classification = classifyAuditEvent(auditEvent());

    expect(classification).toMatchObject({
      action: "email_outbox.queued",
      category: "communications",
      expectedResourceType: "email_outbox",
      known: true,
      matterScope: "optional_matter",
      actorHint: "authenticated_user",
      hasMatterId: true,
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toContain("recipientCount");
    expect(classification.metadataHints.matter).toEqual(["matterId"]);
  });

  it("treats matter resources as matter-scoped without requiring matter metadata", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "matter.opened",
        resourceType: "matter",
        resourceId: "matter-001",
        metadata: { jurisdiction: "BC", practiceArea: "Residential tenancy" },
      }),
    );

    expect(classification).toMatchObject({
      category: "matter_lifecycle",
      known: true,
      hasMatterId: true,
      matterScope: "matter",
    });
  });

  it("classifies connector registry and outbox events as firm-scoped", () => {
    expect(
      classifyAuditEvent(
        auditEvent({
          action: "connector.created",
          resourceType: "connector",
          resourceId: "connector-001",
          metadata: { connectorType: "generic", secretReferencePresent: true },
        }),
      ),
    ).toMatchObject({
      category: "operations",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
    expect(
      classifyAuditEvent(
        auditEvent({
          action: "connector_outbox.queued",
          resourceType: "connector_outbox",
          resourceId: "connector-outbox-001",
          metadata: { eventType: "matter.summary.ready", idempotencyKeyPresent: true },
        }),
      ),
    ).toMatchObject({
      category: "operations",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
  });

  it("classifies completed task events as matter-scoped operations", () => {
    expect(
      classifyAuditEvent(
        auditEvent({
          action: "task.completed",
          resourceType: "task",
          resourceId: "task-001",
          metadata: {
            matterId: "matter-001",
            taskId: "task-001",
            assignedToUserId: "user-licensee",
            completedByUserId: "user-admin",
          },
        }),
      ),
    ).toMatchObject({
      category: "operations",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
  });

  it("classifies workflow audit events with envelope metadata hints", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "email_outbox.manual_retry",
        resourceType: "email_outbox",
        resourceId: "email-001",
        metadata: {
          requestId: "req-001",
          actorType: "licensee",
          actorId: "user-licensee",
          matterId: "matter-001",
          workflowStatus: "queued",
          beforeStatus: "failed",
          expectedStatus: "queued",
          afterStatus: "queued",
          attemptNumber: 0,
          maxAttempts: 5,
          retryOfJobId: "job-failed-001",
          idempotencyKeyPresent: true,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "communications",
      known: true,
      matterScope: "optional_matter",
      actorHint: "authenticated_user",
      hasMatterId: true,
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "requestId",
        "workflowStatus",
        "beforeStatus",
        "expectedStatus",
        "afterStatus",
        "attemptNumber",
        "maxAttempts",
        "retryOfJobId",
        "idempotencyKeyPresent",
        "errorSummary",
      ]),
    );
    expect(classification.metadataHints.actor).toEqual(["actorId", "actorType"]);
  });

  it("summarizes taxonomy coverage without exposing metadata values", () => {
    const summary = summarizeAuditEventTaxonomy([
      auditEvent(),
      auditEvent({
        id: "audit-test-002",
        action: "signature_request.created",
        resourceType: "signature_request",
        resourceId: "signature-001",
        metadata: { signerCount: 1 },
      }),
      auditEvent({
        id: "audit-test-003",
        action: "signature_provider_event.recorded",
        resourceType: "provider_event",
        resourceId: "provider-event-001",
        metadata: { matterId: "matter-sensitive", provider: "embedded" },
      }),
      auditEvent({
        id: "audit-test-004",
        action: "custom.workflow.executed",
        resourceType: "custom_resource",
        resourceId: "custom-001",
        metadata: { matterId: "matter-sensitive", note: "private synthetic note" },
      }),
    ]);

    expect(summary).toMatchObject({
      total: 4,
      known: 3,
      unknown: 1,
      byCategory: { communications: 1, signatures: 2, unknown: 1 },
      byActorHint: { authenticated_user: 2, provider_callback: 1, unknown: 1 },
      matterScopedWithoutMatterId: 1,
      unknownActions: ["custom.workflow.executed"],
      resourceTypeMismatches: [
        {
          action: "signature_provider_event.recorded",
          expectedResourceType: "signature_request",
          observedResourceType: "provider_event",
          count: 1,
        },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain("matter-sensitive");
    expect(JSON.stringify(summary)).not.toContain("private synthetic note");
  });

  it("keeps unknown actions classified without breaking audit-chain verification", () => {
    const first = appendAuditEvent(undefined, {
      id: "audit-test-unknown-001",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      action: "custom.workflow.executed",
      resourceType: "custom_resource",
      resourceId: "custom-001",
      occurredAt: "2026-05-02T13:00:00.000Z",
      metadata: { matterId: "matter-001" },
    });
    const second = appendAuditEvent(first, {
      id: "audit-test-unknown-002",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      action: "email_outbox.queued",
      resourceType: "email_outbox",
      resourceId: "email-001",
      occurredAt: "2026-05-02T13:01:00.000Z",
      metadata: { matterId: "matter-001", recipientCount: 1 },
    });

    expect(classifyAuditEvent(first)).toMatchObject({
      action: "custom.workflow.executed",
      category: "unknown",
      known: false,
    });
    expect(verifyAuditChain([first, second])).toBe(true);
  });

  it("classifies the synthetic seed audit events", () => {
    expect(sampleAuditEvents.map((event) => classifyAuditEvent(event))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "matter.opened", known: true }),
        expect.objectContaining({ action: "portal.grant.created", known: true }),
      ]),
    );
    expect(summarizeAuditEventTaxonomy(sampleAuditEvents)).toMatchObject({
      total: sampleAuditEvents.length,
      known: sampleAuditEvents.length,
      unknown: 0,
      unknownActions: [],
    });
  });
});
