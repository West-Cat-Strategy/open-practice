import { AlertTriangle, CalendarDays, Clock3, Link2, Plus, X } from "lucide-react";
import type { CalendarMeetingLinkMode } from "@open-practice/domain/calendar-models";
import {
  describeCalendarEventTiming,
  describeCalendarGuestSessionStatus,
  describeMeetingInvitationBoundary,
  describeMeetingLinkAvailability,
  type CalendarRadarBuckets,
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
  activeMatterNumber: string;
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
  calendarOneTimeSecret: CalendarCredentialCreateResponse | null;
  calendarReminderAt: string;
  calendarReminderNote: string;
  calendarReminderStatus: string;
  calendarReminderStatusValue: CalendarReminderStatus;
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
  onSetCalendarAttendeeEmail: (value: string) => void;
  onSetCalendarAttendeeName: (value: string) => void;
  onSetCalendarAttendeeRole: (value: "required" | "optional") => void;
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
  return valuesByEventId[event.id] ?? event.meetingLinkUrl ?? "";
}

export function CalendarSection({
  activeCalendarBuckets,
  activeCalendarEvents,
  activeCalendarLinks,
  activeCalendarSchedulingRequests,
  activeMatterNumber,
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
  calendarOneTimeSecret,
  calendarReminderAt,
  calendarReminderNote,
  calendarReminderStatus,
  calendarReminderStatusValue,
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
  onIssueCalendarGuestLink,
  onOpenCalendarInvitationConfirmation,
  onRemoveCalendarAttendee,
  onRemoveCalendarReminder,
  onRescheduleCalendarEvent,
  onRevokeCalendarCredential,
  onSetCalendarAttendeeEmail,
  onSetCalendarAttendeeName,
  onSetCalendarAttendeeRole,
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
  onSetCalendarReminderAt,
  onSetCalendarReminderEventId,
  onSetCalendarReminderNote,
  onSetCalendarReminderStatusValue,
  onUpdateCalendarGuestLink,
  onUpdateCalendarMeetingLink,
  onUpdateCalendarReminder,
}: CalendarSectionProps) {
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
        </div>
        <div>
          <span className="field-label">Cancelled</span>
          <strong>{activeCalendarBuckets.cancelled.length}</strong>
        </div>
      </div>

      <div className="section-title">
        <h3>Deadline radar</h3>
        <span>{activeCalendarEvents.length} matter events</span>
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
      <div className="party-list">
        {activeCalendarSchedulingRequests.map((request) => (
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
            </span>
            <em className={request.status === "needs_review" ? "risk" : undefined}>
              {request.reviewBoundary.approvalCreatesTask ||
              request.reviewBoundary.approvalReschedulesEvent ||
              request.reviewBoundary.approvalCancelsReminder ||
              request.reviewBoundary.approvalCreatesTimeEntry
                ? "Automation enabled"
                : "Review only"}
            </em>
          </div>
        ))}
        {activeCalendarSchedulingRequests.length === 0 ? (
          <p className="inline-empty">No scheduling request records for this matter.</p>
        ) : null}
      </div>

      <div className="share-controls calendar-event-controls">
        <div className="section-title">
          <h3>Event lifecycle</h3>
          <span>Create or reschedule one matter event</span>
        </div>
        <div className="calendar-attendee-form">
          <label className="search-field">
            <span>Title</span>
            <input
              onChange={(event) => onSetCalendarEventTitle(event.target.value)}
              value={calendarEventTitle}
            />
          </label>
          <label className="search-field">
            <span>Starts</span>
            <input
              onChange={(event) => onSetCalendarEventStartsAt(event.target.value)}
              type="datetime-local"
              value={calendarEventStartsAt}
            />
          </label>
          <label className="search-field">
            <span>Ends</span>
            <input
              onChange={(event) => onSetCalendarEventEndsAt(event.target.value)}
              type="datetime-local"
              value={calendarEventEndsAt}
            />
          </label>
          <label className="search-field">
            <span>Status</span>
            <select
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
              onChange={(event) => onSetCalendarEventLocation(event.target.value)}
              value={calendarEventLocation}
            />
          </label>
          <label className="search-field">
            <span>Description</span>
            <input
              onChange={(event) => onSetCalendarEventDescription(event.target.value)}
              value={calendarEventDescription}
            />
          </label>
          <button
            className="secondary-button compact-button"
            disabled={
              creatingCalendarEvent ||
              !calendarEventTitle.trim() ||
              !calendarEventStartsAt ||
              !calendarEventEndsAt
            }
            onClick={() => void onCreateCalendarEvent()}
            type="button"
          >
            <Plus size={16} />
            {creatingCalendarEvent ? "Creating..." : "Create event"}
          </button>
        </div>
        <p className="inline-empty">{calendarEventLifecycleStatus}</p>
      </div>

      <div className="section-title">
        <h3>Matter calendar events</h3>
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
                </span>
                <div className="row-actions">
                  <em
                    className={
                      event.status === "cancelled" || timing === "overdue" ? "risk" : undefined
                    }
                  >
                    {event.status === "cancelled" ? "cancelled" : timing}
                  </em>
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
                  <button
                    className="secondary-button compact-button row-button"
                    disabled={
                      updatingCalendarEventId === event.id ||
                      !calendarEventStartsAt ||
                      !calendarEventEndsAt
                    }
                    onClick={() => void onRescheduleCalendarEvent(event)}
                    type="button"
                  >
                    {updatingCalendarEventId === event.id ? "Rescheduling..." : "Reschedule"}
                  </button>
                  <button
                    className="secondary-button compact-button row-button"
                    disabled={event.status === "cancelled" || cancelingCalendarEventId === event.id}
                    onClick={() => void onCancelCalendarEvent(event)}
                    type="button"
                  >
                    {cancelingCalendarEventId === event.id ? "Cancelling..." : "Cancel"}
                  </button>
                  <button
                    className="secondary-button compact-button row-button"
                    disabled={
                      attendees.length === 0 || sendingCalendarInvitationsEventId === event.id
                    }
                    onClick={() => onOpenCalendarInvitationConfirmation(event)}
                    type="button"
                  >
                    {sendingCalendarInvitationsEventId === event.id ? "Sending..." : "Send invites"}
                  </button>
                </div>
              </div>
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
                      placeholder="https://meet.example.test/room"
                    />
                  </label>
                ) : null}
                {meetingLinkMode === "hosted_webrtc" && !hostedMeetingConfigured ? (
                  <p className="inline-empty">Hosted WebRTC meetings are not configured.</p>
                ) : null}
                {event.meetingLinkUrl ? (
                  <code className="calendar-meeting-link-url">{event.meetingLinkUrl}</code>
                ) : null}
                <button
                  className="secondary-button compact-button row-button"
                  disabled={updatingCalendarMeetingLinkEventId === event.id || !canSaveMeetingLink}
                  onClick={() =>
                    onUpdateCalendarMeetingLink(event, meetingLinkMode, meetingLinkUrl)
                  }
                  type="button"
                >
                  {updatingCalendarMeetingLinkEventId === event.id ? "Saving..." : "Save link"}
                </button>
              </div>
              {event.meetingLinkMode === "hosted_webrtc" ? (
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
                          {session.guests.map((guest) => (
                            <div className="calendar-attendee-row" key={guest.id}>
                              <span>
                                <strong>Guest access</strong>
                                <small>
                                  {guest.status.replace("_", " ")} · expires{" "}
                                  {compactDate(guest.expiresAt)}
                                </small>
                              </span>
                              <div className="row-actions">
                                <button
                                  className="secondary-button compact-button row-button"
                                  disabled={
                                    session.status !== "open" ||
                                    guest.status === "admitted" ||
                                    guest.status === "revoked" ||
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
                                  type="button"
                                >
                                  Admit
                                </button>
                                <button
                                  className="secondary-button compact-button row-button"
                                  disabled={
                                    guest.status === "denied" ||
                                    guest.status === "revoked" ||
                                    updatingCalendarGuestSessionKey === `${guest.id}:deny`
                                  }
                                  onClick={() =>
                                    void onUpdateCalendarGuestLink(event, session, guest.id, "deny")
                                  }
                                  type="button"
                                >
                                  Deny
                                </button>
                                <button
                                  aria-label={`Revoke guest access ${guest.id}`}
                                  className="icon-button"
                                  disabled={
                                    guest.status === "revoked" ||
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
                                  title="Revoke guest access"
                                  type="button"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
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
              {pendingDeliveryConfirmation?.kind === "calendar-invitations" &&
              pendingDeliveryConfirmation.eventId === event.id ? (
                <DeliveryConfirmationPanel
                  busy={sendingCalendarInvitationsEventId === event.id}
                  confirmation={pendingDeliveryConfirmation}
                  onCancel={onCancelPendingDeliveryConfirmation}
                  onConfirm={onConfirmPendingDelivery}
                />
              ) : null}
              <div className="calendar-attendee-list">
                {(event.reminders ?? []).map((reminder) => (
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
                        disabled={updatingCalendarReminderId === reminder.id}
                        onClick={() =>
                          void onUpdateCalendarReminder(event.id, reminder.id, "acknowledged")
                        }
                        type="button"
                      >
                        Acknowledge
                      </button>
                      <button
                        aria-label={`Remove reminder ${reminder.id}`}
                        className="icon-button"
                        disabled={removingCalendarReminderId === reminder.id}
                        onClick={() => void onRemoveCalendarReminder(event.id, reminder.id)}
                        title="Remove reminder"
                        type="button"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {(event.reminders ?? []).length === 0 ? (
                  <p className="inline-empty">No reminders are linked to this event.</p>
                ) : null}
              </div>
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
                      <em className={attendee.invitationStatus === "skipped" ? "risk" : undefined}>
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
            </div>
          );
        })}
        {activeCalendarEvents.length === 0 ? (
          <p className="inline-empty">No calendar events are linked to this matter.</p>
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
              onChange={(event) => onSetCalendarReminderAt(event.target.value)}
              type="datetime-local"
              value={calendarReminderAt}
            />
          </label>
          <label className="search-field">
            <span>Status</span>
            <select
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
              onChange={(event) => onSetCalendarReminderNote(event.target.value)}
              value={calendarReminderNote}
            />
          </label>
          <button
            className="secondary-button compact-button"
            disabled={
              !selectedCalendarReminderEvent || !calendarReminderAt || addingCalendarReminder
            }
            onClick={() => void onAddCalendarReminder()}
            type="button"
          >
            <Plus size={16} />
            {addingCalendarReminder ? "Adding..." : "Add reminder"}
          </button>
        </div>
        <p className="inline-empty">{calendarReminderStatus}</p>
      </div>

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
        <p className="inline-empty">{calendarMeetingStatus}</p>
        <p className="inline-empty">{calendarGuestSessionStatus}</p>
      </div>

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
