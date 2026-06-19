import type { AuditEvent, NewAuditEvent } from "@open-practice/domain";

export interface AuditEventReadFilter {
  actions?: readonly string[];
  matterId?: string;
  resourceType?: string;
  resourceId?: string;
}

export interface AuditRepository {
  recordAuditEvent(event: AuditEvent): Promise<void>;
  listAuditEvents(firmId: string): Promise<{ events: AuditEvent[]; valid: boolean }>;
  listFilteredAuditEvents(firmId: string, filter: AuditEventReadFilter): Promise<AuditEvent[]>;
  appendAuditEvent(event: NewAuditEvent): Promise<AuditEvent>;
}
