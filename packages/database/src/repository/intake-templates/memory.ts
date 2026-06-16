import type { IntakeTemplateRecord, IntakeTemplateVersionRecord } from "@open-practice/domain";
import { clone } from "../contracts.js";

export interface MemoryIntakeTemplateStore {
  intakeTemplates: IntakeTemplateRecord[];
  intakeTemplateVersions: IntakeTemplateVersionRecord[];
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

export function listMemoryIntakeTemplateVersions(
  store: MemoryIntakeTemplateStore,
  firmId: string,
  templateId: string,
): IntakeTemplateVersionRecord[] {
  return clone(
    store.intakeTemplateVersions
      .filter((version) => version.firmId === firmId && version.templateId === templateId)
      .sort((left, right) => right.version - left.version),
  );
}

export function getMemoryIntakeTemplateVersion(
  store: MemoryIntakeTemplateStore,
  firmId: string,
  id: string,
): IntakeTemplateVersionRecord | undefined {
  return clone(
    store.intakeTemplateVersions.find((version) => version.firmId === firmId && version.id === id),
  );
}

export function getLatestMemoryIntakeTemplateVersion(
  store: MemoryIntakeTemplateStore,
  firmId: string,
  templateId: string,
): IntakeTemplateVersionRecord | undefined {
  return listMemoryIntakeTemplateVersions(store, firmId, templateId)[0];
}

export function createMemoryIntakeTemplateVersion(
  store: MemoryIntakeTemplateStore,
  version: IntakeTemplateVersionRecord,
): IntakeTemplateVersionRecord {
  if (store.intakeTemplateVersions.some((existing) => existing.id === version.id)) {
    throw new Error(`Intake template version ${version.id} already exists`);
  }
  if (
    store.intakeTemplateVersions.some(
      (existing) =>
        existing.templateId === version.templateId && existing.version === version.version,
    )
  ) {
    throw new Error(
      `Intake template ${version.templateId} version ${version.version} already exists`,
    );
  }
  store.intakeTemplateVersions = [...store.intakeTemplateVersions, clone(version)];
  return clone(version);
}
