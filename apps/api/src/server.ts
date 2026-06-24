import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { S3Client } from "@aws-sdk/client-s3";
import { Queue } from "bullmq";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { jwtVerify } from "jose";
import { z } from "zod";
import {
  createProviderConfigCipherFromKey,
  isProviderConfigEncryptionKey,
  type ProviderConfigCipher,
} from "@open-practice/database/config-encryption";
import {
  DrizzleOpenPracticeRepository,
  InMemoryOpenPracticeRepository,
  type AuthSessionRecord,
  type OpenPracticeRepository,
} from "@open-practice/database/repository";
import { createDatabaseRuntime } from "@open-practice/database/runtime";
import { seedSampleData } from "@open-practice/database/seed";
import type {
  AiOperationalProposalProvider,
  DocumentAutomationProvider,
  DraftAssistProvider,
  PaymentProcessorProvider,
  PublicConsultationIntakeNotificationSettings,
  SignatureProvider,
  User,
} from "@open-practice/domain";
import { EmbeddedAutomationProvider } from "@open-practice/providers/automation";
import { renderDraftExport } from "@open-practice/providers/draft-exports";
import { StripePaymentProcessorProvider } from "@open-practice/providers/payments/stripe";
import { EmbeddedSignatureProvider } from "@open-practice/providers/signatures";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAuthExtensionRoutes } from "./routes/auth-extensions.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerCalDavRoutes } from "./routes/caldav.js";
import { registerCalendarRoutes } from "./routes/calendar.js";
import { registerClientPortalRoutes } from "./routes/client-portal.js";
import { registerContactRoutes } from "./routes/contacts.js";
import { registerConnectorRoutes } from "./routes/connectors.js";
import { registerCommunicationsRoutes } from "./routes/communications.js";
import { registerConversationThreadRoutes } from "./routes/conversation-threads.js";
import { registerDocumentProcessingRoutes } from "./routes/document-processing.js";
import { registerDocumentAssemblyRoutes } from "./routes/document-assembly.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerAiOperationalProposalRoutes } from "./routes/ai-operational-proposals.js";
import { registerDraftAssistRoutes } from "./routes/draft-assist.js";
import { registerDraftRoutes } from "./routes/drafts.js";
import { registerE2ESupportRoutes } from "./routes/e2e-support.js";
import { registerEmailRoutes } from "./routes/email.js";
import { registerExternalUploadRoutes } from "./routes/external-uploads.js";
import { registerInboundEmailRoutes } from "./routes/inbound-email.js";
import { registerIntakeFormRoutes } from "./routes/intake-forms.js";
import { registerIntakePipelineRoutes } from "./routes/intake-pipeline.js";
import { registerIntakeRoutes } from "./routes/intake.js";
import { registerJobsRoutes } from "./routes/jobs.js";
import { registerLedgerRoutes } from "./routes/ledger.js";
import { registerLegalClinicRoutes } from "./routes/legal-clinics.js";
import { registerLegalResearchRoutes } from "./routes/legal-research.js";
import { registerMatterRoutes } from "./routes/matters.js";
import { registerOperationalViewRoutes } from "./routes/operational-views.js";
import { registerOutboundWebhookRoutes } from "./routes/outbound-webhooks.js";
import { registerProviderStatusRoutes } from "./routes/providers-status.js";
import { registerPublicConsultationIntakeRoutes } from "./routes/public-consultation-intakes.js";
import { registerQueuesRoutes } from "./routes/queues.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerRecoveryRoutes } from "./routes/recovery.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerShareRoutes } from "./routes/shares.js";
import { registerSignatureRoutes } from "./routes/signatures.js";
import { registerSetupRoutes } from "./routes/setup.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerWebAuthnRoutes } from "./routes/webauthn.js";
import type {
  ApiJobQueue,
  ApiRouteDependencies,
  ConnectorDnsResolver,
  DraftExportRenderer,
} from "./routes/types.js";
import {
  hashToken,
  hashPassword,
  createSessionToken,
  sessionCookie,
  readSessionToken,
  isPublicRoute,
  redactPublicTokenUrl,
} from "./http/auth-helpers.js";
import { ApiHttpError, apiRouteErrorBody, UNEXPECTED_API_ERROR_MESSAGE } from "./http/response.js";

const DEV_EXAMPLE_JWT_SECRET = "dev-only-change-me-at-least-16-chars";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalConfigEncryptionKey = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .min(1)
    .refine(isProviderConfigEncryptionKey, {
      message:
        "OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY must decode to exactly 32 bytes using base64, base64url, or hex",
    })
    .optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const optionalS3ServerSideEncryption = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["AES256"]).optional(),
);

const optionalBoolean = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return value;
}, z.boolean().optional());

const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return value;
}, z.boolean().default(false));

const publicConsultationBootstrapSettingsSchema = z.object({
  enabled: z.boolean(),
  senderAddress: z.union([z.literal(""), z.string().trim().email().max(254)]),
  recipientEmails: z.array(z.string().trim().email().max(254)).max(10),
  allowedOrigins: z.array(z.string().trim().url().max(2048)).max(20),
  submissionTokenHash: z.string().trim().min(32).optional(),
  submissionTokenRotatedAt: z.string().datetime().optional(),
  reviewOwnerUserId: z.string().trim().min(1).optional(),
});

const inboundEmailMailgunBootstrapSettingsSchema = z.object({
  webhookSigningKey: z.string().trim().min(1),
  domain: z.string().trim().min(1).optional(),
});

