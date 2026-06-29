import type {
  CalendarEventAttendeeRecord,
  CalendarEventRecord,
  CalendarEventReminderRecord,
  CalendarMeetingInvitationBoundary,
  CalendarMeetingLinkMode,
  CalendarSchedulingRequestSummary,
} from "@open-practice/domain/calendar-models";
import type { ReviewAgingDecision } from "@open-practice/domain";
import type {
  CalendarCredentialSummary,
  CalendarDashboardResponse,
  CalendarEventsResponse,
  CalendarGuestSessionSummary,
  CalendarMatterLinks,
} from "./_features/calendar/models";
import type { DeliveryConfirmationPayload, MatterSummary } from "./types";
import { buildEmailDeliveryConfirmation } from "./types";

export interface CalendarRadarBuckets {
  overdue: CalendarEventRecord[];
  nextSevenDays: CalendarEventRecord[];
  nextThirtyDays: CalendarEventRecord[];
  tentative: CalendarEventRecord[];
  cancelled: CalendarEventRecord[];
}

export function sortCalendarEvents(events: CalendarEventRecord[]): CalendarEventRecord[] {
  return [...events].sort((left, right) => {
    const startsAtDifference = Date.parse(left.startsAt) - Date.parse(right.startsAt);
    return startsAtDifference === 0 ? left.id.localeCompare(right.id) : startsAtDifference;
  });
}

export function buildCalendarRadarBuckets(
  events: CalendarEventRecord[],
  now: Date = new Date(),
): CalendarRadarBuckets {
  const currentTime = now.getTime();
  const sevenDays = currentTime + 7 * 24 * 60 * 60 * 1000;
  const thirtyDays = currentTime + 30 * 24 * 60 * 60 * 1000;
  const sortedEvents = sortCalendarEvents(events);
  const activeEvents = sortedEvents.filter((event) => event.status !== "cancelled");

  return {
    overdue: activeEvents.filter((event) => Date.parse(event.startsAt) < currentTime),
    nextSevenDays: activeEvents.filter((event) => {
      const startsAt = Date.parse(event.startsAt);
      return startsAt >= currentTime && startsAt <= sevenDays;
    }),
    nextThirtyDays: activeEvents.filter((event) => {
      const startsAt = Date.parse(event.startsAt);
      return startsAt > sevenDays && startsAt <= thirtyDays;
    }),
    tentative: activeEvents.filter((event) => event.status === "tentative"),
    cancelled: sortedEvents.filter((event) => event.status === "cancelled"),
  };
}

export function describeCalendarEventTiming(
  event: CalendarEventRecord,
  now: Date = new Date(),
): "overdue" | "next 7 days" | "next 30 days" | "later" {
  const currentTime = now.getTime();
  const startsAt = Date.parse(event.startsAt);
  if (startsAt < currentTime) return "overdue";
  if (startsAt <= currentTime + 7 * 24 * 60 * 60 * 1000) return "next 7 days";
  if (startsAt <= currentTime + 30 * 24 * 60 * 60 * 1000) return "next 30 days";
  return "later";
}

export function describeMeetingInvitationBoundary(
  boundary: CalendarMeetingInvitationBoundary | undefined,
): string {
  if (!boundary) return "Meeting links disabled.";
  const linkStatus =
    boundary.meetingLinks.status === "configured"
      ? "Meeting links configured."
      : "Meeting links disabled.";
  const guestAccessStatus =
    boundary.guestAccess.status === "configured"
      ? "Guest access tokens configured."
      : "Guest access tokens disabled.";
  return `${linkStatus} ${guestAccessStatus}`;
}

export interface MeetingLinkAvailability {
  label: string;
  detail: string;
  status: "configured" | "disabled";
  actionable: boolean;
}

export interface CalendarStaffHandoffSummary {
  label: string;
  detail: string;
  tone?: "risk";
  action: "send_confirmed_invites" | "review_request" | "linked_existing_event" | "no_action";
  publicBookingEnabled: false;
  providerSyncEnabled: false;
  nativeMediaEnabled: false;
}

export interface ReviewAgingDisplay {
  label: string;
  detail: string;
  tone?: "risk";
}

export interface CalendarMeetingReadinessItem {
  id: string;
  label: string;
  detail: string;
  status: "ready" | "review" | "disabled";
  blockerCount?: number;
}

export type CalendarSchedulingReviewDecision = "reviewed" | "dismissed" | "scheduled";
export type CalendarSchedulingAgingReviewDecision = ReviewAgingDecision;

export interface CalendarSchedulingReviewNextStep {
  label: string;
  detail: string;
  canMarkReviewed: boolean;
  canDismiss: boolean;
  canLinkEvent: boolean;
  linkEventDisabledReason?: string;
}

