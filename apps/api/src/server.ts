import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { S3Client } from "@aws-sdk/client-s3";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { jwtVerify } from "jose";
import { z } from "zod";
import {
  createDatabaseRuntime,
  DrizzleOpenPracticeRepository,
  InMemoryOpenPracticeRepository,
  seedSampleData,
  type OpenPracticeRepository,
} from "@open-practice/database";
import type { DocumentAutomationProvider, SignatureProvider, User } from "@open-practice/domain";
import { EmbeddedAutomationProvider, EmbeddedSignatureProvider } from "@open-practice/providers";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAuthExtensionRoutes } from "./routes/auth-extensions.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerDocumentProcessingRoutes } from "./routes/document-processing.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerDraftRoutes } from "./routes/drafts.js";
import { registerEmailRoutes } from "./routes/email.js";
import { registerExternalUploadRoutes } from "./routes/external-uploads.js";
import { registerInboundEmailRoutes } from "./routes/inbound-email.js";
import { registerIntakeRoutes } from "./routes/intake.js";
import { registerJobsRoutes } from "./routes/jobs.js";
import { registerLedgerRoutes } from "./routes/ledger.js";
import { registerMatterRoutes } from "./routes/matters.js";
import { registerQueuesRoutes } from "./routes/queues.js";
import { registerRecoveryRoutes } from "./routes/recovery.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerShareRoutes } from "./routes/shares.js";
import { registerSignatureRoutes } from "./routes/signatures.js";
import { registerSetupRoutes } from "./routes/setup.js";
import { registerWebAuthnRoutes } from "./routes/webauthn.js";
import {
  hashToken,
  hashPassword,
  createSessionToken,
  sessionCookie,
  readSessionToken,
  isPublicRoute,
} from "./http/auth-helpers.js";

const DEV_EXAMPLE_JWT_SECRET = "dev-only-change-me-at-least-16-chars";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

export const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: optionalString,
  OPEN_PRACTICE_USE_MEMORY_REPO: z.coerce.boolean().default(false),
  OPEN_PRACTICE_DEV_SEED: z.coerce.boolean().default(false),
  AUTH_JWT_SECRET: optionalString,
  DEV_AUTH_USER_ID: z.string().default("user-admin"),
  DEV_AUTH_FIRM_ID: z.string().default("firm-west-legal"),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().default("local"),
  S3_BUCKET: z.string().default("open-practice-documents"),
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  OPEN_PRACTICE_SETUP_KEY: optionalString,
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
});

export type ApiEnv = z.infer<typeof envSchema>;

// Session cookie name moved to http/auth-helpers.ts
const DEFAULT_RATE_LIMIT = { max: 300, timeWindow: "1 minute" };
// Auth rate limits moved to routes/auth.ts

// Auth schemas moved to routes/auth.ts

export interface ApiAuthContext {
  user: User;
  firmId: string;
}

