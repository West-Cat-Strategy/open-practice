import type { FirmSettings } from "@open-practice/domain";

export interface FirmSettingsRepository {
  getFirmSettings(firmId: string): Promise<FirmSettings | undefined>;
}
