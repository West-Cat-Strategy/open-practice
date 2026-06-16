import type { IntakeTemplateRecord, IntakeTemplateVersionRecord } from "@open-practice/domain";
import { and, desc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { mapIntakeTemplateRow, mapIntakeTemplateVersionRow } from "../drizzle-mappers.js";

export async function listDrizzleIntakeTemplates(
  db: OpenPracticeDatabase,
  firmId: string,
): Promise<IntakeTemplateRecord[]> {
  const rows = await db
    .select()
    .from(schema.intakeTemplates)
    .where(eq(schema.intakeTemplates.firmId, firmId));
  return rows.map(mapIntakeTemplateRow);
}

export async function createDrizzleIntakeTemplate(
  db: OpenPracticeDatabase,
  template: IntakeTemplateRecord,
): Promise<IntakeTemplateRecord> {
  await db.insert(schema.intakeTemplates).values({
    ...template,
    createdAt: new Date(template.createdAt),
    updatedAt: new Date(template.updatedAt),
  });
  return template;
}

export async function updateDrizzleIntakeTemplate(
  db: OpenPracticeDatabase,
  template: IntakeTemplateRecord,
): Promise<IntakeTemplateRecord> {
  const [row] = await db
    .update(schema.intakeTemplates)
    .set({
      name: template.name,
      description: template.description,
      category: template.category,
      provider: template.provider,
      externalTemplateId: template.externalTemplateId,
      active: template.active,
      definitionVersion: template.definitionVersion,
      definition: template.definition,
      updatedAt: new Date(template.updatedAt),
      metadata: template.metadata,
    })
    .where(
      and(
        eq(schema.intakeTemplates.firmId, template.firmId),
        eq(schema.intakeTemplates.id, template.id),
      ),
    )
    .returning();
  if (!row) throw new Error(`Unknown intake template ${template.id}`);
  return mapIntakeTemplateRow(row);
}

export async function listDrizzleIntakeTemplateVersions(
  db: OpenPracticeDatabase,
  firmId: string,
  templateId: string,
): Promise<IntakeTemplateVersionRecord[]> {
  const rows = await db
    .select()
    .from(schema.intakeTemplateVersions)
    .where(
      and(
        eq(schema.intakeTemplateVersions.firmId, firmId),
        eq(schema.intakeTemplateVersions.templateId, templateId),
      ),
    )
    .orderBy(desc(schema.intakeTemplateVersions.version));
  return rows.map(mapIntakeTemplateVersionRow);
}

export async function getDrizzleIntakeTemplateVersion(
  db: OpenPracticeDatabase,
  firmId: string,
  id: string,
): Promise<IntakeTemplateVersionRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.intakeTemplateVersions)
    .where(
      and(
        eq(schema.intakeTemplateVersions.firmId, firmId),
        eq(schema.intakeTemplateVersions.id, id),
      ),
    );
  return row ? mapIntakeTemplateVersionRow(row) : undefined;
}

export async function getLatestDrizzleIntakeTemplateVersion(
  db: OpenPracticeDatabase,
  firmId: string,
  templateId: string,
): Promise<IntakeTemplateVersionRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.intakeTemplateVersions)
    .where(
      and(
        eq(schema.intakeTemplateVersions.firmId, firmId),
        eq(schema.intakeTemplateVersions.templateId, templateId),
      ),
    )
    .orderBy(desc(schema.intakeTemplateVersions.version))
    .limit(1);
  return row ? mapIntakeTemplateVersionRow(row) : undefined;
}

export async function createDrizzleIntakeTemplateVersion(
  db: OpenPracticeDatabase,
  version: IntakeTemplateVersionRecord,
): Promise<IntakeTemplateVersionRecord> {
  const [row] = await db
    .insert(schema.intakeTemplateVersions)
    .values({
      ...version,
      publishedAt: new Date(version.publishedAt),
    })
    .returning();
  return mapIntakeTemplateVersionRow(row);
}
