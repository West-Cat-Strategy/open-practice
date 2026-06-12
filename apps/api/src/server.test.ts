import { afterEach, describe, expect, it, vi } from "vitest";
import { Buffer } from "node:buffer";
import { InMemoryOpenPracticeRepository, type MatterSummary } from "@open-practice/database";
import { sampleFirm, sampleUsers } from "@open-practice/domain/sample-data";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import {
  IMAP_INBOUND_PROVIDER_KEY,
  IMAP_POLL_JOB_NAME,
  redactImapProviderSettings,
  redactSmtpProviderSettings,
} from "@open-practice/domain";
import {
  buildPublicConsultationIntakeSettingsFromEnv,
  buildInboundEmailMailgunSettingsFromEnv,
  configurePublicConsultationIntakeSettingsFromEnv,
  configureInboundEmailMailgunSettingsFromEnv,
  createApiServer,
  createRepositoryFromEnv,
  envSchema,
  validateProductionReadiness,
} from "./server.js";
import { hashPassword, hashToken } from "./http/auth-helpers.js";
import type { ApiJobQueue } from "./routes/types.js";

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(async () => ({
    challenge: "registration-challenge",
    rp: { id: "localhost", name: "Test RP" },
    user: { id: "user-setup", name: "avery@example.test", displayName: "" },
    pubKeyCredParams: [],
  })),
  verifyRegistrationResponse: vi.fn(async () => ({
    verified: true,
    registrationInfo: {
      credential: {
        id: "credential-id",
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
      },
      credentialDeviceType: "singleDevice",
      credentialBackedUp: false,
    },
  })),
  generateAuthenticationOptions: vi.fn(async () => ({
    challenge: "authentication-challenge",
    rpId: "localhost",
    allowCredentials: [],
    userVerification: "preferred",
  })),
  verifyAuthenticationResponse: vi.fn(async () => ({
    verified: true,
    authenticationInfo: {
      newCounter: 1,
    },
  })),
}));

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];
const providerConfigEncryptionKey = Buffer.alloc(32, 7).toString("base64url");

function testServer(overrides: Partial<CreateServerOptions> = {}) {
  const repository = overrides.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    webAuthn: {
      rpName: "Test RP",
      rpID: "localhost",
      origin: "http://localhost:3000",
    },
    ...overrides,
  });
  servers.push(server);
  return server;
}

function singleFirmMemoryRepository(): InMemoryOpenPracticeRepository {
  return new InMemoryOpenPracticeRepository({
    firms: [sampleFirm],
    users: sampleUsers.filter((user) => user.firmId === sampleFirm.id),
  });
}

function productionEnv(overrides: Record<string, unknown> = {}) {
  return envSchema.parse({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
    AUTH_JWT_SECRET: "production-test-secret-at-least-32-characters",
    OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: providerConfigEncryptionKey,
    ...overrides,
  });
}

async function setAdminPassword(input: {
  repository: InMemoryOpenPracticeRepository;
  password: string;
}) {
  await input.repository.setAuthPassword({
    firmId: "firm-west-legal",
    userId: "user-admin",
    passwordHash: hashPassword(input.password),
    passwordUpdatedAt: new Date().toISOString(),
  });
}

function fakeApiJobQueue() {
  const jobs: Array<{ name: string; data: unknown; jobId?: string; delay?: number }> = [];
  const queue: ApiJobQueue = {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId, delay: options?.delay });
      return { id: options?.jobId ?? "fake-job" };
    },
  };
  return { queue, jobs };
}

function setupPayload(overrides: Record<string, unknown> = {}) {
  return {
    firm: { name: "North Shore Law", defaultProvince: "BC" },
    businessAddress: {
      line1: "100 Main Street",
      city: "Vancouver",
      province: "BC",
      postalCode: "V6B 1A1",
      country: "Canada",
    },
    office: { email: "office@example.test", phone: "604-555-0100" },
    settings: {
      practiceAreas: ["Residential tenancy"],
      invoicePrefix: "NSL",
      defaultPaymentTermsDays: 30,
      trustAccountLabel: "Pooled trust",
    },
    compliance: { trustFundsCaveatAccepted: true },
    owner: {
      displayName: "Avery Owner",
      email: "avery@example.test",
      password: "correct horse battery staple",
    },
    firstMatter: {
      client: {
        kind: "person",
        displayName: "First Client",
        email: "client@example.test",
      },
      title: "First file",
      practiceArea: "Residential tenancy",
      jurisdiction: "BC",
    },
    ...overrides,
  };
}

