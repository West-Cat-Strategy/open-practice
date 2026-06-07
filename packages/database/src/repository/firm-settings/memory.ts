import type { FirmSettings } from "@open-practice/domain";
import { clone } from "../contracts.js";
import type { FirmSettingsRepository } from "../firm-settings-contracts.js";

export function getMemoryFirmSettings(
  firmSettings: FirmSettings[],
  firmId: string,
): FirmSettings | undefined {
  return clone(firmSettings.find((settings) => settings.firmId === firmId));
}

export function createMemoryFirmSettingsRepository(
  firmSettings: () => FirmSettings[],
): FirmSettingsRepository {
  return {
    getFirmSettings: async (firmId) => getMemoryFirmSettings(firmSettings(), firmId),
  };
}
