import type { PublicConsultationIntakeRecord } from "@open-practice/domain";
import { clone } from "../contracts.js";
import type {
  PublicConsultationIntakeListOptions,
  PublicConsultationIntakeUpdateInput,
} from "../public-consultation-intakes-contracts.js";

export interface MemoryPublicConsultationIntakeStore {
  publicConsultationIntakes: PublicConsultationIntakeRecord[];
}

export function listMemoryPublicConsultationIntakes(
  store: MemoryPublicConsultationIntakeStore,
  firmId: string,
  options: PublicConsultationIntakeListOptions = {},
): PublicConsultationIntakeRecord[] {
  const limit = options.limit ?? 50;
  return clone(
    store.publicConsultationIntakes
      .filter((intake) => {
        if (intake.firmId !== firmId) return false;
        if (options.status && intake.status !== options.status) return false;
        return true;
      })
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
      .slice(0, limit),
  );
}

export function getMemoryPublicConsultationIntake(
  store: MemoryPublicConsultationIntakeStore,
  firmId: string,
  intakeId: string,
): PublicConsultationIntakeRecord | undefined {
  return clone(
    store.publicConsultationIntakes.find(
      (intake) => intake.firmId === firmId && intake.id === intakeId,
    ),
  );
}

export function createMemoryPublicConsultationIntake(
  store: MemoryPublicConsultationIntakeStore,
  record: PublicConsultationIntakeRecord,
): PublicConsultationIntakeRecord {
  const duplicate = store.publicConsultationIntakes.find(
    (candidate) => candidate.firmId === record.firmId && candidate.id === record.id,
  );
  if (duplicate) throw new Error(`Public consultation intake ${record.id} already exists`);
  store.publicConsultationIntakes = [clone(record), ...store.publicConsultationIntakes];
  return clone(record);
}

export function updateMemoryPublicConsultationIntake(
  store: MemoryPublicConsultationIntakeStore,
  firmId: string,
  intakeId: string,
  updates: PublicConsultationIntakeUpdateInput,
): PublicConsultationIntakeRecord | undefined {
  const index = store.publicConsultationIntakes.findIndex(
    (intake) => intake.firmId === firmId && intake.id === intakeId,
  );
  if (index < 0) return undefined;
  const current = store.publicConsultationIntakes[index];
  const next: PublicConsultationIntakeRecord = {
    ...current,
    ...updates,
    metadata: updates.metadata ?? current.metadata,
  };
  store.publicConsultationIntakes[index] = clone(next);
  return clone(next);
}
