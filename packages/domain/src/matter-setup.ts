import type {
  ActivityTimelineEntry,
  DocumentRecord,
  ExpenseEntry,
  Matter,
  MatterParty,
  MatterStatus,
  TimeEntry,
  User,
} from "./models.js";

export type MatterSetupCueState = "complete" | "needs_attention" | "review";

export type MatterSetupResponsibleUserState =
  | "assigned"
  | "missing_assignment"
  | "responsible_user_mismatch"
  | "responsible_user_missing";

export interface MatterSetupStageDefinition {
  key: MatterStatus;
  label: string;
  description: string;
}

export interface MatterSetupResponsibleUserPosture {
  state: MatterSetupResponsibleUserState;
  responsibleUserId: string;
  responsibleUserDisplayName?: string;
  assignedUserIds: string[];
  assignedUserDisplayNames: string[];
  label: string;
  description: string;
}

export interface MatterSetupFieldDefinition {
  key: "practiceArea" | "jurisdiction" | "openedOn" | "closedOn" | "status";
  label: string;
  description: string;
  source: keyof Matter;
  state: MatterSetupCueState;
}

export interface MatterSetupChecklistCue {
  key:
    | "parties"
    | "documents"
    | "activity"
    | "conflicts"
    | "trust_balance"
    | "unbilled_work"
    | "review";
  label: string;
  description: string;
  state: MatterSetupCueState;
  count?: number;
}

export interface MatterSetupFinancialSnapshot {
  trustBalanceCents: number;
  unbilledTimeEntryCount: number;
  unbilledMinutes: number;
  unbilledExpenseCount: number;
  unbilledExpenseCents: number;
  cues: MatterSetupChecklistCue[];
  caution: string;
}

export interface MatterSetupProfile {
  stage: MatterSetupStageDefinition;
  responsibleUser: MatterSetupResponsibleUserPosture;
  fieldDefinitions: MatterSetupFieldDefinition[];
  checklist: MatterSetupChecklistCue[];
  financialSnapshot: MatterSetupFinancialSnapshot;
}

export interface BuildMatterSetupProfileInput {
  matter: Matter;
  parties?: MatterParty[];
  documents?: DocumentRecord[];
  activity?: ActivityTimelineEntry[];
  trustBalanceCents?: number;
  timeEntries?: TimeEntry[];
  expenses?: ExpenseEntry[];
  users?: User[];
}

const stageDefinitions: Record<MatterStatus, MatterSetupStageDefinition> = {
  intake: {
    key: "intake",
    label: "Intake",
    description: "Initial details are being gathered before active work.",
  },
  open: {
    key: "open",
    label: "Open",
    description: "The matter is active and ready for ongoing work.",
  },
  paused: {
    key: "paused",
    label: "Paused",
    description: "Work is on hold and should be reviewed before resuming.",
  },
  closed: {
    key: "closed",
    label: "Closed",
    description: "Substantive work is complete and closure details remain visible.",
  },
  archived: {
    key: "archived",
    label: "Archived",
    description: "The matter is retained for record access.",
  },
};

export function matterSetupStageDefinition(status: MatterStatus): MatterSetupStageDefinition {
  return stageDefinitions[status];
}

