import type { ContactDossier } from "./contacts.js";
import type {
  ActivityTimelineEntry,
  CalendarEventRecord,
  CalendarGuestLinkRecord,
  Matter,
  MatterParty,
  TaskRecord,
} from "./models.js";
import type { IntakeFormLinkRecord } from "./intake.js";
import type {
  AccessLogRecord,
  EmailOutboxRecord,
  ExternalUploadLinkRecord,
  InboundEmailMessageRecord,
  ShareLinkRecord,
} from "./operations.js";
import type { Action, ResourceKind } from "./permissions.js";
import type { SignatureRequestRecord } from "./signatures.js";

export type BuiltInOperationalViewKey =
  | "stale_matters"
  | "uncontacted_clients"
  | "awaiting_signature"
  | "external_uploads_expiring"
  | "conflicts_pending_review"
  | "overdue_tasks_deadlines"
  | "portal_access_activity"
  | "portal_access_anomalies"
  | "portal_links_expiring";

export type OperationalViewPriority = "high" | "medium" | "low";
export type SavedOperationalViewSurface = "queues" | "matters";
export type SavedOperationalViewStatus = "active" | "archived";
export type SavedOperationalViewPermissionScope = `${ResourceKind}:${Action}`;

export interface SavedOperationalViewDefinition {
  id: string;
  firmId: string;
  ownerUserId: string;
  surface: SavedOperationalViewSurface;
  name: string;
  filters: Record<string, unknown>;
  columns: unknown[];
  sort: Record<string, unknown>;
  rowLimit: number;
  dashboardBehavior: Record<string, unknown>;
  permissionScope: SavedOperationalViewPermissionScope[];
  status: SavedOperationalViewStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface SavedOperationalViewDefinitionInput {
  id?: string;
  firmId: string;
  ownerUserId: string;
  surface: SavedOperationalViewSurface;
  name: string;
  filters?: Record<string, unknown>;
  columns?: unknown[];
  sort?: Record<string, unknown>;
  rowLimit?: number;
  dashboardBehavior?: Record<string, unknown>;
  permissionScope?: SavedOperationalViewPermissionScope[];
  status?: SavedOperationalViewStatus;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string;
}

export interface BuiltInOperationalViewDefinition {
  key: BuiltInOperationalViewKey;
  label: string;
  description: string;
  defaultPriority: OperationalViewPriority;
}

export interface OperationalViewResult {
  id: string;
  viewKey: BuiltInOperationalViewKey;
  matterId?: string;
  title: string;
  status: string;
  priority: OperationalViewPriority;
  reason: string;
  lastActivityAt?: string;
  dueAt?: string;
  occurredAt?: string;
  metadata: Record<string, unknown>;
}

export interface BuiltInOperationalView {
  definition: BuiltInOperationalViewDefinition;
  resultCount: number;
  results: OperationalViewResult[];
}

export interface OperationalMatterInput extends Pick<
  Matter,
  "id" | "firmId" | "number" | "title" | "practiceArea" | "status" | "openedOn"
> {
  parties?: Array<Pick<MatterParty, "role" | "contactId" | "adverse" | "confidential">>;
  activity?: ActivityTimelineEntry[];
}

export interface BuildBuiltInOperationalViewsInput {
  matters: OperationalMatterInput[];
  signatures?: SignatureRequestRecord[];
  shareLinks?: ShareLinkRecord[];
  externalUploadLinks?: ExternalUploadLinkRecord[];
  intakeFormLinks?: IntakeFormLinkRecord[];
  calendarGuestLinks?: CalendarGuestLinkRecord[];
  accessLogs?: AccessLogRecord[];
  calendarEvents?: CalendarEventRecord[];
  taskDeadlines?: TaskRecord[];
  contactDossiers?: ContactDossier[];
  emailOutbox?: Array<
    Pick<EmailOutboxRecord, "matterId" | "status" | "queuedAt" | "sentAt" | "relatedResourceType">
  >;
  inboundEmailMessages?: Array<
    Pick<InboundEmailMessageRecord, "matterId" | "receivedAt" | "status">
  >;
  now?: string;
  staleAfterDays?: number;
  externalUploadExpiryWindowDays?: number;
  portalLinkExpiryWindowDays?: number;
  portalDeniedAttemptWindowHours?: number;
}

export const BUILT_IN_OPERATIONAL_VIEW_DEFINITIONS: BuiltInOperationalViewDefinition[] = [
  {
    key: "stale_matters",
    label: "Stale matters",
    description: "Open or intake matters with no recent visible activity.",
    defaultPriority: "medium",
  },
  {
    key: "uncontacted_clients",
    label: "Uncontacted clients",
    description: "Visible active matters with client parties and no derived contact activity.",
    defaultPriority: "medium",
  },
  {
    key: "awaiting_signature",
    label: "Awaiting signature",
    description: "Visible signature requests that have not reached a terminal state.",
    defaultPriority: "medium",
  },
  {
    key: "external_uploads_expiring",
    label: "External uploads expiring",
    description: "Active external upload links near expiry with remaining upload capacity.",
    defaultPriority: "medium",
  },
  {
    key: "conflicts_pending_review",
    label: "Conflicts pending review",
    description: "Visible matter conflict and protected-party cues requiring manual review.",
    defaultPriority: "high",
  },
  {
    key: "overdue_tasks_deadlines",
    label: "Overdue tasks and deadlines",
    description: "Visible past task and calendar deadline signals that are still active.",
    defaultPriority: "high",
  },
  {
    key: "portal_access_activity",
    label: "Portal access activity",
    description: "Latest safe granted and denied public-token access events.",
    defaultPriority: "medium",
  },
  {
    key: "portal_access_anomalies",
    label: "Portal access anomalies",
    description: "Repeated denied or blocked public-token access attempts.",
    defaultPriority: "high",
  },
  {
    key: "portal_links_expiring",
    label: "Portal links expiring",
    description: "Active public-token links across portal families that expire soon.",
    defaultPriority: "medium",
  },
];

const activeMatterStatuses = new Set<Matter["status"]>(["intake", "open", "paused"]);
const clientPartyRoles = new Set<MatterParty["role"]>([
  "client",
  "prospective_client",
  "notary_client",
  "paralegal_client",
]);
const contactActivityKinds = new Set<ActivityTimelineEntry["kind"]>([
  "email",
  "intake",
  "portal",
  "share",
  "signature",
  "upload",
]);
const terminalSignatureStatuses = new Set<SignatureRequestRecord["status"]>([
  "completed",
  "declined",
]);
const deadlineTerms = ["deadline", "due", "filing", "hearing", "limitation", "review", "task"];
type PortalAccessFamily = "share" | "external_upload" | "intake_form" | "guest_session";
type NormalizedPortalAccessOutcome = "granted" | "denied";

interface PortalLinkContext {
  family: PortalAccessFamily;
  id: string;
  matterId: string;
  label: string;
  expiresAt?: string;
  active: boolean;
  metadata: Record<string, unknown>;
}

interface PortalAccessEvent {
  log: AccessLogRecord;
  context: PortalLinkContext;
  outcome: NormalizedPortalAccessOutcome;
  reason: string;
}

const deniedPortalOutcomes = new Set([
  "denied",
  "expired",
  "revoked",
  "unavailable",
  "email_verification_required",
  "submission_conflict",
  "upload_limit",
  "document_scope",
  "locked",
  "ended",
]);

function toTime(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value.includes("T") ? value : `${value}T00:00:00.000Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function daysBetween(later: number, earlier: number): number {
  return Math.floor((later - earlier) / 86_400_000);
}

function latestActivityAt(matter: OperationalMatterInput): string | undefined {
  const activityTimes = (matter.activity ?? [])
    .map((entry) => toTime(entry.occurredAt))
    .filter((value): value is number => value !== undefined);
  const openedAt = toTime(matter.openedOn);
  const latest = Math.max(...activityTimes, openedAt ?? Number.NEGATIVE_INFINITY);
  return Number.isFinite(latest) ? new Date(latest).toISOString() : undefined;
}

function visibleMatterMap(matters: OperationalMatterInput[]): Map<string, OperationalMatterInput> {
  return new Map(matters.map((matter) => [matter.id, matter]));
}

function matterLabel(matter: OperationalMatterInput): string {
  return `Matter ${matter.number}`;
}

function hasClientParty(matter: OperationalMatterInput): boolean {
  return (matter.parties ?? []).some((party) => clientPartyRoles.has(party.role));
}

function hasDerivedClientContactActivity(input: {
  matter: OperationalMatterInput;
  emailOutbox: BuildBuiltInOperationalViewsInput["emailOutbox"];
  inboundEmailMessages: BuildBuiltInOperationalViewsInput["inboundEmailMessages"];
}): boolean {
  if ((input.matter.activity ?? []).some((entry) => contactActivityKinds.has(entry.kind))) {
    return true;
  }
  if ((input.emailOutbox ?? []).some((email) => email.matterId === input.matter.id)) {
    return true;
  }
  return (input.inboundEmailMessages ?? []).some((message) => message.matterId === input.matter.id);
}

function resultSort(left: OperationalViewResult, right: OperationalViewResult): number {
  if (
    left.viewKey === right.viewKey &&
    (left.viewKey === "portal_access_activity" || left.viewKey === "portal_access_anomalies")
  ) {
    const leftTime = toTime(left.occurredAt ?? left.lastActivityAt ?? left.dueAt) ?? 0;
    const rightTime = toTime(right.occurredAt ?? right.lastActivityAt ?? right.dueAt) ?? 0;
    if (leftTime !== rightTime) return rightTime - leftTime;
  }
  const priorityRank: Record<OperationalViewPriority, number> = { high: 0, medium: 1, low: 2 };
  if (priorityRank[left.priority] !== priorityRank[right.priority]) {
    return priorityRank[left.priority] - priorityRank[right.priority];
  }
  const leftTime = toTime(left.dueAt ?? left.lastActivityAt ?? left.occurredAt) ?? 0;
  const rightTime = toTime(right.dueAt ?? right.lastActivityAt ?? right.occurredAt) ?? 0;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.id.localeCompare(right.id);
}

function portalLinkKey(family: PortalAccessFamily, id: string): string {
  return `${family}:${id}`;
}

function portalFamilyLabel(family: PortalAccessFamily): string {
  if (family === "external_upload") return "external upload";
  if (family === "intake_form") return "intake form";
  if (family === "guest_session") return "guest session";
  return "share";
}

function metadataText(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizePortalAccessOutcome(log: AccessLogRecord): {
  outcome: NormalizedPortalAccessOutcome;
  reason: string;
} {
  const outcome = metadataText(log.metadata, "outcome");
  const reason = metadataText(log.metadata, "reason");
  const status = metadataText(log.metadata, "status");
  const normalized = outcome?.toLowerCase();
  const normalizedStatus = status?.toLowerCase();
  const denied =
    (normalized ? deniedPortalOutcomes.has(normalized) : false) ||
    (normalizedStatus ? deniedPortalOutcomes.has(normalizedStatus) : false);
  return {
    outcome: denied ? "denied" : "granted",
    reason: reason ?? status ?? outcome ?? log.action,
  };
}

function portalLinkContexts(
  input: BuildBuiltInOperationalViewsInput,
  nowMs: number,
): Map<string, PortalLinkContext> {
  const contexts = new Map<string, PortalLinkContext>();
  for (const link of input.shareLinks ?? []) {
    const expiresAt = toTime(link.expiresAt);
    const active = !link.revokedAt && (expiresAt === undefined || expiresAt > nowMs);
    contexts.set(portalLinkKey("share", link.id), {
      family: "share",
      id: link.id,
      matterId: link.matterId,
      label: "share link",
      expiresAt: link.expiresAt,
      active,
      metadata: {},
    });
  }
  for (const link of input.externalUploadLinks ?? []) {
    const expiresAt = toTime(link.expiresAt);
    const remainingUploads = Math.max(link.maxUploads - link.usedUploads, 0);
    contexts.set(portalLinkKey("external_upload", link.id), {
      family: "external_upload",
      id: link.id,
      matterId: link.matterId,
      label: "external upload link",
      expiresAt: link.expiresAt,
      active:
        !link.revokedAt && expiresAt !== undefined && expiresAt > nowMs && remainingUploads > 0,
      metadata: {
        remainingUploads,
        maxUploads: link.maxUploads,
        usedUploads: link.usedUploads,
      },
    });
  }
  for (const link of input.intakeFormLinks ?? []) {
    const expiresAt = toTime(link.expiresAt);
    contexts.set(portalLinkKey("intake_form", link.id), {
      family: "intake_form",
      id: link.id,
      matterId: link.matterId,
      label: "intake form link",
      expiresAt: link.expiresAt,
      active: !link.revokedAt && !link.submittedAt && expiresAt !== undefined && expiresAt > nowMs,
      metadata: {},
    });
  }
  for (const link of input.calendarGuestLinks ?? []) {
    const expiresAt = toTime(link.expiresAt);
    contexts.set(portalLinkKey("guest_session", link.id), {
      family: "guest_session",
      id: link.id,
      matterId: link.matterId,
      label: "guest session link",
      expiresAt: link.expiresAt,
      active:
        !link.revokedAt &&
        link.status !== "revoked" &&
        link.status !== "denied" &&
        expiresAt !== undefined &&
        expiresAt > nowMs,
      metadata: {
        status: link.status,
      },
    });
  }
  return contexts;
}

function contextForAccessLog(
  log: AccessLogRecord,
  contexts: Map<string, PortalLinkContext>,
): PortalLinkContext | undefined {
  if (log.shareLinkId) return contexts.get(portalLinkKey("share", log.shareLinkId));
  if (log.externalUploadLinkId) {
    return contexts.get(portalLinkKey("external_upload", log.externalUploadLinkId));
  }
  if (log.intakeFormLinkId) return contexts.get(portalLinkKey("intake_form", log.intakeFormLinkId));
  if (log.resourceType === "calendar_guest_link") {
    return contexts.get(portalLinkKey("guest_session", log.resourceId));
  }
  return undefined;
}

function portalAccessEvents(input: {
  accessLogs?: AccessLogRecord[];
  contexts: Map<string, PortalLinkContext>;
  mattersById: Map<string, OperationalMatterInput>;
}): PortalAccessEvent[] {
  return (input.accessLogs ?? []).flatMap((log): PortalAccessEvent[] => {
    const context = contextForAccessLog(log, input.contexts);
    if (!context || !input.mattersById.has(context.matterId)) return [];
    const normalized = normalizePortalAccessOutcome(log);
    return [{ log, context, ...normalized }];
  });
}

function buildPortalAccessActivityResults(input: {
  events: PortalAccessEvent[];
  mattersById: Map<string, OperationalMatterInput>;
}): OperationalViewResult[] {
  return input.events.map((event) => {
    const matter = input.mattersById.get(event.context.matterId);
    return {
      id: `portal-access:${event.log.id}`,
      viewKey: "portal_access_activity",
      matterId: event.context.matterId,
      title: `${matter ? matterLabel(matter) : "Matter"} ${event.context.label} access`,
      status: event.outcome,
      priority: event.outcome === "denied" ? "high" : "low",
      reason: `${portalFamilyLabel(event.context.family)} ${event.reason.replaceAll("_", " ")}`,
      occurredAt: event.log.occurredAt,
      metadata: {
        family: event.context.family,
        linkId: event.context.id,
        outcome: event.outcome,
        reason: event.reason,
      },
    };
  });
}

function buildPortalAccessAnomalyResults(input: {
  events: PortalAccessEvent[];
  mattersById: Map<string, OperationalMatterInput>;
  nowMs: number;
  windowHours: number;
}): OperationalViewResult[] {
  const windowMs = input.windowHours * 3_600_000;
  const grouped = new Map<string, PortalAccessEvent[]>();
  for (const event of input.events) {
    const occurredAt = toTime(event.log.occurredAt);
    if (event.outcome !== "denied" || occurredAt === undefined) continue;
    if (occurredAt > input.nowMs || input.nowMs - occurredAt > windowMs) continue;
    const key = portalLinkKey(event.context.family, event.context.id);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  return Array.from(grouped.entries()).flatMap(([key, events]): OperationalViewResult[] => {
    if (events.length < 3) return [];
    const latest = [...events].sort(
      (left, right) => (toTime(right.log.occurredAt) ?? 0) - (toTime(left.log.occurredAt) ?? 0),
    )[0]!;
    const matter = input.mattersById.get(latest.context.matterId);
    return [
      {
        id: `portal-anomaly:${key}`,
        viewKey: "portal_access_anomalies",
        matterId: latest.context.matterId,
        title: `${matter ? matterLabel(matter) : "Matter"} repeated denied portal access`,
        status: "denied",
        priority: "high",
        reason: `${events.length} denied or blocked ${portalFamilyLabel(
          latest.context.family,
        )} attempts in ${input.windowHours} hours`,
        occurredAt: latest.log.occurredAt,
        metadata: {
          family: latest.context.family,
          linkId: latest.context.id,
          deniedCount: events.length,
          latestReason: latest.reason,
          windowHours: input.windowHours,
        },
      },
    ];
  });
}

function buildPortalLinksExpiringResults(input: {
  contexts: Map<string, PortalLinkContext>;
  mattersById: Map<string, OperationalMatterInput>;
  nowMs: number;
  windowDays: number;
}): OperationalViewResult[] {
  const windowMs = input.windowDays * 86_400_000;
  return Array.from(input.contexts.values()).flatMap((context): OperationalViewResult[] => {
    const matter = input.mattersById.get(context.matterId);
    const expiresAt = toTime(context.expiresAt);
    if (!matter || !context.active || expiresAt === undefined) return [];
    if (expiresAt <= input.nowMs || expiresAt - input.nowMs > windowMs) return [];
    const hoursUntilExpiry = Math.ceil((expiresAt - input.nowMs) / 3_600_000);
    return [
      {
        id: `portal-expiring:${context.family}:${context.id}`,
        viewKey: "portal_links_expiring",
        matterId: context.matterId,
        title: `${matter.number} ${context.label}`,
        status: "active",
        priority: hoursUntilExpiry <= 48 ? "high" : "medium",
        reason: `${portalFamilyLabel(context.family)} link expires in ${hoursUntilExpiry} hours`,
        dueAt: context.expiresAt,
        metadata: {
          family: context.family,
          linkId: context.id,
          hoursUntilExpiry,
          ...context.metadata,
        },
      },
    ];
  });
}

function buildStaleMatterResults(
  input: BuildBuiltInOperationalViewsInput,
  nowMs: number,
): OperationalViewResult[] {
  const staleAfterDays = input.staleAfterDays ?? 14;
  return input.matters.flatMap((matter): OperationalViewResult[] => {
    if (!activeMatterStatuses.has(matter.status)) return [];
    const lastActivityAt = latestActivityAt(matter);
    const lastActivityMs = toTime(lastActivityAt);
    if (lastActivityMs === undefined) return [];
    const ageDays = daysBetween(nowMs, lastActivityMs);
    if (ageDays < staleAfterDays) return [];
    return [
      {
        id: `stale:${matter.id}`,
        viewKey: "stale_matters",
        matterId: matter.id,
        title: matterLabel(matter),
        status: matter.status,
        priority: ageDays >= 30 ? "high" : "medium",
        reason: `No visible activity for ${ageDays} days`,
        lastActivityAt,
        metadata: { ageDays, practiceArea: matter.practiceArea },
      },
    ];
  });
}

function buildUncontactedClientResults(
  input: BuildBuiltInOperationalViewsInput,
): OperationalViewResult[] {
  return input.matters.flatMap((matter): OperationalViewResult[] => {
    if (!activeMatterStatuses.has(matter.status) || !hasClientParty(matter)) return [];
    if (
      hasDerivedClientContactActivity({
        matter,
        emailOutbox: input.emailOutbox,
        inboundEmailMessages: input.inboundEmailMessages,
      })
    ) {
      return [];
    }
    return [
      {
        id: `uncontacted:${matter.id}`,
        viewKey: "uncontacted_clients",
        matterId: matter.id,
        title: matterLabel(matter),
        status: matter.status,
        priority: matter.status === "intake" ? "high" : "medium",
        reason: "No derived portal, intake, signature, upload, or email contact activity",
        lastActivityAt: latestActivityAt(matter),
        metadata: { practiceArea: matter.practiceArea },
      },
    ];
  });
}

function buildAwaitingSignatureResults(
  input: BuildBuiltInOperationalViewsInput,
  nowMs: number,
  mattersById: Map<string, OperationalMatterInput>,
): OperationalViewResult[] {
  return (input.signatures ?? []).flatMap((signature): OperationalViewResult[] => {
    const matter = mattersById.get(signature.matterId);
    if (!matter || terminalSignatureStatuses.has(signature.status)) return [];
    const ageDays = daysBetween(nowMs, toTime(signature.createdAt) ?? nowMs);
    return [
      {
        id: `signature:${signature.id}`,
        viewKey: "awaiting_signature",
        matterId: signature.matterId,
        title: `Signature request ${signature.id}`,
        status: signature.status,
        priority: signature.status === "provider_error" || ageDays >= 7 ? "high" : "medium",
        reason: `Signature request is ${signature.status}`,
        occurredAt: signature.createdAt,
        metadata: { documentId: signature.documentId, ageDays, matterNumber: matter.number },
      },
    ];
  });
}

function buildExternalUploadExpiryResults(
  input: BuildBuiltInOperationalViewsInput,
  nowMs: number,
  mattersById: Map<string, OperationalMatterInput>,
): OperationalViewResult[] {
  const windowMs = (input.externalUploadExpiryWindowDays ?? 7) * 86_400_000;
  return (input.externalUploadLinks ?? []).flatMap((link): OperationalViewResult[] => {
    const matter = mattersById.get(link.matterId);
    const expiresAt = toTime(link.expiresAt);
    if (!matter || link.revokedAt || expiresAt === undefined) return [];
    if (expiresAt <= nowMs || expiresAt - nowMs > windowMs) return [];
    const remainingUploads = Math.max(link.maxUploads - link.usedUploads, 0);
    if (remainingUploads <= 0) return [];
    const hoursUntilExpiry = Math.ceil((expiresAt - nowMs) / 3_600_000);
    return [
      {
        id: `external-upload:${link.id}`,
        viewKey: "external_uploads_expiring",
        matterId: link.matterId,
        title: `${matter.number} external upload link`,
        status: "active",
        priority: hoursUntilExpiry <= 48 ? "high" : "medium",
        reason: `External upload link expires in ${hoursUntilExpiry} hours`,
        dueAt: link.expiresAt,
        metadata: { remainingUploads, maxUploads: link.maxUploads, usedUploads: link.usedUploads },
      },
    ];
  });
}

function buildConflictReviewResults(
  input: BuildBuiltInOperationalViewsInput,
  mattersById: Map<string, OperationalMatterInput>,
): OperationalViewResult[] {
  const byKey = new Map<string, OperationalViewResult>();
  for (const dossier of input.contactDossiers ?? []) {
    const signals = [
      ...dossier.conflictCues.map((cue) => ({
        matterId: cue.matterId,
        severity: cue.severity,
        reason: cue.reason,
        source: "conflict_cue",
      })),
      ...dossier.qualityReview.signals.map((signal) => ({
        matterId: signal.matterId,
        severity: signal.severity,
        reason: signal.reason,
        source: signal.kind,
      })),
    ];
    for (const signal of signals) {
      if (!signal.matterId || signal.severity === "info") continue;
      const matter = mattersById.get(signal.matterId);
      if (!matter) continue;
      const key = `${signal.matterId}:${signal.source}:${signal.reason}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.metadata.count = Number(existing.metadata.count ?? 1) + 1;
        continue;
      }
      byKey.set(key, {
        id: `conflict:${key.replace(/[^a-zA-Z0-9:_-]/g, "-")}`,
        viewKey: "conflicts_pending_review",
        matterId: signal.matterId,
        title: matterLabel(matter),
        status: signal.severity,
        priority: signal.severity === "blocker" ? "high" : "medium",
        reason: signal.reason,
        metadata: { source: signal.source, count: 1 },
      });
    }
  }
  return Array.from(byKey.values());
}

