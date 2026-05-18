import { S3Client } from "@aws-sdk/client-s3";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, ProviderSettingKind, User } from "@open-practice/domain";
import { registerProviderStatusRoutes } from "./providers-status.js";
import type { ApiJobQueue, ApiRouteDependencies } from "./types.js";

const firmId = "firm-west-legal";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, overrides: Partial<User> = {}): User {
  return {
    id: `user-${role}`,
    firmId,
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds: ["matter-001"],
    mfaEnabled: false,
    ...overrides,
  };
}

const fakeQueue: ApiJobQueue = {
  async add(_name, _data, options) {
    return { id: options?.jobId ?? "fake-job" };
  },
};

function s3Config(): NonNullable<ApiRouteDependencies["s3"]> {
  return {
    bucket: "open-practice-test-documents",
    client: new S3Client({
      endpoint: "http://127.0.0.1:9000",
      forcePathStyle: true,
      region: "local",
      credentials: {
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
      },
    }),
  };
}

function testServer(
  input: {
    repository?: InMemoryOpenPracticeRepository;
    authUser?: User;
    emailJobQueue?: ApiJobQueue;
    connectorJobQueue?: ApiJobQueue;
    ocrJobQueue?: ApiJobQueue;
    s3?: ApiRouteDependencies["s3"];
    jwtSecret?: string;
    webAuthn?: { rpID: string; origin: string };
    draftAssistProvider?: ApiRouteDependencies["draftAssistProvider"];
  } = {},
): FastifyInstance {
  const server = Fastify({ logger: false });
  const authUser = input.authUser ?? user("owner_admin");
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerProviderStatusRoutes(server, {
    repository: input.repository ?? new InMemoryOpenPracticeRepository({ seedSampleData: false }),
    emailJobQueue: input.emailJobQueue,
    connectorJobQueue: input.connectorJobQueue,
    ocrJobQueue: input.ocrJobQueue,
    s3: input.s3,
    jwtSecret: input.jwtSecret,
    webAuthn: input.webAuthn,
    draftAssistProvider: input.draftAssistProvider,
  });
  servers.push(server);
  return server;
}

