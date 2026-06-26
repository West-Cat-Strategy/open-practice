import type {
  AnswerSnapshotRecord,
  Contact,
  IntakeFormItemActionRecord,
  IntakeFormLinkRecord,
  IntakeFormReviewRecord,
  IntakeSessionRecord,
  IntakeVariableProposal,
  Matter,
} from "@open-practice/domain";
import { clone } from "../contracts.js";
import type {
  AnswerSnapshotListOptions,
  IntakeFormItemActionListOptions,
  IntakeFormLinkListOptions,
  IntakeFormReviewListOptions,
  IntakeSessionListOptions,
  IntakeVariableProposalListOptions,
} from "../intake-forms-contracts.js";

export interface MemoryIntakeFormsStore {
  intakeSessions: IntakeSessionRecord[];
  answerSnapshots: AnswerSnapshotRecord[];
  intakeFormLinks: IntakeFormLinkRecord[];
  intakeFormReviews: IntakeFormReviewRecord[];
  intakeFormItemActions: IntakeFormItemActionRecord[];
  intakeVariableProposals: IntakeVariableProposal[];
  contacts: Contact[];
  matters: Matter[];
}

export function listMemoryIntakeSessions(
  store: MemoryIntakeFormsStore,
  firmId: string,
  options: IntakeSessionListOptions = {},
): Promise<IntakeSessionRecord[]> {
  return Promise.resolve(
    clone(
      store.intakeSessions.filter(
        (session) =>
          session.firmId === firmId && (!options.matterId || session.matterId === options.matterId),
      ),
    ),
  );
}

export function getMemoryIntakeSession(
  store: MemoryIntakeFormsStore,
  firmId: string,
  sessionId: string,
): Promise<IntakeSessionRecord | undefined> {
  return Promise.resolve(
    clone(
      store.intakeSessions.find((session) => session.firmId === firmId && session.id === sessionId),
    ),
  );
}

export function createMemoryIntakeSession(
  store: MemoryIntakeFormsStore,
  session: IntakeSessionRecord,
): Promise<IntakeSessionRecord> {
  store.intakeSessions = [...store.intakeSessions, clone(session)];
  return Promise.resolve(clone(session));
}

export function listMemoryIntakeFormLinks(
  store: MemoryIntakeFormsStore,
  firmId: string,
  options: IntakeFormLinkListOptions = {},
): Promise<IntakeFormLinkRecord[]> {
  return Promise.resolve(
    clone(
      store.intakeFormLinks
        .filter(
          (link) =>
            link.firmId === firmId &&
            (!options.matterId || link.matterId === options.matterId) &&
            (!options.intakeSessionId || link.intakeSessionId === options.intakeSessionId),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    ),
  );
}

export function createMemoryIntakeFormLink(
  store: MemoryIntakeFormsStore,
  link: IntakeFormLinkRecord,
): Promise<IntakeFormLinkRecord> {
  if (store.intakeFormLinks.some((existing) => existing.tokenHash === link.tokenHash)) {
    throw new Error("Intake form link token hash already exists");
  }
  store.intakeFormLinks = [...store.intakeFormLinks, clone(link)];
  return Promise.resolve(clone(link));
}

export function getMemoryIntakeFormLink(
  store: MemoryIntakeFormsStore,
  firmId: string,
  id: string,
): Promise<IntakeFormLinkRecord | undefined> {
  return Promise.resolve(
    clone(store.intakeFormLinks.find((link) => link.firmId === firmId && link.id === id)),
  );
}

export function getMemoryIntakeFormLinkByTokenHash(
  store: MemoryIntakeFormsStore,
  tokenHash: string,
): Promise<IntakeFormLinkRecord | undefined> {
  return Promise.resolve(clone(store.intakeFormLinks.find((link) => link.tokenHash === tokenHash)));
}

export function revokeMemoryIntakeFormLink(
  store: MemoryIntakeFormsStore,
  input: {
    firmId: string;
    id: string;
    revokedAt: string;
  },
): Promise<IntakeFormLinkRecord | undefined> {
  const link = store.intakeFormLinks.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
  );
  if (!link) return Promise.resolve(undefined);
  link.revokedAt = input.revokedAt;
  return Promise.resolve(clone(link));
}

export function markMemoryIntakeFormLinkSubmitted(
  store: MemoryIntakeFormsStore,
  input: {
    firmId: string;
    id: string;
    submittedAt: string;
    answerSnapshotId: string;
  },
): Promise<IntakeFormLinkRecord | undefined> {
  const link = store.intakeFormLinks.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
  );
  if (!link || link.submittedAt || link.revokedAt) return Promise.resolve(undefined);
  link.submittedAt = input.submittedAt;
  link.answerSnapshotId = input.answerSnapshotId;
  return Promise.resolve(clone(link));
}

