import type { MatterSetupProfile } from "@open-practice/domain";
import type {
  ActivityTimelineEntry,
  Contact,
  DocumentRecord,
  ExpenseEntry,
  Firm,
  Matter,
  MatterParty,
  TimeEntry,
  User,
  MatterLifecycleTransitionRecord,
} from "@open-practice/domain";

export interface MatterSummary extends Matter {
  parties: Array<MatterParty & { contact: Contact }>;
  documents: DocumentRecord[];
  timeEntries: TimeEntry[];
  expenses: ExpenseEntry[];
  activity: ActivityTimelineEntry[];
  trustBalanceCents: number;
  setupProfile: MatterSetupProfile;
  lifecycleTransitions: MatterLifecycleTransitionRecord[];
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

export interface MatterWorkspaceRepository {
  getOverview(firmId: string): Promise<PracticeOverview>;
  listMattersForUser(user: User): Promise<MatterSummary[]>;
}
