import type { RegistrationResponseJSON } from "@simplewebauthn/browser";
import type { SetupStatusResponse } from "./types";

/** RegistrationResponseJSON extended with the challenge hash used for server-side lookup. */
export type SetupWebAuthnCredential = RegistrationResponseJSON & { challengeHash: string };

export type StartupView = "setup" | "blocked" | "login" | "dashboard";

export interface SetupWizardState {
  firmName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPasswordConfirmation: string;
  setupKey: string;
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

export function trimmedSetupKey(state: Pick<SetupWizardState, "setupKey">): string {
  return state.setupKey.trim();
}

export function updateSetupWizardState<K extends keyof SetupWizardState>(
  state: SetupWizardState,
  key: K,
  value: SetupWizardState[K],
): SetupWizardState {
  if (key === "ownerEmail" && state.webAuthnCredential && state.ownerEmail !== value) {
    const { webAuthnCredential: _webAuthnCredential, ...stateWithoutCredential } = state;
    return { ...stateWithoutCredential, [key]: value };
  }
  return { ...state, [key]: value };
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateSetupWizardState(
  state: SetupWizardState,
  setupKeyRequired = false,
): SetupValidationResult {
  const errors: string[] = [];

  if (!state.firmName.trim()) errors.push("Workspace name is required.");
  if (!state.ownerName.trim()) errors.push("Owner name is required.");
  if (!state.ownerEmail.trim()) errors.push("Owner email is required.");
  if (state.ownerEmail.trim() && !validEmail(state.ownerEmail)) {
    errors.push("Owner email must be a valid email address.");
  }
  if (state.ownerPassword.length < 8) errors.push("Backup password must be at least 8 characters.");
  if (state.ownerPassword !== state.ownerPasswordConfirmation) {
    errors.push("Backup password confirmation must match.");
  }
  if (setupKeyRequired && !state.setupKey.trim()) errors.push("Setup key is required.");
  if (!state.trustFundsCaveatAccepted) {
    errors.push("Trust/funds acknowledgement is required.");
  }

  return { valid: errors.length === 0, errors };
}
