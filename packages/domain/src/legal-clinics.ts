export const legalClinicProgramStatuses = ["active", "paused", "archived"] as const;
export type LegalClinicProgramStatus = (typeof legalClinicProgramStatuses)[number];

export const legalClinicEligibilityStatuses = [
  "unknown",
  "likely_eligible",
  "ineligible",
  "needs_review",
] as const;
export type LegalClinicEligibilityStatus = (typeof legalClinicEligibilityStatuses)[number];

export const legalClinicReferralStatuses = [
  "not_referred",
  "referral_needed",
  "referred",
  "accepted",
  "declined",
] as const;
export type LegalClinicReferralStatus = (typeof legalClinicReferralStatuses)[number];

export interface LegalClinicProgram {
  id: string;
  firmId: string;
  name: string;
  status: LegalClinicProgramStatus;
  serviceArea: string;
  eligibilitySummary: string;
  defaultReferralSource?: string;
  defaultReferralStatus: LegalClinicReferralStatus;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface LegalClinicProgramInput {
  name: string;
  status?: LegalClinicProgramStatus;
  serviceArea: string;
  eligibilitySummary: string;
  defaultReferralSource?: string;
  defaultReferralStatus?: LegalClinicReferralStatus;
  metadata?: Record<string, unknown>;
}

export interface LegalClinicMatterProfile {
  id: string;
  firmId: string;
  matterId: string;
  programId: string;
  eligibilityStatus: LegalClinicEligibilityStatus;
  referralSource?: string;
  referralStatus: LegalClinicReferralStatus;
  referralDate?: string;
  nextReviewDate?: string;
  clinicRelationshipRole: string;
  notes?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  updatedByUserId: string;
}

export interface LegalClinicMatterProfileInput {
  programId: string;
  eligibilityStatus?: LegalClinicEligibilityStatus;
  referralSource?: string;
  referralStatus?: LegalClinicReferralStatus;
  referralDate?: string;
  nextReviewDate?: string;
  clinicRelationshipRole: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export function isLegalClinicProgramActive(program: Pick<LegalClinicProgram, "status">): boolean {
  return program.status === "active";
}

export function legalClinicProfileNeedsReview(input: {
  profile: Pick<LegalClinicMatterProfile, "eligibilityStatus" | "nextReviewDate">;
  now?: string;
}): boolean {
  if (!input.profile.nextReviewDate) return false;
  if (input.profile.eligibilityStatus === "ineligible") return false;
  return (
    Date.parse(input.profile.nextReviewDate) <= Date.parse(input.now ?? new Date().toISOString())
  );
}

export function assertLegalClinicMatterProfileScope(
  profile: Pick<LegalClinicMatterProfile, "firmId" | "matterId">,
  expected: { firmId: string; matterId: string },
): void {
  if (profile.firmId !== expected.firmId || profile.matterId !== expected.matterId) {
    throw new Error("Legal clinic matter profile scope mismatch");
  }
}