export interface CalendarSchedulingRequestPayload {
  matterId: string;
  kind: CalendarSchedulingRequestSummary["kind"];
  title: string;
  taskId?: string;
  calendarEventId?: string;
  calendarReminderId?: string;
  ownerUserId?: string;
  sourceType: CalendarSchedulingRequestSummary["source"]["type"];
  sourceId?: string;
  sourceLabel?: string;
  requestedDueAt?: string;
  requestedStartsAt?: string;
  requestedEndsAt?: string;
  reminderPosture?: CalendarSchedulingRequestSummary["reminderSummary"]["posture"];
  privacy?: CalendarSchedulingRequestSummary["privacy"]["visibility"];
  timeCaptureCue?: CalendarSchedulingRequestSummary["timeCaptureCue"];
}

type CalendarSchedulingRequestPayloadInput =
  | {
      type: "task_deadline";
      matterId: string;
      taskId: string;
      title: string;
      dueAt?: string;
      sourceLabel?: string;
      ownerUserId?: string;
      privacy?: CalendarSchedulingRequestPayload["privacy"];
    }
  | {
      type: "calendar_event";
      matterId: string;
      calendarEventId: string;
      title: string;
      startsAt?: string;
      endsAt?: string;
      sourceLabel?: string;
      ownerUserId?: string;
      privacy?: CalendarSchedulingRequestPayload["privacy"];
    }
  | {
      type: "calendar_reminder";
      matterId: string;
      calendarEventId: string;
      calendarReminderId: string;
      title: string;
      remindAt: string;
      sourceLabel?: string;
      ownerUserId?: string;
      privacy?: CalendarSchedulingRequestPayload["privacy"];
    }
  | {
      type: "manual";
      matterId: string;
      title: string;
      requestedDueAt?: string;
      requestedStartsAt?: string;
      requestedEndsAt?: string;
      sourceId?: string;
      sourceLabel?: string;
      ownerUserId?: string;
      privacy?: CalendarSchedulingRequestPayload["privacy"];
    };

const disabledCalendarAutomation = {
  publicBookingEnabled: false,
  providerSyncEnabled: false,
  nativeMediaEnabled: false,
} as const;

const schedulingRequestStatusOrder: Record<CalendarSchedulingRequestSummary["status"], number> = {
  needs_review: 0,
  scheduled: 1,
  reviewed: 2,
  dismissed: 3,
};

function schedulingRequestSortTime(request: CalendarSchedulingRequestSummary): number {
  return (
    Date.parse(
      request.requestedDueAt ??
        request.requestedStartsAt ??
        request.linkedEvent?.startsAt ??
        request.reviewedAt ??
        "",
    ) || 0
  );
}

function blockerSummary(blockers: string[], readyDetail: string): string {
  if (blockers.length === 0) return `0 blockers; ${readyDetail}`;
  return `${blockers.length} blocker${blockers.length === 1 ? "" : "s"}: ${blockers.join("; ")}.`;
}

export function sortCalendarSchedulingRequests(
  requests: CalendarSchedulingRequestSummary[],
): CalendarSchedulingRequestSummary[] {
  return [...requests].sort((left, right) => {
    const statusDifference =
      schedulingRequestStatusOrder[left.status] - schedulingRequestStatusOrder[right.status];
    if (statusDifference !== 0) return statusDifference;
    const timeDifference = schedulingRequestSortTime(left) - schedulingRequestSortTime(right);
    if (timeDifference !== 0) return timeDifference;
    const titleDifference = left.title.localeCompare(right.title);
    return titleDifference === 0 ? left.id.localeCompare(right.id) : titleDifference;
  });
}

export function describeMeetingLinkAvailability(
  event: Pick<
    CalendarEventRecord,
    "meetingLinkMode" | "meetingLinkUrl" | "meetingProviderKey" | "meetingInvitationBoundary"
  >,
): MeetingLinkAvailability {
  if (event.meetingLinkUrl) {
    const providerDetail =
      event.meetingLinkMode === "hosted_webrtc"
        ? "Hosted WebRTC link ready"
        : "External meeting link ready";
    return {
      label: "Send link invite",
      detail: `${providerDetail}; the invitation action can include the stored meeting link.`,
      status: "configured",
      actionable: true,
    };
  }

  const hostedConfigured = event.meetingInvitationBoundary?.meetingLinks.status === "configured";
  return {
    label: "No meeting link",
    detail: hostedConfigured
      ? "Choose Hosted WebRTC or add another meeting link before sending link invites."
      : "Add another meeting link, leave it blank, or configure Hosted WebRTC before using hosted links.",
    status: "disabled",
    actionable: false,
  };
}

