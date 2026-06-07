import type { LegalClinicMatterProfile, LegalClinicProgram } from "@open-practice/domain";
import { clone } from "../contracts.js";

export interface MemoryLegalClinicStore {
  legalClinicPrograms: LegalClinicProgram[];
  legalClinicMatterProfiles: LegalClinicMatterProfile[];
}

export function listMemoryLegalClinicPrograms(
  store: MemoryLegalClinicStore,
  firmId: string,
  options: { status?: LegalClinicProgram["status"] } = {},
): LegalClinicProgram[] {
  return clone(
    store.legalClinicPrograms
      .filter(
        (program) =>
          program.firmId === firmId && (!options.status || program.status === options.status),
      )
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
}

export function createMemoryLegalClinicProgram(
  store: MemoryLegalClinicStore,
  program: LegalClinicProgram,
): LegalClinicProgram {
  if (
    store.legalClinicPrograms.some(
      (candidate) =>
        candidate.firmId === program.firmId &&
        candidate.name.trim().toLowerCase() === program.name.trim().toLowerCase(),
    )
  ) {
    throw new Error("Legal clinic program already exists");
  }
  store.legalClinicPrograms.push(clone(program));
  return clone(program);
}

export function getMemoryLegalClinicMatterProfile(
  store: MemoryLegalClinicStore,
  firmId: string,
  matterId: string,
): LegalClinicMatterProfile | undefined {
  return clone(
    store.legalClinicMatterProfiles.find(
      (profile) => profile.firmId === firmId && profile.matterId === matterId,
    ),
  );
}

export function upsertMemoryLegalClinicMatterProfile(
  store: MemoryLegalClinicStore,
  profile: LegalClinicMatterProfile,
): LegalClinicMatterProfile {
  const existingIndex = store.legalClinicMatterProfiles.findIndex(
    (candidate) => candidate.firmId === profile.firmId && candidate.matterId === profile.matterId,
  );
  if (existingIndex >= 0) {
    store.legalClinicMatterProfiles[existingIndex] = clone(profile);
  } else {
    store.legalClinicMatterProfiles.push(clone(profile));
  }
  return clone(profile);
}
