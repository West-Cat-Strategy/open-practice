"use client";

import { LogIn, RefreshCw, ShieldCheck, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PublicTokenNeedsAttention } from "../publicTokenActions";
import {
  publicTokenHeaders,
  publicTokenNetworkErrorMessage,
  readPublicTokenError,
} from "../publicTokenClient";
import { PublicStatusMessage, PublicTokenShell } from "../publicTokenUi";
import type { PublicGuestSessionResponse } from "../types";
import {
  buildGuestSessionPath,
  canCheckInToGuestSession,
  describePublicGuestSessionStatus,
  guestSessionAttentionItems,
  publicGuestSessionErrorMessage,
  shouldPollPublicGuestSession,
  type PublicGuestSessionErrorBody,
} from "./runner-utils";

interface GuestSessionRunnerProps {
  apiBaseUrl: string;
  token: string;
}

type GuestSessionLoadMode = "load" | "refresh";

export default function GuestSessionRunner({ apiBaseUrl, token }: GuestSessionRunnerProps) {
  const [payload, setPayload] = useState<PublicGuestSessionResponse | null>(null);
  const [status, setStatus] = useState("Loading guest session...");
  const [loadingMode, setLoadingMode] = useState<GuestSessionLoadMode | null>("load");
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const attentionItems = guestSessionAttentionItems(payload);
  const loadingGuestSession = loadingMode !== null;
  const refreshingGuestSession = loadingMode === "refresh";

  const loadGuestSession = useCallback(
    async (mode: GuestSessionLoadMode, signal?: AbortSignal): Promise<void> => {
      setLoadingMode(mode);
      setStatus(mode === "refresh" ? "Refreshing guest session..." : "Loading guest session...");
      try {
        const response = await fetch(`${apiBaseUrl}${buildGuestSessionPath()}`, {
          headers: publicTokenHeaders(token),
          signal,
        });
        if (signal?.aborted) return;
        if (!response.ok) {
          const body = (await readPublicTokenError(response)) as PublicGuestSessionErrorBody;
          setStatus(
            publicGuestSessionErrorMessage(body, `Guest session unavailable: ${response.status}`),
          );
          return;
        }
        const nextPayload = (await response.json()) as PublicGuestSessionResponse;
        if (signal?.aborted) return;
        setPayload(nextPayload);
        setStatus(describePublicGuestSessionStatus(nextPayload));
      } catch (error) {
        if (!signal?.aborted) {
          setStatus(publicTokenNetworkErrorMessage(mode === "refresh" ? "Refresh" : "Load", error));
        }
      } finally {
        if (!signal?.aborted) {
          setLastCheckedAt(new Date().toISOString());
          setLoadingMode(null);
        }
      }
    },
    [apiBaseUrl, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadGuestSession("load", controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadGuestSession]);

  useEffect(() => {
    if (!shouldPollPublicGuestSession(payload)) return;
    const controller = new AbortController();
    let pollInFlight = false;
    const intervalId = window.setInterval(() => {
      if (pollInFlight) return;
      pollInFlight = true;
      void loadGuestSession("refresh", controller.signal).finally(() => {
        pollInFlight = false;
      });
    }, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [loadGuestSession, payload?.guest?.status, payload?.session.status]);

  async function checkIn(): Promise<void> {
    setCheckingIn(true);
    setStatus("Checking in...");
    try {
      const response = await fetch(`${apiBaseUrl}${buildGuestSessionPath("check-in")}`, {
        method: "POST",
        headers: publicTokenHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ attendanceConfirmation: { source: "guest_status_page" } }),
      });
      if (!response.ok) {
        const body = (await readPublicTokenError(response)) as PublicGuestSessionErrorBody;
        setStatus(publicGuestSessionErrorMessage(body, `Check-in failed: ${response.status}`));
        return;
      }
      const nextPayload = (await response.json()) as PublicGuestSessionResponse;
      setPayload(nextPayload);
      setStatus(describePublicGuestSessionStatus(nextPayload));
      setLastCheckedAt(new Date().toISOString());
    } catch (error) {
      setStatus(publicTokenNetworkErrorMessage("Check-in", error));
    } finally {
      setCheckingIn(false);
    }
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

      <div className="public-form-action" aria-label="Guest session status controls">
        <div>
          <strong>Latest lobby status</strong>
          <small>
            {payload ? describePublicGuestSessionStatus(payload) : "Waiting for lobby status."}
          </small>
          <small>
            {lastCheckedAt
              ? `Last checked ${new Date(lastCheckedAt).toLocaleString()}`
              : "Last checked pending."}
          </small>
        </div>
        <button
          aria-busy={refreshingGuestSession}
          aria-label="Refresh guest session status"
          className="secondary-button"
          disabled={loadingGuestSession || checkingIn}
          onClick={() => void loadGuestSession("refresh")}
          type="button"
        >
          <RefreshCw size={16} aria-hidden="true" />
          {refreshingGuestSession ? "Refreshing..." : "Refresh"}
        </button>
      </div>

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
            disabled={checkingIn || loadingGuestSession}
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
