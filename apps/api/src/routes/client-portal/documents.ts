import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type {
  DocumentRecord,
  PortalDocumentAccess,
  PortalGrant,
  User,
} from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  activePortalGrant,
  clientContactGrantPairs,
  portalDocumentAccessVisible,
  portalGrantVisibleOnMatter,
} from "./shared.js";

const documentAccessQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  contactId: z.string().min(1).optional(),
});

const documentAccessBodySchema = z.object({
  matterId: z.string().min(1),
  contactId: z.string().min(1),
  documentId: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export interface ClientPortalDocumentSummary {
  id: string;
  matterId: string;
  title: string;
  classification: DocumentRecord["classification"];
  version: number;
  uploadedAt?: string;
  verifiedAt?: string;
  accessId: string;
  accessStatus: "active";
  expiresAt?: string;
}

function userAgentFromRequest(request: FastifyRequest): string | undefined {
  const userAgent = request.headers["user-agent"];
  return Array.isArray(userAgent) ? userAgent.join(", ") : userAgent;
}

function documentSummary(
  document: DocumentRecord,
  access: PortalDocumentAccess,
): ClientPortalDocumentSummary {
  return {
    id: document.id,
    matterId: document.matterId,
    title: document.title,
    classification: document.classification,
    version: document.version,
    uploadedAt: document.uploadedAt,
    verifiedAt: document.verifiedAt,
    accessId: access.id,
    accessStatus: "active",
    expiresAt: access.expiresAt,
  };
}

async function visibleMatterGrants(input: {
  repository: ApiRouteDependencies["repository"];
  user: User;
  matterId: string;
  now: string;
}): Promise<PortalGrant[]> {
  const grantPairs = await clientContactGrantPairs(input.repository, input.user, input.now);
  const matter = (
    await input.repository.listMattersForUser({
      ...input.user,
      assignedMatterIds: [input.matterId],
    })
  ).find((candidate) => candidate.id === input.matterId);
  if (!matter) return [];
  return grantPairs
    .map((pair) => pair.grant)
    .filter((grant) => grant.matterId === input.matterId)
    .filter((grant) => portalGrantVisibleOnMatter(grant, matter));
}

export async function getClientVisiblePortalDocument(input: {
  repository: ApiRouteDependencies["repository"];
  user: User;
  documentId: string;
  now: string;
}): Promise<
  | { document: DocumentRecord; access: PortalDocumentAccess; summary: ClientPortalDocumentSummary }
  | undefined
> {
  const document = await input.repository.getDocument(input.user.firmId, input.documentId);
  if (!document) return undefined;
  const matterGrants = await visibleMatterGrants({
    repository: input.repository,
    user: input.user,
    matterId: document.matterId,
    now: input.now,
  });
  const grantsById = new Map(matterGrants.map((grant) => [grant.id, grant]));
  const accessRows = await input.repository.listPortalDocumentAccess(input.user.firmId, {
    matterId: document.matterId,
    documentId: document.id,
  });
  const access = accessRows.find((candidate) => {
    const grant = grantsById.get(candidate.portalGrantId);
    return grant
      ? portalDocumentAccessVisible({ access: candidate, document, grant, now: input.now })
      : false;
  });
  if (!access) return undefined;
  return { document, access, summary: documentSummary(document, access) };
}

function sanitizePortalDocumentAccess(access: PortalDocumentAccess) {
  return {
    id: access.id,
    firmId: access.firmId,
    matterId: access.matterId,
    documentId: access.documentId,
    portalGrantId: access.portalGrantId,
    permission: access.permission,
    grantedByUserId: access.grantedByUserId,
    createdAt: access.createdAt,
    expiresAt: access.expiresAt,
    revokedAt: access.revokedAt,
  };
}

export function registerClientPortalDocumentRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
  server.get("/api/client-portal/document-access", async (request) => {
    const access = requireAccess(request.auth, { resource: "client_portal", action: "read" });
    if (!access.ok) throw access.error;
    const query = parseRequestPart(documentAccessQuerySchema, request.query, "query");
    if (query.matterId) {
      const matterAccess = requireAccess(request.auth, {
        resource: "matter",
        action: "read",
        matterId: query.matterId,
      });
      if (!matterAccess.ok) throw matterAccess.error;
    }
    const readableMatterIds = new Set(
      (await repository.listMattersForUser(request.auth.user)).map((matter) => matter.id),
    );
    const rows = (
      await repository.listPortalDocumentAccess(request.auth.firmId, {
        matterId: query.matterId,
      })
    ).filter((row) => readableMatterIds.has(row.matterId));
    if (!query.contactId) {
      return { access: rows.map(sanitizePortalDocumentAccess) };
    }
    const grants = (await repository.listPortalGrants(request.auth.firmId)).filter(
      (grant) => grant.contactId === query.contactId,
    );
    const grantIds = new Set(grants.map((grant) => grant.id));
    return {
      access: rows
        .filter((row) => grantIds.has(row.portalGrantId))
        .map(sanitizePortalDocumentAccess),
    };
  });

  server.post("/api/client-portal/document-access", async (request, reply) => {
    const access = requireAccess(request.auth, { resource: "client_portal", action: "update" });
    if (!access.ok) throw access.error;
    const body = parseRequestPart(documentAccessBodySchema, request.body, "body");
    const now = new Date().toISOString();
    if (body.expiresAt && Date.parse(body.expiresAt) <= Date.parse(now)) {
      throw new ApiHttpError(
        400,
        "PORTAL_DOCUMENT_ACCESS_EXPIRY_INVALID",
        "Portal document access expiry must be in the future",
      );
    }
    const matterAccess = requireAccess(request.auth, {
      resource: "matter",
      action: "read",
      matterId: body.matterId,
    });
    if (!matterAccess.ok) throw matterAccess.error;
    const documentAccess = requireAccess(request.auth, {
      resource: "document",
      action: "read",
      matterId: body.matterId,
    });
    if (!documentAccess.ok) throw documentAccess.error;
    const [document, matter] = await Promise.all([
      repository.getDocument(request.auth.firmId, body.documentId),
      repository
        .listMattersForUser(request.auth.user)
        .then((matters) => matters.find((candidate) => candidate.id === body.matterId)),
    ]);
    if (!document || document.matterId !== body.matterId) {
      throw new ApiHttpError(404, "DOCUMENT_NOT_FOUND", "Document was not found");
    }
    const party = matter?.parties.find((candidate) => candidate.contactId === body.contactId);
    if (!party || party.adverse) {
      throw new ApiHttpError(
        409,
        "PORTAL_DOCUMENT_CONTACT_NOT_ELIGIBLE",
        "Client contact is not eligible for portal document access",
      );
    }
    const eligibleGrants = (await repository.listPortalGrants(request.auth.firmId)).filter(
      (candidate) =>
        candidate.matterId === body.matterId &&
        candidate.contactId === body.contactId &&
        activePortalGrant(candidate, now) &&
        candidate.permissions.includes("view_documents"),
    );
    const grant = eligibleGrants.find((candidate) => candidate.accountUserId) ?? eligibleGrants[0];
    if (!grant) {
      throw new ApiHttpError(
        409,
        "PORTAL_DOCUMENT_GRANT_REQUIRED",
        "Active document-view portal grant required before granting file access",
      );
    }
    if (party.confidential && !grant.accountUserId) {
      throw new ApiHttpError(
        409,
        "PORTAL_DOCUMENT_ACCOUNT_GRANT_REQUIRED",
        "Client portal account setup required before granting confidential client file access",
      );
    }
    if (
      !portalDocumentAccessVisible({
        access: {
          id: "preview",
          firmId: request.auth.firmId,
          matterId: body.matterId,
          documentId: body.documentId,
          portalGrantId: grant.id,
          permission: "view_document",
          grantedByUserId: request.auth.user.id,
          createdAt: now,
          expiresAt: body.expiresAt,
        },
        document,
        grant,
        now,
      })
    ) {
      throw new ApiHttpError(
        422,
        "PORTAL_DOCUMENT_NOT_SHAREABLE",
        "Document is not eligible for client portal file access",
      );
    }
    const created = await repository.createPortalDocumentAccess({
      id: `portal-document-access-${crypto.randomUUID()}`,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      documentId: body.documentId,
      portalGrantId: grant.id,
      permission: "view_document",
      grantedByUserId: request.auth.user.id,
      createdAt: now,
      expiresAt: body.expiresAt,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "portal.document_access.granted",
      resourceType: "portal_document_access",
      resourceId: created.id,
      occurredAt: created.createdAt,
      metadata: {
        matterId: created.matterId,
        documentId: created.documentId,
        portalGrantId: created.portalGrantId,
        contactId: body.contactId,
        expiresAt: created.expiresAt,
      },
    });
    reply.code(201);
    return { access: sanitizePortalDocumentAccess(created) };
  });

  server.post("/api/client-portal/document-access/:id/revoke", async (request) => {
    const access = requireAccess(request.auth, { resource: "client_portal", action: "update" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const existing = (await repository.listPortalDocumentAccess(request.auth.firmId)).find(
      (candidate) => candidate.id === params.id,
    );
    if (!existing) {
      throw new ApiHttpError(
        404,
        "PORTAL_DOCUMENT_ACCESS_NOT_FOUND",
        "Portal document access was not found",
      );
    }
    const matterAccess = requireAccess(request.auth, {
      resource: "matter",
      action: "read",
      matterId: existing.matterId,
    });
    if (!matterAccess.ok) throw matterAccess.error;
    const revokedAt = new Date().toISOString();
    const revoked = await repository.revokePortalDocumentAccess({
      firmId: request.auth.firmId,
      id: params.id,
      revokedAt,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "portal.document_access.revoked",
      resourceType: "portal_document_access",
      resourceId: params.id,
      occurredAt: revokedAt,
      metadata: {
        matterId: existing.matterId,
        documentId: existing.documentId,
        portalGrantId: existing.portalGrantId,
      },
    });
    return { access: revoked ? sanitizePortalDocumentAccess(revoked) : undefined };
  });

  server.get("/api/client-portal/documents/:id", async (request) => {
    if (request.auth.user.role !== "client_external") {
      throw new ApiHttpError(
        403,
        "CLIENT_PORTAL_ACCOUNT_REQUIRED",
        "Client portal account required",
      );
    }
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const now = new Date().toISOString();
    const visible = await getClientVisiblePortalDocument({
      repository,
      user: request.auth.user,
      documentId: params.id,
      now,
    });
    if (!visible) {
      throw new ApiHttpError(404, "PORTAL_DOCUMENT_NOT_FOUND", "Document was not found");
    }
    await repository.createAccessLog({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      resourceType: "document",
      resourceId: visible.document.id,
      action: "view",
      occurredAt: now,
      ipAddress: request.ip,
      userAgent: userAgentFromRequest(request),
      metadata: {
        outcome: "granted",
        matterId: visible.document.matterId,
        portalDocumentAccessId: visible.access.id,
      },
    });
    return { document: visible.summary };
  });
}
