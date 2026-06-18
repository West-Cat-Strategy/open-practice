import { describe, expect, it } from "vitest";
import { financialExportFieldProfiles } from "./financial-export-profiles.js";
import { STAFF_REPORT_EXPORT_PROFILES } from "./reports.js";

describe("financial export field profiles", () => {
  it("exposes reusable manual-download profiles for local billing and trust projections", () => {
    expect(Object.values(financialExportFieldProfiles).map((profile) => profile.id)).toEqual([
      "billing_operational_records_json",
      "jurisdictional_trust_summary_json",
    ]);
    for (const profile of Object.values(financialExportFieldProfiles)) {
      expect(profile).toMatchObject({
        format: "json",
        source: "generated_local_projection",
        manualDownloadOnly: true,
        scheduledDelivery: false,
        storesRawExportBody: false,
      });
      expect(profile.fieldKeys.length).toBeGreaterThan(0);
    }
    expect(financialExportFieldProfiles.billingOperationalRecordsJson.fieldKeys).toEqual(
      expect.arrayContaining([
        "timeEntries.narrative",
        "invoices.invoiceNumber",
        "paymentRequests.status",
        "trustTransferRequests.status",
      ]),
    );
    expect(financialExportFieldProfiles.jurisdictionalTrustSummaryJson.fieldKeys).toEqual(
      expect.arrayContaining([
        "summaries.trustBalanceCents",
        "summaries.totalVarianceCents",
        "compliancePosture",
      ]),
    );
  });

  it("keeps raw body, storage, and evidence keys out of profile field allowlists", () => {
    const forbiddenKeys = new Set([
      "rawBody",
      "rawExportBody",
      "storageKey",
      "objectKey",
      "evidence",
    ]);
    for (const profile of Object.values(financialExportFieldProfiles)) {
      expect(profile.fieldKeys.some((key) => forbiddenKeys.has(key.split(".").at(-1) ?? key))).toBe(
        false,
      );
    }
  });

  it("keeps financial field profiles separate from staff reporting export profiles", () => {
    const staffReportExportProfileIds: ReadonlySet<string> = new Set(
      STAFF_REPORT_EXPORT_PROFILES.map((profile) => profile.id),
    );
    for (const profile of Object.values(financialExportFieldProfiles)) {
      expect(staffReportExportProfileIds.has(profile.id)).toBe(false);
    }
  });
});