function isDeadlineSignal(event: CalendarEventRecord): boolean {
  const searchable = `${event.title} ${event.description ?? ""}`.toLowerCase();
  return deadlineTerms.some((term) => searchable.includes(term));
}

function buildOverdueTaskDeadlineResults(
  input: BuildBuiltInOperationalViewsInput,
  nowMs: number,
  mattersById: Map<string, OperationalMatterInput>,
): OperationalViewResult[] {
  const taskResults = (input.taskDeadlines ?? []).flatMap((task): OperationalViewResult[] => {
    const matter = mattersById.get(task.matterId);
    const dueAt = toTime(task.dueAt);
    if (
      !matter ||
      task.status !== "open" ||
      task.archivedAt ||
      task.completedAt ||
      dueAt === undefined ||
      dueAt >= nowMs
    ) {
      return [];
    }
    const overdueDays = Math.max(daysBetween(nowMs, dueAt), 0);
    return [
      {
        id: `task:${task.id}`,
        viewKey: "overdue_tasks_deadlines",
        matterId: task.matterId,
        title: task.title,
        status: task.status,
        priority: task.priority === "high" || overdueDays >= 3 ? "high" : "medium",
        reason: `Task deadline is ${overdueDays} days overdue`,
        dueAt: task.dueAt,
        metadata: {
          overdueDays,
          matterNumber: matter.number,
          assignedToUserId: task.assignedToUserId,
          taskPriority: task.priority,
        },
      },
    ];
  });
  const calendarResults = (input.calendarEvents ?? []).flatMap((event): OperationalViewResult[] => {
    if (!event.matterId) return [];
    const matter = mattersById.get(event.matterId);
    const startsAt = toTime(event.startsAt);
    if (!matter || event.status === "cancelled" || startsAt === undefined || startsAt >= nowMs) {
      return [];
    }
    if (!isDeadlineSignal(event)) return [];
    const overdueDays = Math.max(daysBetween(nowMs, startsAt), 0);
    return [
      {
        id: `calendar:${event.id}`,
        viewKey: "overdue_tasks_deadlines",
        matterId: event.matterId,
        title: `Calendar deadline ${event.id}`,
        status: event.status,
        priority: overdueDays >= 3 ? "high" : "medium",
        reason: `Calendar task or deadline is ${overdueDays} days overdue`,
        dueAt: event.startsAt,
        metadata: { overdueDays, matterNumber: matter.number },
      },
    ];
  });
  return [...taskResults, ...calendarResults].sort((left, right) => {
    const leftDue = toTime(left.dueAt) ?? Number.POSITIVE_INFINITY;
    const rightDue = toTime(right.dueAt) ?? Number.POSITIVE_INFINITY;
    if (leftDue !== rightDue) return leftDue - rightDue;
    return left.id.localeCompare(right.id);
  });
}

