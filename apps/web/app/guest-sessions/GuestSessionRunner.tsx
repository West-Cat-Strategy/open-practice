"use client";

import { LogIn, ShieldCheck, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { PublicTokenNeedsAttention } from "../publicTokenActions";
import { buildPublicTokenPath, readPublicTokenError } from "../publicTokenClient";
import { PublicStatusMessage, PublicTokenShell } from "../publicTokenUi";
import type { PublicGuestSessionResponse } from "../types";
import {
  buildGuestSessionPath,
  canCheckInToGuestSession,
  describePublicGuestSessionStatus,
  guestSessionAttentionItems,
  publicGuestSessionErrorMessage,
  type PublicGuestSessionErrorBody,
} from "./runner-utils";

interface GuestSessionRunnerProps {
  apiBaseUrl: string;
  token: string;
}

export default function GuestSessionRunner({ apiBaseUrl, token }: GuestSessionRunnerProps) {
  const [payload, setPayload] = useState<PublicGuestSessionResponse | null>(null);
  const [status, setStatus] = useState("Loading guest session...");
  const [checkingIn, setCheckingIn] = useState(false);
  const attentionItems = guestSessionAttentionItems(payload);

  useEffect(() => {
    let cancelled = false;
    async function loadGuestSession(): Promise<void> {
      const response = await fetch(`${apiBaseUrl}${buildGuestSessionPath(token)}`);
      if (cancelled) return;
      if (!response.ok) {
        const body = (await readPublicTokenError(response)) as PublicGuestSessionErrorBody;
        setStatus(
          publicGuestSessionErrorMessage(body, `Guest session unavailable: ${response.status}`),
        );
        return;
      }
      const nextPayload = (await response.json()) as PublicGuestSessionResponse;
      setPayload(nextPayload);
      setStatus(describePublicGuestSessionStatus(nextPayload));
    }
    void loadGuestSession();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, token]);

  async function checkIn(): Promise<void> {
    setCheckingIn(true);
    setStatus("Checking in...");
    const response = await fetch(
      `${apiBaseUrl}${buildPublicTokenPath("/api/portal/guest-sessions", token, "check-in")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceConfirmation: { source: "guest_status_page" } }),
      },
    );
    if (!response.ok) {
      const body = (await readPublicTokenError(response)) as PublicGuestSessionErrorBody;
      setStatus(publicGuestSessionErrorMessage(body, `Check-in failed: ${response.status}`));
      setCheckingIn(false);
      return;
    }
    const nextPayload = (await response.json()) as PublicGuestSessionResponse;
    setPayload(nextPayload);
    setStatus(describePublicGuestSessionStatus(nextPayload));
    setCheckingIn(false);
  }

  return (
    <PublicTokenShell
      badge={
        payload?.guest?.status === "admitted" ? (
          <span className="user-pill">
            <ShieldCheck size={16} />
            admitted
          </span>
        ) : undefined
      }
      description="Check your hosted meeting lobby status."
      eyebrow="Guest session"
      icon={<Video size={22} />}
      title="Meeting lobby"
    >
      <PublicStatusMessage>{status}</PublicStatusMessage>

      <PublicTokenNeedsAttention
        emptyLabel="No action is needed on this guest session right now."
        items={attentionItems}
      />

      {canCheckInToGuestSession(payload) ? (
        <div className="public-form-action">
          <div>
            <strong>Lobby check-in</strong>
            <small>Staff will review this guest status before admitting access.</small>
          </div>
          <button
            className="secondary-button"
            disabled={checkingIn}
            onClick={() => void checkIn()}
            type="button"
          >
            <LogIn size={16} />
            {checkingIn ? "Checking in..." : "Check in"}
          </button>
        </div>
      ) : null}

      {payload ? (
        <div className="public-form-section">
          <div className="section-title">
            <h2>Lobby status</h2>
            <span>{payload.session.status}</span>
          </div>
          <div className="public-form-items">
            <div className="public-form-action">
              <div>
                <strong>{describePublicGuestSessionStatus(payload)}</strong>
                <small>
                  {payload.session.startsAt && payload.session.endsAt
                    ? `${new Date(payload.session.startsAt).toLocaleString()} to ${new Date(
                        payload.session.endsAt,
                      ).toLocaleString()}`
                    : "Schedule unavailable"}
                </small>
              </div>
              <Video size={18} aria-hidden="true" />
            </div>
          </div>
        </div>
      ) : null}
    </PublicTokenShell>
  );
}
