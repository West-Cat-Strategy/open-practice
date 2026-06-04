import { randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import type {
  ProviderSettingRecord,
  PublicConsultationIntakeNotificationSettings,
  PublicConsultationIntakeRecord,
  User,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { createSessionToken, hashToken } from "../http/auth-helpers.js";
import { ApiHttpError } from "../http/response.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "./outbound-email.js";
import type { ApiJobQueue } from "./types.js";

const SETTINGS_KIND: ProviderSettingRecord["kind"] = "public_intake";
const SETTINGS_KEY = "consultation";
const PUBLIC_INTAKE_RATE_LIMIT = { max: 8, timeWindow: "1 minute" };

const DEFAULT_NOTIFICATION_SETTINGS: PublicConsultationIntakeNotificationSettings = {
  enabled: false,
  senderAddress: "",
  recipientEmails: [],
  allowedOrigins: [],
};

type StoredPublicConsultationSettings = PublicConsultationIntakeNotificationSettings & {
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

const settingsBodySchema = settingsConfigSchema
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

const optionalTelephoneSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(80).optional(),
);

const opposingPartyNamesSchema = z.union([
  z.string().trim().min(1).max(2000),
  z.array(z.string().trim().min(1).max(240)).min(1).max(25),
]);

const publicIntakeBodySchema = z.object({
  clientName: z.string().trim().min(1).max(180),
  telephone: optionalTelephoneSchema,
  email: emailAddressSchema,
  opposingPartyNames: opposingPartyNamesSchema,
  matterDescription: z.string().trim().min(1).max(4000),
  sourceUrl: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().url().max(2048).optional(),
    )
    .optional(),
  disclosureAccepted: z.literal(true),
  website: z.string().max(500).optional(),
});

const dismissBodySchema = z.object({
  reason: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(1000).optional(),
    )
    .optional(),
});

const convertBodySchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  practiceArea: z.string().trim().min(1).max(120).default("consultation"),
  jurisdiction: z.enum(["BC", "ON", "CANADA", "OTHER"]).default("BC"),
});

