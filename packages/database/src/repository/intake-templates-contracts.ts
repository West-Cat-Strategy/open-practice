import type { IntakeTemplateRecord } from "@open-practice/domain";

export interface IntakeTemplateRepository {
  listIntakeTemplates(firmId: string): Promise<IntakeTemplateRecord[]>;
  createIntakeTemplate(template: IntakeTemplateRecord): Promise<IntakeTemplateRecord>;
  updateIntakeTemplate(template: IntakeTemplateRecord): Promise<IntakeTemplateRecord>;
}
