"use client";

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  KeyRound,
  ListChecks,
  Loader2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import {
  trimmedSetupKey,
  updateSetupWizardState,
  validateSetupWizardState,
  type SetupWizardState,
} from "./setup-wizard-utils";

interface SetupWizardProps {
  apiBaseUrl: string;
  setupKeyRequired: boolean;
}

const initialState: SetupWizardState = {
  firmName: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  ownerPasswordConfirmation: "",
  setupKey: "",
  trustFundsCaveatAccepted: false,
};

const steps = [
  {
    label: "Workspace",
    summary: "Name the practice workspace that will be created.",
    icon: Building2,
  },
  {
    label: "Owner",
    summary: "Create the first owner-admin account and backup password.",
    icon: UserRound,
  },
  {
    label: "Security",
    summary: "Add a recommended passkey and confirm the operational funds boundary.",
    icon: ShieldCheck,
  },
  {
    label: "Review",
    summary: "Confirm the minimal bootstrap details before creating the workspace.",
    icon: ListChecks,
  },
];

const stepErrorMatchers = [
  ["Workspace name"],
  ["Owner", "Backup password", "Setup key"],
  ["Trust/funds"],
  [],
];

function fieldError(errors: string[], matchers: string[]): string | undefined {
  return errors.find((error) => matchers.some((matcher) => error.includes(matcher)));
}

function errorsForStep(stepIndex: number, errors: string[]): string[] {
  if (stepIndex === steps.length - 1) return errors;
  const matchers = stepErrorMatchers[stepIndex] ?? [];
  return errors.filter((error) => matchers.some((matcher) => error.includes(matcher)));
}

