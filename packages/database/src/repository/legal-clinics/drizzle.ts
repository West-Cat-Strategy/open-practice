import type { LegalClinicMatterProfile, LegalClinicProgram } from "@open-practice/domain";
import { and, asc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { mapLegalClinicMatterProfileRow, mapLegalClinicProgramRow } from "../drizzle-mappers.js";
import { clone } from "../contracts.js";

export async function listDrizzleLegalClinicPrograms(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { status?: LegalClinicProgram["status"] } = {},
): Promise<LegalClinicProgram[]> {
  const filters = [eq(schema.legalClinicPrograms.firmId, firmId)];
  if (options.status) filters.push(eq(schema.legalClinicPrograms.status, options.status));
  const rows = await db
    .select()
    .from(schema.legalClinicPrograms)
    .where(and(...filters))
    .orderBy(asc(schema.legalClinicPrograms.name));
  return rows.map(mapLegalClinicProgramRow);
}

export async function createDrizzleLegalClinicProgram(
  db: OpenPracticeDatabase,
  program: LegalClinicProgram,
): Promise<LegalClinicProgram> {
  await db.insert(schema.legalClinicPrograms).values({
    ...program,
    createdAt: new Date(program.createdAt),
    updatedAt: new Date(program.updatedAt),
  });
  return clone(program);
}

export async function getDrizzleLegalClinicMatterProfile(
  db: OpenPracticeDatabase,
  firmId: string,
  matterId: string,
): Promise<LegalClinicMatterProfile | undefined> {
  const [row] = await db
    .select()
    .from(schema.legalClinicMatterProfiles)
    .where(
      and(
        eq(schema.legalClinicMatterProfiles.firmId, firmId),
        eq(schema.legalClinicMatterProfiles.matterId, matterId),
      ),
    );
  return row ? mapLegalClinicMatterProfileRow(row) : undefined;
}

export async function upsertDrizzleLegalClinicMatterProfile(
  db: OpenPracticeDatabase,
  profile: LegalClinicMatterProfile,
): Promise<LegalClinicMatterProfile> {
  const [row] = await db
    .insert(schema.legalClinicMatterProfiles)
    .values({
      ...profile,
      referralDate: profile.referralDate ? new Date(profile.referralDate) : null,
      nextReviewDate: profile.nextReviewDate ? new Date(profile.nextReviewDate) : null,
      createdAt: new Date(profile.createdAt),
      updatedAt: new Date(profile.updatedAt),
    })
    .onConflictDoUpdate({
      target: [schema.legalClinicMatterProfiles.firmId, schema.legalClinicMatterProfiles.matterId],
      set: {
        id: profile.id,
        programId: profile.programId,
        eligibilityStatus: profile.eligibilityStatus,
        referralSource: profile.referralSource,
        referralStatus: profile.referralStatus,
        referralDate: profile.referralDate ? new Date(profile.referralDate) : null,
        nextReviewDate: profile.nextReviewDate ? new Date(profile.nextReviewDate) : null,
        clinicRelationshipRole: profile.clinicRelationshipRole,
        notes: profile.notes,
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(profile.updatedAt),
        updatedByUserId: profile.updatedByUserId,
        metadata: profile.metadata,
      },
    })
    .returning();
  return mapLegalClinicMatterProfileRow(row!);
}
