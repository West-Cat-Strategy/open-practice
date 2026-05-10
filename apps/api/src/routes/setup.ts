import type { FastifyInstance, FastifyRequest } from "fastify";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { z } from "zod";
import { appendAuditEvent, isPracticePresetId } from "@open-practice/domain";
import { FirstRunSetupConflictError, type OpenPracticeRepository } from "@open-practice/database";

const provinceSchema = z.enum(["BC", "ON", "CANADA", "OTHER"]);

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
});
export interface SetupRouteDependencies {
  repository: OpenPracticeRepository;
  jwtSecret?: string;
  nodeEnv?: string;
  setupKey?: string;
  sessionTtlHours?: number;
  hashPassword: (password: string) => string;
  hashToken: (token: string, secret: string) => string;
  createSessionToken: () => string;
  sessionCookie: (token: string, expiresAt: string, secure: boolean) => string;
  rpName: string;
  rpID: string;
  origin: string;
}

function setupKeyRequired(options: Pick<SetupRouteDependencies, "nodeEnv" | "setupKey">): boolean {
  return options.nodeEnv === "production" || Boolean(options.setupKey);
}

function headerValue(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isLocalOrPrivateAddress(address: string): boolean {
  const normalized = address.replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "127.0.0.1" || normalized === "localhost") {
    return true;
  }
  if (normalized.startsWith("127.") || normalized.startsWith("10.")) return true;
  if (normalized.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  return (
    normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80")
  );
}

function assertSetupGate(request: FastifyRequest, options: SetupRouteDependencies): void {
  const suppliedKey = headerValue(request, "x-open-practice-setup-key");
  if (options.setupKey) {
    if (!suppliedKey || !constantTimeEqual(suppliedKey, options.setupKey)) {
      throw Object.assign(new Error("Valid setup key required"), { statusCode: 403 });
    }
    return;
  }

  if (options.nodeEnv === "production") {
    throw Object.assign(new Error("OPEN_PRACTICE_SETUP_KEY is required for production setup"), {
      statusCode: 503,
    });
  }

  if (!isLocalOrPrivateAddress(request.ip)) {
    throw Object.assign(new Error("First-run setup is limited to local/private network access"), {
      statusCode: 403,
    });
  }
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

const SETUP_RATE_LIMIT = { max: 5, timeWindow: "15 minutes" };
const SETUP_WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;

function webAuthnChallengeExpired(expiresAt: string, now: Date): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function registerSetupRoutes(
  server: FastifyInstance,
  options: SetupRouteDependencies,
): void {
  server.get("/api/setup/status", async () => ({
    ...(await options.repository.getSetupStatus()),
    setupKeyRequired: setupKeyRequired(options),
  }));

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

      const body = z.object({ email: z.string().email() }).parse(request.body);
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
      const body = setupBodySchema.parse(request.body);
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
