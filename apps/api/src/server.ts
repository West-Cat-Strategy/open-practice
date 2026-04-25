import cors from "@fastify/cors";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
import { canAccess, dashboardCapabilities, type AccessRequest } from "@open-practice/domain";
import type {
  IntakeSessionRecord,
  LedgerTransaction,
  SignatureProvider,
  SignatureProviderEventRecord,
  SignatureProviderStatus,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  SignatureWebhookAttemptRecord,
  User,
} from "@open-practice/domain";
import { DocuSealSignatureProvider, ManualSignatureProvider } from "@open-practice/providers";

const envSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().optional(),
  OPEN_PRACTICE_USE_MEMORY_REPO: z.coerce.boolean().default(false),
  OPEN_PRACTICE_DEV_SEED: z.coerce.boolean().default(false),
  AUTH_JWT_SECRET: z.string().min(16).optional(),
  DEV_AUTH_USER_ID: z.string().default("user-admin"),
  DEV_AUTH_FIRM_ID: z.string().default("firm-west-legal"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("local"),
  S3_BUCKET: z.string().default("open-practice-documents"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  DOCUSEAL_BASE_URL: z.string().url().optional(),
  DOCUSEAL_API_KEY: z.string().optional(),
});

const conflictBodySchema = z.object({
  prospectiveName: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  identifiers: z.array(z.object({ type: z.string().min(1), value: z.string().min(1) })).optional(),
  prospectiveRole: z.enum(["client", "opposing_party", "third_party"]).optional(),
  includeClosedMatters: z.boolean().default(true),
});

const ledgerPostBodySchema = z.object({
  id: z.string().min(1),
  idempotencyKey: z.string().min(1),
  requestFingerprint: z.string().min(1).optional(),
  postedAt: z.string().datetime().optional(),
  reversesTransactionId: z.string().min(1).optional(),
  entries: z.array(
    z.object({
      firmId: z.string().min(1).optional(),
      matterId: z.string().min(1),
      clientId: z.string().min(1),
      accountId: z.string().min(1),
      debitCents: z.number().int().nonnegative(),
      creditCents: z.number().int().nonnegative(),
      memo: z.string().min(1),
      reversingTransactionId: z.string().min(1).optional(),
    }),
  ),
});

const ledgerQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

const presignQuerySchema = z.object({
  matterId: z.string().min(1),
  filename: z.string().min(1),
  checksumSha256: z.string().min(16).default("pending-client-checksum"),
  classification: z
    .enum(["general", "privileged", "work_product", "financial", "identity"])
    .default("general"),
  legalHold: z.coerce.boolean().default(false),
});

const uploadCompleteBodySchema = z.object({
  checksumSha256: z.string().min(16),
  scanStatus: z.enum(["pending", "queued", "passed", "failed", "not_required"]).default("queued"),
});

const signatureRequestBodySchema = z.object({
  matterId: z.string().min(1),
  documentId: z.string().min(1),
  title: z.string().min(1),
  consentText: z.string().min(1),
  signers: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.string().min(1),
      }),
    )
    .min(1),
});

