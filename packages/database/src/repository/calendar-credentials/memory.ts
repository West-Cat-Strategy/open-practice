import type { CalendarCredentialRecord } from "@open-practice/domain";
import type { CalendarCredentialRevokeInput } from "../calendar-credentials-contracts.js";
import { clone } from "../contracts.js";

export interface MemoryCalendarCredentialStore {
  calendarCredentials: CalendarCredentialRecord[];
}

export function createMemoryCalendarCredential(
  store: MemoryCalendarCredentialStore,
  credential: CalendarCredentialRecord,
): CalendarCredentialRecord {
  store.calendarCredentials.push(clone(credential));
  return clone(credential);
}

export function listMemoryCalendarCredentials(
  store: MemoryCalendarCredentialStore,
  firmId: string,
  userId: string,
): CalendarCredentialRecord[] {
  return clone(
    store.calendarCredentials
      .filter((credential) => credential.firmId === firmId && credential.userId === userId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
  );
}

export function getMemoryCalendarCredentialByUsername(
  store: MemoryCalendarCredentialStore,
  username: string,
): CalendarCredentialRecord | undefined {
  return clone(
    store.calendarCredentials.find(
      (credential) => credential.username === username && !credential.revokedAt,
    ),
  );
}

export function touchMemoryCalendarCredential(
  store: MemoryCalendarCredentialStore,
  id: string,
  lastUsedAt: string,
): void {
  const credential = store.calendarCredentials.find((candidate) => candidate.id === id);
  if (credential) credential.lastUsedAt = lastUsedAt;
}

export function revokeMemoryCalendarCredential(
  store: MemoryCalendarCredentialStore,
  input: CalendarCredentialRevokeInput,
): CalendarCredentialRecord | undefined {
  const credential = store.calendarCredentials.find(
    (candidate) =>
      candidate.firmId === input.firmId &&
      candidate.userId === input.userId &&
      candidate.id === input.credentialId,
  );
  if (!credential) return undefined;
  credential.revokedAt = input.revokedAt;
  return clone(credential);
}