export function reserveMemoryIntakeFormLinkSubmission(
  store: MemoryIntakeFormsStore,
  input: {
    firmId: string;
    id: string;
    clientSubmissionId: string;
    submissionFingerprint: string;
  },
): Promise<IntakeFormLinkRecord | undefined> {
  const link = store.intakeFormLinks.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
  );
  if (!link || link.revokedAt) return Promise.resolve(clone(link));
  if (!link.submittedAt && !link.clientSubmissionId) {
    link.clientSubmissionId = input.clientSubmissionId;
    link.submissionFingerprint = input.submissionFingerprint;
  }
  return Promise.resolve(clone(link));
}

export function saveMemoryIntakeFormLinkDraft(
  store: MemoryIntakeFormsStore,
  input: {
    firmId: string;
    id: string;
    answers: Record<string, unknown>;
    draftUpdatedAt: string;
  },
): Promise<IntakeFormLinkRecord | undefined> {
  const link = store.intakeFormLinks.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
  );
  if (!link || link.revokedAt || link.submittedAt) return Promise.resolve(clone(link));
  link.draftAnswers = clone(input.answers);
  link.draftUpdatedAt = input.draftUpdatedAt;
  return Promise.resolve(clone(link));
}

export function listMemoryIntakeFormReviews(
  store: MemoryIntakeFormsStore,
  firmId: string,
  options: IntakeFormReviewListOptions = {},
): Promise<IntakeFormReviewRecord[]> {
  return Promise.resolve(
    clone(
      store.intakeFormReviews
        .filter(
          (review) =>
            review.firmId === firmId &&
            (!options.matterId || review.matterId === options.matterId) &&
            (!options.intakeSessionId || review.intakeSessionId === options.intakeSessionId) &&
            (!options.formLinkId || review.formLinkId === options.formLinkId),
        )
        .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt)),
    ),
  );
}

export function createMemoryIntakeFormReview(
  store: MemoryIntakeFormsStore,
  review: IntakeFormReviewRecord,
): Promise<IntakeFormReviewRecord> {
  if (
    store.intakeFormReviews.some(
      (existing) => existing.firmId === review.firmId && existing.formLinkId === review.formLinkId,
    )
  ) {
    throw new Error("Intake form link has already been reviewed");
  }
  store.intakeFormReviews = [...store.intakeFormReviews, clone(review)];
  return Promise.resolve(clone(review));
}

export function listMemoryIntakeFormItemActions(
  store: MemoryIntakeFormsStore,
  firmId: string,
  options: IntakeFormItemActionListOptions = {},
): Promise<IntakeFormItemActionRecord[]> {
  return Promise.resolve(
    clone(
      store.intakeFormItemActions.filter(
        (action) =>
          action.firmId === firmId &&
          (!options.formLinkId || action.formLinkId === options.formLinkId) &&
          (!options.intakeSessionId || action.intakeSessionId === options.intakeSessionId) &&
          (!options.itemId || action.itemId === options.itemId),
      ),
    ),
  );
}

export function upsertMemoryIntakeFormItemAction(
  store: MemoryIntakeFormsStore,
  action: IntakeFormItemActionRecord,
): Promise<IntakeFormItemActionRecord> {
  const existingIndex = store.intakeFormItemActions.findIndex(
    (candidate) => candidate.firmId === action.firmId && candidate.id === action.id,
  );
  if (existingIndex >= 0) {
    store.intakeFormItemActions[existingIndex] = clone(action);
  } else {
    store.intakeFormItemActions = [...store.intakeFormItemActions, clone(action)];
  }
  return Promise.resolve(clone(action));
}

export function createMemoryAnswerSnapshot(
  store: MemoryIntakeFormsStore,
  snapshot: AnswerSnapshotRecord,
): Promise<AnswerSnapshotRecord> {
  store.answerSnapshots = [...store.answerSnapshots, clone(snapshot)];
  return Promise.resolve(clone(snapshot));
}

export function listMemoryAnswerSnapshots(
  store: MemoryIntakeFormsStore,
  firmId: string,
  options: AnswerSnapshotListOptions = {},
): Promise<AnswerSnapshotRecord[]> {
  return Promise.resolve(
    clone(
      store.answerSnapshots.filter(
        (snapshot) =>
          snapshot.firmId === firmId &&
          (!options.intakeSessionId || snapshot.intakeSessionId === options.intakeSessionId),
      ),
    ),
  );
}

export function createMemoryIntakeVariableProposals(
  store: MemoryIntakeFormsStore,
  proposals: IntakeVariableProposal[],
): Promise<IntakeVariableProposal[]> {
  const newIds = new Set(proposals.map((proposal) => proposal.id));
  store.intakeVariableProposals = [
    ...store.intakeVariableProposals.filter((proposal) => !newIds.has(proposal.id)),
    ...clone(proposals),
  ];
  return Promise.resolve(clone(proposals));
}

