import type { AuditEvent } from "./audit.js";

export type AuditEventCategory =
  | "access"
  | "audit_integrity"
  | "billing"
  | "calendar"
  | "communications"
  | "conflicts"
  | "documents"
  | "drafting"
  | "intake"
  | "legal_clinic"
  | "matter_lifecycle"
  | "operations"
  | "outbound_webhooks"
  | "portal"
  | "setup"
  | "signatures"
  | "trust"
  | "unknown";

export type AuditMatterScopeHint = "firm" | "matter" | "optional_matter" | "derived";
export type AuditActorHint =
  | "authenticated_user"
  | "provider_callback"
  | "public_portal_actor"
  | "setup_owner"
  | "system_seed"
  | "unknown";

export interface AuditEventTaxonomyDefinition {
  action: string;
  category: AuditEventCategory;
  resourceType?: string;
  matterScope: AuditMatterScopeHint;
  actorHint: AuditActorHint;
  matterMetadataKeys: readonly string[];
  resourceMetadataKeys: readonly string[];
  actorMetadataKeys: readonly string[];
}

export interface AuditEventClassification {
  action: string;
  category: AuditEventCategory;
  known: boolean;
  expectedResourceType?: string;
  resourceType: string;
  matterScope: AuditMatterScopeHint;
  actorHint: AuditActorHint;
  metadataHints: {
    matter: readonly string[];
    resource: readonly string[];
    actor: readonly string[];
  };
  hasMatterId: boolean;
  resourceTypeMatches: boolean;
}

export interface AuditEventTaxonomySummary {
  total: number;
  known: number;
  unknown: number;
  byCategory: Partial<Record<AuditEventCategory, number>>;
  byMatterScope: Partial<Record<AuditMatterScopeHint, number>>;
  byActorHint: Partial<Record<AuditActorHint, number>>;
  matterScopedWithoutMatterId: number;
  resourceTypeMismatches: Array<{
    action: string;
    expectedResourceType: string;
    observedResourceType: string;
    count: number;
  }>;
  unknownActions: string[];
}

const RESOURCE_ID_KEYS = [
  "attendeeId",
  "credentialId",
  "documentId",
  "draftId",
  "emailId",
  "eventId",
  "externalId",
  "invoiceId",
  "jobId",
  "linkId",
  "packageId",
  "providerEventId",
  "providerRequestId",
  "retryOfJobId",
  "signatureRequestId",
  "templateId",
  "deliveryId",
  "transactionId",
  "uploadId",
] as const;

const MATTER_KEYS = ["matterId"] as const;
const ACTOR_KEYS = [
  "actorId",
  "actorType",
  "createdByUserId",
  "reviewedByUserId",
  "requestedByUserId",
] as const;
const WORKFLOW_RESOURCE_KEYS = [
  "requestId",
  "workflowStatus",
  "beforeStatus",
  "expectedStatus",
  "afterStatus",
  "attemptNumber",
  "maxAttempts",
  "retryOfJobId",
  "nextAttemptAt",
  "idempotencyKeyPresent",
  "errorSummary",
] as const;

function define(
  definition: Omit<
    AuditEventTaxonomyDefinition,
    "matterMetadataKeys" | "resourceMetadataKeys" | "actorMetadataKeys"
  > &
    Partial<
      Pick<
        AuditEventTaxonomyDefinition,
        "matterMetadataKeys" | "resourceMetadataKeys" | "actorMetadataKeys"
      >
    >,
): AuditEventTaxonomyDefinition {
  return {
    matterMetadataKeys: MATTER_KEYS,
    resourceMetadataKeys: RESOURCE_ID_KEYS,
    actorMetadataKeys: ACTOR_KEYS,
    ...definition,
  };
}

