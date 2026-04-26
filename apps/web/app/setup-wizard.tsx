"use client";

import { Building2, CheckCircle2, FileText, Gavel, ShieldCheck, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
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
  const [status, setStatus] = useState("Setup not submitted.");
  const [submitting, setSubmitting] = useState(false);
  const validation = useMemo(
    () => validateSetupWizardState(state, setupKeyRequired),
    [setupKeyRequired, state],
  );

  function update<K extends keyof SetupWizardState>(key: K, value: SetupWizardState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function submitSetup() {
    const nextValidation = validateSetupWizardState(state, setupKeyRequired);
    if (!nextValidation.valid) {
      setStatus(nextValidation.errors[0] ?? "Setup details need review.");
      return;
    }

    setSubmitting(true);
    setStatus("Creating practice workspace...");
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
        },
        compliance: {
          trustFundsCaveatAccepted: state.trustFundsCaveatAccepted,
        },
        owner: {
          displayName: state.ownerName,
          email: state.ownerEmail,
          password: state.ownerPassword,
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
              <span>First run</span>
            </div>
          </div>
          <div className="setup-step-list">
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  className={index === step ? "setup-step active" : "setup-step"}
                  key={item.label}
                  onClick={() => setStep(index)}
                  type="button"
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="setup-panel">
          <div className="setup-heading">
            <ActiveIcon size={24} />
            <div>
              <p className="eyebrow">Setup</p>
              <h1 id="setup-title">{steps[step].label}</h1>
            </div>
          </div>

          {step === 0 ? (
            <div className="setup-grid">
              <TextField
                label="Firm name"
                value={state.firmName}
                onChange={(value) => update("firmName", value)}
              />
              <SelectField
                label="Default province"
                value={state.defaultProvince}
                onChange={(value) => update("defaultProvince", value)}
              />
              <TextField
                label="Business address"
                value={state.addressLine1}
                onChange={(value) => update("addressLine1", value)}
              />
              <TextField
                label="Address line 2"
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
            </div>
          ) : null}

          {step === 1 ? (
            <div className="setup-grid">
              <label className="form-field wide">
                <span>Practice areas</span>
                <textarea
                  onChange={(event) => update("practiceAreasText", event.target.value)}
                  rows={4}
                  value={state.practiceAreasText}
                />
              </label>
              <TextField
                label="Invoice prefix"
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
                label="Trust account label"
                value={state.trustAccountLabel}
                onChange={(value) => update("trustAccountLabel", value)}
              />
              <label className="check-row wide">
                <input
                  checked={state.trustFundsCaveatAccepted}
                  onChange={(event) => update("trustFundsCaveatAccepted", event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Trust/funds workflows are operational records and not jurisdiction-certified
                  compliance advice.
                </span>
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="setup-grid">
              <TextField
                label="Owner name"
                value={state.ownerName}
                onChange={(value) => update("ownerName", value)}
              />
              <TextField
                label="Owner email"
                type="email"
                value={state.ownerEmail}
                onChange={(value) => update("ownerEmail", value)}
              />
              <TextField
                label="Password"
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
              {setupKeyRequired ? (
                <TextField
                  label="Setup key"
                  type="password"
                  value={state.setupKey}
                  onChange={(value) => update("setupKey", value)}
                />
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="setup-grid">
              <label className="check-row wide">
                <input
                  checked={state.createFirstMatter}
                  onChange={(event) => update("createFirstMatter", event.target.checked)}
                  type="checkbox"
                />
                <span>Create first client/matter shell</span>
              </label>
              {state.createFirstMatter ? (
                <>
                  <label className="form-field">
                    <span>Client kind</span>
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
                    value={state.matterTitle}
                    onChange={(value) => update("matterTitle", value)}
                  />
                  <TextField
                    label="Matter practice area"
                    value={state.matterPracticeArea}
                    onChange={(value) => update("matterPracticeArea", value)}
                  />
                  <SelectField
                    label="Jurisdiction"
                    value={state.matterJurisdiction}
                    onChange={(value) => update("matterJurisdiction", value)}
                  />
                </>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="review-list">
              <ReviewRow label="Firm" value={state.firmName || "Not set"} />
              <ReviewRow label="Office" value={state.officeEmail || "Not set"} />
              <ReviewRow
                label="Practice areas"
                value={validation.practiceAreas.join(", ") || "Not set"}
              />
              <ReviewRow label="Owner" value={state.ownerEmail || "Not set"} />
              <ReviewRow
                label="First matter"
                value={state.createFirstMatter ? state.matterTitle || "Not set" : "Skipped"}
              />
              {validation.errors.length > 0 ? (
                <div className="setup-errors">
                  {validation.errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : (
                <div className="setup-ready">
                  <CheckCircle2 size={18} />
                  <span>Ready to create account.</span>
                </div>
              )}
            </div>
          ) : null}

          <footer className="setup-actions">
            <span>{status}</span>
            <div>
              <button
                className="secondary-button"
                disabled={step === 0 || submitting}
                onClick={() => setStep(step - 1)}
                type="button"
              >
                Back
              </button>
              {step < steps.length - 1 ? (
                <button
                  className="primary-button"
                  disabled={submitting}
                  onClick={() => setStep(step + 1)}
                  type="button"
                >
                  Next
                </button>
              ) : (
                <button
                  className="primary-button"
                  disabled={submitting || !validation.valid}
                  onClick={submitSetup}
                  type="button"
                >
                  Create Account
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
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input onChange={(event) => onChange(event.target.value)} type={type} value={value} />
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="review-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
