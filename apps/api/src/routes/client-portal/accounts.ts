import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PortalGrant } from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import { createSessionToken, hashToken } from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import { activePortalGrant, contactEmail, normalizedEmail, sanitizedUser } from "./shared.js";

const portalPermissionSchema = z.enum(["view_documents", "upload_documents", "message", "sign"]);

const clientPortalAccountBodySchema = z.object({
  matterId: z.string().min(1),
  contactId: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  permissions: z.array(portalPermissionSchema).nonempty().optional(),
  passwordSetupExpiresInHours: z.coerce.number().int().positive().max(168).default(72),
});

const defaultPortalPermissions: PortalGrant["permissions"] = [
  "view_documents",
  "upload_documents",
  "message",
  "sign",
];

export function registerClientPortalAccountRoutes(
  server: FastifyInstance,
  { repository, jwtSecret }: ApiRouteDependencies & { jwtSecret?: string },
): void {
  server.post("/api/client-portal/accounts", async (request, reply) => {
    const credentialAccess = requireAccess(request.auth, {
      resource: "auth_credential",
      action: "create",
    });
    if (!credentialAccess.ok) throw credentialAccess.error;

    const body = parseRequestPart(clientPortalAccountBodySchema, request.body, "body");
    const matterAccess = requireAccess(request.auth, {
      resource: "matter",
      action: "read",
      matterId: body.matterId,
    });
    if (!matterAccess.ok) throw matterAccess.error;

    const contactAccess = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!contactAccess.ok) throw contactAccess.error;

    const now = new Date();
    if (body.expiresAt && Date.parse(body.expiresAt) <= now.getTime()) {
      throw new ApiHttpError(
        400,
        "PORTAL_GRANT_EXPIRY_INVALID",
        "Portal grant expiry must be in the future",
      );
    }

    const [contact, visibleMatters] = await Promise.all([
      repository.getContact(request.auth.firmId, body.contactId),
      repository.listMattersForUser(request.auth.user),
    ]);
    const matter = visibleMatters.find((candidate) => candidate.id === body.matterId);
    if (!matter) {
      throw new ApiHttpError(404, "MATTER_NOT_FOUND", "Matter was not found");
    }
    const party = matter.parties.find((candidate) => candidate.contactId === body.contactId);
    if (!contact || !party) {
      throw new ApiHttpError(
        404,
        "CLIENT_CONTACT_NOT_FOUND",
        "Client contact was not found on this matter",
      );
    }
    if (party.adverse) {
      throw new ApiHttpError(
        409,
        "CLIENT_CONTACT_ADVERSE",
        "Adverse contacts cannot be issued client portal accounts",
      );
    }
    const email = contactEmail(contact);
    if (!email) {
      throw new ApiHttpError(
        409,
        "CLIENT_CONTACT_EMAIL_REQUIRED",
        "Client contact needs an email identifier before portal account setup",
      );
    }

    const normalizedContactEmail = normalizedEmail(email);
    const existingUser = await repository.getUserByEmail(
      request.auth.firmId,
      normalizedContactEmail,
    );
    if (existingUser && existingUser.role !== "client_external") {
      throw new ApiHttpError(
        409,
        "CLIENT_PORTAL_EMAIL_IN_USE",
        "This email already belongs to a non-client account",
      );
    }

    const account =
      existingUser ??
      (await repository.createUser({
        id: `client-${crypto.randomUUID()}`,
        firmId: request.auth.firmId,
        displayName: contact.displayName,
        email: normalizedContactEmail,
        role: "client_external",
        assignedMatterIds: [],
        mfaEnabled: false,
      }));

    const requestedPermissions = (body.permissions ??
      defaultPortalPermissions) as PortalGrant["permissions"];
    const existingGrant = (await repository.listPortalGrants(request.auth.firmId)).find(
      (grant) =>
        grant.matterId === body.matterId &&
        grant.contactId === body.contactId &&
        grant.accountUserId === account.id &&
        activePortalGrant(grant, now.toISOString()) &&
        requestedPermissions.every((permission) => grant.permissions.includes(permission)),
    );
    const grant =
      existingGrant ??
      (await repository.createPortalGrant({
        id: `portal-grant-${crypto.randomUUID()}`,
        firmId: request.auth.firmId,
        matterId: body.matterId,
        contactId: body.contactId,
        accountUserId: account.id,
        grantedByUserId: request.auth.user.id,
        permissions: requestedPermissions,
        expiresAt: body.expiresAt,
      }));

    let setup:
      | { status: "token_created"; token: string; expiresAt: string; userId: string }
      | { status: "token_unavailable"; reason: "token_signing_not_configured"; userId: string };
    if (jwtSecret) {
      const token = createSessionToken();
      const expiresAt = new Date(
        now.getTime() + body.passwordSetupExpiresInHours * 60 * 60 * 1000,
      ).toISOString();
      const record = await repository.createPasswordSetupToken({
        id: crypto.randomUUID(),
        firmId: request.auth.firmId,
        userId: account.id,
        tokenHash: hashToken(token, jwtSecret),
        createdByUserId: request.auth.user.id,
        createdAt: now.toISOString(),
        expiresAt,
      });
      setup = { status: "token_created", token, expiresAt: record.expiresAt, userId: account.id };
    } else {
      setup = {
        status: "token_unavailable",
        reason: "token_signing_not_configured",
        userId: account.id,
      };
    }

    await appendRouteAuditEvent(repository, request.auth, {
      action: "portal.account_setup.created",
      resourceType: "portal_grant",
      resourceId: grant.id,
      metadata: {
        matterId: body.matterId,
        contactId: body.contactId,
        accountUserId: account.id,
        grantStatus: existingGrant ? "reused" : "created",
        setupTokenStatus: setup.status,
        permissions: requestedPermissions,
        expiresAt: grant.expiresAt,
      },
    });

    return reply.code(existingGrant && existingUser ? 200 : 201).send({
      account: sanitizedUser(account),
      grant: {
        id: grant.id,
        matterId: grant.matterId,
        permissions: grant.permissions,
        expiresAt: grant.expiresAt,
        status: activePortalGrant(grant, now.toISOString()) ? "active" : "inactive",
      },
      setup,
    });
  });
}
