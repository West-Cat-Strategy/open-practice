import {
  buildBasicDraftTemplates,
  buildPracticePresetTemplates,
  type Firm,
} from "@open-practice/domain";
import type { ProviderConfigCipher } from "../../config-encryption.js";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import {
  FirstRunSetupConflictError,
  type ConfiguredFirmResolution,
  type FirstRunSetupInput,
  type FirstRunSetupResult,
  type FirstRunSetupStatus,
} from "../setup-contracts.js";
import { contactInsert, matterPartyInsert, setupStatusFromCounts } from "../drizzle-mappers.js";
import { encryptProviderSetting } from "../provider-settings/encryption.js";

export async function getDrizzleSetupStatus(
  db: OpenPracticeDatabase,
): Promise<FirstRunSetupStatus> {
  const firms = await db.select({ id: schema.firms.id }).from(schema.firms).limit(2);
  const users = await db.select({ id: schema.users.id }).from(schema.users).limit(2);
  return setupStatusFromCounts(firms.length, users.length);
}

export async function resolveDrizzleConfiguredFirm(
  db: OpenPracticeDatabase,
): Promise<ConfiguredFirmResolution> {
  const rows = await db.select().from(schema.firms).limit(2);
  const users = await db.select({ id: schema.users.id }).from(schema.users).limit(2);
  const status = setupStatusFromCounts(rows.length, users.length);
  if (status.blocked) {
    return {
      status: "blocked",
      reason: status.reason ?? "Practice setup state requires operator review.",
    };
  }
  if (status.required) {
    return { status: "setup_required" };
  }
  if (rows.length > 1) {
    return {
      status: "blocked",
      reason:
        "Multiple firm records found. Resolve practice records before using single-tenant authentication.",
    };
  }
  const row = rows[0];
  const firm: Firm = {
    id: row.id,
    name: row.name,
    defaultProvince: row.defaultProvince,
  };
  return { status: "ready", firm };
}

export async function completeDrizzleFirstRunSetup(
  db: OpenPracticeDatabase,
  input: FirstRunSetupInput,
  providerConfigCipher?: ProviderConfigCipher,
): Promise<FirstRunSetupResult> {
  return db.transaction(async (tx) => {
    const firms = await tx.select({ id: schema.firms.id }).from(schema.firms).limit(2);
    const users = await tx.select({ id: schema.users.id }).from(schema.users).limit(2);
    const status = setupStatusFromCounts(firms.length, users.length);
    if (!status.required || status.blocked) {
      throw new FirstRunSetupConflictError(status.reason ?? "First-run setup is already complete");
    }

    await tx.insert(schema.firms).values(input.firm);
    await tx.insert(schema.users).values({
      id: input.owner.id,
      firmId: input.owner.firmId,
      displayName: input.owner.displayName,
      email: input.owner.email,
      role: input.owner.role,
      mfaEnabled: input.owner.mfaEnabled,
      practitionerProfile: input.owner.practitionerProfile || null,
    });
    await tx.insert(schema.authAccounts).values({
      firmId: input.owner.firmId,
      userId: input.owner.id,
      passwordHash: input.ownerPasswordHash,
      passwordUpdatedAt: new Date(input.ownerPasswordUpdatedAt),
    });
    await tx.insert(schema.firmSettings).values({
      firmId: input.settings.firmId,
      businessAddress: input.settings.businessAddress,
      officeEmail: input.settings.officeEmail,
      officePhone: input.settings.officePhone,
      practiceAreas: input.settings.practiceAreas,
      invoicePrefix: input.settings.invoicePrefix,
      defaultPaymentTermsDays: input.settings.defaultPaymentTermsDays,
      trustAccountLabel: input.settings.trustAccountLabel,
      trustFundsCaveatAcceptedAt: new Date(input.settings.trustFundsCaveatAcceptedAt),
      trustFundsCaveatAcceptedByUserId: input.settings.trustFundsCaveatAcceptedByUserId,
      website: input.settings.website || null,
      description: input.settings.description || null,
      businessNumber: input.settings.businessNumber || null,
      createdAt: new Date(input.settings.createdAt),
      updatedAt: new Date(input.settings.updatedAt),
    });

    if (input.firstContact) {
      await tx.insert(schema.contacts).values(contactInsert(input.firstContact));
    }
    if (input.firstMatter) {
      await tx.insert(schema.matters).values({
        ...input.firstMatter,
        openedOn: input.firstMatter.openedOn ? new Date(input.firstMatter.openedOn) : null,
        closedOn: input.firstMatter.closedOn ? new Date(input.firstMatter.closedOn) : null,
      });
      await tx.insert(schema.matterAssignments).values({
        matterId: input.firstMatter.id,
        userId: input.owner.id,
      });
    }
    if (input.firstMatterParty) {
      await tx.insert(schema.matterParties).values(matterPartyInsert(input.firstMatterParty));
    }
    if (input.webAuthnCredential) {
      await tx.insert(schema.webAuthnCredentials).values({
        ...input.webAuthnCredential,
        createdAt: new Date(input.webAuthnCredential.createdAt),
        lastUsedAt: input.webAuthnCredential.lastUsedAt
          ? new Date(input.webAuthnCredential.lastUsedAt)
          : null,
        disabledAt: input.webAuthnCredential.disabledAt
          ? new Date(input.webAuthnCredential.disabledAt)
          : null,
      });
    }
    if ((input.providerSettings ?? []).length > 0) {
      await tx.insert(schema.providerSettings).values(
        input.providerSettings!.map((setting) => {
          const encrypted = encryptProviderSetting(setting, providerConfigCipher);
          return {
            ...encrypted,
            createdAt: new Date(encrypted.createdAt),
            updatedAt: new Date(encrypted.updatedAt),
          };
        }),
      );
    }
    const presetTemplates = buildPracticePresetTemplates({
      firmId: input.firm.id,
      timestamp: input.settings.createdAt,
      selectedPresetIds: input.selectedPresetIds ?? [],
    });
    await tx.insert(schema.draftTemplates).values(
      [
        ...buildBasicDraftTemplates(input.firm.id, input.settings.createdAt),
        ...presetTemplates.draftTemplates,
      ].map((template) => ({
        ...template,
        createdAt: new Date(template.createdAt),
        updatedAt: new Date(template.updatedAt),
      })),
    );
    if (presetTemplates.intakeTemplates.length > 0) {
      await tx.insert(schema.intakeTemplates).values(
        presetTemplates.intakeTemplates.map((template) => ({
          ...template,
          createdAt: new Date(template.createdAt),
          updatedAt: new Date(template.updatedAt),
        })),
      );
    }
    await tx.insert(schema.auditEvents).values({
      ...input.auditEvent,
      occurredAt: new Date(input.auditEvent.occurredAt),
    });

    return {
      firm: input.firm,
      settings: input.settings,
      owner: input.owner,
      firstMatter: input.firstMatter,
    };
  });
}
