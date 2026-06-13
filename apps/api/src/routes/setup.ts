import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  appendAuditEvent,
  DEFAULT_IMAP_MAILBOX,
  DEFAULT_IMAP_POLL_INTERVAL_SECONDS,
  IMAP_INBOUND_PROVIDER_KEY,
  imapProviderConfigSchema,
  imapProviderMissingFields,
  isPracticePresetId,
  SMTP_PROVIDER_KEY,
  smtpProviderConfigSchema,
  smtpProviderMissingFields,
  type ProviderSettingRecord,
} from "@open-practice/domain";
import { FirstRunSetupConflictError, type OpenPracticeRepository } from "@open-practice/database";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import { enqueueImapMailboxPoll } from "./inbound-email/imap-polling.js";
import type { ApiJobQueue } from "./types.js";

const provinceSchema = z.enum(["BC", "ON", "CANADA", "OTHER"]);

const setupWebAuthnOptionsBodySchema = z.object({
  email: z.string().email(),
});

const optionalTrimmedString = z.preprocess((value) => {
  if (value === null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).max(2048).optional());

const optionalPassword = z.preprocess((value) => {
  if (value === null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().max(2048).optional());

const setupSmtpSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  host: optionalTrimmedString,
  port: z.coerce.number().int().min(1).max(65_535).optional(),
  secure: z.boolean().default(false),
  username: optionalTrimmedString,
  password: optionalPassword,
  fromAddress: optionalTrimmedString,
});

const setupImapSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  host: optionalTrimmedString,
  port: z.coerce.number().int().min(1).max(65_535).optional(),
  secure: z.boolean().default(true),
  username: optionalTrimmedString,
  password: optionalPassword,
  mailbox: optionalTrimmedString.default(DEFAULT_IMAP_MAILBOX),
  pollIntervalSeconds: z.coerce
    .number()
    .int()
    .min(60)
    .max(86_400)
    .default(DEFAULT_IMAP_POLL_INTERVAL_SECONDS),
  markSeen: z.boolean().default(false),
});

const setupBodySchema = z.object({
  selectedPresetIds: z
    .array(
      z.string().trim().min(1).refine(isPracticePresetId, {
        message: "Unknown practice preset id",
      }),
    )
    .default([]),
  firm: z.object({
    name: z.string().trim().min(1),
    defaultProvince: provinceSchema.default("BC"),
  }),
  businessAddress: z
    .object({
      line1: z.string().trim().min(1),
      line2: z.string().trim().optional(),
      city: z.string().trim().min(1),
      province: provinceSchema,
      postalCode: z.string().trim().min(1),
      country: z.string().trim().min(1).default("Canada"),
    })
    .optional(),
  office: z
    .object({
      email: z.string().trim().email(),
      phone: z.string().trim().min(1),
    })
    .optional(),
  settings: z
    .object({
      practiceAreas: z.array(z.string().trim().min(1)).min(1).optional(),
      invoicePrefix: z.string().trim().min(1).max(16).optional(),
      defaultPaymentTermsDays: z.number().int().positive().max(365).optional(),
      trustAccountLabel: z.string().trim().min(1).optional(),
      website: z.string().trim().url().optional().or(z.literal("")),
      description: z.string().trim().optional(),
      businessNumber: z.string().trim().optional(),
    })
    .optional(),
  compliance: z.object({
    trustFundsCaveatAccepted: z.literal(true),
  }),
  owner: z.object({
    displayName: z.string().trim().min(1),
    email: z.string().trim().email(),
    password: z.string().min(8),
    webAuthn: z
      .object({
        id: z.string(),
        rawId: z.string(),
        response: z.any(),
        type: z.literal("public-key"),
        clientExtensionResults: z.any(),
        challengeHash: z.string(),
      })
      .optional(),
    practitionerProfile: z
      .object({
        regulator: z.string().trim().min(1),
        licenseStatus: z.string().trim().min(1),
        jurisdictions: z.array(z.string().trim().min(1)).min(1),
      })
      .optional(),
  }),
  firstMatter: z
    .object({
      client: z.object({
        kind: z.enum(["person", "organization"]),
        displayName: z.string().trim().min(1),
        email: z.string().trim().email().optional(),
        phone: z.string().trim().min(1).optional(),
      }),
      title: z.string().trim().min(1),
      practiceArea: z.string().trim().min(1),
      jurisdiction: provinceSchema,
    })
    .optional(),
  email: z
    .object({
      smtp: setupSmtpSettingsSchema.optional(),
      imap: setupImapSettingsSchema.optional(),
    })
    .optional(),
});
export interface SetupRouteDependencies {
  repository: OpenPracticeRepository;
  inboundEmailJobQueue?: ApiJobQueue;
  jwtSecret?: string;
  nodeEnv?: string;
  allowDockerBridgeSetup?: boolean;
  sessionTtlHours?: number;
  hashPassword: (password: string) => string;
  hashToken: (token: string, secret: string) => string;
  createSessionToken: () => string;
  sessionCookie: (token: string, expiresAt: string, secure: boolean) => string;
  rpName: string;
  rpID: string;
  origin: string;
}

