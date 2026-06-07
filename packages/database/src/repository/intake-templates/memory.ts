import type { IntakeTemplateRecord } from "@open-practice/domain";
import { clone } from "../contracts.js";

export interface MemoryIntakeTemplateStore {
  intakeTemplates: IntakeTemplateRecord[];
}

export function listMemoryIntakeTemplates(
  store: MemoryIntakeTemplateStore,
  firmId: string,
): IntakeTemplateRecord[] {
  return clone(store.intakeTemplates.filter((template) => template.firmId === firmId));
}

export function createMemoryIntakeTemplate(
  store: MemoryIntakeTemplateStore,
  template: IntakeTemplateRecord,
): IntakeTemplateRecord {
  if (store.intakeTemplates.some((existing) => existing.id === template.id)) {
    throw new Error(`Intake template ${template.id} already exists`);
  }
  store.intakeTemplates = [...store.intakeTemplates, clone(template)];
  return clone(template);
}

export function updateMemoryIntakeTemplate(
  store: MemoryIntakeTemplateStore,
  template: IntakeTemplateRecord,
): IntakeTemplateRecord {
  const index = store.intakeTemplates.findIndex(
    (candidate) => candidate.firmId === template.firmId && candidate.id === template.id,
  );
  if (index === -1) throw new Error(`Unknown intake template ${template.id}`);
  store.intakeTemplates[index] = clone(template);
  return clone(template);
}
