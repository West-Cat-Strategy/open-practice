import {
  canShareDocumentThroughPortal,
  type Contact,
  type DocumentRecord,
  type Matter,
  type PortalDocumentAccess,
  type PortalGrant,
  type User,
} from "@open-practice/domain";
import type { ApiRouteDependencies } from "../types.js";

export function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function contactEmail(contact: Contact): string | undefined {
  return contact.identifiers.find((identifier) => identifier.type === "email")?.value;
}

export function contactMatchesUser(contact: Contact, user: User): boolean {
  const email = contactEmail(contact);
  return Boolean(email && normalizedEmail(email) === normalizedEmail(user.email));
}

export function portalGrantMatchesUser(grant: PortalGrant, contact: Contact, user: User): boolean {
  if (grant.accountUserId) return grant.accountUserId === user.id;
  return contactMatchesUser(contact, user);
}

export function activePortalGrant(grant: PortalGrant, now: string): boolean {
  if (grant.revokedAt) return false;
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.parse(now)) return false;
  return true;
}

export function activePortalDocumentAccess(access: PortalDocumentAccess, now: string): boolean {
  if (access.revokedAt) return false;
  if (access.expiresAt && Date.parse(access.expiresAt) <= Date.parse(now)) return false;
  return access.permission === "view_document";
}

export function portalGrantVisibleOnMatter(
  grant: PortalGrant,
  matter: Pick<Matter, "id"> & {
    parties?: Array<{ contactId: string; adverse: boolean; confidential: boolean }>;
  },
): boolean {
  if (grant.matterId !== matter.id) return false;
  const party = matter.parties?.find((candidate) => candidate.contactId === grant.contactId);
  if (!party || party.adverse) return false;
  return !party.confidential || Boolean(grant.accountUserId);
}

export function portalDocumentAccessVisible(input: {
  access: PortalDocumentAccess;
  document: DocumentRecord;
  grant: PortalGrant;
  now: string;
}): boolean {
  if (!activePortalDocumentAccess(input.access, input.now)) return false;
  if (input.access.firmId !== input.grant.firmId) return false;
  if (input.access.portalGrantId !== input.grant.id) return false;
  if (input.access.documentId !== input.document.id) return false;
  if (input.access.matterId !== input.document.matterId) return false;
  return canShareDocumentThroughPortal({
    document: input.document,
    grant: input.grant,
    now: input.now,
  });
}

export async function clientContactGrantPairs(
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
        return contact && portalGrantMatchesUser(grant, contact, user)
          ? { grant, contact }
          : undefined;
      }),
  );
  return pairs.filter((pair): pair is { grant: PortalGrant; contact: Contact } => Boolean(pair));
}

export function uniquePermissions(grants: PortalGrant[]): PortalGrant["permissions"] {
  return Array.from(
    new Set(grants.flatMap((grant) => grant.permissions)),
  ).sort() as PortalGrant["permissions"];
}

export function hasPortalPermission(
  grants: PortalGrant[],
  permission: PortalGrant["permissions"][number],
): boolean {
  return grants.some((grant) => grant.permissions.includes(permission));
}

export function sanitizedUser(user: User) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
  };
}
