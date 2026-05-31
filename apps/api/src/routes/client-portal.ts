import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  canShareDocumentThroughPortal,
  type CalendarGuestLinkRecord,
  type Contact,
  type DocumentRecord,
  type EmailOutboxRecord,
  type EmailReceiptTokenRecord,
  type ExternalUploadLinkRecord,
  type IntakeFormItemActionRecord,
  type IntakeFormLinkRecord,
  type Matter,
  type PortalGrant,
  type ShareLinkRecord,
  type User,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { createSessionToken, hashToken } from "../http/auth-helpers.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";

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

type ClientPortalActionFamily =
  | "secure_share"
  | "external_upload"
  | "intake"
  | "guest_session"
  | "receipt"
  | "client_update"
  | "client_action";

type ClientPortalActionTone = "neutral" | "ready" | "risk";

interface ClientPortalActionSummary {
  id: string;
  family: ClientPortalActionFamily;
  matterId: string;
  title: string;
  detail: string;
  status: string;
  tone: ClientPortalActionTone;
  updatedAt?: string;
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function contactEmail(contact: Contact): string | undefined {
  return contact.identifiers.find((identifier) => identifier.type === "email")?.value;
}

function contactMatchesUser(contact: Contact, user: User): boolean {
  const email = contactEmail(contact);
  return Boolean(email && normalizedEmail(email) === normalizedEmail(user.email));
}

function activePortalGrant(grant: PortalGrant, now: string): boolean {
  if (grant.revokedAt) return false;
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.parse(now)) return false;
  return true;
}

function uniquePermissions(grants: PortalGrant[]): PortalGrant["permissions"] {
  return Array.from(
    new Set(grants.flatMap((grant) => grant.permissions)),
  ).sort() as PortalGrant["permissions"];
}

function shareStatus(link: ShareLinkRecord, now: string): string {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt && Date.parse(link.expiresAt) <= Date.parse(now)) return "expired";
  if (link.requireEmailVerification) return "verification_required";
  return "available";
}

function externalUploadStatus(link: ExternalUploadLinkRecord, now: string): string {
  if (link.revokedAt) return "revoked";
  if (Date.parse(link.expiresAt) <= Date.parse(now)) return "expired";
  if (link.usedUploads >= link.maxUploads) return "exhausted";
  return "active";
}

function intakeLinkStatus(link: IntakeFormLinkRecord, now: string): string {
  if (link.revokedAt) return "revoked";
  if (link.submittedAt) return "submitted";
  if (Date.parse(link.expiresAt) <= Date.parse(now)) return "expired";
  return "active";
}

function receiptStatus(token: EmailReceiptTokenRecord, now: string): string {
  if (token.recordedAt) return "recorded";
  if (Date.parse(token.expiresAt) <= Date.parse(now)) return "expired";
  return "open";
}

function eligibleShareDocumentCount(
  link: ShareLinkRecord,
  documents: DocumentRecord[],
  now: string,
): number {
  if (!link.permissions.includes("view_documents")) return 0;
  const grant: PortalGrant = {
    id: link.id,
    firmId: link.firmId,
    matterId: link.matterId,
    contactId: `share-link:${link.id}`,
    grantedByUserId: link.grantedByUserId,
    permissions: link.permissions,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
  };
  return documents.filter((document) => canShareDocumentThroughPortal({ document, grant, now }))
    .length;
}

function shareActions(input: {
  links: ShareLinkRecord[];
  documents: DocumentRecord[];
  now: string;
}): ClientPortalActionSummary[] {
  return input.links.map((link) => {
    const status = shareStatus(link, input.now);
    const documentCount = eligibleShareDocumentCount(link, input.documents, input.now);
    const needsVerification = status === "verification_required";
    return {
      id: `secure-share:${link.id}`,
      family: "secure_share",
      matterId: link.matterId,
      title: needsVerification ? "Verify shared document access" : "Review shared documents",
      detail: needsVerification
        ? "Email verification is required on the staff-provided share link."
        : `${documentCount} shared document${documentCount === 1 ? "" : "s"} available on this share.`,
      status,
      tone: status === "available" ? "ready" : needsVerification ? "risk" : "neutral",
      updatedAt: link.revokedAt ?? link.createdAt,
    };
  });
}

