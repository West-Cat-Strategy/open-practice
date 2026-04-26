import cors from "@fastify/cors";
import { S3Client } from "@aws-sdk/client-s3";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { jwtVerify } from "jose";
import { pbkdf2Sync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { z } from "zod";
import {
  createDatabaseRuntime,
  DrizzleOpenPracticeRepository,
  InMemoryOpenPracticeRepository,
  seedSampleData,
  type OpenPracticeRepository,
} from "@open-practice/database";
import { canAccess, dashboardCapabilities, type AccessRequest } from "@open-practice/domain";
import type { DocumentAutomationProvider, SignatureProvider, User } from "@open-practice/domain";
import { EmbeddedAutomationProvider, EmbeddedSignatureProvider } from "@open-practice/providers";
import { registerAuthExtensionRoutes } from "./routes/auth-extensions.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerDocumentProcessingRoutes } from "./routes/document-processing.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerEmailRoutes } from "./routes/email.js";
import { registerExternalUploadRoutes } from "./routes/external-uploads.js";
import { registerInboundEmailRoutes } from "./routes/inbound-email.js";
import { registerIntakeRoutes } from "./routes/intake.js";
import { registerJobsRoutes } from "./routes/jobs.js";
import { registerLedgerRoutes } from "./routes/ledger.js";
import { registerQueuesRoutes } from "./routes/queues.js";
import { registerShareRoutes } from "./routes/shares.js";
import { registerSignatureRoutes } from "./routes/signatures.js";
import { registerSetupRoutes } from "./routes/setup.js";

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
});

export type ApiEnv = z.infer<typeof envSchema>;

const SESSION_COOKIE_NAME = "open_practice_session";
const PASSWORD_HASH_ITERATIONS = 210_000;
const PASSWORD_HASH_KEY_LENGTH = 32;
const PASSWORD_HASH_DIGEST = "sha256";