export const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: optionalString,
  OPEN_PRACTICE_USE_MEMORY_REPO: booleanFromEnv,
  OPEN_PRACTICE_DEV_SEED: booleanFromEnv,
  OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP: booleanFromEnv,
  OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: optionalConfigEncryptionKey,
  E2E_MODE: z.enum(["host", "docker"]).optional(),
  AUTH_JWT_SECRET: optionalString,
  DEV_AUTH_USER_ID: z.string().default("user-admin"),
  DEV_AUTH_FIRM_ID: z.string().default("firm-west-legal"),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().default("local"),
  S3_BUCKET: z.string().default("open-practice-documents"),
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_SERVER_SIDE_ENCRYPTION: optionalS3ServerSideEncryption,
  REDIS_URL: optionalUrl,
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  DOCUSEAL_BASE_URL: optionalUrl,
  DOCUSEAL_API_KEY: optionalString,
  DOCUSEAL_WEBHOOK_SECRET_HEADER: optionalString,
  DOCUSEAL_WEBHOOK_SECRET_VALUE: optionalString,
  DOCUSEAL_WEBHOOK_REPLAY_WINDOW_SECONDS: optionalString,
  DOCASSEMBLE_BASE_URL: optionalUrl,
  DOCASSEMBLE_API_KEY: optionalString,
  DOCASSEMBLE_RETURN_URL: optionalUrl,
  OIDC_ISSUER_URL: optionalUrl,
  OIDC_CLIENT_ID: optionalString,
  OIDC_CLIENT_SECRET: optionalString,
  WEBAUTHN_RP_NAME: z.string().default("Open Practice"),
  WEBAUTHN_RP_ID: z.string().default("localhost"),
  WEBAUTHN_ORIGIN: z.string().default("http://localhost:3000"),
  PUBLIC_WEB_BASE_URL: optionalUrl,
  OPEN_PRACTICE_PUBLIC_API_ORIGIN: optionalUrl,
  WEBRTC_MEETING_PROVIDER_KEY: optionalString,
  WEBRTC_MEETING_BASE_URL: optionalUrl,
  STRIPE_SECRET_KEY: optionalString,
  PUBLIC_CONSULTATION_INTAKE_ALLOWED_ORIGINS: optionalString,
  PUBLIC_CONSULTATION_INTAKE_FIRM_ID: optionalString,
  PUBLIC_CONSULTATION_INTAKE_ACTOR_USER_ID: optionalString,
  PUBLIC_CONSULTATION_INTAKE_ENABLED: optionalBoolean,
  PUBLIC_CONSULTATION_INTAKE_SENDER_ADDRESS: optionalString,
  PUBLIC_CONSULTATION_INTAKE_RECIPIENT_EMAILS: optionalString,
  PUBLIC_CONSULTATION_INTAKE_REVIEW_OWNER_USER_ID: optionalString,
  PUBLIC_CONSULTATION_INTAKE_SUBMISSION_TOKEN_HASH: optionalString,
  INBOUND_EMAIL_WEBHOOK_SECRET: optionalString,
  INBOUND_EMAIL_DOMAIN: optionalString,
});

export type ApiEnv = z.infer<typeof envSchema>;

// Session cookie name moved to http/auth-helpers.ts
const DEFAULT_RATE_LIMIT = { max: 300, timeWindow: "1 minute" };
const E2E_RATE_LIMIT = { max: 2_000, timeWindow: "1 minute" };
const PUBLIC_CONSULTATION_SETTINGS_KIND = "public_intake";
const PUBLIC_CONSULTATION_SETTINGS_KEY = "consultation";
const INBOUND_EMAIL_SETTINGS_KIND = "inbound_email";
const INBOUND_EMAIL_MAILGUN_SETTINGS_KEY = "mailgun";
const E2E_SMTP_SETTINGS_KIND = "smtp";
// Auth rate limits moved to routes/auth.ts

// Auth schemas moved to routes/auth.ts

export interface ApiAuthContext {
  user: User;
  firmId: string;
  session?: AuthSessionRecord;
}

interface ApiOptions {
  repository: OpenPracticeRepository;
  jwtSecret?: string;
  nodeEnv?: string;
  devUserId: string;
  devFirmId: string;
  signatureProvider?: SignatureProvider;
  automationProvider?: DocumentAutomationProvider;
  aiOperationalProposalProvider?: AiOperationalProposalProvider;
  draftExportRenderer?: DraftExportRenderer;
  draftAssistProvider?: DraftAssistProvider;
  paymentProcessorProvider?: PaymentProcessorProvider;
  emailJobQueue?: ApiJobQueue;
  connectorJobQueue?: ApiJobQueue;
  documentAssemblyJobQueue?: ApiJobQueue;
  connectorDnsResolver?: ConnectorDnsResolver;
  inboundEmailJobQueue?: ApiJobQueue;
  reportJobQueue?: ApiJobQueue;
  aiAssistJobQueue?: ApiJobQueue;
  ocrJobQueue?: ApiJobQueue;
  sessionTtlHours?: number;
  publicWebBaseUrl?: string;
  publicApiBaseUrl?: string;
  publicConsultationIntake?: {
    allowedOrigins?: string[];
    firmId: string;
    actorUserId: string;
  };
  meetingLinks?: {
    providerKey: string;
    hostedMeetingBaseUrl?: string;
    guestAccessTokenSigningConfigured?: boolean;
  };
  allowDockerBridgeSetup?: boolean;
  s3?: ApiRouteDependencies["s3"];
  e2eSupport?: boolean;
  webAuthn: {
    rpName: string;
    rpID: string;
    origin: string;
  };
}

function configuredCount(values: Array<string | undefined>): number {
  return values.filter(Boolean).length;
}

function requireCompleteGroup(name: string, values: Array<string | undefined>): void {
  const count = configuredCount(values);
  if (count > 0 && count < values.length) {
    throw new Error(`${name} configuration must be complete or absent`);
  }
}

