import { eq } from "drizzle-orm";
import type { FirmSettings } from "@open-practice/domain";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { mapFirmSettingsRow } from "../drizzle-mappers.js";
import type { FirmSettingsRepository } from "../firm-settings-contracts.js";

export async function getDrizzleFirmSettings(
  db: OpenPracticeDatabase,
  firmId: string,
): Promise<FirmSettings | undefined> {
  const [row] = await db
    .select()
    .from(schema.firmSettings)
    .where(eq(schema.firmSettings.firmId, firmId));
  return row ? mapFirmSettingsRow(row) : undefined;
}

export function createDrizzleFirmSettingsRepository(
  db: OpenPracticeDatabase,
): FirmSettingsRepository {
  return {
    getFirmSettings: (firmId) => getDrizzleFirmSettings(db, firmId),
  };
}
