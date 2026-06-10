import type { RegistrationResponseJSON } from "@simplewebauthn/browser";
import type {
  PracticePreset,
  PracticePresetId,
  Province,
} from "@open-practice/domain/practice-presets";
import type { SetupStatusResponse } from "./types";

/** RegistrationResponseJSON extended with the challenge hash used for server-side lookup. */
export type SetupWebAuthnCredential = RegistrationResponseJSON & { challengeHash: string };

export type StartupView = "setup" | "blocked" | "login" | "dashboard";
export type SetupClientKind = "person" | "organization";

export interface SetupCompletePayload {
  selectedPresetIds: PracticePresetId[];
  firm: { name: string; defaultProvince: Province };
  settings: { practiceAreas: string[] };
  compliance: { trustFundsCaveatAccepted: true };
  owner: {
    displayName: string;
    email: string;
    password: string;
    webAuthn?: SetupWebAuthnCredential;
  };
  firstMatter?: {
    client: {
      kind: SetupClientKind;
      displayName: string;
      email?: string;
      phone?: string;
    };
    title: string;
    practiceArea: string;
    jurisdiction: Province;
  };
}

export interface SetupWizardState {
  firmName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPasswordConfirmation: string;
  selectedPresetIds: PracticePresetId[];
  firstMatterEnabled: boolean;
  firstMatterTitle: string;
  firstMatterPracticeArea: string;
  firstMatterJurisdiction: Province;
  firstMatterClientKind: SetupClientKind;
  firstMatterClientName: string;
  firstMatterClientEmail: string;
  firstMatterClientPhone: string;
  trustFundsCaveatAccepted: boolean;
  webAuthnCredential?: SetupWebAuthnCredential;
}

export interface SetupValidationResult {
  valid: boolean;
  errors: string[];
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

export function updateSetupWizardState<K extends keyof SetupWizardState>(
  state: SetupWizardState,
  key: K,
  value: SetupWizardState[K],
): SetupWizardState {
  if (key === "ownerEmail" && state.webAuthnCredential && state.ownerEmail !== value) {
    const stateWithoutCredential = { ...state };
    delete stateWithoutCredential.webAuthnCredential;
    return { ...stateWithoutCredential, [key]: value };
  }
  return { ...state, [key]: value };
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateSetupWizardState(state: SetupWizardState): SetupValidationResult {
  const errors: string[] = [];

  if (!state.firmName.trim()) errors.push("Workspace name is required.");
  if (state.firstMatterEnabled) {
    if (!state.firstMatterTitle.trim()) errors.push("First matter title is required.");
    if (!state.firstMatterPracticeArea.trim())
      errors.push("First matter practice area is required.");
    if (!state.firstMatterClientName.trim()) errors.push("First matter client name is required.");
    if (state.firstMatterClientEmail.trim() && !validEmail(state.firstMatterClientEmail)) {
      errors.push("First matter client email must be a valid email address.");
    }
  }
  if (!state.ownerName.trim()) errors.push("Owner name is required.");
  if (!state.ownerEmail.trim()) errors.push("Owner email is required.");
  if (state.ownerEmail.trim() && !validEmail(state.ownerEmail)) {
    errors.push("Owner email must be a valid email address.");
  }
  if (state.ownerPassword.length < 8) errors.push("Backup password must be at least 8 characters.");
  if (state.ownerPassword !== state.ownerPasswordConfirmation) {
    errors.push("Backup password confirmation must match.");
  }
  if (!state.trustFundsCaveatAccepted) {
    errors.push("Trust/funds acknowledgement is required.");
  }

  return { valid: errors.length === 0, errors };
}

export function selectedPracticeAreas(
  state: SetupWizardState,
  presets: readonly Pick<PracticePreset, "id" | "practiceAreas">[],
): string[] {
  const selectedPresetIds = new Set(state.selectedPresetIds);
  const areas = presets
    .filter((preset) => selectedPresetIds.has(preset.id))
    .flatMap((preset) => [...preset.practiceAreas]);
  if (state.firstMatterEnabled && state.firstMatterPracticeArea.trim()) {
    areas.push(state.firstMatterPracticeArea.trim());
  }
  const uniqueAreas = [...new Set(areas.map((area) => area.trim()).filter(Boolean))];
  return uniqueAreas.length > 0 ? uniqueAreas : ["General practice"];
}

export function buildSetupCompletePayload(
  state: SetupWizardState,
  presets: readonly Pick<PracticePreset, "id" | "practiceAreas">[],
): SetupCompletePayload {
  const defaultProvince = state.firstMatterEnabled ? state.firstMatterJurisdiction : "BC";
  const selectedPresetIds = [...state.selectedPresetIds];
  const payload: SetupCompletePayload = {
    selectedPresetIds,
    firm: { name: state.firmName.trim(), defaultProvince },
    settings: { practiceAreas: selectedPracticeAreas(state, presets) },
    compliance: {
      trustFundsCaveatAccepted: true,
    },
    owner: {
      displayName: state.ownerName.trim(),
      email: state.ownerEmail.trim(),
      password: state.ownerPassword,
      webAuthn: state.webAuthnCredential,
    },
  };
  if (state.firstMatterEnabled) {
    payload.firstMatter = {
      client: {
        kind: state.firstMatterClientKind,
        displayName: state.firstMatterClientName.trim(),
        ...(state.firstMatterClientEmail.trim()
          ? { email: state.firstMatterClientEmail.trim() }
          : {}),
        ...(state.firstMatterClientPhone.trim()
          ? { phone: state.firstMatterClientPhone.trim() }
          : {}),
      },
      title: state.firstMatterTitle.trim(),
      practiceArea: state.firstMatterPracticeArea.trim(),
      jurisdiction: state.firstMatterJurisdiction,
    };
  }
  return payload;
}
