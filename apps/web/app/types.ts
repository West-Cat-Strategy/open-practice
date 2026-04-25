import type {
  Contact,
  ConflictCandidate,
  DocumentRecord,
  ExpenseEntry,
  Firm,
  ActivityTimelineEntry,
  DashboardSectionCapability,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  Matter,
  MatterParty,
  SignatureRequestRecord,
  TimeEntry,
  User,
} from "@open-practice/domain";

export interface MatterSummary extends Matter {
  parties: Array<MatterParty & { contact: Contact }>;
  documents: DocumentRecord[];
  timeEntries: TimeEntry[];
  expenses: ExpenseEntry[];
  activity: ActivityTimelineEntry[];
  trustBalanceCents: number;
}

export interface PracticeOverview {
  firm: Firm;
  metrics: {
    openMatters: number;
    intakeMatters: number;
    portalGrants: number;
    trustBalanceCents: number;
    unbilledMinutes: number;
  };
  users: User[];
}

export interface ConflictResponse {
  results: ConflictCandidate[];
  auditChainValid: boolean;
}

export interface SessionResponse {
  user: User;
}

export interface CapabilitiesResponse {
  sections: DashboardSectionCapability[];
}

export interface IntakeSessionsResponse {
  templates: IntakeTemplateRecord[];
  sessions: IntakeSessionRecord[];
}

export type SignatureRequestsResponse = SignatureRequestRecord[];
