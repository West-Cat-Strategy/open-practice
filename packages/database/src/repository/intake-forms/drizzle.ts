import type {
  AnswerSnapshotRecord,
  IntakeFormItemActionRecord,
  IntakeFormLinkRecord,
  IntakeFormReviewRecord,
  IntakeSessionRecord,
  IntakeVariableProposal,
} from "@open-practice/domain";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import {
  applyVariableProposalWithTx,
  intakeFormItemActionInsert,
  intakeFormLinkInsert,
  intakeFormReviewInsert,
  intakeVariableProposalInsert,
  mapAnswerSnapshotRow,
  mapIntakeFormItemActionRow,
  mapIntakeFormLinkRow,
  mapIntakeFormReviewRow,
  mapIntakeSessionRow,
  mapIntakeVariableProposalRow,
} from "../drizzle-mappers.js";
import type {
  AnswerSnapshotListOptions,
  IntakeFormItemActionListOptions,
  IntakeFormLinkListOptions,
  IntakeFormReviewListOptions,
  IntakeSessionListOptions,
  IntakeVariableProposalListOptions,
} from "../intake-forms-contracts.js";

export async function listDrizzleIntakeSessions(
  db: OpenPracticeDatabase,
  firmId: string,
  options: IntakeSessionListOptions = {},
): Promise<IntakeSessionRecord[]> {
  const rows = await db
    .select()
    .from(schema.intakeSessions)
    .where(
      options.matterId
        ? and(
            eq(schema.intakeSessions.firmId, firmId),
            eq(schema.intakeSessions.matterId, options.matterId),
          )
        : eq(schema.intakeSessions.firmId, firmId),
    );
  return rows.map(mapIntakeSessionRow);
}

export async function getDrizzleIntakeSession(
  db: OpenPracticeDatabase,
  firmId: string,
  sessionId: string,
): Promise<IntakeSessionRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.intakeSessions)
    .where(and(eq(schema.intakeSessions.firmId, firmId), eq(schema.intakeSessions.id, sessionId)));
  return row ? mapIntakeSessionRow(row) : undefined;
}

export async function createDrizzleIntakeSession(
  db: OpenPracticeDatabase,
  session: IntakeSessionRecord,
): Promise<IntakeSessionRecord> {
  await db.insert(schema.intakeSessions).values({
    ...session,
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
  });
  return session;
}

export async function listDrizzleIntakeFormLinks(
  db: OpenPracticeDatabase,
  firmId: string,
  options: IntakeFormLinkListOptions = {},
): Promise<IntakeFormLinkRecord[]> {
  const conditions = [eq(schema.intakeFormLinks.firmId, firmId)];
  if (options.matterId) conditions.push(eq(schema.intakeFormLinks.matterId, options.matterId));
  if (options.intakeSessionId) {
    conditions.push(eq(schema.intakeFormLinks.intakeSessionId, options.intakeSessionId));
  }
  const rows = await db
    .select()
    .from(schema.intakeFormLinks)
    .where(and(...conditions))
    .orderBy(desc(schema.intakeFormLinks.createdAt));
  return rows.map(mapIntakeFormLinkRow);
}

export async function createDrizzleIntakeFormLink(
  db: OpenPracticeDatabase,
  link: IntakeFormLinkRecord,
): Promise<IntakeFormLinkRecord> {
  const [row] = await db
    .insert(schema.intakeFormLinks)
    .values(intakeFormLinkInsert(link))
    .returning();
  return mapIntakeFormLinkRow(row);
}

export async function getDrizzleIntakeFormLink(
  db: OpenPracticeDatabase,
  firmId: string,
  id: string,
): Promise<IntakeFormLinkRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.intakeFormLinks)
    .where(and(eq(schema.intakeFormLinks.firmId, firmId), eq(schema.intakeFormLinks.id, id)));
  return row ? mapIntakeFormLinkRow(row) : undefined;
}

export async function getDrizzleIntakeFormLinkByTokenHash(
  db: OpenPracticeDatabase,
  tokenHash: string,
): Promise<IntakeFormLinkRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.intakeFormLinks)
    .where(eq(schema.intakeFormLinks.tokenHash, tokenHash));
  return row ? mapIntakeFormLinkRow(row) : undefined;
}

export async function revokeDrizzleIntakeFormLink(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    id: string;
    revokedAt: string;
  },
): Promise<IntakeFormLinkRecord | undefined> {
  const [row] = await db
    .update(schema.intakeFormLinks)
    .set({ revokedAt: new Date(input.revokedAt) })
    .where(
      and(eq(schema.intakeFormLinks.firmId, input.firmId), eq(schema.intakeFormLinks.id, input.id)),
    )
    .returning();
  return row ? mapIntakeFormLinkRow(row) : undefined;
}

