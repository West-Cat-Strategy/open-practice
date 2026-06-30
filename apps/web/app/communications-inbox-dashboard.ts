import type {
  CommunicationsChannelHistoryItem,
  CommunicationsInboxDashboardResponse,
  CommunicationsInboxMatterResponse,
  CommunicationsInboxOutboundDelivery,
  InboundEmailMatterDraft,
} from "./_features/communications/models";
import { describeEmailDeliveryHandoff } from "./email-delivery-dashboard";
import type { MatterSummary } from "./types";

export function buildCommunicationsInboxPath(matterId: string): string {
  return `/api/communications/inbox?matterId=${encodeURIComponent(matterId)}`;
}

export function describeCommunicationsDeliveryState(email: CommunicationsInboxOutboundDelivery): {
  label: string;
  detail: string;
  retryEligible: boolean;
  tone?: "risk";
} {
  const handoff = describeEmailDeliveryHandoff(email);
  return {
    label: handoff.label,
    detail: handoff.detail,
    retryEligible: handoff.retryEligible,
    tone: handoff.tone,
  };
}

export function describeCommunicationsHistoryState(item: CommunicationsChannelHistoryItem): {
  label: string;
  tone?: "risk";
} {
  if (item.status === "failed" || item.status === "thread_revoked") {
    return { label: item.status.replaceAll("_", " "), tone: "risk" };
  }
  return { label: item.status.replaceAll("_", " ") };
}

const checklistStateOrder = ["complete", "needs_attention", "review"] as const;

export interface InboundEmailMatterDraftReviewCueDisplaySummary {
  duplicateCandidates: string;
  existingMatterCandidates: string;
  checklistStates: string;
  boundary: string;
}

function pluralized(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

export function summarizeInboundEmailMatterDraftReviewCues(
  draft?: InboundEmailMatterDraft,
): InboundEmailMatterDraftReviewCueDisplaySummary | undefined {
  const cues = draft?.reviewCues;
  if (!cues) return undefined;
  const checklistCounts = new Map<(typeof checklistStateOrder)[number], number>(
    checklistStateOrder.map((state) => [state, 0]),
  );
  for (const cue of cues.checklist) {
    checklistCounts.set(cue.state, (checklistCounts.get(cue.state) ?? 0) + 1);
  }
  return {
    duplicateCandidates: pluralized(cues.duplicateCandidates.length, "duplicate candidate"),
    existingMatterCandidates: pluralized(
      cues.existingMatterCandidates.length,
      "existing matter candidate",
    ),
    checklistStates: checklistStateOrder
      .map((state) => `${checklistCounts.get(state) ?? 0} ${state.replaceAll("_", " ")}`)
      .join(" · "),
    boundary: "no auto-create · no permission widening",
  };
}

export async function loadCommunicationsInboxDashboardData(input: {
  matters: MatterSummary[];
  getInboxForMatter: (matterId: string) => Promise<CommunicationsInboxMatterResponse>;
}): Promise<CommunicationsInboxDashboardResponse> {
  const inboxByMatterId: CommunicationsInboxDashboardResponse["inboxByMatterId"] = {};
  await Promise.all(
    input.matters.map(async (matter) => {
      inboxByMatterId[matter.id] = await input.getInboxForMatter(matter.id);
    }),
  );
  return { inboxByMatterId, unscopedInboundEmail: { status: "unavailable", messages: [] } };
}
