import type { AuditEvent, NewAuditEvent } from "@open-practice/domain";

export interface AuditRepository {
  recordAuditEvent(event: AuditEvent): Promise<void>;
  listAuditEvents(firmId: string): Promise<{ events: AuditEvent[]; valid: boolean }>;
  appendAuditEvent(event: NewAuditEvent): Promise<AuditEvent>;
}
