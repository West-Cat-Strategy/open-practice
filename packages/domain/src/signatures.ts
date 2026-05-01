import type { EmbeddedIntakeTemplateDefinition, IntakeResolutionSnapshot } from "./intake.js";

export interface SignatureSigner {
  name: string;
  email: string;
  role: string;
}

export interface CreateSignatureRequestInput {
  matterId: string;
  documentId: string;
  title: string;
  signers: SignatureSigner[];
  consentText: string;
}

export interface SignatureProviderSubmission {
  provider: "embedded" | "manual" | "docuseal";
  externalId: string;
  status?: SignatureProviderStatus;
  signingUrl?: string;
  evidence?: Record<string, unknown>;
}

export interface SignatureProvider {
  createSubmission(input: CreateSignatureRequestInput): Promise<SignatureProviderSubmission>;
  getSubmission?(externalId: string): Promise<SignatureProviderSubmission>;
}

export type SignatureProviderStatus =
  | "draft"
  | "pending_provider_submission"
  | "sent"
  | "viewed"
  | "completed"
  | "declined"
  | "provider_error";

export const signatureProviderStatusOrder = [
  "draft",
  "pending_provider_submission",
  "sent",
  "viewed",
  "completed",
  "declined",
  "provider_error",
] as const satisfies readonly SignatureProviderStatus[];

export const terminalSignatureProviderStatuses = [
  "completed",
  "declined",
  "provider_error",
] as const satisfies readonly SignatureProviderStatus[];

export const signatureProviderStatusRank: Record<SignatureProviderStatus, number> = {
  draft: 0,
  pending_provider_submission: 1,
  sent: 2,
  viewed: 3,
  completed: 4,
  declined: 4,
  provider_error: 4,
};

const terminalSignatureStatuses = new Set<SignatureProviderStatus>(
  terminalSignatureProviderStatuses,
);

export function isTerminalSignatureStatus(status: SignatureProviderStatus): boolean {
  return terminalSignatureStatuses.has(status);
}

export function isTerminalSignatureProviderStatus(status: SignatureProviderStatus): boolean {
  return isTerminalSignatureStatus(status);
}

export function getSignatureProviderStatusRank(status: SignatureProviderStatus): number {
  return signatureProviderStatusRank[status];
}

export function compareSignatureProviderStatuses(
  left: SignatureProviderStatus,
  right: SignatureProviderStatus,
): number {
  return Math.sign(getSignatureProviderStatusRank(left) - getSignatureProviderStatusRank(right));
}

export function orderSignatureProviderStatuses(
  statuses: readonly SignatureProviderStatus[],
): SignatureProviderStatus[] {
  return [...statuses].sort(compareSignatureProviderStatuses);
}