export function validateProductionReadiness(env: ApiEnv): void {
  requireCompleteGroup("S3", [env.S3_ENDPOINT, env.S3_ACCESS_KEY, env.S3_SECRET_KEY]);
  requireCompleteGroup("Hosted WebRTC meetings", [
    env.WEBRTC_MEETING_PROVIDER_KEY,
    env.WEBRTC_MEETING_BASE_URL,
  ]);
  const deprecatedProviderEnv = [
    "DOCUSEAL_BASE_URL",
    "DOCUSEAL_API_KEY",
    "DOCUSEAL_WEBHOOK_SECRET_HEADER",
    "DOCUSEAL_WEBHOOK_SECRET_VALUE",
    "DOCUSEAL_WEBHOOK_REPLAY_WINDOW_SECONDS",
    "DOCASSEMBLE_BASE_URL",
    "DOCASSEMBLE_API_KEY",
    "DOCASSEMBLE_RETURN_URL",
    "OIDC_ISSUER_URL",
    "OIDC_CLIENT_ID",
    "OIDC_CLIENT_SECRET",
  ].filter((key) => Boolean(env[key as keyof ApiEnv]));

  if (env.NODE_ENV !== "production") return;

  if (deprecatedProviderEnv.length > 0) {
    throw new Error(
      `Deprecated external provider configuration is not supported in production: ${deprecatedProviderEnv.join(
        ", ",
      )}`,
    );
  }

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production");
  }
  if (env.OPEN_PRACTICE_USE_MEMORY_REPO) {
    throw new Error("OPEN_PRACTICE_USE_MEMORY_REPO cannot be true in production");
  }
  if (env.OPEN_PRACTICE_DEV_SEED) {
    throw new Error("OPEN_PRACTICE_DEV_SEED cannot be true in production");
  }
  if (env.OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP) {
    throw new Error("OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP cannot be true in production");
  }
  if (env.E2E_MODE) {
    throw new Error("E2E_MODE cannot be configured in production");
  }
  if (!env.AUTH_JWT_SECRET || env.AUTH_JWT_SECRET.length < 32) {
    throw new Error("AUTH_JWT_SECRET must be at least 32 characters in production");
  }
  if (env.AUTH_JWT_SECRET === DEV_EXAMPLE_JWT_SECRET) {
    throw new Error("AUTH_JWT_SECRET must not use the development example value in production");
  }
  if (!env.OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY) {
    throw new Error("OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY is required in production");
  }
  if (!env.OPEN_PRACTICE_PUBLIC_API_ORIGIN) {
    throw new Error("OPEN_PRACTICE_PUBLIC_API_ORIGIN is required in production");
  }
  if (
    env.S3_ENDPOINT &&
    env.S3_ACCESS_KEY &&
    env.S3_SECRET_KEY &&
    env.S3_SERVER_SIDE_ENCRYPTION !== "AES256"
  ) {
    throw new Error("S3_SERVER_SIDE_ENCRYPTION=AES256 is required when S3 is configured");
  }
  if (env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is not supported in production until Stripe webhook, settlement reconciliation, and refund handling deployment gates are implemented",
    );
  }
}

// Password hashing and token generation moved to http/auth-helpers.ts

// Session token and cookie management moved to http/auth-helpers.ts

// Public route check moved to http/auth-helpers.ts

async function authenticate(
  request: FastifyRequest,
  repository: OpenPracticeRepository,
  options: Pick<ApiOptions, "jwtSecret" | "nodeEnv" | "devFirmId" | "devUserId">,
): Promise<ApiAuthContext> {
  const authorization = request.headers.authorization;
  let firmId = options.devFirmId;
  let userId = options.devUserId;
  const isProduction = (options.nodeEnv ?? process.env.NODE_ENV) === "production";
  const sessionToken = readSessionToken(request.headers);

  if (sessionToken) {
    if (!options.jwtSecret) {
      throw Object.assign(new Error("Session authentication is not configured"), {
        statusCode: 503,
      });
    }
    const session = await repository.getAuthSessionByTokenHash(
      hashToken(sessionToken, options.jwtSecret),
    );
    if (!session || session.revokedAt || Date.parse(session.expiresAt) <= Date.now()) {
      throw Object.assign(new Error("Session expired or revoked"), { statusCode: 401 });
    }
    firmId = session.firmId;
    userId = session.userId;
    await repository.touchAuthSession(session.tokenHash, new Date().toISOString());
    const user = await repository.getUser(firmId, userId);
    if (!user) {
      throw Object.assign(new Error("Authenticated user was not found"), { statusCode: 401 });
    }
    return { user, firmId, session };
  } else if (authorization?.startsWith("Bearer ")) {
    if (isProduction) {
      throw Object.assign(new Error("Bearer JWT authentication is development-only"), {
        statusCode: 401,
      });
    }
    if (!options.jwtSecret) {
      throw Object.assign(new Error("JWT authentication is not configured"), { statusCode: 503 });
    }
    const secret = new TextEncoder().encode(options.jwtSecret);
    const { payload } = await jwtVerify(authorization.slice("Bearer ".length), secret);
    firmId = z.string().parse(payload.firmId);
    userId = z.string().parse(payload.sub);
  } else if (isProduction) {
    throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  } else if (request.headers["x-open-practice-user-id"]) {
    userId = z.string().parse(request.headers["x-open-practice-user-id"]);
    firmId = z.string().parse(request.headers["x-open-practice-firm-id"] ?? options.devFirmId);
  }

  const user = await repository.getUser(firmId, userId);
  if (!user) {
    throw Object.assign(new Error("Authenticated user was not found"), { statusCode: 401 });
  }
  return { user, firmId };
}

function routePath(url: string | undefined): string {
  return url?.split("?")[0] ?? "";
}

const LOCAL_BROWSER_ORIGINS = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
const CORS_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

