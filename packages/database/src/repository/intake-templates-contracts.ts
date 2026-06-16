import type { IntakeTemplateRecord, IntakeTemplateVersionRecord } from "@open-practice/domain";

export interface IntakeTemplateRepository {
  listIntakeTemplates(firmId: string): Promise<IntakeTemplateRecord[]>;
  createIntakeTemplate(template: IntakeTemplateRecord): Promise<IntakeTemplateRecord>;
  updateIntakeTemplate(template: IntakeTemplateRecord): Promise<IntakeTemplateRecord>;
  listIntakeTemplateVersions(
    firmId: string,
    templateId: string,
  ): Promise<IntakeTemplateVersionRecord[]>;
  getIntakeTemplateVersion(
    firmId: string,
    id: string,
  ): Promise<IntakeTemplateVersionRecord | undefined>;
  getLatestIntakeTemplateVersion(
    firmId: string,
    templateId: string,
  ): Promise<IntakeTemplateVersionRecord | undefined>;
  createIntakeTemplateVersion(
    version: IntakeTemplateVersionRecord,
  ): Promise<IntakeTemplateVersionRecord>;
}
