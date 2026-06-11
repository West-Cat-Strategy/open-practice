import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  IMAP_INBOUND_PROVIDER_KEY,
  imapProviderConfigSchema,
  imapProviderMissingFields,
  redactImapProviderSettings,
  type ProviderSettingRecord,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import { assertInboundEmailAccess, type InboundEmailRouteDependencies } from "./shared.js";
import { enqueueImapMailboxPoll, serializeImapPollEnqueueResult } from "./imap-polling.js";

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

export const imapSettingsBodySchema = z.object({
  enabled: z.boolean().default(false),
  host: optionalTrimmedString,
  port: z.coerce.number().int().min(1).max(65_535).optional(),
  secure: z.boolean().default(true),
  username: optionalTrimmedString,
  password: optionalPassword,
  mailbox: optionalTrimmedString.default("INBOX"),
  pollIntervalSeconds: z.coerce.number().int().min(60).max(86_400).default(300),
  markSeen: z.boolean().default(false),
});

function parseExistingImapConfig(existing: ProviderSettingRecord | undefined) {
  if (!existing) return imapProviderConfigSchema.parse({});
  try {
    const parsed = imapProviderConfigSchema.safeParse(JSON.parse(existing.encryptedConfig || "{}"));
    return parsed.success ? parsed.data : imapProviderConfigSchema.parse({});
  } catch {
    return imapProviderConfigSchema.parse({});
  }
}

function nextImapConfig(input: {
  existing: ProviderSettingRecord | undefined;
  body: z.infer<typeof imapSettingsBodySchema>;
}) {
  const existing = parseExistingImapConfig(input.existing);
  const next = imapProviderConfigSchema.parse({
    ...existing,
    host: input.body.host,
    port: input.body.port,
    secure: input.body.secure,
    username: input.body.username,
    mailbox: input.body.mailbox,
    pollIntervalSeconds: input.body.pollIntervalSeconds,
    markSeen: input.body.markSeen,
    password: input.body.password === undefined ? existing.password : input.body.password,
    state: existing.state,
  });
  if (!next.username) delete next.password;
  return next;
}

function assertEnabledImapConfigComplete(config: ReturnType<typeof nextImapConfig>): void {
  const missingFields = imapProviderMissingFields(config);
  if (missingFields.length > 0) {
    throw new ApiHttpError(
      400,
      "IMAP_SETTINGS_INCOMPLETE",
      "Enabled IMAP settings require host, port, username, password, and mailbox.",
      { missingFields },
    );
  }
}

function providerId(firmId: string): string {
  return `provider-inbound-email-${IMAP_INBOUND_PROVIDER_KEY}-${firmId}`;
}

export function registerInboundEmailImapSettingsRoutes(
  server: FastifyInstance,
  { repository, inboundEmailJobQueue }: InboundEmailRouteDependencies,
): void {
  server.get("/api/inbound-email/settings/imap", async (request) => {
    assertInboundEmailAccess(request.auth, { resource: "provider_setting", action: "read" });
    const provider = (
      await repository.listProviderSettings(request.auth.firmId, { kind: "inbound_email" })
    ).find((candidate) => candidate.key === IMAP_INBOUND_PROVIDER_KEY);
    return { settings: redactImapProviderSettings(provider) };
  });

  server.put("/api/inbound-email/settings/imap", async (request) => {
    assertInboundEmailAccess(request.auth, { resource: "provider_setting", action: "update" });
    const body = parseRequestPart(imapSettingsBodySchema, request.body, "body");
    const existing = (
      await repository.listProviderSettings(request.auth.firmId, { kind: "inbound_email" })
    ).find((candidate) => candidate.key === IMAP_INBOUND_PROVIDER_KEY);
    const config = nextImapConfig({ existing, body });
    if (body.enabled) assertEnabledImapConfigComplete(config);

    const now = new Date().toISOString();
    const saved = await repository.upsertProviderSetting({
      id: existing?.id ?? providerId(request.auth.firmId),
      firmId: request.auth.firmId,
      kind: "inbound_email",
      key: IMAP_INBOUND_PROVIDER_KEY,
      enabled: body.enabled,
      encryptedConfig: JSON.stringify(config),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    let queuedPoll;
    if (saved.enabled) {
      queuedPoll = await enqueueImapMailboxPoll({
        repository,
        inboundEmailJobQueue,
        auth: request.auth,
        reason: "settings_updated",
      });
    }

    await appendRouteAuditEvent(repository, request.auth, {
      action: "inbound_email.imap_settings_updated",
      resourceType: "provider_setting",
      resourceId: IMAP_INBOUND_PROVIDER_KEY,
      metadata: {
        kind: "inbound_email",
        provider: IMAP_INBOUND_PROVIDER_KEY,
        enabled: saved.enabled,
        passwordConfigured: redactImapProviderSettings(saved).passwordConfigured,
        pollQueued: queuedPoll?.status === "queued",
      },
    });

    return {
      settings: redactImapProviderSettings(saved),
      poll: queuedPoll ? serializeImapPollEnqueueResult(queuedPoll) : undefined,
    };
  });

  server.post("/api/inbound-email/settings/imap/poll", async (request) => {
    assertInboundEmailAccess(request.auth, { resource: "provider_setting", action: "update" });
    const provider = (
      await repository.listProviderSettings(request.auth.firmId, { kind: "inbound_email" })
    ).find((candidate) => candidate.key === IMAP_INBOUND_PROVIDER_KEY);
    const config = parseExistingImapConfig(provider);
    if (!provider?.enabled) {
      throw new ApiHttpError(
        409,
        "IMAP_SETTINGS_DISABLED",
        "IMAP polling can only be requested when IMAP settings are enabled.",
      );
    }
    assertEnabledImapConfigComplete(config);

    const poll = await enqueueImapMailboxPoll({
      repository,
      inboundEmailJobQueue,
      auth: request.auth,
      reason: "manual",
      requireQueue: true,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "inbound_email.imap_poll_requested",
      resourceType: "provider_setting",
      resourceId: IMAP_INBOUND_PROVIDER_KEY,
      metadata: {
        provider: IMAP_INBOUND_PROVIDER_KEY,
        pollQueued: poll.status === "queued",
      },
    });
    return { poll: serializeImapPollEnqueueResult(poll) };
  });
}
