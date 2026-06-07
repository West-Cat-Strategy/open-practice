import { and, desc, eq } from "drizzle-orm";
import type { PublicConsultationIntakeRecord } from "@open-practice/domain";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type {
  PublicConsultationIntakeListOptions,
  PublicConsultationIntakeUpdateInput,
} from "../public-consultation-intakes-contracts.js";
import { mapPublicConsultationIntakeRow, publicConsultationIntakeInsert } from "./mappers.js";

export async function listDrizzlePublicConsultationIntakes(
  db: OpenPracticeDatabase,
  firmId: string,
  options: PublicConsultationIntakeListOptions = {},
): Promise<PublicConsultationIntakeRecord[]> {
  const conditions = [eq(schema.publicConsultationIntakes.firmId, firmId)];
  if (options.status) conditions.push(eq(schema.publicConsultationIntakes.status, options.status));
  const rows = await db
    .select()
    .from(schema.publicConsultationIntakes)
    .where(and(...conditions))
    .orderBy(desc(schema.publicConsultationIntakes.submittedAt))
    .limit(options.limit ?? 50);
  return rows.map(mapPublicConsultationIntakeRow);
}

export async function getDrizzlePublicConsultationIntake(
  db: OpenPracticeDatabase,
  firmId: string,
  intakeId: string,
): Promise<PublicConsultationIntakeRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.publicConsultationIntakes)
    .where(
      and(
        eq(schema.publicConsultationIntakes.firmId, firmId),
        eq(schema.publicConsultationIntakes.id, intakeId),
      ),
    );
  return row ? mapPublicConsultationIntakeRow(row) : undefined;
}

export async function createDrizzlePublicConsultationIntake(
  db: OpenPracticeDatabase,
  record: PublicConsultationIntakeRecord,
): Promise<PublicConsultationIntakeRecord> {
  const [row] = await db
    .insert(schema.publicConsultationIntakes)
    .values(publicConsultationIntakeInsert(record))
    .returning();
  return mapPublicConsultationIntakeRow(row);
}

export async function updateDrizzlePublicConsultationIntake(
  db: OpenPracticeDatabase,
  firmId: string,
  intakeId: string,
  updates: PublicConsultationIntakeUpdateInput,
): Promise<PublicConsultationIntakeRecord | undefined> {
  const set: Partial<typeof schema.publicConsultationIntakes.$inferInsert> = {};
  if (updates.status !== undefined) set.status = updates.status;
  if (updates.reviewedByUserId !== undefined) set.reviewedByUserId = updates.reviewedByUserId;
  if (updates.reviewedAt !== undefined) {
    set.reviewedAt = updates.reviewedAt ? new Date(updates.reviewedAt) : null;
  }
  if (updates.dismissedReason !== undefined) set.dismissedReason = updates.dismissedReason;
  if (updates.convertedMatterId !== undefined) set.convertedMatterId = updates.convertedMatterId;
  if (updates.notificationEmailId !== undefined) {
    set.notificationEmailId = updates.notificationEmailId;
  }
  if (updates.metadata !== undefined) set.metadata = updates.metadata;
  const [row] = await db
    .update(schema.publicConsultationIntakes)
    .set(set)
    .where(
      and(
        eq(schema.publicConsultationIntakes.firmId, firmId),
        eq(schema.publicConsultationIntakes.id, intakeId),
      ),
    )
    .returning();
  return row ? mapPublicConsultationIntakeRow(row) : undefined;
}
