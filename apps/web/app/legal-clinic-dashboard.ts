import type {
  LegalClinicDashboardResponse,
  LegalClinicProfileResponse,
  LegalClinicProfilesResponse,
  LegalClinicProgramSummary,
  MatterLegalClinicProfileSummary,
  MatterSummary,
} from "./types";

export const legalClinicProgramsPath = "/api/legal-clinic/programs";

export function buildLegalClinicMatterProfilePath(matterId: string): string {
  return `/api/legal-clinic/profiles?matterId=${encodeURIComponent(matterId)}`;
}

export async function loadLegalClinicDashboardData({
  matters,
  listPrograms,
  listProfilesForMatter,
}: {
  matters: MatterSummary[];
  listPrograms: () => Promise<LegalClinicProgramSummary[]>;
  listProfilesForMatter: (matterId: string) => Promise<LegalClinicProfilesResponse["profiles"]>;
}): Promise<LegalClinicDashboardResponse> {
  const programs = await listPrograms();
  const profileEntries = await Promise.all(
    matters.map(async (matter) => [matter.id, await listProfilesForMatter(matter.id)] as const),
  );

  return {
    programs,
    profilesByMatterId: Object.fromEntries(profileEntries),
  };
}

export function findLegalClinicProgram(
  programs: LegalClinicProgramSummary[],
  profile: MatterLegalClinicProfileSummary | undefined,
): LegalClinicProgramSummary | undefined {
  if (!profile) return undefined;
  return programs.find((program) => program.id === profile.programId);
}

export function describeLegalClinicProgram(
  program: LegalClinicProgramSummary | undefined,
  profile: MatterLegalClinicProfileSummary,
): string {
  if (!program) return profile.programId;
  return program.name;
}

export function describeLegalClinicProfileStatus(profile: MatterLegalClinicProfileSummary): string {
  return `${profile.eligibilityStatus.replaceAll("_", " ")} / ${profile.referralStatus.replaceAll("_", " ")}`;
}

export function coerceLegalClinicProfilesResponse(
  response: LegalClinicProfilesResponse | LegalClinicProfileResponse,
): MatterLegalClinicProfileSummary[] {
  if ("profiles" in response) return response.profiles;
  return response.profile ? [response.profile] : [];
}
