import type { LegalClinicMatterProfile, LegalClinicProgram } from "./legal-clinics.js";

export type FiscalHostWorkflowRelationshipStatus =
  | "no_program_profile"
  | "active_program_profile"
  | "paused_program_profile"
  | "archived_program_profile"
  | "missing_program_record";

export type FiscalHostWorkflowPromptStatus = "ready_for_staff_review" | "needs_program_profile";

export interface FiscalHostProgramMetadata {
  hostName?: string;
  programCode?: string;
  reportingCadence?: string;
}

export interface FiscalHostRestrictedFundMetadata {
  fundCode?: string;
  purpose?: string;
  reviewStatus?: string;
  nextReviewDate?: string;
}

export interface FiscalHostWorkflowSelector {
  matterId: string;
  relationship: {
    status: FiscalHostWorkflowRelationshipStatus;
    programId?: string;
    programName?: string;
    programStatus?: LegalClinicProgram["status"];
    clinicRelationshipRole?: string;
    eligibilityStatus?: LegalClinicMatterProfile["eligibilityStatus"];
    referralStatus?: LegalClinicMatterProfile["referralStatus"];
  };
  programMetadata: FiscalHostProgramMetadata;
  restrictedFundMetadata: FiscalHostRestrictedFundMetadata;
  restrictedFundPrompts: Array<{
    key: string;
    label: string;
    status: FiscalHostWorkflowPromptStatus;
  }>;
  reportingSurfaces: Array<{
    key: string;
    label: string;
    source: string;
    posture: "operational_summary_only" | "deferred_until_review";
  }>;
  reusePoints: Array<{
    surface: "intake" | "documents" | "email" | "calendar" | "billing" | "trust_controls";
    currentUse: string;
  }>;
  cautions: string[];
}

export function buildFiscalHostWorkflowSelector(input: {
  matterId: string;
  profile?: LegalClinicMatterProfile;
  program?: LegalClinicProgram;
}): FiscalHostWorkflowSelector {
  const relationship = fiscalHostRelationship(input.profile, input.program);
  const hasProgramProfile =
    relationship.status !== "no_program_profile" &&
    relationship.status !== "missing_program_record";
  const promptStatus: FiscalHostWorkflowPromptStatus = hasProgramProfile
    ? "ready_for_staff_review"
    : "needs_program_profile";

  return {
    matterId: input.matterId,
    relationship,
    programMetadata: fiscalHostProgramMetadata(input.program?.metadata),
    restrictedFundMetadata: restrictedFundMetadata(input.profile?.metadata),
    restrictedFundPrompts: [
      {
        key: "fund_purpose",
        label: "Confirm the grant, donor, or program purpose for restricted funds.",
        status: promptStatus,
      },
      {
        key: "eligible_use",
        label: "Record staff-reviewed eligible-use notes before relying on billing or trust data.",
        status: promptStatus,
      },
      {
        key: "reporting_period",
        label: "Select the reporting period and reviewer before preparing summaries.",
        status: promptStatus,
      },
    ],
    reportingSurfaces: [
      {
        key: "matter_program_summary",
        label: "Matter and program relationship summary",
        source: "legal clinic profile",
        posture: hasProgramProfile ? "operational_summary_only" : "deferred_until_review",
      },
      {
        key: "restricted_funds_review",
        label: "Restricted funds review checklist",
        source: "staff-entered review prompts",
        posture: "operational_summary_only",
      },
      {
        key: "trust_controls_context",
        label: "Trust controls context",
        source: "read-only ledger controls and billing transfer-request records",
        posture: "operational_summary_only",
      },
    ],
    reusePoints: [
      {
        surface: "intake",
        currentUse: "Capture program and funding-intent cues for staff review.",
      },
      {
        surface: "documents",
        currentUse: "Attach grant, donor, reporting, or authorization records to the matter.",
      },
      {
        surface: "email",
        currentUse: "Use confirmed outbound delivery only for reviewed fiscal-host communications.",
      },
      {
        surface: "calendar",
        currentUse: "Schedule reporting and restricted-fund review checkpoints.",
      },
      {
        surface: "billing",
        currentUse:
          "Reference time, expense, invoice, manual-payment, and transfer-request records as operational evidence.",
      },
      {
        surface: "trust_controls",
        currentUse:
          "Keep ledger balances and trust controls read-only until a separate explicit posting is approved.",
      },
    ],
    cautions: [
      "This selector is practice-management support, not accounting, tax, or jurisdiction-certified trust reporting.",
      "Restricted-fund prompts require staff review before they are used in reports or client-facing materials.",
      "Billing records and trust-transfer requests do not automatically post trust ledger entries.",
    ],
  };
}

function fiscalHostProgramMetadata(
  metadata: Record<string, unknown> | undefined,
): FiscalHostProgramMetadata {
  const fiscalHost = objectMetadata(metadata?.fiscalHost);
  return compactMetadata({
    hostName: stringMetadata(fiscalHost.hostName),
    programCode: stringMetadata(fiscalHost.programCode),
    reportingCadence: stringMetadata(fiscalHost.reportingCadence),
  });
}

function restrictedFundMetadata(
  metadata: Record<string, unknown> | undefined,
): FiscalHostRestrictedFundMetadata {
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

function fiscalHostRelationship(
  profile: LegalClinicMatterProfile | undefined,
  program: LegalClinicProgram | undefined,
): FiscalHostWorkflowSelector["relationship"] {
  if (!profile) {
    return { status: "no_program_profile" };
  }
  if (!program) {
    return {
      status: "missing_program_record",
      programId: profile.programId,
      clinicRelationshipRole: profile.clinicRelationshipRole,
      eligibilityStatus: profile.eligibilityStatus,
      referralStatus: profile.referralStatus,
    };
  }
  const statusByProgram = {
    active: "active_program_profile",
    paused: "paused_program_profile",
    archived: "archived_program_profile",
  } satisfies Record<LegalClinicProgram["status"], FiscalHostWorkflowRelationshipStatus>;
  return {
    status: statusByProgram[program.status],
    programId: program.id,
    programName: program.name,
    programStatus: program.status,
    clinicRelationshipRole: profile.clinicRelationshipRole,
    eligibilityStatus: profile.eligibilityStatus,
    referralStatus: profile.referralStatus,
  };
}
