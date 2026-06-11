"use client";

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Inbox,
  ListChecks,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  PRACTICE_PRESET_CATALOG,
  type PracticePresetId,
} from "@open-practice/domain/practice-presets";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import {
  buildSetupCompletePayload,
  selectedPracticeAreas,
  updateSetupWizardState,
  validateSetupWizardState,
  type SetupWizardState,
} from "./setup-wizard-utils";

interface SetupWizardProps {
  apiBaseUrl: string;
}

const defaultPresetIds = PRACTICE_PRESET_CATALOG.map((preset) => preset.id);

const initialState: SetupWizardState = {
  firmName: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  ownerPasswordConfirmation: "",
  selectedPresetIds: [...defaultPresetIds],
  firstMatterEnabled: true,
  firstMatterTitle: "",
  firstMatterPracticeArea: "General practice",
  firstMatterJurisdiction: "BC",
  firstMatterClientKind: "person",
  firstMatterClientName: "",
  firstMatterClientEmail: "",
  firstMatterClientPhone: "",
  smtpEnabled: false,
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: false,
  smtpUsername: "",
  smtpPassword: "",
  smtpFromAddress: "",
  imapEnabled: false,
  imapHost: "",
  imapPort: "993",
  imapSecure: true,
  imapUsername: "",
  imapPassword: "",
  imapMailbox: "INBOX",
  imapPollIntervalSeconds: "300",
  imapMarkSeen: false,
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
    label: "Email",
    summary: "Optionally configure SMTP delivery and IMAP inbound polling.",
    icon: Mail,
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
  ["Workspace name", "First matter"],
  ["Owner", "Backup password"],
  ["SMTP", "IMAP"],
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

export default function SetupWizard({ apiBaseUrl }: SetupWizardProps) {
  const [state, setState] = useState<SetupWizardState>(initialState);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const validation = useMemo(() => validateSetupWizardState(state), [state]);
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
    firstMatterTitle: fieldError(validation.errors, ["First matter title"]),
    firstMatterPracticeArea: fieldError(validation.errors, ["First matter practice area"]),
    firstMatterClientName: fieldError(validation.errors, ["First matter client name"]),
    firstMatterClientEmail: fieldError(validation.errors, ["First matter client email"]),
    smtpHost: fieldError(validation.errors, ["SMTP host"]),
    smtpPort: fieldError(validation.errors, ["SMTP port"]),
    smtpFromAddress: fieldError(validation.errors, ["SMTP from address"]),
    smtpUsername: fieldError(validation.errors, ["SMTP username"]),
    smtpPassword: fieldError(validation.errors, ["SMTP password"]),
    imapHost: fieldError(validation.errors, ["IMAP host"]),
    imapPort: fieldError(validation.errors, ["IMAP port"]),
    imapUsername: fieldError(validation.errors, ["IMAP username"]),
    imapPassword: fieldError(validation.errors, ["IMAP password"]),
    imapMailbox: fieldError(validation.errors, ["IMAP mailbox"]),
    imapPollIntervalSeconds: fieldError(validation.errors, ["IMAP poll interval"]),
    trustFunds: fieldError(validation.errors, ["Trust/funds"]),
  };
  const setupPracticeAreas = useMemo(
    () => selectedPracticeAreas(state, PRACTICE_PRESET_CATALOG),
    [state],
  );

  function update<K extends keyof SetupWizardState>(key: K, value: SetupWizardState[K]) {
    setState((current) => updateSetupWizardState(current, key, value));
  }

  function togglePreset(presetId: PracticePresetId, selected: boolean) {
    const selectedSet = new Set(state.selectedPresetIds);
    if (selected) selectedSet.add(presetId);
    else selectedSet.delete(presetId);
    update(
      "selectedPresetIds",
      defaultPresetIds.filter((id) => selectedSet.has(id)),
    );
  }

  async function registerPasskey() {
    const ownerEmail = state.ownerEmail.trim();
    if (!ownerEmail) {
      setStatus("Enter the owner email before registering a passkey.");
      return;
    }
    if (ownerEmailError) {
      setStatus("Enter a valid owner email before registering a passkey.");
      return;
    }
    setSubmitting(true);
    setStatus("Generating passkey options...");

    try {
      const resp = await fetch(`${apiBaseUrl}/api/setup/webauthn-options`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
    const nextValidation = validateSetupWizardState(state);
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
        },
        body: JSON.stringify(buildSetupCompletePayload(state, PRACTICE_PRESET_CATALOG)),
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
              const isFutureStep = index > step;
              const errorCount = stepErrors[index]?.length ?? 0;
              return (
                <button
                  className={`setup-step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                  aria-current={isActive ? "step" : undefined}
                  aria-disabled={isFutureStep}
                  aria-label={`${item.label}: step ${index + 1} of ${steps.length}${
                    isCompleted ? ", complete" : isActive ? ", current" : ", future step"
                  }`}
                  key={item.label}
                  onClick={() => {
                    if (!isFutureStep) setStep(index);
                  }}
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
                  id="setup-firm-name"
                  label="Workspace name"
                  name="firmName"
                  autoComplete="organization"
                  placeholder="e.g. North Shore Law"
                  value={state.firmName}
                  onChange={(value) => update("firmName", value)}
                  hint="Detailed practice settings can be completed after setup."
                  error={fieldErrors.firmName}
                />
                <fieldset className="setup-fieldset wide glass-card">
                  <legend>Starter templates</legend>
                  <p>
                    Select the OP-authored starter material to create with the workspace. Templates
                    stay editable after setup.
                  </p>
                  <div className="preset-grid">
                    {PRACTICE_PRESET_CATALOG.map((preset) => (
                      <label className="preset-option" key={preset.id}>
                        <input
                          checked={state.selectedPresetIds.includes(preset.id)}
                          onChange={(event) => togglePreset(preset.id, event.target.checked)}
                          type="checkbox"
                        />
                        <span>
                          <strong>{preset.name}</strong>
                          <small>{preset.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="setup-fieldset wide glass-card">
                  <legend>First matter</legend>
                  <label className="check-row first-matter-toggle">
                    <input
                      checked={state.firstMatterEnabled}
                      onChange={(event) => update("firstMatterEnabled", event.target.checked)}
                      type="checkbox"
                    />
                    <span>Create an initial matter during setup</span>
                  </label>
                  {state.firstMatterEnabled && (
                    <div className="setup-grid first-matter-grid">
                      <TextField
                        id="setup-first-matter-title"
                        label="Matter title"
                        name="firstMatterTitle"
                        placeholder="e.g. Initial consultation"
                        value={state.firstMatterTitle}
                        onChange={(value) => update("firstMatterTitle", value)}
                        error={fieldErrors.firstMatterTitle}
                      />
                      <TextField
                        id="setup-first-matter-practice-area"
                        label="Practice area"
                        name="firstMatterPracticeArea"
                        placeholder="General practice"
                        value={state.firstMatterPracticeArea}
                        onChange={(value) => update("firstMatterPracticeArea", value)}
                        error={fieldErrors.firstMatterPracticeArea}
                      />
                      <SelectField
                        id="setup-first-matter-jurisdiction"
                        label="Jurisdiction"
                        name="firstMatterJurisdiction"
                        value={state.firstMatterJurisdiction}
                        onChange={(value) => update("firstMatterJurisdiction", value)}
                        options={[
                          { label: "BC", value: "BC" },
                          { label: "Ontario", value: "ON" },
                          { label: "Canada", value: "CANADA" },
                          { label: "Other", value: "OTHER" },
                        ]}
                      />
                      <SelectField
                        id="setup-first-matter-client-kind"
                        label="Client type"
                        name="firstMatterClientKind"
                        value={state.firstMatterClientKind}
                        onChange={(value) => update("firstMatterClientKind", value)}
                        options={[
                          { label: "Person", value: "person" },
                          { label: "Organization", value: "organization" },
                        ]}
                      />
                      <TextField
                        id="setup-first-matter-client-name"
                        label="Client name"
                        name="firstMatterClientName"
                        placeholder="Client or organization"
                        value={state.firstMatterClientName}
                        onChange={(value) => update("firstMatterClientName", value)}
                        error={fieldErrors.firstMatterClientName}
                      />
                      <TextField
                        id="setup-first-matter-client-email"
                        label="Client email"
                        name="firstMatterClientEmail"
                        autoComplete="off"
                        inputMode="email"
                        passwordManagerIgnore
                        spellCheck={false}
                        value={state.firstMatterClientEmail}
                        onChange={(value) => update("firstMatterClientEmail", value)}
                        error={fieldErrors.firstMatterClientEmail}
                      />
                      <TextField
                        className="wide"
                        id="setup-first-matter-client-phone"
                        label="Client phone"
                        name="firstMatterClientPhone"
                        inputMode="tel"
                        value={state.firstMatterClientPhone}
                        onChange={(value) => update("firstMatterClientPhone", value)}
                      />
                    </div>
                  )}
                </fieldset>
              </section>
            )}

            {step === 1 && (
              <section className="setup-grid setup-step-pane" aria-label="Initial owner account">
                <TextField
                  id="setup-owner-name"
                  label="Owner name"
                  name="ownerName"
                  autoComplete="name"
                  placeholder="Avery Owner"
                  value={state.ownerName}
                  onChange={(value) => update("ownerName", value)}
                  error={fieldErrors.ownerName}
                />
                <TextField
                  id="setup-owner-email"
                  label="Owner email"
                  name="ownerEmail"
                  autoComplete="off"
                  inputMode="email"
                  passwordManagerIgnore
                  spellCheck={false}
                  placeholder="avery@example.test"
                  value={state.ownerEmail}
                  onChange={(value) => update("ownerEmail", value)}
                  error={fieldErrors.ownerEmail}
                />
                <TextField
                  id="setup-owner-password"
                  label="Backup password"
                  name="ownerPassword"
                  type="password"
                  autoComplete="new-password"
                  value={state.ownerPassword}
                  onChange={(value) => update("ownerPassword", value)}
                  hint="Minimum 8 characters."
                  error={fieldErrors.ownerPassword}
                />
                <TextField
                  id="setup-owner-password-confirmation"
                  label="Confirm password"
                  name="ownerPasswordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  value={state.ownerPasswordConfirmation}
                  onChange={(value) => update("ownerPasswordConfirmation", value)}
                  error={fieldErrors.ownerPasswordConfirmation}
                />
              </section>
            )}

            {step === 2 && (
              <section className="setup-grid setup-step-pane" aria-label="Email setup">
                <fieldset className="setup-fieldset wide glass-card">
                  <legend>Transactional SMTP</legend>
                  <label className="check-row first-matter-toggle">
                    <input
                      checked={state.smtpEnabled}
                      onChange={(event) => update("smtpEnabled", event.target.checked)}
                      type="checkbox"
                    />
                    <span>Enable SMTP delivery after setup</span>
                  </label>
                  <div className="setup-grid first-matter-grid">
                    <TextField
                      id="setup-smtp-host"
                      label="SMTP host"
                      name="smtpHost"
                      placeholder="smtp.example.test"
                      value={state.smtpHost}
                      onChange={(value) => update("smtpHost", value)}
                      error={fieldErrors.smtpHost}
                    />
                    <TextField
                      id="setup-smtp-port"
                      label="SMTP port"
                      name="smtpPort"
                      inputMode="numeric"
                      value={state.smtpPort}
                      onChange={(value) => update("smtpPort", value)}
                      error={fieldErrors.smtpPort}
                    />
                    <label className="check-row">
                      <input
                        checked={state.smtpSecure}
                        onChange={(event) => update("smtpSecure", event.target.checked)}
                        type="checkbox"
                      />
                      <span>Use implicit TLS</span>
                    </label>
                    <TextField
                      id="setup-smtp-from"
                      label="From address"
                      name="smtpFromAddress"
                      placeholder="Open Practice <no-reply@example.test>"
                      value={state.smtpFromAddress}
                      onChange={(value) => update("smtpFromAddress", value)}
                      error={fieldErrors.smtpFromAddress}
                    />
                    <TextField
                      id="setup-smtp-username"
                      label="SMTP username"
                      name="smtpUsername"
                      autoComplete="off"
                      passwordManagerIgnore
                      value={state.smtpUsername}
                      onChange={(value) => update("smtpUsername", value)}
                      error={fieldErrors.smtpUsername}
                    />
                    <TextField
                      id="setup-smtp-password"
                      label="SMTP password"
                      name="smtpPassword"
                      type="password"
                      autoComplete="new-password"
                      value={state.smtpPassword}
                      onChange={(value) => update("smtpPassword", value)}
                      error={fieldErrors.smtpPassword}
                    />
                  </div>
                </fieldset>

                <fieldset className="setup-fieldset wide glass-card">
                  <legend>Inbound IMAP</legend>
                  <label className="check-row first-matter-toggle">
                    <input
                      checked={state.imapEnabled}
                      onChange={(event) => update("imapEnabled", event.target.checked)}
                      type="checkbox"
                    />
                    <span>Enable IMAP polling after setup</span>
                  </label>
                  <div className="setup-grid first-matter-grid">
                    <TextField
                      id="setup-imap-host"
                      label="IMAP host"
                      name="imapHost"
                      placeholder="imap.example.test"
                      value={state.imapHost}
                      onChange={(value) => update("imapHost", value)}
                      error={fieldErrors.imapHost}
                    />
                    <TextField
                      id="setup-imap-port"
                      label="IMAP port"
                      name="imapPort"
                      inputMode="numeric"
                      value={state.imapPort}
                      onChange={(value) => update("imapPort", value)}
                      error={fieldErrors.imapPort}
                    />
                    <label className="check-row">
                      <input
                        checked={state.imapSecure}
                        onChange={(event) => update("imapSecure", event.target.checked)}
                        type="checkbox"
                      />
                      <span>Use TLS</span>
                    </label>
                    <TextField
                      id="setup-imap-mailbox"
                      label="Mailbox"
                      name="imapMailbox"
                      value={state.imapMailbox}
                      onChange={(value) => update("imapMailbox", value)}
                      error={fieldErrors.imapMailbox}
                    />
                    <TextField
                      id="setup-imap-username"
                      label="IMAP username"
                      name="imapUsername"
                      autoComplete="off"
                      passwordManagerIgnore
                      value={state.imapUsername}
                      onChange={(value) => update("imapUsername", value)}
                      error={fieldErrors.imapUsername}
                    />
                    <TextField
                      id="setup-imap-password"
                      label="IMAP password"
                      name="imapPassword"
                      type="password"
                      autoComplete="new-password"
                      value={state.imapPassword}
                      onChange={(value) => update("imapPassword", value)}
                      error={fieldErrors.imapPassword}
                    />
                    <TextField
                      id="setup-imap-poll-interval"
                      label="Poll interval seconds"
                      name="imapPollIntervalSeconds"
                      inputMode="numeric"
                      value={state.imapPollIntervalSeconds}
                      onChange={(value) => update("imapPollIntervalSeconds", value)}
                      error={fieldErrors.imapPollIntervalSeconds}
                    />
                    <label className="check-row">
                      <input
                        checked={state.imapMarkSeen}
                        onChange={(event) => update("imapMarkSeen", event.target.checked)}
                        type="checkbox"
                      />
                      <span>Mark fetched messages seen</span>
                    </label>
                  </div>
                </fieldset>
              </section>
            )}

            {step === 3 && (
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

            {step === 4 && (
              <section
                className="review-container setup-step-pane review-step-pane"
                aria-label="Setup review"
              >
                <div className="review-grid">
                  <ReviewCard
                    icon={Building2}
                    label="Workspace"
                    title={state.firmName || "Not set"}
                    description={`${setupPracticeAreas.join(", ")} will seed the practice settings.`}
                  />
                  <ReviewCard
                    icon={UserRound}
                    label="Owner"
                    title={state.ownerName || "Not set"}
                    description={state.ownerEmail || "Owner email missing"}
                    meta={state.webAuthnCredential ? "Passkey enabled" : "Password only"}
                  />
                  <ReviewCard
                    icon={ListChecks}
                    label="Starter material"
                    title={`${state.selectedPresetIds.length} preset${
                      state.selectedPresetIds.length === 1 ? "" : "s"
                    } selected`}
                    description={
                      state.selectedPresetIds.length > 0
                        ? "Selected OP-authored starter draft and intake templates will be created."
                        : "Only the basic drafting templates will be created."
                    }
                  />
                  <ReviewCard
                    icon={ShieldCheck}
                    label="First matter"
                    title={
                      state.firstMatterEnabled
                        ? state.firstMatterTitle || "Matter details needed"
                        : "Skipped"
                    }
                    description={
                      state.firstMatterEnabled
                        ? state.firstMatterClientName || "Client name missing"
                        : "The workspace will start without an initial matter."
                    }
                    meta={state.firstMatterEnabled ? state.firstMatterPracticeArea : undefined}
                  />
                  <ReviewCard
                    icon={Inbox}
                    label="Email"
                    title={
                      state.smtpEnabled || state.imapEnabled
                        ? `${state.smtpEnabled ? "SMTP" : ""}${
                            state.smtpEnabled && state.imapEnabled ? " + " : ""
                          }${state.imapEnabled ? "IMAP" : ""}`
                        : "Skipped"
                    }
                    description={
                      state.smtpEnabled || state.imapEnabled
                        ? "Email settings will be stored redacted and editable in Admin."
                        : "Transactional and inbound email can be configured later."
                    }
                    meta={state.imapEnabled ? `Mailbox ${state.imapMailbox || "INBOX"}` : undefined}
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
  autoComplete,
  label,
  id,
  inputMode,
  name,
  onChange,
  passwordManagerIgnore,
  spellCheck,
  type = "text",
  value,
  placeholder,
  className = "",
  hint,
  error,
}: {
  autoComplete?: string;
  label: string;
  id: string;
  inputMode?: "email" | "search" | "tel" | "text" | "url" | "none" | "numeric" | "decimal";
  name: string;
  onChange: (value: string) => void;
  passwordManagerIgnore?: boolean;
  spellCheck?: boolean;
  type?: string;
  value: string;
  placeholder?: string;
  className?: string;
  hint?: string;
  error?: string;
}) {
  const messageId = hint || error ? `${id}-message` : undefined;
  return (
    <label className={`form-field ${className} ${error ? "has-error" : ""}`}>
      <span>{label}</span>
      <input
        aria-describedby={messageId}
        aria-errormessage={error ? messageId : undefined}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        id={id}
        inputMode={inputMode}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        data-1p-ignore={passwordManagerIgnore ? "true" : undefined}
        data-bwignore={passwordManagerIgnore ? "true" : undefined}
        data-lpignore={passwordManagerIgnore ? "true" : undefined}
        data-protonpass-ignore={passwordManagerIgnore ? "true" : undefined}
        spellCheck={spellCheck}
        type={type}
        value={value}
      />
      <FieldMessage id={messageId} hint={hint} error={error} />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  id,
  name,
  onChange,
  value,
  options,
}: {
  label: string;
  id: string;
  name: string;
  onChange: (value: T) => void;
  value: T;
  options: Array<{ label: string; value: T }>;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select
        id={id}
        name={name}
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FieldMessage({ id, hint, error }: { id?: string; hint?: string; error?: string }) {
  if (error)
    return (
      <em className="field-error" id={id}>
        {error}
      </em>
    );
  if (hint)
    return (
      <small className="field-hint" id={id}>
        {hint}
      </small>
    );
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
