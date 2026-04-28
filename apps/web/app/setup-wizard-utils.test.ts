import { describe, expect, it } from "vitest";
import {
  selectStartupView,
  validateSetupWizardState,
  type SetupWizardState,
} from "./setup-wizard-utils";

function state(overrides: Partial<SetupWizardState> = {}): SetupWizardState {
  return {
    firmName: "North Shore Law",
    defaultProvince: "BC",
    addressLine1: "100 Main Street",
    addressLine2: "",
    city: "Vancouver",
    addressProvince: "BC",
    postalCode: "V6B 1A1",
    country: "Canada",
    officeEmail: "office@example.test",
    officePhone: "604-555-0100",
    practiceAreasText: "Residential tenancy, Notarial services",
    invoicePrefix: "NSL",
    defaultPaymentTermsDays: "30",
    trustAccountLabel: "Pooled trust",
    trustFundsCaveatAccepted: true,
    ownerName: "Avery Owner",
    ownerEmail: "avery@example.test",
    ownerPassword: "correct horse battery staple",
    ownerPasswordConfirmation: "correct horse battery staple",
    setupKey: "",
    website: "",
    description: "",
    businessNumber: "",
    practitionerRegulator: "Law Society of BC",
    practitionerLicenseStatus: "Active",
    practitionerJurisdictionsText: "BC",
    createFirstMatter: false,
    clientKind: "person",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    matterTitle: "",
    matterPracticeArea: "",
    matterJurisdiction: "BC",
    ...overrides,
  };
}

describe("setup wizard startup and validation", () => {
  it("chooses setup, blocked, login, or dashboard from setup and auth status", () => {
    expect(
      selectStartupView({ required: true, blocked: false, setupKeyRequired: false }, null),
    ).toBe("setup");
    expect(
      selectStartupView(
        {
          required: false,
          blocked: true,
          setupKeyRequired: false,
          reason: "partial",
        },
        null,
      ),
    ).toBe("blocked");
    expect(
      selectStartupView({ required: false, blocked: false, setupKeyRequired: false }, 401),
    ).toBe("login");
    expect(
      selectStartupView({ required: false, blocked: false, setupKeyRequired: false }, 200),
    ).toBe("dashboard");
  });

  it("requires compliance-heavy setup fields", () => {
    const validation = validateSetupWizardState(
      state({
        firmName: "",
        trustFundsCaveatAccepted: false,
        practiceAreasText: "",
      }),
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "Firm name is required.",
        "At least one practice area is required.",
        "Trust/funds caveat acknowledgement is required.",
      ]),
    );
  });

  it("requires practitioner licensing details", () => {
    const validation = validateSetupWizardState(
      state({
        practitionerRegulator: "",
        practitionerLicenseStatus: "",
        practitionerJurisdictionsText: "",
      }),
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "Practitioner regulator is required.",
        "Practitioner license status is required.",
        "At least one practitioner jurisdiction is required.",
      ]),
    );
  });

  it("requires a setup key when the server asks for one", () => {
    expect(validateSetupWizardState(state(), true).errors).toContain("Setup key is required.");
    expect(validateSetupWizardState(state({ setupKey: "key" }), true).valid).toBe(true);
  });

  it("allows skipping first matter and validates it when enabled", () => {
    expect(validateSetupWizardState(state({ createFirstMatter: false })).valid).toBe(true);
    expect(validateSetupWizardState(state({ createFirstMatter: true })).errors).toEqual(
      expect.arrayContaining([
        "First client name is required.",
        "First matter title is required.",
        "First matter practice area is required.",
      ]),
    );
    expect(
      validateSetupWizardState(
        state({
          createFirstMatter: true,
          clientName: "First Client",
          matterTitle: "First file",
          matterPracticeArea: "Residential tenancy",
        }),
      ).valid,
    ).toBe(true);
  });
});
