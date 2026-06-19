import type {
  ContactIdentifier,
  ContactKind,
  MatterLifecycleCommand,
  MatterLifecycleCommandExecution,
  MatterLifecycleReadiness,
  MatterLifecycleTransition,
  MatterLifecycleTransitionRecord,
  MatterStatus,
  Province,
  PublicConsultationIntakeRecord,
} from "@open-practice/domain";
import type { MatterSummary } from "./matter-workspace-contracts.js";

export type MatterLifecycleCommandErrorCode =
  | "MATTER_LIFECYCLE_EXPECTED_STATUS_MISMATCH"
  | "MATTER_LIFECYCLE_COMMAND_NOT_AVAILABLE"
  | "MATTER_LIFECYCLE_READINESS_NOT_READY"
  | "MATTER_LIFECYCLE_MATTER_NOT_FOUND";

export class MatterLifecycleCommandError extends Error {
  code: MatterLifecycleCommandErrorCode;
  details?: unknown;

  constructor(code: MatterLifecycleCommandErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "MatterLifecycleCommandError";
    this.code = code;
    this.details = details;
  }
}

export interface CreateMatterWithClientInput {
  firmId: string;
  actorUserId: string;
  matterId: string;
  contactId: string;
  partyId: string;
  title: string;
  practiceArea: string;
  jurisdiction: Province;
  openedOn: string;
  occurredAt: string;
  auditEventId: string;
  client?: {
    kind: ContactKind;
    displayName: string;
    identifiers: ContactIdentifier[];
  };
}

export interface ConvertPublicConsultationIntakeInput {
  firmId: string;
  intakeId: string;
  actorUserId: string;
  matterId: string;
  clientContactId: string;
  clientPartyId: string;
  opposingParties: Array<{
    contactId: string;
    partyId: string;
    displayName: string;
  }>;
  title: string;
  practiceArea: string;
  jurisdiction: Province;
  openedOn: string;
  occurredAt: string;
  auditEventId: string;
}

export interface MatterLifecycleRepository {
  createMatterWithClient(input: CreateMatterWithClientInput): Promise<MatterSummary>;
  convertPublicConsultationIntakeToMatter(
    input: ConvertPublicConsultationIntakeInput,
  ): Promise<{ intake: PublicConsultationIntakeRecord; matter: MatterSummary }>;
  listMatterLifecycleTransitions(
    firmId: string,
    matterId: string,
  ): Promise<MatterLifecycleTransitionRecord[]>;
  createMatterLifecycleTransition(input: {
    id: string;
    firmId: string;
    matterId: string;
    transition: MatterLifecycleTransition;
    readiness: MatterLifecycleReadiness;
    reason: string;
    blockers?: string[];
    reviewedByUserId: string;
    reviewedAt: string;
    createdAt: string;
    auditEventId: string;
  }): Promise<MatterLifecycleTransitionRecord>;
  executeMatterLifecycleCommand(input: {
    firmId: string;
    matterId: string;
    command: MatterLifecycleCommand;
    expectedStatus: MatterStatus;
    transitionRecordId: string;
    reason: string;
    idempotencyKey: string;
    executedByUserId: string;
    executedAt: string;
    auditEventId: string;
  }): Promise<{ matter: MatterSummary; lifecycleCommand: MatterLifecycleCommandExecution }>;
}