function isLocalBrowserOrigin(origin: string): boolean {
  return LOCAL_BROWSER_ORIGINS.some((pattern) => pattern.test(origin));
}

function corsRequestMethod(request: FastifyRequest): string {
  if (request.method !== "OPTIONS") return request.method.toUpperCase();
  const preflightMethod = request.headers["access-control-request-method"];
  return typeof preflightMethod === "string" ? preflightMethod.toUpperCase() : "";
}

function isPublicConsultationCorsRequest(request: FastifyRequest): boolean {
  return (
    routePath(request.url) === "/api/public/consultation-intakes" &&
    corsRequestMethod(request) === "POST"
  );
}

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

function authenticatedWebOrigins(options: ApiOptions): string[] {
  const origins = Array.from(
    new Set(
      [normalizeOrigin(options.publicWebBaseUrl), normalizeOrigin(options.webAuthn.origin)].filter(
        (origin): origin is string => Boolean(origin),
      ),
    ),
  );
  if (options.nodeEnv === "production") {
    return origins.filter((origin) => !isLocalBrowserOrigin(origin));
  }
  return origins;
}

function corsOriginForRequest(
  request: FastifyRequest,
  options: {
    allowLocalBrowserOrigins: boolean;
    authenticatedOrigins: string[];
    publicConsultationOrigins: string[];
  },
): string | false {
  const origin = request.headers.origin;
  if (!origin) return false;
  if (
    options.publicConsultationOrigins.includes(origin) &&
    isPublicConsultationCorsRequest(request)
  ) {
    return origin;
  }
  if (options.authenticatedOrigins.includes(origin)) return origin;
  if (options.allowLocalBrowserOrigins && isLocalBrowserOrigin(origin)) return origin;
  return false;
}

export function createApiServer(options: ApiOptions): FastifyInstance {
  const server = Fastify({
    logger: {
      serializers: {
        req(request) {
          const serialized = request as {
            method?: string;
            url?: string;
            hostname?: string;
            host?: string;
            ip?: string;
            remoteAddress?: string;
            remotePort?: number;
          };
          return {
            method: serialized.method,
            url: redactPublicTokenUrl(serialized.url),
            host: serialized.hostname ?? serialized.host,
            remoteAddress: serialized.ip ?? serialized.remoteAddress,
            remotePort: serialized.remotePort,
          };
        },
      },
    },
  });
  const defaultRateLimit = options.e2eSupport ? E2E_RATE_LIMIT : DEFAULT_RATE_LIMIT;

  server.register(async (app) => {
    await app.register(rateLimit, {
      ...defaultRateLimit,
      global: true,
      keyGenerator: (request) => `${request.ip}:${request.method}:${routePath(request.url)}`,
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests",
      }),
    });

    registerApiRoutes(app, options);
  });

  return server;
}

