import { describe, expect, it } from "vitest";
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
});
