import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerContactRoutes } from "./contacts.js";

const servers: FastifyInstance[] = [];

function user(
  role: ProfessionalRole,
  assignedMatterIds: string[] = ["matter-001", "matter-002"],
): User {
  return {
    id: `user-${role}`,
    firmId: "firm-west-legal",
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function testServer(
  input: {
    repository?: OpenPracticeRepository;
    user?: User;
  } = {},
): FastifyInstance {
  const repository = input.repository ?? new InMemoryOpenPracticeRepository();
  const authUser = input.user ?? user("owner_admin");
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerContactRoutes(server, { repository });
  server.setErrorHandler((error, _request, reply) => {
    const normalizedError = error as Error & { statusCode?: number };
    reply.status(normalizedError.statusCode ?? 400).send({
      error: normalizedError.name,
      message: normalizedError.message,
    });
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("contact routes", () => {
  it("returns read-only contact dossiers for accessible matters only", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createIntakeVariableProposals([
      {
        id: "proposal-contact-name",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        intakeSessionId: "intake-001",
        answerSnapshotId: "snapshot-001",
        sourceQuestionId: "client_display_name",
        targetScope: "client",
        targetField: "displayName",
        targetRecordId: "contact-ada",
        proposedValue: "Ada M. Nguyen",
        status: "approved",
        createdAt: "2026-05-01T10:00:00.000Z",
        reviewedByUserId: "user-licensee",
        reviewedAt: "2026-05-01T11:00:00.000Z",
        appliedAt: "2026-05-01T11:00:00.000Z",
      },
    ]);
    const response = await testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/contacts/dossiers" });

    expect(response.statusCode).toBe(200);
    const payload = response.json<
      Array<{
        contact: { id: string };
        matters: unknown[];
        qualityReview: { summary: { revalidationPromptCount: number }; signals: unknown[] };
      }>
    >();
    expect(payload.map((dossier) => dossier.contact.id)).toEqual(["contact-ada", "contact-river"]);
    expect(payload).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ contact: { id: "contact-northstar" } })]),
    );
    expect(payload.find((dossier) => dossier.contact.id === "contact-ada")).toMatchObject({
      qualityReview: {
        summary: { revalidationPromptCount: 1 },
        signals: [
          expect.objectContaining({
            kind: "protected_party_cue",
            matterId: "matter-001",
          }),
          expect.objectContaining({
            kind: "protected_party_cue",
            matterId: "matter-001",
          }),
          expect.objectContaining({
            kind: "conflict_revalidation",
            sourceRecordId: "proposal-contact-name",
          }),
        ],
      },
    });
  });

  it("rejects users without contact read access", async () => {
    const response = await testServer({
      user: user("client_external", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/contacts/dossiers" });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: "Contact access required",
    });
  });
});