export function listMemoryIntakeVariableProposals(
  store: MemoryIntakeFormsStore,
  firmId: string,
  options: IntakeVariableProposalListOptions = {},
): Promise<IntakeVariableProposal[]> {
  return Promise.resolve(
    clone(
      store.intakeVariableProposals.filter(
        (proposal) =>
          proposal.firmId === firmId &&
          (!options.matterId || proposal.matterId === options.matterId) &&
          (!options.status || proposal.status === options.status),
      ),
    ),
  );
}

export function reviewMemoryIntakeVariableProposal(
  store: MemoryIntakeFormsStore,
  input: {
    firmId: string;
    id: string;
    status: "approved" | "rejected";
    reviewedByUserId: string;
    reviewedAt: string;
    rejectionReason?: string;
  },
): Promise<IntakeVariableProposal | undefined> {
  const proposal = store.intakeVariableProposals.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
  );
  if (!proposal || proposal.status !== "pending") return Promise.resolve(undefined);
  proposal.status = input.status;
  proposal.reviewedByUserId = input.reviewedByUserId;
  proposal.reviewedAt = input.reviewedAt;
  proposal.rejectionReason = input.status === "rejected" ? input.rejectionReason : undefined;
  if (input.status === "approved") {
    applyMemoryVariableProposal(store, proposal);
    proposal.appliedAt = input.reviewedAt;
  }
  return Promise.resolve(clone(proposal));
}

function applyMemoryVariableProposal(
  store: MemoryIntakeFormsStore,
  proposal: IntakeVariableProposal,
): void {
  if (proposal.targetScope === "client") {
    const contact = store.contacts.find(
      (candidate) =>
        candidate.firmId === proposal.firmId && candidate.id === proposal.targetRecordId,
    );
    if (!contact) throw new Error(`Unknown intake proposal contact ${proposal.targetRecordId}`);
    if (proposal.targetField === "displayName") contact.displayName = proposal.proposedValue;
    if (proposal.targetField === "notes") contact.notes = proposal.proposedValue;
    if (proposal.targetField === "preferredLanguage") {
      contact.preferredLanguage = proposal.proposedValue;
    }
    if (proposal.targetField === "timezone") contact.timezone = proposal.proposedValue;
    if (proposal.targetField === "communicationNotes") {
      contact.communicationNotes = proposal.proposedValue;
    }
    if (proposal.targetField === "email" || proposal.targetField === "phone") {
      const type = proposal.targetField;
      const hasIdentifier = contact.identifiers.some(
        (identifier) => identifier.type === type && identifier.value === proposal.proposedValue,
      );
      if (!hasIdentifier) {
        contact.identifiers = [
          ...contact.identifiers,
          {
            type,
            value: proposal.proposedValue,
            label: "intake",
            conflictCheckIncluded: true,
            verified: false,
          },
        ];
      }
      const existingMethods = contact.contactMethods ?? [];
      const hasMethod = existingMethods.some(
        (method) => method.type === type && method.value === proposal.proposedValue,
      );
      if (!hasMethod) {
        contact.contactMethods = [
          ...existingMethods,
          {
            id: `intake-${type}-${proposal.id}`,
            type,
            label: type === "email" ? "work" : "mobile",
            value: proposal.proposedValue,
            verificationStatus: "review_needed",
            conflictCheckIncluded: true,
          },
        ];
      }
    }
    if (proposal.targetField === "address") {
      const existingMethods = contact.contactMethods ?? [];
      const hasMethod = existingMethods.some(
        (method) => method.type === "address" && method.value === proposal.proposedValue,
      );
      if (!hasMethod) {
        contact.contactMethods = [
          ...existingMethods,
          {
            id: `intake-address-${proposal.id}`,
            type: "address",
            label: "service",
            value: proposal.proposedValue,
            verificationStatus: "review_needed",
            conflictCheckIncluded: true,
          },
        ];
      }
    }
    return;
  }
  const matter = store.matters.find(
    (candidate) => candidate.firmId === proposal.firmId && candidate.id === proposal.targetRecordId,
  );
  if (!matter) throw new Error(`Unknown intake proposal matter ${proposal.targetRecordId}`);
  if (proposal.targetField === "title") matter.title = proposal.proposedValue;
  if (proposal.targetField === "practiceArea") matter.practiceArea = proposal.proposedValue;
  if (proposal.targetField === "jurisdiction") {
    if (!["BC", "ON", "CANADA", "OTHER"].includes(proposal.proposedValue)) {
      throw new Error(`Unsupported intake proposal jurisdiction ${proposal.proposedValue}`);
    }
    matter.jurisdiction = proposal.proposedValue as Matter["jurisdiction"];
  }
}