const listQuerySchema = z.object({
  status: z.enum(["pending", "converted", "dismissed"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
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

function publicSettingsResponse(
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

async function loadNotificationSettings(
  repository: OpenPracticeRepository,
  firmId: string,
): Promise<StoredPublicConsultationSettings> {
  const providers = await repository.listProviderSettings(firmId, { kind: SETTINGS_KIND });
  return parseSettingsConfig(providers.find((provider) => provider.key === SETTINGS_KEY));
}

async function upsertPublicConsultationIntakeNotificationSettings(
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

function bearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return undefined;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : undefined;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function assertSubmissionToken(input: {
  settings: StoredPublicConsultationSettings;
  request: FastifyRequest;
  jwtSecret?: string;
}): void {
  if (!input.settings.submissionTokenHash) {
    throw new ApiHttpError(
      503,
      "PUBLIC_CONSULTATION_SUBMISSION_TOKEN_NOT_CONFIGURED",
      "Public consultation intake submission token is not configured",
    );
  }
  if (!input.jwtSecret) {
    throw new ApiHttpError(
      503,
      "PUBLIC_CONSULTATION_SUBMISSION_TOKEN_UNAVAILABLE",
      "Public consultation intake token verification is not configured",
    );
  }
  const token = bearerToken(input.request);
  if (!token) {
    throw new ApiHttpError(
      403,
      "PUBLIC_CONSULTATION_SUBMISSION_TOKEN_REQUIRED",
      "A bearer token is required to submit consultation intakes",
    );
  }
  const suppliedHash = hashToken(token, input.jwtSecret);
  if (!constantTimeEqual(suppliedHash, input.settings.submissionTokenHash)) {
    throw new ApiHttpError(
      403,
      "PUBLIC_CONSULTATION_SUBMISSION_TOKEN_INVALID",
      "The consultation intake submission token was not accepted",
    );
  }
}

function requestOrigin(request: FastifyRequest): string | undefined {
  const origin = request.headers.origin;
  return typeof origin === "string" && origin.trim() ? origin.trim() : undefined;
}

function assertAllowedOrigin(
  settings: PublicConsultationIntakeNotificationSettings,
  request: FastifyRequest,
): void {
  const origin = requestOrigin(request);
  if (!origin) {
    throw new ApiHttpError(
      403,
      "PUBLIC_CONSULTATION_ORIGIN_REQUIRED",
      "A website origin is required to submit consultation intakes",
    );
  }
  if (settings.allowedOrigins.includes(origin)) return;
  throw new ApiHttpError(
    403,
    "PUBLIC_CONSULTATION_ORIGIN_NOT_ALLOWED",
    "This website origin is not allowed to submit consultation intakes",
  );
}

function normalizeOpposingPartyNames(input: string | string[]): string[] {
  const values = Array.isArray(input) ? input : input.split(/[\n,;]+/);
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ).slice(0, 25);
}

function systemAuth(firmId: string, user: User): ApiAuthContext {
  return { firmId, user };
}

function intakeEmailBody(intake: PublicConsultationIntakeRecord): string {
  const lines = [
    "A new public consultation request was submitted.",
    "",
    `Client name: ${intake.clientName}`,
    `Email: ${intake.email ?? "Not provided"}`,
    intake.telephone ? `Telephone: ${intake.telephone}` : undefined,
    `Opposing parties: ${intake.opposingPartyNames.join(", ")}`,
    `Submitted: ${intake.submittedAt}`,
    intake.sourceUrl ? `Source URL: ${intake.sourceUrl}` : undefined,
    "",
    "Brief description:",
    intake.matterDescription,
    "",
    "Review this submission in Open Practice before creating an intake matter.",
  ].filter((line): line is string => line !== undefined);
  return lines.join("\n");
}

function prefixedId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function registerPublicConsultationIntakeRoutes(
  server: FastifyInstance,
  options: {
    repository: OpenPracticeRepository;
    emailJobQueue?: ApiJobQueue;
    publicFirmId: string;
    publicActorUserId: string;
    jwtSecret?: string;
  },
): void {
  server.get("/api/public-consultation-intakes/settings", async (request) => {
    const access = requireAccess(request.auth, { resource: "provider_setting", action: "read" });
    if (!access.ok) throw access.error;
    return publicSettingsResponse(
      await loadNotificationSettings(options.repository, request.auth.firmId),
    );
  });

  server.put("/api/public-consultation-intakes/settings", async (request) => {
    const access = requireAccess(request.auth, { resource: "provider_setting", action: "update" });
    if (!access.ok) throw access.error;
    const body = settingsBodySchema.parse(request.body);
    const existing = await loadNotificationSettings(options.repository, request.auth.firmId);
    let submissionToken: string | undefined;
    let submissionTokenHash = existing.submissionTokenHash;
    let submissionTokenRotatedAt = existing.submissionTokenRotatedAt;
    if (body.rotateSubmissionToken) {
      if (!options.jwtSecret) {
        throw new ApiHttpError(
          503,
          "PUBLIC_CONSULTATION_SUBMISSION_TOKEN_UNAVAILABLE",
          "Public consultation intake token generation is not configured",
        );
      }
      submissionToken = createSessionToken();
      submissionTokenHash = hashToken(submissionToken, options.jwtSecret);
      submissionTokenRotatedAt = new Date().toISOString();
    }
    const saved = await upsertPublicConsultationIntakeNotificationSettings(
      options.repository,
      request.auth.firmId,
      {
        ...body,
        submissionTokenHash,
        submissionTokenRotatedAt,
      },
    );
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "public_consultation_intake.settings_updated",
      resourceType: "provider_setting",
      resourceId: SETTINGS_KEY,
      metadata: {
        kind: SETTINGS_KIND,
        enabled: saved.enabled,
        recipientCount: saved.recipientEmails.length,
        allowedOriginCount: saved.allowedOrigins.length,
        reviewOwnerUserId: saved.reviewOwnerUserId,
        submissionTokenConfigured: Boolean(saved.submissionTokenHash),
        submissionTokenRotated: body.rotateSubmissionToken,
      },
    });
    return publicSettingsResponse(saved, submissionToken);
  });

  server.get("/api/public-consultation-intakes", async (request) => {
    const access = requireAccess(request.auth, {
      resource: "public_consultation_intake",
      action: "read",
    });
    if (!access.ok) throw access.error;
    const query = listQuerySchema.parse(request.query);
    return {
      intakes: await options.repository.listPublicConsultationIntakes(request.auth.firmId, query),
    };
  });

  server.post(
    "/api/public/consultation-intakes",
    {
      config: {
        rateLimit: {
          ...PUBLIC_INTAKE_RATE_LIMIT,
          keyGenerator: (request: FastifyRequest) =>
            `${request.ip}:public-consultation-intake:${requestOrigin(request) ?? "no-origin"}`,
        },
      },
    },
    async (request, reply) => {
      const settings = await loadNotificationSettings(options.repository, options.publicFirmId);
      assertAllowedOrigin(settings, request);
      if (!settings.enabled) {
        throw new ApiHttpError(
          503,
          "PUBLIC_CONSULTATION_INTAKE_DISABLED",
          "Public consultation intake is not enabled",
        );
      }
      assertSubmissionToken({ settings, request, jwtSecret: options.jwtSecret });

      const body = publicIntakeBodySchema.parse(request.body);
      if (body.website?.trim()) {
        reply.code(202);
        return { status: "received" };
      }

      const reviewOwner = await options.repository.getUser(
        options.publicFirmId,
        settings.reviewOwnerUserId ?? options.publicActorUserId,
      );
      if (!reviewOwner) {
        throw new ApiHttpError(
          503,
          "PUBLIC_CONSULTATION_REVIEW_OWNER_MISSING",
          "Public consultation intake review owner is not configured",
        );
      }
      const occurredAt = new Date().toISOString();
      const opposingPartyNames = normalizeOpposingPartyNames(body.opposingPartyNames);
      const intake = await options.repository.createPublicConsultationIntake({
        id: prefixedId("public-intake"),
        firmId: options.publicFirmId,
        status: "pending",
        clientName: body.clientName,
        telephone: body.telephone ?? "",
        email: body.email,
        opposingPartyNames,
        matterDescription: body.matterDescription,
        sourceUrl: body.sourceUrl,
        disclosureAcceptedAt: occurredAt,
        submittedAt: occurredAt,
        metadata: {
          source: "public_consultation_form",
          sourceUrlPresent: Boolean(body.sourceUrl),
          opposingPartyCount: opposingPartyNames.length,
        },
      });
      const auth = systemAuth(options.publicFirmId, reviewOwner);
      const queuedEmail = await queueRouteEmailOutbox(
        options.repository,
        options.emailJobQueue,
        auth,
        {
          templateKey: "public_consultation_intake.received",
          to: settings.recipientEmails,
          from: settings.senderAddress,
          subject: "New public consultation request",
          textBody: intakeEmailBody(intake),
          relatedResourceType: "public_consultation_intake",
          relatedResourceId: intake.id,
          source: "api.public_consultation_intake",
          metadata: {
            publicConsultationIntakeId: intake.id,
            opposingPartyCount: opposingPartyNames.length,
          },
          required: false,
        },
      );
      const persistedIntake = queuedEmail
        ? await options.repository.updatePublicConsultationIntake(options.publicFirmId, intake.id, {
            notificationEmailId: queuedEmail.email.id,
            metadata: {
              ...intake.metadata,
              notificationEmailQueued: true,
            },
          })
        : intake;

      await appendRouteAuditEvent(options.repository, auth, {
        action: "public_consultation_intake.received",
        resourceType: "public_consultation_intake",
        resourceId: intake.id,
        occurredAt,
        metadata: {
          source: "public_consultation_form",
          sourceUrlPresent: Boolean(body.sourceUrl),
          opposingPartyCount: opposingPartyNames.length,
          notificationEmailQueued: Boolean(queuedEmail),
        },
      });

      reply.code(201);
      return {
        status: "pending_review",
        intakeId: persistedIntake?.id ?? intake.id,
        notificationEmail: summarizeQueuedRouteEmail(queuedEmail),
      };
    },
  );

  server.post("/api/public-consultation-intakes/:id/dismiss", async (request) => {
    const access = requireAccess(request.auth, {
      resource: "public_consultation_intake",
      action: "update",
    });
    if (!access.ok) throw access.error;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = dismissBodySchema.parse(request.body);
    const existing = await options.repository.getPublicConsultationIntake(
      request.auth.firmId,
      params.id,
    );
    if (!existing) {
      throw new ApiHttpError(404, "PUBLIC_CONSULTATION_INTAKE_NOT_FOUND", "Intake not found");
    }
    if (existing.status !== "pending") {
      throw new ApiHttpError(
        409,
        "PUBLIC_CONSULTATION_INTAKE_NOT_PENDING",
        "Only pending consultation intakes can be dismissed",
      );
    }
    const reviewedAt = new Date().toISOString();
    const intake = await options.repository.updatePublicConsultationIntake(
      request.auth.firmId,
      params.id,
      {
        status: "dismissed",
        reviewedByUserId: request.auth.user.id,
        reviewedAt,
        dismissedReason: body.reason,
        metadata: {
          ...existing.metadata,
          dismissed: true,
          dismissedReasonPresent: Boolean(body.reason),
        },
      },
    );
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "public_consultation_intake.dismissed",
      resourceType: "public_consultation_intake",
      resourceId: params.id,
      occurredAt: reviewedAt,
      metadata: {
        dismissedReasonPresent: Boolean(body.reason),
      },
    });
    return { intake };
  });

  server.post("/api/public-consultation-intakes/:id/convert", async (request, reply) => {
    const intakeAccess = requireAccess(request.auth, {
      resource: "public_consultation_intake",
      action: "approve",
    });
    if (!intakeAccess.ok) throw intakeAccess.error;
    const matterAccess = requireAccess(request.auth, { resource: "matter", action: "create" });
    if (!matterAccess.ok) throw matterAccess.error;
    const contactAccess = requireAccess(request.auth, { resource: "contact", action: "create" });
    if (!contactAccess.ok) throw contactAccess.error;

    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = convertBodySchema.parse(request.body ?? {});
    const existing = await options.repository.getPublicConsultationIntake(
      request.auth.firmId,
      params.id,
    );
    if (!existing) {
      throw new ApiHttpError(404, "PUBLIC_CONSULTATION_INTAKE_NOT_FOUND", "Intake not found");
    }
    if (existing.status !== "pending") {
      throw new ApiHttpError(
        409,
        "PUBLIC_CONSULTATION_INTAKE_NOT_PENDING",
        "Only pending consultation intakes can be converted",
      );
    }

    const occurredAt = new Date();
    const result = await options.repository.convertPublicConsultationIntakeToMatter({
      firmId: request.auth.firmId,
      intakeId: params.id,
      actorUserId: request.auth.user.id,
      matterId: prefixedId("matter"),
      clientContactId: prefixedId("contact"),
      clientPartyId: prefixedId("party"),
      opposingParties: existing.opposingPartyNames.map((displayName) => ({
        contactId: prefixedId("contact"),
        partyId: prefixedId("party"),
        displayName,
      })),
      title: body.title ?? `Consultation request - ${existing.clientName}`,
      practiceArea: body.practiceArea,
      jurisdiction: body.jurisdiction,
      openedOn: occurredAt.toISOString().slice(0, 10),
      occurredAt: occurredAt.toISOString(),
      auditEventId: prefixedId("audit"),
    });

    reply.code(201);
    return result;
  });
}
