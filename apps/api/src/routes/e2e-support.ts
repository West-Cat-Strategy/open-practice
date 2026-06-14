import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";

const shareableDocumentBodySchema = z.object({
  matterId: z.string().min(1).default("matter-001"),
  title: z.string().min(1).default("Synthetic shareable disclosure.pdf"),
});

const shareVerificationCodeQuerySchema = z.object({
  matterId: z.string().min(1).default("matter-001"),
  token: z.string().min(1),
});

const clientPortalAccountBodySchema = z.object({
  matterId: z.string().min(1).default("matter-001"),
  contactId: z.string().min(1).default("contact-ada"),
  userId: z.string().min(1).default("user-client-external"),
});

const defaultPortalPermissions = ["view_documents", "upload_documents", "message", "sign"] as const;
const clientPortalDocumentChecksum =
  "cb77d67f2ec9bf447a4e8e6a2a6c93fcb7b60e6a7773bc5f3703f8a7e8a1884f";
const clientPortalGrantableDocumentChecksum =
  "a4cf9af447ac73a1f99c876bb5bd8f6b762b8cdab3b1f9e822c5416c8200f255";

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function contactEmail(contact: { identifiers?: Array<{ type: string; value: string }> }): string {
  const email = contact.identifiers?.find((identifier) => identifier.type === "email")?.value;
  if (!email) throw new ApiHttpError(409, "E2E_CLIENT_EMAIL_REQUIRED", "E2E contact needs email");
  return email.trim().toLowerCase();
}

