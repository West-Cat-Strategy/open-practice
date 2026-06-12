import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { createApiServer } from "../server.js";

const jwtSecret = "test-e2e-support-secret-at-least-32-chars";
const servers: Array<{ close: () => Promise<void> }> = [];

function testServer(options: { e2eSupport?: boolean } = {}) {
  const repository = new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    jwtSecret,
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    e2eSupport: options.e2eSupport,
    webAuthn: {
      rpName: "Test RP",
      rpID: "localhost",
      origin: "http://localhost:3000",
    },
  });
  servers.push(server);
  return { repository, server };
}

async function seedShareVerificationEmail(
  repository: InMemoryOpenPracticeRepository,
  input: { token: string; verificationCode: string },
) {
  const now = "2026-05-01T00:00:00.000Z";
  await repository.createQueuedEmailOutbox({
    email: {
      id: "email-outbox-e2e-share-code",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      templateKey: "share_link.created",
      status: "queued",
      to: ["client@example.test"],
      cc: [],
      bcc: [],
      from: "Open Practice <no-reply@open-practice.local>",
      subject: "Secure document share",
      htmlBody: "",
      textBody: [
        "A secure document share is available.",
        `Share token: ${input.token}`,
        `Email verification code: ${input.verificationCode}`,
      ].join("\n"),
      relatedResourceType: "share_link",
      relatedResourceId: "share-e2e-code",
      queuedAt: now,
      attemptCount: 0,
      metadata: { source: "e2e-support-test" },
    },
    event: {
      id: "email-event-e2e-share-code",
      firmId: "firm-west-legal",
      emailId: "email-outbox-e2e-share-code",
      eventType: "queued",
      occurredAt: now,
      jobId: "job-e2e-share-code",
      source: "api",
      metadata: { source: "e2e-support-test" },
    },
    job: {
      id: "job-e2e-share-code",
      firmId: "firm-west-legal",
      queueName: "email",
      jobName: "send_email",
      status: "queued",
      targetResourceType: "email_outbox",
      targetResourceId: "email-outbox-e2e-share-code",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: now,
      metadata: { emailId: "email-outbox-e2e-share-code", matterId: "matter-001" },
    },
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("e2e support routes", () => {
  it("creates a completed synthetic document only when e2e support is enabled", async () => {
    const { repository, server } = testServer({ e2eSupport: true });

    const response = await server.inject({
      method: "POST",
      url: "/api/e2e/shareable-document",
      payload: {
        matterId: "matter-001",
        title: "Synthetic route-test disclosure.pdf",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      document: {
        matterId: "matter-001",
        title: "Synthetic route-test disclosure.pdf",
        uploadStatus: "verified",
        checksumStatus: "verified",
        scanStatus: "passed",
      },
    });
    await expect(repository.listMatterDocuments("firm-west-legal", "matter-001")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Synthetic route-test disclosure.pdf",
          storageKey: expect.stringContaining("e2e/matter-001/"),
        }),
      ]),
    );
  });

  it("returns the synthetic share verification code for e2e share links", async () => {
    const { repository, server } = testServer({ e2eSupport: true });
    await seedShareVerificationEmail(repository, {
      token: "synthetic-share-token",
      verificationCode: "ABC123DEF456",
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/e2e/share-verification-code?matterId=matter-001&token=synthetic-share-token",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ verificationCode: "ABC123DEF456" });
  });

  it("creates a deterministic client portal account only for e2e browser proof", async () => {
    const { repository, server } = testServer({ e2eSupport: true });

    const response = await server.inject({
      method: "POST",
      url: "/api/e2e/client-portal-account",
      payload: {
        matterId: "matter-001",
        contactId: "contact-ada",
        userId: "user-client-external",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      account: {
        id: "user-client-external",
        email: "ada@example.test",
        role: "client_external",
      },
      grant: {
        status: "active",
        permissions: ["view_documents", "upload_documents", "message", "sign"],
      },
    });
    await expect(
      repository.getUser("firm-west-legal", "user-client-external"),
    ).resolves.toMatchObject({
      role: "client_external",
    });
    await expect(
      repository.getConversationThread("firm-west-legal", "conversation-thread-e2e-matter-001"),
    ).resolves.toMatchObject({
      matterId: "matter-001",
      status: "open",
      metadata: { source: "e2e_support" },
    });
    expect(JSON.stringify(response.json())).not.toContain("tokenHash");
    expect(JSON.stringify(response.json())).not.toContain("conversation-thread-e2e-matter-001");
  });

  it("does not register e2e support routes by default", async () => {
    const { server } = testServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/e2e/shareable-document",
      payload: {
        matterId: "matter-001",
        title: "Synthetic route-test disclosure.pdf",
      },
    });

    expect(response.statusCode).toBe(404);

    const codeResponse = await server.inject({
      method: "GET",
      url: "/api/e2e/share-verification-code?matterId=matter-001&token=synthetic-share-token",
    });

    expect(codeResponse.statusCode).toBe(404);

    const clientPortalResponse = await server.inject({
      method: "POST",
      url: "/api/e2e/client-portal-account",
      payload: {
        matterId: "matter-001",
        contactId: "contact-ada",
        userId: "user-client-external",
      },
    });

    expect(clientPortalResponse.statusCode).toBe(404);
  });
});