export const auditEventTaxonomyDefinitions = [
  define({
    action: "setup.completed",
    category: "setup",
    resourceType: "firm",
    matterScope: "firm",
    actorHint: "setup_owner",
    matterMetadataKeys: [],
    resourceMetadataKeys: ["ownerUserId", "firstMatterId"],
    actorMetadataKeys: ["ownerUserId"],
  }),
  define({
    action: "matter.opened",
    category: "matter_lifecycle",
    resourceType: "matter",
    matterScope: "matter",
    actorHint: "system_seed",
    matterMetadataKeys: [],
    resourceMetadataKeys: ["jurisdiction", "practiceArea"],
    actorMetadataKeys: [],
  }),
  define({
    action: "conflict_check.completed",
    category: "conflicts",
    resourceType: "conflict_check",
    matterScope: "optional_matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["resultCount", "includeClosedMatters", "partyRole"],
  }),
  define({
    action: "portal.grant.created",
    category: "portal",
    resourceType: "portal_grant",
    matterScope: "matter",
    actorHint: "system_seed",
    resourceMetadataKeys: ["permissions"],
    actorMetadataKeys: [],
  }),
  define({
    action: "share_link.created",
    category: "portal",
    resourceType: "share_link",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["documentIds", "expiresAt", "requiresEmailVerification"],
  }),
  define({
    action: "share_link.revoked",
    category: "portal",
    resourceType: "share_link",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["revokedAt"],
  }),
  define({
    action: "external_upload.created",
    category: "portal",
    resourceType: "external_upload",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["expiresAt", "requiresEmailVerification"],
  }),
  define({
    action: "external_upload.revoked",
    category: "portal",
    resourceType: "external_upload",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["revokedAt"],
  }),
  define({
    action: "external_upload.document_reviewed",
    category: "portal",
    resourceType: "document",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: WORKFLOW_RESOURCE_KEYS,
    actorMetadataKeys: ["actorId", "actorType"],
  }),
  define({
    action: "document.upload_intent.created",
    category: "documents",
    resourceType: "document",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["documentId", "provider", "storageDisabled"],
  }),
  define({
    action: "document.upload.completed",
    category: "documents",
    resourceType: "document",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["documentId", "provider", "bytes", "status"],
  }),
  define({
    action: "document.scan_status.updated",
    category: "documents",
    resourceType: "document",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["documentId", "scanStatus", "provider"],
  }),
  define({
    action: "document_processing.ocr.queued",
    category: "documents",
    resourceType: "document",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: WORKFLOW_RESOURCE_KEYS,
    actorMetadataKeys: ["actorId", "actorType"],
  }),
  define({
    action: "intake_session.created",
    category: "intake",
    resourceType: "intake_session",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "intake_answer_snapshot.created",
    category: "intake",
    resourceType: "intake_session",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["intakeSessionId", "snapshotId", "questionCount"],
  }),
  define({
    action: "intake_generated_document.created",
    category: "intake",
    resourceType: "generated_document",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["documentId", "intakeSessionId", "templateId"],
  }),
  define({
    action: "intake.package.generated",
    category: "intake",
    resourceType: "intake_session",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["packageId", "documentCount", "signatureRequestCount"],
  }),
  define({
    action: "intake_template.created",
    category: "intake",
    resourceType: "intake_template",
    matterScope: "firm",
    actorHint: "authenticated_user",
    matterMetadataKeys: [],
    resourceMetadataKeys: ["templateId", "itemCount", "version"],
  }),
  define({
    action: "intake_template.updated",
    category: "intake",
    resourceType: "intake_template",
    matterScope: "firm",
    actorHint: "authenticated_user",
    matterMetadataKeys: [],
    resourceMetadataKeys: ["templateId", "itemCount", "version"],
  }),
  define({
    action: "intake_form_link.created",
    category: "intake",
    resourceType: "intake_form_link",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["intakeSessionId", "expiresAt", "itemCount"],
  }),
  define({
    action: "intake_signature_request.created",
    category: "intake",
    resourceType: "signature_request",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["intakeSessionId", "signatureRequestId", "signerCount"],
  }),
  define({
    action: "signature_request.created",
    category: "signatures",
    resourceType: "signature_request",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["signatureRequestId", "provider", "signerCount", "documentCount"],
  }),
  define({
    action: "signature_provider_event.recorded",
    category: "signatures",
    resourceType: "signature_request",
    matterScope: "derived",
    actorHint: "provider_callback",
    resourceMetadataKeys: ["signatureRequestId", "provider", "providerEventId", "status"],
  }),
  define({
    action: "signature_embedded_event.recorded",
    category: "signatures",
    resourceType: "signature_request",
    matterScope: "derived",
    actorHint: "public_portal_actor",
    resourceMetadataKeys: ["signatureRequestId", "eventType", "signerId"],
  }),
  define({
    action: "draft.created",
    category: "drafting",
    resourceType: "draft",
    matterScope: "optional_matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["draftId", "version"],
  }),
  define({
    action: "draft.updated",
    category: "drafting",
    resourceType: "draft",
    matterScope: "optional_matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["draftId", "version"],
  }),
  define({
    action: "draft.deleted",
    category: "drafting",
    resourceType: "draft",
    matterScope: "optional_matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["draftId"],
  }),
  define({
    action: "draft_template.created",
    category: "drafting",
    resourceType: "draft_template",
    matterScope: "firm",
    actorHint: "authenticated_user",
    matterMetadataKeys: [],
    resourceMetadataKeys: ["templateId", "category"],
  }),
  define({
    action: "draft_assist.created",
    category: "drafting",
    resourceType: "draft_assist",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["draftId", "documentId", "task", "provider", "model", "status"],
  }),
  define({
    action: "draft_assist.reviewed",
    category: "drafting",
    resourceType: "draft_assist",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["draftId", "documentId", "decision", "status"],
  }),
  define({
    action: "time_entry.created",
    category: "billing",
    resourceType: "time_entry",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "time_entry.updated",
    category: "billing",
    resourceType: "time_entry",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "time_entry.submitted",
    category: "billing",
    resourceType: "time_entry",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "time_entry.approved",
    category: "billing",
    resourceType: "time_entry",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "time_entry.written_off",
    category: "billing",
    resourceType: "time_entry",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "expense_entry.created",
    category: "billing",
    resourceType: "expense_entry",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "expense_entry.updated",
    category: "billing",
    resourceType: "expense_entry",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "expense_entry.submitted",
    category: "billing",
    resourceType: "expense_entry",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "expense_entry.approved",
    category: "billing",
    resourceType: "expense_entry",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "expense_entry.written_off",
    category: "billing",
    resourceType: "expense_entry",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "invoice.created",
    category: "billing",
    resourceType: "invoice",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "invoice.approved",
    category: "billing",
    resourceType: "invoice",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "invoice.issued",
    category: "billing",
    resourceType: "invoice",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "invoice.voided",
    category: "billing",
    resourceType: "invoice",
    matterScope: "matter",
    actorHint: "authenticated_user",
  }),
  define({
    action: "manual_payment.created",
    category: "billing",
    resourceType: "manual_payment",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["invoiceId", "paymentId", "amountCents", "method"],
  }),
  define({
    action: "trust_transfer_request.created",
    category: "trust",
    resourceType: "trust_transfer_request",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["invoiceId", "amountCents", "status"],
  }),
  define({
    action: "ledger.transaction.posted",
    category: "trust",
    resourceType: "ledger_transaction",
    matterScope: "optional_matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: WORKFLOW_RESOURCE_KEYS,
    actorMetadataKeys: ["actorId", "actorType"],
  }),
  define({
    action: "ledger.transaction_approval.decided",
    category: "trust",
    resourceType: "ledger_transaction_approval",
    matterScope: "optional_matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["transactionId", "decision", "status"],
  }),
  define({
    action: "ledger.reconciliation.created",
    category: "trust",
    resourceType: "ledger_reconciliation",
    matterScope: "firm",
    actorHint: "authenticated_user",
    matterMetadataKeys: [],
    resourceMetadataKeys: ["accountId", "statementDate", "balanced"],
  }),
  define({
    action: "email_outbox.queued",
    category: "communications",
    resourceType: "email_outbox",
    matterScope: "optional_matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["emailId", "jobId", "recipientCount", "templateKey", "provider"],
  }),
  define({
    action: "email_outbox.manual_retry",
    category: "communications",
    resourceType: "email_outbox",
    matterScope: "optional_matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: WORKFLOW_RESOURCE_KEYS,
    actorMetadataKeys: ["actorId", "actorType"],
  }),
  define({
    action: "connector.created",
    category: "operations",
    resourceType: "connector",
    matterScope: "firm",
    actorHint: "authenticated_user",
    resourceMetadataKeys: [
      "connectorId",
      "connectorType",
      "connectorKey",
      "status",
      "secretReferencePresent",
    ],
  }),
  define({
    action: "connector_outbox.queued",
    category: "operations",
    resourceType: "connector_outbox",
    matterScope: "firm",
    actorHint: "authenticated_user",
    resourceMetadataKeys: [
      "connectorId",
      "connectorType",
      "eventType",
      "idempotencyKey",
      "resourceType",
      "resourceId",
    ],
  }),
  define({
    action: "task.completed",
    category: "operations",
    resourceType: "task",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["taskId", "assignedToUserId", "completedByUserId"],
  }),
  define({
    action: "outbound_webhook.test_delivery_simulated",
    category: "outbound_webhooks",
    resourceType: "outbound_webhook",
    matterScope: "firm",
    actorHint: "authenticated_user",
    matterMetadataKeys: [],
    resourceMetadataKeys: [
      "deliveryId",
      "eventCount",
      "events",
      "destinationScheme",
      "destinationHost",
      "destinationPort",
      "signingAlgorithm",
      "signatureHeader",
      "simulationOnly",
    ],
  }),
  define({
    action: "inbound_email.attachment.promoted_to_document",
    category: "communications",
    resourceType: "document",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["messageId", "attachmentId", "documentId"],
  }),
  define({
    action: "calendar.event.created",
    category: "calendar",
    resourceType: "calendar_event",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["eventId", "uid", "status", "attendeeCount"],
  }),
  define({
    action: "calendar.event.updated",
    category: "calendar",
    resourceType: "calendar_event",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["eventId", "uid", "status", "attendeeCount"],
  }),
  define({
    action: "calendar.event.deleted",
    category: "calendar",
    resourceType: "calendar_event",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["eventId", "uid"],
  }),
  define({
    action: "calendar.attendee.created",
    category: "calendar",
    resourceType: "calendar_event",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["eventId", "attendeeId", "role", "responseStatus"],
  }),
  define({
    action: "calendar.attendee.updated",
    category: "calendar",
    resourceType: "calendar_event",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["eventId", "attendeeId", "role", "responseStatus"],
  }),
  define({
    action: "calendar.attendee.deleted",
    category: "calendar",
    resourceType: "calendar_event",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["eventId", "attendeeId"],
  }),
  define({
    action: "calendar.invitation.queued",
    category: "calendar",
    resourceType: "calendar_event",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["eventId", "attendeeCount", "emailId", "jobId", "meetingBoundary"],
  }),
  define({
    action: "calendar.invitation.skipped",
    category: "calendar",
    resourceType: "calendar_event",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["eventId", "attendeeCount", "reason", "meetingBoundary"],
  }),
  define({
    action: "calendar.credential.created",
    category: "calendar",
    resourceType: "calendar_credential",
    matterScope: "firm",
    actorHint: "authenticated_user",
    matterMetadataKeys: [],
    resourceMetadataKeys: ["credentialId", "label"],
  }),
  define({
    action: "calendar.credential.revoked",
    category: "calendar",
    resourceType: "calendar_credential",
    matterScope: "firm",
    actorHint: "authenticated_user",
    matterMetadataKeys: [],
    resourceMetadataKeys: ["credentialId", "revokedAt"],
  }),
  define({
    action: "conversation_thread.created",
    category: "communications",
    resourceType: "conversation_thread",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: [
      "threadId",
      "status",
      "exportState",
      "retentionBoundary",
      "notificationBoundary",
      "accessRevoked",
    ],
  }),
  define({
    action: "legal_clinic.program.created",
    category: "legal_clinic",
    resourceType: "legal_clinic_program",
    matterScope: "firm",
    actorHint: "authenticated_user",
    matterMetadataKeys: [],
    resourceMetadataKeys: ["programId", "referralPathCount", "eligibilityRuleCount"],
  }),
  define({
    action: "legal_clinic.profile.upserted",
    category: "legal_clinic",
    resourceType: "legal_clinic_matter_profile",
    matterScope: "matter",
    actorHint: "authenticated_user",
    resourceMetadataKeys: ["programId", "referralStatus", "eligibilityStatus"],
  }),
] as const satisfies readonly AuditEventTaxonomyDefinition[];

