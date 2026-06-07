import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import type {
  PublicConsultationIntakeNotificationSettings,
  PublicConsultationIntakeRecord,
  User,
} from "@open-practice/domain";
import { hashToken } from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "../outbound-email.js";
import type { ApiJobQueue } from "../types.js";
import { loadNotificationSettings, prefixedId } from "./shared.js";

const PUBLIC_INTAKE_RATE_LIMIT = { max: 8, timeWindow: "1 minute" };

const emailAddressSchema = z.string().trim().email().max(254);

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
  settings: PublicConsultationIntakeNotificationSettings & { submissionTokenHash?: string };
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

export function registerPublicConsultationSubmissionRoutes(
  server: FastifyInstance,
  options: {
    repository: OpenPracticeRepository;
    emailJobQueue?: ApiJobQueue;
    publicFirmId: string;
    publicActorUserId: string;
    jwtSecret?: string;
  },
): void {
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

      const body = parseRequestPart(publicIntakeBodySchema, request.body, "body");
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
}
