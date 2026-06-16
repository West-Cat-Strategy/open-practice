import type {
  ContactIdentifier,
  ContactKind,
  MatterLifecycleReadiness,
  MatterLifecycleTransition,
  MatterLifecycleTransitionRecord,
  Province,
  PublicConsultationIntakeRecord,
} from "@open-practice/domain";
import type { MatterSummary } from "./matter-workspace-contracts.js";

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
}