const loginBodySchema = z.object({
  firmId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const passwordSetupTokenBodySchema = z.object({
  userId: z.string().min(1),
  expiresInHours: z.number().int().positive().max(168).default(24),
});

const passwordSetupBodySchema = z.object({
  firmId: z.string().min(1),
  userId: z.string().min(1),
  token: z.string().min(32),
  password: z.string().min(8),
});

const conflictBodySchema = z.object({
  prospectiveName: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  identifiers: z.array(z.object({ type: z.string().min(1), value: z.string().min(1) })).optional(),
  prospectiveRole: z.enum(["client", "opposing_party", "third_party"]).optional(),
  includeClosedMatters: z.boolean().default(true),
});

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

function hashToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_HASH_ITERATIONS,
    PASSWORD_HASH_KEY_LENGTH,
    PASSWORD_HASH_DIGEST,
  ).toString("hex");
  return `pbkdf2:${PASSWORD_HASH_DIGEST}:${PASSWORD_HASH_ITERATIONS}:${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [scheme, digest, iterations, salt, hash] = storedHash.split(":");
  if (scheme !== "pbkdf2" || !digest || !iterations || !salt || !hash) return false;
  const candidate = pbkdf2Sync(
    password,
    salt,
    Number(iterations),
    Buffer.from(hash, "hex").length,
    digest,
  );
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function readSessionToken(request: FastifyRequest): string | undefined {
  const header = request.headers["x-open-practice-session"];
  if (typeof header === "string" && header.length > 0) return header;
  const cookie = request.headers.cookie;
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function sessionCookie(token: string, expiresAt: string, secure: boolean): string {
  const secureFlag = secure ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(
    token,
  )}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Expires=${new Date(expiresAt).toUTCString()}`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function publicRoute(method: string, url: string): boolean {
  const path = url.split("?")[0];
  return (
    path === "/health" ||
    (method === "GET" && path === "/api/setup/status") ||
    (method === "POST" && path === "/api/setup/complete") ||
    (method === "POST" && path === "/api/auth/login") ||
    (method === "POST" && path === "/api/auth/password-setup")
  );
}

async function authenticate(
  request: FastifyRequest,
  repository: OpenPracticeRepository,
  options: Pick<ApiOptions, "jwtSecret" | "nodeEnv" | "devFirmId" | "devUserId">,
): Promise<ApiAuthContext> {
  const authorization = request.headers.authorization;
  let firmId = options.devFirmId;
  let userId = options.devUserId;
  const isProduction = (options.nodeEnv ?? process.env.NODE_ENV) === "production";
  const sessionToken = readSessionToken(request);

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

function requireAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  if (!canAccess({ ...request, user: context.user, firmId: context.firmId })) {
    throw Object.assign(new Error("Matter access required"), { statusCode: 403 });
  }
}

export function createApiServer(options: ApiOptions): FastifyInstance {
  const server = Fastify({ logger: true });

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
  });

  server.addHook("preHandler", async (request) => {
    if (publicRoute(request.method, request.url)) return;
    request.auth = await authenticate(request, options.repository, options);
  });

  server.post("/api/auth/login", async (request, reply) => {
    if (!options.jwtSecret) {
      throw Object.assign(new Error("Session authentication is not configured"), {
        statusCode: 503,
      });
    }
    const body = loginBodySchema.parse(request.body);
    const user = await options.repository.getUserByEmail(body.firmId, body.email);
    const account = user
      ? await options.repository.getAuthAccount(user.firmId, user.id)
      : undefined;
    if (!user || !account || !verifyPassword(body.password, account.passwordHash)) {
      throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
    }

    const token = createSessionToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (options.sessionTtlHours ?? 12) * 60 * 60 * 1000,
    ).toISOString();
    const session = await options.repository.createAuthSession({
      id: crypto.randomUUID(),
      firmId: user.firmId,
      userId: user.id,
      tokenHash: hashToken(token, options.jwtSecret),
      createdAt: now.toISOString(),
      expiresAt,
    });
    reply.header("set-cookie", sessionCookie(token, expiresAt, options.nodeEnv === "production"));
    return { user, session: { id: session.id, expiresAt }, token };
  });

  server.post("/api/auth/logout", async (request, reply) => {
    const token = readSessionToken(request);
    if (token && options.jwtSecret) {
      await options.repository.revokeAuthSession(
        hashToken(token, options.jwtSecret),
        new Date().toISOString(),
      );
    }
    reply.header("set-cookie", clearSessionCookie());
    return { ok: true };
  });

  server.get("/api/auth/session", async (request) => ({ user: request.auth.user }));

  server.post("/api/auth/password-setup-tokens", async (request) => {
    if (request.auth.user.role !== "owner_admin") {
      throw Object.assign(new Error("Owner admin access required"), { statusCode: 403 });
    }
    if (!options.jwtSecret) {
      throw Object.assign(new Error("Password setup tokens are not configured"), {
        statusCode: 503,
      });
    }
    const body = passwordSetupTokenBodySchema.parse(request.body);
    const user = await options.repository.getUser(request.auth.firmId, body.userId);
    if (!user) {
      throw Object.assign(new Error("User was not found"), { statusCode: 404 });
    }
    const token = createSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + body.expiresInHours * 60 * 60 * 1000).toISOString();
    const record = await options.repository.createPasswordSetupToken({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      userId: user.id,
      tokenHash: hashToken(token, options.jwtSecret),
      createdByUserId: request.auth.user.id,
      createdAt: now.toISOString(),
      expiresAt,
    });
    return { token, expiresAt: record.expiresAt, userId: user.id };
  });

  server.post("/api/auth/password-setup", async (request) => {
    if (!options.jwtSecret) {
      throw Object.assign(new Error("Password setup is not configured"), { statusCode: 503 });
    }
    const body = passwordSetupBodySchema.parse(request.body);
    const now = new Date().toISOString();
    const token = await options.repository.consumePasswordSetupToken(
      hashToken(body.token, options.jwtSecret),
      now,
    );
    if (!token || token.firmId !== body.firmId || token.userId !== body.userId) {
      throw Object.assign(new Error("Password setup token is invalid or expired"), {
        statusCode: 401,
      });
    }
    const user = await options.repository.getUser(body.firmId, body.userId);
    if (!user) throw Object.assign(new Error("User was not found"), { statusCode: 404 });
    await options.repository.setAuthPassword({
      firmId: body.firmId,
      userId: body.userId,
      passwordHash: hashPassword(body.password),
      passwordUpdatedAt: now,
    });
    return { user };
  });

  server.get("/api/session", async (request) => ({ user: request.auth.user }));

  server.get("/api/capabilities", async (request) => ({
    sections: dashboardCapabilities({
      user: request.auth.user,
      firmId: request.auth.firmId,
      matterId: request.auth.user.assignedMatterIds[0],
    }),
  }));

  server.get("/api/overview", async (request) =>
    options.repository.getOverview(request.auth.firmId),
  );

  server.get("/api/matters", async (request) =>
    options.repository.listMattersForUser(request.auth.user),
  );

  server.post("/api/conflicts/check", async (request) => {
    requireAccess(request.auth, { resource: "contact", action: "read" });
    const body = conflictBodySchema.parse(request.body);
    return options.repository.runConflictCheck({
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      ...body,
    });
  });

  registerLedgerRoutes(server, { repository: options.repository });
  registerBillingRoutes(server, { repository: options.repository });
  registerDocumentRoutes(server, { repository: options.repository, s3: options.s3 });
  registerDocumentProcessingRoutes(server, { repository: options.repository });
  registerJobsRoutes(server, { repository: options.repository });
  registerEmailRoutes(server, { repository: options.repository });
  registerInboundEmailRoutes(server, { repository: options.repository });
  registerShareRoutes(server, { repository: options.repository });
  registerExternalUploadRoutes(server, { repository: options.repository, s3: options.s3 });
  registerAuthExtensionRoutes(server);

  server.get("/api/audit", async (request) => {
    requireAccess(request.auth, { resource: "audit_log", action: "read" });
    return options.repository.listAuditEvents(request.auth.firmId);
  });

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
    const normalizedError = error as Error & { statusCode?: number };
    const statusCode =
      typeof normalizedError.statusCode === "number" ? normalizedError.statusCode : 400;
    reply.status(statusCode).send({
      error: normalizedError.name,
      message: normalizedError.message,
    });
  });

  return server;
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
  });
  process.once("SIGTERM", () => void close?.());
  await server.listen({ host: "0.0.0.0", port: env.API_PORT });
}
