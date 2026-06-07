import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import type {
  ProviderSettingRecord,
  PublicConsultationIntakeNotificationSettings,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";

export const SETTINGS_KIND: ProviderSettingRecord["kind"] = "public_intake";
export const SETTINGS_KEY = "consultation";

const DEFAULT_NOTIFICATION_SETTINGS: PublicConsultationIntakeNotificationSettings = {
  enabled: false,
  senderAddress: "",
  recipientEmails: [],
  allowedOrigins: [],
};

export type StoredPublicConsultationSettings = PublicConsultationIntakeNotificationSettings & {
  submissionTokenHash?: string;
  submissionTokenRotatedAt?: string;
};

type PublicConsultationSettingsResponse = PublicConsultationIntakeNotificationSettings & {
  submissionTokenConfigured: boolean;
  submissionTokenRotatedAt?: string;
  submissionToken?: string;
};

const emailAddressSchema = z.string().trim().email().max(254);
const optionalEmailAddressSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.union([z.literal(""), z.string().email().max(254)]),
);
const originUrlSchema = z.string().trim().url().max(2048);

const settingsConfigSchema = z.object({
  enabled: z.boolean(),
  senderAddress: optionalEmailAddressSchema.default(""),
  recipientEmails: z.array(emailAddressSchema).max(10).default([]),
  allowedOrigins: z.array(originUrlSchema).max(20).default([]),
  submissionTokenHash: z.string().trim().min(32).optional(),
  submissionTokenRotatedAt: z.string().datetime().optional(),
  reviewOwnerUserId: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().min(1).optional(),
    )
    .optional(),
});

export const settingsBodySchema = settingsConfigSchema
  .omit({ submissionTokenHash: true, submissionTokenRotatedAt: true })
  .extend({
    rotateSubmissionToken: z.boolean().default(false),
  })
  .superRefine((settings, context) => {
    if (!settings.enabled) return;
    if (!settings.senderAddress) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sender address is required when public consultation intake is enabled",
        path: ["senderAddress"],
      });
    }
    if (settings.recipientEmails.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "At least one recipient email is required when public consultation intake is enabled",
        path: ["recipientEmails"],
      });
    }
    if (settings.allowedOrigins.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "At least one allowed origin is required when public consultation intake is enabled",
        path: ["allowedOrigins"],
      });
    }
  });

function compactSettings(
  settings: StoredPublicConsultationSettings,
): StoredPublicConsultationSettings {
  return {
    enabled: settings.enabled,
    senderAddress: settings.senderAddress,
    recipientEmails: settings.recipientEmails,
    allowedOrigins: settings.allowedOrigins,
    submissionTokenHash: settings.submissionTokenHash,
    submissionTokenRotatedAt: settings.submissionTokenRotatedAt,
    reviewOwnerUserId: settings.reviewOwnerUserId,
  };
}

export function publicSettingsResponse(
  settings: StoredPublicConsultationSettings,
  submissionToken?: string,
): PublicConsultationSettingsResponse {
  return {
    enabled: settings.enabled,
    senderAddress: settings.senderAddress,
    recipientEmails: settings.recipientEmails,
    allowedOrigins: settings.allowedOrigins,
    reviewOwnerUserId: settings.reviewOwnerUserId,
    submissionTokenConfigured: Boolean(settings.submissionTokenHash),
    submissionTokenRotatedAt: settings.submissionTokenRotatedAt,
    ...(submissionToken ? { submissionToken } : {}),
  };
}

function parseSettingsConfig(
  provider: ProviderSettingRecord | undefined,
): StoredPublicConsultationSettings {
  if (!provider) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
  try {
    const parsed = settingsConfigSchema.partial().parse(JSON.parse(provider.encryptedConfig));
    return compactSettings({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...parsed,
      enabled: provider.enabled && parsed.enabled === true,
    });
  } catch {
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
    };
  }
}

export async function loadNotificationSettings(
  repository: OpenPracticeRepository,
  firmId: string,
): Promise<StoredPublicConsultationSettings> {
  const providers = await repository.listProviderSettings(firmId, { kind: SETTINGS_KIND });
  return parseSettingsConfig(providers.find((provider) => provider.key === SETTINGS_KEY));
}

export async function upsertPublicConsultationIntakeNotificationSettings(
  repository: OpenPracticeRepository,
  firmId: string,
  settings: Omit<
    StoredPublicConsultationSettings,
    "submissionTokenHash" | "submissionTokenRotatedAt"
  > & {
    submissionTokenHash?: string;
    submissionTokenRotatedAt?: string;
  },
): Promise<StoredPublicConsultationSettings> {
  const validSettings = settingsConfigSchema.parse(settings);
  if (validSettings.enabled && !validSettings.submissionTokenHash) {
    throw new ApiHttpError(
      400,
      "PUBLIC_CONSULTATION_SUBMISSION_TOKEN_REQUIRED",
      "Public consultation intake requires a submission bearer token before it can be enabled",
    );
  }
  const now = new Date().toISOString();
  await repository.upsertProviderSetting({
    id: `provider-public-intake-${firmId}`,
    firmId,
    kind: SETTINGS_KIND,
    key: SETTINGS_KEY,
    enabled: validSettings.enabled,
    encryptedConfig: JSON.stringify(compactSettings(validSettings)),
    createdAt: now,
    updatedAt: now,
  });
  return validSettings;
}

export function prefixedId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
