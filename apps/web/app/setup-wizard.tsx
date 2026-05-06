"use client";

import {
  Building2,
  CheckCircle2,
  FileText,
  Gavel,
  ShieldCheck,
  UserRound,
  Fingerprint,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  KeyRound,
  ListChecks,
} from "lucide-react";
import { useMemo, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import {
  applyPracticeSetupPreset,
  practiceSetupPresets,
  trimmedSetupKey,
  validateSetupWizardState,
  type SetupPracticePreset,
  type SetupWizardState,
} from "./setup-wizard-utils";

interface SetupWizardProps {
  apiBaseUrl: string;
  setupKeyRequired: boolean;
}

const provinces = ["BC", "ON", "CANADA", "OTHER"] as const;

const initialState: SetupWizardState = {
  firmName: "",
  defaultProvince: "BC",
  addressLine1: "",
  addressLine2: "",
  city: "",
  addressProvince: "BC",
  postalCode: "",
  country: "Canada",
  officeEmail: "",
  officePhone: "",
  practiceAreasText: "",
  invoicePrefix: "",
  defaultPaymentTermsDays: "30",
  trustAccountLabel: "",
  trustFundsCaveatAccepted: false,
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  ownerPasswordConfirmation: "",
  website: "",
  description: "",
  businessNumber: "",
  practitionerRegulator: "",
  practitionerLicenseStatus: "",
  practitionerJurisdictionsText: "",
  setupKey: "",
  createFirstMatter: false,
  clientKind: "person",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  matterTitle: "",
  matterPracticeArea: "",
  matterJurisdiction: "BC",
  selectedPresetIds: [],
};

const steps = [
  {
    label: "Firm",
    summary: "Practice identity, address, and public contact records.",
    icon: Building2,
  },
  {
    label: "Compliance",
    summary: "Practice areas, billing defaults, and trust/funds acknowledgement.",
    icon: ShieldCheck,
  },
  {
    label: "Owner",
    summary: "Owner-admin credentials, practitioner profile, and optional passkey.",
    icon: UserRound,
  },
  {
    label: "First Matter",
    summary: "Optional starter client and matter shell for immediate workspace proof.",
    icon: Gavel,
  },
  {
    label: "Review",
    summary: "Final initialization checks before creating records.",
    icon: FileText,
  },
];

const presetControlledFields = new Set<keyof SetupWizardState>([
  "practiceAreasText",
  "practitionerJurisdictionsText",
  "matterTitle",
  "matterPracticeArea",
  "matterJurisdiction",
]);

const stepErrorMatchers = [
  [
    "Firm name",
    "Business address",
    "Business city",
    "Business postal code",
    "Office email",
    "Office phone",
    "Website",
  ],
  [
    "At least one practice area",
    "Invoice prefix",
    "Default payment terms",
    "Trust account",
    "Trust/funds",
  ],
  ["Owner", "Practitioner", "Setup key"],
  ["First client", "First matter"],
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
  const [selectedPresetId, setSelectedPresetId] = useState("custom");
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
    firmName: fieldError(validation.errors, ["Firm name"]),
    addressLine1: fieldError(validation.errors, ["Business address"]),
    city: fieldError(validation.errors, ["Business city"]),
    postalCode: fieldError(validation.errors, ["Business postal code"]),
    officeEmail: fieldError(validation.errors, ["Office email"]),
    officePhone: fieldError(validation.errors, ["Office phone"]),
    website: fieldError(validation.errors, ["Website"]),
    practiceAreas: fieldError(validation.errors, ["At least one practice area"]),
    invoicePrefix: fieldError(validation.errors, ["Invoice prefix"]),
    paymentTerms: fieldError(validation.errors, ["Default payment terms"]),
    trustAccountLabel: fieldError(validation.errors, ["Trust account"]),
    trustFunds: fieldError(validation.errors, ["Trust/funds"]),
    ownerName: fieldError(validation.errors, ["Owner name"]),
    ownerEmail: ownerEmailError,
    ownerPassword: fieldError(validation.errors, ["Owner password must"]),
    ownerPasswordConfirmation: fieldError(validation.errors, ["Owner password confirmation"]),
    practitionerRegulator: fieldError(validation.errors, ["Practitioner regulator"]),
    practitionerLicenseStatus: fieldError(validation.errors, ["Practitioner license status"]),
    practitionerJurisdictions: fieldError(validation.errors, ["practitioner jurisdiction"]),
    setupKey: fieldError(validation.errors, ["Setup key"]),
    clientName: fieldError(validation.errors, ["First client name"]),
    clientEmail: fieldError(validation.errors, ["First client email"]),
    matterTitle: fieldError(validation.errors, ["First matter title"]),
    matterPracticeArea: fieldError(validation.errors, ["First matter practice area"]),
  };

  function update<K extends keyof SetupWizardState>(key: K, value: SetupWizardState[K]) {
    if (presetControlledFields.has(key)) {
      setSelectedPresetId("custom");
      setState((current) => ({ ...current, [key]: value, selectedPresetIds: [] }));
      return;
    }
    setState((current) => ({ ...current, [key]: value }));
  }

  function selectPreset(preset: SetupPracticePreset) {
    setSelectedPresetId(preset.id);
    setState((current) => applyPracticeSetupPreset(current, preset));
    setStatus(`${preset.label} preset applied. You can edit every field before setup.`);
  }

  function selectCustomPreset() {
    setSelectedPresetId("custom");
    setState((current) => ({ ...current, selectedPresetIds: [] }));
    setStatus("Manual setup selected. Existing field values are unchanged.");
  }

  async function registerPasskey() {
    const setupKey = trimmedSetupKey(state);
    const ownerEmail = state.ownerEmail.trim();
    if (!ownerEmail) {
      setStatus("Please enter your email first.");
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
          selectedPresetIds: state.selectedPresetIds,
          firm: {
            name: state.firmName.trim(),
            defaultProvince: state.defaultProvince,
          },
          businessAddress: {
            line1: state.addressLine1.trim(),
            line2: state.addressLine2.trim() || undefined,
            city: state.city.trim(),
            province: state.addressProvince,
            postalCode: state.postalCode.trim(),
            country: state.country.trim() || "Canada",
          },
          office: {
            email: state.officeEmail.trim(),
            phone: state.officePhone.trim(),
          },
          settings: {
            practiceAreas: nextValidation.practiceAreas,
            invoicePrefix: state.invoicePrefix.trim(),
            defaultPaymentTermsDays: Number(state.defaultPaymentTermsDays),
            trustAccountLabel: state.trustAccountLabel.trim(),
            website: state.website.trim() || undefined,
            description: state.description.trim() || undefined,
            businessNumber: state.businessNumber.trim() || undefined,
          },
          compliance: {
            trustFundsCaveatAccepted: state.trustFundsCaveatAccepted,
          },
          owner: {
            displayName: state.ownerName.trim(),
            email: state.ownerEmail.trim(),
            password: state.ownerPassword,
            webAuthn: state.webAuthnCredential,
            practitionerProfile: {
              regulator: state.practitionerRegulator.trim(),
              licenseStatus: state.practitionerLicenseStatus.trim(),
              jurisdictions: nextValidation.jurisdictions,
            },
          },
          firstMatter: state.createFirstMatter
            ? {
                client: {
                  kind: state.clientKind,
                  displayName: state.clientName.trim(),
                  email: state.clientEmail.trim() || undefined,
                  phone: state.clientPhone.trim() || undefined,
                },
                title: state.matterTitle.trim(),
                practiceArea: state.matterPracticeArea.trim(),
                jurisdiction: state.matterJurisdiction,
              }
            : undefined,
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
              <p className="eyebrow">Step {step + 1} of 5</p>
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
                <span>{state.selectedPresetIds.length ? "Preset applied" : "Manual fields"}</span>
              </div>
            </div>
          </header>

          <div className="setup-content-area">
            {step === 0 && (
              <section className="setup-step-pane firm-step-pane" aria-label="Firm profile">
                <PracticePresetChooser
                  selectedPresetId={selectedPresetId}
                  onSelectPreset={selectPreset}
                  onSelectCustom={selectCustomPreset}
                />
                <div className="setup-grid">
                  <TextField
                    label="Firm name"
                    placeholder="e.g. West Coast Legal"
                    value={state.firmName}
                    onChange={(value) => update("firmName", value)}
                    error={fieldErrors.firmName}
                  />
                  <SelectField
                    label="Default province"
                    value={state.defaultProvince}
                    onChange={(value) => update("defaultProvince", value)}
                  />
                  <TextField
                    className="wide"
                    label="Business address"
                    placeholder="123 Practice Lane"
                    value={state.addressLine1}
                    onChange={(value) => update("addressLine1", value)}
                    error={fieldErrors.addressLine1}
                  />
                  <TextField
                    label="Address line 2"
                    placeholder="Suite 400"
                    value={state.addressLine2}
                    onChange={(value) => update("addressLine2", value)}
                  />
                  <TextField
                    label="City"
                    value={state.city}
                    onChange={(value) => update("city", value)}
                    error={fieldErrors.city}
                  />
                  <SelectField
                    label="Address province"
                    value={state.addressProvince}
                    onChange={(value) => update("addressProvince", value)}
                  />
                  <TextField
                    label="Postal code"
                    value={state.postalCode}
                    onChange={(value) => update("postalCode", value)}
                    error={fieldErrors.postalCode}
                  />
                  <TextField
                    label="Country"
                    value={state.country}
                    onChange={(value) => update("country", value)}
                  />
                  <TextField
                    label="Office email"
                    type="email"
                    value={state.officeEmail}
                    onChange={(value) => update("officeEmail", value)}
                    error={fieldErrors.officeEmail}
                  />
                  <TextField
                    label="Office phone"
                    value={state.officePhone}
                    onChange={(value) => update("officePhone", value)}
                    error={fieldErrors.officePhone}
                  />
                  <TextField
                    label="Website"
                    placeholder="https://example.com"
                    value={state.website}
                    onChange={(value) => update("website", value)}
                    hint="Optional http(s) URL."
                    error={fieldErrors.website}
                  />
                  <TextField
                    label="Business number"
                    placeholder="BN-123456789"
                    value={state.businessNumber}
                    onChange={(value) => update("businessNumber", value)}
                  />
                  <label className="form-field wide">
                    <span>Practice description</span>
                    <textarea
                      placeholder="Short summary of your practice..."
                      onChange={(event) => update("description", event.target.value)}
                      rows={3}
                      value={state.description}
                    />
                  </label>
                </div>
              </section>
            )}

            {step === 1 && (
              <section
                className="setup-grid setup-step-pane compliance-step-pane"
                aria-label="Compliance settings"
              >
                <label
                  className={`form-field wide ${fieldErrors.practiceAreas ? "has-error" : ""}`}
                >
                  <span>Practice areas</span>
                  <textarea
                    placeholder="Enter practice areas separated by commas or new lines..."
                    onChange={(event) => update("practiceAreasText", event.target.value)}
                    rows={5}
                    value={state.practiceAreasText}
                    aria-invalid={Boolean(fieldErrors.practiceAreas)}
                  />
                  <FieldMessage
                    hint="Separate multiple areas with commas or new lines."
                    error={fieldErrors.practiceAreas}
                  />
                </label>
                <TextField
                  label="Invoice prefix"
                  placeholder="OP-"
                  value={state.invoicePrefix}
                  onChange={(value) => update("invoicePrefix", value)}
                  hint="Maximum 16 characters."
                  error={fieldErrors.invoicePrefix}
                />
                <TextField
                  label="Payment terms days"
                  type="number"
                  value={state.defaultPaymentTermsDays}
                  onChange={(value) => update("defaultPaymentTermsDays", value)}
                  hint="Whole days from 1 to 365."
                  error={fieldErrors.paymentTerms}
                />
                <TextField
                  className="wide"
                  label="Trust account label"
                  placeholder="General Trust Account"
                  value={state.trustAccountLabel}
                  onChange={(value) => update("trustAccountLabel", value)}
                  error={fieldErrors.trustAccountLabel}
                />
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

            {step === 2 && (
              <section
                className="setup-grid setup-step-pane owner-step-pane"
                aria-label="Owner account"
              >
                <TextField
                  label="Full name"
                  placeholder="John Doe"
                  value={state.ownerName}
                  onChange={(value) => update("ownerName", value)}
                  error={fieldErrors.ownerName}
                />
                <TextField
                  label="Email address"
                  type="email"
                  placeholder="john@example.com"
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
                        Optional biometric sign-in. Password setup remains available.
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

                <TextField
                  label="Regulator"
                  placeholder="e.g. Law Society of BC"
                  value={state.practitionerRegulator}
                  onChange={(value) => update("practitionerRegulator", value)}
                  error={fieldErrors.practitionerRegulator}
                />
                <TextField
                  label="License status"
                  placeholder="e.g. Active Practicing"
                  value={state.practitionerLicenseStatus}
                  onChange={(value) => update("practitionerLicenseStatus", value)}
                  error={fieldErrors.practitionerLicenseStatus}
                />
                <label
                  className={`form-field wide ${
                    fieldErrors.practitionerJurisdictions ? "has-error" : ""
                  }`}
                >
                  <span>Practitioner jurisdictions</span>
                  <textarea
                    placeholder="Enter jurisdictions separated by commas or new lines..."
                    onChange={(event) =>
                      update("practitionerJurisdictionsText", event.target.value)
                    }
                    rows={3}
                    value={state.practitionerJurisdictionsText}
                    aria-invalid={Boolean(fieldErrors.practitionerJurisdictions)}
                  />
                  <FieldMessage
                    hint="Separate multiple jurisdictions with commas or new lines."
                    error={fieldErrors.practitionerJurisdictions}
                  />
                </label>

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

            {step === 3 && (
              <section
                className="setup-grid setup-step-pane matter-step-pane"
                aria-label="Initial matter"
              >
                <label className="check-row wide glass-card highlight">
                  <input
                    checked={state.createFirstMatter}
                    onChange={(event) => update("createFirstMatter", event.target.checked)}
                    type="checkbox"
                  />
                  <span>Create an initial client and matter shell</span>
                </label>
                {state.createFirstMatter && (
                  <div className="setup-grid wide nested-grid">
                    <label className="form-field">
                      <span>Client type</span>
                      <select
                        onChange={(event) =>
                          update("clientKind", event.target.value as SetupWizardState["clientKind"])
                        }
                        value={state.clientKind}
                      >
                        <option value="person">Person</option>
                        <option value="organization">Organization</option>
                      </select>
                    </label>
                    <TextField
                      label="Client name"
                      value={state.clientName}
                      onChange={(value) => update("clientName", value)}
                      error={fieldErrors.clientName}
                    />
                    <TextField
                      label="Client email"
                      type="email"
                      value={state.clientEmail}
                      onChange={(value) => update("clientEmail", value)}
                      hint="Optional."
                      error={fieldErrors.clientEmail}
                    />
                    <TextField
                      label="Client phone"
                      value={state.clientPhone}
                      onChange={(value) => update("clientPhone", value)}
                    />
                    <TextField
                      label="Matter title"
                      placeholder="Property Purchase - Smith"
                      value={state.matterTitle}
                      onChange={(value) => update("matterTitle", value)}
                      error={fieldErrors.matterTitle}
                    />
                    <TextField
                      label="Practice area"
                      value={state.matterPracticeArea}
                      onChange={(value) => update("matterPracticeArea", value)}
                      error={fieldErrors.matterPracticeArea}
                    />
                    <SelectField
                      label="Jurisdiction"
                      value={state.matterJurisdiction}
                      onChange={(value) => update("matterJurisdiction", value)}
                    />
                  </div>
                )}
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
                    label="Firm"
                    title={state.firmName || "Not set"}
                    description={state.officeEmail || "Office email missing"}
                  />
                  <ReviewCard
                    icon={ShieldCheck}
                    label="Practice"
                    title={validation.practiceAreas.join(", ") || "No areas set"}
                    description={`${state.invoicePrefix || "No prefix"} (Prefix)`}
                  />
                  <ReviewCard
                    icon={UserRound}
                    label="Owner"
                    title={state.ownerName || "Not set"}
                    description={state.ownerEmail || "Owner email missing"}
                    meta={state.webAuthnCredential ? "Passkey enabled" : "Password only"}
                  />
                  <ReviewCard
                    icon={Gavel}
                    label="First Matter"
                    title={state.createFirstMatter ? state.matterTitle || "Not set" : "Skipped"}
                    description={state.createFirstMatter ? state.clientName : ""}
                  />
                </div>
                <div className="setup-review-strip" aria-label="Initialization summary">
                  <span>
                    <ListChecks size={15} aria-hidden="true" />
                    {validation.valid ? "Ready" : `${validation.errors.length} checks open`}
                  </span>
                  <span>
                    <KeyRound size={15} aria-hidden="true" />
                    {setupKeyRequired ? "Setup key required" : "Local setup gate"}
                  </span>
                  <span>
                    <FileText size={15} aria-hidden="true" />
                    {state.selectedPresetIds.length
                      ? `${state.selectedPresetIds.length} preset selected`
                      : "Manual template set"}
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
                      <p>Your practice environment will be configured immediately.</p>
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

function PracticePresetChooser({
  selectedPresetId,
  onSelectCustom,
  onSelectPreset,
}: {
  selectedPresetId: string;
  onSelectCustom: () => void;
  onSelectPreset: (preset: SetupPracticePreset) => void;
}) {
  return (
    <section className="preset-section" aria-labelledby="practice-preset-heading">
      <div className="section-title preset-title">
        <div>
          <p className="eyebrow">Practice presets</p>
          <h2 id="practice-preset-heading">Start from a practice shape</h2>
        </div>
        <button
          aria-pressed={selectedPresetId === "custom"}
          className={selectedPresetId === "custom" ? "preset-card selected" : "preset-card"}
          onClick={onSelectCustom}
          type="button"
        >
          <strong>Manual</strong>
          <span>Keep fields custom</span>
        </button>
      </div>
      <div className="preset-grid">
        {practiceSetupPresets.map((preset) => (
          <button
            aria-pressed={selectedPresetId === preset.id}
            className={selectedPresetId === preset.id ? "preset-card selected" : "preset-card"}
            key={preset.id}
            onClick={() => onSelectPreset(preset)}
            type="button"
          >
            <strong>{preset.label}</strong>
            <span>{preset.description}</span>
          </button>
        ))}
      </div>
    </section>
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

function SelectField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {provinces.map((province) => (
          <option key={province} value={province}>
            {province}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReviewCard({
  icon: Icon,
  label,
  title,
  description,
  meta,
}: {
  icon: React.ComponentType<{ size?: number }>;
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
