import {
  buildBasicDraftTemplates,
  buildPracticePresetTemplates,
  type AuditEvent,
  type Contact,
  type DraftTemplateRecord,
  type Firm,
  type FirmSettings,
  type IntakeTemplateRecord,
  type Matter,
  type MatterParty,
  type ProviderSettingRecord,
  type User,
  type WebAuthnCredentialRecord,
} from "@open-practice/domain";
import type { ProviderConfigCipher } from "../../config-encryption.js";
import type { AuthAccountRecord } from "../auth-contracts.js";
import { clone } from "../contracts.js";
import {
  FirstRunSetupConflictError,
  type ConfiguredFirmResolution,
  type FirstRunSetupInput,
  type FirstRunSetupResult,
  type FirstRunSetupStatus,
} from "../setup-contracts.js";
import { setupStatusFromCounts } from "../drizzle-mappers.js";
import { encryptProviderSetting } from "../provider-settings/encryption.js";

export interface MemorySetupStore {
  firms: Firm[];
  users: User[];
  firmSettings: FirmSettings[];
  authAccounts: AuthAccountRecord[];
  contacts: Contact[];
  matters: Matter[];
  matterParties: MatterParty[];
  webAuthnCredentials: WebAuthnCredentialRecord[];
  draftTemplates: DraftTemplateRecord[];
  intakeTemplates: IntakeTemplateRecord[];
  auditEvents: AuditEvent[];
  providerSettings: ProviderSettingRecord[];
  providerConfigCipher?: ProviderConfigCipher;
}

export function getMemorySetupStatus(store: MemorySetupStore): FirstRunSetupStatus {
  return setupStatusFromCounts(store.firms.length, store.users.length);
}

export function resolveMemoryConfiguredFirm(store: MemorySetupStore): ConfiguredFirmResolution {
  const status = setupStatusFromCounts(store.firms.length, store.users.length);
  if (status.blocked) {
    return {
      status: "blocked",
      reason: status.reason ?? "Practice setup state requires operator review.",
    };
  }
  if (status.required) {
    return { status: "setup_required" };
  }
  if (store.firms.length > 1) {
    return {
      status: "blocked",
      reason:
        "Multiple firm records found. Resolve practice records before using single-tenant authentication.",
    };
  }
  return { status: "ready", firm: clone(store.firms[0]) };
}

export function completeMemoryFirstRunSetup(
  store: MemorySetupStore,
  input: FirstRunSetupInput,
): FirstRunSetupResult {
  const status = getMemorySetupStatus(store);
  if (!status.required || status.blocked) {
    throw new FirstRunSetupConflictError(status.reason ?? "First-run setup is already complete");
  }

  store.firms = [clone(input.firm)];
  store.users = [clone(input.owner)];
  store.firmSettings = [clone(input.settings)];
  store.authAccounts = [
    {
      firmId: input.owner.firmId,
      userId: input.owner.id,
      passwordHash: input.ownerPasswordHash,
      passwordUpdatedAt: input.ownerPasswordUpdatedAt,
    },
  ];
  if (input.firstContact) store.contacts = [clone(input.firstContact)];
  if (input.firstMatter) store.matters = [clone(input.firstMatter)];
  if (input.firstMatterParty) store.matterParties = [clone(input.firstMatterParty)];
  if (input.webAuthnCredential) store.webAuthnCredentials = [clone(input.webAuthnCredential)];
  const presetTemplates = buildPracticePresetTemplates({
    firmId: input.firm.id,
    timestamp: input.settings.createdAt,
    selectedPresetIds: input.selectedPresetIds ?? [],
  });
  store.draftTemplates = [
    ...buildBasicDraftTemplates(input.firm.id, input.settings.createdAt),
    ...presetTemplates.draftTemplates,
  ];
  store.intakeTemplates = presetTemplates.intakeTemplates;
  store.auditEvents = [clone(input.auditEvent)];
  if ((input.providerSettings ?? []).length > 0) {
    store.providerSettings.length = 0;
    store.providerSettings.push(
      ...input.providerSettings!.map((setting) =>
        clone(encryptProviderSetting(setting, store.providerConfigCipher)),
      ),
    );
  }

  return {
    firm: clone(input.firm),
    settings: clone(input.settings),
    owner: clone(input.owner),
    firstMatter: clone(input.firstMatter),
  };
}