export function buildMatterSetupProfile(input: BuildMatterSetupProfileInput): MatterSetupProfile {
  const parties = input.parties ?? [];
  const documents = input.documents ?? [];
  const activity = input.activity ?? [];
  const timeEntries = input.timeEntries ?? [];
  const expenses = input.expenses ?? [];
  const users = input.users ?? [];
  const assignedUsers = users.filter((user) => user.assignedMatterIds.includes(input.matter.id));
  const responsibleUser = users.find((user) => user.id === input.matter.responsibleUserId);
  const responsibleAssigned = assignedUsers.some(
    (user) => user.id === input.matter.responsibleUserId,
  );
  const hasConflictCue =
    activity.some((entry) => entry.kind === "conflict") || parties.some((party) => party.adverse);
  const hasReviewCue =
    documents.some((document) => document.reviewStatus !== "not_required") ||
    activity.some((entry) => entry.kind === "task" || entry.kind === "upload");
  const unbilledTimeEntries = timeEntries.filter(
    (entry) => entry.billable && ["draft", "submitted", "approved"].includes(entry.billingStatus),
  );
  const unbilledExpenses = expenses.filter(
    (entry) =>
      entry.reimbursable && ["draft", "submitted", "approved"].includes(entry.billingStatus),
  );
  const trustBalanceCents = input.trustBalanceCents ?? 0;
  const financialSnapshot: MatterSetupFinancialSnapshot = {
    trustBalanceCents,
    unbilledTimeEntryCount: unbilledTimeEntries.length,
    unbilledMinutes: unbilledTimeEntries.reduce((sum, entry) => sum + entry.minutes, 0),
    unbilledExpenseCount: unbilledExpenses.length,
    unbilledExpenseCents: unbilledExpenses.reduce((sum, entry) => sum + entry.amountCents, 0),
    cues: [
      {
        key: "trust_balance",
        label: "Trust balance",
        description:
          trustBalanceCents === 0
            ? "No trust balance is shown for this matter."
            : "A trust balance is shown and should be reviewed against source records.",
        state: trustBalanceCents === 0 ? "complete" : "review",
      },
      {
        key: "unbilled_work",
        label: "Unbilled work",
        description:
          unbilledTimeEntries.length + unbilledExpenses.length === 0
            ? "No unbilled time or reimbursable expense cues are shown."
            : "Unbilled time or reimbursable expense cues are available for review.",
        state: unbilledTimeEntries.length + unbilledExpenses.length === 0 ? "complete" : "review",
        count: unbilledTimeEntries.length + unbilledExpenses.length,
      },
    ],
    caution:
      "Financial cues are read-only setup context and are not trust postings, payment movement, or certified accounting advice.",
  };

  return {
    stage: matterSetupStageDefinition(input.matter.status),
    responsibleUser: buildResponsibleUserPosture({
      responsibleUserId: input.matter.responsibleUserId,
      responsibleUserDisplayName: responsibleUser?.displayName,
      assignedUsers,
      responsibleAssigned,
      responsibleUserFound: Boolean(responsibleUser),
    }),
    fieldDefinitions: buildFieldDefinitions(input.matter),
    checklist: [
      {
        key: "parties",
        label: "Parties",
        description:
          parties.length > 0
            ? "Party links are present for setup review."
            : "Add party links before relying on matter setup.",
        state: parties.length > 0 ? "complete" : "needs_attention",
        count: parties.length,
      },
      {
        key: "documents",
        label: "Documents",
        description:
          documents.length > 0
            ? "Document records are present for setup review."
            : "No document records are linked yet.",
        state: documents.length > 0 ? "complete" : "needs_attention",
        count: documents.length,
      },
      {
        key: "activity",
        label: "Activity",
        description:
          activity.length > 0
            ? "Matter activity is available for setup context."
            : "No matter activity is visible yet.",
        state: activity.length > 0 ? "complete" : "needs_attention",
        count: activity.length,
      },
      {
        key: "conflicts",
        label: "Conflict cues",
        description: hasConflictCue
          ? "Conflict or adverse-party cues are visible for review."
          : "No visible conflict or adverse-party cues are shown.",
        state: hasConflictCue ? "review" : "complete",
      },
      {
        key: "review",
        label: "Review posture",
        description: hasReviewCue
          ? "Document, upload, or task review cues are visible."
          : "No visible review cues are shown.",
        state: hasReviewCue ? "review" : "complete",
      },
      ...financialSnapshot.cues,
    ],
    financialSnapshot,
  };
}

function buildResponsibleUserPosture(input: {
  responsibleUserId: string;
  responsibleUserDisplayName?: string;
  assignedUsers: User[];
  responsibleAssigned: boolean;
  responsibleUserFound: boolean;
}): MatterSetupResponsibleUserPosture {
  const assignedUserIds = input.assignedUsers.map((user) => user.id);
  const assignedUserDisplayNames = input.assignedUsers.map((user) => user.displayName);
  if (!input.responsibleUserFound) {
    return {
      state: "responsible_user_missing",
      responsibleUserId: input.responsibleUserId,
      assignedUserIds,
      assignedUserDisplayNames,
      label: "Responsible user missing",
      description: "The responsible user is not visible in the available user context.",
    };
  }
  if (input.responsibleAssigned) {
    return {
      state: "assigned",
      responsibleUserId: input.responsibleUserId,
      responsibleUserDisplayName: input.responsibleUserDisplayName,
      assignedUserIds,
      assignedUserDisplayNames,
      label: "Responsible user assigned",
      description: "The responsible user is assigned to the matter.",
    };
  }
  if (assignedUserIds.length === 0) {
    return {
      state: "missing_assignment",
      responsibleUserId: input.responsibleUserId,
      responsibleUserDisplayName: input.responsibleUserDisplayName,
      assignedUserIds,
      assignedUserDisplayNames,
      label: "Assignment missing",
      description: "No visible user assignment is linked to this matter.",
    };
  }
  return {
    state: "responsible_user_mismatch",
    responsibleUserId: input.responsibleUserId,
    responsibleUserDisplayName: input.responsibleUserDisplayName,
    assignedUserIds,
    assignedUserDisplayNames,
    label: "Responsible user mismatch",
    description: "Visible assignments do not include the responsible user.",
  };
}

function buildFieldDefinitions(matter: Matter): MatterSetupFieldDefinition[] {
  const fields: MatterSetupFieldDefinition[] = [
    {
      key: "practiceArea",
      label: "Practice area",
      description: "Matter practice area field.",
      source: "practiceArea",
      state: matter.practiceArea.trim() ? "complete" : "needs_attention",
    },
    {
      key: "jurisdiction",
      label: "Jurisdiction",
      description: "Matter jurisdiction field.",
      source: "jurisdiction",
      state: matter.jurisdiction ? "complete" : "needs_attention",
    },
    {
      key: "openedOn",
      label: "Opened on",
      description: "Matter opening date field.",
      source: "openedOn",
      state: matter.openedOn ? "complete" : "needs_attention",
    },
    {
      key: "status",
      label: "Status",
      description: "Matter lifecycle status field.",
      source: "status",
      state: "complete",
    },
  ];
  if (matter.status === "closed" || matter.status === "archived" || matter.closedOn) {
    fields.push({
      key: "closedOn",
      label: "Closed on",
      description: "Matter closure date field.",
      source: "closedOn",
      state: matter.closedOn ? "complete" : "needs_attention",
    });
  }
  return fields;
}