const definitionsByAction = new Map(
  auditEventTaxonomyDefinitions.map((definition) => [definition.action, definition]),
);

const definitionsByActionAndResource = new Map(
  auditEventTaxonomyDefinitions
    .filter((definition) => definition.resourceType)
    .map((definition) => [`${definition.action}:${definition.resourceType}`, definition]),
);

function definitionFor(event: Pick<AuditEvent, "action" | "resourceType">) {
  return (
    definitionsByActionAndResource.get(`${event.action}:${event.resourceType}`) ??
    definitionsByAction.get(event.action)
  );
}

function hasStringMetadata(metadata: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((key) => typeof metadata[key] === "string" && metadata[key].length > 0);
}

function hasMatterId(event: AuditEvent, definition: AuditEventTaxonomyDefinition): boolean {
  if (event.resourceType === "matter" && event.resourceId.length > 0) return true;
  return hasStringMetadata(event.metadata, definition.matterMetadataKeys);
}

export function classifyAuditEvent(event: AuditEvent): AuditEventClassification {
  const definition = definitionFor(event);
  if (!definition) {
    return {
      action: event.action,
      category: "unknown",
      known: false,
      resourceType: event.resourceType,
      matterScope: "derived",
      actorHint: "unknown",
      metadataHints: { matter: [], resource: [], actor: [] },
      hasMatterId: false,
      resourceTypeMatches: true,
    };
  }

  return {
    action: event.action,
    category: definition.category,
    known: true,
    expectedResourceType: definition.resourceType,
    resourceType: event.resourceType,
    matterScope: definition.matterScope,
    actorHint: definition.actorHint,
    metadataHints: {
      matter: definition.matterMetadataKeys,
      resource: definition.resourceMetadataKeys,
      actor: definition.actorMetadataKeys,
    },
    hasMatterId: hasMatterId(event, definition),
    resourceTypeMatches: !definition.resourceType || definition.resourceType === event.resourceType,
  };
}

