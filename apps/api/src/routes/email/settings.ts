import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  redactSmtpProviderSettings,
  SMTP_PROVIDER_KEY,
  smtpProviderConfigSchema,
  smtpProviderMissingFields,
  type ProviderSettingRecord,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertEmailAccess } from "./shared.js";

const optionalTrimmedString = z.preprocess((value) => {
  if (value === null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).max(2048).optional());

const optionalPassword = z.preprocess((value) => {
  if (value === null) return "";
  if (typeof value !== "string") return value;
  return value.trim();
}, z.string().max(2048).optional());

const smtpSettingsBodySchema = z.object({
  enabled: z.boolean().default(false),
  host: optionalTrimmedString,
  port: z.coerce.number().int().min(1).max(65_535).optional(),
  secure: z.boolean().default(false),
  username: optionalTrimmedString,
  password: optionalPassword,
  fromAddress: optionalTrimmedString,
});

function parseExistingSmtpConfig(existing: ProviderSettingRecord | undefined) {
  if (!existing) return smtpProviderConfigSchema.parse({});
  try {
    const parsed = smtpProviderConfigSchema.safeParse(JSON.parse(existing.encryptedConfig || "{}"));
    return parsed.success ? parsed.data : smtpProviderConfigSchema.parse({});
  } catch {
    return smtpProviderConfigSchema.parse({});
  }
}

function nextSmtpConfig(input: {
  existing: ProviderSettingRecord | undefined;
  body: z.infer<typeof smtpSettingsBodySchema>;
}) {
  const existing = parseExistingSmtpConfig(input.existing);
  const next = smtpProviderConfigSchema.parse({
    ...existing,
    host: input.body.host,
    port: input.body.port,
    secure: input.body.secure,
    username: input.body.username,
    fromAddress: input.body.fromAddress,
    password: input.body.password === undefined ? existing.password : input.body.password,
  });
  if (!next.username) delete next.password;
  return next;
}

function assertEnabledSmtpConfigComplete(config: ReturnType<typeof nextSmtpConfig>): void {
  const missingFields = smtpProviderMissingFields(config);
  if (missingFields.length > 0) {
    throw new ApiHttpError(
      400,
      "SMTP_SETTINGS_INCOMPLETE",
      "Enabled SMTP settings require host, port, sender, and complete authentication when a username is set.",
      { missingFields },
    );
  }
}

function providerId(firmId: string): string {
  return `provider-smtp-${firmId}-${SMTP_PROVIDER_KEY}`;
}

export function registerEmailSettingsRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
  server.get("/api/email/settings", async (request) => {
    assertEmailAccess(request.auth, { resource: "provider_setting", action: "read" });
    const provider = (
      await repository.listProviderSettings(request.auth.firmId, { kind: "smtp" })
    ).find((candidate) => candidate.key === SMTP_PROVIDER_KEY);
    return { settings: redactSmtpProviderSettings(provider) };
  });

  server.put("/api/email/settings", async (request) => {
    assertEmailAccess(request.auth, { resource: "provider_setting", action: "update" });
    const body = parseRequestPart(smtpSettingsBodySchema, request.body, "body");
    const existing = (
      await repository.listProviderSettings(request.auth.firmId, { kind: "smtp" })
    ).find((candidate) => candidate.key === SMTP_PROVIDER_KEY);
    const config = nextSmtpConfig({ existing, body });
    if (body.enabled) assertEnabledSmtpConfigComplete(config);

    const now = new Date().toISOString();
    const saved = await repository.upsertProviderSetting({
      id: existing?.id ?? providerId(request.auth.firmId),
      firmId: request.auth.firmId,
      kind: "smtp",
      key: SMTP_PROVIDER_KEY,
      enabled: body.enabled,
      encryptedConfig: JSON.stringify(config),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "email.settings_updated",
      resourceType: "provider_setting",
      resourceId: SMTP_PROVIDER_KEY,
      metadata: {
        kind: "smtp",
        provider: SMTP_PROVIDER_KEY,
        enabled: saved.enabled,
        passwordConfigured: redactSmtpProviderSettings(saved).passwordConfigured,
      },
    });
    return { settings: redactSmtpProviderSettings(saved) };
  });
}