const PRODUCTION_OPERATOR_LOCAL_SETUP_REASON =
  "Production first-run setup is limited to operator-local loopback access before public exposure.";

function isLoopbackAddress(address: string): boolean {
  const normalized = address
    .replace(/^::ffff:/, "")
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (normalized === "::1" || normalized === "127.0.0.1" || normalized === "localhost") {
    return true;
  }
  return normalized.startsWith("127.");
}

function isDockerBridgeGateway(address: string): boolean {
  const normalized = address.replace(/^::ffff:/, "");
  return /^172\.(1[6-9]|2\d|3[01])\.0\.1$/.test(normalized);
}

function singleHeaderValue(
  request: FastifyRequest,
  headerName: "host" | "origin",
): string | undefined {
  const value = request.headers[headerName];
  if (Array.isArray(value)) return value.length === 1 ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

function authorityHostname(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return value.split(":")[0];
  }
}

function hasProxyClientHeaders(request: FastifyRequest): boolean {
  return Object.keys(request.headers).some((headerName) => {
    const normalized = headerName.toLowerCase();
    return (
      normalized === "forwarded" ||
      normalized === "x-real-ip" ||
      normalized.startsWith("x-forwarded-")
    );
  });
}

function hasLoopbackHostHeader(request: FastifyRequest): boolean {
  const hostname = authorityHostname(singleHeaderValue(request, "host"));
  return Boolean(hostname && isLoopbackAddress(hostname));
}

