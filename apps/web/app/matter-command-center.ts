import type { ActivityTimelineEntry } from "@open-practice/domain";
import type { ExternalUploadReviewItem } from "./_features/external-uploads/models";
import type { ShareLinkRecord } from "./_features/share-links/models";
import type {
  CommunicationsInboxMatterResponse,
  DocumentProcessingWorkbenchItem,
  MatterSummary,
} from "./types";

export type MatterActivityKindFilter = "all" | ActivityTimelineEntry["kind"];
export type MatterActivityStatusFilter = "all" | "attention" | "open" | "complete";

export const matterActivityKindFilters: readonly MatterActivityKindFilter[] = [
  "all",
  "document",
  "upload",
  "share",
  "email",
  "task",
  "billing",
  "calendar",
  "intake",
  "signature",
  "contact",
  "ledger",
  "conflict",
  "audit",
  "portal",
];

const activityKindLabels: Record<ActivityTimelineEntry["kind"], string> = {
  audit: "Audit",
  billing: "Billing",
  calendar: "Calendar",
  conflict: "Conflict",
  contact: "Contact",
  document: "Document",
  email: "Email",
  intake: "Intake",
  ledger: "Ledger",
  portal: "Portal",
  share: "Share",
  signature: "Signature",
  task: "Task",
  upload: "Upload",
};

const attentionWords = [
  "blocked",
  "cancelled",
  "conflict",
  "dead_letter",
  "discarded",
  "failed",
  "needs_metadata",
  "overdue",
  "rejected",
  "retry",
  "risk",
  "unverified",
];

const completeWords = [
  "accepted",
  "approved",
  "completed",
  "delivered",
  "done",
  "passed",
  "sent",
  "verified",
];

function metadataValues(entry: ActivityTimelineEntry): string {
  return Object.values(entry.metadata)
    .filter((value) => typeof value === "string" || typeof value === "boolean")
    .join(" ")
    .toLowerCase();
}

export function formatMatterActivityKind(kind: MatterActivityKindFilter): string {
  if (kind === "all") return "All activity";
  return activityKindLabels[kind];
}

export function matterActivityStatus(entry: ActivityTimelineEntry): MatterActivityStatusFilter {
  const text = `${entry.title} ${entry.kind} ${metadataValues(entry)}`.toLowerCase();
  if (attentionWords.some((word) => text.includes(word))) return "attention";
  if (completeWords.some((word) => text.includes(word))) return "complete";
  return "open";
}

export function formatMatterActivityStatus(status: MatterActivityStatusFilter): string {
  if (status === "all") return "All statuses";
  if (status === "attention") return "Needs attention";
  if (status === "complete") return "Complete";
  return "Open";
}