export function describeCalendarEventHandoff(
  event: Pick<
    CalendarEventRecord,
    "status" | "meetingLinkMode" | "meetingLinkUrl" | "meetingInvitationBoundary"
  > & { attendees?: CalendarEventAttendeeRecord[] },
): CalendarStaffHandoffSummary {
  const meetingLink = describeMeetingLinkAvailability(event);
  if (event.status === "cancelled") {
    return {
      label: "cancelled",
      detail: "Cancelled events stay closed to invitation and lobby handoff.",
      action: "no_action",
      ...disabledCalendarAutomation,
    };
  }
  if ((event.attendees ?? []).length === 0) {
    return {
      label: "add attendees",
      detail: "Add staff-reviewed attendees before sending invitation handoff.",
      action: "no_action",
      ...disabledCalendarAutomation,
    };
  }
  if (meetingLink.actionable) {
    return {
      label: "handoff ready",
      detail:
        "Staff can send confirmed invitation email handoff with the stored meeting link; public booking, provider sync, and native media stay disabled.",
      action: "send_confirmed_invites",
      ...disabledCalendarAutomation,
    };
  }
  return {
    label: "link review",
    detail: `${meetingLink.detail} Public booking, provider sync, and native media stay disabled.`,
    action: "review_request",
    tone: "risk",
    ...disabledCalendarAutomation,
  };
}

export function describeCalendarSchedulingRequestHandoff(
  request: CalendarSchedulingRequestSummary,
): CalendarStaffHandoffSummary {
  if (request.status === "needs_review") {
    return {
      label: "review needed",
      detail: request.linkedEvent
        ? "Staff review can keep the existing linked event; no automatic reschedule or provider sync runs."
        : "Staff review can link an existing same-matter event; no public booking page or event creation runs.",
      action: "review_request",
      tone: "risk",
      ...disabledCalendarAutomation,
    };
  }
  if (request.status === "scheduled") {
    return {
      label: "existing event linked",
      detail: "The request is linked to an existing event only; no automatic event creation ran.",
      action: "linked_existing_event",
      ...disabledCalendarAutomation,
    };
  }
  if (request.status === "reviewed") {
    return {
      label: "reviewed",
      detail: "Staff review completed without enabling public booking or provider sync.",
      action: "no_action",
      ...disabledCalendarAutomation,
    };
  }
  return {
    label: "dismissed",
    detail:
      "Dismissed scheduling requests stay closed to booking, provider sync, and native media.",
    action: "no_action",
    ...disabledCalendarAutomation,
  };
}

export function describeReviewAgingCue(
  cue: CalendarSchedulingRequestSummary["reviewAging"] | undefined,
): ReviewAgingDisplay | undefined {
  if (!cue) return undefined;
  const label =
    cue.status === "stale"
      ? "stale review"
      : cue.status === "aging"
        ? "aging review"
        : "fresh review";
  return {
    label,
    detail: `${cue.ageHours}h waiting since ${cue.referenceAt}; manual review only, no auto-confirm, auto-expiry, or provider sync.`,
    ...(cue.status === "stale" ? { tone: "risk" as const } : {}),
  };
}

export function describeReviewAgingDecision(
  record: CalendarSchedulingRequestSummary["reviewAgingDecision"] | undefined,
): ReviewAgingDisplay | undefined {
  if (!record) return undefined;
  const label =
    record.decision === "acknowledged"
      ? "acknowledged"
      : record.decision === "follow_up_required"
        ? "follow-up required"
        : "deferred";
  return {
    label,
    detail: `${record.cueStatus.replace("_", " ")} at ${
      record.ageHours
    }h by ${record.decidedByUserId}; review-only decision, no auto-confirm, auto-expiry, provider sync, public room, media, chat, recording, or matter.`,
  };
}

export function describeCalendarSchedulingReviewNextStep(input: {
  request: CalendarSchedulingRequestSummary;
  matterCalendarControlsEnabled: boolean;
  eligibleEventCount: number;
  selectedEventId?: string;
}): CalendarSchedulingReviewNextStep {
  if (!input.matterCalendarControlsEnabled) {
    return {
      label: "Matter required",
      detail:
        "Select a matter to enable scheduling review actions; matterless calendars stay display-only.",
      canMarkReviewed: false,
      canDismiss: false,
      canLinkEvent: false,
      linkEventDisabledReason: "Matter required.",
    };
  }
  if (input.request.status !== "needs_review") {
    return {
      label: "Already reviewed",
      detail: `This request is ${input.request.status.replace("_", " ")}; review actions stay disabled.`,
      canMarkReviewed: false,
      canDismiss: false,
      canLinkEvent: false,
      linkEventDisabledReason: "Already reviewed.",
    };
  }
  if (input.eligibleEventCount === 0) {
    return {
      label: "No eligible event",
      detail:
        "Linking needs an active same-matter event. Staff can still mark reviewed or dismiss without creating events.",
      canMarkReviewed: true,
      canDismiss: true,
      canLinkEvent: false,
      linkEventDisabledReason: "No eligible event.",
    };
  }
  if (!input.selectedEventId) {
    return {
      label: "Event not selected",
      detail:
        "Choose an existing same-matter event before linking. Review or dismissal remains available.",
      canMarkReviewed: true,
      canDismiss: true,
      canLinkEvent: false,
      linkEventDisabledReason: "Event not selected.",
    };
  }
  return {
    label: "Safe next step",
    detail:
      "Link the selected existing event, mark reviewed, or dismiss; no public booking or provider sync runs.",
    canMarkReviewed: true,
    canDismiss: true,
    canLinkEvent: true,
  };
}