function hasLoopbackOriginHeader(request: FastifyRequest): boolean {
  const header = request.headers.origin;
  if (header === undefined) return true;
  if (Array.isArray(header) && header.length !== 1) return false;
  const origin = Array.isArray(header) ? header[0] : header;
  if (typeof origin !== "string" || !origin.trim()) return false;
  try {
    return isLoopbackAddress(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function isProductionOperatorLocalRequest(request: FastifyRequest): boolean {
  return (
    isLoopbackAddress(request.ip) &&
    hasLoopbackHostHeader(request) &&
    hasLoopbackOriginHeader(request) &&
    !hasProxyClientHeaders(request)
  );
}

function setupGateFailureReason(
  request: FastifyRequest,
  options: SetupRouteDependencies,
): string | undefined {
  if (options.nodeEnv === "production") {
    return isProductionOperatorLocalRequest(request)
      ? undefined
      : PRODUCTION_OPERATOR_LOCAL_SETUP_REASON;
  }
  if (
    !isLoopbackAddress(request.ip) &&
    !(options.allowDockerBridgeSetup && isDockerBridgeGateway(request.ip))
  ) {
    return "First-run setup is limited to loopback access";
  }
  return undefined;
}

function assertSetupGate(request: FastifyRequest, options: SetupRouteDependencies): void {
  const reason = setupGateFailureReason(request, options);
  if (reason) throw Object.assign(new Error(reason), { statusCode: 403 });
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function id(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function firmId(name: string): string {
  const slug = slugify(name) || "practice";
  return `firm-${slug}-${randomUUID().slice(0, 8)}`;
}

function invoicePrefixFromFirmName(name: string): string {
  const prefix = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 16);
  return prefix || "OP";
}

function setupProviderSettings(input: {
  firmId: string;
  nowIso: string;
  email: z.infer<typeof setupBodySchema>["email"];
}): ProviderSettingRecord[] {
  const settings: ProviderSettingRecord[] = [];
  if (input.email?.smtp) {
    const config = smtpProviderConfigSchema.parse(input.email.smtp);
    const missingFields = smtpProviderMissingFields(config);
    if (input.email.smtp.enabled && missingFields.length > 0) {
      throw new ApiHttpError(
        400,
        "SMTP_SETTINGS_INCOMPLETE",
        "Enabled SMTP settings require host, port, sender, and complete authentication when a username is set.",
        { missingFields },
      );
    }
    settings.push({
      id: `provider-smtp-${input.firmId}-${SMTP_PROVIDER_KEY}`,
      firmId: input.firmId,
      kind: "smtp",
      key: SMTP_PROVIDER_KEY,
      enabled: input.email.smtp.enabled,
      encryptedConfig: JSON.stringify(config),
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    });
  }
  if (input.email?.imap) {
    const config = imapProviderConfigSchema.parse({ ...input.email.imap, state: {} });
    const missingFields = imapProviderMissingFields(config);
    if (input.email.imap.enabled && missingFields.length > 0) {
      throw new ApiHttpError(
        400,
        "IMAP_SETTINGS_INCOMPLETE",
        "Enabled IMAP settings require host, port, username, password, and mailbox.",
        { missingFields },
      );
    }
    settings.push({
      id: `provider-inbound-email-${IMAP_INBOUND_PROVIDER_KEY}-${input.firmId}`,
      firmId: input.firmId,
      kind: "inbound_email",
      key: IMAP_INBOUND_PROVIDER_KEY,
      enabled: input.email.imap.enabled,
      encryptedConfig: JSON.stringify(config),
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    });
  }
  return settings;
}

const SETUP_RATE_LIMIT = { max: 5, timeWindow: "15 minutes" };
const SETUP_WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;

function webAuthnChallengeExpired(expiresAt: string, now: Date): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function registerSetupRoutes(
  server: FastifyInstance,
  options: SetupRouteDependencies,
): void {
  server.get("/api/setup/status", async (request) => {
    const status = await options.repository.getSetupStatus();
    const gateReason =
      options.nodeEnv === "production" ? setupGateFailureReason(request, options) : undefined;
    if (status.required && !status.blocked && gateReason) {
      return { required: false, blocked: true, reason: gateReason };
    }
    return status;
  });

  // codeql[js/missing-rate-limiting] The Fastify rate-limit plugin is registered before API routes, and this setup route has a tighter per-route cap.
  server.post(
    "/api/setup/webauthn-options",
    {
      preHandler: server.rateLimit(SETUP_RATE_LIMIT),
      config: { rateLimit: { ...SETUP_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(SETUP_RATE_LIMIT) above.
    async (request) => {
      const status = await options.repository.getSetupStatus();
      if (!status.required || status.blocked) {
        throw Object.assign(new Error("Setup not available"), { statusCode: 409 });
      }
      assertSetupGate(request, options);

      const body = parseRequestPart(setupWebAuthnOptionsBodySchema, request.body, "body");
      const userId = id("user"); // Temp ID for registration

      const { generateRegistrationOptions } = await import("@simplewebauthn/server");
      const registrationOptions = await generateRegistrationOptions({
        rpName: options.rpName,
        rpID: options.rpID,
        userID: Buffer.from(userId),
        userName: body.email,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "preferred",
        },
      });

      await options.repository.createWebAuthnChallenge({
        id: id("challenge"),
        challengeHash: registrationOptions.challenge,
        purpose: "passkey_registration",
        expiresAt: new Date(Date.now() + SETUP_WEBAUTHN_CHALLENGE_TTL_MS).toISOString(),
        createdAt: new Date().toISOString(),
      });

      return registrationOptions;
    },
  );

  // codeql[js/missing-rate-limiting] The Fastify rate-limit plugin is registered before API routes, and this setup route has a tighter per-route cap.
  server.post(
    "/api/setup/complete",
    {
      preHandler: server.rateLimit(SETUP_RATE_LIMIT),
      config: { rateLimit: { ...SETUP_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(SETUP_RATE_LIMIT) above.
    async (request, reply) => {
      if (!options.jwtSecret) {
        throw Object.assign(new Error("Session authentication is not configured"), {
          statusCode: 503,
        });
      }

      const status = await options.repository.getSetupStatus();
      if (status.blocked) {
        throw Object.assign(new Error(status.reason ?? "First-run setup is blocked"), {
          statusCode: 409,
        });
      }
      if (!status.required) {
        throw Object.assign(new Error("First-run setup is already complete"), { statusCode: 409 });
      }

      assertSetupGate(request, options);
      const body = parseRequestPart(setupBodySchema, request.body, "body");
      const now = new Date();
      const nowIso = now.toISOString();
      const newFirmId = firmId(body.firm.name);
      const ownerId = id("user");
      const businessAddress = body.businessAddress ?? {
        line1: "",
        city: "",
        province: body.firm.defaultProvince,
        postalCode: "",
        country: "Canada",
      };
      const office = body.office ?? { email: body.owner.email, phone: "" };
      const firmSettings = {
        practiceAreas: body.settings?.practiceAreas ?? ["General practice"],
        invoicePrefix: body.settings?.invoicePrefix ?? invoicePrefixFromFirmName(body.firm.name),
        defaultPaymentTermsDays: body.settings?.defaultPaymentTermsDays ?? 30,
        trustAccountLabel: body.settings?.trustAccountLabel ?? "Trust account",
        website: body.settings?.website || undefined,
        description: body.settings?.description || undefined,
        businessNumber: body.settings?.businessNumber || undefined,
      };
      const firstMatterId = body.firstMatter ? id("matter") : undefined;
      const firstContactId = body.firstMatter ? id("contact") : undefined;
      const firstMatterPartyId = body.firstMatter ? id("party") : undefined;
      const currentYear = now.getUTCFullYear();
      const initialProviderSettings = setupProviderSettings({
        firmId: newFirmId,
        nowIso,
        email: body.email,
      });

      const owner = {
        id: ownerId,
        firmId: newFirmId,
        displayName: body.owner.displayName,
        email: body.owner.email,
        role: "owner_admin" as const,
        assignedMatterIds: firstMatterId ? [firstMatterId] : [],
        mfaEnabled: false,
        practitionerProfile: body.owner.practitionerProfile,
      };
      const firstMatter = body.firstMatter
        ? {
            id: firstMatterId!,
            firmId: newFirmId,
            number: `${currentYear}-0001`,
            title: body.firstMatter.title,
            practiceArea: body.firstMatter.practiceArea,
            status: "intake" as const,
            jurisdiction: body.firstMatter.jurisdiction,
            responsibleUserId: ownerId,
            openedOn: nowIso.slice(0, 10),
          }
        : undefined;
      const firstContact = body.firstMatter
        ? {
            id: firstContactId!,
            firmId: newFirmId,
            kind: body.firstMatter.client.kind,
            displayName: body.firstMatter.client.displayName,
            aliases: [],
            identifiers: [
              ...(body.firstMatter.client.email
                ? [{ type: "email" as const, value: body.firstMatter.client.email }]
                : []),
              ...(body.firstMatter.client.phone
                ? [{ type: "phone" as const, value: body.firstMatter.client.phone }]
                : []),
            ],
          }
        : undefined;
      const firstMatterParty =
        body.firstMatter && firstMatterId && firstContactId
          ? {
              id: firstMatterPartyId!,
              firmId: newFirmId,
              matterId: firstMatterId,
              contactId: firstContactId,
              role: "prospective_client" as const,
              adverse: false,
              confidential: true,
            }
          : undefined;

      let webAuthnCredential;
      if (body.owner.webAuthn) {
        const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
        const challenge = await options.repository.getWebAuthnChallenge(
          body.owner.webAuthn.challengeHash,
        );
        if (
          !challenge ||
          challenge.purpose !== "passkey_registration" ||
          challenge.consumedAt ||
          webAuthnChallengeExpired(challenge.expiresAt, now)
        ) {
          throw Object.assign(new Error("Invalid or expired WebAuthn challenge"), {
            statusCode: 400,
          });
        }
        const verification = await verifyRegistrationResponse({
          response: body.owner.webAuthn,
          expectedChallenge: challenge.challengeHash,
          expectedOrigin: options.origin,
          expectedRPID: options.rpID,
        });
        if (!verification.verified || !verification.registrationInfo) {
          throw Object.assign(new Error("Passkey verification failed"), { statusCode: 400 });
        }
        const { credential, credentialDeviceType, credentialBackedUp } =
          verification.registrationInfo;
        const { id: credentialID, publicKey, counter } = credential;
        webAuthnCredential = {
          id: id("cred"),
          firmId: newFirmId,
          userId: ownerId,
          credentialId: Buffer.from(credentialID).toString("base64url"),
          publicKey: Buffer.from(publicKey).toString("base64url"),
          counter,
          transports: body.owner.webAuthn.response.transports || [],
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          createdAt: nowIso,
        };
      }

      const result = await options.repository
        .completeFirstRunSetup({
          firm: {
            id: newFirmId,
            name: body.firm.name,
            defaultProvince: body.firm.defaultProvince,
          },
          settings: {
            firmId: newFirmId,
            businessAddress,
            officeEmail: office.email,
            officePhone: office.phone,
            practiceAreas: firmSettings.practiceAreas,
            invoicePrefix: firmSettings.invoicePrefix,
            defaultPaymentTermsDays: firmSettings.defaultPaymentTermsDays,
            trustAccountLabel: firmSettings.trustAccountLabel,
            website: firmSettings.website,
            description: firmSettings.description,
            businessNumber: firmSettings.businessNumber,
            trustFundsCaveatAcceptedAt: nowIso,
            trustFundsCaveatAcceptedByUserId: ownerId,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          owner,
          ownerPasswordHash: options.hashPassword(body.owner.password),
          ownerPasswordUpdatedAt: nowIso,
          webAuthnCredential,
          firstContact,
          firstMatter,
          firstMatterParty,
          providerSettings: initialProviderSettings,
          selectedPresetIds: body.selectedPresetIds,
          auditEvent: appendAuditEvent(undefined, {
            id: id("audit"),
            firmId: newFirmId,
            actorId: ownerId,
            action: "setup.completed",
            resourceType: "firm",
            resourceId: newFirmId,
            occurredAt: nowIso,
            metadata: {
              practiceAreas: firmSettings.practiceAreas,
              firstMatterCreated: Boolean(firstMatter),
              selectedPresetIds: body.selectedPresetIds,
              smtpConfigured: Boolean(body.email?.smtp?.enabled),
              imapConfigured: Boolean(body.email?.imap?.enabled),
            },
          }),
        })
        .catch((error: unknown) => {
          if (error instanceof FirstRunSetupConflictError) {
            throw Object.assign(error, { statusCode: 409 });
          }
          throw error;
        });
      if (body.owner.webAuthn) {
        await options.repository.consumeWebAuthnChallenge(
          body.owner.webAuthn.challengeHash,
          nowIso,
        );
      }
      if (body.email?.imap?.enabled) {
        await enqueueImapMailboxPoll({
          repository: options.repository,
          inboundEmailJobQueue: options.inboundEmailJobQueue,
          auth: { firmId: newFirmId, user: owner },
          reason: "settings_updated",
        }).catch(() => undefined);
      }

      const token = options.createSessionToken();
      const expiresAt = new Date(
        now.getTime() + (options.sessionTtlHours ?? 12) * 60 * 60 * 1000,
      ).toISOString();
      const session = await options.repository.createAuthSession({
        id: id("session"),
        firmId: result.owner.firmId,
        userId: result.owner.id,
        tokenHash: options.hashToken(token, options.jwtSecret),
        createdAt: nowIso,
        expiresAt,
        freshAuthenticatedAt: nowIso,
      });
      reply.header(
        "set-cookie",
        options.sessionCookie(token, expiresAt, options.nodeEnv === "production"),
      );
      return {
        user: result.owner,
        firm: result.firm,
        session: { id: session.id, expiresAt },
        token,
      };
    },
  );
}
