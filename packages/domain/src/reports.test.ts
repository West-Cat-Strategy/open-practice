import { describe, expect, it } from "vitest";
import {
  buildStaffReportProjection,
  buildStaffReportingWorkspace,
  STAFF_REPORT_EXPORT_PROFILES,
  STAFF_SAVED_REPORT_DEFINITIONS,
} from "./reports.js";
import {
  sampleInvoices,
  sampleLegalClinicMatterProfiles,
  sampleLedgerAccounts,
  sampleLedgerEntries,
  sampleMatters,
  sampleTaskDeadlines,
  sampleTimeEntries,
  sampleUsers,
} from "./sample-data.js";
import type { LedgerReconciliationRecord } from "./ledger.js";

const generatedAt = "2026-06-20T12:00:00.000Z";

const reconciliations: LedgerReconciliationRecord[] = [
  {
    id: "reconciliation-test",
    firmId: "firm-west-legal",
    accountId: "acct-trust-bank",
    statementPeriodStart: "2026-04-01T00:00:00.000Z",
    statementPeriodEnd: "2026-04-30T23:59:59.000Z",
    beginningBalanceCents: 0,
    endingBalanceCents: 150000,
    expectedBalanceCents: 150000,
    actualBalanceCents: 149000,
    status: "exception",
    reviewedByUserId: "user-admin",
    statementRows: [
      {
        id: "statement-row-test",
        postedAt: "2026-04-02T17:00:00.000Z",
        description: "Synthetic statement row",
        amountCents: 150000,
        matchedLedgerEntryIds: [],
        reviewDecision: "unmatched",
      },
    ],
    varianceExplanation: "Synthetic variance for staff report projection.",
    evidence: { source: "test" },
    createdAt: "2026-05-01T00:00:00.000Z",
  },
];