export function calendarMeetingReadinessItems(
  event: Pick<
    CalendarEventRecord,
    "status" | "meetingLinkMode" | "meetingLinkUrl" | "meetingRoomId" | "meetingInvitationBoundary"
  > & { attendees?: CalendarEventAttendeeRecord[] },
  sessions: CalendarGuestSessionSummary[] = [],
): CalendarMeetingReadinessItem[] {
  const attendees = event.attendees ?? [];
  const activeSession = sessions.find((session) => session.status !== "ended");
  const hostedLinkReady =
    event.status !== "cancelled" &&
    event.meetingLinkMode === "hosted_webrtc" &&
    Boolean(event.meetingRoomId);
  const guestAccessConfigured =
    event.meetingInvitationBoundary?.guestAccess.status === "configured";
  const invitationEmailConfigured =
    event.meetingInvitationBoundary?.invitationEmail.status === "configured";
  const invitationBlockers = [
    ...(event.status === "cancelled" ? ["event is cancelled"] : []),
    ...(attendees.length === 0 ? ["add staff-reviewed attendees"] : []),
    ...(!event.meetingLinkUrl ? ["save a meeting link for link handoff"] : []),
    ...(!invitationEmailConfigured ? ["configure invitation email"] : []),
  ];
  const hostedLobbyBlockers = [
    ...(event.status === "cancelled" ? ["event is cancelled"] : []),
    ...(event.meetingLinkMode !== "hosted_webrtc" ? ["choose hosted meeting mode"] : []),
    ...(!event.meetingRoomId ? ["save hosted meeting link"] : []),
    ...(!guestAccessConfigured ? ["configure guest access"] : []),
  ];
  return [
    {
      id: "invitation-handoff",
      label:
        invitationBlockers.length === 0 ? "Invitation handoff ready" : "Invitation handoff review",
      detail: blockerSummary(
        invitationBlockers,
        "confirmed invitation handoff can proceed without exposing stored links.",
      ),
      status: invitationBlockers.length === 0 ? "ready" : "review",
      blockerCount: invitationBlockers.length,
    },
    {
      id: "hosted-lobby",
      label: hostedLobbyBlockers.length === 0 ? "Hosted lobby ready" : "Hosted lobby blocked",
      detail: blockerSummary(
        hostedLobbyBlockers,
        activeSession
          ? `staff-controlled lobby is ${activeSession.status} with ${activeSession.waitingCount} waiting.`
          : "staff can create a staff-controlled lobby when guest access is needed.",
      ),
      status: hostedLobbyBlockers.length === 0 ? "ready" : "disabled",
      blockerCount: hostedLobbyBlockers.length,
    },
    {
      id: "attendees",
      label: attendees.length > 0 ? "Attendees ready" : "Add attendees",
      detail:
        attendees.length > 0
          ? `${attendees.length} staff-reviewed attendee${attendees.length === 1 ? "" : "s"} linked.`
          : "Invite handoff waits for at least one staff-reviewed attendee.",
      status: attendees.length > 0 ? "ready" : "review",
    },
    {
      id: "meeting-link",
      label: event.meetingLinkUrl ? "Meeting link saved" : "Meeting link needed",
      detail: event.meetingLinkUrl
        ? "Stored meeting link can be included in confirmed invitations."
        : "Choose blank, external, or configured hosted WebRTC before sending link invitations.",
      status: event.meetingLinkUrl ? "ready" : "review",
    },
    {
      id: "guest-access",
      label: guestAccessConfigured ? "Guest access configured" : "Guest access disabled",
      detail: guestAccessConfigured
        ? "Guest status tokens can be issued from a staff-created lobby."
        : "Guest status tokens stay disabled until hosted access and signing are configured.",
      status: guestAccessConfigured ? "ready" : "disabled",
    },
    {
      id: "lobby",
      label: activeSession
        ? activeSession.status === "open"
          ? "Lobby open"
          : `Lobby ${activeSession.status}`
        : "No active lobby",
      detail: activeSession
        ? `${activeSession.waitingCount} waiting, ${activeSession.admittedCount} admitted, ${activeSession.deniedCount} denied.`
        : hostedLinkReady && guestAccessConfigured
          ? "Create a staff-controlled lobby when guest access is needed."
          : "Lobby controls wait for a hosted meeting link and guest access.",
      status: activeSession
        ? activeSession.status === "open"
          ? "ready"
          : "review"
        : hostedLinkReady && guestAccessConfigured
          ? "review"
          : "disabled",
    },
    {
      id: "invitation-email",
      label: invitationEmailConfigured ? "Invitation email ready" : "Invitation email disabled",
      detail: invitationEmailConfigured
        ? "Confirmed invitation delivery can queue through the configured email boundary."
        : "Invitation attempts stay skipped until SMTP and the email queue are configured.",
      status: invitationEmailConfigured ? "ready" : "disabled",
    },
  ];
}

