"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { PublicStatusMessage, PublicTokenShell } from "../publicTokenUi";
import {
  buildPasswordSetupPayload,
  canSubmitPasswordSetup,
  passwordSetupErrors,
  type PasswordSetupState,
} from "./password-setup-utils";

interface PasswordSetupClientProps {
  apiBaseUrl: string;
  token: string;
  userId: string;
}

export default function PasswordSetupClient({
  apiBaseUrl,
  token,
  userId,
}: PasswordSetupClientProps) {
  const [state, setState] = useState<PasswordSetupState>({
    userId,
    token,
    password: "",
    passwordConfirmation: "",
  });
  const [status, setStatus] = useState(
    userId && token ? "Choose a password for this account." : "Password setup link is incomplete.",
  );
  const [submitting, setSubmitting] = useState(false);
  const errors = useMemo(() => passwordSetupErrors(state), [state]);
  const canSubmit = canSubmitPasswordSetup(state);

  function update<K extends keyof PasswordSetupState>(key: K, value: PasswordSetupState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function submitPassword(): Promise<void> {
    const nextErrors = passwordSetupErrors(state);
    if (nextErrors.length > 0) {
      setStatus(nextErrors[0] ?? "Password setup needs review.");
      return;
    }

    setSubmitting(true);
    setStatus("Setting password...");
    const response = await fetch(`${apiBaseUrl}/api/auth/password-setup`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPasswordSetupPayload(state)),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      setStatus(error?.message ?? `Password setup failed: ${response.status}`);
      setSubmitting(false);
      return;
    }
    setStatus("Password set. You can sign in.");
    setSubmitting(false);
  }

  return (
    <PublicTokenShell
      description="Set the password for an owner-issued Open Practice account."
      eyebrow="Client portal"
      icon={<KeyRound size={22} aria-hidden="true" />}
      title="Set password"
    >
      <PublicStatusMessage>{status}</PublicStatusMessage>

      <div className="public-form-section" aria-label="Password setup details">
        <label className="form-field">
          <span>New password</span>
          <input
            autoComplete="new-password"
            onChange={(event) => update("password", event.target.value)}
            type="password"
            value={state.password}
          />
        </label>
        <label className="form-field">
          <span>Confirm password</span>
          <input
            autoComplete="new-password"
            onChange={(event) => update("passwordConfirmation", event.target.value)}
            type="password"
            value={state.passwordConfirmation}
          />
        </label>
      </div>

      {errors.length > 0 ? (
        <div className="setup-errors" role="alert">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <footer className="setup-actions">
        <span
          className="status-message auth-status-message"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {canSubmit ? "Ready" : "Review required"}
        </span>
        <button
          className="primary-button public-submit-button"
          disabled={submitting || !canSubmit}
          onClick={() => void submitPassword()}
          type="button"
        >
          <ShieldCheck className="button-icon" size={18} aria-hidden="true" />
          <span>{submitting ? "Setting..." : "Set password"}</span>
        </button>
      </footer>
    </PublicTokenShell>
  );
}