export function compareSignatureProviderEvents(
  left: Pick<SignatureProviderEvent, "status" | "occurredAt">,
  right: Pick<SignatureProviderEvent, "status" | "occurredAt">,
): number {
  const statusComparison = compareSignatureProviderStatuses(left.status, right.status);
  if (statusComparison !== 0) return statusComparison;
  return Math.sign(Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
}

export function orderSignatureProviderEvents<
  T extends Pick<SignatureProviderEvent, "status" | "occurredAt">,
>(events: readonly T[]): T[] {
  return [...events].sort(compareSignatureProviderEvents);
}

export function shouldApplySignatureProviderStatus(input: {
  currentStatus: SignatureProviderStatus;
  nextStatus: SignatureProviderStatus;
}): boolean {
  if (input.currentStatus === input.nextStatus) return true;
  if (isTerminalSignatureStatus(input.currentStatus)) return false;
  return (
    signatureProviderStatusRank[input.nextStatus] >=
    signatureProviderStatusRank[input.currentStatus]
  );
}

export type SignatureStatusUpdateReason =
  | "status_advanced"
  | "same_status_replay"
  | "status_regression"
  | "terminal_status_preserved";

export interface SignatureStatusUpdateDecision {
  shouldUpdate: boolean;
  reason: SignatureStatusUpdateReason;
  currentStatus: SignatureProviderStatus;
  incomingStatus: SignatureProviderStatus;
  comparison: number;
}

export function getSignatureStatusUpdateDecision(
  currentStatus: SignatureProviderStatus,
  incoming: SignatureProviderStatus | Pick<SignatureProviderEvent, "status">,
): SignatureStatusUpdateDecision {
  const incomingStatus = typeof incoming === "string" ? incoming : incoming.status;
  const comparison = compareSignatureProviderStatuses(incomingStatus, currentStatus);

  if (isTerminalSignatureStatus(currentStatus)) {
    return {
      shouldUpdate: false,
      reason: "terminal_status_preserved",
      currentStatus,
      incomingStatus,
      comparison,
    };
  }

  if (comparison === 0) {
    return {
      shouldUpdate: false,
      reason: "same_status_replay",
      currentStatus,
      incomingStatus,
      comparison,
    };
  }

  if (comparison < 0) {
    return {
      shouldUpdate: false,
      reason: "status_regression",
      currentStatus,
      incomingStatus,
      comparison,
    };
  }

  return {
    shouldUpdate: true,
    reason: "status_advanced",
    currentStatus,
    incomingStatus,
    comparison,
  };
}

export function shouldUpdateSignatureRequestStatus(
  currentStatus: SignatureProviderStatus,
  incoming: SignatureProviderStatus | Pick<SignatureProviderEvent, "status">,
): boolean {
  return getSignatureStatusUpdateDecision(currentStatus, incoming).shouldUpdate;
}

export interface SignatureProviderEventReplayMetadata {
  replayKey: string;
  providerEventId?: string;
  providerWebhookId?: string;
}

export function getSignatureProviderEventReplayMetadata(
  event: Pick<
    SignatureProviderEvent,
    "provider" | "externalId" | "status" | "occurredAt" | "evidence"
  >,
): SignatureProviderEventReplayMetadata {
  const providerEventId = readStringEvidence(event.evidence, ["eventId", "event_id", "id"]);
  const providerWebhookId = readStringEvidence(event.evidence, [
    "webhookId",
    "webhook_id",
    "deliveryId",
    "delivery_id",
  ]);
  const providerReplayId = providerEventId ?? providerWebhookId;
  const replayKey = [
    event.provider,
    event.externalId,
    providerReplayId ?? event.status,
    providerReplayId ? undefined : event.occurredAt,
  ]
    .filter((part): part is string => typeof part === "string")
    .map(encodeURIComponent)
    .join(":");

  return {
    replayKey,
    providerEventId,
    providerWebhookId,
  };
}

function readStringEvidence(
  evidence: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = evidence[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

export interface SignatureProviderEvent {
  provider: SignatureProviderSubmission["provider"];
  externalId: string;
  status: SignatureProviderStatus;
  occurredAt: string;
  evidence: Record<string, unknown>;
}

export interface SignatureRequestRecord {
  id: string;
  firmId: string;
  matterId: string;
  documentId: string;
  title: string;
  requestedByUserId: string;
  provider: SignatureProviderSubmission["provider"];
  externalId: string;
  status: SignatureProviderStatus;
  signingUrl?: string;
  consentText: string;
  evidence: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
  declinedAt?: string;
}

export interface SignatureRequestSignerRecord extends SignatureSigner {
  id: string;
  firmId: string;
  signatureRequestId: string;
  status: SignatureProviderStatus;
  signingUrl?: string;
  completedAt?: string;
}

export interface SignatureProviderEventRecord extends SignatureProviderEvent {
  id: string;
  firmId: string;
  signatureRequestId: string;
}

export interface SignatureWebhookAttemptRecord {
  id: string;
  firmId: string;
  provider: SignatureProviderSubmission["provider"];
  externalId: string;
  receivedAt: string;
  processedAt?: string;
  status: "received" | "processed" | "failed";
  errorMessage?: string;
  payload: Record<string, unknown>;
}

export interface StartAutomationInterviewInput {
  firmId: string;
  matterId: string;
  templateId: string;
  clientContactId?: string;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AutomationSessionRef {
  provider: "embedded" | "manual" | "docassemble";
  externalId: string;
  interviewUrl?: string;
  status: "created" | "in_progress" | "ready_to_generate" | "completed" | "provider_error";
  evidence?: Record<string, unknown>;
}

export interface RenderAutomatedDocumentInput {
  firmId: string;
  matterId: string;
  sessionExternalId: string;
  documentTitle: string;
  packageId?: string;
  packageDocumentId?: string;
}

export interface GeneratedDocumentRef {
  provider: AutomationSessionRef["provider"];
  externalId: string;
  title: string;
  storageKey?: string;
  checksumSha256?: string;
  evidence?: Record<string, unknown>;
}

export interface DocumentAutomationProvider {
  startInterview(input: StartAutomationInterviewInput): Promise<AutomationSessionRef>;
  getInterviewStatus(externalId: string): Promise<AutomationSessionRef>;
  renderDocument(input: RenderAutomatedDocumentInput): Promise<GeneratedDocumentRef>;
}

export interface IntakeTemplateRecord {
  id: string;
  firmId: string;
  name: string;
  description?: string;
  category: string;
  provider: AutomationSessionRef["provider"];
  externalTemplateId: string;
  active: boolean;
  definitionVersion: number;
  definition: EmbeddedIntakeTemplateDefinition;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface IntakeSessionRecord {
  id: string;
  firmId: string;
  matterId: string;
  templateId: string;
  provider: AutomationSessionRef["provider"];
  externalId: string;
  status: AutomationSessionRef["status"];
  clientContactId?: string;
  interviewUrl?: string;
  evidence: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AnswerSnapshotRecord {
  id: string;
  firmId: string;
  intakeSessionId: string;
  capturedAt: string;
  answers: Record<string, unknown>;
  resolution: IntakeResolutionSnapshot;
}

export interface GeneratedDocumentRecord {
  id: string;
  firmId: string;
  matterId: string;
  intakeSessionId: string;
  provider: GeneratedDocumentRef["provider"];
  externalId: string;
  title: string;
  documentId?: string;
  packageId?: string;
  packageDocumentId?: string;
  storageKey?: string;
  checksumSha256?: string;
  evidence: Record<string, unknown>;
  createdAt: string;
}
