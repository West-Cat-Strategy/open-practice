import type { AuditRepository } from "./audit-contracts.js";
import type { AiOperationalProposalRepository } from "./ai-operational-proposals-contracts.js";
import type { AuthRepository } from "./auth-contracts.js";
import type { BillingEntriesRepository } from "./billing-entries-contracts.js";
import type { BillingInvoicePaymentRepository } from "./billing-invoices-payments-contracts.js";
import type { BillingControlsRepository } from "./billing-controls-contracts.js";
import type { CalendarCredentialRepository } from "./calendar-credentials-contracts.js";
import type { CalendarEventsRepository } from "./calendar-events-contracts.js";
import type { ConflictCheckRepository } from "./conflict-checks-contracts.js";
import type { ConnectorRepository } from "./connector-contracts.js";
import type { ContactRepository } from "./contacts-contracts.js";
import type { ConversationThreadRepository } from "./conversation-threads-contracts.js";
import type { DocumentAssemblyRepository } from "./document-assembly-contracts.js";
import type { DocumentRepository } from "./documents-contracts.js";
import type { DraftRepository } from "./drafts-contracts.js";
import type { EmailTemplateDraftRepository } from "./email-template-drafts-contracts.js";
import type { FirmSettingsRepository } from "./firm-settings-contracts.js";
import type { HostedPaymentRequestRepository } from "./hosted-payment-requests-contracts.js";
import type { InboundEmailRepository } from "./inbound-email-contracts.js";
import type { IntakeFormsRepository } from "./intake-forms-contracts.js";
import type { IntakeTemplateRepository } from "./intake-templates-contracts.js";
import type { EmailJobsRepository } from "./jobs-email-contracts.js";
import type { LedgerCoreRepository } from "./ledger-core-contracts.js";
import type { LedgerPostingRequestRepository } from "./ledger-posting-requests-contracts.js";
import type { LedgerReviewRepository } from "./ledger-review-contracts.js";
import type { LegalClinicRepository } from "./legal-clinics-contracts.js";
import type { LegalResearchArtifactRepository } from "./legal-research-artifacts-contracts.js";
import type { MatterLifecycleRepository } from "./matter-lifecycle-contracts.js";
import type { MatterWorkspaceRepository } from "./matter-workspace-contracts.js";
import type { OperationalViewsRepository } from "./operational-views-contracts.js";
import type { PaymentImportReviewRecordRepository } from "./payment-import-review-records-contracts.js";
import type { PortalAccessRepository } from "./portal-access-contracts.js";
import type { ProviderSettingsRepository } from "./provider-settings-contracts.js";
import type { PublicConsultationIntakeRepository } from "./public-consultation-intakes-contracts.js";
import type { PracticeSetupRepository } from "./setup-contracts.js";
import type { SignatureRepository } from "./signatures-contracts.js";
import type { TaskRepository } from "./tasks-contracts.js";
import type { TrustTransferRequestRepository } from "./trust-transfer-requests-contracts.js";

export * from "./audit-contracts.js";
export * from "./ai-operational-proposals-contracts.js";
export * from "./auth-contracts.js";
export * from "./billing-entries-contracts.js";
export * from "./billing-invoices-payments-contracts.js";
export * from "./billing-controls-contracts.js";
export * from "./calendar-credentials-contracts.js";
export * from "./calendar-events-contracts.js";
export * from "./conflict-checks-contracts.js";
export * from "./connector-contracts.js";
export * from "./contacts-contracts.js";
export * from "./conversation-threads-contracts.js";
export * from "./document-assembly-contracts.js";
export * from "./documents-contracts.js";
export * from "./drafts-contracts.js";
export * from "./email-template-drafts-contracts.js";
export * from "./firm-settings-contracts.js";
export * from "./hosted-payment-requests-contracts.js";
export * from "./inbound-email-contracts.js";
export * from "./intake-forms-contracts.js";
export * from "./intake-templates-contracts.js";
export * from "./jobs-email-contracts.js";
export * from "./ledger-core-contracts.js";
export * from "./ledger-posting-requests-contracts.js";
export * from "./ledger-review-contracts.js";
export * from "./legal-clinics-contracts.js";
export * from "./legal-research-artifacts-contracts.js";
export * from "./matter-lifecycle-contracts.js";
export * from "./matter-workspace-contracts.js";
export * from "./operational-views-contracts.js";
export * from "./payment-import-review-records-contracts.js";
export * from "./portal-access-contracts.js";
export * from "./provider-settings-contracts.js";
export * from "./public-consultation-intakes-contracts.js";
export * from "./setup-contracts.js";
export * from "./signatures-contracts.js";
export * from "./tasks-contracts.js";
export * from "./trust-transfer-requests-contracts.js";

export function clone<T>(value: T): T {
  return globalThis.structuredClone(value);
}

export function dateToIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

