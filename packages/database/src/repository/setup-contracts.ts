import type {
  AuditEvent,
  Contact,
  Firm,
  FirmSettings,
  Matter,
  MatterParty,
  User,
  WebAuthnCredentialRecord,
} from "@open-practice/domain";

export interface FirstRunSetupStatus {
  required: boolean;
  blocked: boolean;
  reason?: string;
}

export type ConfiguredFirmResolution =
  | { status: "ready"; firm: Firm }
  | { status: "setup_required" }
  | { status: "blocked"; reason: string };

export interface FirstRunSetupInput {
  firm: Firm;
  settings: FirmSettings;
  owner: User;
  ownerPasswordHash: string;
  ownerPasswordUpdatedAt: string;
  webAuthnCredential?: WebAuthnCredentialRecord;
  firstContact?: Contact;
  firstMatter?: Matter;
  firstMatterParty?: MatterParty;
  selectedPresetIds?: string[];
  auditEvent: AuditEvent;
}

export interface FirstRunSetupResult {
  firm: Firm;
  settings: FirmSettings;
  owner: User;
  firstMatter?: Matter;
}

export class FirstRunSetupConflictError extends Error {
  constructor(message = "First-run setup is not available") {
    super(message);
    this.name = "FirstRunSetupConflictError";
  }
}

export interface PracticeSetupRepository {
  getSetupStatus(): Promise<FirstRunSetupStatus>;
  resolveConfiguredFirm(): Promise<ConfiguredFirmResolution>;
  completeFirstRunSetup(input: FirstRunSetupInput): Promise<FirstRunSetupResult>;
}
