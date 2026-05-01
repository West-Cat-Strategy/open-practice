import type { RegistrationResponseJSON } from "@simplewebauthn/browser";
import type { SetupStatusResponse } from "./types";

/** RegistrationResponseJSON extended with the challenge hash used for server-side lookup. */
export type SetupWebAuthnCredential = RegistrationResponseJSON & { challengeHash: string };

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
  website: string;
  description: string;
  businessNumber: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPasswordConfirmation: string;
  practitionerRegulator: string;
  practitionerLicenseStatus: string;
  practitionerJurisdictionsText: string;
  setupKey: string;
  createFirstMatter: boolean;
  clientKind: "person" | "organization";
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  matterTitle: string;
  matterPracticeArea: string;
  matterJurisdiction: string;
  selectedPresetIds: string[];
  webAuthnCredential?: SetupWebAuthnCredential;
}

export interface SetupValidationResult {
  valid: boolean;
  errors: string[];
  practiceAreas: string[];
  jurisdictions: string[];
}

interface PracticePresetSeed {
  id: string;
  name: string;
  description: string;
  jurisdictions: readonly string[];
  practiceAreas: readonly string[];
}

export interface SetupPracticePreset {
  id: string;
  label: string;
  description: string;
  practiceAreas: string[];
  practitionerJurisdictions: string[];
  firstMatterDefaults: {
    title: string;
    practiceArea: string;
    jurisdiction: string;
  };
}

const browserSafePracticePresetCatalog: readonly PracticePresetSeed[] = [
  {
    id: "general-canada",
    name: "General Canada practice",
    description: "Operational starter templates for broad Canadian matter intake and drafting.",
    jurisdictions: ["CANADA", "OTHER"],
    practiceAreas: ["General practice"],
  },
  {
    id: "bc-residential-tenancy",
    name: "BC residential tenancy",
    description: "Operational starter templates for BC rental housing matter triage.",
    jurisdictions: ["BC"],
    practiceAreas: ["Residential tenancy"],
  },
  {
    id: "bc-notarial",
    name: "BC notarial",
    description: "Operational starter templates for BC notarial appointment preparation.",
    jurisdictions: ["BC"],
    practiceAreas: ["Notarial services"],
  },
  {
    id: "canada-small-business-records",
    name: "Canada small-business records",
    description: "Operational starter templates for Canadian small-business record requests.",
    jurisdictions: ["BC", "ON", "CANADA"],
    practiceAreas: ["Business records"],
  },
];

function formatFirstMatterTitle(practiceArea: string): string {
  return `New ${practiceArea.toLowerCase()} file`;
}

function toSetupPracticePreset(preset: PracticePresetSeed): SetupPracticePreset {
  const practiceArea = preset.practiceAreas[0] ?? "General practice";
  return {
    id: preset.id,
    label: preset.name,
    description: preset.description,
    practiceAreas: [...preset.practiceAreas],
    practitionerJurisdictions: [...preset.jurisdictions],
    firstMatterDefaults: {
      title: formatFirstMatterTitle(practiceArea),
      practiceArea,
      jurisdiction: preset.jurisdictions[0] ?? "CANADA",
    },
  };
}

export const practiceSetupPresets = browserSafePracticePresetCatalog.map(toSetupPracticePreset);

export function applyPracticeSetupPreset(
  state: SetupWizardState,
  preset: SetupPracticePreset,
): SetupWizardState {
  return {
    ...state,
    practiceAreasText: preset.practiceAreas.join("\n"),
    practitionerJurisdictionsText: preset.practitionerJurisdictions.join("\n"),
    matterTitle: preset.firstMatterDefaults.title,
    matterPracticeArea: preset.firstMatterDefaults.practiceArea,
    matterJurisdiction: preset.firstMatterDefaults.jurisdiction,
    selectedPresetIds: [preset.id],
  };
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
  const jurisdictions = parsePracticeAreas(state.practitionerJurisdictionsText);

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
  if (!state.practitionerRegulator.trim()) errors.push("Practitioner regulator is required.");
  if (!state.practitionerLicenseStatus.trim())
    errors.push("Practitioner license status is required.");
  if (jurisdictions.length === 0)
    errors.push("At least one practitioner jurisdiction is required.");
  if (setupKeyRequired && !state.setupKey.trim()) errors.push("Setup key is required.");

  if (state.createFirstMatter) {
    if (!state.clientName.trim()) errors.push("First client name is required.");
    if (!state.matterTitle.trim()) errors.push("First matter title is required.");
    if (!state.matterPracticeArea.trim()) errors.push("First matter practice area is required.");
  }

  return { valid: errors.length === 0, errors, practiceAreas, jurisdictions };
}