describe("staff reporting workspace", () => {
  it("exposes saved definitions, filter/grouping metadata, and manual export profiles", () => {
    const workspace = buildStaffReportingWorkspace({
      firmId: "firm-west-legal",
      generatedAt,
      matters: sampleMatters,
      users: sampleUsers,
      invoices: sampleInvoices,
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      timeEntries: sampleTimeEntries,
      taskDeadlines: sampleTaskDeadlines,
    });

    expect(STAFF_SAVED_REPORT_DEFINITIONS.map((definition) => definition.key)).toEqual([
      "invoice_aging",
      "reconciliation_freshness",
      "productivity",
      "operational_follow_up",
    ]);
    expect(workspace.definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "invoice_aging",
          filters: expect.arrayContaining([
            expect.objectContaining({ key: "asOf" }),
            expect.objectContaining({ key: "practiceArea" }),
            expect.objectContaining({ key: "clinicProgramId" }),
            expect.objectContaining({ key: "restrictedFundReviewStatus" }),
          ]),
          groupings: expect.arrayContaining([
            expect.objectContaining({ key: "aging_bucket" }),
            expect.objectContaining({ key: "jurisdiction" }),
            expect.objectContaining({ key: "practiceArea" }),
            expect.objectContaining({ key: "clinicProgramId" }),
            expect.objectContaining({ key: "restrictedFundReviewStatus" }),
          ]),
          exportProfileIds: ["summary_json", "review_csv"],
        }),
      ]),
    );
    expect(STAFF_REPORT_EXPORT_PROFILES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "summary_json",
          manualDownloadOnly: true,
          scheduledEmailDelivery: false,
          includesRawReportBody: false,
        }),
      ]),
    );
    expect(workspace.workspacePolicy).toMatchObject({
      customSql: false,
      biEmbeds: false,
      scheduledEmailDelivery: false,
      rawReportBodiesInJobMetadata: false,
    });
    expect(workspace.scheduleReadinessSummary).toMatchObject({
      totalDefinitions: 4,
      manualExportReadyDefinitions: 4,
      manualOnlyDefinitionKeys: [
        "invoice_aging",
        "reconciliation_freshness",
        "productivity",
        "operational_follow_up",
      ],
      recentExportRequestCount: 0,
      scheduledDefinitionCount: 0,
      automaticExecution: false,
      scheduledEmailDeliveryEnabled: false,
      rawReportBodyStorage: false,
    });
    expect(workspace.reportBuilderPosture).toMatchObject({
      status: "metadata_only",
      savedDefinitionsOnly: true,
      filterCount: 24,
      groupingCount: 24,
      exportProfileCount: 2,
      customSql: false,
      biEmbeds: false,
      broadReportExecution: false,
      mutableDefinitionBuilder: false,
      rawReportBodyStorage: false,
    });
    expect(workspace.exportJobPosture).toMatchObject({
      queueName: "reports",
      jobName: "staff_report_export",
      historyCount: 0,
      boundedMetadataOnly: true,
      storesReportBodiesInJobMetadata: false,
      downloadsRegenerateProjection: true,
      scheduledDeliveryJobs: false,
    });
    expect(workspace.definitions[0]).toMatchObject({
      scheduleReadiness: expect.objectContaining({
        cadence: "not_scheduled",
        scheduledRunReady: false,
        scheduledEmailDelivery: false,
      }),
      builderPosture: expect.objectContaining({
        status: "saved_definition_metadata",
        customSql: false,
        broadReportExecution: false,
        storesRawReportBodies: false,
      }),
    });
  });

  it("builds first report projections from existing billing, ledger, time, and task data", () => {
    const invoiceAging = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "invoice_aging",
      matters: sampleMatters,
      users: sampleUsers,
      invoices: sampleInvoices,
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      timeEntries: sampleTimeEntries,
      taskDeadlines: sampleTaskDeadlines,
    });
    const reconciliationFreshness = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "reconciliation_freshness",
      matters: sampleMatters,
      users: sampleUsers,
      invoices: sampleInvoices,
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      timeEntries: sampleTimeEntries,
      taskDeadlines: sampleTaskDeadlines,
    });
    const productivity = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "productivity",
      matters: sampleMatters,
      users: sampleUsers,
      invoices: sampleInvoices,
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      timeEntries: sampleTimeEntries,
      taskDeadlines: sampleTaskDeadlines,
    });
    const operationalFollowUp = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "operational_follow_up",
      matters: sampleMatters,
      users: sampleUsers,
      invoices: sampleInvoices,
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      timeEntries: sampleTimeEntries,
      taskDeadlines: sampleTaskDeadlines,
    });

    expect(invoiceAging.summary.metrics.totalBalanceDueCents).toBe(13230);
    expect(invoiceAging.rows[0]).toMatchObject({
      label: "INV-2026-0001",
      tone: "risk",
      dimensions: expect.objectContaining({
        jurisdiction: "BC",
        practiceArea: "Residential tenancy",
        clinicProgramId: "clinic-program-tenancy-stability",
        restrictedFundReviewStatus: "not_reviewed",
      }),
      metadata: expect.objectContaining({ daysPastDue: expect.any(Number) }),
    });
    expect(reconciliationFreshness.rows[0]).toMatchObject({
      id: "acct-trust-bank",
      tone: "risk",
      status: "exception",
    });
    expect(productivity.summary.metrics.billableMinutes).toBe(42);
    expect(operationalFollowUp.rows.map((row) => row.status)).toEqual(
      expect.arrayContaining(["overdue", "stale_matter"]),
    );
    expect(JSON.stringify([invoiceAging, reconciliationFreshness, productivity])).not.toContain(
      "rawBody",
    );
  });

  it("groups and filters staff report projections by derived read-only dimensions", () => {
    const projection = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "invoice_aging",
      groupingKey: "clinicProgramId",
      dimensionFilters: { restrictedFundReviewStatus: "not_reviewed" },
      matters: sampleMatters,
      users: sampleUsers,
      invoices: sampleInvoices,
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      timeEntries: sampleTimeEntries,
      taskDeadlines: sampleTaskDeadlines,
    });

    expect(projection).toMatchObject({
      groupingKey: "clinicProgramId",
      dimensionFilters: { restrictedFundReviewStatus: "not_reviewed" },
      filters: expect.objectContaining({ restrictedFundReviewStatus: "not_reviewed" }),
      summary: {
        groups: [
          expect.objectContaining({
            key: "clinic-program-tenancy-stability",
            label: "clinic-program-tenancy-stability",
          }),
        ],
      },
    });
    expect(projection.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimensions: expect.objectContaining({
            clinicProgramId: "clinic-program-tenancy-stability",
            restrictedFundReviewStatus: "not_reviewed",
          }),
        }),
      ]),
    );
  });
});