const signatureProviderEventBodySchema = z.object({
  signatureRequestId: z.string().min(1),
  provider: z.enum(["docuseal", "manual"]),
  externalId: z.string().min(1),
  status: z.enum([
    "draft",
    "pending_provider_submission",
    "sent",
    "viewed",
    "completed",
    "declined",
    "provider_error",
  ]),
  occurredAt: z.string().datetime().optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const intakeSessionBodySchema = z.object({
  matterId: z.string().min(1),
  templateId: z.string().min(1).default("intake-template-001"),
  clientContactId: z.string().min(1).optional(),
  interviewUrl: z.string().url().optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const generatedDocumentBodySchema = z.object({
  title: z.string().min(1),
  externalId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  storageKey: z.string().min(1).optional(),
  checksumSha256: z.string().min(16).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

export interface ApiAuthContext {
  user: User;
  firmId: string;
}

interface ApiOptions {
  repository: OpenPracticeRepository;
  jwtSecret?: string;
  devUserId: string;
  devFirmId: string;
  signatureProvider?: SignatureProvider;
  s3?: {
    client: S3Client;
    bucket: string;
  };
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function authenticate(
  request: FastifyRequest,
  repository: OpenPracticeRepository,
  options: Pick<ApiOptions, "jwtSecret" | "devFirmId" | "devUserId">,
): Promise<ApiAuthContext> {
  const authorization = request.headers.authorization;
  let firmId = options.devFirmId;
  let userId = options.devUserId;

  if (authorization?.startsWith("Bearer ")) {
    if (!options.jwtSecret) {
      throw Object.assign(new Error("JWT authentication is not configured"), { statusCode: 503 });
    }
    const secret = new TextEncoder().encode(options.jwtSecret);
    const { payload } = await jwtVerify(authorization.slice("Bearer ".length), secret);
    firmId = z.string().parse(payload.firmId);
    userId = z.string().parse(payload.sub);
  } else if (request.headers["x-open-practice-user-id"]) {
    userId = z.string().parse(request.headers["x-open-practice-user-id"]);
    firmId = z.string().parse(request.headers["x-open-practice-firm-id"] ?? options.devFirmId);
  } else if (process.env.NODE_ENV === "production") {
    throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
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

function hasFirmWideLedgerAccess(user: User): boolean {
  return ["owner_admin", "auditor", "billing_bookkeeper"].includes(user.role);
}

export function createApiServer(options: ApiOptions): FastifyInstance {
  const server = Fastify({ logger: true });

  server.register(cors, {
    origin: [/^http:\/\/localhost:\d+$/],
  });

  server.get("/health", async () => ({
    ok: true,
    service: "open-practice-api",
    persistence:
      options.repository instanceof InMemoryOpenPracticeRepository ? "memory" : "postgres",
  }));

  server.addHook("preHandler", async (request) => {
    if (request.url === "/health") return;
    request.auth = await authenticate(request, options.repository, options);
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

  server.get("/api/ledger", async (request) => {
    const query = ledgerQuerySchema.parse(request.query);
    if (!query.matterId && !hasFirmWideLedgerAccess(request.auth.user)) {
      throw Object.assign(new Error("matterId is required for matter-scoped ledger access"), {
        statusCode: 400,
      });
    }
    requireAccess(request.auth, {
      resource: "trust_ledger",
      action: "read",
      matterId: query.matterId,
    });
    return options.repository.getLedger(request.auth.firmId, query);
  });

  server.post("/api/ledger/transactions", async (request) => {
    requireAccess(request.auth, {
      resource: "trust_ledger",
      action: "create",
      matterId: request.auth.user.assignedMatterIds[0],
    });
    const body = ledgerPostBodySchema.parse(request.body);
    const transaction: LedgerTransaction = {
      id: body.id,
      firmId: request.auth.firmId,
      idempotencyKey: body.idempotencyKey,
      requestFingerprint: body.requestFingerprint,
      postedByUserId: request.auth.user.id,
      postedAt: body.postedAt ?? new Date().toISOString(),
      reversesTransactionId: body.reversesTransactionId,
      entries: body.entries.map((entry) => ({
        ...entry,
        firmId: entry.firmId ?? request.auth.firmId,
      })),
    };
    await options.repository.validateLedgerTransactionScope({
      user: request.auth.user,
      transaction,
    });
    return options.repository.postLedgerTransaction(transaction);
  });

  server.get("/api/audit", async (request) => {
    requireAccess(request.auth, { resource: "audit_log", action: "read" });
    return options.repository.listAuditEvents(request.auth.firmId);
  });

  server.get("/api/documents/presign-upload", async (request) => {
    const query = presignQuerySchema.parse(request.query);
    requireAccess(request.auth, {
      resource: "document",
      action: "create",
      matterId: query.matterId,
    });
    if (!options.s3) {
      throw Object.assign(new Error("S3 upload signing is not configured"), { statusCode: 503 });
    }

    const documentId = crypto.randomUUID();
    const storageKey = `matters/${query.matterId}/${documentId}-${sanitizeFilename(query.filename)}`;
    const command = new PutObjectCommand({
      Bucket: options.s3.bucket,
      Key: storageKey,
      ChecksumSHA256:
        query.checksumSha256 === "pending-client-checksum" ? undefined : query.checksumSha256,
      Metadata: {
        "open-practice-matter-id": query.matterId,
        "open-practice-scan": "required-before-share",
      },
    });
    const uploadUrl = await getSignedUrl(options.s3.client, command, { expiresIn: 600 });
    const document = await options.repository.createDocumentUploadIntent({
      id: documentId,
      firmId: request.auth.firmId,
      matterId: query.matterId,
      title: query.filename,
      storageKey,
      checksumSha256: query.checksumSha256,
      classification: query.classification,
      legalHold: query.legalHold,
    });

    return {
      method: "PUT",
      uploadUrl,
      expiresInSeconds: 600,
      storageKey,
      document,
      requiredHeaders: {
        "x-open-practice-malware-scan": "required-before-share",
      },
    };
  });

  server.post("/api/documents/:id/upload-complete", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const document = await options.repository.getDocument(request.auth.firmId, params.id);
    if (!document) {
      throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
    }
    requireAccess(request.auth, {
      resource: "document",
      action: "update",
      matterId: document.matterId,
    });
    const body = uploadCompleteBodySchema.parse(request.body);
    return options.repository.completeDocumentUpload({
      firmId: request.auth.firmId,
      documentId: params.id,
      checksumSha256: body.checksumSha256,
      scanStatus: body.scanStatus,
    });
  });

  server.get("/api/signature-requests", async (request) => {
    const query = ledgerQuerySchema.parse(request.query);
    if (query.matterId) {
      requireAccess(request.auth, {
        resource: "signature_request",
        action: "read",
        matterId: query.matterId,
      });
      return options.repository.listSignatureRequests(request.auth.firmId, query);
    }
    if (request.auth.user.role === "owner_admin" || request.auth.user.role === "auditor") {
      requireAccess(request.auth, { resource: "signature_request", action: "read" });
      return options.repository.listSignatureRequests(request.auth.firmId);
    } else {
      const requests = await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) => {
          requireAccess(request.auth, {
            resource: "signature_request",
            action: "read",
            matterId,
          });
          return options.repository.listSignatureRequests(request.auth.firmId, { matterId });
        }),
      );
      return requests.flat();
    }
  });

  server.post("/api/signature-requests", async (request) => {
    const body = signatureRequestBodySchema.parse(request.body);
    requireAccess(request.auth, {
      resource: "signature_request",
      action: "create",
      matterId: body.matterId,
    });
    const document = await options.repository.getDocument(request.auth.firmId, body.documentId);
    if (!document || document.matterId !== body.matterId) {
      throw Object.assign(new Error("Document does not belong to the requested matter"), {
        statusCode: 400,
      });
    }

    const provider = options.signatureProvider ?? new ManualSignatureProvider();
    const submission = await provider.createSubmission(body);
    const now = new Date().toISOString();
    const requestRecord: SignatureRequestRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      documentId: body.documentId,
      title: body.title,
      requestedByUserId: request.auth.user.id,
      provider: submission.provider,
      externalId: submission.externalId,
      status: submission.status ?? "sent",
      signingUrl: submission.signingUrl,
      consentText: body.consentText,
      evidence: submission.evidence ?? {},
      createdAt: now,
    };
    const signers: SignatureRequestSignerRecord[] = body.signers.map((signer) => ({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      signatureRequestId: requestRecord.id,
      ...signer,
      status: requestRecord.status,
      signingUrl: submission.signingUrl,
    }));
    const event: SignatureProviderEventRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      signatureRequestId: requestRecord.id,
      provider: requestRecord.provider,
      externalId: requestRecord.externalId,
      status: requestRecord.status,
      occurredAt: now,
      evidence: requestRecord.evidence,
    };
    return options.repository.createSignatureRequest({ request: requestRecord, signers, event });
  });

  server.post("/api/signature-requests/provider-events", async (request) => {
    const body = signatureProviderEventBodySchema.parse(request.body);
    requireAccess(request.auth, { resource: "signature_request", action: "update" });
    const event: SignatureProviderEventRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      signatureRequestId: body.signatureRequestId,
      provider: body.provider,
      externalId: body.externalId,
      status: body.status as SignatureProviderStatus,
      occurredAt: body.occurredAt ?? new Date().toISOString(),
      evidence: body.evidence,
    };
    const attempt: SignatureWebhookAttemptRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      provider: body.provider,
      externalId: body.externalId,
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      status: "processed",
      payload: body,
    };
    return options.repository.recordSignatureProviderEvent(event, attempt);
  });

  server.get("/api/intake-sessions", async (request) => {
    const query = ledgerQuerySchema.parse(request.query);
    const templates = await options.repository.listIntakeTemplates(request.auth.firmId);
    if (query.matterId) {
      requireAccess(request.auth, {
        resource: "intake_session",
        action: "read",
        matterId: query.matterId,
      });
      return {
        templates,
        sessions: await options.repository.listIntakeSessions(request.auth.firmId, query),
      };
    }
    if (request.auth.user.role === "owner_admin" || request.auth.user.role === "auditor") {
      requireAccess(request.auth, { resource: "intake_session", action: "read" });
      return {
        templates,
        sessions: await options.repository.listIntakeSessions(request.auth.firmId),
      };
    }
    const sessions = await Promise.all(
      request.auth.user.assignedMatterIds.map((matterId) => {
        requireAccess(request.auth, {
          resource: "intake_session",
          action: "read",
          matterId,
        });
        return options.repository.listIntakeSessions(request.auth.firmId, { matterId });
      }),
    );
    return {
      templates,
      sessions: sessions.flat(),
    };
  });

  server.post("/api/intake-sessions", async (request) => {
    const body = intakeSessionBodySchema.parse(request.body);
    requireAccess(request.auth, {
      resource: "intake_session",
      action: "create",
      matterId: body.matterId,
    });
    const now = new Date().toISOString();
    const session: IntakeSessionRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      templateId: body.templateId,
      provider: "manual",
      externalId: `manual:${crypto.randomUUID()}`,
      status: "created",
      clientContactId: body.clientContactId,
      interviewUrl: body.interviewUrl,
      evidence: body.evidence,
      createdAt: now,
      updatedAt: now,
    };
    return options.repository.createIntakeSession(session);
  });

  server.post("/api/intake-sessions/:id/generated-documents", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const session = await options.repository.getIntakeSession(request.auth.firmId, params.id);
    if (!session)
      throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    requireAccess(request.auth, {
      resource: "intake_session",
      action: "update",
      matterId: session.matterId,
    });
    const body = generatedDocumentBodySchema.parse(request.body);
    return options.repository.createGeneratedDocument({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: session.matterId,
      intakeSessionId: session.id,
      provider: session.provider,
      externalId: body.externalId ?? `manual:${crypto.randomUUID()}`,
      title: body.title,
      documentId: body.documentId,
      storageKey: body.storageKey,
      checksumSha256: body.checksumSha256,
      evidence: body.evidence,
      createdAt: new Date().toISOString(),
    });
  });

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

async function createRepositoryFromEnv(env: z.infer<typeof envSchema>): Promise<{
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

function createS3FromEnv(env: z.infer<typeof envSchema>): ApiOptions["s3"] {
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

function createSignatureProviderFromEnv(env: z.infer<typeof envSchema>): SignatureProvider {
  if (env.DOCUSEAL_BASE_URL && env.DOCUSEAL_API_KEY) {
    return new DocuSealSignatureProvider(env.DOCUSEAL_BASE_URL, env.DOCUSEAL_API_KEY);
  }
  return new ManualSignatureProvider();
}

if (process.env.NODE_ENV !== "test") {
  const env = envSchema.parse(process.env);
  const { repository, close } = await createRepositoryFromEnv(env);
  const server = createApiServer({
    repository,
    jwtSecret: env.AUTH_JWT_SECRET,
    devFirmId: env.DEV_AUTH_FIRM_ID,
    devUserId: env.DEV_AUTH_USER_ID,
    signatureProvider: createSignatureProviderFromEnv(env),
    s3: createS3FromEnv(env),
  });
  process.once("SIGTERM", () => void close?.());
  await server.listen({ host: "0.0.0.0", port: env.API_PORT });
}
