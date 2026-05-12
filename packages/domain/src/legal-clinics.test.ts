import { describe, expect, it } from "vitest";
import { buildFiscalHostWorkflowSelector } from "./fiscal-host-workflows.js";
import {
  assertLegalClinicMatterProfileScope,
  isLegalClinicProgramActive,
  legalClinicProfileNeedsReview,
} from "./legal-clinics.js";
import { sampleLegalClinicMatterProfiles, sampleLegalClinicPrograms } from "./sample-data.js";

describe("legal clinic domain helpers", () => {
  it("keeps seeded clinic programs provider-neutral and status-aware", () => {
    expect(sampleLegalClinicPrograms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "clinic-program-tenancy-stability",
          status: "active",
          serviceArea: "Residential tenancy",
          metadata: expect.objectContaining({ providerNeutral: true }),
        }),
      ]),
    );
    expect(isLegalClinicProgramActive(sampleLegalClinicPrograms[0]!)).toBe(true);
    expect(
      isLegalClinicProgramActive({
        ...sampleLegalClinicPrograms[0]!,
        status: "paused",
      }),
    ).toBe(false);
  });

  it("flags active matter profiles that are due for review", () => {
    expect(
      legalClinicProfileNeedsReview({
        profile: sampleLegalClinicMatterProfiles[0]!,
        now: "2026-04-09T17:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      legalClinicProfileNeedsReview({
        profile: { ...sampleLegalClinicMatterProfiles[0]!, eligibilityStatus: "ineligible" },
        now: "2026-04-09T17:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("guards matter profile scope", () => {
    expect(() =>
      assertLegalClinicMatterProfileScope(sampleLegalClinicMatterProfiles[0]!, {
        firmId: "firm-west-legal",
        matterId: "matter-001",
      }),
    ).not.toThrow();
    expect(() =>
      assertLegalClinicMatterProfileScope(sampleLegalClinicMatterProfiles[0]!, {
        firmId: "firm-west-legal",
        matterId: "matter-002",
      }),
    ).toThrow("Legal clinic matter profile scope mismatch");
  });

  it("builds a cautious fiscal-host workflow selector from clinic profile context", () => {
    const selector = buildFiscalHostWorkflowSelector({
      matterId: "matter-001",
      profile: {
        ...sampleLegalClinicMatterProfiles[0]!,
        metadata: {
          restrictedFund: {
            fundCode: "RF-HOUSING-01",
            purpose: "Synthetic housing stability grant",
            reviewStatus: "staff_review_ready",
            nextReviewDate: "2026-05-20",
            privateReviewerNote: "raw private facts",
          },
        },
      },
      program: {
        ...sampleLegalClinicPrograms[0]!,
        metadata: {
          fiscalHost: {
            hostName: "Synthetic Community Host",
            programCode: "TEN-STAB",
            reportingCadence: "monthly",
            bankAccount: "Private notes",
          },
        },
      },
    });

    expect(selector).toMatchObject({
      matterId: "matter-001",
      relationship: {
        status: "active_program_profile",
        programId: "clinic-program-tenancy-stability",
        programStatus: "active",
        eligibilityStatus: "likely_eligible",
      },
      programMetadata: {
        hostName: "Synthetic Community Host",
        programCode: "TEN-STAB",
        reportingCadence: "monthly",
      },
      restrictedFundMetadata: {
        fundCode: "RF-HOUSING-01",
        purpose: "Synthetic housing stability grant",
        reviewStatus: "staff_review_ready",
        nextReviewDate: "2026-05-20",
      },
    });
    expect(selector.reusePoints.map((point) => point.surface)).toEqual([
      "intake",
      "documents",
      "email",
      "calendar",
      "billing",
      "trust_controls",
    ]);
    expect(selector.reportingSurfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "trust_controls_context",
          posture: "operational_summary_only",
        }),
      ]),
    );
    expect(selector.cautions.join(" ")).toContain("not accounting");
    expect(selector.cautions.join(" ")).toContain("do not automatically post trust ledger entries");
    expect(JSON.stringify(selector)).not.toContain("raw private facts");
    expect(JSON.stringify(selector)).not.toContain("Private notes");
  });

  it("keeps fiscal-host prompts in review mode until a program profile exists", () => {
    const selector = buildFiscalHostWorkflowSelector({ matterId: "matter-new" });

    expect(selector.relationship).toEqual({ status: "no_program_profile" });
    expect(selector.restrictedFundPrompts).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "needs_program_profile" })]),
    );
    expect(selector.reportingSurfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "matter_program_summary",
          posture: "deferred_until_review",
        }),
      ]),
    );
  });

  it("drops malformed fiscal-host metadata instead of exposing raw metadata", () => {
    const selector = buildFiscalHostWorkflowSelector({
      matterId: "matter-001",
      profile: {
        ...sampleLegalClinicMatterProfiles[0]!,
        metadata: { restrictedFund: "raw private facts" },
      },
      program: {
        ...sampleLegalClinicPrograms[0]!,
        metadata: { fiscalHost: { hostName: ["Private notes"], programCode: 42 } },
      },
    });

    expect(selector.programMetadata).toEqual({});
    expect(selector.restrictedFundMetadata).toEqual({});
    expect(JSON.stringify(selector)).not.toContain("raw private facts");
    expect(JSON.stringify(selector)).not.toContain("Private notes");
  });
});