export function describeCalendarGuestSessionStatus(
  session: Pick<
    CalendarGuestSessionSummary,
    "status" | "issuedCount" | "waitingCount" | "admittedCount" | "deniedCount" | "revokedCount"
  >,
): string {
  const lobby =
    session.status === "open"
      ? "Lobby open"
      : session.status === "locked"
        ? "Lobby locked"
        : session.status === "ended"
          ? "Session ended"
          : session.status === "expired"
            ? "Guest access expired"
            : "Lobby closed";
  return `${lobby}; ${session.waitingCount} waiting, ${session.admittedCount} admitted, ${session.deniedCount} denied, ${session.revokedCount} revoked.`;
}

const guestStatusOrder = {
  waiting: 0,
  issued: 1,
  admitted: 2,
  denied: 2,
  revoked: 2,
} as const;

function guestDecisionTimestamp(guest: CalendarGuestSessionSummary["guests"][number]): string {
  return guest.admittedAt ?? guest.deniedAt ?? guest.revokedAt ?? guest.expiresAt;
}

function guestQueueTimestamp(guest: CalendarGuestSessionSummary["guests"][number]): string {
  if (guest.status === "waiting") return guest.checkedInAt ?? guest.expiresAt;
  if (guest.status === "issued") return guest.expiresAt;
  return guestDecisionTimestamp(guest);
}

export function isTerminalCalendarGuestStatus(
  status: CalendarGuestSessionSummary["guests"][number]["status"],
): boolean {
  return status === "admitted" || status === "denied" || status === "revoked";
}

export function describeCalendarGuestActionDisabledReason(
  session: Pick<CalendarGuestSessionSummary, "status">,
  guest: Pick<CalendarGuestSessionSummary["guests"][number], "status">,
): string | null {
  if (session.status === "ended" || session.status === "expired") {
    return "Lobby ended; guest actions are closed.";
  }
  if (session.status === "locked") {
    return "Lobby locked; reopen the lobby before changing guest decisions.";
  }
  if (session.status !== "open") {
    return "Lobby is not open; open the lobby before changing guest decisions.";
  }
  if (isTerminalCalendarGuestStatus(guest.status)) {
    return "Guest decision is terminal for this queue view.";
  }
  return null;
}

export function sortCalendarGuestSessionGuests(
  guests: CalendarGuestSessionSummary["guests"],
): CalendarGuestSessionSummary["guests"] {
  return [...guests].sort((left, right) => {
    const statusDifference = guestStatusOrder[left.status] - guestStatusOrder[right.status];
    if (statusDifference !== 0) return statusDifference;
    const timeDifference =
      (Date.parse(guestQueueTimestamp(left)) || 0) - (Date.parse(guestQueueTimestamp(right)) || 0);
    return timeDifference === 0 ? left.id.localeCompare(right.id) : timeDifference;
  });
}

export function sortCalendarGuestSessions(
  sessions: CalendarGuestSessionSummary[],
): CalendarGuestSessionSummary[] {
  return [...sessions].sort((left, right) => {
    const endedWeight = Number(left.status === "ended") - Number(right.status === "ended");
    if (endedWeight !== 0) return endedWeight;
    const updatedDifference = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    return updatedDifference === 0 ? left.id.localeCompare(right.id) : updatedDifference;
  });
}

export function buildCalendarSchedulingReviewPayload(input: {
  matterId: string;
  status: CalendarSchedulingReviewDecision;
  calendarEventId?: string;
}): {
  matterId: string;
  status: CalendarSchedulingReviewDecision;
  calendarEventId?: string;
} {
  return {
    matterId: input.matterId,
    status: input.status,
    ...(input.status === "scheduled" && input.calendarEventId
      ? { calendarEventId: input.calendarEventId }
      : {}),
  };
}

function compactSchedulingRequestText(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= 160 ? trimmed : `${trimmed.slice(0, 157)}...`;
}

function schedulingRequestSourceLabel(input: { sourceLabel?: string; title: string }): string {
  return compactSchedulingRequestText(input.sourceLabel ?? input.title);
}

