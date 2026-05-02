import { describe, expect, it } from "vitest";
import type { AuditEvent } from "./audit.js";
import { classifyAuditEvent, summarizeAuditEventTaxonomy } from "./audit-taxonomy.js";

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

  it("summarizes taxonomy coverage without exposing metadata values", () => {
    const summary = summarizeAuditEventTaxonomy([
      auditEvent(),
      auditEvent({
        id: "audit-test-002",
        action: "signature_provider_event.recorded",
        resourceType: "provider_event",
        resourceId: "provider-event-001",
        metadata: { matterId: "matter-sensitive", provider: "embedded" },
      }),
      auditEvent({
        id: "audit-test-003",
        action: "custom.workflow.executed",
        resourceType: "custom_resource",
        resourceId: "custom-001",
        metadata: { matterId: "matter-sensitive", note: "private synthetic note" },
      }),
    ]);

    expect(summary).toMatchObject({
      total: 3,
      known: 2,
      unknown: 1,
      byCategory: { communications: 1, signatures: 1, unknown: 1 },
      byActorHint: { authenticated_user: 1, provider_callback: 1, unknown: 1 },
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
});
