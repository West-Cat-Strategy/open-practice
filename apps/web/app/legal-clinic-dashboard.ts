import type {
  LegalClinicDashboardResponse,
  LegalClinicProfileResponse,
  LegalClinicProfilesResponse,
  LegalClinicProgramSummary,
  FiscalHostWorkflowSelectorSummary,
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

export function fiscalHostWorkflowMetadata(
  program: LegalClinicProgramSummary | undefined,
  profile: MatterLegalClinicProfileSummary | undefined,
): FiscalHostWorkflowSelectorSummary {
  return {
    programMetadata: fiscalHostProgramMetadata(program?.metadata),
    restrictedFundMetadata: restrictedFundMetadata(profile?.metadata),
  };
}

export function describeFiscalHostProgramMetadata(
  metadata: FiscalHostWorkflowSelectorSummary["programMetadata"],
): string {
  const label = [metadata.hostName, metadata.programCode].filter(Boolean).join(" / ");
  return label || "Fiscal-host metadata needs staff review.";
}

export function describeRestrictedFundMetadata(
  metadata: FiscalHostWorkflowSelectorSummary["restrictedFundMetadata"],
): string {
  const label = [metadata.fundCode, metadata.reviewStatus].filter(Boolean).join(" / ");
  return label || "Restricted-fund metadata needs staff review.";
}

export function coerceLegalClinicProfilesResponse(
  response: LegalClinicProfilesResponse | LegalClinicProfileResponse,
): MatterLegalClinicProfileSummary[] {
  if ("profiles" in response) return response.profiles;
  return response.profile ? [response.profile] : [];
}

function fiscalHostProgramMetadata(
  metadata: Record<string, unknown> | undefined,
): FiscalHostWorkflowSelectorSummary["programMetadata"] {
  const fiscalHost = objectMetadata(metadata?.fiscalHost);
  return compactMetadata({
    hostName: stringMetadata(fiscalHost.hostName),
    programCode: stringMetadata(fiscalHost.programCode),
    reportingCadence: stringMetadata(fiscalHost.reportingCadence),
  });
}

function restrictedFundMetadata(
  metadata: Record<string, unknown> | undefined,
): FiscalHostWorkflowSelectorSummary["restrictedFundMetadata"] {
  const restrictedFund = objectMetadata(metadata?.restrictedFund);
  return compactMetadata({
    fundCode: stringMetadata(restrictedFund.fundCode),
    purpose: stringMetadata(restrictedFund.purpose),
    reviewStatus: stringMetadata(restrictedFund.reviewStatus),
    nextReviewDate: stringMetadata(restrictedFund.nextReviewDate),
  });
}

function objectMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function compactMetadata<T extends Record<string, string | undefined>>(
  metadata: T,
): {
  [K in keyof T]?: string;
} {
  return Object.fromEntries(
    Object.entries(metadata).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ) as { [K in keyof T]?: string };
}
