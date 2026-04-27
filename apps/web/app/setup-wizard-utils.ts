import type { SetupStatusResponse } from "./types";

export type StartupView = "setup" | "blocked" | "login" | "dashboard";

export interface SetupWizardState {
  firmName: string;
  defaultProvince: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  addressProvince: string;
  postalCode: string;
  country: string;
  officeEmail: string;
  officePhone: string;
  practiceAreasText: string;
  invoicePrefix: string;
  defaultPaymentTermsDays: string;
  trustAccountLabel: string;
  trustFundsCaveatAccepted: boolean;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPasswordConfirmation: string;
  setupKey: string;
  createFirstMatter: boolean;
  clientKind: "person" | "organization";
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  matterTitle: string;
  matterPracticeArea: string;
  matterJurisdiction: string;
  webAuthnCredential?: any;
}

export interface SetupValidationResult {
  valid: boolean;
  errors: string[];
  practiceAreas: string[];
}

export function selectStartupView(
  setupStatus: SetupStatusResponse,
  dashboardStatus: number | null,
): StartupView {
  if (setupStatus.blocked) return "blocked";
  if (setupStatus.required) return "setup";
  if (dashboardStatus === 401) return "login";
  return "dashboard";
}

export function parsePracticeAreas(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((area) => area.trim())
    .filter(Boolean);
}

export function validateSetupWizardState(
  state: SetupWizardState,
  setupKeyRequired = false,
): SetupValidationResult {
  const errors: string[] = [];
  const practiceAreas = parsePracticeAreas(state.practiceAreasText);

  if (!state.firmName.trim()) errors.push("Firm name is required.");
  if (!state.addressLine1.trim()) errors.push("Business address line 1 is required.");
  if (!state.city.trim()) errors.push("Business city is required.");
  if (!state.postalCode.trim()) errors.push("Business postal code is required.");
  if (!state.officeEmail.trim()) errors.push("Office email is required.");
  if (!state.officePhone.trim()) errors.push("Office phone is required.");
  if (practiceAreas.length === 0) errors.push("At least one practice area is required.");
  if (!state.invoicePrefix.trim()) errors.push("Invoice prefix is required.");
  if (!Number.isInteger(Number(state.defaultPaymentTermsDays))) {
    errors.push("Default payment terms must be a whole number of days.");
  }
  if (Number(state.defaultPaymentTermsDays) <= 0) {
    errors.push("Default payment terms must be positive.");
  }
  if (!state.trustAccountLabel.trim()) errors.push("Trust account label is required.");
  if (!state.trustFundsCaveatAccepted) {
    errors.push("Trust/funds caveat acknowledgement is required.");
  }
  if (!state.ownerName.trim()) errors.push("Owner name is required.");
  if (!state.ownerEmail.trim()) errors.push("Owner email is required.");
  if (state.ownerPassword.length < 8) errors.push("Owner password must be at least 8 characters.");
  if (state.ownerPassword !== state.ownerPasswordConfirmation) {
    errors.push("Owner password confirmation must match.");
  }
  if (setupKeyRequired && !state.setupKey.trim()) errors.push("Setup key is required.");

  if (state.createFirstMatter) {
    if (!state.clientName.trim()) errors.push("First client name is required.");
    if (!state.matterTitle.trim()) errors.push("First matter title is required.");
    if (!state.matterPracticeArea.trim()) errors.push("First matter practice area is required.");
  }

  return { valid: errors.length === 0, errors, practiceAreas };
}
