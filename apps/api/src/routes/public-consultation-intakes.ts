import { randomUUID } from "node:crypto";
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
import { ApiHttpError } from "../http/response.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "./outbound-email.js";
import type { ApiJobQueue } from "./types.js";

const SETTINGS_KIND: ProviderSettingRecord["kind"] = "public_intake";
const SETTINGS_KEY = "consultation";
const PUBLIC_INTAKE_RATE_LIMIT = { max: 8, timeWindow: "1 minute" };

const DEFAULT_ALLOWED_ORIGINS = [
  "https://crockettparalegal.ca",
  "https://www.crockettparalegal.ca",
  "http://localhost:4321",
  "http://127.0.0.1:4321",
];

const DEFAULT_NOTIFICATION_SETTINGS: PublicConsultationIntakeNotificationSettings = {
  enabled: true,
  senderAddress: "info@crockettparalegal.ca",
  recipientEmails: ["bryan@crockettparalegal.ca"],
  allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
};

const emailAddressSchema = z.string().trim().email().max(254);

const settingsBodySchema = z.object({
  enabled: z.boolean(),
  senderAddress: emailAddressSchema,
  recipientEmails: z.array(emailAddressSchema).min(1).max(10),
  allowedOrigins: z.array(z.string().trim().url().max(2048)).min(1).max(20),
  reviewOwnerUserId: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().min(1).optional(),
    )
    .optional(),
});

const optionalEmailSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  emailAddressSchema.optional(),
);

const opposingPartyNamesSchema = z.union([
  z.string().trim().min(1).max(2000),
  z.array(z.string().trim().min(1).max(240)).min(1).max(25),
]);

const publicIntakeBodySchema = z.object({
  clientName: z.string().trim().min(1).max(180),
  telephone: z.string().trim().min(1).max(80),
  email: optionalEmailSchema,
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
  settings: PublicConsultationIntakeNotificationSettings,
): PublicConsultationIntakeNotificationSettings {
  return {
    enabled: settings.enabled,
    senderAddress: settings.senderAddress,
    recipientEmails: settings.recipientEmails,
    allowedOrigins: settings.allowedOrigins,
    reviewOwnerUserId: settings.reviewOwnerUserId,
  };
}

function parseSettingsConfig(
  provider: ProviderSettingRecord | undefined,
  fallbackReviewOwnerUserId: string,
): PublicConsultationIntakeNotificationSettings {
  if (!provider) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS, reviewOwnerUserId: fallbackReviewOwnerUserId };
  }
  try {
    const parsed = settingsBodySchema.partial().parse(JSON.parse(provider.encryptedConfig));
    return compactSettings({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...parsed,
      enabled: provider.enabled && parsed.enabled !== false,
      reviewOwnerUserId: parsed.reviewOwnerUserId ?? fallbackReviewOwnerUserId,
    });
  } catch {
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      enabled: provider.enabled,
      reviewOwnerUserId: fallbackReviewOwnerUserId,
    };
  }
}

async function loadNotificationSettings(
  repository: OpenPracticeRepository,
  firmId: string,
  fallbackReviewOwnerUserId: string,
): Promise<PublicConsultationIntakeNotificationSettings> {
  const providers = await repository.listProviderSettings(firmId, { kind: SETTINGS_KIND });
  return parseSettingsConfig(
    providers.find((provider) => provider.key === SETTINGS_KEY),
    fallbackReviewOwnerUserId,
  );
}

async function saveNotificationSettings(
  repository: OpenPracticeRepository,
  firmId: string,
  settings: PublicConsultationIntakeNotificationSettings,
): Promise<PublicConsultationIntakeNotificationSettings> {
  const now = new Date().toISOString();
  await repository.upsertProviderSetting({
    id: `provider-public-intake-${firmId}`,
    firmId,
    kind: SETTINGS_KIND,
    key: SETTINGS_KEY,
    enabled: settings.enabled,
    encryptedConfig: JSON.stringify(compactSettings(settings)),
    createdAt: now,
    updatedAt: now,
  });
  return settings;
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
  if (!origin) return;
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
    `Telephone: ${intake.telephone}`,
    `Email: ${intake.email ?? "Not provided"}`,
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
  },
): void {
  server.get("/api/public-consultation-intakes/settings", async (request) => {
    const access = requireAccess(request.auth, { resource: "provider_setting", action: "read" });
    if (!access.ok) throw access.error;
    return loadNotificationSettings(options.repository, request.auth.firmId, request.auth.user.id);
  });

  server.put("/api/public-consultation-intakes/settings", async (request) => {
    const access = requireAccess(request.auth, { resource: "provider_setting", action: "update" });
    if (!access.ok) throw access.error;
    const body = settingsBodySchema.parse(request.body);
    const saved = await saveNotificationSettings(options.repository, request.auth.firmId, body);
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
      },
    });
    return saved;
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
      const settings = await loadNotificationSettings(
        options.repository,
        options.publicFirmId,
        options.publicActorUserId,
      );
      assertAllowedOrigin(settings, request);
      if (!settings.enabled) {
        throw new ApiHttpError(
          503,
          "PUBLIC_CONSULTATION_INTAKE_DISABLED",
          "Public consultation intake is not enabled",
        );
      }

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
        telephone: body.telephone,
        email: body.email,
        opposingPartyNames,
        matterDescription: body.matterDescription,
        sourceUrl: body.sourceUrl,
        disclosureAcceptedAt: occurredAt,
        submittedAt: occurredAt,
        metadata: {
          source: "crockett_paralegal_website",
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
          source: "crockett_paralegal_website",
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
