import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import type { AuditEvent, ProfessionalRole, User } from "@open-practice/domain";
import { registerQueuesRoutes } from "./queues.js";

const servers: FastifyInstance[] = [];

interface QueueItem {
  id: string;
  matterId?: string;
  title: string;
  status: string;
  priority: string;
}

interface QueueSection {
  key: string;
  label: string;
  items: QueueItem[];
}

interface QueueResponse {
  sections: QueueSection[];
}

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
  registerQueuesRoutes(server, { repository });
  servers.push(server);
  return server;
}

function section(payload: QueueResponse, key: string): QueueSection {
  const found = payload.sections.find((candidate) => candidate.key === key);
  expect(found).toBeDefined();
  return found!;
}

async function addLedgerException(
  repository: InMemoryOpenPracticeRepository,
  id: string,
): Promise<void> {
  await repository.createLedgerReconciliation({
    id,
    firmId: "firm-west-legal",
    accountId: "acct-trust-bank",
    statementPeriodStart: "2026-04-01T00:00:00.000Z",
    statementPeriodEnd: "2026-04-30T23:59:59.000Z",
    expectedBalanceCents: 150000,
    actualBalanceCents: 149500,
    status: "exception",
    reviewedByUserId: "user-admin",
    evidence: {},
    createdAt: "2026-04-30T23:59:59.000Z",
  });
}

async function addMatterTwoQueueItems(repository: InMemoryOpenPracticeRepository): Promise<void> {
  await repository.createDocumentUploadIntent({
    id: "doc-matter-002",
    firmId: "firm-west-legal",
    matterId: "matter-002",
    title: "North Star records.pdf",
    storageKey: "matters/matter-002/north-star-records.pdf",
    checksumSha256: "a".repeat(64),
    classification: "general",
    legalHold: false,
  });
  await repository.createSignatureRequest({
    request: {
      id: "sig-matter-002",
      firmId: "firm-west-legal",
      matterId: "matter-002",
      documentId: "doc-matter-002",
      title: "North Star authorization",
      requestedByUserId: "user-admin",
      provider: "embedded",
      externalId: "embedded:matter-002:doc-matter-002",
      status: "sent",
      consentText: "I consent to electronic signature.",
      evidence: {},
      createdAt: "2026-04-05T18:30:00.000Z",
    },
    signers: [
      {
        id: "sig-signer-matter-002",
        firmId: "firm-west-legal",
        signatureRequestId: "sig-matter-002",
        name: "North Star Client",
        email: "northstar@example.test",
        role: "client",
        status: "sent",
      },
    ],
    event: {
      id: "sig-event-matter-002",
      firmId: "firm-west-legal",
      signatureRequestId: "sig-matter-002",
      provider: "embedded",
      externalId: "embedded:matter-002:doc-matter-002",
      status: "sent",
      occurredAt: "2026-04-05T18:30:00.000Z",
      evidence: {},
    },
  });
  await repository.createIntakeSession({
    id: "intake-session-matter-002",
    firmId: "firm-west-legal",
    matterId: "matter-002",
    templateId: "intake-template-001",
    provider: "embedded",
    externalId: "embedded:intake-session-matter-002",
    status: "in_progress",
    evidence: {},
    createdAt: "2026-04-05T18:00:00.000Z",
    updatedAt: "2026-04-05T18:00:00.000Z",
  });
}

class InvalidAuditRepository extends InMemoryOpenPracticeRepository {
  override async listAuditEvents(
    firmId: string,
  ): Promise<{ events: AuditEvent[]; valid: boolean }> {
    const audit = await super.listAuditEvents(firmId);
    return { ...audit, valid: false };
  }
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("queue routes", () => {
  it("returns owner/admin queue sections with the existing response shape", async () => {
    const response = await testServer().inject({ method: "GET", url: "/api/queues" });
    const payload = response.json<QueueResponse>();

    expect(response.statusCode).toBe(200);
    expect(payload.sections.map((candidate) => candidate.key)).toEqual([
      "matters",
      "task-deadlines",
      "documents",
      "signatures",
      "intake",
      "ledger",
      "audit",
    ]);
    expect(section(payload, "matters").items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "matter-002" })]),
    );
    expect(section(payload, "task-deadlines").items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-deadline-001",
          matterId: "matter-001",
          status: "overdue",
          priority: "high",
        }),
      ]),
    );
    expect(section(payload, "documents").items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "doc-001",
          matterId: "matter-001",
          status: "verified/verified/passed/not_required",
          priority: "high",
        }),
      ]),
    );
    expect(section(payload, "signatures").items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "sig-001" })]),
    );
    expect(section(payload, "intake").items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "intake-session-001" })]),
    );
    expect(section(payload, "audit").items).toEqual([]);
    expect(payload).not.toHaveProperty("success");
  });

  it("returns queue sections for auditors with audit access", async () => {
    const response = await testServer({ user: user("auditor") }).inject({
      method: "GET",
      url: "/api/queues",
    });
    const payload = response.json<QueueResponse>();

    expect(response.statusCode).toBe(200);
    expect(section(payload, "matters").items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "matter-002" })]),
    );
    expect(section(payload, "audit").items).toEqual([]);
  });

  it("shows ledger exceptions to billing bookkeepers with firm-wide ledger access", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addLedgerException(repository, "reconciliation-bookkeeper");
    const response = await testServer({
      repository,
      user: user("billing_bookkeeper", []),
    }).inject({ method: "GET", url: "/api/queues" });
    const payload = response.json<QueueResponse>();

    expect(response.statusCode).toBe(200);
    expect(section(payload, "ledger").items).toEqual([
      expect.objectContaining({
        id: "reconciliation-bookkeeper",
        status: "exception",
        priority: "high",
      }),
    ]);
  });

  it("limits matter-scoped users to assigned matter queue items and hides firm ledger items", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addLedgerException(repository, "reconciliation-hidden");
    await addMatterTwoQueueItems(repository);
    const response = await testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/queues" });
    const payload = response.json<QueueResponse>();

    expect(response.statusCode).toBe(200);
    expect(section(payload, "matters").items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "matter-002" })]),
    );
    for (const key of ["task-deadlines", "documents", "signatures", "intake"]) {
      expect(section(payload, key).items).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ matterId: "matter-002" })]),
      );
    }
    expect(section(payload, "ledger").items).toEqual([]);
  });

  it("adds an audit queue item when the audit chain is invalid", async () => {
    const response = await testServer({
      repository: new InvalidAuditRepository(),
      user: user("auditor"),
    }).inject({ method: "GET", url: "/api/queues" });
    const payload = response.json<QueueResponse>();

    expect(response.statusCode).toBe(200);
    expect(section(payload, "audit").items).toEqual([
      {
        id: "audit-chain",
        title: "Audit chain validation",
        status: "invalid",
        priority: "high",
      },
    ]);
  });
});