interface ApiOptions {
  repository: OpenPracticeRepository;
  jwtSecret?: string;
  nodeEnv?: string;
  devUserId: string;
  devFirmId: string;
  signatureProvider?: SignatureProvider;
  automationProvider?: DocumentAutomationProvider;
  sessionTtlHours?: number;
  setupKey?: string;
  s3?: {
    client: S3Client;
    bucket: string;
  };
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
  if (!env.AUTH_JWT_SECRET || env.AUTH_JWT_SECRET.length < 32) {
    throw new Error("AUTH_JWT_SECRET must be at least 32 characters in production");
  }
  if (env.AUTH_JWT_SECRET === DEV_EXAMPLE_JWT_SECRET) {
    throw new Error("AUTH_JWT_SECRET must not use the development example value in production");
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

function routePath(url: string): string {
  return url.split("?")[0] ?? url;
}

export function createApiServer(options: ApiOptions): FastifyInstance {
  const server = Fastify({ logger: true });

  server.register(async (app) => {
    await app.register(rateLimit, {
      ...DEFAULT_RATE_LIMIT,
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
  server.register(cors, {
    origin: [/^http:\/\/localhost:\d+$/],
    credentials: true,
  });

  server.get("/health", async () => ({
    ok: true,
    service: "open-practice-api",
    persistence:
      options.repository instanceof InMemoryOpenPracticeRepository ? "memory" : "postgres",
  }));

  registerSetupRoutes(server, {
    repository: options.repository,
    jwtSecret: options.jwtSecret,
    nodeEnv: options.nodeEnv,
    setupKey: options.setupKey,
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
  registerLedgerRoutes(server, { repository: options.repository });
  registerBillingRoutes(server, { repository: options.repository });
  registerDocumentRoutes(server, { repository: options.repository, s3: options.s3 });
  registerDocumentProcessingRoutes(server, { repository: options.repository });
  registerDraftRoutes(server, { repository: options.repository });
  registerJobsRoutes(server, { repository: options.repository });
  registerEmailRoutes(server, { repository: options.repository });
  registerInboundEmailRoutes(server, { repository: options.repository });
  registerShareRoutes(server, { repository: options.repository });
  registerExternalUploadRoutes(server, { repository: options.repository, s3: options.s3 });
  registerAuthExtensionRoutes(server);
  registerAuditRoutes(server, { repository: options.repository });
  registerSignatureRoutes(server, {
    repository: options.repository,
    signatureProvider: options.signatureProvider ?? new EmbeddedSignatureProvider(),
  });
  registerIntakeRoutes(server, {
    repository: options.repository,
    automationProvider: options.automationProvider ?? new EmbeddedAutomationProvider(),
  });
  registerQueuesRoutes(server, { repository: options.repository });

  server.setErrorHandler((error, _request, reply) => {
    server.log.error(error);
    const normalizedError = error as Error & { code?: string; error?: string; statusCode?: number };
    const statusCode =
      typeof normalizedError.statusCode === "number"
        ? normalizedError.statusCode
        : reply.statusCode >= 400
          ? reply.statusCode
          : 400;
    reply.status(statusCode).send({
      error: normalizedError.name ?? normalizedError.error ?? normalizedError.code ?? "Error",
      message: normalizedError.message,
    });
  });
}

declare module "fastify" {
  interface FastifyRequest {
    auth: ApiAuthContext;
  }
}

async function createRepositoryFromEnv(env: ApiEnv): Promise<{
  repository: OpenPracticeRepository;
  close?: () => Promise<void>;
}> {
  if (env.OPEN_PRACTICE_USE_MEMORY_REPO || !env.DATABASE_URL) {
    return { repository: new InMemoryOpenPracticeRepository() };
  }

  const runtime = createDatabaseRuntime(env.DATABASE_URL);
  if (env.OPEN_PRACTICE_DEV_SEED) {
    await seedSampleData(runtime.db);
  }
  return {
    repository: new DrizzleOpenPracticeRepository(runtime.db),
    close: runtime.close,
  };
}

function createS3FromEnv(env: ApiEnv): ApiOptions["s3"] {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) return undefined;
  return {
    bucket: env.S3_BUCKET,
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

if (process.env.NODE_ENV !== "test") {
  const env = envSchema.parse(process.env);
  validateProductionReadiness(env);
  const { repository, close } = await createRepositoryFromEnv(env);
  const server = createApiServer({
    repository,
    jwtSecret: env.AUTH_JWT_SECRET,
    nodeEnv: env.NODE_ENV,
    devFirmId: env.DEV_AUTH_FIRM_ID,
    devUserId: env.DEV_AUTH_USER_ID,
    signatureProvider: new EmbeddedSignatureProvider(),
    automationProvider: new EmbeddedAutomationProvider(),
    sessionTtlHours: env.SESSION_TTL_HOURS,
    setupKey: env.OPEN_PRACTICE_SETUP_KEY,
    s3: createS3FromEnv(env),
    webAuthn: {
      rpName: env.WEBAUTHN_RP_NAME,
      rpID: env.WEBAUTHN_RP_ID,
      origin: env.WEBAUTHN_ORIGIN,
    },
  });
  process.once("SIGTERM", () => void close?.());
  await server.listen({ host: "0.0.0.0", port: env.API_PORT });
}