export function buildCalendarSchedulingRequestPayload(
  input: CalendarSchedulingRequestPayloadInput,
): CalendarSchedulingRequestPayload {
  const title = compactSchedulingRequestText(input.title);
  const base = {
    matterId: input.matterId,
    title,
    privacy: input.privacy ?? "staff_only",
    ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
  };

  if (input.type === "task_deadline") {
    return {
      ...base,
      kind: "deadline_review",
      taskId: input.taskId,
      sourceType: "task_deadline",
      sourceId: input.taskId,
      sourceLabel: schedulingRequestSourceLabel(input),
      ...(input.dueAt ? { requestedDueAt: input.dueAt } : {}),
      reminderPosture: "none",
    };
  }

  if (input.type === "calendar_event") {
    return {
      ...base,
      kind: "event_scheduling",
      calendarEventId: input.calendarEventId,
      sourceType: "calendar_event",
      sourceId: input.calendarEventId,
      sourceLabel: schedulingRequestSourceLabel(input),
      ...(input.startsAt && input.endsAt
        ? {
            requestedStartsAt: input.startsAt,
            requestedEndsAt: input.endsAt,
          }
        : {}),
      reminderPosture: "none",
    };
  }

  if (input.type === "calendar_reminder") {
    return {
      ...base,
      kind: "reminder_review",
      calendarEventId: input.calendarEventId,
      calendarReminderId: input.calendarReminderId,
      sourceType: "calendar_reminder",
      sourceId: input.calendarReminderId,
      sourceLabel: schedulingRequestSourceLabel(input),
      requestedDueAt: input.remindAt,
      reminderPosture: "dashboard_pending",
    };
  }

  return {
    ...base,
    kind: "event_scheduling",
    sourceType: "manual",
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    sourceLabel: schedulingRequestSourceLabel(input),
    ...(input.requestedDueAt ? { requestedDueAt: input.requestedDueAt } : {}),
    ...(input.requestedStartsAt && input.requestedEndsAt
      ? {
          requestedStartsAt: input.requestedStartsAt,
          requestedEndsAt: input.requestedEndsAt,
        }
      : {}),
    reminderPosture: "none",
  };
}

export function upsertCalendarSchedulingRequest(
  requestsByMatterId: Record<string, CalendarSchedulingRequestSummary[]>,
  matterId: string,
  request: CalendarSchedulingRequestSummary,
): Record<string, CalendarSchedulingRequestSummary[]> {
  const existingRequests = requestsByMatterId[matterId] ?? [];
  const exists = existingRequests.some((candidate) => candidate.id === request.id);
  const nextRequests = exists
    ? existingRequests.map((candidate) => (candidate.id === request.id ? request : candidate))
    : [...existingRequests, request];
  return {
    ...requestsByMatterId,
    [matterId]: sortCalendarSchedulingRequests(nextRequests),
  };
}

export function upsertCalendarGuestSession(
  sessionsByEventId: Record<string, CalendarGuestSessionSummary[]>,
  session: CalendarGuestSessionSummary,
): Record<string, CalendarGuestSessionSummary[]> {
  const existingSessions = sessionsByEventId[session.eventId] ?? [];
  const exists = existingSessions.some((candidate) => candidate.id === session.id);
  const nextSessions = exists
    ? existingSessions.map((candidate) => (candidate.id === session.id ? session : candidate))
    : [session, ...existingSessions];
  return {
    ...sessionsByEventId,
    [session.eventId]: sortCalendarGuestSessions(nextSessions),
  };
}

export function buildCalendarMeetingLinkPayload(input: {
  matterId: string;
  mode: CalendarMeetingLinkMode;
  externalUrl?: string;
}): { matterId: string; mode: CalendarMeetingLinkMode; url?: string } {
  return {
    matterId: input.matterId,
    mode: input.mode,
    ...(input.mode === "external_url" ? { url: (input.externalUrl ?? "").trim() } : {}),
  };
}

export function buildCalendarEventPayload(input: {
  scope?: CalendarEventRecord["scope"];
  matterId?: string;
  clientContactId?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status?: CalendarEventRecord["status"];
  description?: string;
  location?: string;
}): {
  scope?: CalendarEventRecord["scope"];
  matterId?: string;
  clientContactId?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status?: CalendarEventRecord["status"];
  description?: string;
  location?: string;
} {
  return {
    ...(input.scope ? { scope: input.scope } : {}),
    ...(input.matterId ? { matterId: input.matterId } : {}),
    ...(input.clientContactId ? { clientContactId: input.clientContactId } : {}),
    title: input.title.trim(),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    ...(input.status ? { status: input.status } : {}),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ...(input.location?.trim() ? { location: input.location.trim() } : {}),
  };
}