function externalUploadActions(input: {
  links: ExternalUploadLinkRecord[];
  documents: DocumentRecord[];
  now: string;
}): ClientPortalActionSummary[] {
  const actions: ClientPortalActionSummary[] = [];
  for (const link of input.links) {
    const status = externalUploadStatus(link, input.now);
    const remaining = Math.max(link.maxUploads - link.usedUploads, 0);
    actions.push({
      id: `external-upload:${link.id}`,
      family: "external_upload",
      matterId: link.matterId,
      title: status === "active" ? "Upload requested documents" : "Upload request status",
      detail:
        status === "active"
          ? `${remaining} upload${remaining === 1 ? "" : "s"} remain on this request.`
          : `This upload request is ${status}.`,
      status,
      tone: status === "active" ? "risk" : "neutral",
      updatedAt: link.revokedAt ?? link.createdAt,
    });
  }

  for (const document of input.documents.filter((document) => document.externalUploadLinkId)) {
    const needsClientAction = ["needs_metadata", "retry_requested"].includes(document.reviewStatus);
    if (!needsClientAction && document.reviewStatus !== "accepted") continue;
    actions.push({
      id: `client-action:external-upload:${document.id}`,
      family: "client_action",
      matterId: document.matterId,
      title:
        document.reviewStatus === "accepted"
          ? "Upload accepted"
          : document.reviewStatus === "retry_requested"
            ? "Replacement upload requested"
            : "Upload follow-up requested",
      detail:
        document.reviewStatus === "accepted"
          ? `${document.title} was accepted by staff.`
          : `${document.title} needs client follow-up from staff.`,
      status: document.reviewStatus,
      tone: needsClientAction ? "risk" : "ready",
      updatedAt: document.reviewedAt ?? document.uploadedAt,
    });
  }
  return actions;
}

function intakeActions(input: {
  links: IntakeFormLinkRecord[];
  itemActions: IntakeFormItemActionRecord[];
  contactId: string;
  now: string;
}): ClientPortalActionSummary[] {
  return input.links
    .filter((link) => link.clientContactId === input.contactId)
    .flatMap((link) => {
      const status = intakeLinkStatus(link, input.now);
      const incompleteItemActions = input.itemActions.filter(
        (action) =>
          action.formLinkId === link.id && !["completed", "declined"].includes(action.status),
      );
      const summaries: ClientPortalActionSummary[] = [
        {
          id: `intake:${link.id}`,
          family: "intake",
          matterId: link.matterId,
          title: status === "active" ? "Complete intake form" : "Intake form status",
          detail:
            status === "active"
              ? `${incompleteItemActions.length} embedded form action${
                  incompleteItemActions.length === 1 ? "" : "s"
                } pending.`
              : `This intake form is ${status}.`,
          status,
          tone: status === "active" ? "risk" : status === "submitted" ? "ready" : "neutral",
          updatedAt: link.submittedAt ?? link.draftUpdatedAt ?? link.createdAt,
        },
      ];
      for (const action of incompleteItemActions) {
        summaries.push({
          id: `client-action:intake:${action.id}`,
          family: "client_action",
          matterId: action.matterId,
          title: action.kind === "signature" ? "Signature item pending" : "Upload item pending",
          detail: `Form item ${action.itemId} is ${action.status.replaceAll("_", " ")}.`,
          status: action.status,
          tone: "risk",
          updatedAt: action.completedAt ?? action.createdAt,
        });
      }
      return summaries;
    });
}

