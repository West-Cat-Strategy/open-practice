import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type {
  EmailEventRecord,
  EmailOutboxRecord,
  JobLifecycleRecord,
} from "@open-practice/domain";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { hashToken } from "../http/auth-helpers.js";
import { registerClientPortalRoutes } from "./client-portal.js";

const jwtSecret = "client-portal-test-secret-at-least-32-chars";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  const idByRole: Partial<Record<ProfessionalRole, string>> = {
    owner_admin: "user-admin",
    licensee: "user-licensee",
    firm_member: "user-staff",
    client_external: "client-ada",
  };
  return {
    id: idByRole[role] ?? `user-${role}`,
    firmId: "firm-west-legal",
    displayName: `Test ${role}`,
    email: role === "client_external" ? "ada@example.test" : `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: false,
  };
}

function testServer(input: {
  repository: InMemoryOpenPracticeRepository;
  authUser?: User;
  jwtSecret?: string;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  const authUser = input.authUser ?? user("owner_admin", ["matter-001", "matter-002"]);
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerClientPortalRoutes(server, {
    repository: input.repository,
    jwtSecret: input.jwtSecret ?? jwtSecret,
  });
  servers.push(server);
  return server;
}

async function addClientPortalRecords(repository: InMemoryOpenPracticeRepository): Promise<void> {
  await repository.createShareLink({
    id: "share-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    tokenHash: "secret-share-token-hash",
    grantedByUserId: "user-admin",
    permissions: ["view_documents"],
    requireEmailVerification: true,
    expiresAt: "2026-07-01T00:00:00.000Z",
    createdAt: "2026-05-20T12:00:00.000Z",
  });

  await repository.createExternalUploadLink({
    id: "external-upload-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    tokenHash: "secret-upload-token-hash",
    requestedByUserId: "user-admin",
    expiresAt: "2026-07-01T00:00:00.000Z",
    maxUploads: 2,
    usedUploads: 1,
    createdAt: "2026-05-20T13:00:00.000Z",
  });
  await repository.createDocumentUploadIntent({
    id: "doc-external-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    title: "Client upload.pdf",
    storageKey: "external-uploads/external-upload-client-001/client-upload.pdf",
    checksumSha256: "c".repeat(64),
    classification: "general",
    legalHold: false,
    externalUploadLinkId: "external-upload-client-001",
  });
  await repository.completeDocumentUpload({
    firmId: "firm-west-legal",
    documentId: "doc-external-client-001",
    checksumSha256: "c".repeat(64),
    scanStatus: "passed",
  });
  await repository.reviewUploadedDocument({
    firmId: "firm-west-legal",
    documentId: "doc-external-client-001",
    status: "retry_requested",
    decision: "request_retry",
    reason: "unreadable",
    metadata: { privateReviewNote: "do not expose" },
    reviewedByUserId: "user-admin",
    reviewedAt: "2026-05-21T10:00:00.000Z",
  });

  await repository.createIntakeFormLink({
    id: "intake-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    intakeSessionId: "intake-session-001",
    tokenHash: "secret-intake-token-hash",
    requestedByUserId: "user-admin",
    clientContactId: "contact-ada",
    expiresAt: "2026-06-02T00:00:00.000Z",
    createdAt: "2026-05-20T14:00:00.000Z",
  });
  await repository.upsertIntakeFormItemAction({
    id: "intake-action-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    intakeSessionId: "intake-session-001",
    formLinkId: "intake-client-001",
    itemId: "evidence-upload",
    kind: "upload",
    status: "intent_created",
    evidence: { storageKey: "private-intake-storage-key" },
    createdAt: "2026-05-20T14:05:00.000Z",
  });

  await repository.createCalendarMeetingSession({
    id: "meeting-session-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    eventId: "calendar-event-002",
    status: "lobby_open",
    retentionUntil: "2026-06-05T00:00:00.000Z",
    createdAt: "2026-05-20T14:55:00.000Z",
    updatedAt: "2026-05-20T14:55:00.000Z",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    metadata: {},
  });

  await repository.createCalendarGuestLink({
    id: "guest-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    eventId: "calendar-event-002",
    sessionId: "meeting-session-001",
    tokenHash: "secret-guest-token-hash",
    status: "issued",
    expiresAt: "2026-06-03T00:00:00.000Z",
    createdAt: "2026-05-20T15:00:00.000Z",
    updatedAt: "2026-05-20T15:00:00.000Z",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    metadata: { providerRoomId: "private-room-id" },
  });

  const email: EmailOutboxRecord = {
    id: "email-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    templateKey: "client.update",
    status: "sent",
    to: ["ada@example.test"],
    cc: [],
    bcc: [],
    from: "office@example.test",
    subject: "Synthetic update",
    htmlBody: "<p>PRIVATE HTML BODY</p>",
    textBody: "PRIVATE TEXT BODY",
    queuedAt: "2026-05-20T16:00:00.000Z",
    sentAt: "2026-05-20T16:02:00.000Z",
    attemptCount: 1,
    metadata: { privateMetadata: "do not expose" },
  };
  const event: EmailEventRecord = {
    id: "email-event-client-001",
    firmId: "firm-west-legal",
    emailId: email.id,
    eventType: "sent",
    occurredAt: "2026-05-20T16:02:00.000Z",
    source: "api",
    metadata: {},
  };
  const job: JobLifecycleRecord = {
    id: "job-email-client-001",
    firmId: "firm-west-legal",
    queueName: "email",
    jobName: "send_email",
    status: "completed",
    targetResourceType: "email_outbox",
    targetResourceId: email.id,
    attemptsMade: 1,
    maxAttempts: 3,
    queuedAt: "2026-05-20T16:00:00.000Z",
    finishedAt: "2026-05-20T16:02:00.000Z",
    metadata: { emailId: email.id },
  };
  await repository.createQueuedEmailOutbox({ email, event, job });
  const otherClientEmail: EmailOutboxRecord = {
    ...email,
    id: "email-client-other-001",
    to: ["other-client@example.test"],
    subject: "Other synthetic update",
    queuedAt: "2026-05-20T16:05:00.000Z",
    sentAt: "2026-05-20T16:06:00.000Z",
  };
  await repository.createQueuedEmailOutbox({
    email: otherClientEmail,
    event: {
      ...event,
      id: "email-event-client-other-001",
      emailId: otherClientEmail.id,
      occurredAt: "2026-05-20T16:06:00.000Z",
    },
    job: {
      ...job,
      id: "job-email-client-other-001",
      targetResourceId: otherClientEmail.id,
      finishedAt: "2026-05-20T16:06:00.000Z",
      metadata: { emailId: otherClientEmail.id },
    },
  });
  await repository.createEmailReceiptToken({
    id: "receipt-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    emailId: email.id,
    tokenHash: "secret-receipt-token-hash",
    purpose: "delivery_receipt",
    expiresAt: "2026-06-04T00:00:00.000Z",
    createdAt: "2026-05-20T16:01:00.000Z",
    metadata: { privateReceiptMetadata: "do not expose" },
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("client portal routes", () => {
  it("lets staff set up a client account without exposing credential hashes", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const response = await server.inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId: "matter-001", contactId: "contact-ada" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<{
      account: { id: string; email: string; role: string };
      grant: { status: string; permissions: string[] };
      setup: { status: string; token?: string; expiresAt?: string; userId: string };
    }>();
    expect(body.account).toMatchObject({
      email: "ada@example.test",
      role: "client_external",
    });
    expect(body.grant).toMatchObject({
      status: "active",
      permissions: ["view_documents", "upload_documents", "message", "sign"],
    });
    expect(body.setup.status).toBe("token_created");
    expect(body.setup.token).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("tokenHash");

    const token = await repository.consumePasswordSetupToken(
      hashToken(body.setup.token!, jwtSecret),
      "2026-05-28T12:00:00.000Z",
    );
    expect(token?.userId).toBe(body.account.id);
    const audit = await repository.listAuditEvents("firm-west-legal");
    expect(audit.events.at(-1)).toMatchObject({
      action: "portal.account_setup.created",
      resourceType: "portal_grant",
      metadata: expect.objectContaining({
        matterId: "matter-001",
        contactId: "contact-ada",
        setupTokenStatus: "token_created",
      }),
    });
    expect(JSON.stringify(audit.events.at(-1))).not.toContain("ada@example.test");
    expect(JSON.stringify(audit.events.at(-1))).not.toContain(body.setup.token);
  });

  it("returns a redacted logged-in workspace over existing client action records", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const setupServer = testServer({ repository });
    const setup = await setupServer.inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId: "matter-001", contactId: "contact-ada" },
    });
    const setupBody = setup.json<{ account: { email: string } }>();
    const clientAccount = await repository.getUserByEmail(
      "firm-west-legal",
      setupBody.account.email,
    );
    expect(clientAccount).toBeTruthy();
    await addClientPortalRecords(repository);

    const server = testServer({ repository, authUser: clientAccount! });
    const response = await server.inject({
      method: "GET",
      url: "/api/client-portal/workspace",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      account: { role: string };
      access: { posture: string; activeGrantCount: number };
      matters: Array<{ number: string; actionCount: number }>;
      actions: Array<{ id: string; family: string; status: string; detail: string }>;
    }>();
    expect(body.account.role).toBe("client_external");
    expect(body.access).toMatchObject({ posture: "active", activeGrantCount: 1 });
    expect(body.matters).toEqual([
      expect.objectContaining({ number: "2026-0001", actionCount: expect.any(Number) }),
    ]);
    expect(body.actions.map((action) => action.family)).toEqual(
      expect.arrayContaining([
        "secure_share",
        "external_upload",
        "intake",
        "guest_session",
        "receipt",
        "client_update",
        "client_action",
      ]),
    );
    expect(body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: "secure_share", status: "verification_required" }),
        expect.objectContaining({ family: "external_upload", status: "active" }),
        expect.objectContaining({ family: "client_action", status: "retry_requested" }),
        expect.objectContaining({ family: "client_update", status: "sent" }),
        expect.objectContaining({ family: "receipt", status: "open" }),
      ]),
    );
    expect(
      body.actions.filter((action) => action.family === "client_update").map((action) => action.id),
    ).toEqual(["client-update:email-client-001"]);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("secret-share-token-hash");
    expect(serialized).not.toContain("secret-upload-token-hash");
    expect(serialized).not.toContain("secret-intake-token-hash");
    expect(serialized).not.toContain("secret-guest-token-hash");
    expect(serialized).not.toContain("secret-receipt-token-hash");
    expect(serialized).not.toContain("PRIVATE HTML BODY");
    expect(serialized).not.toContain("PRIVATE TEXT BODY");
    expect(serialized).not.toContain("Synthetic update");
    expect(serialized).not.toContain("Other synthetic update");
    expect(serialized).not.toContain("office@example.test");
    expect(serialized).not.toContain("private-intake-storage-key");
    expect(serialized).not.toContain("private-room-id");
  });

  it("rejects non-client users from the client workspace", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee") });

    const response = await server.inject({
      method: "GET",
      url: "/api/client-portal/workspace",
    });

    expect(response.statusCode).toBe(403);
  });
});
