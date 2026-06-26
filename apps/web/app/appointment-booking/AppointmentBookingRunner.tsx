"use client";

import { CalendarDays, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  publicTokenHeaders,
  publicTokenNetworkErrorMessage,
  readPublicTokenError,
} from "../publicTokenClient";
import { PublicStatusMessage, PublicTokenShell } from "../publicTokenUi";
import {
  buildAppointmentBookingPath,
  describeAppointmentBookingLoad,
  publicAppointmentBookingErrorMessage,
  type PublicAppointmentBookingErrorBody,
  type PublicAppointmentBookingLoadResponse,
  type PublicAppointmentBookingSubmitResponse,
} from "./runner-utils";

interface AppointmentBookingRunnerProps {
  apiBaseUrl: string;
  token: string;
}

function slotLabel(startsAt: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(startsAt));
}

export default function AppointmentBookingRunner({
  apiBaseUrl,
  token,
}: AppointmentBookingRunnerProps) {
  const [payload, setPayload] = useState<PublicAppointmentBookingLoadResponse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [requesterTelephone, setRequesterTelephone] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("Loading appointment booking...");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const profile = payload?.profile;

  const loadBooking = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setLoading(true);
      setStatus("Loading appointment booking...");
      try {
        const response = await fetch(`${apiBaseUrl}${buildAppointmentBookingPath()}`, {
          headers: publicTokenHeaders(token),
          signal,
        });
        if (signal?.aborted) return;
        if (!response.ok) {
          const body = (await readPublicTokenError(response)) as PublicAppointmentBookingErrorBody;
          setStatus(
            publicAppointmentBookingErrorMessage(
              body,
              `Appointment booking unavailable: ${response.status}`,
            ),
          );
          return;
        }
        const nextPayload = (await response.json()) as PublicAppointmentBookingLoadResponse;
        if (signal?.aborted) return;
        setPayload(nextPayload);
        setSelectedSlot(nextPayload.slots[0]?.startsAt ?? "");
        setStatus(describeAppointmentBookingLoad(nextPayload));
      } catch (error) {
        if (!signal?.aborted) setStatus(publicTokenNetworkErrorMessage("Load", error));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [apiBaseUrl, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadBooking(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadBooking]);

  async function submitBooking(): Promise<void> {
    if (!selectedSlot || !requesterName.trim()) {
      setStatus("Choose a slot and enter your name.");
      return;
    }
    setSubmitting(true);
    setStatus("Submitting appointment request...");
    try {
      const response = await fetch(`${apiBaseUrl}${buildAppointmentBookingPath("book")}`, {
        method: "POST",
        headers: publicTokenHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          startsAt: selectedSlot,
          requesterName,
          requesterEmail,
          requesterTelephone,
          note,
        }),
      });
      if (!response.ok) {
        const body = (await readPublicTokenError(response)) as PublicAppointmentBookingErrorBody;
        setStatus(publicAppointmentBookingErrorMessage(body, `Booking failed: ${response.status}`));
        return;
      }
      const nextPayload = (await response.json()) as PublicAppointmentBookingSubmitResponse;
      setStatus(
        `Tentative hold submitted for ${slotLabel(
          nextPayload.booking.requestedStartsAt,
          nextPayload.booking.profile.timezone,
        )}.`,
      );
      setPayload((current) =>
        current
          ? {
              ...current,
              link: { ...current.link, status: "used" },
              slots: [],
            }
          : current,
      );
    } catch (error) {
      setStatus(publicTokenNetworkErrorMessage("Submit", error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicTokenShell
      badge={<ShieldCheck size={22} />}
      description={profile ? `${profile.timezone} · ${profile.durationMinutes} minutes` : undefined}
      eyebrow="Appointment booking"
      icon={<CalendarDays size={22} />}
      title={profile?.publicLabel ?? "Appointment booking"}
    >
      <div className="public-form-body">
        <label>
          <span>Slot</span>
          <select
            disabled={loading || submitting || !payload || payload.link.status !== "active"}
            onChange={(event) => setSelectedSlot(event.currentTarget.value)}
            value={selectedSlot}
          >
            {payload?.slots.length ? null : <option value="">No slots</option>}
            {payload?.slots.map((slot) => (
              <option key={slot.startsAt} value={slot.startsAt}>
                {slotLabel(slot.startsAt, payload.profile.timezone)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Name</span>
          <input
            disabled={submitting || payload?.link.status !== "active"}
            onChange={(event) => setRequesterName(event.target.value)}
            value={requesterName}
          />
        </label>
        <label>
          <span>Email</span>
          <input
            disabled={submitting || payload?.link.status !== "active"}
            onChange={(event) => setRequesterEmail(event.target.value)}
            type="email"
            value={requesterEmail}
          />
        </label>
        <label>
          <span>Phone</span>
          <input
            disabled={submitting || payload?.link.status !== "active"}
            onChange={(event) => setRequesterTelephone(event.target.value)}
            value={requesterTelephone}
          />
        </label>
        <label>
          <span>Note</span>
          <textarea
            disabled={submitting || payload?.link.status !== "active"}
            onChange={(event) => setNote(event.target.value)}
            value={note}
          />
        </label>
        <div className="public-token-actions">
          <button
            className="secondary-button"
            disabled={loading || submitting}
            onClick={() => void loadBooking()}
            type="button"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            className="primary-button"
            disabled={
              submitting ||
              !selectedSlot ||
              !requesterName.trim() ||
              (!requesterEmail.trim() && !requesterTelephone.trim()) ||
              payload?.link.status !== "active"
            }
            onClick={() => void submitBooking()}
            type="button"
          >
            <Send size={16} />
            Submit
          </button>
        </div>
        <PublicStatusMessage>{status}</PublicStatusMessage>
      </div>
    </PublicTokenShell>
  );
}
