import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerShareRoutes } from "./shares.js";

const jwtSecret = "test-share-secret-at-least-32-chars";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  const idByRole: Partial<Record<ProfessionalRole, string>> = {
    owner_admin: "user-admin",
    licensee: "user-licensee",
    firm_member: "user-staff",
  };
  return {
    id: idByRole[role] ?? `user-${role}`,
    firmId: "firm-west-legal",
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function testServer(input: {
  repository: InMemoryOpenPracticeRepository;
  authUser?: User;
  withAuthHook?: boolean;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  if (input.withAuthHook ?? true) {
    const authUser = input.authUser ?? user("owner_admin", ["matter-001", "matter-002"]);
    server.addHook("preHandler", async (request) => {
      request.auth = { firmId: authUser.firmId, user: authUser };
    });
  }
  registerShareRoutes(server, { repository: input.repository, jwtSecret });
  servers.push(server);
  return server;
}

async function addShareableDocument(repository: InMemoryOpenPracticeRepository): Promise<void> {
  await repository.createDocumentUploadIntent({
    id: "doc-shareable-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    title: "Client disclosure.pdf",
    storageKey: "matters/matter-001/client-disclosure.pdf",
    checksumSha256: "b8f3bcb433c2666c1f9f72d8c9f6f2bf792ee18f746375a42dbf17447275d4b2",
    classification: "general",
    legalHold: false,
  });
  await repository.completeDocumentUpload({
    firmId: "firm-west-legal",
    documentId: "doc-shareable-001",
    checksumSha256: "b8f3bcb433c2666c1f9f72d8c9f6f2bf792ee18f746375a42dbf17447275d4b2",
    scanStatus: "passed",
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("share routes", () => {
  it("creates a one-time raw token while storing only the token hash", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const response = await server.inject({
      method: "POST",
      url: "/api/shares",
      payload: {
        matterId: "matter-001",
        permissions: ["view_documents"],
        requireEmailVerification: true,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.share).toMatchObject({
      matterId: "matter-001",
      permissions: ["view_documents"],
      grantedByUserId: "user-licensee",
      requireEmailVerification: true,
    });
    expect(body.share).not.toHaveProperty("tokenHash");

    const stored = await repository.listShareLinks("firm-west-legal", { matterId: "matter-001" });
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).not.toBe(body.token);
    expect(stored[0].tokenHash).toHaveLength(64);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "share_link.created",
          resourceType: "share_link",
          resourceId: body.share.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            requireEmailVerification: true,
          }),
        }),
      ]),
      valid: true,
    });
  });

  it("enforces matter scope and document eligibility before creating document shares", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const wrongMatter = await server.inject({
      method: "POST",
      url: "/api/shares",
      payload: { matterId: "matter-002", permissions: ["view_documents"] },
    });
    expect(wrongMatter.statusCode).toBe(403);

    const ineligibleDocument = await server.inject({
      method: "POST",
      url: "/api/shares",
      payload: { matterId: "matter-001", permissions: ["view_documents"] },
    });
    expect(ineligibleDocument.statusCode).toBe(422);
    expect(ineligibleDocument.json()).toMatchObject({
      message: "No documents on this matter are eligible for portal sharing",
    });
  });

  it("rejects share permissions without implemented public flows", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    const server = testServer({ repository });

    const response = await server.inject({
      method: "POST",
      url: "/api/shares",
      payload: { matterId: "matter-001", permissions: ["upload_documents"] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "Invalid request body" });
  });

  it("serves public token-scoped document metadata and records access", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    const authedServer = testServer({ repository });

    const created = await authedServer.inject({
      method: "POST",
      url: "/api/shares",
      payload: { matterId: "matter-001", permissions: ["view_documents"] },
    });
    const token = created.json().token;
    const publicServer = testServer({ repository, withAuthHook: false });

    const response = await publicServer.inject({
      method: "GET",
      url: `/api/portal/shares/${token}`,
      headers: { "user-agent": "share-test" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      share: { matterId: "matter-001", permissions: ["view_documents"] },
      documents: [
        {
          id: "doc-shareable-001",
          title: "Client disclosure.pdf",
        },
      ],
    });
    expect(response.json().documents[0]).not.toHaveProperty("storageKey");

    await expect(repository.listAccessLogs("firm-west-legal")).resolves.toMatchObject([
      {
        shareLinkId: created.json().share.id,
        resourceType: "share_link",
        action: "view",
        metadata: { outcome: "granted", documentCount: 1 },
      },
    ]);
  });

  it("blocks revoked share links from public reads", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    const authedServer = testServer({ repository });
    const created = await authedServer.inject({
      method: "POST",
      url: "/api/shares",
      payload: { matterId: "matter-001", permissions: ["view_documents"] },
    });

    const revoked = await authedServer.inject({
      method: "POST",
      url: `/api/shares/${created.json().share.id}/revoke`,
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().share.revokedAt).toEqual(expect.any(String));
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "share_link.revoked",
          resourceType: "share_link",
          resourceId: created.json().share.id,
        }),
      ]),
      valid: true,
    });

    const publicServer = testServer({ repository, withAuthHook: false });
    const response = await publicServer.inject({
      method: "GET",
      url: `/api/portal/shares/${created.json().token}`,
    });
    expect(response.statusCode).toBe(404);
  });
});