export function registerE2ESupportRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
  server.post("/api/e2e/shareable-document", async (request, reply) => {
    const body = parseRequestPart(shareableDocumentBodySchema, request.body, "body");
    const access = requireAccess(request.auth, {
      resource: "document",
      action: "create",
      matterId: body.matterId,
    });
    if (!access.ok) throw access.error;

    const documentId = crypto.randomUUID();
    const checksumSha256 = "b8f3bcb433c2666c1f9f72d8c9f6f2bf792ee18f746375a42dbf17447275d4b2";
    const document = await repository.createDocumentUploadIntent({
      id: documentId,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      title: body.title,
      storageKey: `e2e/${body.matterId}/${documentId}-${sanitizeFilename(body.title)}`,
      checksumSha256,
      classification: "general",
      legalHold: false,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "document.upload_intent.created",
      resourceType: "document",
      resourceId: document.id,
      metadata: {
        matterId: document.matterId,
        documentId: document.id,
        status: document.uploadStatus,
        source: "e2e_support",
      },
    });

    const completed = await repository.completeDocumentUpload({
      firmId: request.auth.firmId,
      documentId: document.id,
      checksumSha256,
      scanStatus: "passed",
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "document.upload.completed",
      resourceType: "document",
      resourceId: completed.id,
      metadata: {
        matterId: completed.matterId,
        documentId: completed.id,
        status: completed.uploadStatus,
        checksumStatus: completed.checksumStatus,
        scanStatus: completed.scanStatus,
        source: "e2e_support",
      },
    });

    reply.code(201);
    return {
      document: {
        id: completed.id,
        matterId: completed.matterId,
        title: completed.title,
        classification: completed.classification,
        uploadStatus: completed.uploadStatus,
        checksumStatus: completed.checksumStatus,
        scanStatus: completed.scanStatus,
      },
    };
  });

  server.get("/api/e2e/share-verification-code", async (request) => {
    const query = parseRequestPart(shareVerificationCodeQuerySchema, request.query, "query");
    const access = requireAccess(request.auth, {
      resource: "email",
      action: "read",
      matterId: query.matterId,
    });
    if (!access.ok) throw access.error;

    const emails = await repository.listEmailOutbox(request.auth.firmId, {
      matterId: query.matterId,
      limit: 25,
    });
    const email = emails.find((candidate) =>
      candidate.textBody.includes(`Share token: ${query.token}`),
    );
    const code = email?.textBody.match(/^Email verification code:\s*([A-Z0-9]+)$/m)?.[1];
    if (!code) {
      throw new ApiHttpError(
        404,
        "E2E_SHARE_VERIFICATION_CODE_NOT_FOUND",
        "E2E share verification code was not found",
      );
    }
    return { verificationCode: code };
  });

  server.post("/api/e2e/client-portal-account", async (request, reply) => {
    const body = parseRequestPart(clientPortalAccountBodySchema, request.body, "body");
    const credentialAccess = requireAccess(request.auth, {
      resource: "auth_credential",
      action: "create",
    });
    if (!credentialAccess.ok) throw credentialAccess.error;

    const matterAccess = requireAccess(request.auth, {
      resource: "matter",
      action: "read",
      matterId: body.matterId,
    });
    if (!matterAccess.ok) throw matterAccess.error;

    const contact = await repository.getContact(request.auth.firmId, body.contactId);
    const matter = (await repository.listMattersForUser(request.auth.user)).find(
      (candidate) => candidate.id === body.matterId,
    );
    const party = matter?.parties.find((candidate) => candidate.contactId === body.contactId);
    if (!contact || !matter || !party) {
      throw new ApiHttpError(
        404,
        "E2E_CLIENT_CONTACT_NOT_FOUND",
        "E2E client contact was not found on this matter",
      );
    }
    if (party.adverse) {
      throw new ApiHttpError(
        409,
        "E2E_CLIENT_CONTACT_ADVERSE",
        "E2E adverse contacts cannot be issued client portal accounts",
      );
    }

    const email = contactEmail(contact);
    const existingById = await repository.getUser(request.auth.firmId, body.userId);
    const existingByEmail = await repository.getUserByEmail(request.auth.firmId, email);
    const account = existingById ?? existingByEmail;
    if (account && account.role !== "client_external") {
      throw new ApiHttpError(
        409,
        "E2E_CLIENT_EMAIL_IN_USE",
        "E2E client email already belongs to a non-client account",
      );
    }
    const user =
      account ??
      (await repository.createUser({
        id: body.userId,
        firmId: request.auth.firmId,
        displayName: contact.displayName,
        email,
        role: "client_external",
        assignedMatterIds: [],
        mfaEnabled: false,
      }));

    const now = new Date().toISOString();
    const existingGrant = (await repository.listPortalGrants(request.auth.firmId)).find(
      (grant) =>
        grant.matterId === body.matterId &&
        grant.contactId === body.contactId &&
        grant.accountUserId === user.id &&
        !grant.revokedAt &&
        (!grant.expiresAt || Date.parse(grant.expiresAt) > Date.parse(now)) &&
        defaultPortalPermissions.every((permission) => grant.permissions.includes(permission)),
    );
    const grant =
      existingGrant ??
      (await repository.createPortalGrant({
        id: `portal-grant-e2e-${body.userId}`,
        firmId: request.auth.firmId,
        matterId: body.matterId,
        contactId: body.contactId,
        accountUserId: user.id,
        grantedByUserId: request.auth.user.id,
        permissions: [...defaultPortalPermissions],
      }));

    async function ensureClientPortalDocument(
      documentId: string,
      documentTitle: string,
      checksumSha256: string,
    ) {
      const existingDocument = await repository.getDocument(request.auth.firmId, documentId);
      return (
        existingDocument ??
        (await repository
          .createDocumentUploadIntent({
            id: documentId,
            firmId: request.auth.firmId,
            matterId: body.matterId,
            title: documentTitle,
            storageKey: `e2e/${body.matterId}/${documentId}-${sanitizeFilename(documentTitle)}`,
            checksumSha256,
            classification: "general",
            legalHold: false,
          })
          .then((created) =>
            repository.completeDocumentUpload({
              firmId: request.auth.firmId,
              documentId: created.id,
              checksumSha256,
              scanStatus: "passed",
            }),
          ))
      );
    }

    const documentId = `doc-e2e-client-portal-${body.matterId}`;
    const documentTitle = "Client portal E2E disclosure.pdf";
    const document = await ensureClientPortalDocument(
      documentId,
      documentTitle,
      clientPortalDocumentChecksum,
    );
    const staffGrantableDocumentId = `doc-e2e-client-portal-grantable-${body.matterId}`;
    const staffGrantableDocument = await ensureClientPortalDocument(
      staffGrantableDocumentId,
      "Client portal E2E staff grant.pdf",
      clientPortalGrantableDocumentChecksum,
    );
    if (!document) {
      throw new Error("Unable to create client portal E2E document fixture");
    }
    if (!staffGrantableDocument) {
      throw new Error("Unable to create client portal E2E staff document fixture");
    }
    const existingDocumentAccess = (
      await repository.listPortalDocumentAccess(request.auth.firmId, {
        matterId: body.matterId,
        documentId: document.id,
        portalGrantId: grant.id,
      })
    ).find((access) => !access.revokedAt);
    const documentAccess =
      existingDocumentAccess ??
      (await repository.createPortalDocumentAccess({
        id: `portal-document-access-e2e-${body.userId}`,
        firmId: request.auth.firmId,
        matterId: body.matterId,
        documentId: document.id,
        portalGrantId: grant.id,
        permission: "view_document",
        grantedByUserId: request.auth.user.id,
        createdAt: now,
      }));

    const signatureFixtures = [
      {
        id: `signature-e2e-client-portal-${body.matterId}`,
        title: "Client portal E2E signature",
        externalSuffix: "client-portal-signature",
        signerId: `signature-signer-e2e-client-portal-${body.userId}`,
        eventId: `signature-event-e2e-client-portal-${body.matterId}`,
      },
      {
        id: `signature-e2e-client-portal-viewed-${body.matterId}`,
        title: "Client portal E2E view acknowledgement",
        externalSuffix: "client-portal-signature-viewed",
        signerId: `signature-signer-e2e-client-portal-viewed-${body.userId}`,
        eventId: `signature-event-e2e-client-portal-viewed-${body.matterId}`,
      },
      {
        id: `signature-e2e-client-portal-declined-${body.matterId}`,
        title: "Client portal E2E decline option",
        externalSuffix: "client-portal-signature-declined",
        signerId: `signature-signer-e2e-client-portal-declined-${body.userId}`,
        eventId: `signature-event-e2e-client-portal-declined-${body.matterId}`,
      },
    ] as const;
    const existingSignatureIds = new Set(
      (await repository.listSignatureRequests(request.auth.firmId)).map((request) => request.id),
    );
    for (const signatureFixture of signatureFixtures) {
      if (existingSignatureIds.has(signatureFixture.id)) continue;
      await repository.createSignatureRequest({
        request: {
          id: signatureFixture.id,
          firmId: request.auth.firmId,
          matterId: body.matterId,
          documentId: document.id,
          title: signatureFixture.title,
          requestedByUserId: request.auth.user.id,
          provider: "embedded",
          externalId: `embedded:e2e:${body.matterId}:${signatureFixture.externalSuffix}`,
          status: "sent",
          consentText: "Synthetic E2E portal signature consent.",
          evidence: { source: "e2e_support" },
          createdAt: now,
        },
        signers: [
          {
            id: signatureFixture.signerId,
            firmId: request.auth.firmId,
            signatureRequestId: signatureFixture.id,
            name: contact.displayName,
            email,
            role: "client",
            status: "sent",
          },
        ],
        event: {
          id: signatureFixture.eventId,
          firmId: request.auth.firmId,
          signatureRequestId: signatureFixture.id,
          provider: "embedded",
          externalId: `embedded:e2e:${body.matterId}:${signatureFixture.externalSuffix}`,
          status: "sent",
          occurredAt: now,
          evidence: { source: "e2e_support" },
        },
      });
    }
    const signatureRequestId = signatureFixtures[0].id;

    const conversationThreadId = `conversation-thread-e2e-${body.matterId}`;
    const existingThread = await repository.getConversationThread(
      request.auth.firmId,
      conversationThreadId,
    );
    if (!existingThread) {
      await repository.createConversationThread({
        id: conversationThreadId,
        firmId: request.auth.firmId,
        matterId: body.matterId,
        topic: "Synthetic client portal thread",
        status: "open",
        exportState: "not_requested",
        notificationBoundary: "disabled",
        createdAt: now,
        updatedAt: now,
        createdByUserId: request.auth.user.id,
        updatedByUserId: request.auth.user.id,
        metadata: { source: "e2e_support" },
      });
    }

    await appendRouteAuditEvent(repository, request.auth, {
      action: "portal.account_setup.created",
      resourceType: "portal_grant",
      resourceId: grant.id,
      metadata: {
        matterId: body.matterId,
        contactId: body.contactId,
        clientUserId: user.id,
        source: "e2e_support",
      },
    });

    reply.code(account && existingGrant ? 200 : 201);
    return {
      account: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      grant: {
        id: grant.id,
        status: "active",
        permissions: grant.permissions,
      },
      fixtures: {
        documentId: document.id,
        staffGrantableDocumentId: staffGrantableDocument.id,
        portalDocumentAccessId: documentAccess.id,
        signatureRequestId,
        signatureRequestIds: signatureFixtures.map((signatureFixture) => signatureFixture.id),
      },
    };
  });
}