function guestSessionActions(input: {
  links: CalendarGuestLinkRecord[];
  now: string;
}): ClientPortalActionSummary[] {
  return input.links.map((link) => {
    const expired = Date.parse(link.expiresAt) <= Date.parse(input.now);
    const status = expired && link.status !== "revoked" ? "expired" : link.status;
    return {
      id: `guest-session:${link.id}`,
      family: "guest_session",
      matterId: link.matterId,
      title:
        status === "issued" || status === "waiting"
          ? "Meeting check-in pending"
          : "Meeting access status",
      detail: "Meeting access is controlled by staff from the hosted session lobby.",
      status,
      tone:
        status === "issued" || status === "waiting"
          ? "risk"
          : status === "admitted"
            ? "ready"
            : "neutral",
      updatedAt:
        link.revokedAt ?? link.admittedAt ?? link.deniedAt ?? link.checkedInAt ?? link.updatedAt,
    };
  });
}

function receiptActions(input: {
  tokens: EmailReceiptTokenRecord[];
  emails: EmailOutboxRecord[];
  userEmail: string;
  now: string;
}): ClientPortalActionSummary[] {
  const emailById = new Map(input.emails.map((email) => [email.id, email]));
  const normalizedUserEmail = normalizedEmail(input.userEmail);
  return input.tokens.flatMap((token) => {
    const email = emailById.get(token.emailId);
    const addressedToClient = email?.to.some(
      (recipient) => normalizedEmail(recipient) === normalizedUserEmail,
    );
    if (!email || !addressedToClient) return [];
    const status = receiptStatus(token, input.now);
    return [
      {
        id: `receipt:${token.id}`,
        family: "receipt",
        matterId: token.matterId,
        title: status === "open" ? "Acknowledge email receipt" : "Email receipt status",
        detail: `${email.templateKey} delivery receipt is ${status}.`,
        status,
        tone: status === "open" ? "risk" : status === "recorded" ? "ready" : "neutral",
        updatedAt: token.recordedAt ?? token.createdAt,
      },
    ];
  });
}

function isClientUpdateEmail(email: EmailOutboxRecord): boolean {
  return email.templateKey === "client.update" || email.templateKey === "client_update";
}

function clientUpdateActions(input: {
  emails: EmailOutboxRecord[];
  userEmail: string;
}): ClientPortalActionSummary[] {
  const normalizedUserEmail = normalizedEmail(input.userEmail);
  return input.emails.flatMap((email) => {
    if (!email.matterId) return [];
    if (!isClientUpdateEmail(email)) return [];
    if (!email.to.some((recipient) => normalizedEmail(recipient) === normalizedUserEmail)) {
      return [];
    }
    return {
      id: `client-update:${email.id}`,
      family: "client_update" as const,
      matterId: email.matterId,
      title: "Client update",
      detail: `Client update is ${email.status}.`,
      status: email.status,
      tone:
        email.status === "sent"
          ? ("ready" as const)
          : email.status === "failed"
            ? "risk"
            : "neutral",
      updatedAt: email.sentAt ?? email.failedAt ?? email.lastAttemptAt ?? email.queuedAt,
    };
  });
}

function sortActions(actions: ClientPortalActionSummary[]): ClientPortalActionSummary[] {
  return [...actions].sort((left, right) => {
    const leftRisk = left.tone === "risk" ? 1 : 0;
    const rightRisk = right.tone === "risk" ? 1 : 0;
    if (leftRisk !== rightRisk) return rightRisk - leftRisk;
    return (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "");
  });
}

function sanitizedUser(user: User) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
  };
}

function sanitizedMatter(matter: Matter, grants: PortalGrant[], actionCount: number) {
  return {
    id: matter.id,
    number: matter.number,
    title: matter.title,
    status: matter.status,
    permissions: uniquePermissions(grants),
    actionCount,
  };
}

