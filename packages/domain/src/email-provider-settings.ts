import { z } from "zod";
import type { ProviderSettingRecord } from "./operations.js";

export const SMTP_PROVIDER_KEY = "default";
export const IMAP_INBOUND_PROVIDER_KEY = "imap";
export const IMAP_POLL_JOB_NAME = "poll_imap_mailbox";
export const INBOUND_EMAIL_PARSE_JOB_NAME = "parse_inbound_email";
export const SMTP_PROVIDER_CONFIG_VERSION = 1;
export const IMAP_PROVIDER_CONFIG_VERSION = 1;
export const DEFAULT_IMAP_MAILBOX = "INBOX";
export const DEFAULT_IMAP_POLL_INTERVAL_SECONDS = 300;

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).max(2048).optional());

const isoDateTime = z.string().datetime();

export const smtpProviderConfigSchema = z.object({
  version: z.literal(SMTP_PROVIDER_CONFIG_VERSION).default(SMTP_PROVIDER_CONFIG_VERSION),
  host: optionalTrimmedString,
  port: z.number().int().min(1).max(65_535).optional(),
  secure: z.boolean().default(false),
  username: optionalTrimmedString,
  password: optionalTrimmedString,
  fromAddress: optionalTrimmedString,
});

export const imapProviderStateSchema = z.object({
  uidValidity: z.number().int().nonnegative().optional(),
  lastSuccessfullyQueuedUid: z.number().int().nonnegative().optional(),
  lastPollAt: isoDateTime.optional(),
  lastSuccessfulPollAt: isoDateTime.optional(),
  nextPollAt: isoDateTime.optional(),
});

export const imapProviderConfigSchema = z.object({
  version: z.literal(IMAP_PROVIDER_CONFIG_VERSION).default(IMAP_PROVIDER_CONFIG_VERSION),
  host: optionalTrimmedString,
  port: z.number().int().min(1).max(65_535).optional(),
  secure: z.boolean().default(true),
  username: optionalTrimmedString,
  password: optionalTrimmedString,
  mailbox: optionalTrimmedString.default(DEFAULT_IMAP_MAILBOX),
  pollIntervalSeconds: z
    .number()
    .int()
    .min(60)
    .max(86_400)
    .default(DEFAULT_IMAP_POLL_INTERVAL_SECONDS),
  markSeen: z.boolean().default(false),
  state: imapProviderStateSchema.default({}),
});

export type SmtpProviderConfig = z.infer<typeof smtpProviderConfigSchema>;
export type ImapProviderState = z.infer<typeof imapProviderStateSchema>;
export type ImapProviderConfig = z.infer<typeof imapProviderConfigSchema>;

export type CompleteSmtpProviderConfig = SmtpProviderConfig & {
  host: string;
  port: number;
  fromAddress: string;
};

export type CompleteImapProviderConfig = ImapProviderConfig & {
  host: string;
  port: number;
  username: string;
  password: string;
  mailbox: string;
};

export interface RedactedSmtpProviderSettings {
  key: string;
  enabled: boolean;
  host?: string;
  port?: number;
  secure: boolean;
  username?: string;
  fromAddress?: string;
  passwordConfigured: boolean;
  configValid: boolean;
  missingFields: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RedactedImapProviderSettings {
  key: string;
  enabled: boolean;
  host?: string;
  port?: number;
  secure: boolean;
  username?: string;
  mailbox: string;
  pollIntervalSeconds: number;
  markSeen: boolean;
  passwordConfigured: boolean;
  uidValidity?: number;
  lastSuccessfullyQueuedUid?: number;
  lastPollAt?: string;
  lastSuccessfulPollAt?: string;
  nextPollAt?: string;
  configValid: boolean;
  missingFields: string[];
  createdAt?: string;
  updatedAt?: string;
}

function parseConfigJson(rawConfig: string): unknown {
  const trimmed = rawConfig.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed);
}

export function parseSmtpProviderConfig(rawConfig: string): SmtpProviderConfig {
  return smtpProviderConfigSchema.parse(parseConfigJson(rawConfig));
}

export function parseImapProviderConfig(rawConfig: string): ImapProviderConfig {
  return imapProviderConfigSchema.parse(parseConfigJson(rawConfig));
}

