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
    expect(
      classifyAuditEvent(
        auditEvent({
          action: "connector_outbox.queued",
          resourceType: "connector_outbox",
          resourceId: "connector-outbox-001",
          metadata: { eventType: "document.verified", idempotencyKeyPresent: true },
        }),
      ).metadataHints.resource,
    ).toEqual(
      expect.arrayContaining(["eventType", "idempotencyKeyPresent", "resourceType", "resourceId"]),
    );
    expect(
      classifyAuditEvent(
        auditEvent({
          action: "connector_outbox.manual_retry",
          resourceType: "connector_outbox",
          resourceId: "connector-outbox-001",
          metadata: {
            outboxId: "connector-outbox-001",
            beforeStatus: "dead_letter",
            expectedStatus: "dead_letter",
            afterStatus: "pending",
            deliveryJobQueued: true,
          },
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
          action: "connector_outbox.manual_dead_letter",
          resourceType: "connector_outbox",
          resourceId: "connector-outbox-001",
          metadata: {
            outboxId: "connector-outbox-001",
            beforeStatus: "failed",
            expectedStatus: "failed",
            afterStatus: "dead_letter",
            deliveryJobQueued: false,
          },
        }),
      ).metadataHints.resource,
    ).toEqual(
      expect.arrayContaining([
        "outboxId",
        "beforeStatus",
        "expectedStatus",
        "afterStatus",
        "deliveryJobQueued",
      ]),
    );
  });

  it("classifies integration developer boundary events as firm-scoped and redacted", () => {
    expect(
      classifyAuditEvent(
        auditEvent({
          action: "integration_developer_app.registered",
          resourceType: "integration_developer_app",
          resourceId: "integration-app-001",
          metadata: {
            appId: "integration-app-001",
            connectorId: "connector-001",
            connectorType: "generic",
            status: "draft",
            scopeCount: 3,
            endpointRegion: "ca",
            endpointBaseUrlPresent: true,
            rateLimitEnforcement: "reserved",
          },
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
          action: "integration_api_credential.created",
          resourceType: "integration_api_credential",
          resourceId: "integration-credential-001",
          metadata: {
            appId: "integration-app-001",
            credentialId: "integration-credential-001",
            scopeCount: 2,
            secretReferencePresent: true,
          },
        }),
      ).metadataHints.resource,
    ).toEqual(
      expect.arrayContaining([
        "appId",
        "credentialId",
        "scopeCount",
        "secretReferencePresent",
        "expiresAtPresent",
      ]),
    );
    expect(
      classifyAuditEvent(
        auditEvent({
          action: "integration_webhook_subscription.created",
          resourceType: "integration_webhook_subscription",
          resourceId: "integration-webhook-001",
          metadata: {
            appId: "integration-app-001",
            subscriptionId: "integration-webhook-001",
            eventCount: 2,
            destinationHost: "webhooks.example.test",
            signingSecretReferencePresent: true,
          },
        }),
      ),
    ).toMatchObject({
      category: "operations",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
  });

  it("classifies contact quality decisions without raw reviewer evidence", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "contact_quality_decision.recorded",
        resourceType: "contact_quality_review_decision",
        resourceId: "contact-quality-decision-001",
        metadata: {
          contactId: "contact-river",
          matterId: "matter-001",
          signalKind: "protected_party_cue",
          decision: "protected_party_handling_confirmed",
          relatedContactCount: 0,
          evidenceKeyCount: 1,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "contacts",
      known: true,
      matterScope: "optional_matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "contactId",
        "signalKind",
        "decision",
        "relatedContactCount",
        "evidenceKeyCount",
      ]),
    );
    expect(classification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["matchedValue", "evidence", "conflictDisposition"]),
    );
  });

  it("classifies trust transfer review events with safe metadata hints", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "trust_transfer_request.linked",
        resourceType: "trust_transfer_request",
        resourceId: "trust-transfer-request-001",
        metadata: {
          matterId: "matter-001",
          trustTransferRequestId: "trust-transfer-request-001",
          invoiceId: "invoice-001",
          ledgerTransactionId: "trust-transfer-posting",
          amountCents: 13230,
          status: "linked",
          previousStatus: "approved",
          trustAssetCreditCents: 13230,
          clientLiabilityDebitCents: 13230,
          evidencePresent: true,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "trust",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "trustTransferRequestId",
        "invoiceId",
        "ledgerTransactionId",
        "amountCents",
        "status",
        "previousStatus",
        "trustAssetCreditCents",
        "clientLiabilityDebitCents",
        "evidencePresent",
      ]),
    );
    expect(classification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["reason", "evidence"]),
    );
  });

  it("classifies hosted payment request shells without payment details or evidence bodies", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "hosted_payment_request.created",
        resourceType: "hosted_payment_request",
        resourceId: "payment-request-001",
        metadata: {
          matterId: "matter-001",
          paymentRequestId: "payment-request-001",
          invoiceId: "invoice-001",
          amountCents: 13230,
          status: "ready_to_send",
          deliveryStatus: "not_sent",
          reminderStatus: "not_scheduled",
          paymentPlanStatus: "not_offered",
          creditWriteOffStatus: "none",
          evidencePresent: true,
          evidence: { privateNote: "synthetic private body" },
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "billing",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "paymentRequestId",
        "invoiceId",
        "amountCents",
        "status",
        "deliveryStatus",
        "reminderStatus",
        "paymentPlanStatus",
        "creditWriteOffStatus",
        "evidencePresent",
      ]),
    );
    expect(classification.metadataHints.resource).not.toEqual(expect.arrayContaining(["evidence"]));

    const checkoutClassification = classifyAuditEvent(
      auditEvent({
        action: "hosted_payment_request.checkout_session_created",
        resourceType: "hosted_payment_request",
        resourceId: "payment-request-001",
        metadata: {
          matterId: "matter-001",
          paymentRequestId: "payment-request-001",
          invoiceId: "invoice-001",
          provider: "stripe",
          checkoutSessionId: "cs_test_synthetic",
          checkoutUrlPresent: true,
          checkoutUrl: "https://checkout.stripe.com/private",
          amountCents: 13230,
          status: "ready_to_send",
          processorStatus: "checkout_session_created",
        },
      }),
    );
    expect(checkoutClassification).toMatchObject({
      category: "billing",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(checkoutClassification.metadataHints.resource).toEqual(
      expect.arrayContaining(["provider", "checkoutSessionId", "checkoutUrlPresent"]),
    );
    expect(checkoutClassification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["checkoutUrl"]),
    );
  });

  it("classifies reconciliation exception resolution events without statement detail hints", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "ledger.reconciliation_exception_resolution.recorded",
        resourceType: "ledger_reconciliation_exception_resolution",
        resourceId: "resolution-001",
        metadata: {
          accountId: "acct-trust-bank",
          statementRowId: "statement-import-unmatched",
          varianceDecision: "needs_follow_up",
          resolutionNotePresent: true,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "trust",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual([
      "accountId",
      "statementRowId",
      "varianceDecision",
      "resolutionNotePresent",
    ]);
  });

  it("classifies statement import batch events without source or checksum detail hints", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "ledger.statement_import_batch.recorded",
        resourceType: "ledger_statement_import_batch",
        resourceId: "statement-import-batch-001",
        metadata: {
          accountId: "acct-trust-bank",
          importedStatementRowCount: 12,
          duplicateStatementRowCount: 2,
          status: "previewed",
          sourceLabelPresent: true,
          checksumPresent: true,
          matchingProfilePresent: true,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "trust",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual([
      "accountId",
      "importedStatementRowCount",
      "duplicateStatementRowCount",
      "status",
      "sourceLabelPresent",
      "checksumPresent",
      "matchingProfilePresent",
    ]);
    expect(classification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["sourceLabel", "checksumSha256", "statementRows"]),
    );
  });

  it("classifies communications triage note and follow-up metadata as safe resource hints", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "inbound_email.triage_updated",
        resourceType: "inbound_email",
        resourceId: "inbound-message-001",
        metadata: {
          matterId: "matter-001",
          status: "triaged",
          labelCount: 2,
          staffTriageStatus: "routed",
          privateNoteAdded: true,
          privateNoteCount: 1,
          followUpChannel: "phone",
          followUpConsentStatus: "consented",
          followUpDueAt: "2026-05-01T18:00:00.000Z",
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "communications",
      known: true,
      matterScope: "optional_matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "privateNoteAdded",
        "privateNoteCount",
        "followUpChannel",
        "followUpConsentStatus",
        "followUpDueAt",
      ]),
    );
  });

  it("classifies communications triage note and follow-up metadata as safe resource hints", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "inbound_email.triage_updated",
        resourceType: "inbound_email",
        resourceId: "inbound-message-001",
        metadata: {
          matterId: "matter-001",
          status: "triaged",
          labelCount: 2,
          staffTriageStatus: "routed",
          privateNoteAdded: true,
          privateNoteCount: 1,
          followUpChannel: "phone",
          followUpConsentStatus: "consented",
          followUpDueAt: "2026-05-01T18:00:00.000Z",
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "communications",
      known: true,
      matterScope: "optional_matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "privateNoteAdded",
        "privateNoteCount",
        "followUpChannel",
        "followUpConsentStatus",
        "followUpDueAt",
      ]),
    );
  });

  it("classifies async draft assist queue events as matter-scoped drafting", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "draft_assist.async_queued",
        resourceType: "draft_assist",
        resourceId: "job-001",
        metadata: {
          matterId: "matter-001",
          draftId: "draft-001",
          task: "continue_draft",
          provider: "fake-local-ai",
          jobId: "job-001",
          sourceTextLength: 42,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "drafting",
      known: true,
      matterScope: "matter",
      actorHint: "authenticated_user",
      hasMatterId: true,
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining(["draftId", "task", "provider", "jobId"]),
    );
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

  it("classifies hosted calendar meeting session and guest link events without token hints", () => {
    const sessionClassification = classifyAuditEvent(
      auditEvent({
        action: "calendar.meeting_session.updated",
        resourceType: "calendar_meeting_session",
        resourceId: "meeting-session-001",
        metadata: {
          matterId: "matter-001",
          eventId: "calendar-event-001",
          sessionId: "meeting-session-001",
          status: "lobby_open",
          retentionUntil: "2026-08-03T16:00:00.000Z",
        },
      }),
    );
    expect(sessionClassification).toMatchObject({
      category: "calendar",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(sessionClassification.metadataHints.resource).toEqual(
      expect.arrayContaining(["eventId", "sessionId", "status", "retentionUntil"]),
    );

    const guestLinkClassification = classifyAuditEvent(
      auditEvent({
        action: "calendar.guest_link.revoked",
        resourceType: "calendar_guest_link",
        resourceId: "guest-link-001",
        metadata: {
          matterId: "matter-001",
          eventId: "calendar-event-001",
          sessionId: "meeting-session-001",
          linkId: "guest-link-001",
          status: "revoked",
          revokedAt: "2026-05-03T16:20:00.000Z",
          checkedInAt: "2026-05-03T16:10:00.000Z",
          retentionUntil: "2026-08-03T16:00:00.000Z",
          tokenHash: "should-not-be-a-hint",
          email: "should-not-be-a-hint@example.test",
        },
      }),
    );
    expect(guestLinkClassification).toMatchObject({
      category: "calendar",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(guestLinkClassification.metadataHints.resource).toEqual(
      expect.arrayContaining(["eventId", "sessionId", "linkId", "status", "revokedAt"]),
    );
    expect(guestLinkClassification.metadataHints.resource).not.toContain("tokenHash");
    expect(guestLinkClassification.metadataHints.resource).not.toContain("email");
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
