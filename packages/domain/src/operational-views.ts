import type { ContactDossier } from "./contacts.js";
import type { ActivityTimelineEntry, CalendarEventRecord, Matter, MatterParty } from "./models.js";
import type {
  EmailOutboxRecord,
  ExternalUploadLinkRecord,
  InboundEmailMessageRecord,
} from "./operations.js";
import type { Action, ResourceKind } from "./permissions.js";
import type { SignatureRequestRecord } from "./signatures.js";

export type BuiltInOperationalViewKey =
  | "stale_matters"
  | "uncontacted_clients"
  | "awaiting_signature"
  | "external_uploads_expiring"
  | "conflicts_pending_review"
  | "overdue_tasks_deadlines";

export type OperationalViewPriority = "high" | "medium" | "low";
export type SavedOperationalViewSurface = "queues";
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
  externalUploadLinks?: ExternalUploadLinkRecord[];
  calendarEvents?: CalendarEventRecord[];
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
    description: "Visible past calendar task or deadline signals that are still active.",
    defaultPriority: "high",
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
  const priorityRank: Record<OperationalViewPriority, number> = { high: 0, medium: 1, low: 2 };
  if (priorityRank[left.priority] !== priorityRank[right.priority]) {
    return priorityRank[left.priority] - priorityRank[right.priority];
  }
  const leftTime = toTime(left.dueAt ?? left.lastActivityAt ?? left.occurredAt) ?? 0;
  const rightTime = toTime(right.dueAt ?? right.lastActivityAt ?? right.occurredAt) ?? 0;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.id.localeCompare(right.id);
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
  return (input.calendarEvents ?? []).flatMap((event): OperationalViewResult[] => {
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
}

export function buildBuiltInOperationalViews(
  input: BuildBuiltInOperationalViewsInput,
): BuiltInOperationalView[] {
  const now = input.now ?? new Date().toISOString();
  const nowMs = toTime(now) ?? Date.now();
  const mattersById = visibleMatterMap(input.matters);
  const results = [
    ...buildStaleMatterResults(input, nowMs),
    ...buildUncontactedClientResults(input),
    ...buildAwaitingSignatureResults(input, nowMs, mattersById),
    ...buildExternalUploadExpiryResults(input, nowMs, mattersById),
    ...buildConflictReviewResults(input, mattersById),
    ...buildOverdueTaskDeadlineResults(input, nowMs, mattersById),
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
