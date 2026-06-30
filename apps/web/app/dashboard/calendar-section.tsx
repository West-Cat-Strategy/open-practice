import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Link2,
  Plus,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type { CalendarMeetingLinkMode } from "@open-practice/domain/calendar-models";
import {
  calendarMeetingReadinessItems,
  describeCalendarGuestActionDisabledReason,
  describeCalendarEventHandoff,
  describeCalendarEventTiming,
  describeCalendarGuestSessionStatus,
  describeReviewAgingCue,
  describeReviewAgingDecision,
  describeCalendarSchedulingReviewNextStep,
  describeCalendarSchedulingRequestHandoff,
  describeMeetingInvitationBoundary,
  describeMeetingLinkAvailability,
  sortCalendarGuestSessionGuests,
  sortCalendarSchedulingRequests,
  type CalendarRadarBuckets,
  type CalendarSchedulingAgingReviewDecision,
  type CalendarSchedulingReviewDecision,
} from "../calendar-dashboard";
import { compactDate, compactStatus } from "../_features/dashboard/formatters";
import type {
  CalendarCredentialCreateResponse,
  CalendarDashboardResponse,
  CalendarGuestSessionIssueResponse,
  CalendarGuestSessionSummary,
  CalendarMatterLinks,
} from "../_features/calendar/models";
import { formatCalendarAttendeeRoleLabel } from "../participant-role-labels";
import {
  DeliveryConfirmationPanel,
  OneTimeSecretPanel,
  type PendingDeliveryConfirmation,
} from "./shared-panels";

type DashboardCalendarEvent = CalendarDashboardResponse["eventsByMatterId"][string][number];
type CalendarEventReminder = NonNullable<DashboardCalendarEvent["reminders"]>[number];
type CalendarSchedulingRequest =
  CalendarDashboardResponse["schedulingRequestsByMatterId"][string][number];
type CalendarCredential = CalendarDashboardResponse["credentials"][number];
type CalendarReminderStatus = "pending" | "acknowledged" | "dismissed" | "cancelled";
type CalendarGuestSessionAction = "open" | "lock" | "end";
type CalendarGuestLinkAction = "admit" | "deny" | "revoke";

export interface CalendarSectionProps {
  activeCalendarBuckets: CalendarRadarBuckets;
  activeCalendarEvents: DashboardCalendarEvent[];
  activeCalendarLinks?: CalendarMatterLinks;
  activeCalendarSchedulingRequests: CalendarSchedulingRequest[];
  activeCalendarScope: "matter" | "firm" | "client";
  activeMatterNumber: string;
  appointmentBookingPanel?: ReactNode;
  addingCalendarAttendee: boolean;
  addingCalendarReminder: boolean;
  calendarAttendeeEmail: string;
  calendarAttendeeName: string;
  calendarAttendeeRole: "required" | "optional";
  calendarCredentialLabel: string;
  calendarCredentialStatus: string;
  calendarCredentials: CalendarCredential[];
  calendarEventDescription: string;
  calendarEventEndsAt: string;
  calendarEventLifecycleStatus: string;
  calendarEventLocation: string;
  calendarEventStartsAt: string;
  calendarEventStatusValue: DashboardCalendarEvent["status"];
  calendarEventTitle: string;
  calendarGuestSessionSecret: CalendarGuestSessionIssueResponse | null;
  calendarGuestSessionStatus: string;
  calendarGuestSessionsByEventId: CalendarDashboardResponse["guestSessionsByEventId"];
  calendarMeetingLinkModesByEventId: Record<string, CalendarMeetingLinkMode>;
  calendarMeetingLinkUrlsByEventId: Record<string, string>;
  calendarMeetingStatus: string;
  calendarSchedulingReviewEventIdsByRequestId: Record<string, string>;
  calendarSchedulingReviewStatus: string;
  calendarOneTimeSecret: CalendarCredentialCreateResponse | null;
  calendarReminderAt: string;
  calendarReminderNote: string;
  calendarReminderStatus: string;
  calendarReminderStatusValue: CalendarReminderStatus;
  calendarClientContactId: string;
  calendarClientOptions: Array<{ id: string; label: string }>;
  cancelingCalendarEventId: string;
  creatingCalendarCredential: boolean;
  creatingCalendarEvent: boolean;
  creatingCalendarGuestSessionEventId: string;
  pendingDeliveryConfirmation: PendingDeliveryConfirmation | null;
  removingCalendarAttendeeId: string;
  removingCalendarReminderId: string;
  revokingCalendarCredentialId: string;
  selectedCalendarMeetingEvent?: DashboardCalendarEvent;
  selectedCalendarReminderEvent?: DashboardCalendarEvent;
  sendingCalendarInvitationsEventId: string;
  matterCalendarControlsEnabled: boolean;
  reviewingCalendarSchedulingRequestKey: string;
  updatingCalendarEventId: string;
  updatingCalendarGuestSessionKey: string;
  updatingCalendarMeetingLinkEventId: string;
  updatingCalendarReminderId: string;
  onAddCalendarAttendee: () => void;
  onAddCalendarReminder: () => void;
  onCancelCalendarEvent: (event: DashboardCalendarEvent) => void;
  onCancelPendingDeliveryConfirmation: () => void;
  onConfirmPendingDelivery: () => void;
  onControlCalendarGuestSession: (
    event: DashboardCalendarEvent,
    session: CalendarGuestSessionSummary,
    action: CalendarGuestSessionAction,
  ) => void;
  onCreateCalendarCredential: () => void;
  onCreateCalendarEvent: () => void;
  onCreateCalendarGuestSession: (event: DashboardCalendarEvent) => void;
  onCreateCalendarAgingFollowUpTask: () => void;
  onCreateCalendarSchedulingRequestForReminder: (
    event: DashboardCalendarEvent,
    reminder: CalendarEventReminder,
  ) => void;
  onIssueCalendarGuestLink: (
    event: DashboardCalendarEvent,
    session: CalendarGuestSessionSummary,
  ) => void;
  onOpenCalendarInvitationConfirmation: (
    event: DashboardCalendarEvent,
    options?: { includeMeetingLink?: boolean },
  ) => void;
  onRemoveCalendarAttendee: (eventId: string, attendeeId: string) => void;
  onRemoveCalendarReminder: (eventId: string, reminderId: string) => void;
  onRescheduleCalendarEvent: (event: DashboardCalendarEvent) => void;
  onRevokeCalendarCredential: (credentialId: string) => void;
  onReviewCalendarSchedulingRequest: (
    request: CalendarSchedulingRequest,
    status: CalendarSchedulingReviewDecision,
    calendarEventId?: string,
  ) => void;
  onReviewCalendarSchedulingRequestAgingDecision: (
    request: CalendarSchedulingRequest,
    decision: CalendarSchedulingAgingReviewDecision,
  ) => void;
  onSetCalendarAttendeeEmail: (value: string) => void;
  onSetCalendarAttendeeName: (value: string) => void;
  onSetCalendarAttendeeRole: (value: "required" | "optional") => void;
  onSetCalendarScope: (value: "matter" | "firm" | "client") => void;
  onSetCalendarClientContactId: (value: string) => void;
  onSetCalendarCredentialLabel: (value: string) => void;
  onSetCalendarEventDescription: (value: string) => void;
  onSetCalendarEventEndsAt: (value: string) => void;
  onSetCalendarEventLocation: (value: string) => void;
  onSetCalendarEventStartsAt: (value: string) => void;
  onSetCalendarEventStatusValue: (value: DashboardCalendarEvent["status"]) => void;
  onSetCalendarEventTitle: (value: string) => void;
  onSetCalendarMeetingEventId: (value: string) => void;
  onSetCalendarMeetingLinkMode: (eventId: string, mode: CalendarMeetingLinkMode) => void;
  onSetCalendarMeetingLinkUrl: (eventId: string, url: string) => void;
  onSetCalendarSchedulingReviewEventId: (requestId: string, eventId: string) => void;
  onSetCalendarReminderAt: (value: string) => void;
  onSetCalendarReminderEventId: (value: string) => void;
  onSetCalendarReminderNote: (value: string) => void;
  onSetCalendarReminderStatusValue: (value: CalendarReminderStatus) => void;
  onUpdateCalendarGuestLink: (
    event: DashboardCalendarEvent,
    session: CalendarGuestSessionSummary,
    guestId: string,
    action: CalendarGuestLinkAction,
  ) => void;
  onUpdateCalendarMeetingLink: (
    event: DashboardCalendarEvent,
    mode: CalendarMeetingLinkMode,
    externalUrl: string,
  ) => void;
  onUpdateCalendarReminder: (
    eventId: string,
    reminderId: string,
    status: CalendarReminderStatus,
  ) => void;
}