function registerApiRoutes(server: FastifyInstance, options: ApiOptions): void {
  const publicConsultationOrigins = options.publicConsultationIntake?.allowedOrigins ?? [];
  const corsOptions = {
    allowLocalBrowserOrigins: options.nodeEnv !== "production" || Boolean(options.e2eSupport),
    authenticatedOrigins: authenticatedWebOrigins(options),
    publicConsultationOrigins,
  };
  server.register(cors, {
    delegator: (request, callback) => {
      callback(null, {
        origin: corsOriginForRequest(request, corsOptions),
        credentials: true,
        methods: CORS_METHODS,
      });
    },
  });

  server.get("/health", async () => ({
    ok: true,
    service: "open-practice-api",
    persistence:
      options.repository instanceof InMemoryOpenPracticeRepository ? "memory" : "postgres",
  }));

  registerSetupRoutes(server, {
    repository: options.repository,
    inboundEmailJobQueue: options.inboundEmailJobQueue,
    jwtSecret: options.jwtSecret,
    nodeEnv: options.nodeEnv,
    allowDockerBridgeSetup: options.allowDockerBridgeSetup,
    sessionTtlHours: options.sessionTtlHours,
    hashPassword,
    hashToken,
    createSessionToken,
    sessionCookie,
    rpName: options.webAuthn.rpName,
    rpID: options.webAuthn.rpID,
    origin: options.webAuthn.origin,
  });

  registerWebAuthnRoutes(server, {
    repository: options.repository,
    jwtSecret: options.jwtSecret,
    sessionTtlHours: options.sessionTtlHours,
    nodeEnv: options.nodeEnv,
    rpName: options.webAuthn.rpName,
    rpID: options.webAuthn.rpID,
    origin: options.webAuthn.origin,
  });

  server.addHook("preHandler", async (request) => {
    if (isPublicRoute(request.method, request.url)) return;
    request.auth = await authenticate(request, options.repository, options);
  });

  registerAuthRoutes(server, {
    repository: options.repository,
    jwtSecret: options.jwtSecret,
    sessionTtlHours: options.sessionTtlHours,
    nodeEnv: options.nodeEnv,
  });
  registerRecoveryRoutes(server, {
    repository: options.repository,
    jwtSecret: options.jwtSecret,
    sessionTtlHours: options.sessionTtlHours,
    nodeEnv: options.nodeEnv,
  });
  registerSessionRoutes(server);
  registerMatterRoutes(server, { repository: options.repository });
  registerContactRoutes(server, {
    repository: options.repository,
    reportJobQueue: options.reportJobQueue,
  });
  registerConnectorRoutes(server, {
    repository: options.repository,
    connectorJobQueue: options.connectorJobQueue,
    connectorDnsResolver: options.connectorDnsResolver,
  });
  registerCommunicationsRoutes(server, { repository: options.repository });
  registerConversationThreadRoutes(server, {
    repository: options.repository,
    reportJobQueue: options.reportJobQueue,
  });
  registerLegalClinicRoutes(server, { repository: options.repository });
  registerLedgerRoutes(server, {
    repository: options.repository,
    reportJobQueue: options.reportJobQueue,
  });
  registerBillingRoutes(server, {
    repository: options.repository,
    reportJobQueue: options.reportJobQueue,
    paymentProcessorProvider: options.paymentProcessorProvider,
    publicWebBaseUrl: options.publicWebBaseUrl,
  });
  registerCalDavRoutes(server, { repository: options.repository });
  registerCalendarRoutes(server, {
    repository: options.repository,
    emailJobQueue: options.emailJobQueue,
    jwtSecret: options.jwtSecret,
    publicWebBaseUrl: options.publicWebBaseUrl,
    publicApiBaseUrl: options.publicApiBaseUrl,
    meetingLinks: options.meetingLinks,
  });
  registerClientPortalRoutes(server, {
    repository: options.repository,
    jwtSecret: options.jwtSecret,
  });
  registerDocumentRoutes(server, { repository: options.repository, s3: options.s3 });
  registerDocumentAssemblyRoutes(server, { repository: options.repository });
  registerLegalResearchRoutes(server, { repository: options.repository });
  if (options.e2eSupport) {
    registerE2ESupportRoutes(server, { repository: options.repository });
  }
  registerDocumentProcessingRoutes(server, {
    repository: options.repository,
    s3: options.s3,
    ocrJobQueue: options.ocrJobQueue,
  });
  registerDraftRoutes(server, {
    repository: options.repository,
    s3: options.s3,
    draftExportRenderer: options.draftExportRenderer ?? renderDraftExport,
  });
  registerDraftAssistRoutes(server, {
    repository: options.repository,
    draftAssistProvider: options.draftAssistProvider,
    aiAssistJobQueue: options.aiAssistJobQueue,
  });
  registerAiOperationalProposalRoutes(server, {
    repository: options.repository,
    aiOperationalProposalProvider: options.aiOperationalProposalProvider,
    aiAssistJobQueue: options.aiAssistJobQueue,
  });
  registerJobsRoutes(server, {
    repository: options.repository,
    emailJobQueue: options.emailJobQueue,
    connectorJobQueue: options.connectorJobQueue,
    documentAssemblyJobQueue: options.documentAssemblyJobQueue,
    inboundEmailJobQueue: options.inboundEmailJobQueue,
    reportJobQueue: options.reportJobQueue,
    aiAssistJobQueue: options.aiAssistJobQueue,
    ocrJobQueue: options.ocrJobQueue,
  });
  registerProviderStatusRoutes(server, {
    repository: options.repository,
    draftAssistProvider: options.draftAssistProvider,
    emailJobQueue: options.emailJobQueue,
    connectorJobQueue: options.connectorJobQueue,
    documentAssemblyJobQueue: options.documentAssemblyJobQueue,
    inboundEmailJobQueue: options.inboundEmailJobQueue,
    aiAssistJobQueue: options.aiAssistJobQueue,
    ocrJobQueue: options.ocrJobQueue,
    s3: options.s3,
    jwtSecret: options.jwtSecret,
    webAuthn: {
      rpID: options.webAuthn.rpID,
      origin: options.webAuthn.origin,
    },
  });
  registerPublicConsultationIntakeRoutes(server, {
    repository: options.repository,
    emailJobQueue: options.emailJobQueue,
    publicFirmId: options.publicConsultationIntake?.firmId ?? options.devFirmId,
    publicActorUserId: options.publicConsultationIntake?.actorUserId ?? options.devUserId,
    jwtSecret: options.jwtSecret,
  });
  registerEmailRoutes(server, {
    repository: options.repository,
    emailJobQueue: options.emailJobQueue,
    jwtSecret: options.jwtSecret,
    publicWebBaseUrl: options.publicWebBaseUrl,
    connectorDnsResolver: options.connectorDnsResolver,
  });
  registerInboundEmailRoutes(server, {
    repository: options.repository,
    ocrJobQueue: options.ocrJobQueue,
    inboundEmailJobQueue: options.inboundEmailJobQueue,
    s3: options.s3,
    connectorDnsResolver: options.connectorDnsResolver,
  });
  registerShareRoutes(server, {
    repository: options.repository,
    jwtSecret: options.jwtSecret,
    emailJobQueue: options.emailJobQueue,
  });
  registerExternalUploadRoutes(server, {
    repository: options.repository,
    s3: options.s3,
    jwtSecret: options.jwtSecret,
    emailJobQueue: options.emailJobQueue,
  });
  registerAuthExtensionRoutes(server, {
    repository: options.repository,
    jwtSecret: options.jwtSecret,
    webAuthn: {
      rpID: options.webAuthn.rpID,
      origin: options.webAuthn.origin,
    },
  });
  registerAuditRoutes(server, {
    repository: options.repository,
    reportJobQueue: options.reportJobQueue,
  });
  registerSignatureRoutes(server, {
    repository: options.repository,
    signatureProvider: options.signatureProvider ?? new EmbeddedSignatureProvider(),
    emailJobQueue: options.emailJobQueue,
  });
  registerIntakeRoutes(server, {
    repository: options.repository,
    automationProvider: options.automationProvider ?? new EmbeddedAutomationProvider(),
    emailJobQueue: options.emailJobQueue,
    documentAssemblyJobQueue: options.documentAssemblyJobQueue,
  });
  registerIntakePipelineRoutes(server, { repository: options.repository });
  registerIntakeFormRoutes(server, {
    repository: options.repository,
    s3: options.s3,
    jwtSecret: options.jwtSecret,
    signatureProvider: options.signatureProvider ?? new EmbeddedSignatureProvider(),
    emailJobQueue: options.emailJobQueue,
    publicWebBaseUrl: options.publicWebBaseUrl,
  });
  registerOperationalViewRoutes(server, { repository: options.repository });
  registerOutboundWebhookRoutes(server, { repository: options.repository });
  registerTaskRoutes(server, { repository: options.repository });
  registerQueuesRoutes(server, { repository: options.repository });
  registerReportRoutes(server, {
    repository: options.repository,
    reportJobQueue: options.reportJobQueue,
  });

  server.setErrorHandler((error, request, reply) => {
    const normalizedError = error as Error & { code?: string; error?: string; statusCode?: number };
    const statusCode =
      typeof normalizedError.statusCode === "number"
        ? normalizedError.statusCode
        : reply.statusCode >= 400
          ? reply.statusCode
          : 500;
    if (statusCode >= 400 && statusCode < 500) {
      server.log.warn(
        {
          error: {
            name: normalizedError.name,
            code: normalizedError.code ?? normalizedError.error,
            statusCode,
          },
          request: {
            method: request.method,
            url: redactPublicTokenUrl(request.url),
          },
        },
        "Client request failed",
      );
    } else {
      server.log.error(error);
    }
    const apiHttpError =
      error instanceof ApiHttpError ||
      (normalizedError.name === "ApiHttpError" && typeof normalizedError.code === "string");
    if (apiHttpError) {
      reply.status(statusCode).send(
        apiRouteErrorBody({
          error: normalizedError.name ?? "ApiHttpError",
          code: normalizedError.code,
          message: normalizedError.message,
          details: "details" in normalizedError ? normalizedError.details : undefined,
        }),
      );
      return;
    }
    if (error instanceof z.ZodError) {
      reply.status(400).send(apiRouteErrorBody({ error: error.name, message: error.message }));
      return;
    }
    if (statusCode === 429 && normalizedError.error === "RATE_LIMIT_EXCEEDED") {
      reply.status(statusCode).send(
        apiRouteErrorBody({
          error: normalizedError.error,
          message: normalizedError.message ?? "Too many requests",
        }),
      );
      return;
    }
    if (statusCode >= 400 && statusCode < 500) {
      reply.status(statusCode).send(
        apiRouteErrorBody({
          error: normalizedError.name ?? normalizedError.error ?? normalizedError.code ?? "Error",
          message: normalizedError.message ?? UNEXPECTED_API_ERROR_MESSAGE,
        }),
      );
      return;
    }
    reply.status(statusCode).send(
      apiRouteErrorBody({
        error: normalizedError.name ?? normalizedError.error ?? normalizedError.code ?? "Error",
        message: UNEXPECTED_API_ERROR_MESSAGE,
      }),
    );
  });
}

