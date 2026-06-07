import type { CalendarCredentialRecord } from "@open-practice/domain";

export interface CalendarCredentialRevokeInput {
  firmId: string;
  userId: string;
  credentialId: string;
  revokedAt: string;
}

export interface CalendarCredentialRepository {
  createCalendarCredential(credential: CalendarCredentialRecord): Promise<CalendarCredentialRecord>;
  listCalendarCredentials(firmId: string, userId: string): Promise<CalendarCredentialRecord[]>;
  getCalendarCredentialByUsername(username: string): Promise<CalendarCredentialRecord | undefined>;
  touchCalendarCredential(id: string, lastUsedAt: string): Promise<void>;
  revokeCalendarCredential(
    input: CalendarCredentialRevokeInput,
  ): Promise<CalendarCredentialRecord | undefined>;
}