export function buildBuiltInOperationalViews(
  input: BuildBuiltInOperationalViewsInput,
): BuiltInOperationalView[] {
  const now = input.now ?? new Date().toISOString();
  const nowMs = toTime(now) ?? Date.now();
  const mattersById = visibleMatterMap(input.matters);
  const portalContexts = portalLinkContexts(input, nowMs);
  const portalEvents = portalAccessEvents({
    accessLogs: input.accessLogs,
    contexts: portalContexts,
    mattersById,
  });
  const results = [
    ...buildStaleMatterResults(input, nowMs),
    ...buildUncontactedClientResults(input),
    ...buildAwaitingSignatureResults(input, nowMs, mattersById),
    ...buildExternalUploadExpiryResults(input, nowMs, mattersById),
    ...buildConflictReviewResults(input, mattersById),
    ...buildOverdueTaskDeadlineResults(input, nowMs, mattersById),
    ...buildPortalAccessActivityResults({ events: portalEvents, mattersById }),
    ...buildPortalAccessAnomalyResults({
      events: portalEvents,
      mattersById,
      nowMs,
      windowHours: input.portalDeniedAttemptWindowHours ?? 24,
    }),
    ...buildPortalLinksExpiringResults({
      contexts: portalContexts,
      mattersById,
      nowMs,
      windowDays: input.portalLinkExpiryWindowDays ?? 7,
    }),
  ];

  return BUILT_IN_OPERATIONAL_VIEW_DEFINITIONS.map((definition) => {
    const viewResults = results
      .filter((result) => result.viewKey === definition.key)
      .sort(resultSort);
    return {
      definition,
      resultCount: viewResults.length,
      results: viewResults,
    };
  });
}
