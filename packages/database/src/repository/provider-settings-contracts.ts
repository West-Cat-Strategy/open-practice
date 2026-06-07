import type { ProviderSettingRecord } from "@open-practice/domain";

export interface ProviderSettingsRepository {
  listProviderSettings(
    firmId: string,
    options?: { kind?: ProviderSettingRecord["kind"] },
  ): Promise<ProviderSettingRecord[]>;
  upsertProviderSetting(setting: ProviderSettingRecord): Promise<ProviderSettingRecord>;
}
