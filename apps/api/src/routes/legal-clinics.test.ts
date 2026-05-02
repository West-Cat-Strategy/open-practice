import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerLegalClinicRoutes } from "./legal-clinics.js";

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
}): FastifyInstance {
  const server = Fastify({ logger: false });
  const authUser = input.authUser ?? user("owner_admin", ["matter-001", "matter-002"]);
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerLegalClinicRoutes(server, { repository: input.repository });
  server.setErrorHandler((error, _request, reply) => {
    const normalizedError = error as Error & { statusCode?: number; code?: string };
    reply.status(normalizedError.statusCode ?? 400).send({
      error: normalizedError.name,
      code: normalizedError.code,
      message: normalizedError.message,
    });
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("legal clinic routes", () => {
  it("lists and creates firm-scoped clinic programs with redacted audit metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const before = await server.inject({ method: "GET", url: "/api/legal-clinic/programs" });
    const created = await server.inject({
      method: "POST",
      url: "/api/legal-clinic/programs",
      payload: {
        name: "Synthetic Family Advice Clinic",
        serviceArea: "Family law",
        eligibilitySummary: "Synthetic public-screening summary only.",
        defaultReferralSource: "community_desk",
        defaultReferralStatus: "referral_needed",
        metadata: { internalNarrative: "do not audit me" },
      },
    });
    const after = await server.inject({ method: "GET", url: "/api/legal-clinic/programs" });

    expect(before.statusCode).toBe(200);
    expect(before.json<{ programs: unknown[] }>().programs.length).toBeGreaterThan(0);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      program: {
        name: "Synthetic Family Advice Clinic",
        serviceArea: "Family law",
        defaultReferralStatus: "referral_needed",
      },
    });
    expect(after.json<{ programs: Array<{ name: string }> }>().programs).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Synthetic Family Advice Clinic" })]),
    );

    const audit = await repository.listAuditEvents("firm-west-legal");
    const event = audit.events.find(
      (candidate) => candidate.action === "legal_clinic.program.created",
    );
    expect(event?.metadata).toMatchObject({
      status: "active",
      serviceArea: "Family law",
      defaultReferralSourceKey: "community_desk",
      defaultReferralStatus: "referral_needed",
    });
    expect(JSON.stringify(event?.metadata)).not.toContain("do not audit me");
  });

  it("gets and upserts one matter-scoped clinic profile", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("firm_member", ["matter-001"]) });

    const getBefore = await server.inject({
      method: "GET",
      url: "/api/legal-clinic/profiles?matterId=matter-001",
    });
    const updated = await server.inject({
      method: "PUT",
      url: "/api/legal-clinic/profiles/matter-001",
      payload: {
        programId: "clinic-program-tenancy-stability",
        eligibilityStatus: "needs_review",
        referralSource: "internal_intake_desk",
        referralStatus: "referral_needed",
        referralDate: "2026-05-02",
        nextReviewDate: "2026-05-09T12:00:00.000Z",
        clinicRelationshipRole: "clinic client",
        notes: "Private notes should not appear in audit metadata.",
        metadata: { rawIntakeAnswer: "raw private facts" },
      },
    });
    const getAfter = await server.inject({
      method: "GET",
      url: "/api/legal-clinic/profiles?matterId=matter-001",
    });

    expect(getBefore.statusCode).toBe(200);
    expect(getBefore.json()).toMatchObject({ profiles: [{ matterId: "matter-001" }] });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      profile: {
        id: "clinic-profile-matter-001",
        matterId: "matter-001",
        eligibilityStatus: "needs_review",
        referralStatus: "referral_needed",
        clinicRelationshipRole: "clinic client",
        updatedByUserId: "user-staff",
      },
    });
    expect(getAfter.json()).toMatchObject({
      profiles: [{ matterId: "matter-001", eligibilityStatus: "needs_review" }],
    });

    const audit = await repository.listAuditEvents("firm-west-legal");
    const event = audit.events.find(
      (candidate) => candidate.action === "legal_clinic.profile.upserted",
    );
    expect(event?.metadata).toMatchObject({
      matterId: "matter-001",
      programId: "clinic-program-tenancy-stability",
      eligibilityStatus: "needs_review",
      referralStatus: "referral_needed",
      referralSourceKey: "internal_intake_desk",
    });
    const auditMetadata = JSON.stringify(event?.metadata);
    expect(auditMetadata).not.toContain("Private notes");
    expect(auditMetadata).not.toContain("raw private facts");
  });

  it("rejects cross-matter reads and updates without mutating the profile", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("firm_member", ["matter-001"]) });

    const deniedRead = await server.inject({
      method: "GET",
      url: "/api/legal-clinic/profiles?matterId=matter-002",
    });
    const deniedUpdate = await server.inject({
      method: "PUT",
      url: "/api/legal-clinic/profiles/matter-002",
      payload: {
        programId: "clinic-program-records-access",
        eligibilityStatus: "likely_eligible",
        referralStatus: "accepted",
        clinicRelationshipRole: "clinic client",
      },
    });

    expect(deniedRead.statusCode).toBe(403);
    expect(deniedUpdate.statusCode).toBe(403);
    await expect(
      repository.getLegalClinicMatterProfile("firm-west-legal", "matter-002"),
    ).resolves.toMatchObject({
      eligibilityStatus: "needs_review",
      referralStatus: "not_referred",
    });
  });

  it("rejects profile upserts for missing clinic programs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const response = await server.inject({
      method: "PUT",
      url: "/api/legal-clinic/profiles/matter-001",
      payload: {
        programId: "clinic-program-missing",
        clinicRelationshipRole: "clinic client",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      message: "Legal clinic program was not found",
    });
  });

  it("denies unauthorized clinic program creation by read-only roles", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("auditor", []) });

    const response = await server.inject({
      method: "POST",
      url: "/api/legal-clinic/programs",
      payload: {
        name: "Synthetic Audit Read Only Clinic",
        serviceArea: "Review only",
        eligibilitySummary: "Synthetic summary.",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: "Legal clinic access required",
    });
  });
});
