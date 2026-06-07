import type { ProviderSettingRecord } from "@open-practice/domain";
import { isEncryptedProviderConfig, type ProviderConfigCipher } from "../../config-encryption.js";

export function encryptProviderSetting(
  setting: ProviderSettingRecord,
  cipher?: ProviderConfigCipher,
): ProviderSettingRecord {
  if (!cipher) return setting;
  return {
    ...setting,
    encryptedConfig: cipher.encryptProviderConfig({
      firmId: setting.firmId,
      kind: setting.kind,
      key: setting.key,
      plaintext: setting.encryptedConfig,
    }),
  };
}

export function decryptProviderSetting(
  setting: ProviderSettingRecord,
  cipher?: ProviderConfigCipher,
): ProviderSettingRecord {
  if (!cipher) {
    if (isEncryptedProviderConfig(setting.encryptedConfig)) {
      throw new Error("OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY is required to read provider settings");
    }
    return setting;
  }
  return {
    ...setting,
    encryptedConfig: cipher.decryptProviderConfig({
      firmId: setting.firmId,
      kind: setting.kind,
      key: setting.key,
      encryptedConfig: setting.encryptedConfig,
    }),
  };
}
