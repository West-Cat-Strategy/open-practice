import type {
  AnswerSnapshotRecord,
  IntakeFormItemActionRecord,
  IntakeFormLinkRecord,
  IntakeFormReviewRecord,
  IntakeSessionRecord,
  IntakeVariableProposal,
} from "@open-practice/domain";

export interface IntakeSessionListOptions {
  matterId?: string;
}

export interface IntakeFormLinkListOptions {
  matterId?: string;
  intakeSessionId?: string;
}

export interface IntakeFormReviewListOptions {
  matterId?: string;
  intakeSessionId?: string;
  formLinkId?: string;
}

export interface IntakeFormItemActionListOptions {
  formLinkId?: string;
  intakeSessionId?: string;
  itemId?: string;
}

export interface AnswerSnapshotListOptions {
  intakeSessionId?: string;
}

export interface IntakeVariableProposalListOptions {
  matterId?: string;
  status?: IntakeVariableProposal["status"];
}

export interface IntakeFormsRepository {
  listIntakeSessions(
    firmId: string,
    options?: IntakeSessionListOptions,
  ): Promise<IntakeSessionRecord[]>;
  getIntakeSession(firmId: string, sessionId: string): Promise<IntakeSessionRecord | undefined>;
  createIntakeSession(session: IntakeSessionRecord): Promise<IntakeSessionRecord>;
  listIntakeFormLinks(
    firmId: string,
    options?: IntakeFormLinkListOptions,
  ): Promise<IntakeFormLinkRecord[]>;
  createIntakeFormLink(link: IntakeFormLinkRecord): Promise<IntakeFormLinkRecord>;
  getIntakeFormLink(firmId: string, id: string): Promise<IntakeFormLinkRecord | undefined>;
  getIntakeFormLinkByTokenHash(tokenHash: string): Promise<IntakeFormLinkRecord | undefined>;
  revokeIntakeFormLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<IntakeFormLinkRecord | undefined>;
  markIntakeFormLinkSubmitted(input: {
    firmId: string;
    id: string;
    submittedAt: string;
    answerSnapshotId: string;
  }): Promise<IntakeFormLinkRecord | undefined>;
  reserveIntakeFormLinkSubmission(input: {
    firmId: string;
    id: string;
    clientSubmissionId: string;
    submissionFingerprint: string;
  }): Promise<IntakeFormLinkRecord | undefined>;
  saveIntakeFormLinkDraft(input: {
    firmId: string;
    id: string;
    answers: Record<string, unknown>;
    draftUpdatedAt: string;
  }): Promise<IntakeFormLinkRecord | undefined>;
  listIntakeFormReviews(
    firmId: string,
    options?: IntakeFormReviewListOptions,
  ): Promise<IntakeFormReviewRecord[]>;
  createIntakeFormReview(review: IntakeFormReviewRecord): Promise<IntakeFormReviewRecord>;
  listIntakeFormItemActions(
    firmId: string,
    options?: IntakeFormItemActionListOptions,
  ): Promise<IntakeFormItemActionRecord[]>;
  upsertIntakeFormItemAction(
    action: IntakeFormItemActionRecord,
  ): Promise<IntakeFormItemActionRecord>;
  createAnswerSnapshot(snapshot: AnswerSnapshotRecord): Promise<AnswerSnapshotRecord>;
  listAnswerSnapshots(
    firmId: string,
    options?: AnswerSnapshotListOptions,
  ): Promise<AnswerSnapshotRecord[]>;
  createIntakeVariableProposals(
    proposals: IntakeVariableProposal[],
  ): Promise<IntakeVariableProposal[]>;
  listIntakeVariableProposals(
    firmId: string,
    options?: IntakeVariableProposalListOptions,
  ): Promise<IntakeVariableProposal[]>;
  reviewIntakeVariableProposal(input: {
    firmId: string;
    id: string;
    status: "approved" | "rejected";
    reviewedByUserId: string;
    reviewedAt: string;
    rejectionReason?: string;
  }): Promise<IntakeVariableProposal | undefined>;
}
