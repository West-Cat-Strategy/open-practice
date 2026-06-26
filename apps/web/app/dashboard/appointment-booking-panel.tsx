"use client";

import { CalendarCheck, Link2, Plus, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dashboardApiStatus, requestDashboardJson } from "../api-client";
import { compactDate, compactStatus } from "../_features/dashboard/formatters";

interface AppointmentBookingProfileSummary {
  id: string;
  label: string;
  publicLabel: string;
  description?: string;
  timezone: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  minLeadMinutes: number;
  maxLeadDays: number;
  status: "active" | "paused";
  weeklyWindows: Array<{ weekday: number; startTime: string; endTime: string }>;
}

interface AppointmentBookingRequestSummary {
  id: string;
  profileId: string;
  profileLabel?: string;
  linkId?: string;
  source: "website" | "direct_link";
  status: "tentative_hold" | "confirmed" | "dismissed";
  calendarEventId: string;
  matterId?: string;
  clientContactId?: string;
  publicConsultationIntakeId?: string;
  requesterName: string;
  requesterEmailPresent: boolean;
  requesterTelephonePresent: boolean;
  requestedStartsAt: string;
  requestedEndsAt: string;
  submittedAt: string;
  reviewedAt?: string;
  dismissedReason?: string;
}

interface AppointmentBookingLinkSummary {
  id: string;
  profileId: string;
  status: "active" | "used" | "revoked" | "expired";
  matterId?: string;
  clientContactId?: string;
  expiresAt: string;
  createdAt: string;
}

interface ProfilesResponse {
  profiles: AppointmentBookingProfileSummary[];
}

interface RequestsResponse {
  requests: AppointmentBookingRequestSummary[];
}

interface ProfileMutationResponse {
  profile: AppointmentBookingProfileSummary;
}

interface LinkMutationResponse {
  link: AppointmentBookingLinkSummary;
  token: string;
  url: string;
}

interface RequestReviewResponse {
  request: AppointmentBookingRequestSummary;
}

interface AppointmentBookingPanelProps {
  apiBaseUrl: string;
  devHeaders: Record<string, string>;
  activeCalendarScope: "matter" | "firm" | "client";
  activeMatterId?: string;
  activeClientContactId?: string;
}

function defaultWindows() {
  return [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startTime: "09:00",
    endTime: "17:00",
  }));
}

function upsertRequest(
  requests: AppointmentBookingRequestSummary[],
  request: AppointmentBookingRequestSummary,
): AppointmentBookingRequestSummary[] {
  const found = requests.some((candidate) => candidate.id === request.id);
  if (!found) return [request, ...requests];
  return requests.map((candidate) => (candidate.id === request.id ? request : candidate));
}

function defaultProfilePayload(input: {
  label: string;
  publicLabel: string;
  timezone: string;
  durationMinutes: number;
}) {
  return {
    label: input.label,
    publicLabel: input.publicLabel,
    timezone: input.timezone,
    durationMinutes: input.durationMinutes,
    slotIntervalMinutes: input.durationMinutes,
    minLeadMinutes: 120,
    maxLeadDays: 30,
    status: "active" as const,
    weeklyWindows: defaultWindows(),
  };
}