export function buildCalendarReschedulePayload(input: {
  scope?: CalendarEventRecord["scope"];
  matterId?: string;
  clientContactId?: string;
  startsAt: string;
  endsAt: string;
  status?: CalendarEventRecord["status"];
}): {
  scope?: CalendarEventRecord["scope"];
  matterId?: string;
  clientContactId?: string;
  startsAt: string;
  endsAt: string;
  status?: CalendarEventRecord["status"];
} {
  return {
    ...(input.scope ? { scope: input.scope } : {}),
    ...(input.matterId ? { matterId: input.matterId } : {}),
    ...(input.clientContactId ? { clientContactId: input.clientContactId } : {}),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    ...(input.status ? { status: input.status } : {}),
  };
}

export function buildCalendarReminderPayload(input: {
  scope?: CalendarEventRecord["scope"];
  matterId?: string;
  clientContactId?: string;
  remindAt: string;
  status?: CalendarEventReminderRecord["status"];
  note?: string;
}): {
  scope?: CalendarEventRecord["scope"];
  matterId?: string;
  clientContactId?: string;
  remindAt: string;
  channel: "dashboard";
  status?: CalendarEventReminderRecord["status"];
  note?: string;
} {
  return {
    ...(input.scope ? { scope: input.scope } : {}),
    ...(input.matterId ? { matterId: input.matterId } : {}),
    ...(input.clientContactId ? { clientContactId: input.clientContactId } : {}),
    remindAt: input.remindAt,
    channel: "dashboard",
    ...(input.status ? { status: input.status } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
}

export function buildCalendarInvitationPayload(input: {
  matterId: string;
  recipientCount: number;
  includeMeetingLink?: boolean;
}): {
  matterId: string;
  includeMeetingLink?: true;
  deliveryConfirmation: DeliveryConfirmationPayload;
} {
  return {
    matterId: input.matterId,
    ...(input.includeMeetingLink ? { includeMeetingLink: true as const } : {}),
    deliveryConfirmation: buildEmailDeliveryConfirmation(input.recipientCount),
  };
}

export function upsertCalendarEvent(
  eventsByMatterId: Record<string, CalendarEventRecord[]>,
  matterId: string,
  event: CalendarEventRecord,
): Record<string, CalendarEventRecord[]> {
  const existingEvents = eventsByMatterId[matterId] ?? [];
  const exists = existingEvents.some((candidate) => candidate.id === event.id);
  const nextEvents = exists
    ? existingEvents.map((candidate) => (candidate.id === event.id ? event : candidate))
    : [...existingEvents, event];
  return {
    ...eventsByMatterId,
    [matterId]: sortCalendarEvents(nextEvents),
  };
}

export function upsertStandaloneCalendarEvent(
  events: CalendarEventRecord[],
  event: CalendarEventRecord,
): CalendarEventRecord[] {
  const exists = events.some((candidate) => candidate.id === event.id);
  const nextEvents = exists
    ? events.map((candidate) => (candidate.id === event.id ? event : candidate))
    : [...events, event];
  return sortCalendarEvents(nextEvents);
}

export function upsertCalendarCredential(
  credentials: CalendarCredentialSummary[],
  credential: CalendarCredentialSummary,
): CalendarCredentialSummary[] {
  const exists = credentials.some((candidate) => candidate.id === credential.id);
  if (!exists) return [...credentials, credential];
  return credentials.map((candidate) => (candidate.id === credential.id ? credential : candidate));
}

export function upsertCalendarEventReminder(
  eventsByMatterId: Record<string, CalendarEventRecord[]>,
  matterId: string,
  eventId: string,
  reminder: CalendarEventReminderRecord,
): Record<string, CalendarEventRecord[]> {
  return {
    ...eventsByMatterId,
    [matterId]: (eventsByMatterId[matterId] ?? []).map((event) => {
      if (event.id !== eventId) return event;
      const reminders = event.reminders ?? [];
      const exists = reminders.some((candidate) => candidate.id === reminder.id);
      const nextReminders = exists
        ? reminders.map((candidate) => (candidate.id === reminder.id ? reminder : candidate))
        : [...reminders, reminder];
      return {
        ...event,
        reminders: nextReminders
          .filter((candidate) => !candidate.deletedAt)
          .sort((left, right) => {
            const remindAtDifference = Date.parse(left.remindAt) - Date.parse(right.remindAt);
            return remindAtDifference === 0 ? left.id.localeCompare(right.id) : remindAtDifference;
          }),
      };
    }),
  };
}

export function upsertStandaloneCalendarEventReminder(
  events: CalendarEventRecord[],
  eventId: string,
  reminder: CalendarEventReminderRecord,
): CalendarEventRecord[] {
  return events.map((event) => {
    if (event.id !== eventId) return event;
    const reminders = event.reminders ?? [];
    const exists = reminders.some((candidate) => candidate.id === reminder.id);
    const nextReminders = exists
      ? reminders.map((candidate) => (candidate.id === reminder.id ? reminder : candidate))
      : [...reminders, reminder];
    return {
      ...event,
      reminders: nextReminders
        .filter((candidate) => !candidate.deletedAt)
        .sort((left, right) => {
          const remindAtDifference = Date.parse(left.remindAt) - Date.parse(right.remindAt);
          return remindAtDifference === 0 ? left.id.localeCompare(right.id) : remindAtDifference;
        }),
    };
  });
}

export function removeCalendarEventReminder(
  eventsByMatterId: Record<string, CalendarEventRecord[]>,
  matterId: string,
  eventId: string,
  reminderId: string,
): Record<string, CalendarEventRecord[]> {
  return {
    ...eventsByMatterId,
    [matterId]: (eventsByMatterId[matterId] ?? []).map((event) =>
      event.id === eventId
        ? {
            ...event,
            reminders: (event.reminders ?? []).filter((reminder) => reminder.id !== reminderId),
          }
        : event,
    ),
  };
}

export function removeStandaloneCalendarEventReminder(
  events: CalendarEventRecord[],
  eventId: string,
  reminderId: string,
): CalendarEventRecord[] {
  return events.map((event) =>
    event.id === eventId
      ? {
          ...event,
          reminders: (event.reminders ?? []).filter((reminder) => reminder.id !== reminderId),
        }
      : event,
  );
}

export function upsertCalendarEventAttendee(
  eventsByMatterId: Record<string, CalendarEventRecord[]>,
  matterId: string,
  eventId: string,
  attendee: CalendarEventAttendeeRecord,
): Record<string, CalendarEventRecord[]> {
  return {
    ...eventsByMatterId,
    [matterId]: (eventsByMatterId[matterId] ?? []).map((event) => {
      if (event.id !== eventId) return event;
      const attendees = event.attendees ?? [];
      const exists = attendees.some((candidate) => candidate.id === attendee.id);
      const nextAttendees = exists
        ? attendees.map((candidate) => (candidate.id === attendee.id ? attendee : candidate))
        : [...attendees, attendee];
      return {
        ...event,
        attendees: nextAttendees
          .filter((candidate) => !candidate.deletedAt)
          .sort((left, right) => left.email.localeCompare(right.email)),
      };
    }),
  };
}

export function removeCalendarEventAttendee(
  eventsByMatterId: Record<string, CalendarEventRecord[]>,
  matterId: string,
  eventId: string,
  attendeeId: string,
): Record<string, CalendarEventRecord[]> {
  return {
    ...eventsByMatterId,
    [matterId]: (eventsByMatterId[matterId] ?? []).map((event) =>
      event.id === eventId
        ? {
            ...event,
            attendees: (event.attendees ?? []).filter((attendee) => attendee.id !== attendeeId),
          }
        : event,
    ),
  };
}

export async function loadCalendarDashboardData(input: {
  matters: MatterSummary[];
  listStandaloneEvents: () => Promise<CalendarEventsResponse>;
  listEventsForMatter: (matterId: string) => Promise<CalendarEventsResponse>;
  listCredentials: () => Promise<CalendarCredentialSummary[]>;
}): Promise<CalendarDashboardResponse> {
  const [credentials, standaloneResponse, matterResponses] = await Promise.all([
    input.listCredentials(),
    input.listStandaloneEvents(),
    Promise.all(
      input.matters.map(async (matter) => ({
        matterId: matter.id,
        response: await input.listEventsForMatter(matter.id),
      })),
    ),
  ]);
  const eventsByMatterId: Record<string, CalendarEventRecord[]> = {};
  const guestSessionsByEventId: Record<string, CalendarGuestSessionSummary[]> = {};
  const schedulingRequestsByMatterId: CalendarDashboardResponse["schedulingRequestsByMatterId"] =
    {};
  const linksByMatterId: Record<string, CalendarMatterLinks> = {};

  for (const matterResponse of matterResponses) {
    eventsByMatterId[matterResponse.matterId] = matterResponse.response.events;
    schedulingRequestsByMatterId[matterResponse.matterId] = sortCalendarSchedulingRequests(
      matterResponse.response.schedulingRequests ?? [],
    );
    for (const session of matterResponse.response.guestSessions ?? []) {
      guestSessionsByEventId[session.eventId] = sortCalendarGuestSessions([
        ...(guestSessionsByEventId[session.eventId] ?? []),
        session,
      ]);
    }
    linksByMatterId[matterResponse.matterId] = {
      caldavUrl: matterResponse.response.caldavUrl,
      subscriptionUrl: matterResponse.response.subscriptionUrl,
    };
  }

  return {
    eventsByMatterId,
    standaloneEvents: standaloneResponse.events,
    guestSessionsByEventId,
    schedulingRequestsByMatterId,
    linksByMatterId,
    credentials,
  };
}