function increment<T extends string>(record: Partial<Record<T, number>>, key: T): void {
  record[key] = (record[key] ?? 0) + 1;
}

export function summarizeAuditEventTaxonomy(
  events: readonly AuditEvent[],
): AuditEventTaxonomySummary {
  const byCategory: Partial<Record<AuditEventCategory, number>> = {};
  const byMatterScope: Partial<Record<AuditMatterScopeHint, number>> = {};
  const byActorHint: Partial<Record<AuditActorHint, number>> = {};
  const unknownActions = new Set<string>();
  const mismatches = new Map<
    string,
    {
      action: string;
      expectedResourceType: string;
      observedResourceType: string;
      count: number;
    }
  >();
  let known = 0;
  let matterScopedWithoutMatterId = 0;

  for (const event of events) {
    const classification = classifyAuditEvent(event);
    if (classification.known) {
      known += 1;
    } else {
      unknownActions.add(classification.action);
    }
    increment(byCategory, classification.category);
    increment(byMatterScope, classification.matterScope);
    increment(byActorHint, classification.actorHint);

    if (classification.matterScope === "matter" && !classification.hasMatterId) {
      matterScopedWithoutMatterId += 1;
    }

    if (!classification.resourceTypeMatches && classification.expectedResourceType) {
      const key = `${classification.action}:${classification.expectedResourceType}:${classification.resourceType}`;
      const existing = mismatches.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        mismatches.set(key, {
          action: classification.action,
          expectedResourceType: classification.expectedResourceType,
          observedResourceType: classification.resourceType,
          count: 1,
        });
      }
    }
  }

  return {
    total: events.length,
    known,
    unknown: events.length - known,
    byCategory,
    byMatterScope,
    byActorHint,
    matterScopedWithoutMatterId,
    resourceTypeMismatches: [...mismatches.values()].sort((left, right) =>
      left.action.localeCompare(right.action),
    ),
    unknownActions: [...unknownActions].sort(),
  };
}