export async function markDrizzleIntakeFormLinkSubmitted(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    id: string;
    submittedAt: string;
    answerSnapshotId: string;
  },
): Promise<IntakeFormLinkRecord | undefined> {
  const [row] = await db
    .update(schema.intakeFormLinks)
    .set({
      submittedAt: new Date(input.submittedAt),
      answerSnapshotId: input.answerSnapshotId,
    })
    .where(
      and(
        eq(schema.intakeFormLinks.firmId, input.firmId),
        eq(schema.intakeFormLinks.id, input.id),
        isNull(schema.intakeFormLinks.revokedAt),
        isNull(schema.intakeFormLinks.submittedAt),
      ),
    )
    .returning();
  return row ? mapIntakeFormLinkRow(row) : undefined;
}

export async function reserveDrizzleIntakeFormLinkSubmission(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    id: string;
    clientSubmissionId: string;
    submissionFingerprint: string;
  },
): Promise<IntakeFormLinkRecord | undefined> {
  const [row] = await db
    .update(schema.intakeFormLinks)
    .set({
      clientSubmissionId: input.clientSubmissionId,
      submissionFingerprint: input.submissionFingerprint,
    })
    .where(
      and(
        eq(schema.intakeFormLinks.firmId, input.firmId),
        eq(schema.intakeFormLinks.id, input.id),
        isNull(schema.intakeFormLinks.revokedAt),
        isNull(schema.intakeFormLinks.submittedAt),
        isNull(schema.intakeFormLinks.clientSubmissionId),
      ),
    )
    .returning();
  if (row) return mapIntakeFormLinkRow(row);
  return getDrizzleIntakeFormLink(db, input.firmId, input.id);
}

export async function saveDrizzleIntakeFormLinkDraft(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    id: string;
    answers: Record<string, unknown>;
    draftUpdatedAt: string;
  },
): Promise<IntakeFormLinkRecord | undefined> {
  const [row] = await db
    .update(schema.intakeFormLinks)
    .set({
      draftAnswers: input.answers,
      draftUpdatedAt: new Date(input.draftUpdatedAt),
    })
    .where(
      and(
        eq(schema.intakeFormLinks.firmId, input.firmId),
        eq(schema.intakeFormLinks.id, input.id),
        isNull(schema.intakeFormLinks.revokedAt),
        isNull(schema.intakeFormLinks.submittedAt),
      ),
    )
    .returning();
  return row ? mapIntakeFormLinkRow(row) : getDrizzleIntakeFormLink(db, input.firmId, input.id);
}

export async function listDrizzleIntakeFormReviews(
  db: OpenPracticeDatabase,
  firmId: string,
  options: IntakeFormReviewListOptions = {},
): Promise<IntakeFormReviewRecord[]> {
  const conditions = [eq(schema.intakeFormReviews.firmId, firmId)];
  if (options.matterId) conditions.push(eq(schema.intakeFormReviews.matterId, options.matterId));
  if (options.intakeSessionId) {
    conditions.push(eq(schema.intakeFormReviews.intakeSessionId, options.intakeSessionId));
  }
  if (options.formLinkId) {
    conditions.push(eq(schema.intakeFormReviews.formLinkId, options.formLinkId));
  }
  const rows = await db
    .select()
    .from(schema.intakeFormReviews)
    .where(and(...conditions))
    .orderBy(desc(schema.intakeFormReviews.decidedAt));
  return rows.map(mapIntakeFormReviewRow);
}

export async function createDrizzleIntakeFormReview(
  db: OpenPracticeDatabase,
  review: IntakeFormReviewRecord,
): Promise<IntakeFormReviewRecord> {
  const [row] = await db
    .insert(schema.intakeFormReviews)
    .values(intakeFormReviewInsert(review))
    .returning();
  return mapIntakeFormReviewRow(row);
}

export async function listDrizzleIntakeFormItemActions(
  db: OpenPracticeDatabase,
  firmId: string,
  options: IntakeFormItemActionListOptions = {},
): Promise<IntakeFormItemActionRecord[]> {
  const conditions = [eq(schema.intakeFormItemActions.firmId, firmId)];
  if (options.formLinkId) {
    conditions.push(eq(schema.intakeFormItemActions.formLinkId, options.formLinkId));
  }
  if (options.intakeSessionId) {
    conditions.push(eq(schema.intakeFormItemActions.intakeSessionId, options.intakeSessionId));
  }
  if (options.itemId) conditions.push(eq(schema.intakeFormItemActions.itemId, options.itemId));
  const rows = await db
    .select()
    .from(schema.intakeFormItemActions)
    .where(and(...conditions));
  return rows.map(mapIntakeFormItemActionRow);
}