const connectorSensitiveKeyPattern =
  /(api[_-]?key|authorization|bearer|credential|password|private[_-]?key|secret|signature|token)/i;
const connectorSensitiveValuePattern =
  /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|bearer\s+[a-z0-9._~+/=-]+|secret:\/\/\S+|token=\S+|api[_-]?key=\S+|credential=\S+|password=\S+|private[_-]?key=\S+|signature=\S+|storage[_-]?key=\S+|matters\/\S+|generated\/\S+)/gi;

export function sanitizeConnectorDeliverySummary(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const redacted = message
    .replace(connectorSensitiveValuePattern, (match) =>
      match.includes("@") ? "[redacted-email]" : "[redacted]",
    )
    .replace(/\s+/g, " ")
    .trim();
  return redacted ? redacted.slice(0, 180) : undefined;
}

export function sanitizeConnectorDeliveryMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) return {};
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (connectorSensitiveKeyPattern.test(key)) {
      redacted[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string") {
      redacted[key] = sanitizeConnectorDeliverySummary(value) ?? "";
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      redacted[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      redacted[key] = value.map((item) =>
        typeof item === "string"
          ? (sanitizeConnectorDeliverySummary(item) ?? "")
          : item && typeof item === "object"
            ? sanitizeConnectorDeliveryMetadata(item as Record<string, unknown>)
            : item,
      );
      continue;
    }
    if (value && typeof value === "object") {
      redacted[key] = sanitizeConnectorDeliveryMetadata(value as Record<string, unknown>);
    }
  }
  return redacted;
}

const emailDeliveryMetadataSensitiveKeyPattern =
  /(address|api[_-]?key|authorization|bcc|body|cc|credential|from|html|message[_-]?id|mime|password|private[_-]?key|provider[_-]?message[_-]?id|raw|recipient|secret|sender|signature|storage|subject|text|to|token)/i;

export function sanitizeEmailDeliveryMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) return {};
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (emailDeliveryMetadataSensitiveKeyPattern.test(key)) {
      redacted[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string") {
      redacted[key] = sanitizeConnectorDeliverySummary(value) ?? "";
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      redacted[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      redacted[key] = value.map((item) =>
        typeof item === "string"
          ? (sanitizeConnectorDeliverySummary(item) ?? "")
          : item && typeof item === "object"
            ? sanitizeEmailDeliveryMetadata(item as Record<string, unknown>)
            : item,
      );
      continue;
    }
    if (value && typeof value === "object") {
      redacted[key] = sanitizeEmailDeliveryMetadata(value as Record<string, unknown>);
    }
  }
  return redacted;
}

export class IdempotencyKeyConflictError extends Error {
  constructor(message = "Idempotency key was reused with a different payload") {
    super(message);
    this.name = "IdempotencyKeyConflictError";
  }
}

export function canonicalizeForIdempotency(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeForIdempotency).join(",")}]`;
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeForIdempotency(objectValue[key])}`)
    .join(",")}}`;
}

export function idempotencyFingerprint(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  return typeof metadata?.idempotencyFingerprint === "string"
    ? metadata.idempotencyFingerprint
    : undefined;
}

export function assertSameIdempotencyFingerprint(
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown> | undefined,
): void {
  const existingFingerprint = idempotencyFingerprint(existing);
  const incomingFingerprint = idempotencyFingerprint(incoming);
  if (existingFingerprint && incomingFingerprint && existingFingerprint !== incomingFingerprint) {
    throw new IdempotencyKeyConflictError();
  }
}

export function isPostgresUniqueViolation(error: unknown, constraintName: string): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (candidate.code === "23505" && candidate.constraint === constraintName) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export interface OpenPracticeRepository
  extends
    AuthRepository,
    BillingEntriesRepository,
    BillingInvoicePaymentRepository,
    BillingControlsRepository,
    HostedPaymentRequestRepository,
    PaymentImportReviewRecordRepository,
    PracticeSetupRepository,
    ProviderSettingsRepository,
    AuditRepository,
    AiOperationalProposalRepository,
    CalendarCredentialRepository,
    CalendarEventsRepository,
    ConflictCheckRepository,
    DocumentAssemblyRepository,
    DocumentRepository,
    DraftRepository,
    FirmSettingsRepository,
    ContactRepository,
    ConnectorRepository,
    EmailJobsRepository,
    EmailTemplateDraftRepository,
    InboundEmailRepository,
    IntakeFormsRepository,
    IntakeTemplateRepository,
    LedgerCoreRepository,
    LedgerPostingRequestRepository,
    LegalClinicRepository,
    LegalResearchArtifactRepository,
    LedgerReviewRepository,
    MatterLifecycleRepository,
    MatterWorkspaceRepository,
    OperationalViewsRepository,
    PortalAccessRepository,
    PublicConsultationIntakeRepository,
    TaskRepository,
    ConversationThreadRepository,
    SignatureRepository,
    TrustTransferRequestRepository {}