export function safeParseSmtpProviderConfig(rawConfig: string): SmtpProviderConfig | undefined {
  try {
    return parseSmtpProviderConfig(rawConfig);
  } catch {
    return undefined;
  }
}

export function safeParseImapProviderConfig(rawConfig: string): ImapProviderConfig | undefined {
  try {
    return parseImapProviderConfig(rawConfig);
  } catch {
    return undefined;
  }
}

export function smtpProviderMissingFields(config: SmtpProviderConfig | undefined): string[] {
  if (!config) return ["config"];
  const missing: string[] = [];
  if (!config.host) missing.push("host");
  if (!config.port) missing.push("port");
  if (!config.fromAddress) missing.push("fromAddress");
  if (config.username && !config.password) missing.push("password");
  if (config.password && !config.username) missing.push("username");
  return missing;
}

export function imapProviderMissingFields(config: ImapProviderConfig | undefined): string[] {
  if (!config) return ["config"];
  const missing: string[] = [];
  if (!config.host) missing.push("host");
  if (!config.port) missing.push("port");
  if (!config.username) missing.push("username");
  if (!config.password) missing.push("password");
  if (!config.mailbox) missing.push("mailbox");
  return missing;
}

export function requireCompleteSmtpProviderConfig(
  config: SmtpProviderConfig | undefined,
): CompleteSmtpProviderConfig {
  const missing = smtpProviderMissingFields(config);
  if (!config || missing.length > 0) {
    throw new Error(`SMTP provider settings are incomplete: ${missing.join(", ")}`);
  }
  return config as CompleteSmtpProviderConfig;
}

export function requireCompleteImapProviderConfig(
  config: ImapProviderConfig | undefined,
): CompleteImapProviderConfig {
  const missing = imapProviderMissingFields(config);
  if (!config || missing.length > 0) {
    throw new Error(`IMAP provider settings are incomplete: ${missing.join(", ")}`);
  }
  return config as CompleteImapProviderConfig;
}

export function serializeSmtpProviderConfig(config: SmtpProviderConfig): string {
  return JSON.stringify(smtpProviderConfigSchema.parse(config));
}

export function serializeImapProviderConfig(config: ImapProviderConfig): string {
  return JSON.stringify(imapProviderConfigSchema.parse(config));
}

export function redactSmtpProviderSettings(
  setting: ProviderSettingRecord | undefined,
): RedactedSmtpProviderSettings {
  const config = setting ? safeParseSmtpProviderConfig(setting.encryptedConfig) : undefined;
  const missingFields = smtpProviderMissingFields(config);
  return {
    key: setting?.key ?? SMTP_PROVIDER_KEY,
    enabled: Boolean(setting?.enabled),
    host: config?.host,
    port: config?.port,
    secure: config?.secure ?? false,
    username: config?.username,
    fromAddress: config?.fromAddress,
    passwordConfigured: Boolean(config?.password),
    configValid: missingFields.length === 0,
    missingFields,
    createdAt: setting?.createdAt,
    updatedAt: setting?.updatedAt,
  };
}

export function redactImapProviderSettings(
  setting: ProviderSettingRecord | undefined,
): RedactedImapProviderSettings {
  const config = setting ? safeParseImapProviderConfig(setting.encryptedConfig) : undefined;
  const missingFields = imapProviderMissingFields(config);
  return {
    key: setting?.key ?? IMAP_INBOUND_PROVIDER_KEY,
    enabled: Boolean(setting?.enabled),
    host: config?.host,
    port: config?.port,
    secure: config?.secure ?? true,
    username: config?.username,
    mailbox: config?.mailbox ?? DEFAULT_IMAP_MAILBOX,
    pollIntervalSeconds: config?.pollIntervalSeconds ?? DEFAULT_IMAP_POLL_INTERVAL_SECONDS,
    markSeen: config?.markSeen ?? false,
    passwordConfigured: Boolean(config?.password),
    uidValidity: config?.state.uidValidity,
    lastSuccessfullyQueuedUid: config?.state.lastSuccessfullyQueuedUid,
    lastPollAt: config?.state.lastPollAt,
    lastSuccessfulPollAt: config?.state.lastSuccessfulPollAt,
    nextPollAt: config?.state.nextPollAt,
    configValid: missingFields.length === 0,
    missingFields,
    createdAt: setting?.createdAt,
    updatedAt: setting?.updatedAt,
  };
}
