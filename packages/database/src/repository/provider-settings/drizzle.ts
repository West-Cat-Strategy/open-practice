import type { ProviderSettingRecord } from "@open-practice/domain";
import { and, asc, eq } from "drizzle-orm";
import type { ProviderConfigCipher } from "../../config-encryption.js";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { mapProviderSettingRow } from "../drizzle-mappers.js";
import type { ProviderSettingsRepository } from "../provider-settings-contracts.js";
import { decryptProviderSetting, encryptProviderSetting } from "./encryption.js";

export async function listDrizzleProviderSettings(
  db: OpenPracticeDatabase,
  cipher: ProviderConfigCipher | undefined,
  firmId: string,
  options: { kind?: ProviderSettingRecord["kind"] } = {},
): Promise<ProviderSettingRecord[]> {
  const conditions = [eq(schema.providerSettings.firmId, firmId)];
  if (options.kind) conditions.push(eq(schema.providerSettings.kind, options.kind));
  const rows = await db
    .select()
    .from(schema.providerSettings)
    .where(and(...conditions))
    .orderBy(asc(schema.providerSettings.kind), asc(schema.providerSettings.key));
  return rows.map((row) => decryptProviderSetting(mapProviderSettingRow(row), cipher));
}

export async function upsertDrizzleProviderSetting(
  db: OpenPracticeDatabase,
  cipher: ProviderConfigCipher | undefined,
  setting: ProviderSettingRecord,
): Promise<ProviderSettingRecord> {
  const encryptedSetting = encryptProviderSetting(setting, cipher);
  const [row] = await db
    .insert(schema.providerSettings)
    .values({
      ...encryptedSetting,
      createdAt: new Date(encryptedSetting.createdAt),
      updatedAt: new Date(encryptedSetting.updatedAt),
    })
    .onConflictDoUpdate({
      target: [
        schema.providerSettings.firmId,
        schema.providerSettings.kind,
        schema.providerSettings.key,
      ],
      set: {
        enabled: encryptedSetting.enabled,
        encryptedConfig: encryptedSetting.encryptedConfig,
        updatedAt: new Date(encryptedSetting.updatedAt),
      },
    })
    .returning();
  return decryptProviderSetting(mapProviderSettingRow(row), cipher);
}

export function createDrizzleProviderSettingsRepository(
  db: OpenPracticeDatabase,
  cipher: ProviderConfigCipher | undefined,
): ProviderSettingsRepository {
  return {
    listProviderSettings: (firmId, options) =>
      listDrizzleProviderSettings(db, cipher, firmId, options),
    upsertProviderSetting: (setting) => upsertDrizzleProviderSetting(db, cipher, setting),
  };
}