async function clientContactGrants(
  repository: ApiRouteDependencies["repository"],
  user: User,
  now: string,
): Promise<Array<{ grant: PortalGrant; contact: Contact }>> {
  const grants = await repository.listPortalGrants(user.firmId);
  const pairs = await Promise.all(
    grants
      .filter((grant) => activePortalGrant(grant, now))
      .map(async (grant) => {
        const contact = await repository.getContact(grant.firmId, grant.contactId);
        return contact && contactMatchesUser(contact, user) ? { grant, contact } : undefined;
      }),
  );
  return pairs.filter((pair): pair is { grant: PortalGrant; contact: Contact } => Boolean(pair));
}

async function buildWorkspace(
  repository: ApiRouteDependencies["repository"],
  user: User,
  now: string,
) {
  const grantPairs = await clientContactGrants(repository, user, now);
  const grants = grantPairs.map((pair) => pair.grant);
  const matterIds = Array.from(new Set(grants.map((grant) => grant.matterId)));
  const matterSummaries =
    matterIds.length > 0
      ? await repository.listMattersForUser({ ...user, assignedMatterIds: matterIds })
      : [];

  const actionsByMatterId = new Map<string, ClientPortalActionSummary[]>();
  for (const matter of matterSummaries) {
    const matterGrants = grants.filter((grant) => grant.matterId === matter.id);
    const contactIds = new Set(matterGrants.map((grant) => grant.contactId));
    const [
      shareLinks,
      externalUploadLinks,
      documents,
      intakeLinks,
      itemActions,
      guestLinks,
      receiptTokens,
      emails,
    ] = await Promise.all([
      repository.listShareLinks(user.firmId, { matterId: matter.id }),
      repository.listExternalUploadLinks(user.firmId, { matterId: matter.id }),
      repository.listMatterDocuments(user.firmId, matter.id),
      repository.listIntakeFormLinks(user.firmId, { matterId: matter.id }),
      repository.listIntakeFormItemActions(user.firmId, {}),
      repository.listCalendarGuestLinks(user.firmId, { matterId: matter.id }),
      repository.listEmailReceiptTokens(user.firmId, { matterId: matter.id }),
      repository.listEmailOutbox(user.firmId, { matterId: matter.id, limit: 100 }),
    ]);
    const matterActions = sortActions([
      ...shareActions({ links: shareLinks, documents, now }),
      ...externalUploadActions({ links: externalUploadLinks, documents, now }),
      ...Array.from(contactIds).flatMap((contactId) =>
        intakeActions({ links: intakeLinks, itemActions, contactId, now }),
      ),
      ...guestSessionActions({ links: guestLinks, now }),
      ...clientUpdateActions({ emails, userEmail: user.email }),
      ...receiptActions({ tokens: receiptTokens, emails, userEmail: user.email, now }),
    ]);
    actionsByMatterId.set(matter.id, matterActions);
  }

  const actions = sortActions([...actionsByMatterId.values()].flat());
  return {
    account: sanitizedUser(user),
    access: {
      posture: grants.length > 0 ? "active" : "no_active_grants",
      activeGrantCount: grants.length,
      matterCount: matterIds.length,
      permissions: uniquePermissions(grants),
    },
    matters: matterSummaries.map((matter) =>
      sanitizedMatter(
        matter,
        grants.filter((grant) => grant.matterId === matter.id),
        actionsByMatterId.get(matter.id)?.length ?? 0,
      ),
    ),
    actions,
  };
}

export function registerClientPortalRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies & { jwtSecret?: string },
): void {
  const { repository, jwtSecret } = dependencies;

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

  server.get("/api/client-portal/workspace", async (request) => {
    if (request.auth.user.role !== "client_external") {
      throw new ApiHttpError(
        403,
        "CLIENT_PORTAL_ACCOUNT_REQUIRED",
        "Client portal account required",
      );
    }
    return buildWorkspace(repository, request.auth.user, new Date().toISOString());
  });
}
