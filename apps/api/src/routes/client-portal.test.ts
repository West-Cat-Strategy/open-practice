import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { hashToken } from "../http/auth-helpers.js";
import { createApiServer } from "../server.js";
import { registerClientPortalRoutes } from "./client-portal-workspace.js";

const firmId = "firm-west-legal";
const matterId = "matter-001";
const contactId = "contact-ada";
const now = "2026-05-20T16:00:00.000Z";
const future = "2099-06-20T16:00:00.000Z";
const jwtSecret = "test-client-portal-secret-at-least-32-chars";
const clientUserId = "user-client-ada";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, assignedMatterIds: string[] = [matterId]): User {
  const idByRole: Partial<Record<ProfessionalRole, string>> = {
    owner_admin: "user-admin",
    licensee: "user-licensee",
    firm_member: "user-staff",
    client_external: clientUserId,
  };
  return {
    id: idByRole[role] ?? "user-" + role,
    firmId,
    displayName: role === "client_external" ? "Ada Morgan" : "Test " + role,
    email: role === "client_external" ? "ada@example.test" : role + "@example.test",
    role,
    assignedMatterIds: role === "client_external" ? [] : assignedMatterIds,
    mfaEnabled: role !== "client_external",
  };
}

function testServer(input: {
  repository: InMemoryOpenPracticeRepository;
  authUser?: User;
  secret?: string;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  const authUser = input.authUser ?? user("licensee");
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerClientPortalRoutes(server, { repository: input.repository, jwtSecret: input.secret });
  servers.push(server);
  return server;
}

function fullApiServer(repository: InMemoryOpenPracticeRepository): FastifyInstance {
  const server = createApiServer({
    repository,
    jwtSecret,
    devFirmId: firmId,
    devUserId: "user-admin",
    nodeEnv: "production",
    webAuthn: {
      rpName: "Open Practice Test",
      rpID: "localhost",
      origin: "http://localhost:3000",
    },
  });
  servers.push(server);
  return server;
}

async function createClientUser(repository: InMemoryOpenPracticeRepository): Promise<User> {
  return repository.createUser(user("client_external"));
}

async function createClientSession(repository: InMemoryOpenPracticeRepository): Promise<string> {
  const token = "client-session-token";
  await repository.createAuthSession({
    id: "session-client",
    firmId,
    userId: clientUserId,
    tokenHash: hashToken(token, jwtSecret),
    createdAt: now,
    expiresAt: future,
  });
  return token;
}

async function addShareableDocument(repository: InMemoryOpenPracticeRepository): Promise<void> {
  await repository.createDocumentUploadIntent({
    id: "doc-client-visible",
    firmId,
    matterId,
    title: "Client visible synthetic document.pdf",
    storageKey: "matters/matter-001/client-visible-synthetic.pdf",
    checksumSha256: "b8f3bcb433c2666c1f9f72d8c9f6f2bf792ee18f746375a42dbf17447275d4b2",
    classification: "general",
    legalHold: false,
  });
  await repository.completeDocumentUpload({
    firmId,
    documentId: "doc-client-visible",
    checksumSha256: "b8f3bcb433c2666c1f9f72d8c9f6f2bf792ee18f746375a42dbf17447275d4b2",
    scanStatus: "passed",
  });
}

async function addWorkspaceRecords(repository: InMemoryOpenPracticeRepository): Promise<void> {
  await createClientUser(repository);
  await repository.createPortalGrant({
    id: "portal-grant-client-workspace",
    firmId,
    matterId,
    contactId,
    grantedByUserId: "user-licensee",
    permissions: ["view_documents", "upload_documents", "sign"],
    expiresAt: future,
  });
  await addShareableDocument(repository);
  await repository.createShareLink({
    id: "share-client-workspace",
    firmId,
    matterId,
    tokenHash: "private-share-token-hash",
    grantedByUserId: "user-licensee",
    permissions: ["view_documents"],
    requireEmailVerification: true,
    expiresAt: future,
    createdAt: now,
  });
  await repository.createExternalUploadLink({
    id: "external-upload-client-workspace",
    firmId,
    matterId,
    tokenHash: "private-upload-token-hash",
    idempotencyKey: "external-upload-client-workspace",
    requestedByUserId: "user-licensee",
    maxUploads: 2,
    usedUploads: 1,
    expiresAt: future,
    createdAt: now,
  });
  await repository.createDocumentUploadIntent({
    id: "doc-external-upload-review",
    firmId,
    matterId,
    title: "External upload private title.pdf",
    storageKey: "matters/matter-001/external-upload-private-title.pdf",
    checksumSha256: "9438d7e85ff34ec2b7fbbd56d024f3c5c297429dc77110a7bddaa2b53ad1b301",
    classification: "general",
    legalHold: false,
    externalUploadLinkId: "external-upload-client-workspace",
  });
  await repository.completeDocumentUpload({
    firmId,
    documentId: "doc-external-upload-review",
    checksumSha256: "9438d7e85ff34ec2b7fbbd56d024f3c5c297429dc77110a7bddaa2b53ad1b301",
    scanStatus: "passed",
  });
  await repository.createIntakeFormLink({
    id: "intake-link-client-workspace",
    firmId,
    matterId,
    intakeSessionId: "intake-session-001",
    tokenHash: "private-intake-token-hash",
    requestedByUserId: "user-licensee",
    clientContactId: contactId,
    draftAnswers: { privateField: "Synthetic private body" },
    draftUpdatedAt: now,
    expiresAt: future,
    createdAt: now,
  });
  await repository.upsertIntakeFormItemAction({
    id: "intake-action-client-workspace",
    firmId,
    matterId,
    intakeSessionId: "intake-session-001",
    formLinkId: "intake-link-client-workspace",
    itemId: "evidence-upload",
    kind: "upload",
    status: "intent_created",
    evidence: { storageKey: "private-intake-upload-key" },
    createdAt: now,
  });
  await repository.createCalendarMeetingSession({
    id: "meeting-session-client-workspace",
    firmId,
    matterId,
    eventId: "calendar-event-002",
    status: "waiting",
    createdAt: now,
    updatedAt: now,
    createdByUserId: "user-licensee",
    updatedByUserId: "user-licensee",
    metadata: { meetingUrl: "https://meet.example.test/private" },
  });
  await repository.createCalendarGuestLink({
    id: "guest-link-client-workspace",
    firmId,
    matterId,
    eventId: "calendar-event-002",
    sessionId: "meeting-session-client-workspace",
    tokenHash: "private-guest-token-hash",
    status: "waiting",
    expiresAt: future,
    createdAt: now,
    updatedAt: now,
    createdByUserId: "user-licensee",
    updatedByUserId: "user-licensee",
    metadata: { meetingUrl: "https://meet.example.test/private" },
  });
  await repository.createQueuedEmailOutbox({
    email: {
      id: "email-client-workspace",
      firmId,
      matterId,
      templateKey: "synthetic-client-receipt",
      status: "sent",
      to: ["ada@example.test"],
      cc: ["private-cc@example.test"],
      bcc: ["private-bcc@example.test"],
      from: "practice@example.test",
      subject: "Synthetic private subject",
      htmlBody: "<p>Synthetic private body</p>",
      textBody: "Synthetic private body",
      queuedAt: now,
      sentAt: now,
      attemptCount: 1,
      metadata: { privatePaymentNote: "Client portal private payment note" },
    },
    event: {
      id: "email-event-client-workspace",
      firmId,
      emailId: "email-client-workspace",
      eventType: "sent",
      occurredAt: now,
      source: "api",
      metadata: {},
    },
    job: {
      id: "job-client-workspace",
      firmId,
      queueName: "email",
      jobName: "send-email",
      status: "completed",
      targetResourceType: "email",
      targetResourceId: "email-client-workspace",
      attemptsMade: 1,
      maxAttempts: 3,
      queuedAt: now,
      finishedAt: now,
      metadata: {},
    },
  });
  await repository.createEmailReceiptToken({
    id: "receipt-client-workspace",
    firmId,
    matterId,
    emailId: "email-client-workspace",
    tokenHash: "private-receipt-token-hash",
    purpose: "delivery_receipt",
    expiresAt: future,
    createdAt: now,
    metadata: {},
  });
  await repository.createSignatureRequest({
    request: {
      id: "sig-client-workspace",
      firmId,
      matterId,
      documentId: "doc-client-visible",
      title: "Client signature packet",
      requestedByUserId: "user-licensee",
      provider: "embedded",
      externalId: "embedded:matter-001:doc-client-visible",
      status: "sent",
      consentText: "I consent to electronic signature.",
      evidence: {},
      createdAt: now,
    },
    signers: [
      {
        id: "sig-signer-client-workspace",
        firmId,
        signatureRequestId: "sig-client-workspace",
        name: "Ada Morgan",
        email: "ada@example.test",
        role: "client",
        status: "sent",
      },
    ],
    event: {
      id: "sig-event-client-workspace",
      firmId,
      signatureRequestId: "sig-client-workspace",
      provider: "embedded",
      externalId: "embedded:matter-001:doc-client-visible",
      status: "sent",
      occurredAt: now,
      evidence: {},
    },
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("client portal workspace routes", () => {
  it("creates and reuses a client login user plus an exact portal grant", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee"), secret: jwtSecret });
    const payload = {
      matterId,
      contactId,
      email: "ada@example.test",
      permissions: ["view_documents", "upload_documents", "sign"],
    };

    const created = await server.inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload,
    });
    const reused = await server.inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload,
    });
    const narrower = await server.inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId, contactId, email: "ada@example.test", permissions: ["view_documents"] },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      account: { contactId, email: "ada@example.test", role: "client_external", created: true },
      grant: {
        matterId,
        contactId,
        permissions: ["view_documents", "upload_documents", "sign"],
        created: true,
      },
      passwordSetup: { status: "issued", token: expect.any(String) },
      boundaries: { rawPortalTokensReturned: false, publicTokenRoutesPreserved: true },
    });
    expect(created.json().account).not.toHaveProperty("id");
    expect(reused.json()).toMatchObject({
      account: { created: false },
      grant: { created: false },
      passwordSetup: { status: "already_issued" },
    });
    expect(narrower.json()).toMatchObject({
      grant: { permissions: ["view_documents"], created: true },
    });
    await expect(repository.getUserByEmail(firmId, "ada@example.test")).resolves.toMatchObject({
      assignedMatterIds: [],
      role: "client_external",
    });
    await expect(repository.listAuditEvents(firmId)).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({ action: "portal.grant.created", resourceType: "portal_grant" }),
      ]),
    });
    expect(created.body).not.toContain("tokenHash");
  });

  it("rejects mismatched contact emails, adverse parties, and duplicate user emails", async () => {
    const mismatch = await testServer({
      repository: new InMemoryOpenPracticeRepository(),
      authUser: user("licensee"),
      secret: jwtSecret,
    }).inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId, contactId, email: "other@example.test" },
    });
    expect(mismatch.statusCode).toBe(400);

    const adverse = await testServer({
      repository: new InMemoryOpenPracticeRepository(),
      authUser: user("licensee"),
      secret: jwtSecret,
    }).inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId, contactId: "contact-river", email: "legal@rivercity.example" },
    });
    expect(adverse.statusCode).toBe(403);

    const repository = new InMemoryOpenPracticeRepository();
    await repository.createUser({
      id: "user-staff-ada-email",
      firmId,
      displayName: "Internal Ada",
      email: "ada@example.test",
      role: "firm_member",
      assignedMatterIds: [matterId],
      mfaEnabled: true,
    });
    const duplicate = await testServer({
      repository,
      authUser: user("licensee"),
      secret: jwtSecret,
    }).inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId, contactId, email: "ada@example.test" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: "PORTAL_EMAIL_ALREADY_ASSIGNED" });

    const crossFirmRepository = new InMemoryOpenPracticeRepository();
    await crossFirmRepository.createUser({
      id: "user-other-firm-client",
      firmId: "firm-other",
      displayName: "Other Firm Ada",
      email: "ada@example.test",
      role: "client_external",
      assignedMatterIds: [],
      mfaEnabled: false,
    });
    const crossFirmDuplicate = await testServer({
      repository: crossFirmRepository,
      authUser: user("licensee"),
      secret: jwtSecret,
    }).inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId, contactId, email: "ada@example.test" },
    });
    expect(crossFirmDuplicate.statusCode).toBe(409);
    expect(crossFirmDuplicate.json()).toMatchObject({ code: "PORTAL_EMAIL_ALREADY_ASSIGNED" });
  });

  it("projects a redacted contact-email workspace over existing records without read audit", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addWorkspaceRecords(repository);
    const before = await repository.listAuditEvents(firmId);
    const response = await testServer({ repository, authUser: user("client_external") }).inject({
      method: "GET",
      url: "/api/client-portal/workspace",
    });
    const after = await repository.listAuditEvents(firmId);

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.access).toMatchObject({
      status: "active",
      activeAccountCount: 1,
      activeGrantCount: 1,
      contactCount: 1,
      matchedBy: "contact_email",
      redacted: true,
    });
    expect(body.boundaries).toMatchObject({
      publicTokenRoutesPreserved: true,
      realtimeChat: "out_of_scope",
      broadDocumentBrowsing: "out_of_scope",
      livePayments: "out_of_scope",
      nativeMobile: "out_of_scope",
    });
    expect(body.matters[0]).toMatchObject({
      matterId,
      summaries: {
        secureShares: {
          activeLinkCount: 1,
          emailVerificationRequiredCount: 0,
          sharedDocumentCount: 1,
        },
        externalUploads: {
          activeLinkCount: 1,
          remainingUploadSlots: 1,
          reviewCounts: { pending_review: 1 },
        },
        intake: { activeLinkCount: 1, draftLinkCount: 1, itemActionCounts: { waiting: 1 } },
        guestSessions: { activeLinkCount: 1, statusCounts: { waiting: 1 } },
        receipts: { pendingCount: 1 },
        signatures: { pendingCount: 1, completedCount: 0 },
      },
    });
    expect(body.matters[0].clientActions.map((item: { kind: string }) => item.kind)).toEqual(
      expect.arrayContaining([
        "secure_share",
        "external_upload",
        "intake",
        "guest_session",
        "receipt",
        "signature",
      ]),
    );
    expect(after.events).toHaveLength(before.events.length);
    expect(response.body).not.toContain("tokenHash");
    expect(response.body).not.toContain("private-share-token-hash");
    expect(response.body).not.toContain("client-visible-synthetic.pdf");
    expect(response.body).not.toContain("Synthetic private body");
    expect(response.body).not.toContain("meetingUrl");
    expect(response.body).not.toContain("Client portal private payment note");
  });

  it("handles authenticated sessions, empty workspaces, and public token route preservation", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addWorkspaceRecords(repository);
    const sessionToken = await createClientSession(repository);
    const server = fullApiServer(repository);
    const workspace = await server.inject({
      method: "GET",
      url: "/api/client-portal/workspace",
      headers: { "x-open-practice-session": sessionToken },
    });
    expect(workspace.statusCode).toBe(200);
    expect(workspace.json()).toMatchObject({
      access: { status: "active", matchedBy: "contact_email" },
      account: { userId: clientUserId, role: "client_external" },
    });

    const noGrantUser = {
      ...user("client_external"),
      id: "user-client-no-grants",
      email: "nogrants@example.test",
    };
    const noGrantRepository = new InMemoryOpenPracticeRepository();
    await noGrantRepository.createUser(noGrantUser);
    const empty = await testServer({ repository: noGrantRepository, authUser: noGrantUser }).inject(
      {
        method: "GET",
        url: "/api/client-portal/workspace",
      },
    );
    expect(empty.json()).toMatchObject({
      access: { status: "no_active_grants", matchedBy: "contact_email", activeGrantCount: 0 },
      matters: [],
    });

    const shareToken = "public-share-token-12345678901234567890";
    const uploadToken = "public-upload-token-12345678901234567890";
    await repository.createShareLink({
      id: "share-public-workspace-regression",
      firmId,
      matterId,
      tokenHash: hashToken(shareToken, jwtSecret),
      grantedByUserId: "user-licensee",
      permissions: ["view_documents"],
      requireEmailVerification: false,
      expiresAt: future,
      createdAt: now,
    });
    await repository.createExternalUploadLink({
      id: "external-upload-public-workspace-regression",
      firmId,
      matterId,
      tokenHash: hashToken(uploadToken, jwtSecret),
      idempotencyKey: "external-upload-public-workspace-regression",
      requestedByUserId: "user-licensee",
      maxUploads: 1,
      usedUploads: 0,
      expiresAt: future,
      createdAt: now,
    });
    expect(
      (await server.inject({ method: "GET", url: "/api/portal/shares/" + shareToken })).statusCode,
    ).toBe(200);
    expect(
      (await server.inject({ method: "GET", url: "/api/portal/external-uploads/" + uploadToken }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await fullApiServer(new InMemoryOpenPracticeRepository()).inject({
          method: "GET",
          url: "/api/client-portal/workspace",
        })
      ).statusCode,
    ).toBe(401);
  });

  it("denies staff workspace reads and keeps client sessions out of staff matter lists", async () => {
    const staffWorkspace = await testServer({
      repository: new InMemoryOpenPracticeRepository(),
      authUser: user("licensee"),
    }).inject({ method: "GET", url: "/api/client-portal/workspace" });
    expect(staffWorkspace.statusCode).toBe(403);

    const repository = new InMemoryOpenPracticeRepository();
    await addWorkspaceRecords(repository);
    const sessionToken = await createClientSession(repository);
    const matters = await fullApiServer(repository).inject({
      method: "GET",
      url: "/api/matters",
      headers: { "x-open-practice-session": sessionToken },
    });
    expect(matters.statusCode).toBe(200);
    expect(matters.json()).toEqual([]);
    expect(matters.body).not.toContain(matterId);
  });
});
