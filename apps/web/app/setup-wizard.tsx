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
} from "lucide-react";
import { useMemo, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { validateSetupWizardState, type SetupWizardState } from "./setup-wizard-utils";

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
};

const steps = [
  { label: "Firm", icon: Building2 },
  { label: "Compliance", icon: ShieldCheck },
  { label: "Owner", icon: UserRound },
  { label: "First Matter", icon: Gavel },
  { label: "Review", icon: FileText },
];

export default function SetupWizard({ apiBaseUrl, setupKeyRequired }: SetupWizardProps) {
  const [state, setState] = useState<SetupWizardState>(initialState);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const validation = useMemo(
    () => validateSetupWizardState(state, setupKeyRequired),
    [setupKeyRequired, state],
  );

  function update<K extends keyof SetupWizardState>(key: K, value: SetupWizardState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function registerPasskey() {
    if (!state.ownerEmail.trim()) {
      setStatus("Please enter your email first.");
      return;
    }

    setSubmitting(true);
    setStatus("Generating passkey options...");

    try {
      const resp = await fetch(`${apiBaseUrl}/api/setup/webauthn-options`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(setupKeyRequired
            ? { "x-open-practice-setup-key": state.setupKey.trim() }
            : {}),
        },
        body: JSON.stringify({ email: state.ownerEmail }),
      });

      if (!resp.ok) throw new Error("Failed to get passkey options");

      const options = await resp.json();
      const credential = await startRegistration(options);

      update("webAuthnCredential", {
        ...credential,
        challengeHash: options.challenge,
      });
      setStatus("Passkey ready. Complete setup to finish.");
    } catch (err: any) {
      console.error(err);
      setStatus(err.message || "Passkey registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSetup() {
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
          ...(setupKeyRequired ? { "x-open-practice-setup-key": state.setupKey } : {}),
        },
        body: JSON.stringify({
          firm: {
            name: state.firmName,
            defaultProvince: state.defaultProvince,
          },
          businessAddress: {
            line1: state.addressLine1,
            line2: state.addressLine2 || undefined,
            city: state.city,
            province: state.addressProvince,
            postalCode: state.postalCode,
            country: state.country || "Canada",
          },
          office: {
            email: state.officeEmail,
            phone: state.officePhone,
          },
          settings: {
            practiceAreas: nextValidation.practiceAreas,
            invoicePrefix: state.invoicePrefix,
            defaultPaymentTermsDays: Number(state.defaultPaymentTermsDays),
            trustAccountLabel: state.trustAccountLabel,
            website: state.website || undefined,
            description: state.description || undefined,
            businessNumber: state.businessNumber || undefined,
          },
          compliance: {
            trustFundsCaveatAccepted: state.trustFundsCaveatAccepted,
          },
          owner: {
            displayName: state.ownerName,
            email: state.ownerEmail,
            password: state.ownerPassword,
            webAuthn: state.webAuthnCredential,
            practitionerProfile: {
              regulator: state.practitionerRegulator,
              licenseStatus: state.practitionerLicenseStatus,
              jurisdictions: nextValidation.jurisdictions,
            },
          },
          firstMatter: state.createFirstMatter
            ? {
                client: {
                  kind: state.clientKind,
                  displayName: state.clientName,
                  email: state.clientEmail || undefined,
                  phone: state.clientPhone || undefined,
                },
                title: state.matterTitle,
                practiceArea: state.matterPracticeArea,
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
    } catch (err: any) {
      setStatus(err.message || "An unexpected error occurred.");
      setSubmitting(false);
    }
  }

  const ActiveIcon = steps[step].icon;

  return (
    <main className="setup-shell">
      <section className="setup-frame" aria-labelledby="setup-title">
        <aside className="setup-rail">
          <div className="brand">
            <span className="brand-mark">OP</span>
            <div>
              <strong>Open Practice</strong>
              <span>First run setup</span>
            </div>
          </div>
          <nav className="setup-step-list">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const isCompleted = index < step;
              const isActive = index === step;
              return (
                <button
                  className={`setup-step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                  key={item.label}
                  onClick={() => index <= step && setStep(index)}
                  type="button"
                >
                  {isCompleted ? <CheckCircle2 size={17} /> : <Icon size={17} />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="setup-panel">
          <header className="setup-heading">
            <div className="setup-icon-box">
              <ActiveIcon size={28} />
            </div>
            <div>
              <p className="eyebrow">Step {step + 1} of 5</p>
              <h1 id="setup-title">{steps[step].label}</h1>
            </div>
          </header>

          <div className="setup-content-area">
            {step === 0 && (
              <div className="setup-grid">
                <TextField
                  label="Firm name"
                  placeholder="e.g. West Coast Legal"
                  value={state.firmName}
                  onChange={(value) => update("firmName", value)}
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
                />
                <TextField
                  label="Office phone"
                  value={state.officePhone}
                  onChange={(value) => update("officePhone", value)}
                />
                <TextField
                  label="Website"
                  placeholder="https://example.com"
                  value={state.website}
                  onChange={(value) => update("website", value)}
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
            )}

            {step === 1 && (
              <div className="setup-grid">
                <label className="form-field wide">
                  <span>Practice areas</span>
                  <textarea
                    placeholder="Enter practice areas separated by commas or new lines..."
                    onChange={(event) => update("practiceAreasText", event.target.value)}
                    rows={5}
                    value={state.practiceAreasText}
                  />
                </label>
                <TextField
                  label="Invoice prefix"
                  placeholder="OP-"
                  value={state.invoicePrefix}
                  onChange={(value) => update("invoicePrefix", value)}
                />
                <TextField
                  label="Payment terms days"
                  type="number"
                  value={state.defaultPaymentTermsDays}
                  onChange={(value) => update("defaultPaymentTermsDays", value)}
                />
                <TextField
                  className="wide"
                  label="Trust account label"
                  placeholder="General Trust Account"
                  value={state.trustAccountLabel}
                  onChange={(value) => update("trustAccountLabel", value)}
                />
                <label className="check-row wide glass-card">
                  <input
                    checked={state.trustFundsCaveatAccepted}
                    onChange={(event) => update("trustFundsCaveatAccepted", event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    I acknowledge that trust/funds workflows are operational records and not
                    jurisdiction-certified compliance advice.
                  </span>
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="setup-grid">
                <TextField
                  label="Full name"
                  placeholder="John Doe"
                  value={state.ownerName}
                  onChange={(value) => update("ownerName", value)}
                />
                <TextField
                  label="Email address"
                  type="email"
                  placeholder="john@example.com"
                  value={state.ownerEmail}
                  onChange={(value) => update("ownerEmail", value)}
                />

                <div className="passkey-section wide">
                  <button
                    className={`passkey-button ${state.webAuthnCredential ? "verified" : ""}`}
                    onClick={registerPasskey}
                    disabled={submitting || !state.ownerEmail}
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
                  <p className="field-hint">
                    Passkeys provide biometric security and a passwordless experience.
                  </p>
                </div>

                <TextField
                  label="Regulator"
                  placeholder="e.g. Law Society of BC"
                  value={state.practitionerRegulator}
                  onChange={(value) => update("practitionerRegulator", value)}
                />
                <TextField
                  label="License status"
                  placeholder="e.g. Active Practicing"
                  value={state.practitionerLicenseStatus}
                  onChange={(value) => update("practitionerLicenseStatus", value)}
                />
                <label className="form-field wide">
                  <span>Practitioner jurisdictions</span>
                  <textarea
                    placeholder="Enter jurisdictions separated by commas or new lines..."
                    onChange={(event) =>
                      update("practitionerJurisdictionsText", event.target.value)
                    }
                    rows={3}
                    value={state.practitionerJurisdictionsText}
                  />
                </label>

                <TextField
                  label="Backup password"
                  type="password"
                  value={state.ownerPassword}
                  onChange={(value) => update("ownerPassword", value)}
                />
                <TextField
                  label="Confirm password"
                  type="password"
                  value={state.ownerPasswordConfirmation}
                  onChange={(value) => update("ownerPasswordConfirmation", value)}
                />
                {setupKeyRequired && (
                  <TextField
                    className="wide"
                    label="System setup key"
                    type="password"
                    value={state.setupKey}
                    onChange={(value) => update("setupKey", value)}
                  />
                )}
              </div>
            )}

            {step === 3 && (
              <div className="setup-grid">
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
                    />
                    <TextField
                      label="Client email"
                      type="email"
                      value={state.clientEmail}
                      onChange={(value) => update("clientEmail", value)}
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
                    />
                    <TextField
                      label="Practice area"
                      value={state.matterPracticeArea}
                      onChange={(value) => update("matterPracticeArea", value)}
                    />
                    <SelectField
                      label="Jurisdiction"
                      value={state.matterJurisdiction}
                      onChange={(value) => update("matterJurisdiction", value)}
                    />
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="review-container">
                <div className="review-grid">
                  <ReviewCard
                    icon={Building2}
                    label="Firm"
                    title={state.firmName || "Not set"}
                    description={state.officeEmail}
                  />
                  <ReviewCard
                    icon={ShieldCheck}
                    label="Practice"
                    title={validation.practiceAreas.join(", ") || "No areas set"}
                    description={`${state.invoicePrefix} (Prefix)`}
                  />
                  <ReviewCard
                    icon={UserRound}
                    label="Owner"
                    title={state.ownerName || "Not set"}
                    description={state.ownerEmail}
                    meta={state.webAuthnCredential ? "Passkey enabled" : "Password only"}
                  />
                  <ReviewCard
                    icon={Gavel}
                    label="First Matter"
                    title={state.createFirstMatter ? state.matterTitle || "Not set" : "Skipped"}
                    description={state.createFirstMatter ? state.clientName : ""}
                  />
                </div>

                {validation.errors.length > 0 ? (
                  <div className="setup-errors-box">
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
              </div>
            )}
          </div>

          <footer className="setup-actions-bar">
            <div className="status-message">
              {submitting && <Loader2 className="animate-spin" size={16} />}
              <span>{status}</span>
            </div>
            <div className="button-group">
              <button
                className="secondary-button"
                disabled={step === 0 || submitting}
                onClick={() => setStep(step - 1)}
                type="button"
              >
                <ChevronLeft size={18} />
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
                  <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  className="primary-button highlight"
                  disabled={submitting || !validation.valid}
                  onClick={submitSetup}
                  type="button"
                >
                  <span>Complete Setup</span>
                  <CheckCircle2 size={18} />
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
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`form-field ${className}`}>
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
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
  icon: any;
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