declare module "fastify" {
  interface FastifyRequest {
    auth: ApiAuthContext;
  }
}

function createProviderConfigCipherForPostgres(env: ApiEnv): ProviderConfigCipher {
  if (!env.OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY) {
    throw new Error(
      "OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY is required when DATABASE_URL is configured",
    );
  }
  return createProviderConfigCipherFromKey(env.OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY);
}

export async function createRepositoryFromEnv(env: ApiEnv): Promise<{
  repository: OpenPracticeRepository;
  close?: () => Promise<void>;
}> {
  if (env.OPEN_PRACTICE_USE_MEMORY_REPO || !env.DATABASE_URL) {
    return {
      repository: new InMemoryOpenPracticeRepository({
        seedSampleData: env.OPEN_PRACTICE_DEV_SEED,
      }),
    };
  }

  const providerConfigCipher = createProviderConfigCipherForPostgres(env);
  const runtime = createDatabaseRuntime(env.DATABASE_URL);
  if (env.OPEN_PRACTICE_DEV_SEED) {
    await seedSampleData(runtime.db);
  }
  return {
    repository: new DrizzleOpenPracticeRepository(runtime.db, { providerConfigCipher }),
    close: runtime.close,
  };
}

function createS3FromEnv(env: ApiEnv): ApiOptions["s3"] {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) return undefined;
  return {
    bucket: env.S3_BUCKET,
    serverSideEncryption: env.S3_SERVER_SIDE_ENCRYPTION,
    client: new S3Client({
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    }),
  };
}

function createMeetingLinksFromEnv(env: ApiEnv): ApiOptions["meetingLinks"] {
  if (!env.WEBRTC_MEETING_PROVIDER_KEY || !env.WEBRTC_MEETING_BASE_URL) return undefined;
  return {
    providerKey: env.WEBRTC_MEETING_PROVIDER_KEY,
    hostedMeetingBaseUrl: env.WEBRTC_MEETING_BASE_URL,
    guestAccessTokenSigningConfigured: Boolean(env.AUTH_JWT_SECRET),
  };
}

function splitCsvEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function buildPublicConsultationIntakeSettingsFromEnv(
  env: ApiEnv,
): PublicConsultationIntakeNotificationSettings | undefined {
  const senderAddress = env.PUBLIC_CONSULTATION_INTAKE_SENDER_ADDRESS?.trim() ?? "";
  const recipientEmails = splitCsvEnv(env.PUBLIC_CONSULTATION_INTAKE_RECIPIENT_EMAILS);
  const allowedOrigins = splitCsvEnv(env.PUBLIC_CONSULTATION_INTAKE_ALLOWED_ORIGINS);
  const submissionTokenHash = env.PUBLIC_CONSULTATION_INTAKE_SUBMISSION_TOKEN_HASH?.trim();
  const reviewOwnerUserId =
    env.PUBLIC_CONSULTATION_INTAKE_REVIEW_OWNER_USER_ID?.trim() ||
    env.PUBLIC_CONSULTATION_INTAKE_ACTOR_USER_ID?.trim() ||
    env.DEV_AUTH_USER_ID;
  const shouldBootstrap =
    env.PUBLIC_CONSULTATION_INTAKE_ENABLED !== undefined ||
    senderAddress.length > 0 ||
    recipientEmails.length > 0 ||
    Boolean(submissionTokenHash) ||
    Boolean(env.PUBLIC_CONSULTATION_INTAKE_REVIEW_OWNER_USER_ID);

  if (!shouldBootstrap) return undefined;

  const enabled = env.PUBLIC_CONSULTATION_INTAKE_ENABLED === true;
  if (enabled && (!senderAddress || recipientEmails.length === 0 || allowedOrigins.length === 0)) {
    throw new Error(
      "PUBLIC_CONSULTATION_INTAKE_ENABLED requires PUBLIC_CONSULTATION_INTAKE_SENDER_ADDRESS, PUBLIC_CONSULTATION_INTAKE_RECIPIENT_EMAILS, and PUBLIC_CONSULTATION_INTAKE_ALLOWED_ORIGINS",
    );
  }
  if (enabled && !submissionTokenHash) {
    throw new Error(
      "PUBLIC_CONSULTATION_INTAKE_ENABLED requires PUBLIC_CONSULTATION_INTAKE_SUBMISSION_TOKEN_HASH",
    );
  }

  return {
    enabled,
    senderAddress,
    recipientEmails,
    allowedOrigins,
    ...(submissionTokenHash ? { submissionTokenHash } : {}),
    reviewOwnerUserId,
  };
}

export async function configurePublicConsultationIntakeSettingsFromEnv(
  repository: OpenPracticeRepository,
  env: ApiEnv,
): Promise<PublicConsultationIntakeNotificationSettings | undefined> {
  const rawSettings = buildPublicConsultationIntakeSettingsFromEnv(env);
  if (!rawSettings) return undefined;
  const settings = publicConsultationBootstrapSettingsSchema.parse(rawSettings);
  const firmId = env.PUBLIC_CONSULTATION_INTAKE_FIRM_ID ?? env.DEV_AUTH_FIRM_ID;
  const now = new Date().toISOString();
  await repository.upsertProviderSetting({
    id: `provider-public-intake-${firmId}`,
    firmId,
    kind: PUBLIC_CONSULTATION_SETTINGS_KIND,
    key: PUBLIC_CONSULTATION_SETTINGS_KEY,
    enabled: settings.enabled,
    encryptedConfig: JSON.stringify(settings),
    createdAt: now,
    updatedAt: now,
  });
  return settings;
}

export type InboundEmailMailgunBootstrapSettings = z.infer<
  typeof inboundEmailMailgunBootstrapSettingsSchema
>;

export function buildInboundEmailMailgunSettingsFromEnv(
  env: ApiEnv,
): InboundEmailMailgunBootstrapSettings | undefined {
  const webhookSigningKey = env.INBOUND_EMAIL_WEBHOOK_SECRET?.trim();
  if (!webhookSigningKey) return undefined;
  const domain = env.INBOUND_EMAIL_DOMAIN?.trim();
  return inboundEmailMailgunBootstrapSettingsSchema.parse({
    webhookSigningKey,
    ...(domain ? { domain } : {}),
  });
}

export async function configureInboundEmailMailgunSettingsFromEnv(
  repository: OpenPracticeRepository,
  env: ApiEnv,
): Promise<InboundEmailMailgunBootstrapSettings | undefined> {
  const settings = buildInboundEmailMailgunSettingsFromEnv(env);
  if (!settings) return undefined;
  const firmResolution = await repository.resolveConfiguredFirm();
  if (firmResolution.status !== "ready") {
    throw new Error("INBOUND_EMAIL_WEBHOOK_SECRET requires exactly one configured firm");
  }
  const now = new Date().toISOString();
  await repository.upsertProviderSetting({
    id: `provider-inbound-email-mailgun-${firmResolution.firm.id}`,
    firmId: firmResolution.firm.id,
    kind: INBOUND_EMAIL_SETTINGS_KIND,
    key: INBOUND_EMAIL_MAILGUN_SETTINGS_KEY,
    enabled: true,
    encryptedConfig: JSON.stringify(settings),
    createdAt: now,
    updatedAt: now,
  });
  return settings;
}

async function configureE2ESmtpSettingsFromEnv(
  repository: OpenPracticeRepository,
  env: ApiEnv,
): Promise<void> {
  if (!env.E2E_MODE) return;
  const now = new Date().toISOString();
  await repository.upsertProviderSetting({
    id: `provider-smtp-e2e-${env.E2E_MODE}-${env.DEV_AUTH_FIRM_ID}`,
    firmId: env.DEV_AUTH_FIRM_ID,
    kind: E2E_SMTP_SETTINGS_KIND,
    key: `${env.E2E_MODE}-synthetic-smtp`,
    enabled: true,
    encryptedConfig: JSON.stringify({
      mode: env.E2E_MODE,
      provider: "synthetic-e2e-smtp",
    }),
    createdAt: now,
    updatedAt: now,
  });
}

function redisConnectionFromUrl(redisUrl: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
} {
  const parsed = new URL(redisUrl);
  const db = parsed.pathname && parsed.pathname !== "/" ? Number(parsed.pathname.slice(1)) : 0;
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: Number.isFinite(db) ? db : 0,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
  };
}

type ClosableApiJobQueue = ApiJobQueue & { close?: () => Promise<void> };

function createSyntheticE2EJobQueue(queueName: string): ClosableApiJobQueue {
  return {
    async add(_name, _data, options) {
      return { id: options?.jobId ?? `${queueName}-e2e-job` };
    },
  };
}

