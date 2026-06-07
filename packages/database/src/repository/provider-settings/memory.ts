import type { ProviderSettingRecord } from "@open-practice/domain";
import type { ProviderConfigCipher } from "../../config-encryption.js";
import { clone } from "../contracts.js";
import type { ProviderSettingsRepository } from "../provider-settings-contracts.js";
import { decryptProviderSetting, encryptProviderSetting } from "./encryption.js";

export function listMemoryProviderSettings(
  providerSettings: ProviderSettingRecord[],
  cipher: ProviderConfigCipher | undefined,
  firmId: string,
  options: { kind?: ProviderSettingRecord["kind"] } = {},
): ProviderSettingRecord[] {
  return providerSettings
    .filter(
      (setting) => setting.firmId === firmId && (!options.kind || setting.kind === options.kind),
    )
    .map((setting) => clone(decryptProviderSetting(setting, cipher)));
}

export function upsertMemoryProviderSetting(
  providerSettings: ProviderSettingRecord[],
  cipher: ProviderConfigCipher | undefined,
  setting: ProviderSettingRecord,
): ProviderSettingRecord {
  const encryptedSetting = encryptProviderSetting(setting, cipher);
  const existingIndex = providerSettings.findIndex(
    (candidate) =>
      candidate.firmId === encryptedSetting.firmId &&
      candidate.kind === encryptedSetting.kind &&
      candidate.key === encryptedSetting.key,
  );
  if (existingIndex >= 0) {
    providerSettings[existingIndex] = clone(encryptedSetting);
  } else {
    providerSettings.push(clone(encryptedSetting));
  }
  return clone(decryptProviderSetting(encryptedSetting, cipher));
}

export function createMemoryProviderSettingsRepository(
  providerSettings: ProviderSettingRecord[],
  cipher: ProviderConfigCipher | undefined,
): ProviderSettingsRepository {
  return {
    listProviderSettings: async (firmId, options) =>
      listMemoryProviderSettings(providerSettings, cipher, firmId, options),
    upsertProviderSetting: async (setting) =>
      upsertMemoryProviderSetting(providerSettings, cipher, setting),
  };
}
