import type { Contact, PortalGrant, User } from "@open-practice/domain";

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

export function activePortalGrant(grant: PortalGrant, now: string): boolean {
  if (grant.revokedAt) return false;
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.parse(now)) return false;
  return true;
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
