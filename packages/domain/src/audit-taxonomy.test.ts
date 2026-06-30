import { describe, expect, it } from "vitest";
import { appendAuditEvent, verifyAuditChain, type AuditEvent } from "./audit.js";
import {
  auditEventTaxonomyDefinitions,
  classifyAuditEvent,
  summarizeAuditEventTaxonomy,
} from "./audit-taxonomy.js";
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
    sequence: 1,
    previousHash: "0".repeat(64),
    hash: "1".repeat(64),
    ...overrides,
  };
}

const SENSITIVE_CALENDAR_METADATA_KEYS = [
  "meetingUrl",
  "meetingLinkUrl",
  "rawMeetingUrl",
  "roomUrl",
  "meetingRoomUrl",
  "meetingRoomId",
  "token",
  "rawToken",
  "guestToken",
  "guestAccessToken",
  "tokenHash",
  "attendeeEmail",
  "recipientEmail",
  "email",
  "invitationBody",
  "meetingInvitationBody",
  "messageBody",
  "textBody",
  "htmlBody",
  "body",
] as const;

function expectNoSensitiveCalendarMetadataHints(resourceHints: readonly string[]): void {
  for (const key of SENSITIVE_CALENDAR_METADATA_KEYS) {
    expect(resourceHints).not.toContain(key);
  }
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

  it("classifies email template publish metadata without raw template content", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "email_template_published_version.created",
        resourceType: "email_template_published_version",
        resourceId: "email-template-version-001",
        metadata: {
          publishedVersionId: "email-template-version-001",
          templateDraftId: "template-draft-001",
          version: 2,
          draftVersion: 3,
          publishedAt: "2026-06-29T10:30:00.000Z",
          subjectLength: 32,
          textLength: 120,
          htmlLength: 180,
          recipientHintCount: 1,
          subject: "Synthetic private subject should not be a hint",
          textBody: "Synthetic private body should not be a hint",
          recipientEmail: "client@example.test",
          providerNeutral: true,
          deliveryQueued: false,
          providerDeliverySideEffect: false,
          campaignAutomation: false,
          bulkSend: false,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "communications",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "publishedVersionId",
        "templateDraftId",
        "version",
        "draftVersion",
        "publishedAt",
        "subjectLength",
        "textLength",
        "htmlLength",
        "recipientHintCount",
        "providerNeutral",
        "deliveryQueued",
        "providerDeliverySideEffect",
        "campaignAutomation",
        "bulkSend",
      ]),
    );
    expect(classification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["category", "subject", "textBody", "htmlBody", "recipientEmail"]),
    );
  });

  it("classifies document retention and hold review audit metadata as review-only", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "document.retention_hold_review.recorded",
        resourceType: "document",
        resourceId: "doc-001",
        metadata: {
          matterId: "matter-001",
          documentId: "doc-001",
          decision: "reviewed_keep",
          reason: "legal_hold",
          reviewAfterPresent: true,
          minimumRetainThroughPresent: true,
          retentionHoldCueCount: 1,
          retentionPosture: "blocked_by_hold",
          destructiveAction: false,
          retentionDeadlineEnforced: false,
          legalHoldOverride: false,
          retainedExportBody: false,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "documents",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "documentId",
        "decision",
        "reason",
        "retentionHoldCueCount",
        "destructiveAction",
        "retentionDeadlineEnforced",
        "legalHoldOverride",
        "retainedExportBody",
      ]),
    );
  });

  it("classifies disposition schedule profile settings metadata as firm-scoped and bounded", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "firm.disposition_review_schedule_profile.updated",
        resourceType: "firm",
        resourceId: "firm-west-legal",
        metadata: {
          profileConfigured: true,
          reviewCadence: "quarterly",
          reviewAfterDaysPresent: true,
          minimumRetainDaysPresent: true,
          destructiveAction: false,
          retentionDeadlineEnforced: false,
          legalHoldOverride: false,
          retainedExportBody: false,
          rawPayloadRetention: false,
          complianceClaim: false,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "documents",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "profileConfigured",
        "reviewCadence",
        "reviewAfterDaysPresent",
        "minimumRetainDaysPresent",
        "destructiveAction",
        "retentionDeadlineEnforced",
        "legalHoldOverride",
        "retainedExportBody",
        "rawPayloadRetention",
        "complianceClaim",
      ]),
    );
  });

  it("classifies calendar scheduling request audit metadata as redacted review hints", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "calendar.scheduling_request.reviewed",
        resourceType: "calendar_scheduling_request",
        resourceId: "calendar-request-001",
        metadata: {
          matterId: "matter-001",
          requestId: "calendar-request-001",
          status: "scheduled",
          kind: "event_scheduling",
          sourceType: "manual",
          ownerUserId: "user-licensee",
          privacy: "staff_only",
          hasRequestedDueAt: false,
          hasRequestedStartsAt: true,
          hasRequestedEndsAt: true,
          calendarEventId: "calendar-event-001",
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "calendar",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "requestId",
        "status",
        "kind",
        "sourceType",
        "ownerUserId",
        "privacy",
        "hasRequestedDueAt",
        "hasRequestedStartsAt",
        "hasRequestedEndsAt",
        "calendarEventId",
      ]),
    );
    expect(classification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["title", "sourceLabel", "requestedStartsAt", "hasRequestedWindow"]),
    );
  });

  it("classifies calendar scheduling aging review decisions without private request details", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "calendar.scheduling_request.aging_review_recorded",
        resourceType: "calendar_scheduling_request",
        resourceId: "calendar-request-001",
        metadata: {
          matterId: "matter-001",
          requestId: "calendar-request-001",
          decision: "follow_up_required",
          cueStatus: "stale",
          ageHours: 96,
          automaticFinalConfirmation: false,
          autoExpires: false,
          providerSync: false,
          publicRoomCreated: false,
          nativeMediaCreated: false,
          chatCreated: false,
          recordingCreated: false,
          matterCreated: false,
          taskCreated: false,
          eventCreated: false,
          eventRescheduled: false,
          reminderCancelled: false,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "calendar",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "requestId",
        "decision",
        "cueStatus",
        "ageHours",
        "automaticFinalConfirmation",
        "autoExpires",
        "providerSync",
        "publicRoomCreated",
        "nativeMediaCreated",
        "chatCreated",
        "recordingCreated",
        "matterCreated",
        "taskCreated",
        "eventCreated",
        "eventRescheduled",
        "reminderCancelled",
      ]),
    );
    expect(classification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["title", "sourceLabel", "requestedStartsAt", "calendarEventId"]),
    );
  });

  it("classifies appointment booking hold audit metadata without tokens or requester contact", () => {
    const createdClassification = classifyAuditEvent(
      auditEvent({
        action: "appointment_booking.hold.created",
        resourceType: "appointment_booking_request",
        resourceId: "appointment-booking-request-001",
        metadata: {
          requestId: "appointment-booking-request-001",
          profileId: "appointment-booking-profile-001",
          linkId: "appointment-booking-link-001",
          eventId: "calendar-event-001",
          source: "direct_link",
          status: "tentative_hold",
          matterLinked: true,
          attendeeAdded: true,
        },
      }),
    );
    const reviewedClassification = classifyAuditEvent(
      auditEvent({
        action: "appointment_booking.hold.reviewed",
        resourceType: "appointment_booking_request",
        resourceId: "appointment-booking-request-001",
        metadata: {
          requestId: "appointment-booking-request-001",
          profileId: "appointment-booking-profile-001",
          eventId: "calendar-event-001",
          reviewStatus: "confirmed",
          eventStatus: "confirmed",
          source: "direct_link",
          matterLinked: true,
        },
      }),
    );

    expect(createdClassification).toMatchObject({
      category: "calendar",
      known: true,
      matterScope: "optional_matter",
      resourceTypeMatches: true,
    });
    expect(reviewedClassification).toMatchObject({
      category: "calendar",
      known: true,
      matterScope: "optional_matter",
      resourceTypeMatches: true,
    });
    expect(createdClassification.metadataHints.resource).toEqual(
      expect.arrayContaining(["requestId", "profileId", "linkId", "eventId", "source", "status"]),
    );
    expect(createdClassification.metadataHints.resource).not.toEqual(
      expect.arrayContaining([
        "token",
        "tokenHash",
        "requesterEmail",
        "requesterTelephone",
        "requesterNotes",
        "meetingUrl",
        "eventTitle",
      ]),
    );
  });

  it("classifies appointment booking aging review decisions without requester contact", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "appointment_booking.hold.aging_review_recorded",
        resourceType: "appointment_booking_request",
        resourceId: "appointment-booking-request-001",
        metadata: {
          requestId: "appointment-booking-request-001",
          profileId: "appointment-booking-profile-001",
          eventId: "calendar-event-001",
          decision: "acknowledged",
          cueStatus: "aging",
          ageHours: 48,
          automaticFinalConfirmation: false,
          autoExpires: false,
          providerSync: false,
          publicRoomCreated: false,
          nativeMediaCreated: false,
          chatCreated: false,
          recordingCreated: false,
          matterCreated: false,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "calendar",
      known: true,
      matterScope: "optional_matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "requestId",
        "profileId",
        "eventId",
        "decision",
        "cueStatus",
        "ageHours",
        "automaticFinalConfirmation",
        "autoExpires",
        "providerSync",
        "publicRoomCreated",
        "nativeMediaCreated",
        "chatCreated",
        "recordingCreated",
        "matterCreated",
      ]),
    );
    expect(classification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["requesterName", "requesterEmail", "requestedStartsAt", "token"]),
    );
  });

  it("classifies conflict checks without raw prospective-party metadata", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "conflict_check.completed",
        resourceType: "conflict_check",
        resourceId: "conflict-check-001",
        metadata: {
          resultCount: 1,
          includeClosedMatters: true,
          partyRole: "prospective_client",
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "conflicts",
      known: true,
      matterScope: "optional_matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining(["resultCount", "includeClosedMatters", "partyRole"]),
    );
    expect(classification.metadataHints.resource).not.toContain("prospectiveName");
    expect(classification.metadataHints.resource).not.toContain("matchCount");
  });

  it("classifies credential mutations without secrets, tokens, or raw credentials", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "auth_credential.recovery_codes.generated",
        resourceType: "auth_credential",
        resourceId: "user-001",
        metadata: { userId: "user-001", codeCount: 10 },
      }),
    );

    expect(classification).toMatchObject({
      category: "access",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining(["userId", "codeCount"]),
    );
    expect(classification.metadataHints.resource).not.toContain("code");
    expect(classification.metadataHints.resource).not.toContain("token");
    expect(classification.metadataHints.resource).not.toContain("credential");
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

  it("classifies matter lifecycle command audit metadata as matter-scoped", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "matter.lifecycle_command_executed",
        resourceType: "matter",
        resourceId: "matter-001",
        metadata: {
          matterId: "matter-001",
          transitionRecordId: "matter-lifecycle-pause",
          lifecycleCommand: "pause",
          beforeStatus: "open",
          expectedStatus: "open",
          afterStatus: "paused",
          executedByUserId: "user-licensee",
          reasonPresent: true,
          idempotencyKeyPresent: true,
          matterStatusChanged: true,
          closedOnChanged: false,
          portalAccessChanged: false,
          taskChanged: false,
          assignmentChanged: false,
          billingChanged: false,
          trustChanged: false,
          retentionChanged: false,
          cleanupRun: false,
          reviewFirst: true,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "matter_lifecycle",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "lifecycleCommand",
        "idempotencyKeyPresent",
        "retentionChanged",
        "cleanupRun",
      ]),
    );
    expect(classification.metadataHints.actor).toEqual(
      expect.arrayContaining(["executedByUserId"]),
    );
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

  it("classifies legal research artifact events as matter-scoped without note bodies", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "legal_research.artifact.created",
        resourceType: "legal_research",
        resourceId: "research-artifact-001",
        metadata: {
          matterId: "matter-001",
          artifactId: "research-artifact-001",
          artifactKind: "cited_source_note",
          status: "ready_for_review",
          sourceReferenceCount: 1,
          contextLinkCount: 2,
          titleLength: 32,
          noteLength: 48,
          reviewOnly: true,
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "legal_research",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining(["artifactId", "artifactKind", "noteLength", "reviewOnly"]),
    );
    expect(classification.metadataHints.resource).not.toContain("note");
    expect(classification.metadataHints.resource).not.toContain("sourceLabel");
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

  it("classifies contact-history export requests with posture-only metadata", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "contact_history_export.requested",
        resourceType: "contact_history_export",
        resourceId: "contact-ada",
        metadata: {
          contactId: "contact-ada",
          matterId: "matter-001",
          matterScoped: true,
          jobId: "contact-history-export-job",
          purpose: "staff_review",
          reviewReasonPresent: true,
          generatedCategoryCount: 11,
          timelineEntryCount: 4,
          matterAssociationCount: 1,
          portalGrantCount: 1,
          conflictSummaryCount: 2,
          documentHoldCueCount: 1,
          retentionHoldCueCount: 1,
          downloadExpiresAt: "2026-06-17T12:00:00.000Z",
          enqueueStatus: "queued_for_local_report_worker",
          idempotencyKeyPresent: true,
          retentionPosture: "queued_regenerated_download_no_retained_export_body",
          legalHoldPosture: "respects_existing_matter_visibility_no_hold_override",
          privacyPosture: "redacted_authorized_projection_only",
          storedBody: false,
          retainedExportArtifact: false,
          deletionAutomation: false,
          retentionDeadline: false,
          legalHoldOverride: false,
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
        "matterId",
        "matterScoped",
        "jobId",
        "purpose",
        "reviewReasonPresent",
        "generatedCategoryCount",
        "timelineEntryCount",
        "matterAssociationCount",
        "portalGrantCount",
        "conflictSummaryCount",
        "documentHoldCueCount",
        "retentionHoldCueCount",
        "downloadExpiresAt",
        "enqueueStatus",
        "idempotencyKeyPresent",
        "retentionPosture",
        "legalHoldPosture",
        "privacyPosture",
        "storedBody",
        "retainedExportArtifact",
        "deletionAutomation",
        "retentionDeadline",
        "legalHoldOverride",
      ]),
    );
    expect(classification.metadataHints.resource).not.toEqual(
      expect.arrayContaining([
        "displayName",
        "email",
        "phone",
        "address",
        "export",
        "reviewReason",
      ]),
    );
  });

  it("classifies contact-history export downloads with link-only metadata", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "contact_history_export.downloaded",
        resourceType: "contact_history_export",
        resourceId: "contact-ada",
        metadata: {
          contactId: "contact-ada",
          matterId: "matter-001",
          matterScoped: true,
          jobId: "contact-history-export-job",
          purpose: "staff_review",
          downloadExpiresAt: "2026-06-17T12:00:00.000Z",
          retentionPosture: "queued_regenerated_download_no_retained_export_body",
          legalHoldPosture: "respects_existing_matter_visibility_no_hold_override",
          privacyPosture: "redacted_authorized_projection_only",
          storedBody: false,
          retainedExportArtifact: false,
          deletionAutomation: false,
          retentionDeadline: false,
          legalHoldOverride: false,
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
        "matterId",
        "matterScoped",
        "jobId",
        "purpose",
        "downloadExpiresAt",
        "retentionPosture",
        "legalHoldPosture",
        "privacyPosture",
        "storedBody",
        "retainedExportArtifact",
        "deletionAutomation",
        "retentionDeadline",
        "legalHoldOverride",
      ]),
    );
    expect(classification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["displayName", "email", "phone", "address", "exportBody"]),
    );
  });

  it("classifies report export downloads with safe no-storage metadata hints", () => {
    const cases = [
      {
        action: "audit_export.downloaded",
        category: "audit_integrity",
        resourceType: "audit_export",
        matterScope: "firm",
        metadata: {
          jobId: "job-audit-export",
          reportType: "audit_log",
          reportScope: "firm",
          eventCount: 12,
          generatedAt: "2026-06-29T12:00:00.000Z",
          retentionPosture: "queued_regenerated_download_no_retained_export_body",
          storedBody: false,
          retainedExportArtifact: false,
          exportBodyStoredInJobMetadata: false,
        },
        expectedHints: ["eventCount"],
      },
      {
        action: "billing_export.downloaded",
        category: "billing",
        resourceType: "billing_export",
        matterScope: "optional_matter",
        metadata: {
          jobId: "job-billing-export",
          reportType: "billing",
          reportScope: "matter",
          fieldProfileId: "billing_operational_records_json",
          matterId: "matter-001",
          recordCount: 8,
          timeEntryCount: 2,
          expenseEntryCount: 1,
          invoiceCount: 3,
          paymentCount: 1,
          trustTransferRequestCount: 1,
          generatedAt: "2026-06-29T12:00:00.000Z",
          retentionPosture: "queued_regenerated_download_no_retained_export_body",
          storedBody: false,
          retainedExportArtifact: false,
          exportBodyStoredInJobMetadata: false,
        },
        expectedHints: [
          "fieldProfileId",
          "matterId",
          "recordCount",
          "timeEntryCount",
          "expenseEntryCount",
          "invoiceCount",
          "paymentCount",
          "trustTransferRequestCount",
        ],
      },
      {
        action: "staff_report_export.downloaded",
        category: "operations",
        resourceType: "staff_report_export",
        matterScope: "firm",
        metadata: {
          jobId: "job-staff-report-export",
          reportType: "staff_reporting",
          reportScope: "firm",
          reportDefinitionKey: "productivity",
          exportProfileId: "summary_json",
          groupingKey: "staff_member",
          rowCount: 4,
          generatedAt: "2026-06-29T12:00:00.000Z",
          retentionPosture: "queued_regenerated_download_no_retained_export_body",
          storedBody: false,
          retainedExportArtifact: false,
          exportBodyStoredInJobMetadata: false,
        },
        expectedHints: ["reportDefinitionKey", "exportProfileId", "groupingKey", "rowCount"],
      },
      {
        action: "jurisdictional_trust_export.downloaded",
        category: "trust",
        resourceType: "jurisdictional_trust_export",
        matterScope: "firm",
        metadata: {
          jobId: "job-jurisdictional-trust-export",
          reportType: "jurisdictional_trust",
          reportScope: "firm",
          fieldProfileId: "jurisdictional_trust_summary_json",
          jurisdiction: "BC",
          ledgerAccountCount: 5,
          ledgerEntryCount: 7,
          balanceCount: 3,
          trustBalanceCount: 2,
          generatedAt: "2026-06-29T12:00:00.000Z",
          retentionPosture: "queued_regenerated_download_no_retained_export_body",
          storedBody: false,
          retainedExportArtifact: false,
          exportBodyStoredInJobMetadata: false,
        },
        expectedHints: [
          "fieldProfileId",
          "jurisdiction",
          "ledgerAccountCount",
          "ledgerEntryCount",
          "balanceCount",
          "trustBalanceCount",
        ],
      },
    ] as const;

    for (const item of cases) {
      const classification = classifyAuditEvent(
        auditEvent({
          action: item.action,
          resourceType: item.resourceType,
          resourceId: `${item.resourceType}-001`,
          metadata: item.metadata,
        }),
      );

      expect(classification).toMatchObject({
        action: item.action,
        category: item.category,
        known: true,
        matterScope: item.matterScope,
        resourceTypeMatches: true,
      });
      expect(classification.metadataHints.resource).toEqual(
        expect.arrayContaining([
          "jobId",
          "reportType",
          "reportScope",
          "generatedAt",
          "retentionPosture",
          "storedBody",
          "retainedExportArtifact",
          "exportBodyStoredInJobMetadata",
          ...item.expectedHints,
        ]),
      );
      for (const unsafeKey of [
        "rawBody",
        "exportBody",
        "fieldKeys",
        "statementEvidence",
        "events",
        "auditEvents",
        "rawAuditPayload",
        "privateMetadata",
      ]) {
        expect(classification.metadataHints.resource).not.toContain(unsafeKey);
      }
    }
  });

  it("keeps one billing export request taxonomy entry", () => {
    expect(
      auditEventTaxonomyDefinitions.filter(
        (definition) => definition.action === "billing_export.requested",
      ),
    ).toHaveLength(1);
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

  it("classifies trust posting request review events without raw note bodies", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "ledger.posting_request.rejected",
        resourceType: "ledger_posting_request",
        resourceId: "posting-request-001",
        metadata: {
          matterIds: ["matter-001"],
          postingRequestId: "posting-request-001",
          transactionId: "trust-posting-001",
          accountIds: ["acct-trust-bank", "acct-client-liability"],
          previousStatus: "pending_approval",
          status: "rejected",
          reviewNotesPresent: true,
          rejectionReasonPresent: true,
          rejectionReason: "Synthetic raw reason should not be a hint",
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "trust",
      known: true,
      matterScope: "optional_matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "postingRequestId",
        "transactionId",
        "accountIds",
        "previousStatus",
        "status",
        "reviewNotesPresent",
        "rejectionReasonPresent",
      ]),
    );
    expect(classification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["reviewNotes", "rejectionReason"]),
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

    const paymentImportClassification = classifyAuditEvent(
      auditEvent({
        action: "payment_import_review_record.created",
        resourceType: "payment_import_review_record",
        resourceId: "payment-import-review-001",
        metadata: {
          matterId: "matter-001",
          paymentImportReviewRecordId: "payment-import-review-001",
          providerLabel: "synthetic_processor",
          eventFamily: "payment",
          eventStatus: "payment_observed",
          externalEventId: "evt_synthetic",
          externalPaymentIdPresent: true,
          externalDepositIdPresent: true,
          externalPaymentId: "pay_private_synthetic",
          amountCents: 13230,
          candidateManualPaymentId: "payment-synthetic",
          refundChargebackReviewCueCategory: "refund",
          refundChargebackReviewCueStatus: "needs_review",
          refundChargebackReviewAction: "staff_refund_chargeback_review_required",
          rawPayload: { private: "synthetic private body" },
          disputePacket: { private: "synthetic private dispute packet" },
          rawProviderPayloadRetained: false,
          invoiceBalanceMutation: "none",
          settlementAutomation: false,
          reconciliationMutation: "none",
          refundHandling: "review_only",
          chargebackHandling: "review_only",
          trustPosting: "none",
          providerCommand: "none",
          clientNotification: "none",
        },
      }),
    );
    expect(paymentImportClassification).toMatchObject({
      category: "billing",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(paymentImportClassification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "paymentImportReviewRecordId",
        "providerLabel",
        "eventFamily",
        "eventStatus",
        "externalEventId",
        "externalPaymentIdPresent",
        "externalDepositIdPresent",
        "candidateManualPaymentId",
        "refundChargebackReviewCueCategory",
        "refundChargebackReviewCueStatus",
        "refundChargebackReviewAction",
        "rawProviderPayloadRetained",
        "invoiceBalanceMutation",
        "settlementAutomation",
        "reconciliationMutation",
        "refundHandling",
        "chargebackHandling",
        "trustPosting",
        "providerCommand",
        "clientNotification",
      ]),
    );
    expect(paymentImportClassification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["externalPaymentId", "rawPayload", "disputePacket"]),
    );

    const depositMatchReviewClassification = classifyAuditEvent(
      auditEvent({
        action: "payment_import_deposit_match_review.recorded",
        resourceType: "payment_import_deposit_match_review",
        resourceId: "deposit-match-review-001",
        metadata: {
          matterId: "matter-001",
          paymentImportDepositMatchReviewId: "deposit-match-review-001",
          paymentImportReviewRecordId: "payment-import-review-001",
          candidateManualPaymentId: "payment-synthetic",
          candidateInvoiceId: "invoice-synthetic",
          decision: "candidate_supported",
          reason: "candidate_evidence_matches",
          importAmountCents: 13230,
          manualPaymentAmountCents: 13230,
          currency: "CAD",
          candidateManualPaymentStatus: "pending_reconciliation",
          reviewerEvidencePresent: true,
          idempotencyKeyPresent: true,
          idempotencyKey: "synthetic-private-key",
          rawProviderPayloadRetained: false,
          invoiceBalanceMutation: "none",
          settlementAutomation: false,
          reconciliationMutation: "none",
          refundHandling: "none",
          chargebackHandling: "none",
          trustPosting: "none",
          providerCommand: "none",
          clientNotification: "none",
          depositMatching: "review_decision_only",
        },
      }),
    );
    expect(depositMatchReviewClassification).toMatchObject({
      category: "billing",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(depositMatchReviewClassification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "paymentImportDepositMatchReviewId",
        "paymentImportReviewRecordId",
        "candidateManualPaymentId",
        "decision",
        "reason",
        "candidateManualPaymentStatus",
        "reviewerEvidencePresent",
        "idempotencyKeyPresent",
        "providerCommand",
        "clientNotification",
      ]),
    );
    expect(depositMatchReviewClassification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["idempotencyKey", "rawPayload"]),
    );

    const refundChargebackReviewClassification = classifyAuditEvent(
      auditEvent({
        action: "payment_import_refund_chargeback_review.recorded",
        resourceType: "payment_import_refund_chargeback_review",
        resourceId: "refund-chargeback-review-001",
        metadata: {
          matterId: "matter-001",
          paymentImportRefundChargebackReviewId: "refund-chargeback-review-001",
          paymentImportReviewRecordId: "payment-import-review-001",
          category: "refund",
          decision: "exception_confirmed",
          reason: "refund_observed",
          reviewerEvidencePresent: true,
          idempotencyKeyPresent: true,
          idempotencyKey: "synthetic-private-key",
          externalEventId: "evt_synthetic_private",
          disputePacket: { private: "synthetic private dispute packet" },
          refundArtifact: { private: "synthetic private refund artifact" },
          rawProviderPayloadRetained: false,
          refundArtifactRetained: false,
          disputeArtifactRetained: false,
          invoiceBalanceMutation: "none",
          ledgerReversal: "none",
          trustPosting: "none",
          providerCommand: "none",
          clientNotification: "none",
          fundsMovement: "none",
          refundHandling: "review_decision_only",
          chargebackHandling: "review_decision_only",
        },
      }),
    );
    expect(refundChargebackReviewClassification).toMatchObject({
      category: "billing",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(refundChargebackReviewClassification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "paymentImportRefundChargebackReviewId",
        "paymentImportReviewRecordId",
        "category",
        "decision",
        "reason",
        "reviewerEvidencePresent",
        "idempotencyKeyPresent",
        "rawProviderPayloadRetained",
        "refundArtifactRetained",
        "disputeArtifactRetained",
        "invoiceBalanceMutation",
        "ledgerReversal",
        "providerCommand",
        "clientNotification",
        "fundsMovement",
      ]),
    );
    expect(refundChargebackReviewClassification.metadataHints.resource).not.toEqual(
      expect.arrayContaining([
        "idempotencyKey",
        "externalEventId",
        "disputePacket",
        "refundArtifact",
      ]),
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

  it("classifies accounting review profile events without bank source or note details", () => {
    const matchProfileClassification = classifyAuditEvent(
      auditEvent({
        action: "ledger.statement_match_rule_profile.recorded",
        resourceType: "ledger_statement_match_rule_profile",
        resourceId: "statement-match-profile-001",
        metadata: {
          accountId: "acct-trust-bank",
          referenceStrategy: "normalized_reference",
          descriptionStrategy: "normalized_contains",
          dateWindowDays: 2,
          amountToleranceCents: 0,
          varianceCategoryCount: 2,
          reviewerExplanationRequired: true,
          reviewOnly: true,
          varianceCategories: ["ledger_entry_expected", "needs_follow_up"],
        },
      }),
    );
    const accountingProfileClassification = classifyAuditEvent(
      auditEvent({
        action: "ledger.accounting_review_profile.recorded",
        resourceType: "ledger_accounting_review_profile",
        resourceId: "accounting-review-profile-001",
        metadata: {
          accountId: "acct-trust-bank",
          accountType: "trust_asset",
          boundaryPosture: "trust_only",
          protectedFunds: true,
          bankFeedImportStatus: "metadata_only",
          bankFeedSourceLabelPresent: true,
          automaticMatching: false,
          vendorTracking: "not_applicable",
          expenseCategoryTracking: "optional",
          clientMatterTracking: "required",
          reviewOnly: true,
          sourceLabel: "Synthetic private import label",
          notes: "Synthetic private review note.",
        },
      }),
    );

    expect(matchProfileClassification).toMatchObject({
      category: "trust",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
    expect(matchProfileClassification.metadataHints.resource).toEqual([
      "accountId",
      "referenceStrategy",
      "descriptionStrategy",
      "dateWindowDays",
      "amountToleranceCents",
      "varianceCategoryCount",
      "reviewerExplanationRequired",
      "reviewOnly",
    ]);
    expect(matchProfileClassification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["varianceCategories"]),
    );
    expect(accountingProfileClassification).toMatchObject({
      category: "trust",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
    expect(accountingProfileClassification.metadataHints.resource).toEqual([
      "accountId",
      "accountType",
      "boundaryPosture",
      "protectedFunds",
      "bankFeedImportStatus",
      "bankFeedSourceLabelPresent",
      "automaticMatching",
      "vendorTracking",
      "expenseCategoryTracking",
      "clientMatterTracking",
      "reviewOnly",
    ]);
    expect(accountingProfileClassification.metadataHints.resource).not.toEqual(
      expect.arrayContaining(["sourceLabel", "notes", "protectedFundsReason"]),
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

  it("classifies inbound matter draft metadata without raw message details", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "inbound_email.matter_draft.confirmed",
        resourceType: "inbound_email",
        resourceId: "inbound-message-001",
        metadata: {
          sourceMessageId: "inbound-message-001",
          providerMessageIdPresent: true,
          receivedAt: "2026-05-01T18:00:00.000Z",
          recipientCount: 1,
          attachmentCount: 0,
          subjectPresent: true,
          redactedSummaryLength: 64,
          proposedTitleLength: 28,
          proposedPracticeArea: "Residential tenancy",
          proposedJurisdiction: "BC",
          clientKind: "person",
          automaticMatterCreation: false,
          rawStorageKey: "inbound-email/firm-west-legal/raw/private.eml",
          rawBody: "Private client message",
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "communications",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "sourceMessageId",
        "providerMessageIdPresent",
        "redactedSummaryLength",
        "proposedTitleLength",
        "automaticMatterCreation",
      ]),
    );
    expect(classification.metadataHints.resource).not.toContain("rawStorageKey");
    expect(classification.metadataHints.resource).not.toContain("rawBody");
  });

  it("classifies inbound parser recovery metadata without raw object hints", () => {
    const retry = classifyAuditEvent(
      auditEvent({
        action: "inbound_email.parser_job.manual_retry",
        resourceType: "inbound_email",
        resourceId: "job-inbound-parser-failed",
        metadata: {
          jobId: "job-inbound-parser-failed",
          retryJobId: "job-inbound-parser-retry",
          queueName: "inbound_email",
          jobName: "parse_inbound_email",
          beforeStatus: "failed",
          expectedStatus: "failed",
          afterStatus: "queued",
          provider: "mailgun",
          source: "mailgun.raw_mime_webhook",
          idempotencyKeyPresent: true,
          retryJobQueued: true,
          rawStorageKey:
            "inbound-email/firm-west-legal/raw/provider-webhooks/mailgun/raw-mime/message.eml",
          signingSecret: "synthetic-mailgun-signing-key",
        },
      }),
    );
    const deadLetter = classifyAuditEvent(
      auditEvent({
        action: "inbound_email.parser_job.manual_dead_letter",
        resourceType: "inbound_email",
        resourceId: "job-inbound-parser-failed",
        metadata: {
          jobId: "job-inbound-parser-failed",
          queueName: "inbound_email",
          jobName: "parse_inbound_email",
          beforeStatus: "failed",
          expectedStatus: "failed",
          afterStatus: "dead_letter",
          provider: "mailgun",
          source: "mailgun.raw_mime_webhook",
          idempotencyKeyPresent: true,
          retryJobQueued: false,
        },
      }),
    );
    const replayRequest = classifyAuditEvent(
      auditEvent({
        action: "inbound_email.parser_job.replay_requested",
        resourceType: "inbound_email",
        resourceId: "job-inbound-parser-failed",
        metadata: {
          jobId: "job-inbound-parser-failed",
          queueName: "inbound_email",
          jobName: "parse_inbound_email",
          expectedStatus: "failed",
          currentStatus: "failed",
          provider: "mailgun",
          source: "mailgun.raw_mime_webhook",
          idempotencyKeyPresent: true,
          reviewOnly: true,
          requestType: "inbound_email_parser_safe_replay",
          reviewState: "replay_requested",
          redactedAuthorizedProjection: true,
          rawStorageKey:
            "inbound-email/firm-west-legal/raw/provider-webhooks/mailgun/raw-mime/message.eml",
          providerPayload: { private: "Synthetic payload" },
          mailboxPassword: "synthetic-mailbox-password",
        },
      }),
    );

    expect(retry).toMatchObject({
      category: "communications",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
    expect(deadLetter).toMatchObject({
      category: "communications",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
    expect(replayRequest).toMatchObject({
      category: "communications",
      known: true,
      matterScope: "firm",
      resourceTypeMatches: true,
    });
    expect(retry.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "jobId",
        "retryJobId",
        "queueName",
        "jobName",
        "beforeStatus",
        "expectedStatus",
        "afterStatus",
        "provider",
        "source",
        "idempotencyKeyPresent",
        "retryJobQueued",
      ]),
    );
    expect(retry.metadataHints.resource).not.toContain("rawStorageKey");
    expect(retry.metadataHints.resource).not.toContain("signingSecret");
    expect(replayRequest.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "jobId",
        "queueName",
        "jobName",
        "expectedStatus",
        "currentStatus",
        "provider",
        "source",
        "idempotencyKeyPresent",
        "reviewOnly",
        "requestType",
        "reviewState",
        "redactedAuthorizedProjection",
      ]),
    );
    expect(replayRequest.metadataHints.resource).not.toContain("rawStorageKey");
    expect(replayRequest.metadataHints.resource).not.toContain("providerPayload");
    expect(replayRequest.metadataHints.resource).not.toContain("mailboxPassword");
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

  it("classifies AI operational proposal events without generated text hints", () => {
    const queued = classifyAuditEvent(
      auditEvent({
        action: "ai_operational_proposal.async_queued",
        resourceType: "ai_proposal",
        resourceId: "job-001",
        metadata: {
          matterId: "matter-001",
          draftId: "draft-001",
          proposalKinds: "deadline_extraction,task_creation",
          proposalKindCount: 2,
          provider: "fake-local-ai",
          jobId: "job-001",
          sourceTextLength: 42,
        },
      }),
    );
    const reviewed = classifyAuditEvent(
      auditEvent({
        action: "ai_operational_proposal.reviewed",
        resourceType: "ai_proposal",
        resourceId: "proposal-001",
        metadata: {
          matterId: "matter-001",
          proposalId: "proposal-001",
          proposalKind: "task_creation",
          decision: "approved",
          status: "approved",
        },
      }),
    );

    expect(queued).toMatchObject({
      category: "operations",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(queued.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "draftId",
        "proposalKinds",
        "proposalKindCount",
        "provider",
        "jobId",
      ]),
    );
    expect(queued.metadataHints.resource).not.toContain("proposal");
    expect(reviewed).toMatchObject({
      category: "operations",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
  });

  it("classifies task lifecycle events as matter-scoped operations", () => {
    for (const action of [
      "task.created",
      "task.updated",
      "task.completed",
      "task.reopened",
      "task.archived",
    ]) {
      expect(
        classifyAuditEvent(
          auditEvent({
            action,
            resourceType: "task",
            resourceId: "task-001",
            metadata: {
              matterId: "matter-001",
              taskId: "task-001",
              assignedToUserId: "user-licensee",
              completedByUserId: "user-admin",
              reopenedByUserId: "user-admin",
              archivedByUserId: "user-admin",
            },
          }),
        ),
      ).toMatchObject({
        category: "operations",
        known: true,
        matterScope: "matter",
        resourceTypeMatches: true,
      });
    }
  });

  it("classifies calendar event updates with safe meeting-link metadata only", () => {
    const classification = classifyAuditEvent(
      auditEvent({
        action: "calendar.event.updated",
        resourceType: "calendar_event",
        resourceId: "calendar-event-001",
        metadata: {
          matterId: "matter-001",
          eventId: "calendar-event-001",
          uid: "calendar-event-001@open-practice.local",
          scope: "matter",
          clientContactId: undefined,
          status: "confirmed",
          sequence: 3,
          attendeeCount: 1,
          reminderCount: 1,
          meetingLinkMode: "external_url",
          meetingProviderKey: "open-practice-webrtc",
          hasMeetingLink: true,
          startsAtChanged: true,
          endsAtChanged: false,
          source: "caldav",
          credentialId: "calendar-credential-001",
          meetingLinkUrl: "https://video.example.test/private-room",
          meetingUrl: "https://video.example.test/private-room",
          meetingRoomId: "room-private-001",
          token: "raw-token-should-not-classify",
          tokenHash: "hmac-sha256:should-not-classify",
          attendeeEmail: "ada.morgan@example.test",
          invitationBody: "Synthetic invitation body should not classify.",
        },
      }),
    );

    expect(classification).toMatchObject({
      category: "calendar",
      known: true,
      matterScope: "matter",
      resourceTypeMatches: true,
    });
    expect(classification.metadataHints.resource).toEqual(
      expect.arrayContaining([
        "eventId",
        "uid",
        "scope",
        "status",
        "sequence",
        "attendeeCount",
        "reminderCount",
        "meetingLinkMode",
        "meetingProviderKey",
        "hasMeetingLink",
        "startsAtChanged",
        "endsAtChanged",
        "source",
        "credentialId",
      ]),
    );
    expectNoSensitiveCalendarMetadataHints(classification.metadataHints.resource);
  });

  it("classifies calendar invitation audit events with safe boundary metadata only", () => {
    const cases = [
      {
        action: "calendar.invitation.queued",
        metadata: {
          matterId: "matter-001",
          eventId: "calendar-event-001",
          attendeeId: "calendar-attendee-001",
          attendeeCount: 1,
          invitationStatus: "queued",
          emailId: "email-001",
          jobId: "job-001",
          requestedMeetingLink: true,
          meetingLinkMode: "external_url",
          meetingLinkIncluded: true,
          meetingProviderKey: "open-practice-webrtc",
          requestedGuestAccessToken: false,
          meetingLinksStatus: "configured",
          meetingLinksProvider: "open-practice-webrtc",
          guestAccessStatus: "configured",
          guestAccessProvider: "open-practice-webrtc",
          invitationEmailStatus: "configured",
          invitationEmailProvider: "smtp",
          meetingBoundary: "calendar_invitation_or_staff_handoff",
          meetingLinkUrl: "https://video.example.test/private-room",
          guestAccessToken: "raw-token-should-not-classify",
          tokenHash: "hmac-sha256:should-not-classify",
          attendeeEmail: "ada.morgan@example.test",
          invitationBody: "Synthetic invitation body should not classify.",
        },
        expectedHints: ["emailId", "jobId"],
      },
      {
        action: "calendar.invitation.skipped",
        metadata: {
          matterId: "matter-001",
          eventId: "calendar-event-001",
          attendeeId: "calendar-attendee-001",
          attendeeCount: 1,
          invitationStatus: "skipped",
          requestedMeetingLink: false,
          meetingLinkMode: "blank",
          meetingLinkIncluded: false,
          requestedGuestAccessToken: false,
          meetingLinksStatus: "disabled",
          meetingLinksReason: "not_configured",
          guestAccessStatus: "disabled",
          guestAccessReason: "not_configured",
          invitationEmailStatus: "disabled",
          invitationEmailReason: "smtp_not_configured",
          reason: "email_delivery_not_configured",
          meetingBoundary: "calendar_invitation_or_staff_handoff",
          meetingUrl: "https://video.example.test/private-room",
          token: "raw-token-should-not-classify",
          tokenHash: "hmac-sha256:should-not-classify",
          email: "ada.morgan@example.test",
          textBody: "Synthetic invitation body should not classify.",
        },
        expectedHints: ["reason"],
      },
    ];

    for (const { action, metadata, expectedHints } of cases) {
      const classification = classifyAuditEvent(
        auditEvent({
          action,
          resourceType: "calendar_event",
          resourceId: "calendar-event-001",
          metadata,
        }),
      );

      expect(classification).toMatchObject({
        category: "calendar",
        known: true,
        matterScope: "matter",
        resourceTypeMatches: true,
      });
      expect(classification.metadataHints.resource).toEqual(
        expect.arrayContaining([
          "eventId",
          "attendeeId",
          "attendeeCount",
          "invitationStatus",
          "requestedMeetingLink",
          "meetingLinkMode",
          "meetingLinkIncluded",
          "meetingProviderKey",
          "requestedGuestAccessToken",
          "meetingLinksStatus",
          "guestAccessStatus",
          "invitationEmailStatus",
          "meetingBoundary",
          ...expectedHints,
        ]),
      );
      expectNoSensitiveCalendarMetadataHints(classification.metadataHints.resource);
    }
  });

  it("classifies hosted calendar meeting session events without URL or token hints", () => {
    for (const action of [
      "calendar.meeting_session.created",
      "calendar.meeting_session.updated",
      "calendar.meeting_session.ended",
    ]) {
      const classification = classifyAuditEvent(
        auditEvent({
          action,
          resourceType: "calendar_meeting_session",
          resourceId: "meeting-session-001",
          metadata: {
            matterId: "matter-001",
            eventId: "calendar-event-001",
            sessionId: "meeting-session-001",
            status: action.endsWith(".ended") ? "ended" : "lobby_open",
            endedAt: action.endsWith(".ended") ? "2026-05-03T16:45:00.000Z" : undefined,
            retentionUntil: "2026-08-03T16:00:00.000Z",
            issuedCount: 1,
            waitingCount: 0,
            admittedCount: 1,
            deniedCount: 0,
            revokedCount: 0,
            meetingLinkUrl: "https://video.example.test/private-room",
            token: "raw-token-should-not-classify",
            tokenHash: "hmac-sha256:should-not-classify",
            attendeeEmail: "ada.morgan@example.test",
          },
        }),
      );

      expect(classification).toMatchObject({
        category: "calendar",
        known: true,
        matterScope: "matter",
        resourceTypeMatches: true,
      });
      expect(classification.metadataHints.resource).toEqual(
        expect.arrayContaining([
          "eventId",
          "sessionId",
          "status",
          "endedAt",
          "retentionUntil",
          "issuedCount",
          "waitingCount",
          "admittedCount",
          "deniedCount",
          "revokedCount",
        ]),
      );
      expectNoSensitiveCalendarMetadataHints(classification.metadataHints.resource);
    }
  });

  it("classifies hosted calendar guest link events without URL, token, email, or body hints", () => {
    for (const action of [
      "calendar.guest_link.created",
      "calendar.guest_link.updated",
      "calendar.guest_link.revoked",
    ]) {
      const classification = classifyAuditEvent(
        auditEvent({
          action,
          resourceType: "calendar_guest_link",
          resourceId: "guest-link-001",
          metadata: {
            matterId: "matter-001",
            eventId: "calendar-event-001",
            sessionId: "meeting-session-001",
            linkId: "guest-link-001",
            status: action.endsWith(".revoked") ? "revoked" : "admitted",
            expiresAt: "2026-05-03T18:00:00.000Z",
            checkedInAt: "2026-05-03T16:10:00.000Z",
            admittedAt: "2026-05-03T16:20:00.000Z",
            deniedAt: undefined,
            revokedAt: action.endsWith(".revoked") ? "2026-05-03T16:30:00.000Z" : undefined,
            retentionUntil: "2026-08-03T16:00:00.000Z",
            meetingUrl: "https://video.example.test/private-room",
            guestToken: "raw-token-should-not-classify",
            tokenHash: "hmac-sha256:should-not-classify",
            email: "ada.morgan@example.test",
            invitationBody: "Synthetic invitation body should not classify.",
          },
        }),
      );

      expect(classification).toMatchObject({
        category: "calendar",
        known: true,
        matterScope: "matter",
        resourceTypeMatches: true,
      });
      expect(classification.metadataHints.resource).toEqual(
        expect.arrayContaining([
          "eventId",
          "sessionId",
          "linkId",
          "status",
          "expiresAt",
          "checkedInAt",
          "admittedAt",
          "deniedAt",
          "revokedAt",
          "retentionUntil",
        ]),
      );
      expectNoSensitiveCalendarMetadataHints(classification.metadataHints.resource);
    }
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
    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
    expect(verifyAuditChain([first, second])).toBe(true);
    expect(verifyAuditChain([first, { ...second, sequence: 3 }])).toBe(false);
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