function minimalSetupPayload(overrides: Record<string, unknown> = {}) {
  return {
    firm: { name: "North Shore Law" },
    compliance: { trustFundsCaveatAccepted: true },
    owner: {
      displayName: "Avery Owner",
      email: "avery@example.test",
      password: "correct horse battery staple",
    },
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("API auth and persistence boundaries", () => {
  it("reports first-run setup status", async () => {
    const seeded = await testServer().inject({ method: "GET", url: "/api/setup/status" });
    const empty = await testServer({
      repository: new InMemoryOpenPracticeRepository({ seedSampleData: false }),
    }).inject({ method: "GET", url: "/api/setup/status" });

    expect(seeded.statusCode).toBe(200);
    expect(seeded.json()).toMatchObject({ required: false, blocked: false });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toMatchObject({
      required: true,
      blocked: false,
    });
  });

  it("allows browser preflight for dashboard mutation methods", async () => {
    const response = await testServer().inject({
      method: "OPTIONS",
      url: "/api/document-processing/ocr-provider",
      headers: {
        origin: "http://localhost:33000",
        "access-control-request-method": "PUT",
        "access-control-request-headers":
          "content-type,x-open-practice-user-id,x-open-practice-firm-id",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("PUT");
    expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(response.headers["access-control-allow-methods"]).toContain("DELETE");
  });

  it("does not allow tenant-specific public origins unless they are configured", async () => {
    const unconfigured = await testServer().inject({
      method: "OPTIONS",
      url: "/api/public/consultation-intakes",
      headers: {
        origin: "https://legacy-tenant.example",
        "access-control-request-method": "POST",
      },
    });
    const configured = await testServer({
      publicConsultationIntake: {
        firmId: "firm-west-legal",
        actorUserId: "user-admin",
        allowedOrigins: ["https://consult.example.test"],
      },
    }).inject({
      method: "OPTIONS",
      url: "/api/public/consultation-intakes",
      headers: {
        origin: "https://consult.example.test",
        "access-control-request-method": "POST",
      },
    });
    const authenticatedRoute = await testServer({
      publicConsultationIntake: {
        firmId: "firm-west-legal",
        actorUserId: "user-admin",
        allowedOrigins: ["https://consult.example.test"],
      },
    }).inject({
      method: "OPTIONS",
      url: "/api/auth/session",
      headers: {
        origin: "https://consult.example.test",
        "access-control-request-method": "GET",
      },
    });

    expect(unconfigured.headers["access-control-allow-origin"]).toBeUndefined();
    expect(configured.headers["access-control-allow-origin"]).toBe("https://consult.example.test");
    expect(authenticatedRoute.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("restricts password setup token creation to owner admins", async () => {
    const repository = singleFirmMemoryRepository();
    const jwtSecret = "password-setup-token-test-secret-at-least-32";
    const sessionToken = "licensee-fresh-session";
    const now = new Date().toISOString();
    await repository.createAuthSession({
      id: "session-licensee-fresh",
      firmId: "firm-west-legal",
      userId: "user-licensee",
      tokenHash: hashToken(sessionToken, jwtSecret),
      createdAt: now,
      freshAuthenticatedAt: now,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const response = await testServer({ repository, jwtSecret }).inject({
      method: "POST",
      url: "/api/auth/password-setup-tokens",
      headers: { "x-open-practice-session": sessionToken },
      payload: { userId: "user-licensee" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: "Owner-admin access is required to create password setup tokens",
    });
  });

  it("allows production first-run setup completion without a setup key", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const response = await testServer({
      repository,
      nodeEnv: "production",
      jwtSecret: "production-test-secret-at-least-32-characters",
    }).inject({
      method: "POST",
      url: "/api/setup/complete",
      payload: setupPayload(),
    });

    expect(response.statusCode).toBe(200);
    await expect(repository.getSetupStatus()).resolves.toEqual({ required: false, blocked: false });
  });

  it("reports production first-run setup status without requiring a setup key", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository({ seedSampleData: false }),
      nodeEnv: "production",
      jwtSecret: "production-test-secret-at-least-32-characters",
    }).inject({ method: "GET", url: "/api/setup/status" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      required: true,
      blocked: false,
    });
  });

  it("returns first-run passkey registration options without a setup key", async () => {
    const server = testServer({
      repository: new InMemoryOpenPracticeRepository({ seedSampleData: false }),
    });
    const payload = { email: "avery@example.test" };
    const response = await server.inject({
      method: "POST",
      url: "/api/setup/webauthn-options",
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ challenge: string; rp: { id: string; name: string } }>()).toMatchObject({
      rp: { id: "localhost", name: "Test RP" },
    });
    expect(response.json<{ challenge: string }>().challenge).toEqual(expect.any(String));
  });

  it("requires an explicit dev flag before accepting Docker bridge setup requests", async () => {
    const payload = { email: "avery@example.test" };
    const blockedServer = testServer({
      repository: new InMemoryOpenPracticeRepository({ seedSampleData: false }),
    });
    const allowedServer = testServer({
      repository: new InMemoryOpenPracticeRepository({ seedSampleData: false }),
      allowDockerBridgeSetup: true,
    });

    const blocked = await blockedServer.inject({
      method: "POST",
      url: "/api/setup/webauthn-options",
      remoteAddress: "172.18.0.1",
      payload,
    });
    const allowed = await allowedServer.inject({
      method: "POST",
      url: "/api/setup/webauthn-options",
      remoteAddress: "172.18.0.1",
      payload,
    });
    const nonGateway = await allowedServer.inject({
      method: "POST",
      url: "/api/setup/webauthn-options",
      remoteAddress: "172.18.1.1",
      payload,
    });

    expect(blocked.statusCode).toBe(403);
    expect(blocked.json()).toMatchObject({
      message: "First-run setup is limited to loopback access",
    });
    expect(allowed.statusCode).toBe(200);
    expect(nonGateway.statusCode).toBe(403);
  });

  it("rejects expired first-run passkey challenges", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const server = testServer({
      repository,
      jwtSecret: "production-test-secret-at-least-32-characters",
    });
    await repository.createWebAuthnChallenge({
      id: "challenge-expired",
      challengeHash: "expired-challenge",
      purpose: "passkey_registration",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date(Date.now() - 120_000).toISOString(),
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      payload: setupPayload({
        owner: {
          displayName: "Avery Owner",
          email: "avery@example.test",
          password: "correct horse battery staple",
          webAuthn: {
            id: "credential-id",
            rawId: "credential-id",
            type: "public-key",
            response: {
              clientDataJSON: "client-data",
              attestationObject: "attestation",
              transports: ["internal"],
            },
            clientExtensionResults: {},
            challengeHash: "expired-challenge",
          },
        },
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "Invalid or expired WebAuthn challenge" });
  });

  it("rejects failed first-run passkey verification without completing setup", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const server = testServer({
      repository,
      jwtSecret: "production-test-secret-at-least-32-characters",
    });
    await repository.createWebAuthnChallenge({
      id: "challenge-failed",
      challengeHash: "valid-challenge",
      purpose: "passkey_registration",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString(),
    });
    vi.mocked(verifyRegistrationResponse).mockResolvedValueOnce({ verified: false });

    const response = await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      payload: setupPayload({
        owner: {
          displayName: "Avery Owner",
          email: "avery@example.test",
          password: "correct horse battery staple",
          webAuthn: {
            id: "credential-id",
            rawId: "credential-id",
            type: "public-key",
            response: {
              clientDataJSON: "client-data",
              attestationObject: "attestation",
              transports: ["internal"],
            },
            clientExtensionResults: {},
            challengeHash: "valid-challenge",
          },
        },
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "Passkey verification failed" });
    await expect(repository.getSetupStatus()).resolves.toEqual({ required: true, blocked: false });
    await expect(repository.getWebAuthnChallenge("valid-challenge")).resolves.toEqual(
      expect.objectContaining({ challengeHash: "valid-challenge" }),
    );
    await expect(
      repository.getWebAuthnChallenge("valid-challenge").then((challenge) => challenge?.consumedAt),
    ).resolves.toBeUndefined();
  });

  it("completes first-run setup with owner auth, firm settings, first matter, and session", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const server = testServer({
      repository,
      jwtSecret: "production-test-secret-at-least-32-characters",
    });
    const response = await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      payload: setupPayload(),
    });
    const body = response.json<{ token: string; user: { firmId: string; id: string } }>();

    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toContain("open_practice_session");
    await expect(repository.getFirmSettings(body.user.firmId)).resolves.toMatchObject({
      practiceAreas: ["Residential tenancy"],
      trustFundsCaveatAcceptedByUserId: body.user.id,
    });
    await expect(repository.getAuthAccount(body.user.firmId, body.user.id)).resolves.toBeDefined();

    const overview = await server.inject({
      method: "GET",
      url: "/api/overview",
      headers: { "x-open-practice-session": body.token },
    });
    const matters = await server.inject({
      method: "GET",
      url: "/api/matters",
      headers: { "x-open-practice-session": body.token },
    });

    expect(overview.statusCode).toBe(200);
    expect(matters.json<Array<{ number: string }>>()).toMatchObject([{ number: "2026-0001" }]);
  });

  it("accepts optional SMTP and IMAP first-run settings without returning secrets", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const inboundQueue = fakeApiJobQueue();
    const server = testServer({
      repository,
      inboundEmailJobQueue: inboundQueue.queue,
      jwtSecret: "production-test-secret-at-least-32-characters",
    });
    const response = await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      payload: setupPayload({
        email: {
          smtp: {
            enabled: true,
            host: "smtp.example.test",
            port: 587,
            secure: false,
            username: "mailer@example.test",
            password: "synthetic-smtp-secret",
            fromAddress: "Open Practice <mailer@example.test>",
          },
          imap: {
            enabled: true,
            host: "imap.example.test",
            port: 993,
            secure: true,
            username: "inbound@example.test",
            password: "synthetic-imap-secret",
            mailbox: "INBOX",
            pollIntervalSeconds: 300,
            markSeen: false,
          },
        },
      }),
    });
    const body = response.json<{ token: string; user: { firmId: string; id: string } }>();

    expect(response.statusCode).toBe(200);
    expect(JSON.stringify(body)).not.toContain("synthetic-smtp-secret");
    expect(JSON.stringify(body)).not.toContain("synthetic-imap-secret");

    const [smtpSettings] = await repository.listProviderSettings(body.user.firmId, {
      kind: "smtp",
    });
    expect(redactSmtpProviderSettings(smtpSettings)).toMatchObject({
      enabled: true,
      host: "smtp.example.test",
      port: 587,
      username: "mailer@example.test",
      fromAddress: "Open Practice <mailer@example.test>",
      passwordConfigured: true,
      configValid: true,
    });

    const [imapSettings] = await repository.listProviderSettings(body.user.firmId, {
      kind: "inbound_email",
    });
    expect(imapSettings).toMatchObject({ key: IMAP_INBOUND_PROVIDER_KEY, enabled: true });
    expect(redactImapProviderSettings(imapSettings)).toMatchObject({
      enabled: true,
      host: "imap.example.test",
      port: 993,
      username: "inbound@example.test",
      mailbox: "INBOX",
      passwordConfigured: true,
      configValid: true,
    });
    expect(inboundQueue.jobs).toHaveLength(1);
    expect(inboundQueue.jobs[0]).toMatchObject({
      name: IMAP_POLL_JOB_NAME,
      data: {
        firmId: body.user.firmId,
        metadata: {
          requestedByUserId: body.user.id,
        },
      },
    });
  });

  it("rejects incomplete enabled first-run email settings", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository({ seedSampleData: false }),
      jwtSecret: "production-test-secret-at-least-32-characters",
    }).inject({
      method: "POST",
      url: "/api/setup/complete",
      payload: setupPayload({
        email: {
          smtp: {
            enabled: true,
            secure: false,
          },
          imap: {
            enabled: true,
            secure: true,
            mailbox: "INBOX",
            markSeen: false,
          },
        },
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "SMTP_SETTINGS_INCOMPLETE",
      message: expect.stringContaining("Enabled SMTP settings require"),
    });
    expect(JSON.stringify(response.json())).not.toContain("synthetic");
  });

  it("completes first-run setup from the minimal workspace payload with defaults", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const server = testServer({
      repository,
      jwtSecret: "production-test-secret-at-least-32-characters",
    });
    const response = await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      payload: minimalSetupPayload(),
    });
    const body = response.json<{ token: string; user: { firmId: string; id: string } }>();

    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toContain("open_practice_session");
    await expect(repository.getFirmSettings(body.user.firmId)).resolves.toMatchObject({
      businessAddress: {
        line1: "",
        city: "",
        province: "BC",
        postalCode: "",
        country: "Canada",
      },
      officeEmail: "avery@example.test",
      officePhone: "",
      practiceAreas: ["General practice"],
      invoicePrefix: "NORTHSHORELAW",
      defaultPaymentTermsDays: 30,
      trustAccountLabel: "Trust account",
      trustFundsCaveatAcceptedByUserId: body.user.id,
    });

    const matters = await server.inject({
      method: "GET",
      url: "/api/matters",
      headers: { "x-open-practice-session": body.token },
    });

    expect(matters.statusCode).toBe(200);
    expect(matters.json()).toEqual([]);
  });

  it("accepts selected setup presets and persists firm-scoped templates", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const server = testServer({
      repository,
      jwtSecret: "production-test-secret-at-least-32-characters",
    });
    const response = await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      payload: setupPayload({
        selectedPresetIds: ["bc-notarial", "canada-small-business-records"],
        firstMatter: undefined,
      }),
    });
    const body = response.json<{ user: { firmId: string } }>();

    expect(response.statusCode).toBe(200);
    await expect(repository.listDraftTemplates(body.user.firmId)).resolves.toMatchObject([
      { id: "draft-template-legal-letter" },
      { id: "draft-template-meeting-notes" },
      {
        id: "draft-template-preset-bc-notarial-checklist",
        category: "notarial",
        metadata: { presetId: "bc-notarial" },
      },
      {
        id: "draft-template-preset-canada-small-business-records-request",
        category: "business-records",
        metadata: { presetId: "canada-small-business-records" },
      },
    ]);
    await expect(repository.listIntakeTemplates(body.user.firmId)).resolves.toMatchObject([
      {
        id: "intake-template-preset-bc-notarial",
        category: "notarial",
        metadata: { presetId: "bc-notarial", editable: true },
      },
      {
        id: "intake-template-preset-canada-small-business-records",
        category: "business-records",
        metadata: { presetId: "canada-small-business-records" },
      },
    ]);
  });

  it("rejects unknown setup preset ids", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository({ seedSampleData: false }),
      jwtSecret: "production-test-secret-at-least-32-characters",
    }).inject({
      method: "POST",
      url: "/api/setup/complete",
      payload: setupPayload({ selectedPresetIds: ["unknown-preset"] }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid request body",
      details: {
        issues: expect.arrayContaining([
          expect.objectContaining({
            message: "Unknown practice preset id",
            path: "selectedPresetIds.0",
          }),
        ]),
      },
    });
  });

  it("rejects repeated setup and reports partial setup state as blocked", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const server = testServer({
      repository,
      jwtSecret: "production-test-secret-at-least-32-characters",
    });
    await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      payload: setupPayload({ firstMatter: undefined }),
    });
    const repeated = await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      payload: setupPayload({ firstMatter: undefined }),
    });
    const partial = await testServer({
      repository: new InMemoryOpenPracticeRepository({
        seedSampleData: false,
        firms: [{ id: "firm-partial", name: "Partial", defaultProvince: "BC" }],
      }),
    }).inject({ method: "GET", url: "/api/setup/status" });

    expect(repeated.statusCode).toBe(409);
    expect(partial.json()).toMatchObject({ required: false, blocked: true });
  });

  it("rejects unauthenticated production requests", async () => {
    const response = await testServer({
      nodeEnv: "production",
      jwtSecret: "production-test-secret-at-least-32-characters",
    }).inject({ method: "GET", url: "/api/overview" });

    expect(response.statusCode).toBe(401);
  });

  it("rejects development header authentication in production", async () => {
    const response = await testServer({
      nodeEnv: "production",
      jwtSecret: "production-test-secret-at-least-32-characters",
    }).inject({
      method: "GET",
      url: "/api/overview",
      headers: {
        "x-open-practice-user-id": "user-admin",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects bearer JWT authentication in production", async () => {
    const jwtSecret = "production-test-secret-at-least-32-characters";
    const response = await testServer({
      nodeEnv: "production",
      jwtSecret,
    }).inject({
      method: "GET",
      url: "/api/overview",
      headers: {
        authorization: "Bearer dev.jwt.token",
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("authenticates production requests with embedded sessions", async () => {
    const repository = singleFirmMemoryRepository();
    const jwtSecret = "production-test-secret-at-least-32-characters";
    await setAdminPassword({
      repository,
      password: "correct horse battery staple",
    });
    await repository.updateUserMfaStatus("firm-west-legal", "user-admin", false);
    const productionServer = testServer({
      repository,
      nodeEnv: "production",
      jwtSecret,
    });
    const login = await productionServer.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "avery@example.test",
        password: "correct horse battery staple",
      },
    });
    const response = await productionServer.inject({
      method: "GET",
      url: "/api/overview",
      headers: {
        "x-open-practice-session": login.json<{ token: string }>().token,
      },
    });

    expect(login.statusCode).toBe(200);
    expect(response.statusCode).toBe(200);
  });

  it("reports setup-not-ready before single-tenant embedded login", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository({ seedSampleData: false }),
      nodeEnv: "production",
      jwtSecret: "production-test-secret-at-least-32-characters",
    }).inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "avery@example.test",
        password: "correct horse battery staple",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message: "First-run setup is required before sign in.",
    });
  });

  it("blocks single-tenant embedded login when multiple firm records exist", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository({
        seedSampleData: false,
        firms: [
          { id: "firm-one", name: "Firm One", defaultProvince: "BC" },
          { id: "firm-two", name: "Firm Two", defaultProvince: "ON" },
        ],
        users: [
          {
            id: "user-one",
            firmId: "firm-one",
            displayName: "Avery One",
            email: "avery@example.test",
            role: "owner_admin",
            assignedMatterIds: [],
            mfaEnabled: false,
          },
        ],
      }),
      nodeEnv: "production",
      jwtSecret: "production-test-secret-at-least-32-characters",
    }).inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "avery@example.test",
        password: "correct horse battery staple",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message:
        "Multiple firm records found. Resolve practice records before using single-tenant authentication.",
    });
  });

  it("rate-limits repeated embedded login attempts", async () => {
    const jwtSecret = "production-test-secret-at-least-32-characters";
    const server = testServer({
      repository: singleFirmMemoryRepository(),
      nodeEnv: "production",
      jwtSecret,
    });
    const responses = [];

    for (let attempt = 0; attempt < 11; attempt += 1) {
      responses.push(
        await server.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: {
            email: "avery@example.test",
            password: "wrong password",
          },
        }),
      );
    }

    expect(responses.slice(0, 10).every((response) => response.statusCode === 401)).toBe(true);
    expect(responses[10]?.statusCode).toBe(429);
  });

  it("raises the global rate-limit ceiling for E2E browser sweeps", async () => {
    const server = testServer({ e2eSupport: true });
    const responses = [];

    for (let attempt = 0; attempt < 350; attempt += 1) {
      responses.push(await server.inject({ method: "GET", url: "/health" }));
    }

    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
  });

  it("revokes embedded sessions on logout", async () => {
    const repository = singleFirmMemoryRepository();
    const jwtSecret = "production-test-secret-at-least-32-characters";
    await setAdminPassword({ repository, password: "logout password" });
    await repository.updateUserMfaStatus("firm-west-legal", "user-admin", false);
    const server = testServer({ repository, nodeEnv: "production", jwtSecret });
    const login = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "avery@example.test",
        password: "logout password",
      },
    });
    const token = login.json<{ token: string }>().token;
    const logout = await server.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { "x-open-practice-session": token },
    });
    const afterLogout = await server.inject({
      method: "GET",
      url: "/api/overview",
      headers: { "x-open-practice-session": token },
    });

    expect(logout.statusCode).toBe(200);
    expect(afterLogout.statusCode).toBe(401);
  });

  it("rejects expired embedded sessions", async () => {
    const repository = singleFirmMemoryRepository();
    const jwtSecret = "production-test-secret-at-least-32-characters";
    await setAdminPassword({ repository, password: "expired password" });
    await repository.updateUserMfaStatus("firm-west-legal", "user-admin", false);
    const server = testServer({
      repository,
      nodeEnv: "production",
      jwtSecret,
      sessionTtlHours: -1,
    });
    const login = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "avery@example.test",
        password: "expired password",
      },
    });
    const response = await server.inject({
      method: "GET",
      url: "/api/overview",
      headers: { "x-open-practice-session": login.json<{ token: string }>().token },
    });

    expect(login.statusCode).toBe(200);
    expect(response.statusCode).toBe(401);
  });

  it("rejects unsafe production readiness configuration", () => {
    expect(() => validateProductionReadiness(productionEnv({ DATABASE_URL: undefined }))).toThrow(
      /DATABASE_URL/,
    );
    expect(() =>
      validateProductionReadiness(productionEnv({ OPEN_PRACTICE_USE_MEMORY_REPO: true })),
    ).toThrow(/OPEN_PRACTICE_USE_MEMORY_REPO/);
    expect(() =>
      validateProductionReadiness(productionEnv({ OPEN_PRACTICE_DEV_SEED: true })),
    ).toThrow(/OPEN_PRACTICE_DEV_SEED/);
    expect(() =>
      validateProductionReadiness(productionEnv({ OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP: true })),
    ).toThrow(/OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP/);
    expect(() => validateProductionReadiness(productionEnv({ E2E_MODE: "host" }))).toThrow(
      /E2E_MODE/,
    );
    expect(() =>
      validateProductionReadiness(productionEnv({ AUTH_JWT_SECRET: "too-short" })),
    ).toThrow(/AUTH_JWT_SECRET/);
    expect(() =>
      validateProductionReadiness(
        productionEnv({ AUTH_JWT_SECRET: "dev-only-change-me-at-least-16-chars" }),
      ),
    ).toThrow(/development example/);
    expect(() =>
      validateProductionReadiness(
        productionEnv({ OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: undefined }),
      ),
    ).toThrow(/OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY/);
    expect(() =>
      envSchema.parse({ OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: "not-a-32-byte-key" }),
    ).toThrow(/OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY/);
    expect(() => envSchema.parse({ S3_SERVER_SIDE_ENCRYPTION: "aws:kms" })).toThrow(
      /S3_SERVER_SIDE_ENCRYPTION/,
    );
    expect(() =>
      validateProductionReadiness(productionEnv({ S3_ENDPOINT: "http://localhost:9000" })),
    ).toThrow(/S3/);
    expect(() =>
      validateProductionReadiness(
        productionEnv({
          S3_ENDPOINT: "http://localhost:9000",
          S3_ACCESS_KEY: "open_practice",
          S3_SECRET_KEY: "open_practice_secret",
        }),
      ),
    ).toThrow(/S3_SERVER_SIDE_ENCRYPTION/);
    expect(() =>
      validateProductionReadiness(productionEnv({ DOCUSEAL_BASE_URL: "http://localhost:8080" })),
    ).toThrow(/Deprecated external provider/);
    expect(() =>
      validateProductionReadiness(
        productionEnv({
          DOCUSEAL_BASE_URL: "http://localhost:8080",
          DOCUSEAL_API_KEY: "docuseal-key",
        }),
      ),
    ).toThrow(/Deprecated external provider/);
    expect(() =>
      validateProductionReadiness(productionEnv({ DOCASSEMBLE_BASE_URL: "http://localhost:5000" })),
    ).toThrow(/Deprecated external provider/);
    expect(() =>
      validateProductionReadiness(productionEnv({ OIDC_ISSUER_URL: "https://issuer.example" })),
    ).toThrow(/Deprecated external provider/);
    expect(() =>
      validateProductionReadiness(productionEnv({ STRIPE_SECRET_KEY: "sk_test_synthetic" })),
    ).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("accepts minimal production readiness configuration", () => {
    expect(() => validateProductionReadiness(productionEnv())).not.toThrow();
    expect(() =>
      validateProductionReadiness(
        productionEnv({
          S3_ENDPOINT: "http://localhost:9000",
          S3_ACCESS_KEY: "open_practice",
          S3_SECRET_KEY: "open_practice_secret",
          S3_SERVER_SIDE_ENCRYPTION: "AES256",
        }),
      ),
    ).not.toThrow();
    expect(envSchema.parse({ S3_SERVER_SIDE_ENCRYPTION: "AES256" })).toMatchObject({
      S3_SERVER_SIDE_ENCRYPTION: "AES256",
    });
  });

  it("parses boolean env strings before provider config key readiness checks", () => {
    const parsed = envSchema.parse({
      DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
      OPEN_PRACTICE_USE_MEMORY_REPO: "false",
      OPEN_PRACTICE_DEV_SEED: "false",
      OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP: "true",
      OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: providerConfigEncryptionKey,
    });

    expect(parsed.OPEN_PRACTICE_USE_MEMORY_REPO).toBe(false);
    expect(parsed.OPEN_PRACTICE_DEV_SEED).toBe(false);
    expect(parsed.OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP).toBe(true);
    expect(
      envSchema.parse({ OPEN_PRACTICE_USE_MEMORY_REPO: "true" }).OPEN_PRACTICE_USE_MEMORY_REPO,
    ).toBe(true);
  });

  it("respects OPEN_PRACTICE_DEV_SEED for memory repository startup", async () => {
    const empty = await createRepositoryFromEnv(
      envSchema.parse({
        OPEN_PRACTICE_USE_MEMORY_REPO: "true",
        OPEN_PRACTICE_DEV_SEED: "false",
      }),
    );
    const seeded = await createRepositoryFromEnv(
      envSchema.parse({
        OPEN_PRACTICE_USE_MEMORY_REPO: "true",
        OPEN_PRACTICE_DEV_SEED: "true",
      }),
    );

    await expect(empty.repository.getSetupStatus()).resolves.toEqual({
      required: true,
      blocked: false,
    });
    await expect(seeded.repository.getSetupStatus()).resolves.toEqual({
      required: false,
      blocked: false,
    });
  });

  it("requires a provider config encryption key before API PostgreSQL repository startup", async () => {
    await expect(
      createRepositoryFromEnv(
        envSchema.parse({
          DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
        }),
      ),
    ).rejects.toThrow(/OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY/);
  });

  it("builds explicit public consultation intake settings from deployment env", async () => {
    const corsOnly = envSchema.parse({
      PUBLIC_CONSULTATION_INTAKE_ALLOWED_ORIGINS: "https://consult.example.test",
    });
    const configured = envSchema.parse({
      PUBLIC_CONSULTATION_INTAKE_ENABLED: "true",
      PUBLIC_CONSULTATION_INTAKE_ALLOWED_ORIGINS:
        "https://consult.example.test, https://www.consult.example.test",
      PUBLIC_CONSULTATION_INTAKE_SENDER_ADDRESS: "consultations@example.test",
      PUBLIC_CONSULTATION_INTAKE_RECIPIENT_EMAILS: "review@example.test",
      PUBLIC_CONSULTATION_INTAKE_ACTOR_USER_ID: "user-admin",
      PUBLIC_CONSULTATION_INTAKE_SUBMISSION_TOKEN_HASH: "a".repeat(64),
    });
    const repository = singleFirmMemoryRepository();

    expect(buildPublicConsultationIntakeSettingsFromEnv(corsOnly)).toBeUndefined();
    expect(buildPublicConsultationIntakeSettingsFromEnv(configured)).toEqual({
      enabled: true,
      senderAddress: "consultations@example.test",
      recipientEmails: ["review@example.test"],
      allowedOrigins: ["https://consult.example.test", "https://www.consult.example.test"],
      reviewOwnerUserId: "user-admin",
      submissionTokenHash: "a".repeat(64),
    });
    expect(() =>
      buildPublicConsultationIntakeSettingsFromEnv(
        envSchema.parse({ PUBLIC_CONSULTATION_INTAKE_ENABLED: "true" }),
      ),
    ).toThrow(/PUBLIC_CONSULTATION_INTAKE_ENABLED/);

    await configurePublicConsultationIntakeSettingsFromEnv(repository, configured);
    const [provider] = await repository.listProviderSettings("firm-west-legal", {
      kind: "public_intake",
    });
    expect(provider).toMatchObject({
      enabled: true,
      key: "consultation",
    });
    expect(JSON.parse(provider?.encryptedConfig ?? "{}")).toMatchObject({
      senderAddress: "consultations@example.test",
      recipientEmails: ["review@example.test"],
      submissionTokenHash: "a".repeat(64),
    });
  });

  it("builds Mailgun inbound-email provider settings from deployment env", async () => {
    const domainOnly = envSchema.parse({ INBOUND_EMAIL_DOMAIN: "mail.example.test" });
    const configured = envSchema.parse({
      INBOUND_EMAIL_WEBHOOK_SECRET: "synthetic-mailgun-signing-key",
      INBOUND_EMAIL_DOMAIN: "mail.example.test",
    });
    const repository = singleFirmMemoryRepository();

    expect(buildInboundEmailMailgunSettingsFromEnv(domainOnly)).toBeUndefined();
    expect(buildInboundEmailMailgunSettingsFromEnv(configured)).toEqual({
      webhookSigningKey: "synthetic-mailgun-signing-key",
      domain: "mail.example.test",
    });

    await configureInboundEmailMailgunSettingsFromEnv(repository, configured);
    const [provider] = await repository.listProviderSettings("firm-west-legal", {
      kind: "inbound_email",
    });
    expect(provider).toMatchObject({
      enabled: true,
      key: "mailgun",
    });
    expect(JSON.parse(provider?.encryptedConfig ?? "{}")).toEqual({
      webhookSigningKey: "synthetic-mailgun-signing-key",
      domain: "mail.example.test",
    });
  });

  it("scopes configured public consultation CORS origins to the public intake route", async () => {
    const origin = "https://consult.example.test";
    const server = testServer({
      publicConsultationIntake: {
        allowedOrigins: [origin],
        firmId: "firm-west-legal",
        actorUserId: "user-admin",
      },
    });
    const publicPreflight = await server.inject({
      method: "OPTIONS",
      url: "/api/public/consultation-intakes",
      headers: {
        origin,
        "access-control-request-method": "POST",
      },
    });
    const authenticatedPreflight = await server.inject({
      method: "OPTIONS",
      url: "/api/overview",
      headers: {
        origin,
        "access-control-request-method": "GET",
      },
    });

    expect(publicPreflight.statusCode).toBe(204);
    expect(publicPreflight.headers["access-control-allow-origin"]).toBe(origin);
    expect(authenticatedPreflight.statusCode).toBe(404);
    expect(authenticatedPreflight.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rejects localhost credentialed CORS in production while allowing the configured web origin", async () => {
    const origin = "https://app.example.test";
    const server = testServer({
      nodeEnv: "production",
      jwtSecret: "production-test-secret-at-least-32-characters",
      publicWebBaseUrl: `${origin}/dashboard`,
      webAuthn: {
        rpName: "Test RP",
        rpID: "app.example.test",
        origin,
      },
    });
    const localhostPreflight = await server.inject({
      method: "OPTIONS",
      url: "/api/overview",
      headers: {
        origin: "http://localhost:4321",
        "access-control-request-method": "GET",
      },
    });
    const appPreflight = await server.inject({
      method: "OPTIONS",
      url: "/api/overview",
      headers: {
        origin,
        "access-control-request-method": "GET",
      },
    });

    expect(localhostPreflight.headers["access-control-allow-origin"]).toBeUndefined();
    expect(appPreflight.statusCode).toBe(204);
    expect(appPreflight.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("redacts unexpected server error messages", async () => {
    class ThrowingMatterRepository extends InMemoryOpenPracticeRepository {
      override async listMattersForUser(): Promise<MatterSummary[]> {
        throw new Error("database password leaked in stack");
      }
    }
    const server = testServer({ repository: new ThrowingMatterRepository() });

    const response = await server.inject({
      method: "GET",
      url: "/api/matters",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      message: "Unexpected API error",
    });
    expect(response.body).not.toContain("database password leaked in stack");
  });
});