export default function SetupWizard({ apiBaseUrl, setupKeyRequired }: SetupWizardProps) {
  const [state, setState] = useState<SetupWizardState>(initialState);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const validation = useMemo(
    () => validateSetupWizardState(state, setupKeyRequired),
    [setupKeyRequired, state],
  );
  const stepErrors = useMemo(
    () => steps.map((_, index) => errorsForStep(index, validation.errors)),
    [validation.errors],
  );
  const currentStepErrors = stepErrors[step] ?? [];
  const progressPercent = Math.round(((step + 1) / steps.length) * 100);
  const unresolvedStepCount = stepErrors.filter((errors) => errors.length > 0).length;
  const ownerEmailError = fieldError(validation.errors, ["Owner email"]);
  const fieldErrors = {
    firmName: fieldError(validation.errors, ["Workspace name"]),
    ownerName: fieldError(validation.errors, ["Owner name"]),
    ownerEmail: ownerEmailError,
    ownerPassword: fieldError(validation.errors, ["Backup password must"]),
    ownerPasswordConfirmation: fieldError(validation.errors, ["Backup password confirmation"]),
    setupKey: fieldError(validation.errors, ["Setup key"]),
    trustFunds: fieldError(validation.errors, ["Trust/funds"]),
  };

  function update<K extends keyof SetupWizardState>(key: K, value: SetupWizardState[K]) {
    setState((current) => updateSetupWizardState(current, key, value));
  }

  async function registerPasskey() {
    const setupKey = trimmedSetupKey(state);
    const ownerEmail = state.ownerEmail.trim();
    if (!ownerEmail) {
      setStatus("Enter the owner email before registering a passkey.");
      return;
    }
    if (ownerEmailError) {
      setStatus("Enter a valid owner email before registering a passkey.");
      return;
    }
    if (setupKeyRequired && !setupKey) {
      setStatus("Enter the setup key before registering a passkey.");
      return;
    }

    setSubmitting(true);
    setStatus("Generating passkey options...");

    try {
      const resp = await fetch(`${apiBaseUrl}/api/setup/webauthn-options`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(setupKeyRequired ? { "x-open-practice-setup-key": setupKey } : {}),
        },
        body: JSON.stringify({ email: ownerEmail }),
      });

      if (!resp.ok) throw new Error("Failed to get passkey options");

      const options = await resp.json();
      const credential = await startRegistration({ optionsJSON: options });

      update("webAuthnCredential", {
        ...credential,
        challengeHash: options.challenge,
      });
      setStatus("Passkey ready. Complete setup to finish.");
    } catch (err: unknown) {
      console.error(err);
      setStatus(err instanceof Error ? err.message : "Passkey registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSetup() {
    const setupKey = trimmedSetupKey(state);
    const nextValidation = validateSetupWizardState(state, setupKeyRequired);
    if (!nextValidation.valid) {
      setStatus(nextValidation.errors[0] ?? "Setup details need review.");
      return;
    }

    setSubmitting(true);
    setStatus("Creating practice workspace...");
    try {
      const response = await fetch(`${apiBaseUrl}/api/setup/complete`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(setupKeyRequired ? { "x-open-practice-setup-key": setupKey } : {}),
        },
        body: JSON.stringify({
          firm: { name: state.firmName.trim() },
          compliance: {
            trustFundsCaveatAccepted: state.trustFundsCaveatAccepted,
          },
          owner: {
            displayName: state.ownerName.trim(),
            email: state.ownerEmail.trim(),
            password: state.ownerPassword,
            webAuthn: state.webAuthnCredential,
          },
        }),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { message?: string } | null;
        setStatus(error?.message ?? `Setup failed: ${response.status}`);
        setSubmitting(false);
        return;
      }

      setStatus("Setup complete.");
      window.location.reload();
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "An unexpected error occurred.");
      setSubmitting(false);
    }
  }

  const ActiveIcon = steps[step].icon;

  return (
    <main className="setup-shell legal-ops-shell">
      <section className="setup-frame setup-entry-frame" aria-labelledby="setup-title">
        <aside className="setup-rail" aria-label="Setup progress">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              OP
            </span>
            <div>
              <strong>Open Practice</strong>
              <span>First run setup</span>
            </div>
          </div>
          <div className="setup-rail-summary" aria-label="Setup readiness">
            <div>
              <span>Progress</span>
              <strong>{progressPercent}%</strong>
            </div>
            <div className="setup-progress-track" aria-hidden="true">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <small>
              {validation.valid
                ? "All required checks are ready."
                : `${validation.errors.length} check${
                    validation.errors.length === 1 ? "" : "s"
                  } open across ${unresolvedStepCount} step${
                    unresolvedStepCount === 1 ? "" : "s"
                  }.`}
            </small>
          </div>
          <nav className="setup-step-list" aria-label="Setup steps">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const isCompleted = index < step;
              const isActive = index === step;
              const errorCount = stepErrors[index]?.length ?? 0;
              return (
                <button
                  className={`setup-step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`${item.label}: step ${index + 1} of ${steps.length}${
                    isCompleted ? ", complete" : isActive ? ", current" : ""
                  }`}
                  key={item.label}
                  onClick={() => index <= step && setStep(index)}
                  type="button"
                >
                  {isCompleted ? (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  ) : (
                    <Icon size={17} aria-hidden="true" />
                  )}
                  <span>{item.label}</span>
                  {errorCount > 0 ? <em>{errorCount}</em> : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <section
          className="setup-panel"
          aria-labelledby="setup-title"
          aria-describedby="setup-step-summary"
        >
          <header className="setup-heading">
            <div className="setup-icon-box" aria-hidden="true">
              <ActiveIcon size={28} />
            </div>
            <div>
              <p className="eyebrow">
                Step {step + 1} of {steps.length}
              </p>
              <h1 id="setup-title">{steps[step].label}</h1>
              <p id="setup-step-summary" className="setup-step-summary">
                {steps[step].summary}
              </p>
              <div className="setup-step-meta" aria-label="Current step status">
                <span>
                  {currentStepErrors.length === 0
                    ? "No open checks"
                    : `${currentStepErrors.length} open check${
                        currentStepErrors.length === 1 ? "" : "s"
                      }`}
                </span>
                <span>{state.webAuthnCredential ? "Passkey ready" : "Password fallback"}</span>
              </div>
            </div>
          </header>

          <div className="setup-content-area">
            {step === 0 && (
              <section className="setup-grid setup-step-pane" aria-label="Workspace setup">
                <TextField
                  className="wide"
                  label="Workspace name"
                  placeholder="e.g. North Shore Law"
                  value={state.firmName}
                  onChange={(value) => update("firmName", value)}
                  hint="Detailed practice settings can be completed after setup."
                  error={fieldErrors.firmName}
                />
              </section>
            )}

            {step === 1 && (
              <section className="setup-grid setup-step-pane" aria-label="Initial owner account">
                <TextField
                  label="Owner name"
                  placeholder="Avery Owner"
                  value={state.ownerName}
                  onChange={(value) => update("ownerName", value)}
                  error={fieldErrors.ownerName}
                />
                <TextField
                  label="Owner email"
                  type="email"
                  placeholder="avery@example.test"
                  value={state.ownerEmail}
                  onChange={(value) => update("ownerEmail", value)}
                  error={fieldErrors.ownerEmail}
                />
                {setupKeyRequired && (
                  <TextField
                    className="wide"
                    label="System setup key"
                    type="password"
                    value={state.setupKey}
                    onChange={(value) => update("setupKey", value)}
                    hint="Whitespace is ignored when the key is submitted."
                    error={fieldErrors.setupKey}
                  />
                )}
                <TextField
                  label="Backup password"
                  type="password"
                  value={state.ownerPassword}
                  onChange={(value) => update("ownerPassword", value)}
                  hint="Minimum 8 characters."
                  error={fieldErrors.ownerPassword}
                />
                <TextField
                  label="Confirm password"
                  type="password"
                  value={state.ownerPasswordConfirmation}
                  onChange={(value) => update("ownerPasswordConfirmation", value)}
                  error={fieldErrors.ownerPasswordConfirmation}
                />
              </section>
            )}

            {step === 2 && (
              <section className="setup-grid setup-step-pane" aria-label="Security setup">
                <div
                  className={`passkey-section passkey-card wide ${
                    state.webAuthnCredential ? "verified" : ""
                  }`}
                >
                  <div className="passkey-card-copy">
                    <Fingerprint size={20} aria-hidden="true" />
                    <div>
                      <strong>{state.webAuthnCredential ? "Passkey registered" : "Passkey"}</strong>
                      <p id="passkey-hint">
                        Recommended for the initial owner. The backup password remains available.
                      </p>
                    </div>
                  </div>
                  <button
                    className={`passkey-button ${state.webAuthnCredential ? "verified" : ""}`}
                    aria-describedby="passkey-hint"
                    onClick={registerPasskey}
                    disabled={submitting || !state.ownerEmail.trim() || Boolean(ownerEmailError)}
                    type="button"
                  >
                    {submitting ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : state.webAuthnCredential ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <Fingerprint size={20} />
                    )}
                    <span>
                      {state.webAuthnCredential
                        ? "Passkey Registered"
                        : "Register a Passkey (Recommended)"}
                    </span>
                  </button>
                </div>
                <label
                  className={`check-row wide glass-card ${fieldErrors.trustFunds ? "has-error" : ""}`}
                >
                  <input
                    checked={state.trustFundsCaveatAccepted}
                    onChange={(event) => update("trustFundsCaveatAccepted", event.target.checked)}
                    type="checkbox"
                    aria-invalid={Boolean(fieldErrors.trustFunds)}
                  />
                  <span>
                    I acknowledge that trust/funds workflows are operational records and not
                    jurisdiction-certified compliance advice.
                  </span>
                  {fieldErrors.trustFunds ? (
                    <em className="field-error">{fieldErrors.trustFunds}</em>
                  ) : null}
                </label>
              </section>
            )}

            {step === 3 && (
              <section
                className="review-container setup-step-pane review-step-pane"
                aria-label="Setup review"
              >
                <div className="review-grid">
                  <ReviewCard
                    icon={Building2}
                    label="Workspace"
                    title={state.firmName || "Not set"}
                    description="Operational defaults will be created now."
                  />
                  <ReviewCard
                    icon={UserRound}
                    label="Owner"
                    title={state.ownerName || "Not set"}
                    description={state.ownerEmail || "Owner email missing"}
                    meta={state.webAuthnCredential ? "Passkey enabled" : "Password only"}
                  />
                  <ReviewCard
                    icon={KeyRound}
                    label="Setup gate"
                    title={setupKeyRequired ? "Setup key required" : "Local/private setup"}
                    description={
                      setupKeyRequired
                        ? "The key will be sent with setup and passkey requests."
                        : "No configured setup key is required for this local environment."
                    }
                  />
                </div>
                <div className="setup-review-strip" aria-label="Initialization summary">
                  <span>
                    <ListChecks size={15} aria-hidden="true" />
                    {validation.valid ? "Ready" : `${validation.errors.length} checks open`}
                  </span>
                  <span>
                    <Fingerprint size={15} aria-hidden="true" />
                    {state.webAuthnCredential ? "Passkey ready" : "Passkey optional"}
                  </span>
                  <span>
                    <ShieldCheck size={15} aria-hidden="true" />
                    {state.trustFundsCaveatAccepted ? "Acknowledged" : "Acknowledgement needed"}
                  </span>
                </div>

                {validation.errors.length > 0 ? (
                  <div className="setup-errors-box">
                    <AlertCircle size={20} aria-hidden="true" />
                    <h3>Please address the following:</h3>
                    <ul>
                      {validation.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="setup-ready-banner">
                    <CheckCircle2 size={24} />
                    <div>
                      <strong>Ready to initialize</strong>
                      <p>Your workspace will be created with editable operational defaults.</p>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          <footer className="setup-actions-bar">
            <div
              className="status-message"
              id="setup-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {submitting && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
              <span>{status}</span>
            </div>
            <div className="button-group">
              <button
                className="secondary-button"
                disabled={step === 0 || submitting}
                onClick={() => setStep(step - 1)}
                type="button"
              >
                <ChevronLeft size={18} aria-hidden="true" />
                <span>Back</span>
              </button>
              {step < steps.length - 1 ? (
                <button
                  className="primary-button"
                  disabled={submitting}
                  onClick={() => setStep(step + 1)}
                  type="button"
                >
                  <span>Next Step</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              ) : (
                <button
                  className="primary-button highlight"
                  disabled={submitting || !validation.valid}
                  onClick={submitSetup}
                  type="button"
                >
                  <span>Complete Setup</span>
                  <CheckCircle2 size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </footer>
        </section>
      </section>
    </main>
  );
}

function TextField({
  label,
  onChange,
  type = "text",
  value,
  placeholder,
  className = "",
  hint,
  error,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
  placeholder?: string;
  className?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className={`form-field ${className} ${error ? "has-error" : ""}`}>
      <span>{label}</span>
      <input
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      <FieldMessage hint={hint} error={error} />
    </label>
  );
}

function FieldMessage({ hint, error }: { hint?: string; error?: string }) {
  if (error) return <em className="field-error">{error}</em>;
  if (hint) return <small className="field-hint">{hint}</small>;
  return null;
}

function ReviewCard({
  icon: Icon,
  label,
  title,
  description,
  meta,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  title: string;
  description?: string;
  meta?: string;
}) {
  return (
    <div className="review-card-item">
      <div className="card-header">
        <Icon size={16} />
        <span>{label}</span>
      </div>
      <div className="card-body">
        <strong>{title}</strong>
        {description && <p>{description}</p>}
        {meta && <span className="meta-tag">{meta}</span>}
      </div>
    </div>
  );
}
