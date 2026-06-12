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
  email?: {
    smtp?: {
      enabled: boolean;
      host?: string;
      port?: number;
      secure: boolean;
      username?: string;
      password?: string;
      fromAddress?: string;
    };
    imap?: {
      enabled: boolean;
      host?: string;
      port?: number;
      secure: boolean;
      username?: string;
      password?: string;
      mailbox?: string;
      pollIntervalSeconds?: number;
      markSeen: boolean;
    };
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
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  smtpFromAddress: string;
  imapEnabled: boolean;
  imapHost: string;
  imapPort: string;
  imapSecure: boolean;
  imapUsername: string;
  imapPassword: string;
  imapMailbox: string;
  imapPollIntervalSeconds: string;
  imapMarkSeen: boolean;
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

function validPort(value: string): boolean {
  if (!value.trim()) return false;
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65_535;
}

function validPositiveInteger(value: string): boolean {
  if (!value.trim()) return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
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
  if (state.smtpEnabled) {
    if (!state.smtpHost.trim()) errors.push("SMTP host is required when SMTP is enabled.");
    if (!validPort(state.smtpPort)) errors.push("SMTP port must be between 1 and 65535.");
    if (!state.smtpFromAddress.trim()) {
      errors.push("SMTP from address is required when SMTP is enabled.");
    }
    if (state.smtpUsername.trim() && !state.smtpPassword.trim()) {
      errors.push("SMTP password is required when an SMTP username is set.");
    }
    if (state.smtpPassword.trim() && !state.smtpUsername.trim()) {
      errors.push("SMTP username is required when an SMTP password is set.");
    }
  }
  if (state.imapEnabled) {
    if (!state.imapHost.trim()) errors.push("IMAP host is required when IMAP is enabled.");
    if (!validPort(state.imapPort)) errors.push("IMAP port must be between 1 and 65535.");
    if (!state.imapUsername.trim()) errors.push("IMAP username is required when IMAP is enabled.");
    if (!state.imapPassword.trim()) errors.push("IMAP password is required when IMAP is enabled.");
    if (!state.imapMailbox.trim()) errors.push("IMAP mailbox is required when IMAP is enabled.");
    if (!validPositiveInteger(state.imapPollIntervalSeconds)) {
      errors.push("IMAP poll interval must be a positive number of seconds.");
    }
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
  const smtpTouched =
    state.smtpEnabled ||
    Boolean(
      state.smtpHost.trim() ||
      (state.smtpPort.trim() && state.smtpPort.trim() !== "587") ||
      state.smtpSecure ||
      state.smtpUsername.trim() ||
      state.smtpPassword.trim() ||
      state.smtpFromAddress.trim(),
    );
  const imapTouched =
    state.imapEnabled ||
    Boolean(
      state.imapHost.trim() ||
      (state.imapPort.trim() && state.imapPort.trim() !== "993") ||
      !state.imapSecure ||
      state.imapUsername.trim() ||
      state.imapPassword.trim() ||
      (state.imapMailbox.trim() && state.imapMailbox.trim() !== "INBOX") ||
      (state.imapPollIntervalSeconds.trim() && state.imapPollIntervalSeconds.trim() !== "300") ||
      state.imapMarkSeen,
    );
  if (smtpTouched || imapTouched) {
    payload.email = {};
    if (smtpTouched) {
      payload.email.smtp = {
        enabled: state.smtpEnabled,
        secure: state.smtpSecure,
        ...(state.smtpHost.trim() ? { host: state.smtpHost.trim() } : {}),
        ...(state.smtpPort.trim() ? { port: Number(state.smtpPort) } : {}),
        ...(state.smtpUsername.trim() ? { username: state.smtpUsername.trim() } : {}),
        ...(state.smtpPassword.trim() ? { password: state.smtpPassword.trim() } : {}),
        ...(state.smtpFromAddress.trim() ? { fromAddress: state.smtpFromAddress.trim() } : {}),
      };
    }
    if (imapTouched) {
      payload.email.imap = {
        enabled: state.imapEnabled,
        secure: state.imapSecure,
        markSeen: state.imapMarkSeen,
        ...(state.imapHost.trim() ? { host: state.imapHost.trim() } : {}),
        ...(state.imapPort.trim() ? { port: Number(state.imapPort) } : {}),
        ...(state.imapUsername.trim() ? { username: state.imapUsername.trim() } : {}),
        ...(state.imapPassword.trim() ? { password: state.imapPassword.trim() } : {}),
        ...(state.imapMailbox.trim() ? { mailbox: state.imapMailbox.trim() } : {}),
        ...(state.imapPollIntervalSeconds.trim()
          ? { pollIntervalSeconds: Number(state.imapPollIntervalSeconds) }
          : {}),
      };
    }
  }
  return payload;
}
