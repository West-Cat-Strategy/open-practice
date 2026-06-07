export interface EmailDeliveryEventSummary {
  id: string;
  eventType: string;
  occurredAt: string;
  providerMessageId?: string;
  attemptNumber?: number;
  jobId?: string;
  source: string;
  errorSummary?: string;
}

export interface EmailDeliveryHistoryItem {
  id: string;
  matterId: string;
  templateKey: string;
  status: string;
  relatedResourceType?: string;
  relatedResourceId?: string;
  recipientCount: number;
  attemptCount: number;
  queuedAt: string;
  lastAttemptAt?: string;
  sentAt?: string;
  failedAt?: string;
  terminalFailureAt?: string;
  failureSummary?: string;
  events: EmailDeliveryEventSummary[];
}

export interface EmailDeliveryHistoryResponse {
  emails: EmailDeliveryHistoryItem[];
}

export interface EmailDeliveryDashboardResponse {
  emailsByMatterId: Record<string, EmailDeliveryHistoryItem[]>;
}