export function AppointmentBookingPanel({
  apiBaseUrl,
  devHeaders,
  activeCalendarScope,
  activeMatterId,
  activeClientContactId,
}: AppointmentBookingPanelProps) {
  const [profiles, setProfiles] = useState<AppointmentBookingProfileSummary[]>([]);
  const [requests, setRequests] = useState<AppointmentBookingRequestSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileLabel, setProfileLabel] = useState("Consultation");
  const [profilePublicLabel, setProfilePublicLabel] = useState("Initial consultation");
  const [profileTimezone, setProfileTimezone] = useState("America/Vancouver");
  const [profileDuration, setProfileDuration] = useState("30");
  const [status, setStatus] = useState("Booking profiles have not been loaded.");
  const [loading, setLoading] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState("");
  const [lastLink, setLastLink] = useState<LinkMutationResponse | null>(null);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
  const tentativeRequests = useMemo(
    () => requests.filter((request) => request.status === "tentative_hold"),
    [requests],
  );

  const loadBookingState = useCallback(async (): Promise<void> => {
    setLoading(true);
    setStatus("Loading booking profiles and tentative holds...");
    try {
      const [profilePayload, requestPayload] = await Promise.all([
        requestDashboardJson<ProfilesResponse>(apiBaseUrl, "/api/appointment-booking/profiles", {
          headers: devHeaders,
        }),
        requestDashboardJson<RequestsResponse>(
          apiBaseUrl,
          "/api/appointment-booking/requests?status=tentative_hold",
          {
            headers: devHeaders,
          },
        ),
      ]);
      setProfiles(profilePayload.profiles);
      setRequests(requestPayload.requests);
      setSelectedProfileId((current) => current || profilePayload.profiles[0]?.id || "");
      setStatus(
        `${profilePayload.profiles.length} profile${
          profilePayload.profiles.length === 1 ? "" : "s"
        } and ${requestPayload.requests.length} tentative hold${
          requestPayload.requests.length === 1 ? "" : "s"
        } loaded.`,
      );
    } catch (error) {
      setStatus(`Booking refresh failed: ${dashboardApiStatus(error)}`);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, devHeaders]);

  useEffect(() => {
    void loadBookingState();
  }, [loadBookingState]);

  async function createProfile(): Promise<void> {
    const durationMinutes = Number.parseInt(profileDuration, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
      setStatus("Profile duration must be at least 15 minutes.");
      return;
    }
    setCreatingProfile(true);
    setStatus("Creating booking profile...");
    try {
      const payload = await requestDashboardJson<ProfileMutationResponse>(
        apiBaseUrl,
        "/api/appointment-booking/profiles",
        {
          method: "POST",
          headers: devHeaders,
          payload: defaultProfilePayload({
            label: profileLabel,
            publicLabel: profilePublicLabel,
            timezone: profileTimezone,
            durationMinutes,
          }),
        },
      );
      setProfiles((current) => [payload.profile, ...current]);
      setSelectedProfileId(payload.profile.id);
      setStatus("Booking profile created.");
    } catch (error) {
      setStatus(`Profile create failed: ${dashboardApiStatus(error)}`);
    } finally {
      setCreatingProfile(false);
    }
  }

  async function toggleProfileStatus(profile: AppointmentBookingProfileSummary): Promise<void> {
    const nextStatus = profile.status === "active" ? "paused" : "active";
    setStatus(`${nextStatus === "active" ? "Activating" : "Pausing"} booking profile...`);
    try {
      const payload = await requestDashboardJson<ProfileMutationResponse>(
        apiBaseUrl,
        `/api/appointment-booking/profiles/${encodeURIComponent(profile.id)}`,
        {
          method: "PATCH",
          headers: devHeaders,
          payload: { status: nextStatus },
        },
      );
      setProfiles((current) =>
        current.map((candidate) => (candidate.id === profile.id ? payload.profile : candidate)),
      );
      setStatus(nextStatus === "active" ? "Booking profile activated." : "Booking profile paused.");
    } catch (error) {
      setStatus(`Profile update failed: ${dashboardApiStatus(error)}`);
    }
  }

  async function createDirectLink(): Promise<void> {
    if (!selectedProfile) {
      setStatus("Create a booking profile before generating a link.");
      return;
    }
    setCreatingLink(true);
    setLastLink(null);
    setStatus("Generating direct booking link...");
    try {
      const payload = await requestDashboardJson<LinkMutationResponse>(
        apiBaseUrl,
        `/api/appointment-booking/profiles/${encodeURIComponent(selectedProfile.id)}/links`,
        {
          method: "POST",
          headers: devHeaders,
          payload: {
            matterId: activeCalendarScope === "matter" ? activeMatterId : undefined,
            clientContactId: activeCalendarScope === "client" ? activeClientContactId : undefined,
          },
        },
      );
      setLastLink(payload);
      setStatus("Direct booking link generated. Copy it now.");
    } catch (error) {
      setStatus(`Link create failed: ${dashboardApiStatus(error)}`);
    } finally {
      setCreatingLink(false);
    }
  }

  async function reviewRequest(
    request: AppointmentBookingRequestSummary,
    status: "confirmed" | "dismissed",
  ): Promise<void> {
    setReviewingRequestId(request.id);
    setStatus(status === "confirmed" ? "Confirming tentative hold..." : "Dismissing hold...");
    try {
      const payload = await requestDashboardJson<RequestReviewResponse>(
        apiBaseUrl,
        `/api/appointment-booking/requests/${encodeURIComponent(request.id)}/review`,
        {
          method: "PATCH",
          headers: devHeaders,
          payload:
            status === "confirmed"
              ? { status }
              : { status, dismissedReason: "Dismissed from booking review panel" },
        },
      );
      setRequests((current) => upsertRequest(current, payload.request));
      setStatus(status === "confirmed" ? "Hold confirmed." : "Hold dismissed.");
    } catch (error) {
      setStatus(`Hold review failed: ${dashboardApiStatus(error)}`);
    } finally {
      setReviewingRequestId("");
    }
  }

  return (
    <div className="share-controls calendar-booking-controls">
      <div className="section-title">
        <h3>Appointment booking</h3>
        <span>{tentativeRequests.length} tentative holds</span>
      </div>
      <div className="calendar-attendee-form calendar-event-form">
        <label className="search-field">
          <span>Profile</span>
          <select
            disabled={profiles.length === 0}
            onChange={(event) => setSelectedProfileId(event.currentTarget.value)}
            value={selectedProfileId}
          >
            {profiles.length === 0 ? <option value="">No profile</option> : null}
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label} · {compactStatus(profile.status)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-button compact-button"
          disabled={loading}
          onClick={() => void loadBookingState()}
          type="button"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
        <button
          className="secondary-button compact-button"
          disabled={!selectedProfile || creatingLink}
          onClick={() => void createDirectLink()}
          type="button"
        >
          <Link2 size={15} />
          Link
        </button>
        {selectedProfile ? (
          <button
            className="secondary-button compact-button"
            onClick={() => void toggleProfileStatus(selectedProfile)}
            type="button"
          >
            {selectedProfile.status === "active" ? "Pause" : "Activate"}
          </button>
        ) : null}
      </div>
      <div className="calendar-attendee-form calendar-event-form">
        <label className="search-field">
          <span>Internal label</span>
          <input onChange={(event) => setProfileLabel(event.target.value)} value={profileLabel} />
        </label>
        <label className="search-field">
          <span>Public label</span>
          <input
            onChange={(event) => setProfilePublicLabel(event.target.value)}
            value={profilePublicLabel}
          />
        </label>
        <label className="search-field">
          <span>Timezone</span>
          <input
            onChange={(event) => setProfileTimezone(event.target.value)}
            value={profileTimezone}
          />
        </label>
        <label className="search-field">
          <span>Minutes</span>
          <input
            inputMode="numeric"
            onChange={(event) => setProfileDuration(event.target.value)}
            value={profileDuration}
          />
        </label>
        <button
          className="primary-button compact-button"
          disabled={creatingProfile || !profileLabel.trim() || !profilePublicLabel.trim()}
          onClick={() => void createProfile()}
          type="button"
        >
          <Plus size={15} />
          Profile
        </button>
      </div>
      {lastLink ? (
        <div className="calendar-secret">
          <strong>Direct link</strong>
          <input readOnly value={lastLink.url} />
          <small>
            Token is shown once · expires {compactDate(lastLink.link.expiresAt)} ·{" "}
            {compactStatus(lastLink.link.status)}
          </small>
        </div>
      ) : null}
      <div className="party-list">
        {tentativeRequests.slice(0, 5).map((request) => (
          <div className="party-row" key={request.id}>
            <span>
              <strong>
                {request.requesterName} · {compactDate(request.requestedStartsAt)}
              </strong>
              <small>
                {request.profileLabel ?? request.profileId} · {compactStatus(request.source)} ·{" "}
                {request.requesterEmailPresent ? "email" : "no email"} ·{" "}
                {request.requesterTelephonePresent ? "phone" : "no phone"}
              </small>
              <small>
                {request.matterId ? "Matter hold" : "Firm hold"} · event {request.calendarEventId}
              </small>
            </span>
            <div className="row-actions">
              <button
                className="secondary-button compact-button row-button"
                disabled={reviewingRequestId === request.id}
                onClick={() => void reviewRequest(request, "confirmed")}
                type="button"
              >
                <CalendarCheck size={15} />
                Confirm
              </button>
              <button
                className="secondary-button compact-button row-button"
                disabled={reviewingRequestId === request.id}
                onClick={() => void reviewRequest(request, "dismissed")}
                type="button"
              >
                <X size={15} />
                Dismiss
              </button>
            </div>
          </div>
        ))}
        {tentativeRequests.length === 0 ? (
          <p className="inline-empty">No tentative appointment holds are waiting for review.</p>
        ) : null}
      </div>
      <p className="inline-empty" role="status">
        {status}
      </p>
    </div>
  );
}
