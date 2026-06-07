import type { LegalClinicMatterProfile, LegalClinicProgram } from "@open-practice/domain";

export interface LegalClinicRepository {
  listLegalClinicPrograms(
    firmId: string,
    options?: { status?: LegalClinicProgram["status"] },
  ): Promise<LegalClinicProgram[]>;
  createLegalClinicProgram(program: LegalClinicProgram): Promise<LegalClinicProgram>;
  getLegalClinicMatterProfile(
    firmId: string,
    matterId: string,
  ): Promise<LegalClinicMatterProfile | undefined>;
  upsertLegalClinicMatterProfile(
    profile: LegalClinicMatterProfile,
  ): Promise<LegalClinicMatterProfile>;
}