function calendarMeetingLinkModeValue(
  event: DashboardCalendarEvent,
  valuesByEventId: Record<string, CalendarMeetingLinkMode>,
): CalendarMeetingLinkMode {
  return valuesByEventId[event.id] ?? event.meetingLinkMode ?? "blank";
}

function calendarMeetingLinkUrlValue(
  event: DashboardCalendarEvent,
  valuesByEventId: Record<string, string>,
): string {
  return valuesByEventId[event.id] ?? "";
}

function guestTimestampSummary(guest: CalendarGuestSessionSummary["guests"][number]): string {
  const lifecycle = guest.checkedInAt
    ? `checked in ${compactDate(guest.checkedInAt)}`
    : "not checked in";
  const decision = guest.admittedAt
    ? `admitted ${compactDate(guest.admittedAt)}`
    : guest.deniedAt
      ? `denied ${compactDate(guest.deniedAt)}`
      : guest.revokedAt
        ? `revoked ${compactDate(guest.revokedAt)}`
        : "awaiting staff decision";
  return `${lifecycle} · ${decision} · expires ${compactDate(guest.expiresAt)}`;
}

export function CalendarSection({
  activeCalendarBuckets,
  activeCalendarEvents,
  activeCalendarLinks,
  activeCalendarSchedulingRequests,
  activeCalendarScope,
  activeMatterNumber,
  appointmentBookingPanel,
  addingCalendarAttendee,
  addingCalendarReminder,
  calendarAttendeeEmail,
  calendarAttendeeName,
  calendarAttendeeRole,
  calendarCredentialLabel,
  calendarCredentialStatus,
  calendarCredentials,
  calendarEventDescription,
  calendarEventEndsAt,
  calendarEventLifecycleStatus,
  calendarEventLocation,
  calendarEventStartsAt,
  calendarEventStatusValue,
  calendarEventTitle,
  calendarGuestSessionSecret,
  calendarGuestSessionStatus,
  calendarGuestSessionsByEventId,
  calendarMeetingLinkModesByEventId,
  calendarMeetingLinkUrlsByEventId,
  calendarMeetingStatus,
  calendarSchedulingReviewEventIdsByRequestId,
  calendarSchedulingReviewStatus,
  calendarOneTimeSecret,
  calendarReminderAt,
  calendarReminderNote,
  calendarReminderStatus,
  calendarReminderStatusValue,
  calendarClientContactId,
  calendarClientOptions,
  cancelingCalendarEventId,
  creatingCalendarCredential,
  creatingCalendarEvent,
  creatingCalendarGuestSessionEventId,
  pendingDeliveryConfirmation,
  removingCalendarAttendeeId,
  removingCalendarReminderId,
  revokingCalendarCredentialId,
  selectedCalendarMeetingEvent,
  selectedCalendarReminderEvent,
  sendingCalendarInvitationsEventId,
  matterCalendarControlsEnabled,
  reviewingCalendarSchedulingRequestKey,
  updatingCalendarEventId,
  updatingCalendarGuestSessionKey,
  updatingCalendarMeetingLinkEventId,
  updatingCalendarReminderId,
  onAddCalendarAttendee,
  onAddCalendarReminder,
  onCancelCalendarEvent,
  onCancelPendingDeliveryConfirmation,
  onConfirmPendingDelivery,
  onControlCalendarGuestSession,
  onCreateCalendarCredential,
  onCreateCalendarEvent,
  onCreateCalendarGuestSession,
  onCreateCalendarAgingFollowUpTask,
  onCreateCalendarSchedulingRequestForReminder,
  onIssueCalendarGuestLink,
  onOpenCalendarInvitationConfirmation,
  onRemoveCalendarAttendee,
  onRemoveCalendarReminder,
  onRescheduleCalendarEvent,
  onRevokeCalendarCredential,
  onReviewCalendarSchedulingRequest,
  onReviewCalendarSchedulingRequestAgingDecision,
  onSetCalendarAttendeeEmail,
  onSetCalendarAttendeeName,
  onSetCalendarAttendeeRole,
  onSetCalendarScope,
  onSetCalendarClientContactId,
  onSetCalendarCredentialLabel,
  onSetCalendarEventDescription,
  onSetCalendarEventEndsAt,
  onSetCalendarEventLocation,
  onSetCalendarEventStartsAt,
  onSetCalendarEventStatusValue,
  onSetCalendarEventTitle,
  onSetCalendarMeetingEventId,
  onSetCalendarMeetingLinkMode,
  onSetCalendarMeetingLinkUrl,
  onSetCalendarSchedulingReviewEventId,
  onSetCalendarReminderAt,
  onSetCalendarReminderEventId,
  onSetCalendarReminderNote,
  onSetCalendarReminderStatusValue,
  onUpdateCalendarGuestLink,
  onUpdateCalendarMeetingLink,
  onUpdateCalendarReminder,
}: CalendarSectionProps) {
  const openReminderReviewKeys = new Set(
    activeCalendarSchedulingRequests
      .filter((request) => request.status === "needs_review" && request.linkedReminderId)
      .map((request) => `${request.linkedEvent?.id ?? ""}:${request.linkedReminderId}`),
  );
  const agingSchedulingRequestCount = activeCalendarSchedulingRequests.filter(
    (request) => request.reviewAging?.status === "aging",
  ).length;
  const staleSchedulingRequestCount = activeCalendarSchedulingRequests.filter(
    (request) => request.reviewAging?.status === "stale",
  ).length;
  const schedulingAgingSummary =
    agingSchedulingRequestCount || staleSchedulingRequestCount
      ? `${staleSchedulingRequestCount} stale · ${agingSchedulingRequestCount} aging`
      : "no aging cues";

  return (
    <>
      <div className="detail-grid">
        <div>
          <span className="field-label">Upcoming</span>
          <strong>
            {activeCalendarBuckets.nextSevenDays.length +
              activeCalendarBuckets.nextThirtyDays.length}
          </strong>
        </div>
        <div>
          <span className="field-label">Overdue</span>
          <strong>{activeCalendarBuckets.overdue.length}</strong>
        </div>
        <div>
          <span className="field-label">Tentative</span>
          <strong>{activeCalendarBuckets.tentative.length}</strong>
        </div>
        <div>
          <span className="field-label">Scheduling reviews</span>
          <strong>{activeCalendarSchedulingRequests.length}</strong>
          <small>{schedulingAgingSummary}</small>
        </div>
        <div>
          <span className="field-label">Cancelled</span>
          <strong>{activeCalendarBuckets.cancelled.length}</strong>
        </div>
      </div>

      <div className="share-controls calendar-scope-controls">
        <div className="section-title">
          <h3>Calendar scope</h3>
          <span>{activeMatterNumber}</span>
        </div>
        <div className="calendar-attendee-form calendar-event-form">
          <label className="search-field">
            <span>Scope</span>
            <select
              onChange={(event) =>
                onSetCalendarScope(event.currentTarget.value as "matter" | "firm" | "client")
              }
              value={activeCalendarScope}
            >
              <option disabled={!matterCalendarControlsEnabled} value="matter">
                Matter
              </option>
              <option value="firm">Firm</option>
              <option value="client">Client</option>
            </select>
          </label>
          {activeCalendarScope === "client" ? (
            <label className="search-field">
              <span>Client</span>
              <select
                disabled={calendarClientOptions.length === 0}
                onChange={(event) => onSetCalendarClientContactId(event.currentTarget.value)}
                value={calendarClientContactId}
              >
                {calendarClientOptions.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {!matterCalendarControlsEnabled ? (
          <p className="inline-empty">
            Meeting links, invitations, guest sessions, public links, feeds, and email delivery are
            available after selecting a matter.
          </p>
        ) : null}
      </div>

      {appointmentBookingPanel}

      <div className="section-title">
        <h3>Deadline radar</h3>
        <span>{activeCalendarEvents.length} event records</span>
      </div>
      <div className="activity-grid calendar-radar-grid">
        <div className="activity-card calendar-radar-card">
          <AlertTriangle size={18} />
          <strong>{activeCalendarBuckets.overdue.length} overdue</strong>
          <span>operator-entered event dates before now</span>
        </div>
        <div className="activity-card calendar-radar-card">
          <Clock3 size={18} />
          <strong>{activeCalendarBuckets.nextSevenDays.length} next 7 days</strong>
          <span>active events starting soon</span>
        </div>
        <div className="activity-card calendar-radar-card">
          <CalendarDays size={18} />
          <strong>{activeCalendarBuckets.nextThirtyDays.length} next 30 days</strong>
          <span>remaining active near-term events</span>
        </div>
      </div>

      <div className="section-title">
        <h3>Scheduling requests</h3>
        <span>{activeCalendarSchedulingRequests.length} review records</span>
      </div>
      {matterCalendarControlsEnabled ? (
        <div className="calendar-meeting-link-form">
          <button
            aria-label="Create calendar aging follow-up task"
            className="secondary-button compact-button row-button"
            disabled={reviewingCalendarSchedulingRequestKey === "calendar-aging-follow-up-task"}
            onClick={onCreateCalendarAgingFollowUpTask}
            type="button"
          >
            <Plus size={15} />
            Create follow-up task
          </button>
        </div>
      ) : null}
      <div className="party-list">
        {sortCalendarSchedulingRequests(activeCalendarSchedulingRequests).map((request) => {
          const handoff = describeCalendarSchedulingRequestHandoff(request);
          const eligibleEvents = matterCalendarControlsEnabled
            ? activeCalendarEvents.filter(
                (event) => event.matterId === request.matterId && event.status !== "cancelled",
              )
            : [];
          const linkedEventId =
            request.linkedEvent &&
            eligibleEvents.some((event) => event.id === request.linkedEvent?.id)
              ? request.linkedEvent.id
              : "";
          const selectedReviewEventId =
            calendarSchedulingReviewEventIdsByRequestId[request.id] ?? linkedEventId;
          const reviewNextStep = describeCalendarSchedulingReviewNextStep({
            request,
            matterCalendarControlsEnabled,
            eligibleEventCount: eligibleEvents.length,
            selectedEventId: selectedReviewEventId,
          });
          const agingCue = describeReviewAgingCue(request.reviewAging);
          const agingDecision = describeReviewAgingDecision(request.reviewAgingDecision);
          const agingDecisionAvailable =
            request.status === "needs_review" &&
            (request.reviewAging?.status === "aging" || request.reviewAging?.status === "stale");
          const busyPrefix = `${request.id}:`;
          const reviewBusy = reviewingCalendarSchedulingRequestKey.startsWith(busyPrefix);
          return (
            <div className="party-row" key={request.id}>
              <span>
                <strong>
                  {request.title} · {compactStatus(request.status)}
                </strong>
                <small>
                  {compactStatus(request.kind)} · source {request.source.label} · due{" "}
                  {compactDate(request.requestedDueAt)} · event{" "}
                  {request.linkedEvent
                    ? `${request.linkedEvent.title} (${compactDate(request.linkedEvent.startsAt)})`
                    : "needs scheduling"}
                </small>
                <small>
                  reminder {compactStatus(request.reminderSummary.posture)} · privacy{" "}
                  {compactStatus(request.privacy.visibility)} · time{" "}
                  {request.timeCaptureCue.redacted
                    ? "restricted"
                    : `${request.timeCaptureCue.posture.replace(/_/g, " ")}${
                        request.timeCaptureCue.suggestedMinutes
                          ? ` (${request.timeCaptureCue.suggestedMinutes}m)`
                          : ""
                      }`}
                </small>
                <small>{handoff.detail}</small>
                {agingCue ? (
                  <small>
                    {agingCue.label}: {agingCue.detail}
                  </small>
                ) : null}
                {agingDecision ? (
                  <small>
                    {agingDecision.label}: {agingDecision.detail}
                  </small>
                ) : null}
                <small>
                  {reviewNextStep.label}: {reviewNextStep.detail}
                </small>
                {matterCalendarControlsEnabled && request.status === "needs_review" ? (
                  <div className="calendar-meeting-link-form">
                    {agingDecisionAvailable ? (
                      <>
                        <button
                          aria-label="Acknowledge scheduling request aging review"
                          className="secondary-button compact-button row-button"
                          disabled={reviewBusy}
                          onClick={() =>
                            onReviewCalendarSchedulingRequestAgingDecision(request, "acknowledged")
                          }
                          type="button"
                        >
                          <CheckCircle2 size={15} />
                          Acknowledge
                        </button>
                        <button
                          aria-label="Mark scheduling request follow-up required"
                          className="secondary-button compact-button row-button"
                          disabled={reviewBusy}
                          onClick={() =>
                            onReviewCalendarSchedulingRequestAgingDecision(
                              request,
                              "follow_up_required",
                            )
                          }
                          type="button"
                        >
                          <Bell size={15} />
                          Follow up
                        </button>
                        <button
                          aria-label="Defer scheduling request aging review"
                          className="secondary-button compact-button row-button"
                          disabled={reviewBusy}
                          onClick={() =>
                            onReviewCalendarSchedulingRequestAgingDecision(request, "defer_review")
                          }
                          type="button"
                        >
                          <Clock3 size={15} />
                          Defer
                        </button>
                      </>
                    ) : null}
                    <label>
                      <span className="field-label">Existing event</span>
                      <select
                        disabled={reviewBusy || eligibleEvents.length === 0}
                        onChange={(event) =>
                          onSetCalendarSchedulingReviewEventId(
                            request.id,
                            event.currentTarget.value,
                          )
                        }
                        value={selectedReviewEventId}
                      >
                        <option disabled value="">
                          Select event
                        </option>
                        {eligibleEvents.map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.title} · {compactDate(event.startsAt)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      aria-label={`Mark scheduling request reviewed: ${reviewNextStep.detail}`}
                      className="secondary-button compact-button row-button"
                      disabled={reviewBusy || !reviewNextStep.canMarkReviewed}
                      onClick={() => onReviewCalendarSchedulingRequest(request, "reviewed")}
                      title={reviewNextStep.detail}
                      type="button"
                    >
                      Reviewed
                    </button>
                    <button
                      aria-label={`Dismiss scheduling request: ${reviewNextStep.detail}`}
                      className="secondary-button compact-button row-button"
                      disabled={reviewBusy || !reviewNextStep.canDismiss}
                      onClick={() => onReviewCalendarSchedulingRequest(request, "dismissed")}
                      title={reviewNextStep.detail}
                      type="button"
                    >
                      Dismiss
                    </button>
                    <button
                      aria-label={`Link scheduling request to an existing event: ${
                        reviewNextStep.linkEventDisabledReason ?? reviewNextStep.detail
                      }`}
                      className="secondary-button compact-button row-button"
                      disabled={reviewBusy || !reviewNextStep.canLinkEvent}
                      onClick={() =>
                        onReviewCalendarSchedulingRequest(
                          request,
                          "scheduled",
                          selectedReviewEventId,
                        )
                      }
                      title={reviewNextStep.linkEventDisabledReason ?? reviewNextStep.detail}
                      type="button"
                    >
                      Link event
                    </button>
                  </div>
                ) : null}
              </span>
              <em className={handoff.tone === "risk" ? "risk" : undefined}>{handoff.label}</em>
            </div>
          );
        })}
        {activeCalendarSchedulingRequests.length === 0 ? (
          <p className="inline-empty">
            {matterCalendarControlsEnabled
              ? "No scheduling request records for this matter."
              : "Scheduling request review is available after selecting a matter."}
          </p>
        ) : null}
      </div>
      <p className="inline-empty" role="status">
        {calendarSchedulingReviewStatus}
      </p>

      <div className="share-controls calendar-event-controls">
        <div className="section-title">
          <h3>Event lifecycle</h3>
          <span>Create or reschedule one event</span>
        </div>
        <div className="calendar-attendee-form calendar-reminder-form">
          <label className="search-field">
            <span>Title</span>
            <input
              disabled={!matterCalendarControlsEnabled}
              onChange={(event) => onSetCalendarEventTitle(event.target.value)}
              value={calendarEventTitle}
            />
          </label>
          <label className="search-field">
            <span>Starts</span>
            <input
              disabled={!matterCalendarControlsEnabled}
              onChange={(event) => onSetCalendarEventStartsAt(event.target.value)}
              type="datetime-local"
              value={calendarEventStartsAt}
            />
          </label>
          <label className="search-field">
            <span>Ends</span>
            <input
              disabled={!matterCalendarControlsEnabled}
              onChange={(event) => onSetCalendarEventEndsAt(event.target.value)}
              type="datetime-local"
              value={calendarEventEndsAt}
            />
          </label>
          <label className="search-field">
            <span>Status</span>
            <select
              disabled={!matterCalendarControlsEnabled}
              onChange={(event) =>
                onSetCalendarEventStatusValue(
                  event.target.value as DashboardCalendarEvent["status"],
                )
              }
              value={calendarEventStatusValue}
            >
              <option value="confirmed">Confirmed</option>
              <option value="tentative">Tentative</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="search-field">
            <span>Location</span>
            <input
              disabled={!matterCalendarControlsEnabled}
              onChange={(event) => onSetCalendarEventLocation(event.target.value)}
              value={calendarEventLocation}
            />
          </label>
          <label className="search-field">
            <span>Description</span>
            <input
              disabled={!matterCalendarControlsEnabled}
              onChange={(event) => onSetCalendarEventDescription(event.target.value)}
              value={calendarEventDescription}
            />
          </label>
          <button
            className="secondary-button compact-button"
            disabled={
              !matterCalendarControlsEnabled ||
              creatingCalendarEvent ||
              !calendarEventTitle.trim() ||
              !calendarEventStartsAt ||
              !calendarEventEndsAt
            }
            onClick={() => void onCreateCalendarEvent()}
            title={
              matterCalendarControlsEnabled
                ? "Create event"
                : "Matter required before changing calendar events."
            }
            type="button"
          >
            <Plus size={16} />
            {creatingCalendarEvent ? "Creating..." : "Create event"}
          </button>
        </div>
        {!matterCalendarControlsEnabled ? (
          <p className="inline-empty">
            Matter required: event lifecycle actions are disabled in matterless calendar views.
          </p>
        ) : null}
        <p className="inline-empty" role="status">
          {calendarEventLifecycleStatus}
        </p>
      </div>

      <div className="section-title">
        <h3>Calendar events</h3>
        <span>{activeMatterNumber}</span>
      </div>
      <div className="party-list">
        {activeCalendarEvents.map((event) => {
          const timing = describeCalendarEventTiming(event);
          const attendees = event.attendees ?? [];
          const meetingLinkAvailability = describeMeetingLinkAvailability(event);
          const meetingLinkMode = calendarMeetingLinkModeValue(
            event,
            calendarMeetingLinkModesByEventId,
          );
          const meetingLinkUrl = calendarMeetingLinkUrlValue(
            event,
            calendarMeetingLinkUrlsByEventId,
          );
          const hostedMeetingConfigured =
            event.meetingInvitationBoundary?.meetingLinks.status === "configured";
          const canSaveMeetingLink =
            meetingLinkMode === "blank" ||
            (meetingLinkMode === "external_url" && Boolean(meetingLinkUrl.trim())) ||
            (meetingLinkMode === "hosted_webrtc" && hostedMeetingConfigured);
          const guestSessions = calendarGuestSessionsByEventId[event.id] ?? [];
          const eventHandoff = describeCalendarEventHandoff(event);
          const readinessItems = calendarMeetingReadinessItems(event, guestSessions);
          const guestAccessConfigured =
            event.meetingInvitationBoundary?.guestAccess.status === "configured";
          const hostedGuestSessionReady =
            event.status !== "cancelled" &&
            event.meetingLinkMode === "hosted_webrtc" &&
            Boolean(event.meetingRoomId) &&
            guestAccessConfigured;
          return (
            <div className="party-row calendar-event-row" key={event.id}>
              <div className="calendar-event-summary">
                <span>
                  <strong>{event.title}</strong>
                  <small>
                    {compactDate(event.startsAt)} to {compactDate(event.endsAt)}
                    {event.location ? ` · ${event.location}` : ""}
                  </small>
                  <small>
                    {describeMeetingInvitationBoundary(event.meetingInvitationBoundary)}
                  </small>
                  {matterCalendarControlsEnabled ? <small>{eventHandoff.detail}</small> : null}
                </span>
                <div className="row-actions">
                  <em
                    className={
                      event.status === "cancelled" || timing === "overdue" ? "risk" : undefined
                    }
                  >
                    {event.status === "cancelled" ? "cancelled" : timing}
                  </em>
                  {matterCalendarControlsEnabled ? (
                    <button
                      aria-label={meetingLinkAvailability.detail}
                      className={`secondary-button compact-button row-button calendar-meeting-link-status ${meetingLinkAvailability.status}`}
                      disabled={
                        !meetingLinkAvailability.actionable ||
                        attendees.length === 0 ||
                        sendingCalendarInvitationsEventId === event.id
                      }
                      onClick={() =>
                        onOpenCalendarInvitationConfirmation(event, { includeMeetingLink: true })
                      }
                      title={meetingLinkAvailability.detail}
                      type="button"
                    >
                      <Link2 size={14} />
                      {sendingCalendarInvitationsEventId === event.id
                        ? "Sending..."
                        : meetingLinkAvailability.label}
                    </button>
                  ) : null}
                  <button
                    className="secondary-button compact-button row-button"
                    disabled={
                      !matterCalendarControlsEnabled ||
                      updatingCalendarEventId === event.id ||
                      !calendarEventStartsAt ||
                      !calendarEventEndsAt
                    }
                    onClick={() => void onRescheduleCalendarEvent(event)}
                    title={
                      matterCalendarControlsEnabled
                        ? "Reschedule event"
                        : "Matter required before changing calendar events."
                    }
                    type="button"
                  >
                    {updatingCalendarEventId === event.id ? "Rescheduling..." : "Reschedule"}
                  </button>
                  <button
                    className="secondary-button compact-button row-button"
                    disabled={
                      !matterCalendarControlsEnabled ||
                      event.status === "cancelled" ||
                      cancelingCalendarEventId === event.id
                    }
                    onClick={() => void onCancelCalendarEvent(event)}
                    title={
                      matterCalendarControlsEnabled
                        ? "Cancel event"
                        : "Matter required before changing calendar events."
                    }
                    type="button"
                  >
                    {cancelingCalendarEventId === event.id ? "Cancelling..." : "Cancel"}
                  </button>
                  {matterCalendarControlsEnabled ? (
                    <button
                      className="secondary-button compact-button row-button"
                      disabled={
                        attendees.length === 0 || sendingCalendarInvitationsEventId === event.id
                      }
                      onClick={() => onOpenCalendarInvitationConfirmation(event)}
                      type="button"
                    >
                      {sendingCalendarInvitationsEventId === event.id
                        ? "Sending..."
                        : "Send invites"}
                    </button>
                  ) : null}
                </div>
              </div>
              {matterCalendarControlsEnabled ? (
                <div className="calendar-meeting-link-form">
                  <label>
                    <span className="field-label">Meeting link</span>
                    <select
                      value={meetingLinkMode}
                      onChange={(changeEvent) =>
                        onSetCalendarMeetingLinkMode(
                          event.id,
                          changeEvent.currentTarget.value as CalendarMeetingLinkMode,
                        )
                      }
                    >
                      <option value="blank">Blank</option>
                      <option value="external_url">Other link</option>
                      <option disabled={!hostedMeetingConfigured} value="hosted_webrtc">
                        Hosted WebRTC
                      </option>
                    </select>
                  </label>
                  {meetingLinkMode === "external_url" ? (
                    <label>
                      <span className="field-label">URL</span>
                      <input
                        type="url"
                        value={meetingLinkUrl}
                        onChange={(inputEvent) =>
                          onSetCalendarMeetingLinkUrl(event.id, inputEvent.currentTarget.value)
                        }
                        placeholder="Paste HTTPS meeting link"
                      />
                    </label>
                  ) : null}
                  {meetingLinkMode === "hosted_webrtc" && !hostedMeetingConfigured ? (
                    <p className="inline-empty">Hosted WebRTC meetings are not configured.</p>
                  ) : null}
                  {event.meetingLinkUrl ? (
                    <p className="inline-empty">Stored meeting link saved; URL hidden.</p>
                  ) : null}
                  <button
                    className="secondary-button compact-button row-button"
                    disabled={
                      updatingCalendarMeetingLinkEventId === event.id || !canSaveMeetingLink
                    }
                    onClick={() =>
                      onUpdateCalendarMeetingLink(event, meetingLinkMode, meetingLinkUrl)
                    }
                    type="button"
                  >
                    {updatingCalendarMeetingLinkEventId === event.id ? "Saving..." : "Save link"}
                  </button>
                </div>
              ) : null}
              {matterCalendarControlsEnabled ? (
                <div className="calendar-attendee-list" aria-label={`${event.title} readiness`}>
                  {readinessItems.map((item) => (
                    <div className="calendar-attendee-row" key={item.id}>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <em className={item.status === "ready" ? undefined : "risk"}>
                        {item.status}
                      </em>
                    </div>
                  ))}
                </div>
              ) : null}
              {matterCalendarControlsEnabled && event.meetingLinkMode === "hosted_webrtc" ? (
                <div className="calendar-guest-session-panel">
                  <div className="section-title compact-section-title">
                    <h4>Guest lobby</h4>
                    <span>{guestSessions.length} session records</span>
                  </div>
                  {!guestAccessConfigured ? (
                    <p className="inline-empty">Guest access tokens are disabled.</p>
                  ) : null}
                  {guestAccessConfigured && event.status === "cancelled" ? (
                    <p className="inline-empty">Cancelled events cannot host a lobby.</p>
                  ) : null}
                  {guestAccessConfigured && !event.meetingRoomId ? (
                    <p className="inline-empty">Save a hosted meeting link first.</p>
                  ) : null}
                  {guestSessions.map((session) => (
                    <div className="calendar-guest-session-row" key={session.id}>
                      <span>
                        <strong>{describeCalendarGuestSessionStatus(session)}</strong>
                        <small>
                          {session.issuedCount} issued · {session.waitingCount} waiting ·{" "}
                          {session.admittedCount} admitted
                        </small>
                      </span>
                      <div className="row-actions">
                        <button
                          className="secondary-button compact-button row-button"
                          disabled={
                            !hostedGuestSessionReady ||
                            session.status === "open" ||
                            session.status === "ended" ||
                            updatingCalendarGuestSessionKey === `${session.id}:open`
                          }
                          onClick={() => void onControlCalendarGuestSession(event, session, "open")}
                          type="button"
                        >
                          Open
                        </button>
                        <button
                          className="secondary-button compact-button row-button"
                          disabled={
                            !hostedGuestSessionReady ||
                            session.status === "locked" ||
                            session.status === "ended" ||
                            updatingCalendarGuestSessionKey === `${session.id}:lock`
                          }
                          onClick={() => void onControlCalendarGuestSession(event, session, "lock")}
                          type="button"
                        >
                          Lock
                        </button>
                        <button
                          className="secondary-button compact-button row-button"
                          disabled={
                            !hostedGuestSessionReady ||
                            session.status === "ended" ||
                            updatingCalendarGuestSessionKey === `${session.id}:end`
                          }
                          onClick={() => void onControlCalendarGuestSession(event, session, "end")}
                          type="button"
                        >
                          End
                        </button>
                        <button
                          className="secondary-button compact-button row-button"
                          disabled={
                            !hostedGuestSessionReady ||
                            session.status === "ended" ||
                            updatingCalendarGuestSessionKey === `${session.id}:issue`
                          }
                          onClick={() => void onIssueCalendarGuestLink(event, session)}
                          type="button"
                        >
                          Issue
                        </button>
                      </div>
                      {session.guests.length ? (
                        <div className="calendar-guest-link-list">
                          {sortCalendarGuestSessionGuests(session.guests).map((guest) => {
                            const disabledReason = describeCalendarGuestActionDisabledReason(
                              session,
                              guest,
                            );
                            const admitDisabledReason =
                              disabledReason ??
                              (guest.status !== "waiting"
                                ? "Guest must check in before admission."
                                : undefined);
                            const guestActionsDisabled = Boolean(disabledReason);
                            return (
                              <div className="calendar-attendee-row" key={guest.id}>
                                <span>
                                  <strong>Guest access</strong>
                                  <small>
                                    {guest.status.replace("_", " ")} ·{" "}
                                    {guestTimestampSummary(guest)}
                                  </small>
                                  {disabledReason ? (
                                    <small>Actions disabled: {disabledReason}</small>
                                  ) : null}
                                </span>
                                <div className="row-actions">
                                  <button
                                    aria-label={`Admit guest access${
                                      admitDisabledReason
                                        ? ` unavailable: ${admitDisabledReason}`
                                        : ""
                                    }`}
                                    className="secondary-button compact-button row-button"
                                    disabled={
                                      Boolean(admitDisabledReason) ||
                                      updatingCalendarGuestSessionKey === `${guest.id}:admit`
                                    }
                                    onClick={() =>
                                      void onUpdateCalendarGuestLink(
                                        event,
                                        session,
                                        guest.id,
                                        "admit",
                                      )
                                    }
                                    title={admitDisabledReason ?? "Admit guest access"}
                                    type="button"
                                  >
                                    Admit
                                  </button>
                                  <button
                                    aria-label={`Deny guest access${
                                      disabledReason ? ` unavailable: ${disabledReason}` : ""
                                    }`}
                                    className="secondary-button compact-button row-button"
                                    disabled={
                                      guestActionsDisabled ||
                                      updatingCalendarGuestSessionKey === `${guest.id}:deny`
                                    }
                                    onClick={() =>
                                      void onUpdateCalendarGuestLink(
                                        event,
                                        session,
                                        guest.id,
                                        "deny",
                                      )
                                    }
                                    title={disabledReason ?? "Deny guest access"}
                                    type="button"
                                  >
                                    Deny
                                  </button>
                                  <button
                                    aria-label={`Revoke guest access${
                                      disabledReason ? ` unavailable: ${disabledReason}` : ""
                                    }`}
                                    className="icon-button"
                                    disabled={
                                      guestActionsDisabled ||
                                      updatingCalendarGuestSessionKey === `${guest.id}:revoke`
                                    }
                                    onClick={() =>
                                      void onUpdateCalendarGuestLink(
                                        event,
                                        session,
                                        guest.id,
                                        "revoke",
                                      )
                                    }
                                    title={disabledReason ?? "Revoke guest access"}
                                    type="button"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {hostedGuestSessionReady && guestSessions.length === 0 ? (
                    <button
                      className="secondary-button compact-button row-button"
                      disabled={creatingCalendarGuestSessionEventId === event.id}
                      onClick={() => void onCreateCalendarGuestSession(event)}
                      type="button"
                    >
                      <Plus size={16} />
                      {creatingCalendarGuestSessionEventId === event.id
                        ? "Creating..."
                        : "Create lobby"}
                    </button>
                  ) : null}
                  {calendarGuestSessionSecret?.session.eventId === event.id ? (
                    <OneTimeSecretPanel
                      className="calendar-secret"
                      items={[
                        {
                          label: "Guest status page",
                          value: calendarGuestSessionSecret.portalUrl,
                        },
                        {
                          label: "One-time token",
                          value: calendarGuestSessionSecret.token,
                        },
                      ]}
                    />
                  ) : null}
                </div>
              ) : null}
              {matterCalendarControlsEnabled &&
              pendingDeliveryConfirmation?.kind === "calendar-invitations" &&
              pendingDeliveryConfirmation.eventId === event.id ? (
                <DeliveryConfirmationPanel
                  busy={sendingCalendarInvitationsEventId === event.id}
                  confirmation={pendingDeliveryConfirmation}
                  onCancel={onCancelPendingDeliveryConfirmation}
                  onConfirm={onConfirmPendingDelivery}
                />
              ) : null}
              <div className="calendar-attendee-list">
                {(event.reminders ?? []).map((reminder) => {
                  const reviewBusy =
                    reviewingCalendarSchedulingRequestKey ===
                    `reminder:${reminder.id}:scheduling-request`;
                  const reviewRequested = openReminderReviewKeys.has(`${event.id}:${reminder.id}`);
                  const requestReviewDisabled =
                    !matterCalendarControlsEnabled ||
                    !event.matterId ||
                    reminder.status !== "pending" ||
                    reviewRequested ||
                    reviewBusy;
                  const requestReviewTitle =
                    !matterCalendarControlsEnabled || !event.matterId
                      ? "Matter required before requesting reminder review."
                      : reminder.status !== "pending"
                        ? "Only pending reminders can be sent for review."
                        : reviewRequested
                          ? "An open review request already exists for this reminder."
                          : "Create reminder review request.";
                  return (
                    <div className="calendar-attendee-row" key={reminder.id}>
                      <span>
                        <strong>{compactDate(reminder.remindAt)}</strong>
                        <small>
                          {reminder.channel} · {reminder.status.replace("_", " ")}
                          {reminder.note ? ` · ${reminder.note}` : ""}
                        </small>
                      </span>
                      <div className="row-actions">
                        <button
                          className="secondary-button compact-button row-button"
                          disabled={requestReviewDisabled}
                          onClick={() =>
                            onCreateCalendarSchedulingRequestForReminder(event, reminder)
                          }
                          title={requestReviewTitle}
                          type="button"
                        >
                          {reviewBusy
                            ? "Requesting..."
                            : reviewRequested
                              ? "Review requested"
                              : "Request review"}
                        </button>
                        <button
                          className="secondary-button compact-button row-button"
                          disabled={
                            !matterCalendarControlsEnabled ||
                            updatingCalendarReminderId === reminder.id
                          }
                          onClick={() =>
                            void onUpdateCalendarReminder(event.id, reminder.id, "acknowledged")
                          }
                          title={
                            matterCalendarControlsEnabled
                              ? "Acknowledge reminder"
                              : "Matter required before changing reminders."
                          }
                          type="button"
                        >
                          Acknowledge
                        </button>
                        <button
                          aria-label={`Remove reminder ${reminder.id}`}
                          className="icon-button"
                          disabled={
                            !matterCalendarControlsEnabled ||
                            removingCalendarReminderId === reminder.id
                          }
                          onClick={() => void onRemoveCalendarReminder(event.id, reminder.id)}
                          title={
                            matterCalendarControlsEnabled
                              ? "Remove reminder"
                              : "Matter required before changing reminders."
                          }
                          type="button"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {(event.reminders ?? []).length === 0 ? (
                  <p className="inline-empty">No reminders are linked to this event.</p>
                ) : null}
              </div>
              {matterCalendarControlsEnabled ? (
                <div className="calendar-attendee-list">
                  {attendees.map((attendee) => (
                    <div className="calendar-attendee-row" key={attendee.id}>
                      <span>
                        <strong>{attendee.name}</strong>
                        <small>
                          {attendee.email} · {formatCalendarAttendeeRoleLabel(attendee.role)} ·{" "}
                          {attendee.responseStatus.replace("_", " ")}
                        </small>
                      </span>
                      <div className="row-actions">
                        <em
                          className={attendee.invitationStatus === "skipped" ? "risk" : undefined}
                        >
                          {attendee.invitationStatus.replace("_", " ")}
                        </em>
                        <button
                          aria-label={`Remove ${attendee.name}`}
                          className="icon-button"
                          disabled={removingCalendarAttendeeId === attendee.id}
                          onClick={() => void onRemoveCalendarAttendee(event.id, attendee.id)}
                          title="Remove attendee"
                          type="button"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {attendees.length === 0 ? (
                    <p className="inline-empty">No attendees are linked to this event.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {activeCalendarEvents.length === 0 ? (
          <p className="inline-empty">No calendar events are linked to this scope.</p>
        ) : null}
      </div>

      <div className="share-controls calendar-reminder-controls">
        <div className="section-title">
          <h3>Reminder state</h3>
          <span>{selectedCalendarReminderEvent?.title ?? "No event selected"}</span>
        </div>
        <div className="calendar-attendee-form">
          <label className="search-field">
            <span>Event</span>
            <select
              disabled={!matterCalendarControlsEnabled}
              onChange={(event) => onSetCalendarReminderEventId(event.target.value)}
              value={selectedCalendarReminderEvent?.id ?? ""}
            >
              {activeCalendarEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          <label className="search-field">
            <span>Remind at</span>
            <input
              disabled={!matterCalendarControlsEnabled}
              onChange={(event) => onSetCalendarReminderAt(event.target.value)}
              type="datetime-local"
              value={calendarReminderAt}
            />
          </label>
          <label className="search-field">
            <span>Status</span>
            <select
              disabled={!matterCalendarControlsEnabled}
              onChange={(event) =>
                onSetCalendarReminderStatusValue(event.target.value as CalendarReminderStatus)
              }
              value={calendarReminderStatusValue}
            >
              <option value="pending">Pending</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="dismissed">Dismissed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="search-field">
            <span>Note</span>
            <input
              disabled={!matterCalendarControlsEnabled}
              onChange={(event) => onSetCalendarReminderNote(event.target.value)}
              value={calendarReminderNote}
            />
          </label>
          <button
            className="secondary-button compact-button"
            disabled={
              !matterCalendarControlsEnabled ||
              !selectedCalendarReminderEvent ||
              !calendarReminderAt ||
              addingCalendarReminder
            }
            onClick={() => void onAddCalendarReminder()}
            title={
              matterCalendarControlsEnabled
                ? "Add reminder"
                : "Matter required before changing reminders."
            }
            type="button"
          >
            <Plus size={16} />
            {addingCalendarReminder ? "Adding..." : "Add reminder"}
          </button>
        </div>
        {!matterCalendarControlsEnabled ? (
          <p className="inline-empty">
            Matter required: reminder actions are disabled in matterless calendar views.
          </p>
        ) : null}
        <p className="inline-empty" role="status">
          {calendarReminderStatus}
        </p>
      </div>

      {matterCalendarControlsEnabled ? (
        <div className="share-controls calendar-meeting-controls">
          <div className="section-title">
            <h3>Meeting attendees</h3>
            <span>{selectedCalendarMeetingEvent?.title ?? "No event selected"}</span>
          </div>
          <div className="calendar-attendee-form">
            <label className="search-field">
              <span>Event</span>
              <select
                onChange={(event) => onSetCalendarMeetingEventId(event.target.value)}
                value={selectedCalendarMeetingEvent?.id ?? ""}
              >
                {activeCalendarEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="search-field">
              <span>Name</span>
              <input
                onChange={(event) => onSetCalendarAttendeeName(event.target.value)}
                value={calendarAttendeeName}
              />
            </label>
            <label className="search-field">
              <span>Email</span>
              <input
                onChange={(event) => onSetCalendarAttendeeEmail(event.target.value)}
                type="email"
                value={calendarAttendeeEmail}
              />
            </label>
            <label className="search-field">
              <span>Role</span>
              <select
                onChange={(event) =>
                  onSetCalendarAttendeeRole(event.target.value as "required" | "optional")
                }
                value={calendarAttendeeRole}
              >
                <option value="required">Required</option>
                <option value="optional">Optional</option>
              </select>
            </label>
            <button
              className="secondary-button compact-button"
              disabled={
                !selectedCalendarMeetingEvent ||
                !calendarAttendeeName.trim() ||
                !calendarAttendeeEmail.trim() ||
                addingCalendarAttendee
              }
              onClick={() => void onAddCalendarAttendee()}
              type="button"
            >
              <Plus size={16} />
              {addingCalendarAttendee ? "Adding..." : "Add attendee"}
            </button>
          </div>
          <p className="inline-empty" role="status">
            {calendarMeetingStatus}
          </p>
          <p className="inline-empty" role="status">
            {calendarGuestSessionStatus}
          </p>
        </div>
      ) : null}

      {matterCalendarControlsEnabled ? (
        <>
          <div className="section-title">
            <h3>Calendar sync</h3>
            <span>CalDAV / iCalendar</span>
          </div>
          <div className="upload-token calendar-sync-links">
            <span>Subscription URL</span>
            <code>{activeCalendarLinks?.subscriptionUrl ?? "Unavailable"}</code>
            <span>CalDAV URL</span>
            <code>{activeCalendarLinks?.caldavUrl ?? "Unavailable"}</code>
          </div>
        </>
      ) : null}

      <div className="share-controls">
        <div className="section-title">
          <h3>App passwords</h3>
          <span>
            {calendarCredentials.filter((credential) => !credential.revokedAt).length} active
          </span>
        </div>
        <div className="share-form-row calendar-credential-form">
          <label className="search-field">
            <span>Label</span>
            <input
              onChange={(event) => onSetCalendarCredentialLabel(event.target.value)}
              value={calendarCredentialLabel}
            />
          </label>
          <button
            className="secondary-button compact-button"
            disabled={creatingCalendarCredential}
            onClick={() => void onCreateCalendarCredential()}
            type="button"
          >
            <Plus size={16} />
            {creatingCalendarCredential ? "Creating..." : "Create password"}
          </button>
        </div>
        {calendarOneTimeSecret ? (
          <OneTimeSecretPanel
            className="calendar-secret"
            items={[
              { label: "Username", value: calendarOneTimeSecret.username },
              { label: "One-time password", value: calendarOneTimeSecret.password },
              { label: "Principal URL", value: calendarOneTimeSecret.principalUrl },
            ]}
          />
        ) : null}
        <p className="inline-empty">{calendarCredentialStatus}</p>
      </div>

      <div className="party-list">
        {calendarCredentials.map((credential) => (
          <div className="party-row" key={credential.id}>
            <span>
              <strong>{credential.label}</strong>
              <small>
                {credential.username} · created {compactDate(credential.createdAt)}
                {credential.lastUsedAt ? ` · last used ${compactDate(credential.lastUsedAt)}` : ""}
              </small>
            </span>
            <div className="row-actions">
              <em className={credential.revokedAt ? "risk" : undefined}>
                {credential.revokedAt ? "revoked" : "active"}
              </em>
              {!credential.revokedAt ? (
                <button
                  className="secondary-button compact-button row-button"
                  disabled={revokingCalendarCredentialId === credential.id}
                  onClick={() => void onRevokeCalendarCredential(credential.id)}
                  type="button"
                >
                  {revokingCalendarCredentialId === credential.id ? "Revoking..." : "Revoke"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {calendarCredentials.length === 0 ? (
          <p className="inline-empty">No calendar app passwords have been created.</p>
        ) : null}
      </div>
    </>
  );
}