function createEmailJobQueueFromEnv(env: ApiEnv): ClosableApiJobQueue | undefined {
  if (!env.REDIS_URL) {
    return env.E2E_MODE === "host" ? createSyntheticE2EJobQueue("email") : undefined;
  }
  return new Queue("email", {
    connection: redisConnectionFromUrl(env.REDIS_URL),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 1_000,
      removeOnFail: false,
    },
  });
}

function createConnectorJobQueueFromEnv(env: ApiEnv): Queue | undefined {
  if (!env.REDIS_URL) return undefined;
  return new Queue("connectors", {
    connection: redisConnectionFromUrl(env.REDIS_URL),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 1_000,
      removeOnFail: false,
    },
  });
}

function createDocumentAssemblyJobQueueFromEnv(env: ApiEnv): Queue | undefined {
  if (!env.REDIS_URL) return undefined;
  return new Queue("document_assembly", {
    connection: redisConnectionFromUrl(env.REDIS_URL),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: 500,
      removeOnFail: false,
    },
  });
}

function createInboundEmailJobQueueFromEnv(env: ApiEnv): Queue | undefined {
  if (!env.REDIS_URL) return undefined;
  return new Queue("inbound_email", {
    connection: redisConnectionFromUrl(env.REDIS_URL),
    defaultJobOptions: {
      attempts: 4,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: 1_000,
      removeOnFail: false,
    },
  });
}

function createOcrJobQueueFromEnv(env: ApiEnv): Queue | undefined {
  if (!env.REDIS_URL) return undefined;
  return new Queue("ocr", {
    connection: redisConnectionFromUrl(env.REDIS_URL),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: 500,
      removeOnFail: false,
    },
  });
}

function createReportJobQueueFromEnv(env: ApiEnv): Queue | undefined {
  if (!env.REDIS_URL) return undefined;
  return new Queue("reports", {
    connection: redisConnectionFromUrl(env.REDIS_URL),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: 500,
      removeOnFail: false,
    },
  });
}

function createAiAssistJobQueueFromEnv(env: ApiEnv): Queue | undefined {
  if (!env.REDIS_URL) return undefined;
  return new Queue("ai_triage", {
    connection: redisConnectionFromUrl(env.REDIS_URL),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: 500,
      removeOnFail: false,
    },
  });
}

function createPaymentProcessorFromEnv(env: ApiEnv): PaymentProcessorProvider | undefined {
  if (!env.STRIPE_SECRET_KEY) return undefined;
  return new StripePaymentProcessorProvider({ secretKey: env.STRIPE_SECRET_KEY });
}

if (process.env.NODE_ENV !== "test") {
  const env = envSchema.parse(process.env);
  validateProductionReadiness(env);
  const { repository, close } = await createRepositoryFromEnv(env);
  await configurePublicConsultationIntakeSettingsFromEnv(repository, env);
  await configureInboundEmailMailgunSettingsFromEnv(repository, env);
  await configureE2ESmtpSettingsFromEnv(repository, env);
  const emailJobQueue = createEmailJobQueueFromEnv(env);
  const connectorJobQueue = createConnectorJobQueueFromEnv(env);
  const documentAssemblyJobQueue = createDocumentAssemblyJobQueueFromEnv(env);
  const inboundEmailJobQueue = createInboundEmailJobQueueFromEnv(env);
  const reportJobQueue = createReportJobQueueFromEnv(env);
  const aiAssistJobQueue = createAiAssistJobQueueFromEnv(env);
  const ocrJobQueue = createOcrJobQueueFromEnv(env);
  const paymentProcessorProvider = createPaymentProcessorFromEnv(env);
  const server = createApiServer({
    repository,
    jwtSecret: env.AUTH_JWT_SECRET,
    nodeEnv: env.NODE_ENV,
    devFirmId: env.DEV_AUTH_FIRM_ID,
    devUserId: env.DEV_AUTH_USER_ID,
    signatureProvider: new EmbeddedSignatureProvider(),
    automationProvider: new EmbeddedAutomationProvider(),
    paymentProcessorProvider,
    emailJobQueue,
    connectorJobQueue,
    documentAssemblyJobQueue,
    inboundEmailJobQueue,
    reportJobQueue,
    aiAssistJobQueue,
    ocrJobQueue,
    sessionTtlHours: env.SESSION_TTL_HOURS,
    publicWebBaseUrl: env.PUBLIC_WEB_BASE_URL ?? env.WEBAUTHN_ORIGIN,
    publicApiBaseUrl: env.OPEN_PRACTICE_PUBLIC_API_ORIGIN,
    publicConsultationIntake: {
      allowedOrigins: splitCsvEnv(env.PUBLIC_CONSULTATION_INTAKE_ALLOWED_ORIGINS),
      firmId: env.PUBLIC_CONSULTATION_INTAKE_FIRM_ID ?? env.DEV_AUTH_FIRM_ID,
      actorUserId: env.PUBLIC_CONSULTATION_INTAKE_ACTOR_USER_ID ?? env.DEV_AUTH_USER_ID,
    },
    meetingLinks: createMeetingLinksFromEnv(env),
    allowDockerBridgeSetup: env.OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP,
    s3: createS3FromEnv(env),
    e2eSupport: Boolean(env.E2E_MODE),
    webAuthn: {
      rpName: env.WEBAUTHN_RP_NAME,
      rpID: env.WEBAUTHN_RP_ID,
      origin: env.WEBAUTHN_ORIGIN,
    },
  });
  process.once("SIGTERM", () => {
    void Promise.all([
      emailJobQueue?.close?.(),
      connectorJobQueue?.close(),
      documentAssemblyJobQueue?.close(),
      inboundEmailJobQueue?.close(),
      reportJobQueue?.close(),
      aiAssistJobQueue?.close(),
      ocrJobQueue?.close(),
      close?.(),
    ]).then(() => process.exit(0));
  });
  await server.listen({ host: "0.0.0.0", port: env.API_PORT });
}