export async function upsertDrizzleIntakeFormItemAction(
  db: OpenPracticeDatabase,
  action: IntakeFormItemActionRecord,
): Promise<IntakeFormItemActionRecord> {
  const [row] = await db
    .insert(schema.intakeFormItemActions)
    .values(intakeFormItemActionInsert(action))
    .onConflictDoUpdate({
      target: schema.intakeFormItemActions.id,
      set: intakeFormItemActionInsert(action),
    })
    .returning();
  return mapIntakeFormItemActionRow(row);
}

export async function createDrizzleAnswerSnapshot(
  db: OpenPracticeDatabase,
  snapshot: AnswerSnapshotRecord,
): Promise<AnswerSnapshotRecord> {
  await db.insert(schema.answerSnapshots).values({
    ...snapshot,
    capturedAt: new Date(snapshot.capturedAt),
  });
  return snapshot;
}

export async function listDrizzleAnswerSnapshots(
  db: OpenPracticeDatabase,
  firmId: string,
  options: AnswerSnapshotListOptions = {},
): Promise<AnswerSnapshotRecord[]> {
  const rows = await db
    .select()
    .from(schema.answerSnapshots)
    .where(
      options.intakeSessionId
        ? and(
            eq(schema.answerSnapshots.firmId, firmId),
            eq(schema.answerSnapshots.intakeSessionId, options.intakeSessionId),
          )
        : eq(schema.answerSnapshots.firmId, firmId),
    );
  return rows.map(mapAnswerSnapshotRow);
}

export async function createDrizzleIntakeVariableProposals(
  db: OpenPracticeDatabase,
  proposals: IntakeVariableProposal[],
): Promise<IntakeVariableProposal[]> {
  if (proposals.length === 0) return [];
  const rows = await db
    .insert(schema.intakeVariableProposals)
    .values(proposals.map(intakeVariableProposalInsert))
    .onConflictDoNothing()
    .returning();
  return rows.map(mapIntakeVariableProposalRow);
}

export async function listDrizzleIntakeVariableProposals(
  db: OpenPracticeDatabase,
  firmId: string,
  options: IntakeVariableProposalListOptions = {},
): Promise<IntakeVariableProposal[]> {
  const conditions = [eq(schema.intakeVariableProposals.firmId, firmId)];
  if (options.matterId) {
    conditions.push(eq(schema.intakeVariableProposals.matterId, options.matterId));
  }
  if (options.status) conditions.push(eq(schema.intakeVariableProposals.status, options.status));
  const rows = await db
    .select()
    .from(schema.intakeVariableProposals)
    .where(and(...conditions))
    .orderBy(desc(schema.intakeVariableProposals.createdAt));
  return rows.map(mapIntakeVariableProposalRow);
}

export async function reviewDrizzleIntakeVariableProposal(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    id: string;
    status: "approved" | "rejected";
    reviewedByUserId: string;
    reviewedAt: string;
    rejectionReason?: string;
  },
): Promise<IntakeVariableProposal | undefined> {
  const [current] = await db
    .select()
    .from(schema.intakeVariableProposals)
    .where(
      and(
        eq(schema.intakeVariableProposals.firmId, input.firmId),
        eq(schema.intakeVariableProposals.id, input.id),
      ),
    );
  if (!current || current.status !== "pending") return undefined;
  const reviewedAt = new Date(input.reviewedAt);
  let row: typeof schema.intakeVariableProposals.$inferSelect | undefined;
  await db.transaction(async (tx) => {
    if (input.status === "approved") {
      await applyVariableProposalWithTx(tx, current);
    }
    [row] = await tx
      .update(schema.intakeVariableProposals)
      .set({
        status: input.status,
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt,
        rejectionReason: input.status === "rejected" ? (input.rejectionReason ?? null) : null,
        appliedAt: input.status === "approved" ? reviewedAt : null,
      })
      .where(
        and(
          eq(schema.intakeVariableProposals.firmId, input.firmId),
          eq(schema.intakeVariableProposals.id, input.id),
        ),
      )
      .returning();
  });
  return row ? mapIntakeVariableProposalRow(row) : undefined;
}