export function filterMatterActivity(input: {
  entries: ActivityTimelineEntry[];
  kind: MatterActivityKindFilter;
  status: MatterActivityStatusFilter;
}): ActivityTimelineEntry[] {
  return input.entries
    .filter((entry) => input.kind === "all" || entry.kind === input.kind)
    .filter((entry) => input.status === "all" || matterActivityStatus(entry) === input.status)
    .slice()
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function summarizeMatterActivity(entries: ActivityTimelineEntry[]): {
  total: number;
  attention: number;
  complete: number;
  byKind: Array<{ kind: ActivityTimelineEntry["kind"]; count: number }>;
} {
  const counts = new Map<ActivityTimelineEntry["kind"], number>();
  for (const entry of entries) {
    counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  }
  return {
    total: entries.length,
    attention: entries.filter((entry) => matterActivityStatus(entry) === "attention").length,
    complete: entries.filter((entry) => matterActivityStatus(entry) === "complete").length,
    byKind: [...counts.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((left, right) => right.count - left.count || left.kind.localeCompare(right.kind)),
  };
}

function activeShareCount(shares: ShareLinkRecord[], now = Date.now()): number {
  return shares.filter(
    (share) => !share.revokedAt && (!share.expiresAt || Date.parse(share.expiresAt) > now),
  ).length;
}

function isExternalUploadReviewAttention(document: ExternalUploadReviewItem): boolean {
  return ["pending_review", "needs_metadata", "retry_requested"].includes(document.reviewStatus);
}

function isDocumentSupersessionCue(
  document: Pick<
    MatterSummary["documents"][number],
    "duplicateOfDocumentId" | "supersedesDocumentId" | "supersededAt"
  >,
): boolean {
  return Boolean(
    document.duplicateOfDocumentId || document.supersedesDocumentId || document.supersededAt,
  );
}

export function buildMatterFileCommandCenter(input: {
  matter: MatterSummary;
  documentRows: DocumentProcessingWorkbenchItem[];
  shares: ShareLinkRecord[];
  externalUploadDocuments: ExternalUploadReviewItem[];
  communicationsInbox?: CommunicationsInboxMatterResponse;
}): {
  summary: {
    documents: number;
    readyForOcr: number;
    queuedOrActive: number;
    needsReview: number;
    blocked: number;
    activeShares: number;
    externalUploads: number;
    externalReviewAttention: number;
    supersessionCues: number;
    communicationRecords: number;
  };
  rail: Array<{
    key: string;
    label: string;
    value: number;
    detail: string;
    tone: "neutral" | "ready" | "risk";
  }>;
} {
  const readyForOcr = input.documentRows.filter((row) => row.queueEligibility.eligible).length;
  const queuedOrActive = input.documentRows.filter(
    (row) => row.group === "queued_or_active",
  ).length;
  const needsReview = input.documentRows.filter((row) => row.group === "needs_review").length;
  const blocked = input.documentRows.filter((row) => row.group === "blocked").length;
  const activeShares = activeShareCount(input.shares);
  const externalReviewAttention = input.externalUploadDocuments.filter(
    isExternalUploadReviewAttention,
  ).length;
  const communicationRecords = input.communicationsInbox
    ? input.communicationsInbox.inboundEmail.length +
      input.communicationsInbox.outboundDeliveryHistory.length +
      input.communicationsInbox.conversations.length
    : 0;
  const supersessionCues = input.matter.documents.filter(isDocumentSupersessionCue).length;

  const summary = {
    documents: input.matter.documents.length,
    readyForOcr,
    queuedOrActive,
    needsReview,
    blocked,
    activeShares,
    externalUploads: input.externalUploadDocuments.length,
    externalReviewAttention,
    supersessionCues,
    communicationRecords,
  };

  return {
    summary,
    rail: [
      {
        key: "readyForOcr",
        label: "Ready for OCR",
        value: readyForOcr,
        detail: "Verified files eligible for the existing OCR queue",
        tone: readyForOcr > 0 ? "ready" : "neutral",
      },
      {
        key: "needsReview",
        label: "Needs review",
        value: needsReview + externalReviewAttention,
        detail: "Review-gated files and external uploads",
        tone: needsReview + externalReviewAttention > 0 ? "risk" : "neutral",
      },
      {
        key: "activeShares",
        label: "Active shares",
        value: activeShares,
        detail: "Revocable share links currently active",
        tone: activeShares > 0 ? "ready" : "neutral",
      },
      {
        key: "externalUploads",
        label: "External uploads",
        value: input.externalUploadDocuments.length,
        detail: "Client-supplied files preserving original review state",
        tone: externalReviewAttention > 0 ? "risk" : "neutral",
      },
      {
        key: "blocked",
        label: "Blocked files",
        value: blocked,
        detail: "Files blocked by verification, checksum, scan, review, or queue posture",
        tone: blocked > 0 ? "risk" : "neutral",
      },
      {
        key: "supersession",
        label: "Supersession cues",
        value: supersessionCues,
        detail: "Duplicate, supersedes, or superseded file metadata",
        tone: supersessionCues > 0 ? "ready" : "neutral",
      },
      {
        key: "communications",
        label: "Communication records",
        value: communicationRecords,
        detail: "Inbound, outbound, and conversation-topic records for this matter",
        tone: communicationRecords > 0 ? "ready" : "neutral",
      },
      {
        key: "queuedOrActive",
        label: "Queued or active",
        value: queuedOrActive,
        detail: "Document-processing jobs already queued or active",
        tone: queuedOrActive > 0 ? "ready" : "neutral",
      },
    ],
  };
}
