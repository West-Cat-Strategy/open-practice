import { apiGetOptional } from "../../_shared/server-api";
import {
  buildLegalClinicMatterProfilePath,
  coerceLegalClinicProfilesResponse,
  legalClinicProgramsPath,
  loadLegalClinicDashboardData,
} from "../../legal-clinic-dashboard";
import type {
  LegalClinicDashboardResponse,
  LegalClinicProfileResponse,
  LegalClinicProfilesResponse,
  LegalClinicProgramsResponse,
  MatterSummary,
} from "../../types";

export async function loadLegalClinicDashboardResources(input: {
  headers: Record<string, string>;
  matters: MatterSummary[];
}): Promise<LegalClinicDashboardResponse> {
  return loadLegalClinicDashboardData({
    matters: input.matters,
    listPrograms: async () => {
      const response = await apiGetOptional<LegalClinicProgramsResponse>(
        legalClinicProgramsPath,
        { programs: [] },
        input.headers,
        { programs: [] },
      );
      return response.programs;
    },
    listProfilesForMatter: async (matterId) => {
      const response = await apiGetOptional<
        LegalClinicProfilesResponse | LegalClinicProfileResponse
      >(buildLegalClinicMatterProfilePath(matterId), { profile: null }, input.headers, {
        profile: null,
      });
      return coerceLegalClinicProfilesResponse(response);
    },
  });
}
