import { eq } from "drizzle-orm";
import {
  normalizeDocumentDispositionReviewScheduleProfile,
  type FirmSettings,
} from "@open-practice/domain";
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

export async function updateDrizzleDispositionReviewScheduleProfile(
  db: OpenPracticeDatabase,
  input: Parameters<FirmSettingsRepository["updateDispositionReviewScheduleProfile"]>[0],
): Promise<FirmSettings> {
  const [row] = await db
    .update(schema.firmSettings)
    .set({
      dispositionReviewScheduleProfile:
        normalizeDocumentDispositionReviewScheduleProfile(input.profile) ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.firmSettings.firmId, input.firmId))
    .returning();
  if (!row) throw new Error(`Unknown firm settings ${input.firmId}`);
  return mapFirmSettingsRow(row);
}

export function createDrizzleFirmSettingsRepository(
  db: OpenPracticeDatabase,
): FirmSettingsRepository {
  return {
    getFirmSettings: (firmId) => getDrizzleFirmSettings(db, firmId),
    updateDispositionReviewScheduleProfile: (input) =>
      updateDrizzleDispositionReviewScheduleProfile(db, input),
  };
}