async function upsertProvider(
  repository: InMemoryOpenPracticeRepository,
  input: {
    kind: ProviderSettingKind;
    key: string;
    enabled: boolean;
    encryptedConfig?: string;
    updatedAt?: string;
  },
): Promise<void> {
  await repository.upsertProviderSetting({
    id: `provider-${input.kind}-${input.key}`,
    firmId,
    kind: input.kind,
    key: input.key,
    enabled: input.enabled,
    encryptedConfig: input.encryptedConfig ?? `encrypted-${input.kind}-${input.key}`,
    createdAt: "2026-05-07T10:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-05-07T10:00:00.000Z",
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("provider status route", () => {
  it("returns default read-only posture without claiming live health", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/providers/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "reported",
      mode: "configuration_posture",
      liveHealth: {
        status: "not_checked",
        reason: "read_only_configuration_posture",
      },
      email: {
        status: "disabled",
        reason: "not_configured",
        providers: [],
        queue: { queueName: "email", status: "not_configured", reason: "queue_not_configured" },
      },
      inboundEmail: {
        status: "disabled",
        reason: "not_configured",
        addresses: [],
        workerQueue: {
          queueName: "inbound_email",
          status: "not_configured",
          reason: "queue_not_configured",
        },
      },
      externalUploads: {
        status: "not_configured",
        reason: "s3_not_configured",
        tokenSigning: "not_configured",
        s3: "not_configured",
      },
      draftAssist: {
        status: "disabled",
        reason: "not_configured",
        supportedTasks: ["summarize", "suggest_revision", "continue_draft"],
      },
      documentProcessing: {
        status: "disabled",
        reason: "not_configured",
        workerQueues: expect.arrayContaining([
          { queueName: "ocr", status: "not_configured", reason: "queue_not_configured" },
          {
            queueName: "ai_triage",
            status: "reserved",
            reason: "deferred_worker",
            task: "classification",
            actionable: false,
          },
        ]),
        actionableTasks: ["ocr"],
        summary: { total: 0, queued: 0, active: 0, failed: 0, terminal: 0 },
      },
      objectStorage: { status: "not_configured", reason: "s3_not_configured" },
      bullmq: {
        producerQueues: [
          { queueName: "email", status: "not_configured", reason: "queue_not_configured" },
          { queueName: "connectors", status: "not_configured", reason: "queue_not_configured" },
          { queueName: "ocr", status: "not_configured", reason: "queue_not_configured" },
        ],
        workerQueues: expect.arrayContaining([
          { queueName: "email", status: "not_configured", reason: "queue_not_configured" },
          {
            queueName: "connectors",
            status: "not_configured",
            reason: "queue_not_configured",
          },
          {
            queueName: "inbound_email",
            status: "not_configured",
            reason: "queue_not_configured",
          },
          {
            queueName: "ai_triage",
            status: "reserved",
            reason: "deferred_worker",
            task: "classification",
            actionable: false,
          },
          { queueName: "ocr", status: "not_configured", reason: "queue_not_configured" },
          {
            queueName: "transcription",
            status: "reserved",
            reason: "deferred_worker",
            task: "transcription",
            actionable: false,
          },
          {
            queueName: "media",
            status: "reserved",
            reason: "deferred_worker",
            task: "media",
            actionable: false,
          },
        ]),
        reservedWorkerQueues: expect.arrayContaining([
          expect.objectContaining({ queueName: "ai_triage", status: "reserved" }),
          expect.objectContaining({ queueName: "transcription", status: "reserved" }),
          expect.objectContaining({ queueName: "media", status: "reserved" }),
        ]),
      },
      jobs: {
        summary: { total: 0, queued: 0, active: 0, failed: 0, terminal: 0 },
        latestRuns: [],
      },
      authExtensions: {
        embeddedAuth: {
          status: "disabled",
          reason: "session_auth_not_configured",
          session: "not_configured",
        },
        passkeys: { status: "disabled", reason: "webauthn_not_configured" },
      },
    });
    expect(response.json().providerSettings).toEqual(
      expect.arrayContaining([
        { kind: "smtp", status: "disabled", reason: "not_configured", providers: [] },
        { kind: "inbound_email", status: "disabled", reason: "not_configured", providers: [] },
        { kind: "storage", status: "disabled", reason: "not_configured", providers: [] },
      ]),
    );
  });

  it("reports configured queues, object storage, provider settings, and current-user auth posture", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const authUser = user("owner_admin", { mfaEnabled: true });
    await repository.createUser(authUser);
    await upsertProvider(repository, { kind: "smtp", key: "mailpit", enabled: true });
    await upsertProvider(repository, { kind: "inbound_email", key: "maildrop", enabled: false });
    await upsertProvider(repository, { kind: "ai", key: "local-draft-assist", enabled: true });
    await upsertProvider(repository, { kind: "ocr", key: "local-tesseract", enabled: true });
    await upsertProvider(repository, { kind: "storage", key: "s3-compatible", enabled: true });
    await repository.setAuthPassword({
      firmId,
      userId: authUser.id,
      passwordHash: "pbkdf2:sha256:1:salt:password-hash",
      passwordUpdatedAt: "2026-05-07T10:05:00.000Z",
    });
    await repository.registerWebAuthnCredential({
      id: "passkey-provider-status",
      firmId,
      userId: authUser.id,
      credentialId: "credential-id-not-returned",
      publicKey: "public-key-not-returned",
      counter: 1,
      transports: ["internal"],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: "2026-05-07T10:06:00.000Z",
    });
    await repository.createRecoveryCodes(firmId, authUser.id, [
      {
        id: "recovery-code-provider-status",
        firmId,
        userId: authUser.id,
        codeHash: "recovery-code-hash-not-returned",
        createdAt: "2026-05-07T10:07:00.000Z",
      },
    ]);

    const response = await testServer({
      repository,
      authUser,
      emailJobQueue: fakeQueue,
      connectorJobQueue: fakeQueue,
      ocrJobQueue: fakeQueue,
      s3: s3Config(),
      jwtSecret: "provider-status-secret-at-least-32-chars",
      webAuthn: { rpID: "localhost", origin: "http://localhost:3000" },
      draftAssistProvider: {
        getStatus: () => ({
          status: "configured",
          provider: "fake-local-ai",
          model: "fake-model",
          supportedTasks: ["summarize", "suggest_revision", "continue_draft"],
        }),
        async createSuggestion() {
          throw new Error("not used by provider status");
        },
      },
    }).inject({
      method: "GET",
      url: "/api/providers/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      email: {
        status: "configured",
        provider: "mailpit",
        queue: { queueName: "email", status: "configured" },
      },
      inboundEmail: {
        status: "disabled",
        reason: "not_configured",
        workerQueue: {
          queueName: "inbound_email",
          status: "not_configured",
          reason: "queue_not_configured",
        },
      },
      externalUploads: {
        status: "available",
        provider: "s3",
        tokenSigning: "configured",
        s3: "configured",
      },
      draftAssist: {
        status: "configured",
        provider: "local-draft-assist",
        model: "fake-model",
      },
      documentProcessing: {
        status: "configured",
        workers: [{ queueName: "ocr", status: "configured" }],
        providers: [{ kind: "ocr", key: "local-tesseract" }],
      },
      objectStorage: { status: "configured", provider: "s3" },
      bullmq: {
        producerQueues: [
          { queueName: "email", status: "configured" },
          { queueName: "connectors", status: "configured" },
          { queueName: "ocr", status: "configured" },
        ],
        workerQueues: expect.arrayContaining([
          { queueName: "email", status: "configured" },
          { queueName: "connectors", status: "configured" },
          { queueName: "ocr", status: "configured" },
        ]),
      },
      authExtensions: {
        embeddedAuth: { status: "enabled", session: "configured" },
        localPassword: {
          status: "configured",
          updatedAt: "2026-05-07T10:05:00.000Z",
        },
        passkeys: { status: "configured", registeredCount: 1, activeCount: 1 },
        recoveryCodes: { status: "configured", totalCount: 1, unusedCount: 1 },
        mfaPolicy: { status: "enabled", requiredForCurrentUser: true },
      },
    });
    expect(response.json().providerSettings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "smtp",
          status: "configured",
          providers: [
            {
              key: "mailpit",
              enabled: true,
              updatedAt: "2026-05-07T10:00:00.000Z",
            },
          ],
        }),
        expect.objectContaining({
          kind: "inbound_email",
          status: "disabled",
          reason: "provider_disabled",
          providers: [
            {
              key: "maildrop",
              enabled: false,
              updatedAt: "2026-05-07T10:00:00.000Z",
            },
          ],
        }),
        expect.objectContaining({
          kind: "storage",
          status: "configured",
          providers: [
            {
              key: "s3-compatible",
              enabled: true,
              updatedAt: "2026-05-07T10:00:00.000Z",
            },
          ],
        }),
      ]),
    );
  });

  it("requires provider setting read access", async () => {
    const response = await testServer({ authUser: user("licensee") }).inject({
      method: "GET",
      url: "/api/providers/status",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      code: "PROVIDER_SETTING_ACCESS_REQUIRED",
      message: "Provider setting access required",
    });
  });

  it("redacts provider config, storage details, auth secrets, job metadata, and worker errors", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const authUser = user("owner_admin", { mfaEnabled: true });
    await repository.createUser(authUser);
    await upsertProvider(repository, {
      kind: "smtp",
      key: "smtp-primary",
      enabled: true,
      encryptedConfig: "smtp-password-private",
    });
    await upsertProvider(repository, {
      kind: "storage",
      key: "object-store",
      enabled: true,
      encryptedConfig: "s3-access-key-and-secret",
    });
    await repository.setAuthPassword({
      firmId,
      userId: authUser.id,
      passwordHash: "password-hash-private",
      passwordUpdatedAt: "2026-05-07T10:05:00.000Z",
    });
    await repository.registerWebAuthnCredential({
      id: "passkey-provider-status-private",
      firmId,
      userId: authUser.id,
      credentialId: "credential-secret-id-private",
      publicKey: "public-key-private",
      counter: 1,
      transports: ["internal"],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: "2026-05-07T10:06:00.000Z",
    });
    await repository.createRecoveryCodes(firmId, authUser.id, [
      {
        id: "recovery-code-provider-status-private",
        firmId,
        userId: authUser.id,
        codeHash: "recovery-code-hash-private",
        createdAt: "2026-05-07T10:07:00.000Z",
      },
    ]);
    await repository.createJobLifecycleRecord({
      id: "job-provider-status-private",
      firmId,
      queueName: "email",
      jobName: "send_email",
      bullJobId: "bull-provider-status-private",
      status: "failed",
      targetResourceType: "email_outbox",
      targetResourceId: "email-001",
      attemptsMade: 1,
      maxAttempts: 5,
      queuedAt: "2026-05-07T10:20:00.000Z",
      failedAt: "2026-05-07T10:21:00.000Z",
      errorMessage: "Redis redis://:private-password@127.0.0.1:6379/0 refused a private payload",
      metadata: {
        matterId: "matter-001",
        emailId: "email-001",
        templateKey: "matter.update",
        recipientCount: 1,
        storageKey: "matters/matter-001/private.pdf",
        htmlBody: "Generated private email body",
        rawWorkerError: "Raw worker stack with Redis URL",
        smtpPassword: "smtp-secret",
        providerEndpoint: "http://127.0.0.1:9000",
      },
    });

    const response = await testServer({
      repository,
      authUser,
      emailJobQueue: fakeQueue,
      s3: s3Config(),
      jwtSecret: "provider-status-secret-at-least-32-chars",
      webAuthn: { rpID: "localhost", origin: "http://localhost:3000" },
    }).inject({
      method: "GET",
      url: "/api/providers/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().jobs.latestRuns).toEqual([
      expect.objectContaining({
        id: "job-provider-status-private",
        errorSummary:
          "Job failed. Error details are redacted; review server logs for privileged diagnostics.",
        metadata: {
          matterId: "matter-001",
          emailId: "email-001",
          templateKey: "matter.update",
          recipientCount: 1,
        },
      }),
    ]);

    const body = response.body;
    for (const privateValue of [
      "smtp-password-private",
      "s3-access-key-and-secret",
      "password-hash-private",
      "credential-secret-id-private",
      "public-key-private",
      "recovery-code-hash-private",
      "private-password",
      "private payload",
      "matters/matter-001/private.pdf",
      "Generated private email body",
      "Raw worker stack",
      "smtp-secret",
      "http://127.0.0.1:9000",
      "test-access-key",
      "test-secret-key",
    ]) {
      expect(body).not.toContain(privateValue);
    }
  });
});
