import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import {
  canShareDocumentThroughPortal,
  type CalendarGuestLinkRecord,
  type Contact,
  type DocumentRecord,
  type EmailOutboxRecord,
  type EmailReceiptTokenRecord,
  type ExternalUploadLinkRecord,
  type IntakeFormLinkRecord,
  type MatterParty,
  type PortalGrant,
  type ShareLinkRecord,
  type SignatureRequestRecord,
  type SignatureRequestSignerRecord,
} from "@open-practice/domain";
import { createSessionToken, hashToken } from "../http/auth-helpers.js";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";

type PortalPermission = PortalGrant["permissions"][number];
type ActionTone = "neutral" | "ready" | "risk";
type ActionKind =
  | "secure_share"
  | "external_upload"
  | "intake"
  | "guest_session"
  | "receipt"
  | "signature";

interface RegisterClientPortalRouteOptions extends ApiRouteDependencies {
  jwtSecret?: string;
}

interface MatterSummaries {
  secureShares: {
    activeLinkCount: number;
    emailVerificationRequiredCount: number;
    sharedDocumentCount: number;
  };
  externalUploads: {
    activeLinkCount: number;
    remainingUploadSlots: number;
    reviewCounts: Record<string, number>;
  };
  intake: {
    activeLinkCount: number;
    submittedLinkCount: number;
    draftLinkCount: number;
    itemActionCounts: Record<string, number>;
  };
  guestSessions: { activeLinkCount: number; statusCounts: Record<string, number> };
  receipts: { pendingCount: number; recordedCount: number; expiredCount: number };
  signatures: { pendingCount: number; completedCount: number };
}

const portalPermissionOrder = ["view_documents", "upload_documents", "message", "sign"] as const;
const portalPermissionSchema = z.enum(portalPermissionOrder);
const allowedClientPartyRoles = new Set<MatterParty["role"]>([
  "client",
  "prospective_client",
  "notary_client",
  "paralegal_client",
]);

