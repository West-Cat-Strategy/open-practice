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

export type LegalClinicCadenceSignalKind =
  | "next_review_due"
  | "eligibility_review"
  | "referral_follow_up"
  | "program_posture_review";

export interface LegalClinicCadenceSignal {
  profileId: string;
  matterId: string;
  programId: string;
  signal: LegalClinicCadenceSignalKind;
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
  dueAt?: string;
  sourceId: `legal_clinic_cadence:${string}:${LegalClinicCadenceSignalKind}`;
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

function legalClinicCadenceSourceId(
  profileId: string,
  signal: LegalClinicCadenceSignalKind,
): LegalClinicCadenceSignal["sourceId"] {
  return `legal_clinic_cadence:${profileId}:${signal}`;
}

function legalClinicCadenceDueAt(
  profile: Pick<LegalClinicMatterProfile, "nextReviewDate" | "referralDate">,
): string | undefined {
  return profile.nextReviewDate ?? profile.referralDate;
}

export function buildLegalClinicCadenceSignals(input: {
  profiles: LegalClinicMatterProfile[];
  programs?: LegalClinicProgram[];
  now?: string;
}): LegalClinicCadenceSignal[] {
  const programsById = new Map((input.programs ?? []).map((program) => [program.id, program]));
  const now = input.now ?? new Date().toISOString();
  const signals: LegalClinicCadenceSignal[] = [];

  for (const profile of input.profiles) {
    const program = programsById.get(profile.programId);
    const programActive = !program || isLegalClinicProgramActive(program);
    const closedProfile =
      profile.eligibilityStatus === "ineligible" || profile.referralStatus === "declined";
    const dueAt = legalClinicCadenceDueAt(profile);

    if (!programActive) {
      signals.push({
        profileId: profile.id,
        matterId: profile.matterId,
        programId: profile.programId,
        signal: "program_posture_review",
        title: "Review legal clinic program posture",
        reason:
          "Legal clinic program status changed while this matter profile still has cadence context.",
        priority: "low",
        dueAt,
        sourceId: legalClinicCadenceSourceId(profile.id, "program_posture_review"),
      });
      continue;
    }

    if (closedProfile) continue;

    if (legalClinicProfileNeedsReview({ profile, now })) {
      signals.push({
        profileId: profile.id,
        matterId: profile.matterId,
        programId: profile.programId,
        signal: "next_review_due",
        title: "Review legal clinic cadence",
        reason: "Legal clinic next review date is due for staff review.",
        priority: "high",
        dueAt: profile.nextReviewDate,
        sourceId: legalClinicCadenceSourceId(profile.id, "next_review_due"),
      });
    }

    if (profile.eligibilityStatus === "needs_review" || profile.eligibilityStatus === "unknown") {
      signals.push({
        profileId: profile.id,
        matterId: profile.matterId,
        programId: profile.programId,
        signal: "eligibility_review",
        title: "Review legal clinic eligibility",
        reason: "Legal clinic eligibility status needs staff review before cadence is settled.",
        priority:
          profile.nextReviewDate && Date.parse(profile.nextReviewDate) <= Date.parse(now)
            ? "high"
            : "medium",
        dueAt,
        sourceId: legalClinicCadenceSourceId(profile.id, "eligibility_review"),
      });
    }

    if (profile.referralStatus === "referral_needed" || profile.referralStatus === "referred") {
      signals.push({
        profileId: profile.id,
        matterId: profile.matterId,
        programId: profile.programId,
        signal: "referral_follow_up",
        title: "Follow up on legal clinic referral",
        reason: "Legal clinic referral status is waiting for staff follow-up.",
        priority: profile.referralStatus === "referral_needed" ? "high" : "medium",
        dueAt,
        sourceId: legalClinicCadenceSourceId(profile.id, "referral_follow_up"),
      });
    }
  }

  return signals.sort((left, right) => {
    const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.POSITIVE_INFINITY;
    const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.POSITIVE_INFINITY;
    if (leftDue !== rightDue) return leftDue - rightDue;
    return left.sourceId.localeCompare(right.sourceId);
  });
}
