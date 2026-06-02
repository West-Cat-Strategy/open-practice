import { afterEach, describe, expect, it, vi } from "vitest";
import { Buffer } from "node:buffer";
import { InMemoryOpenPracticeRepository, type MatterSummary } from "@open-practice/database";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import {
  buildPublicConsultationIntakeSettingsFromEnv,
  configurePublicConsultationIntakeSettingsFromEnv,
  createApiServer,
  createRepositoryFromEnv,
  envSchema,
  validateProductionReadiness,
} from "./server.js";

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

function deliveryConfirmation(recipientCount = 1) {
  return { confirmed: true, channel: "email", recipientCount };
}

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
  jwtSecret: string;
  password: string;
}) {
  const setupServer = testServer({ repository: input.repository, jwtSecret: input.jwtSecret });
  const setupToken = await setupServer.inject({
    method: "POST",
    url: "/api/auth/password-setup-tokens",
    payload: { userId: "user-admin" },
  });
  const setup = await setupServer.inject({
    method: "POST",
    url: "/api/auth/password-setup",
    payload: {
      userId: "user-admin",
      token: setupToken.json<{ token: string }>().token,
      password: input.password,
    },
  });
  expect(setupToken.statusCode).toBe(200);
  expect(setup.statusCode).toBe(200);
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
      setupKey: "setup-key",
    }).inject({ method: "GET", url: "/api/setup/status" });

    expect(seeded.statusCode).toBe(200);
    expect(seeded.json()).toMatchObject({ required: false, blocked: false });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toMatchObject({
      required: true,
      blocked: false,
      setupKeyRequired: true,
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

    expect(unconfigured.headers["access-control-allow-origin"]).toBeUndefined();
    expect(configured.headers["access-control-allow-origin"]).toBe("https://consult.example.test");
  });

  it("requires a configured setup key for production setup completion", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository({ seedSampleData: false }),
      nodeEnv: "production",
      jwtSecret: "production-test-secret-at-least-32-characters",
    }).inject({
      method: "POST",
      url: "/api/setup/complete",
      payload: setupPayload(),
    });

    expect(response.statusCode).toBe(503);
  });

  it("blocks production first-run setup status until a setup key is configured", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository({ seedSampleData: false }),
      nodeEnv: "production",
      jwtSecret: "production-test-secret-at-least-32-characters",
    }).inject({ method: "GET", url: "/api/setup/status" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      required: false,
      blocked: true,
      setupKeyRequired: true,
      reason: "OPEN_PRACTICE_SETUP_KEY is required before production first-run setup can start.",
    });
  });

  it("applies the setup key gate to first-run passkey registration options", async () => {
    const server = testServer({
      repository: new InMemoryOpenPracticeRepository({ seedSampleData: false }),
      setupKey: "setup-key",
    });
    const payload = { email: "avery@example.test" };
    const missingKey = await server.inject({
      method: "POST",
      url: "/api/setup/webauthn-options",
      payload,
    });
    const invalidKey = await server.inject({
      method: "POST",
      url: "/api/setup/webauthn-options",
      headers: { "x-open-practice-setup-key": "wrong-key" },
      payload,
    });
    const validKey = await server.inject({
      method: "POST",
      url: "/api/setup/webauthn-options",
      headers: { "x-open-practice-setup-key": "setup-key" },
      payload,
    });

    expect(missingKey.statusCode).toBe(403);
    expect(invalidKey.statusCode).toBe(403);
    expect(validKey.statusCode).toBe(200);
    expect(validKey.json<{ challenge: string; rp: { id: string; name: string } }>()).toMatchObject({
      rp: { id: "localhost", name: "Test RP" },
    });
    expect(validKey.json<{ challenge: string }>().challenge).toEqual(expect.any(String));
  });

  it("rejects expired first-run passkey challenges", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const server = testServer({
      repository,
      jwtSecret: "production-test-secret-at-least-32-characters",
      setupKey: "setup-key",
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
      headers: { "x-open-practice-setup-key": "setup-key" },
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
      setupKey: "setup-key",
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
      headers: { "x-open-practice-setup-key": "setup-key" },
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
      setupKey: "setup-key",
    });
    const response = await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      headers: { "x-open-practice-setup-key": "setup-key" },
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

  it("completes first-run setup from the minimal workspace payload with defaults", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const server = testServer({
      repository,
      jwtSecret: "production-test-secret-at-least-32-characters",
      setupKey: "setup-key",
    });
    const response = await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      headers: { "x-open-practice-setup-key": "setup-key" },
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
      setupKey: "setup-key",
    });
    const response = await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      headers: { "x-open-practice-setup-key": "setup-key" },
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
      setupKey: "setup-key",
    }).inject({
      method: "POST",
      url: "/api/setup/complete",
      headers: { "x-open-practice-setup-key": "setup-key" },
      payload: setupPayload({ selectedPresetIds: ["unknown-preset"] }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      message: expect.stringContaining("Unknown practice preset id"),
    });
  });

  it("rejects repeated setup and reports partial setup state as blocked", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const server = testServer({
      repository,
      jwtSecret: "production-test-secret-at-least-32-characters",
      setupKey: "setup-key",
    });
    await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      headers: { "x-open-practice-setup-key": "setup-key" },
      payload: setupPayload({ firstMatter: undefined }),
    });
    const repeated = await server.inject({
      method: "POST",
      url: "/api/setup/complete",
      headers: { "x-open-practice-setup-key": "setup-key" },
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
    const repository = new InMemoryOpenPracticeRepository();
    const jwtSecret = "production-test-secret-at-least-32-characters";
    await setAdminPassword({
      repository,
      jwtSecret,
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
    const server = testServer({ nodeEnv: "production", jwtSecret });
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
    const repository = new InMemoryOpenPracticeRepository();
    const jwtSecret = "production-test-secret-at-least-32-characters";
    await setAdminPassword({ repository, jwtSecret, password: "logout password" });
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
    const repository = new InMemoryOpenPracticeRepository();
    const jwtSecret = "production-test-secret-at-least-32-characters";
    await setAdminPassword({ repository, jwtSecret, password: "expired password" });
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
    expect(() =>
      validateProductionReadiness(productionEnv({ S3_ENDPOINT: "http://localhost:9000" })),
    ).toThrow(/S3/);
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
  });

  it("parses boolean env strings before provider config key readiness checks", () => {
    const parsed = envSchema.parse({
      DATABASE_URL: "postgresql://open_practice:open_practice@localhost:5432/open_practice",
      OPEN_PRACTICE_USE_MEMORY_REPO: "false",
      OPEN_PRACTICE_DEV_SEED: "false",
      OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: providerConfigEncryptionKey,
    });

    expect(parsed.OPEN_PRACTICE_USE_MEMORY_REPO).toBe(false);
    expect(parsed.OPEN_PRACTICE_DEV_SEED).toBe(false);
    expect(
      envSchema.parse({ OPEN_PRACTICE_USE_MEMORY_REPO: "true" }).OPEN_PRACTICE_USE_MEMORY_REPO,
    ).toBe(true);
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
    });
    const repository = new InMemoryOpenPracticeRepository();

    expect(buildPublicConsultationIntakeSettingsFromEnv(corsOnly)).toBeUndefined();
    expect(buildPublicConsultationIntakeSettingsFromEnv(configured)).toEqual({
      enabled: true,
      senderAddress: "consultations@example.test",
      recipientEmails: ["review@example.test"],
      allowedOrigins: ["https://consult.example.test", "https://www.consult.example.test"],
      reviewOwnerUserId: "user-admin",
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
    expect(authenticatedPreflight.statusCode).toBe(204);
    expect(authenticatedPreflight.headers["access-control-allow-origin"]).toBeUndefined();
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

  it("scopes matter lists to the authenticated user", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/matters",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(200);
    const matters = response.json<Array<{ id: string; activity: Array<{ kind: string }> }>>();
    expect(matters.map((matter) => matter.id)).toEqual(["matter-001"]);
    expect(matters[0]!.activity.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining(["billing", "calendar", "contact", "document", "ledger", "task"]),
    );
  });

  it("returns server-derived dashboard capabilities", async () => {
    const response = await testServer().inject({ method: "GET", url: "/api/capabilities" });

    expect(response.statusCode).toBe(200);
    expect(
      response.json<{ sections: Array<{ key: string; enabled: boolean }> }>().sections,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "matters", enabled: true }),
        expect.objectContaining({ key: "contacts", enabled: true }),
        expect.objectContaining({ key: "documents", enabled: true }),
        expect.objectContaining({ key: "research", enabled: true }),
        expect.objectContaining({ key: "drafting", enabled: true }),
        expect.objectContaining({ key: "calendar", enabled: true }),
        expect.objectContaining({ key: "signatures", enabled: true }),
      ]),
    );
  });

  it("returns contact dossiers through the registered API surface", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/contacts/dossiers",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(
      response.json<Array<{ contact: { id: string } }>>().map((dossier) => dossier.contact.id),
    ).toEqual(["contact-ada", "contact-river"]);
  });

  it("requires explicit matter scope for matter-scoped ledger reads", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/ledger",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("lists signature and intake records across assigned matters for matter-scoped users", async () => {
    const headers = {
      "x-open-practice-user-id": "user-licensee",
      "x-open-practice-firm-id": "firm-west-legal",
    };
    const server = testServer();
    const signatures = await server.inject({
      method: "GET",
      url: "/api/signature-requests",
      headers,
    });
    const intake = await server.inject({ method: "GET", url: "/api/intake-sessions", headers });

    expect(signatures.statusCode).toBe(200);
    expect(signatures.json<Array<{ matterId: string }>>().map((record) => record.matterId)).toEqual(
      ["matter-001"],
    );
    expect(intake.statusCode).toBe(200);
    expect(
      intake
        .json<{ sessions: Array<{ matterId: string }> }>()
        .sessions.map((record) => record.matterId),
    ).toEqual(["matter-001"]);
  });

  it("persists conflict audit events through the repository boundary", async () => {
    const server = testServer();
    const before = await server.inject({ method: "GET", url: "/api/audit" });
    const beforePayload = before.json<{
      events: unknown[];
      taxonomySummary: { total: number; known: number; byCategory: Record<string, number> };
    }>();
    const beforeCount = beforePayload.events.length;

    const conflict = await server.inject({
      method: "POST",
      url: "/api/conflicts/check",
      payload: { prospectiveName: "River City Rentals", includeClosedMatters: true },
    });

    expect(conflict.statusCode).toBe(200);
    const after = await server.inject({ method: "GET", url: "/api/audit" });
    const afterPayload = after.json<{
      events: unknown[];
      taxonomySummary: { total: number; known: number; byCategory: Record<string, number> };
    }>();
    expect(afterPayload.events).toHaveLength(beforeCount + 1);
    expect(afterPayload.taxonomySummary).toMatchObject({
      total: beforePayload.taxonomySummary.total + 1,
      known: beforePayload.taxonomySummary.known + 1,
      byCategory: {
        conflicts: (beforePayload.taxonomySummary.byCategory.conflicts ?? 0) + 1,
      },
    });
    const dossiers = await server.inject({ method: "GET", url: "/api/contacts/dossiers" });
    expect(dossiers.statusCode).toBe(200);
    const river = dossiers
      .json<Array<{ contact: { id: string }; conflictHistory: unknown[] }>>()
      .find((dossier) => dossier.contact.id === "contact-river");
    expect(river?.conflictHistory).toEqual([
      expect.objectContaining({
        matchedContactId: "contact-river",
        visibleMatchedMatterIds: ["matter-001"],
        matchCount: 1,
        maxSeverity: "blocker",
      }),
    ]);
    expect(JSON.stringify(river?.conflictHistory)).not.toContain("River City Rentals");
    expect(JSON.stringify(river?.conflictHistory)).not.toContain("river city rentals");
  });

  it("accepts expanded conflict input through the existing route contract", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/conflicts/check",
      payload: {
        prospectiveName: "Morgan Tenant",
        aliases: ["Northstar Holdings"],
        identifiers: [{ type: "registry_id", value: "BC1234567" }],
        prospectiveRole: "opposing_party",
        includeClosedMatters: true,
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{
      results: Array<{
        contactId: string;
        matchedValue: string;
        severity: string;
      }>;
      auditChainValid: boolean;
    }>();
    expect(payload.auditChainValid).toBe(true);
    expect(payload.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contactId: "contact-northstar",
          severity: "blocker",
        }),
      ]),
    );
    expect(
      payload.results.some((result) =>
        ["northstar holdings", "BC1234567"].includes(result.matchedValue),
      ),
    ).toBe(true);
  });

  it("posts ledger transactions through validated request bodies", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/ledger/transactions",
      payload: {
        id: "earned-fee-001",
        idempotencyKey: "earned-fee-001",
        entries: [
          {
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 75000,
            creditCents: 0,
            memo: "Transfer earned fee from trust liability",
          },
          {
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-operating-revenue",
            debitCents: 0,
            creditCents: 75000,
            memo: "Recognize earned fee",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ firmId: string; idempotencyKey: string }>()).toMatchObject({
      firmId: "firm-west-legal",
      idempotencyKey: "earned-fee-001",
    });
  });

  it("rejects ledger entries whose client is not linked to the target matter", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/ledger/transactions",
      payload: {
        id: "bad-client-link",
        idempotencyKey: "bad-client-link",
        entries: [
          {
            matterId: "matter-002",
            clientId: "contact-ada",
            accountId: "acct-trust-bank",
            debitCents: 100,
            creditCents: 0,
            memo: "Bad client matter link",
          },
          {
            matterId: "matter-002",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 0,
            creditCents: 100,
            memo: "Bad client matter link",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ message: string }>().message).toMatch(/non-adverse party/);
  });

  it("marks completed document uploads with checksum and scan states", async () => {
    const checksumSha256 = "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c";
    const response = await testServer({
      s3: {
        bucket: "open-practice-test-documents",
        client: {
          send: async () => ({
            ChecksumSHA256: Buffer.from(checksumSha256, "hex").toString("base64"),
            ContentLength: 4096,
          }),
        } as never,
      },
    }).inject({
      method: "POST",
      url: "/api/documents/doc-001/upload-complete",
      payload: {
        checksumSha256,
        scanStatus: "passed",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "doc-001",
      uploadStatus: "verified",
      checksumStatus: "verified",
      scanStatus: "queued",
    });
  });

  it("updates document scan state after upload completion", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/documents/doc-001/scan-status",
      payload: { scanStatus: "failed" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "doc-001", scanStatus: "failed" });
  });

  it("persists intake sessions and generated document records", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-sessions",
      payload: {
        matterId: "matter-001",
        templateId: "intake-template-001",
        clientContactId: "contact-ada",
        deliveryConfirmation: deliveryConfirmation(),
      },
    });

    expect(created.statusCode).toBe(200);
    const sessionId = created.json<{ id: string }>().id;
    const generated = await server.inject({
      method: "POST",
      url: `/api/intake-sessions/${sessionId}/generated-documents`,
      payload: { title: "Draft notice package", deliveryConfirmation: deliveryConfirmation() },
    });

    expect(generated.statusCode).toBe(200);
    expect(generated.json()).toMatchObject({
      intakeSessionId: sessionId,
      matterId: "matter-001",
      title: "Draft notice package",
    });
  });

  it("persists answer snapshots and embedded generated document metadata", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-sessions",
      payload: {
        matterId: "matter-001",
        templateId: "intake-template-001",
        clientContactId: "contact-ada",
        deliveryConfirmation: deliveryConfirmation(),
      },
    });
    const sessionId = created.json<{ id: string }>().id;
    const snapshot = await server.inject({
      method: "POST",
      url: `/api/intake-sessions/${sessionId}/answer-snapshots`,
      payload: { answers: { issue: "repair" } },
    });
    const snapshots = await server.inject({
      method: "GET",
      url: `/api/intake-sessions/${sessionId}/answer-snapshots`,
    });
    const generated = await server.inject({
      method: "POST",
      url: `/api/intake-sessions/${sessionId}/generated-documents`,
      payload: {
        title: "Embedded notice package",
        storageKey: "generated/embedded-notice-package.pdf",
        checksumSha256: "a".repeat(64),
        deliveryConfirmation: deliveryConfirmation(),
      },
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ provider: "embedded" });
    expect(snapshot.statusCode).toBe(200);
    expect(
      snapshots.json<{ snapshots: Array<{ answers: Record<string, unknown> }> }>().snapshots[0]
        ?.answers,
    ).toEqual({ issue: "repair" });
    expect(generated.statusCode).toBe(200);
    expect(generated.json()).toMatchObject({
      provider: "embedded",
      storageKeyPresent: true,
      checksumPresent: true,
    });
    expect(generated.json()).not.toHaveProperty("storageKey");
    expect(generated.json()).not.toHaveProperty("checksumSha256");
  });

  it("enforces matter access on answer snapshots", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-sessions",
      payload: {
        matterId: "matter-002",
        templateId: "intake-template-001",
        clientContactId: "contact-northstar",
        deliveryConfirmation: deliveryConfirmation(),
      },
    });
    const sessionId = created.json<{ id: string }>().id;
    const forbidden = await server.inject({
      method: "GET",
      url: `/api/intake-sessions/${sessionId}/answer-snapshots`,
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(forbidden.statusCode).toBe(403);
  });

  it("records ledger approvals, reconciliations, and queue exceptions", async () => {
    const server = testServer();
    const approval = await server.inject({
      method: "POST",
      url: "/api/ledger/transactions/trust-retainer/approvals",
      payload: { decision: "approved", notes: "Reviewed source statement" },
    });
    const reconciliation = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations",
      payload: {
        accountId: "acct-trust-bank",
        statementPeriodStart: "2026-04-01T00:00:00.000Z",
        statementPeriodEnd: "2026-04-30T23:59:59.000Z",
        beginningBalanceCents: 0,
        endingBalanceCents: 149500,
        expectedBalanceCents: 150000,
        actualBalanceCents: 149500,
        statementRows: [
          {
            id: "statement-row-server-exception",
            postedAt: "2026-04-29T17:00:00.000Z",
            description: "Synthetic unresolved statement item",
            amountCents: 149500,
            matchedLedgerEntryIds: [],
            reviewDecision: "unmatched",
          },
        ],
        varianceExplanation: "Synthetic statement item needs ledger review.",
        evidence: { statement: "April" },
      },
    });
    const queues = await server.inject({ method: "GET", url: "/api/queues" });

    expect(approval.statusCode).toBe(200);
    expect(approval.json()).toMatchObject({
      transactionId: "trust-retainer",
      decision: "approved",
    });
    expect(reconciliation.statusCode).toBe(200);
    expect(reconciliation.json()).toMatchObject({ status: "exception" });
    expect(
      queues
        .json<{ sections: Array<{ key: string; items: Array<{ id: string }> }> }>()
        .sections.find((section) => section.key === "ledger")?.items,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: reconciliation.json().id })]));
  });

  it("rejects unauthorized ledger control writes and hides firm ledger queue items", async () => {
    const server = testServer();
    const reconciliation = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations",
      payload: {
        accountId: "acct-trust-bank",
        statementPeriodStart: "2026-04-01T00:00:00.000Z",
        statementPeriodEnd: "2026-04-30T23:59:59.000Z",
        beginningBalanceCents: 0,
        endingBalanceCents: 149500,
        expectedBalanceCents: 150000,
        actualBalanceCents: 149500,
        statementRows: [
          {
            id: "statement-row-forbidden-queue",
            postedAt: "2026-04-29T17:00:00.000Z",
            description: "Synthetic unresolved statement item",
            amountCents: 149500,
            matchedLedgerEntryIds: [],
            reviewDecision: "unmatched",
          },
        ],
        varianceExplanation: "Synthetic statement item needs ledger review.",
      },
    });
    const forbiddenApproval = await server.inject({
      method: "POST",
      url: "/api/ledger/transactions/trust-retainer/approvals",
      headers: {
        "x-open-practice-user-id": "user-staff",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: { decision: "approved" },
    });
    const scopedQueues = await server.inject({
      method: "GET",
      url: "/api/queues",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(reconciliation.statusCode).toBe(200);
    expect(forbiddenApproval.statusCode).toBe(403);
    expect(
      scopedQueues
        .json<{ sections: Array<{ key: string; items: Array<{ id: string }> }> }>()
        .sections.find((section) => section.key === "ledger")?.items,
    ).toEqual([]);
  });

  it("runs the billing lifecycle without posting trust ledger transactions", async () => {
    const server = testServer();
    const ledgerBefore = await server.inject({ method: "GET", url: "/api/ledger" });
    const beforeEntryCount = ledgerBefore.json<{ entries: unknown[] }>().entries.length;

    const time = await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-billing-api",
        matterId: "matter-001",
        minutes: 60,
        rateCents: 18000,
        narrative: "Prepare tenancy hearing materials.",
      },
    });
    const expense = await server.inject({
      method: "POST",
      url: "/api/expense-entries",
      payload: {
        id: "expense-billing-api",
        matterId: "matter-001",
        amountCents: 2500,
        category: "Filing",
        description: "Courier evidence package.",
      },
    });
    const submitTime = await server.inject({
      method: "POST",
      url: "/api/time-entries/time-billing-api/submit",
    });
    const approveTime = await server.inject({
      method: "POST",
      url: "/api/time-entries/time-billing-api/approve",
    });
    const submitExpense = await server.inject({
      method: "POST",
      url: "/api/expense-entries/expense-billing-api/submit",
    });
    const approveExpense = await server.inject({
      method: "POST",
      url: "/api/expense-entries/expense-billing-api/approve",
    });

    expect(time.statusCode).toBe(200);
    expect(expense.statusCode).toBe(200);
    expect(submitTime.statusCode).toBe(200);
    expect(approveTime.statusCode).toBe(200);
    expect(submitExpense.statusCode).toBe(200);
    expect(approveExpense.statusCode).toBe(200);

    const invoice = await server.inject({
      method: "POST",
      url: "/api/invoices",
      payload: {
        id: "invoice-billing-api",
        matterId: "matter-001",
        clientContactId: "contact-ada",
        invoiceNumber: "INV-API-001",
        timeEntryIds: ["time-billing-api"],
        expenseEntryIds: ["expense-billing-api"],
        taxName: "GST",
        taxRateBps: 500,
      },
    });
    const invoiceBody = invoice.json<{ totalCents: number; balanceDueCents: number }>();
    const approvedInvoice = await server.inject({
      method: "POST",
      url: "/api/invoices/invoice-billing-api/approve",
    });
    const issuedInvoice = await server.inject({
      method: "POST",
      url: "/api/invoices/invoice-billing-api/issue",
    });
    const billedTime = await server.inject({
      method: "GET",
      url: "/api/time-entries?matterId=matter-001&status=billed",
    });

    expect(invoice.statusCode).toBe(200);
    expect(invoiceBody).toMatchObject({ totalCents: 21525, balanceDueCents: 21525 });
    expect(approvedInvoice.statusCode).toBe(200);
    expect(issuedInvoice.statusCode).toBe(200);
    expect(
      billedTime.json<{ entries: Array<{ id: string }> }>().entries.map((entry) => entry.id),
    ).toContain("time-billing-api");

    const transferRequest = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests",
      payload: {
        id: "trust-transfer-billing-api",
        matterId: "matter-001",
        invoiceId: "invoice-billing-api",
        amountCents: invoiceBody.totalCents,
        reason: "Request trust transfer approval only.",
      },
    });

    expect(transferRequest.statusCode).toBe(200);
    expect(transferRequest.json()).toMatchObject({ status: "pending_approval" });
    expect(transferRequest.json()).not.toHaveProperty("ledgerTransactionId");

    const payment = await server.inject({
      method: "POST",
      url: "/api/payments",
      payload: {
        id: "payment-billing-api",
        matterId: "matter-001",
        invoiceId: "invoice-billing-api",
        amountCents: invoiceBody.totalCents,
        method: "cheque",
        reference: "CHK-1",
      },
    });
    const paidInvoice = await server.inject({
      method: "GET",
      url: "/api/invoices/invoice-billing-api",
    });

    expect(payment.statusCode).toBe(200);
    expect(paidInvoice.json<{ status: string; balanceDueCents: number }>()).toMatchObject({
      status: "paid",
      balanceDueCents: 0,
    });

    const ledgerAfter = await server.inject({ method: "GET", url: "/api/ledger" });

    expect(ledgerAfter.json<{ entries: unknown[] }>().entries).toHaveLength(beforeEntryCount);
  });

  it("enforces matter access on billing routes", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/time-entries?matterId=matter-002",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