const accountCreateBodySchema = z.object({
  matterId: z.string().min(1),
  contactId: z.string().min(1),
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1).optional(),
  permissions: z.array(portalPermissionSchema).min(1).default(["view_documents"]),
  expiresAt: z.string().datetime().optional(),
  issuePasswordSetupToken: z.boolean().default(true),
  passwordSetupExpiresInHours: z.number().int().positive().max(168).default(24),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function contactEmailValues(contact: Contact): string[] {
  return contact.identifiers
    .filter((identifier) => identifier.type === "email")
    .map((identifier) => normalizeEmail(identifier.value));
}

function uniquePortalPermissions(permissions: readonly PortalPermission[]): PortalPermission[] {
  const requested = new Set(permissions);
  return portalPermissionOrder.filter((permission) => requested.has(permission));
}

function samePermissions(left: readonly PortalPermission[], right: readonly PortalPermission[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return (
    leftSet.size === rightSet.size &&
    Array.from(leftSet).every((permission) => rightSet.has(permission))
  );
}

function isFuture(value: string | undefined, now: string): boolean {
  return Boolean(value && Date.parse(value) > Date.parse(now));
}

function isActiveGrant(grant: PortalGrant, now: string): boolean {
  return !grant.revokedAt && (!grant.expiresAt || isFuture(grant.expiresAt, now));
}

function isActiveDatedLink(link: { expiresAt?: string; revokedAt?: string }, now: string): boolean {
  return !link.revokedAt && (!link.expiresAt || isFuture(link.expiresAt, now));
}

function earliestExpiry(grants: PortalGrant[]): string | undefined {
  return grants
    .map((grant) => grant.expiresAt)
    .filter((expiresAt): expiresAt is string => Boolean(expiresAt))
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
}

function emptyMatterSummaries(): MatterSummaries {
  return {
    secureShares: {
      activeLinkCount: 0,
      emailVerificationRequiredCount: 0,
      sharedDocumentCount: 0,
    },
    externalUploads: { activeLinkCount: 0, remainingUploadSlots: 0, reviewCounts: {} },
    intake: { activeLinkCount: 0, submittedLinkCount: 0, draftLinkCount: 0, itemActionCounts: {} },
    guestSessions: { activeLinkCount: 0, statusCounts: {} },
    receipts: { pendingCount: 0, recordedCount: 0, expiredCount: 0 },
    signatures: { pendingCount: 0, completedCount: 0 },
  };
}

function countStatus(counts: Record<string, number>, status: string): void {
  counts[status] = (counts[status] ?? 0) + 1;
}

function assertClientParty(party: MatterParty): void {
  if (party.adverse || !allowedClientPartyRoles.has(party.role)) {
    throw new ApiHttpError(
      403,
      "CLIENT_PORTAL_CONTACT_ROLE_NOT_ALLOWED",
      "Client portal access can only be created for non-adverse client contacts",
    );
  }
}

async function loadVisibleParty(input: {
  repository: OpenPracticeRepository;
  auth: ApiAuthContext;
  matterId: string;
  contactId: string;
}) {
  const matterAccess = requireAccess(input.auth, {
    resource: "matter",
    action: "read",
    matterId: input.matterId,
  });
  if (!matterAccess.ok) throw matterAccess.error;
  const matter = (await input.repository.listMattersForUser(input.auth.user)).find(
    (candidate) => candidate.id === input.matterId,
  );
  if (!matter) throw new ApiHttpError(404, "MATTER_NOT_FOUND", "Matter was not found");
  const party = matter.parties.find((candidate) => candidate.contactId === input.contactId);
  if (!party) {
    throw new ApiHttpError(404, "PORTAL_CONTACT_NOT_FOUND", "Contact is not visible on matter");
  }
  assertClientParty(party);
  return party;
}

async function createPasswordSetupResponse(input: {
  repository: OpenPracticeRepository;
  firmId: string;
  userId: string;
  createdByUserId: string;
  jwtSecret?: string;
  issueToken: boolean;
  createdUser: boolean;
  expiresInHours: number;
}) {
  if (!input.issueToken) return { status: "skipped" as const };
  if (!input.jwtSecret) return { status: "disabled" as const };
  const authAccount = await input.repository.getAuthAccount(input.firmId, input.userId);
  if (authAccount) return { status: "already_configured" as const };
  if (!input.createdUser) return { status: "already_issued" as const };

  const token = createSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expiresInHours * 60 * 60 * 1000).toISOString();
  const record = await input.repository.createPasswordSetupToken({
    id: randomUUID(),
    firmId: input.firmId,
    userId: input.userId,
    tokenHash: hashToken(token, input.jwtSecret),
    createdByUserId: input.createdByUserId,
    createdAt: now.toISOString(),
    expiresAt,
  });
  return { status: "issued" as const, token, expiresAt: record.expiresAt };
}

async function setupPortalLoginAccess(input: {
  repository: OpenPracticeRepository;
  auth: ApiAuthContext;
  jwtSecret?: string;
  body: z.infer<typeof accountCreateBodySchema>;
}) {
  const { matterId, contactId } = input.body;
  const party = await loadVisibleParty({
    repository: input.repository,
    auth: input.auth,
    matterId,
    contactId,
  });
  const contact = party.contact;
  const normalizedEmail = normalizeEmail(input.body.email);
  if (!contactEmailValues(contact).includes(normalizedEmail)) {
    throw new ApiHttpError(
      400,
      "PORTAL_CONTACT_EMAIL_MISMATCH",
      "The requested client account email is not one of the selected contact identifiers",
    );
  }

  const usersWithEmail = await input.repository.listUsersByEmail(normalizedEmail);
  if (
    usersWithEmail.some(
      (user) => user.firmId !== input.auth.firmId || user.role !== "client_external",
    )
  ) {
    throw new ApiHttpError(
      409,
      "PORTAL_EMAIL_ALREADY_ASSIGNED",
      "That email is already assigned to another account",
    );
  }

  const existingUser = usersWithEmail.find((user) => user.firmId === input.auth.firmId);
  const createdUser = !existingUser;
  const clientUser =
    existingUser ??
    (await input.repository.createUser({
      id: "user-client-" + randomUUID(),
      firmId: input.auth.firmId,
      displayName: input.body.displayName ?? contact.displayName,
      email: normalizedEmail,
      role: "client_external",
      assignedMatterIds: [],
      mfaEnabled: false,
    }));

  const permissions = uniquePortalPermissions(input.body.permissions);
  const now = new Date().toISOString();
  const existingGrant = (await input.repository.listPortalGrants(input.auth.firmId)).find(
    (grant) =>
      grant.matterId === matterId &&
      grant.contactId === contactId &&
      isActiveGrant(grant, now) &&
      samePermissions(grant.permissions, permissions) &&
      (grant.expiresAt ?? undefined) === (input.body.expiresAt ?? undefined),
  );
  const grant =
    existingGrant ??
    (await input.repository.createPortalGrant({
      id: "portal-grant-" + randomUUID(),
      firmId: input.auth.firmId,
      matterId,
      contactId,
      grantedByUserId: input.auth.user.id,
      permissions,
      expiresAt: input.body.expiresAt,
    }));

  const passwordSetup = await createPasswordSetupResponse({
    repository: input.repository,
    firmId: input.auth.firmId,
    userId: clientUser.id,
    createdByUserId: input.auth.user.id,
    jwtSecret: input.jwtSecret,
    issueToken: input.body.issuePasswordSetupToken,
    createdUser,
    expiresInHours: input.body.passwordSetupExpiresInHours,
  });

  if (!existingGrant) {
    await appendRouteAuditEvent(input.repository, input.auth, {
      action: "portal.grant.created",
      resourceType: "portal_grant",
      resourceId: grant.id,
      metadata: { matterId, contactId, permissions },
    });
  }
  return { clientUser, contact, createdUser, grant, grantCreated: !existingGrant, passwordSetup };
}

function linkMatchesContact(link: IntakeFormLinkRecord, contactId: string): boolean {
  return !link.clientContactId || link.clientContactId === contactId;
}

function countShareableDocuments(input: {
  documents: DocumentRecord[];
  grants: PortalGrant[];
  now: string;
}): number {
  const ids = new Set<string>();
  for (const grant of input.grants) {
    for (const document of input.documents) {
      if (canShareDocumentThroughPortal({ document, grant, now: input.now })) ids.add(document.id);
    }
  }
  return ids.size;
}

function summarizeShareLinks(input: {
  summaries: MatterSummaries;
  links: ShareLinkRecord[];
  documents: DocumentRecord[];
  grants: PortalGrant[];
  now: string;
}): void {
  input.summaries.secureShares.activeLinkCount = input.links.filter((link) =>
    isActiveDatedLink(link, input.now),
  ).length;
  input.summaries.secureShares.sharedDocumentCount = countShareableDocuments({
    documents: input.documents,
    grants: input.grants,
    now: input.now,
  });
}

function summarizeExternalUploads(input: {
  summaries: MatterSummaries;
  links: ExternalUploadLinkRecord[];
  documents: DocumentRecord[];
  now: string;
}): void {
  const activeLinks = input.links.filter((link) => isActiveDatedLink(link, input.now));
  const activeIds = new Set(activeLinks.map((link) => link.id));
  input.summaries.externalUploads.activeLinkCount = activeLinks.length;
  input.summaries.externalUploads.remainingUploadSlots = activeLinks.reduce(
    (total, link) => total + Math.max(link.maxUploads - link.usedUploads, 0),
    0,
  );
  for (const document of input.documents) {
    if (document.externalUploadLinkId && activeIds.has(document.externalUploadLinkId)) {
      countStatus(input.summaries.externalUploads.reviewCounts, document.reviewStatus);
    }
  }
}

async function summarizeIntake(input: {
  repository: OpenPracticeRepository;
  summaries: MatterSummaries;
  firmId: string;
  matterId: string;
  contactId: string;
  now: string;
}): Promise<void> {
  const links = (
    await input.repository.listIntakeFormLinks(input.firmId, {
      matterId: input.matterId,
    })
  ).filter((link) => linkMatchesContact(link, input.contactId));
  input.summaries.intake.activeLinkCount = links.filter((link) =>
    isActiveDatedLink(link, input.now),
  ).length;
  input.summaries.intake.submittedLinkCount = links.filter((link) =>
    Boolean(link.submittedAt),
  ).length;
  input.summaries.intake.draftLinkCount = links.filter(
    (link) => Boolean(link.draftUpdatedAt) && !link.submittedAt,
  ).length;
  for (const link of links) {
    const actions = await input.repository.listIntakeFormItemActions(input.firmId, {
      formLinkId: link.id,
    });
    for (const action of actions) {
      countStatus(
        input.summaries.intake.itemActionCounts,
        action.status === "intent_created" ? "waiting" : action.status,
      );
    }
  }
}

function summarizeGuestSessions(input: {
  summaries: MatterSummaries;
  links: CalendarGuestLinkRecord[];
  now: string;
}): void {
  const activeLinks = input.links.filter(
    (link) => link.status !== "revoked" && isActiveDatedLink(link, input.now),
  );
  input.summaries.guestSessions.activeLinkCount = activeLinks.length;
  for (const link of activeLinks)
    countStatus(input.summaries.guestSessions.statusCounts, link.status);
}

function emailIncludesClient(email: EmailOutboxRecord | undefined, clientEmail: string): boolean {
  return Boolean(
    email?.to.some((recipient) => normalizeEmail(recipient) === normalizeEmail(clientEmail)),
  );
}

function summarizeReceiptToken(input: {
  summaries: MatterSummaries;
  token: EmailReceiptTokenRecord;
  email: EmailOutboxRecord | undefined;
  clientEmail: string;
  now: string;
}): void {
  if (!emailIncludesClient(input.email, input.clientEmail)) return;
  if (input.token.recordedAt) input.summaries.receipts.recordedCount += 1;
  else if (Date.parse(input.token.expiresAt) <= Date.parse(input.now)) {
    input.summaries.receipts.expiredCount += 1;
  } else input.summaries.receipts.pendingCount += 1;
}

async function summarizeReceipts(input: {
  repository: OpenPracticeRepository;
  summaries: MatterSummaries;
  firmId: string;
  matterId: string;
  clientEmail: string;
  now: string;
}): Promise<void> {
  const tokens = await input.repository.listEmailReceiptTokens(input.firmId, {
    matterId: input.matterId,
  });
  for (const token of tokens) {
    summarizeReceiptToken({
      summaries: input.summaries,
      token,
      email: await input.repository.getEmailOutbox(input.firmId, token.emailId),
      clientEmail: input.clientEmail,
      now: input.now,
    });
  }
}

function summarizeSigner(input: {
  summaries: MatterSummaries;
  request: SignatureRequestRecord;
  signer: SignatureRequestSignerRecord;
  clientEmail: string;
}): void {
  if (normalizeEmail(input.signer.email) !== normalizeEmail(input.clientEmail)) return;
  if (
    input.signer.completedAt ||
    input.signer.status === "completed" ||
    input.request.status === "completed"
  ) {
    input.summaries.signatures.completedCount += 1;
  } else input.summaries.signatures.pendingCount += 1;
}

async function summarizeSignatures(input: {
  repository: OpenPracticeRepository;
  summaries: MatterSummaries;
  firmId: string;
  matterId: string;
  clientEmail: string;
}): Promise<void> {
  const requests = await input.repository.listSignatureRequests(input.firmId, {
    matterId: input.matterId,
  });
  for (const request of requests) {
    const signers = await input.repository.listSignatureRequestSigners(input.firmId, request.id);
    for (const signer of signers) {
      summarizeSigner({
        summaries: input.summaries,
        request,
        signer,
        clientEmail: input.clientEmail,
      });
    }
  }
}

async function buildMatterSummaries(input: {
  repository: OpenPracticeRepository;
  firmId: string;
  matterId: string;
  contactId: string;
  clientEmail: string;
  grants: PortalGrant[];
  now: string;
}): Promise<MatterSummaries> {
  const summaries = emptyMatterSummaries();
  const [shareLinks, externalUploadLinks, guestLinks, documents] = await Promise.all([
    input.repository.listShareLinks(input.firmId, { matterId: input.matterId }),
    input.repository.listExternalUploadLinks(input.firmId, { matterId: input.matterId }),
    input.repository.listCalendarGuestLinks(input.firmId, { matterId: input.matterId }),
    input.repository.listMatterDocuments(input.firmId, input.matterId),
  ]);
  summarizeShareLinks({
    summaries,
    links: shareLinks,
    documents,
    grants: input.grants,
    now: input.now,
  });
  summarizeExternalUploads({ summaries, links: externalUploadLinks, documents, now: input.now });
  summarizeGuestSessions({ summaries, links: guestLinks, now: input.now });
  await summarizeIntake({
    repository: input.repository,
    summaries,
    firmId: input.firmId,
    matterId: input.matterId,
    contactId: input.contactId,
    now: input.now,
  });
  await summarizeReceipts({
    repository: input.repository,
    summaries,
    firmId: input.firmId,
    matterId: input.matterId,
    clientEmail: input.clientEmail,
    now: input.now,
  });
  await summarizeSignatures({
    repository: input.repository,
    summaries,
    firmId: input.firmId,
    matterId: input.matterId,
    clientEmail: input.clientEmail,
  });
  return summaries;
}

function addAction(
  actions: Array<{
    id: string;
    kind: ActionKind;
    sourceType: string;
    title: string;
    detail: string;
    status: string;
    tone: ActionTone;
    sourceLinked: boolean;
  }>,
  input: {
    matterId: string;
    kind: ActionKind;
    sourceType: string;
    title: string;
    detail: string;
    status?: string;
    tone?: ActionTone;
  },
): void {
  actions.push({
    id: `${input.matterId}:${input.kind}`,
    kind: input.kind,
    sourceType: input.sourceType,
    title: input.title,
    detail: input.detail,
    status: input.status ?? "ready",
    tone: input.tone ?? "neutral",
    sourceLinked: true,
  });
}

function buildClientActions(matterId: string, summaries: MatterSummaries) {
  const actions: Array<{
    id: string;
    kind: ActionKind;
    sourceType: string;
    title: string;
    detail: string;
    status: string;
    tone: ActionTone;
    sourceLinked: boolean;
  }> = [];
  if (summaries.secureShares.activeLinkCount > 0) {
    addAction(actions, {
      matterId,
      kind: "secure_share",
      sourceType: "share_link",
      title: "Shared documents",
      detail: `${summaries.secureShares.sharedDocumentCount} available item(s)`,
      tone: "ready",
    });
  }
  if (summaries.externalUploads.activeLinkCount > 0) {
    addAction(actions, {
      matterId,
      kind: "external_upload",
      sourceType: "external_upload",
      title: "Document uploads",
      detail: `${summaries.externalUploads.remainingUploadSlots} upload slot(s) remaining`,
      status: summaries.externalUploads.remainingUploadSlots > 0 ? "ready" : "waiting",
      tone: summaries.externalUploads.reviewCounts.rejected ? "risk" : "ready",
    });
  }
  if (summaries.intake.activeLinkCount > 0 || summaries.intake.submittedLinkCount > 0) {
    addAction(actions, {
      matterId,
      kind: "intake",
      sourceType: "intake_form",
      title: "Intake forms",
      detail: `${summaries.intake.submittedLinkCount} submitted, ${summaries.intake.draftLinkCount} draft`,
      status: summaries.intake.submittedLinkCount > 0 ? "completed" : "waiting",
    });
  }
  if (summaries.guestSessions.activeLinkCount > 0) {
    addAction(actions, {
      matterId,
      kind: "guest_session",
      sourceType: "guest_session",
      title: "Guest sessions",
      detail: `${summaries.guestSessions.activeLinkCount} active session link(s)`,
      status: "waiting",
    });
  }
  if (
    summaries.receipts.pendingCount > 0 ||
    summaries.receipts.recordedCount > 0 ||
    summaries.receipts.expiredCount > 0
  ) {
    addAction(actions, {
      matterId,
      kind: "receipt",
      sourceType: "email_receipt",
      title: "Delivery receipts",
      detail: `${summaries.receipts.recordedCount} recorded, ${summaries.receipts.pendingCount} pending`,
      status: summaries.receipts.recordedCount > 0 ? "completed" : "waiting",
    });
  }
  if (summaries.signatures.pendingCount > 0 || summaries.signatures.completedCount > 0) {
    addAction(actions, {
      matterId,
      kind: "signature",
      sourceType: "signature_request",
      title: "Signature requests",
      detail: `${summaries.signatures.completedCount} completed, ${summaries.signatures.pendingCount} pending`,
      status: summaries.signatures.pendingCount > 0 ? "waiting" : "completed",
      tone: summaries.signatures.pendingCount > 0 ? "neutral" : "ready",
    });
  }
  return actions;
}

async function buildClientWorkspace(input: {
  repository: OpenPracticeRepository;
  auth: ApiAuthContext;
}) {
  if (input.auth.user.role !== "client_external") {
    throw new ApiHttpError(
      403,
      "CLIENT_PORTAL_ACCOUNT_REQUIRED",
      "Client portal workspace requires a client account",
    );
  }

  const now = new Date().toISOString();
  const clientEmail = normalizeEmail(input.auth.user.email);
  const contactCache = new Map<string, Contact | undefined>();
  const activeGrants: PortalGrant[] = [];
  const matchedContactIds = new Set<string>();

  for (const grant of await input.repository.listPortalGrants(input.auth.firmId)) {
    if (!isActiveGrant(grant, now)) continue;
    let contact = contactCache.get(grant.contactId);
    if (!contactCache.has(grant.contactId)) {
      contact = await input.repository.getContact(input.auth.firmId, grant.contactId);
      contactCache.set(grant.contactId, contact);
    }
    if (contact && contactEmailValues(contact).includes(clientEmail)) {
      activeGrants.push(grant);
      matchedContactIds.add(contact.id);
    }
  }

  const grouped = new Map<string, PortalGrant[]>();
  for (const grant of activeGrants) {
    const key = grant.matterId + ":" + grant.contactId;
    grouped.set(key, [...(grouped.get(key) ?? []), grant]);
  }

  const matters = await Promise.all(
    Array.from(grouped.values()).map(async (grants) => {
      const firstGrant = grants[0]!;
      const contact = contactCache.get(firstGrant.contactId);
      if (!contact) return undefined;
      const summaries = await buildMatterSummaries({
        repository: input.repository,
        firmId: input.auth.firmId,
        matterId: firstGrant.matterId,
        contactId: firstGrant.contactId,
        clientEmail,
        grants,
        now,
      });
      return {
        matterId: firstGrant.matterId,
        contact: { id: contact.id, displayName: contact.displayName },
        access: {
          grantCount: grants.length,
          permissions: uniquePortalPermissions(grants.flatMap((grant) => grant.permissions)),
          expiresAt: earliestExpiry(grants),
          redacted: true as const,
        },
        summaries,
        clientActions: buildClientActions(firstGrant.matterId, summaries),
      };
    }),
  );

  return {
    account: {
      userId: input.auth.user.id,
      displayName: input.auth.user.displayName,
      email: input.auth.user.email,
      role: "client_external" as const,
    },
    access: {
      status: activeGrants.length > 0 ? ("active" as const) : ("no_active_grants" as const),
      activeAccountCount: matchedContactIds.size,
      activeGrantCount: activeGrants.length,
      contactCount: matchedContactIds.size,
      matchedBy: "contact_email" as const,
      redacted: true as const,
    },
    matters: matters.filter((matter): matter is NonNullable<typeof matter> => Boolean(matter)),
    boundaries: {
      publicTokenRoutesPreserved: true,
      realtimeChat: "out_of_scope" as const,
      broadDocumentBrowsing: "out_of_scope" as const,
      livePayments: "out_of_scope" as const,
      nativeMobile: "out_of_scope" as const,
    },
  };
}

export function registerClientPortalRoutes(
  server: FastifyInstance,
  { repository, jwtSecret }: RegisterClientPortalRouteOptions,
): void {
  server.get("/api/client-portal/workspace", async (request) =>
    buildClientWorkspace({ repository, auth: request.auth }),
  );

  server.post("/api/client-portal/accounts", async (request, reply) => {
    const access = requireAccess(request.auth, { resource: "auth_credential", action: "create" });
    if (!access.ok) throw access.error;
    const body = parseRequestPart(accountCreateBodySchema, request.body, "body");
    const result = await setupPortalLoginAccess({
      repository,
      auth: request.auth,
      jwtSecret,
      body,
    });
    reply.code(result.createdUser || result.grantCreated ? 201 : 200);
    return {
      account: {
        userId: result.clientUser.id,
        contactId: result.contact.id,
        email: result.clientUser.email,
        displayName: result.clientUser.displayName,
        role: result.clientUser.role,
        created: result.createdUser,
      },
      grant: {
        id: result.grant.id,
        matterId: result.grant.matterId,
        contactId: result.grant.contactId,
        permissions: result.grant.permissions,
        expiresAt: result.grant.expiresAt,
        created: result.grantCreated,
      },
      passwordSetup: result.passwordSetup,
      boundaries: { rawPortalTokensReturned: false, publicTokenRoutesPreserved: true },
    };
  });
}
