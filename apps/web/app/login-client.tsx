"use client";

import { LogIn } from "lucide-react";
import { useState } from "react";

interface LoginClientProps {
  apiBaseUrl: string;
}

export default function LoginClient({ apiBaseUrl }: LoginClientProps) {
  const [firmId, setFirmId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Session required.");
  const [submitting, setSubmitting] = useState(false);

  async function login() {
    setSubmitting(true);
    setStatus("Signing in...");
    const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firmId, email, password }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      setStatus(error?.message ?? `Sign in failed: ${response.status}`);
      setSubmitting(false);
      return;
    }
    setStatus("Signed in.");
    window.location.reload();
  }

  return (
    <main className="setup-shell">
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="setup-heading">
          <LogIn size={24} />
          <div>
            <p className="eyebrow">Open Practice</p>
            <h1 id="login-title">Sign In</h1>
          </div>
        </div>
        <div className="setup-grid one-column">
          <label className="form-field">
            <span>Firm ID</span>
            <input onChange={(event) => setFirmId(event.target.value)} value={firmId} />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
        </div>
        <footer className="setup-actions">
          <span>{status}</span>
          <button
            className="primary-button"
            disabled={submitting || !firmId || !email || !password}
            onClick={login}
            type="button"
          >
            Sign In
          </button>
        </footer>
      </section>
    </main>
  );
}
