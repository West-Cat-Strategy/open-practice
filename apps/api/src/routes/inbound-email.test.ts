import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type {
  InboundEmailAttachmentRecord,
  InboundEmailMessageRecord,
  ProfessionalRole,
  User,
} from "@open-practice/domain";
import { registerInboundEmailRoutes } from "./inbound-email.js";

const firmId = "firm-west-legal";
const now = "2026-04-29T12:00:00.000Z";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  const idByRole: Partial<Record<ProfessionalRole, string>> = {
    owner_admin: "user-admin",
    auditor: "user-auditor",
    licensee: "user-licensee",
    firm_member: "user-staff",
  };
  return {
    id: idByRole[role] ?? `user-${role}`,
    firmId,
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function testServer(
  repository: InMemoryOpenPracticeRepository,
  authUser: User = user("owner_admin", ["matter-001", "matter-002"]),
): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerInboundEmailRoutes(server, { repository });
  servers.push(server);
  return server;
}

function message(overrides: Partial<InboundEmailMessageRecord> = {}): InboundEmailMessageRecord {
  return {
    id: "inbound-message-001",
    firmId,
    addressId: "inbound-address-001",
    matterId: "matter-001",
    messageId: "<message-001@example.test>",
    fromAddress: "client@example.test",
    toAddresses: ["matter-001@open-practice.test"],
    subject: "Filed materials",
    receivedAt: now,
    rawStorageKey: "inbound/raw/message-001.eml",
    parsedText: "Please review.",
    labels: [],
    status: "triaged",
    metadata: {},
    ...overrides,
  };
}

function attachment(
  overrides: Partial<InboundEmailAttachmentRecord> = {},
): InboundEmailAttachmentRecord {
  return {
    id: "inbound-attachment-001",
    firmId,
    inboundMessageId: "inbound-message-001",
    filename: "filing.pdf",
    contentType: "application/pdf",
    sizeBytes: 128,
    storageKey: "inbound/message-001/filing.pdf",
    checksumSha256: "a".repeat(64),
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("inbound email routes", () => {
  it("returns configured inbound addresses without provider secrets", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-inbound-default",
      firmId,
      kind: "inbound_email",
      key: "mailgun",
      enabled: true,
      encryptedConfig: "sealed:provider-secret",
      createdAt: now,
      updatedAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-001",
      firmId,
      address: "matter-001@open-practice.test",
      matterId: "matter-001",
      enabled: true,
      createdAt: now,
    });
    await repository.createInboundEmailAddress({
      id: "inbound-address-disabled",
      firmId,
      address: "archive@open-practice.test",
      enabled: false,
      createdAt: now,
    });

    const response = await testServer(repository).inject({
      method: "GET",
      url: "/api/inbound-email/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "configured",
      provider: "mailgun",
      addresses: [
        {
          id: "inbound-address-001",
          address: "matter-001@open-practice.test",
          matterId: "matter-001",
          enabled: true,
          createdAt: now,
        },
        {
          id: "inbound-address-disabled",
          address: "archive@open-practice.test",
          enabled: false,
          createdAt: now,
        },
      ],
    });
    expect(JSON.stringify(response.json())).not.toContain("sealed:provider-secret");
  });

  it("returns one parsed message with only that message's inbound attachments", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message());
    await repository.createInboundEmailMessage(message({ id: "inbound-message-002" }));
    await repository.createInboundEmailAttachment(attachment());
    await repository.createInboundEmailAttachment(
      attachment({
        id: "inbound-attachment-other",
        inboundMessageId: "inbound-message-002",
        filename: "other.pdf",
        storageKey: "inbound/message-002/other.pdf",
      }),
    );

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "available",
      message: {
        id: "inbound-message-001",
        matterId: "matter-001",
        parsedText: "Please review.",
      },
      attachments: [
        {
          id: "inbound-attachment-001",
          inboundMessageId: "inbound-message-001",
          filename: "filing.pdf",
          checksumSha256: "a".repeat(64),
        },
      ],
    });
    expect(response.json().attachments).toHaveLength(1);
    expect(response.json().attachments[0]).not.toHaveProperty("documentId");
  });

  it("denies assigned users outside their matter and for unscoped messages", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage(message({ matterId: "matter-002" }));
    await repository.createInboundEmailMessage(
      message({
        id: "inbound-message-unscoped",
        matterId: undefined,
        addressId: undefined,
        status: "triage_pending",
      }),
    );
    const server = testServer(repository, user("licensee", ["matter-001"]));

    const wrongMatter = await server.inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-001",
    });
    expect(wrongMatter.statusCode).toBe(403);

    const unscoped = await server.inject({
      method: "GET",
      url: "/api/inbound-email/messages/inbound-message-unscoped",
    });
    expect(unscoped.statusCode).toBe(403);
  });

  it.each(["owner_admin", "auditor"] as const)(
    "lets %s read unscoped firm-review messages",
    async (role) => {
      const repository = new InMemoryOpenPracticeRepository();
      await repository.createInboundEmailMessage(
        message({
          id: "inbound-message-unscoped",
          matterId: undefined,
          addressId: undefined,
          status: "triage_pending",
        }),
      );

      const response = await testServer(repository, user(role, [])).inject({
        method: "GET",
        url: "/api/inbound-email/messages/inbound-message-unscoped",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: { id: "inbound-message-unscoped" },
        attachments: [],
      });
      expect(response.json().message).not.toHaveProperty("matterId");
    },
  );

  it("returns 404 for a missing firm-scoped inbound message", async () => {
    const response = await testServer(new InMemoryOpenPracticeRepository()).inject({
      method: "GET",
      url: "/api/inbound-email/messages/missing-message",
    });

    expect(response.statusCode).toBe(404);
  });
});
