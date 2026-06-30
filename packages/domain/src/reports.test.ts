import { describe, expect, it } from "vitest";
import {
  buildStaffReportProjection,
  buildStaffReportingWorkspace,
  STAFF_REPORT_EXPORT_PROFILES,
  STAFF_SAVED_REPORT_DEFINITIONS,
} from "./reports.js";
import {
  sampleContacts,
  sampleExpenseEntries,
  sampleInvoices,
  sampleLegalClinicMatterProfiles,
  sampleLedgerAccounts,
  sampleLedgerEntries,
  sampleMatters,
  sampleTaskDeadlines,
  sampleTimeEntries,
  sampleUsers,
} from "./sample-data.js";
import type { InvoiceRecord } from "./billing.js";
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
      "aged_receivables",
      "billing_period_lock_impact",
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
        expect.objectContaining({
          key: "aged_receivables",
          defaultGrouping: "client",
          filters: expect.arrayContaining([
            expect.objectContaining({ key: "asOf" }),
            expect.objectContaining({ key: "invoiceStatuses" }),
          ]),
          groupings: expect.arrayContaining([
            expect.objectContaining({ key: "client" }),
            expect.objectContaining({ key: "matter" }),
            expect.objectContaining({ key: "invoice" }),
            expect.objectContaining({ key: "aging_bucket" }),
          ]),
          exportProfileIds: ["summary_json", "review_csv"],
        }),
        expect.objectContaining({
          key: "billing_period_lock_impact",
          defaultGrouping: "lock",
          filters: expect.arrayContaining([
            expect.objectContaining({ key: "sourceTypes" }),
            expect.objectContaining({ key: "recordStatuses" }),
          ]),
          groupings: expect.arrayContaining([
            expect.objectContaining({ key: "lock" }),
            expect.objectContaining({ key: "status" }),
            expect.objectContaining({ key: "matter" }),
            expect.objectContaining({ key: "source_type" }),
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
    expect(workspace.exportProfileAlignment).toMatchObject({
      status: "read_only_metadata_alignment",
      staffReportProfiles: expect.arrayContaining([
        expect.objectContaining({
          id: "summary_json",
          format: "json",
          detailLevel: "summary",
          manualDownloadOnly: true,
          scheduledEmailDelivery: false,
          includesRawReportBody: false,
        }),
        expect.objectContaining({
          id: "review_csv",
          format: "csv",
          detailLevel: "row_summary",
        }),
      ]),
      financialFieldProfiles: expect.arrayContaining([
        expect.objectContaining({
          id: "billing_operational_records_json",
          fieldKeyCount: expect.any(Number),
          manualDownloadOnly: true,
          scheduledDelivery: false,
          storesRawExportBody: false,
        }),
        expect.objectContaining({
          id: "jurisdictional_trust_summary_json",
          fieldKeyCount: expect.any(Number),
        }),
      ]),
      differences: expect.arrayContaining([
        expect.objectContaining({ key: "field_key_behavior" }),
        expect.objectContaining({ key: "queue_job_metadata" }),
        expect.objectContaining({ key: "download_body_behavior" }),
      ]),
      sharedSafeguards: {
        customSql: false,
        biEmbeds: false,
        scheduledExecution: false,
        scheduledDelivery: false,
        rawBodyStorage: false,
        paymentProcessorExposure: false,
        paymentCreation: false,
        paymentAllocation: false,
        invoiceMutation: false,
        trustPosting: false,
        certificationClaims: false,
      },
    });
    for (const profile of workspace.exportProfileAlignment.financialFieldProfiles) {
      expect(profile.fieldKeyCount).toBeGreaterThan(0);
      expect(profile.sampleFieldKeys.length).toBeGreaterThan(0);
      expect(profile.sampleFieldKeys.length).toBeLessThanOrEqual(6);
      expect(profile.sampleFieldKeys.length).toBeLessThanOrEqual(profile.fieldKeyCount);
    }
    expect(workspace.workspacePolicy).toMatchObject({
      customSql: false,
      biEmbeds: false,
      scheduledEmailDelivery: false,
      rawReportBodiesInJobMetadata: false,
    });
    expect(workspace.scheduleReadinessSummary).toMatchObject({
      totalDefinitions: 6,
      manualExportReadyDefinitions: 6,
      manualOnlyDefinitionKeys: [
        "invoice_aging",
        "aged_receivables",
        "billing_period_lock_impact",
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
      filterCount: 37,
      groupingCount: 40,
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

  it("builds aged receivables by client, matter, invoice, and five aging buckets", () => {
    const receivableInvoices: InvoiceRecord[] = [
      {
        ...sampleInvoices[0]!,
        id: "invoice-current",
        invoiceNumber: "INV-CURRENT",
        dueAt: "2026-06-21T00:00:00.000Z",
        balanceDueCents: 1000,
        totalCents: 1000,
        paidCents: 0,
      },
      {
        ...sampleInvoices[0]!,
        id: "invoice-current-no-due-date",
        invoiceNumber: "INV-CURRENT-NO-DUE",
        dueAt: undefined,
        balanceDueCents: 600,
        totalCents: 600,
        paidCents: 0,
      },
      {
        ...sampleInvoices[0]!,
        id: "invoice-1-30",
        invoiceNumber: "INV-1-30",
        dueAt: "2026-06-10T00:00:00.000Z",
        balanceDueCents: 2000,
        totalCents: 2000,
        paidCents: 0,
      },
      {
        ...sampleInvoices[0]!,
        id: "invoice-31-60",
        invoiceNumber: "INV-31-60",
        dueAt: "2026-05-10T00:00:00.000Z",
        balanceDueCents: 3000,
        totalCents: 4000,
        paidCents: 1000,
        status: "partially_paid",
      },
      {
        ...sampleInvoices[0]!,
        id: "invoice-61-90",
        invoiceNumber: "INV-61-90",
        dueAt: "2026-04-05T00:00:00.000Z",
        balanceDueCents: 4000,
        totalCents: 4000,
        paidCents: 0,
      },
      {
        ...sampleInvoices[0]!,
        id: "invoice-91-plus",
        invoiceNumber: "INV-91-PLUS",
        dueAt: "2026-03-01T00:00:00.000Z",
        balanceDueCents: 5000,
        totalCents: 5000,
        paidCents: 0,
      },
      {
        ...sampleInvoices[0]!,
        id: "invoice-draft-excluded",
        invoiceNumber: "INV-DRAFT-EXCLUDED",
        status: "draft",
        balanceDueCents: 6000,
      },
      {
        ...sampleInvoices[0]!,
        id: "invoice-approved-excluded",
        invoiceNumber: "INV-APPROVED-EXCLUDED",
        status: "approved",
        balanceDueCents: 7000,
      },
      {
        ...sampleInvoices[0]!,
        id: "invoice-void-excluded",
        invoiceNumber: "INV-VOID-EXCLUDED",
        status: "void",
        balanceDueCents: 8000,
      },
      {
        ...sampleInvoices[0]!,
        id: "invoice-paid-excluded",
        invoiceNumber: "INV-PAID-EXCLUDED",
        status: "paid",
        balanceDueCents: 0,
        paidCents: 13230,
      },
    ];

    const projection = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "aged_receivables",
      matters: sampleMatters,
      users: sampleUsers,
      contacts: sampleContacts,
      invoices: receivableInvoices,
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      timeEntries: sampleTimeEntries,
      taskDeadlines: sampleTaskDeadlines,
    });

    expect(projection).toMatchObject({
      definitionKey: "aged_receivables",
      groupingKey: "client",
      summary: {
        metrics: expect.objectContaining({
          totalReceivableCents: 15600,
          invoiceCount: 6,
          clientCount: 1,
          pastDueCount: 4,
          currentCents: 1600,
          days1To30Cents: 2000,
          days31To60Cents: 3000,
          days61To90Cents: 4000,
          days91PlusCents: 5000,
        }),
        groups: [
          expect.objectContaining({
            key: "contact-ada",
            label: "Ada Morgan",
            totalCents: 15600,
            rowCount: 6,
          }),
        ],
      },
    });
    expect(projection.rows.map((row) => row.metadata.bucketKey)).toEqual([
      "91_plus",
      "61_90",
      "31_60",
      "1_30",
      "current",
      "current",
    ]);
    expect(new Set(projection.rows.map((row) => row.metadata.bucketKey))).toEqual(
      new Set(["current", "1_30", "31_60", "61_90", "91_plus"]),
    );
    expect(projection.rows[0]).toMatchObject({
      id: "invoice-91-plus",
      label: "INV-91-PLUS Ada Morgan",
      matterId: "matter-001",
      matterNumber: "2026-0001",
      metadata: expect.objectContaining({
        clientContactId: "contact-ada",
        clientDisplayName: "Ada Morgan",
        invoiceId: "invoice-91-plus",
        invoiceNumber: "INV-91-PLUS",
        matterId: "matter-001",
        matterNumber: "2026-0001",
        totalCents: 5000,
        paidCents: 0,
        balanceDueCents: 5000,
        bucketKey: "91_plus",
        bucketLabel: "91+ days",
        days91PlusCents: 5000,
      }),
    });
    expect(JSON.stringify(projection)).not.toContain("INV-DRAFT-EXCLUDED");
    expect(JSON.stringify(projection)).not.toContain("INV-APPROVED-EXCLUDED");
    expect(JSON.stringify(projection)).not.toContain("INV-VOID-EXCLUDED");
    expect(JSON.stringify(projection)).not.toContain("INV-PAID-EXCLUDED");
    expect(JSON.stringify(projection)).not.toContain("undated");

    const byMatter = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "aged_receivables",
      groupingKey: "matter",
      matters: sampleMatters,
      users: sampleUsers,
      contacts: sampleContacts,
      invoices: receivableInvoices,
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      timeEntries: sampleTimeEntries,
      taskDeadlines: sampleTaskDeadlines,
    });
    const byInvoice = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "aged_receivables",
      groupingKey: "invoice",
      matters: sampleMatters,
      users: sampleUsers,
      contacts: sampleContacts,
      invoices: receivableInvoices,
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      timeEntries: sampleTimeEntries,
      taskDeadlines: sampleTaskDeadlines,
    });
    const byBucket = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "aged_receivables",
      groupingKey: "aging_bucket",
      matters: sampleMatters,
      users: sampleUsers,
      contacts: sampleContacts,
      invoices: receivableInvoices,
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      timeEntries: sampleTimeEntries,
      taskDeadlines: sampleTaskDeadlines,
    });

    expect(byMatter.summary.groups[0]).toMatchObject({
      key: "matter-001",
      label: "2026-0001 Morgan tenancy dispute",
    });
    expect(byInvoice.summary.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "invoice-91-plus", label: "INV-91-PLUS" }),
      ]),
    );
    expect(byBucket.summary.groups.map((group) => group.key)).toEqual([
      "1_30",
      "31_60",
      "61_90",
      "91_plus",
      "current",
    ]);
  });

  it("builds read-only billing period lock impact rows with safe IDs and visible matter filtering", () => {
    const billingPeriodLocks = [
      {
        id: "billing-lock-april",
        firmId: "firm-west-legal",
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-05-01T00:00:00.000Z",
        reason: "Synthetic closed April.",
        lockedByUserId: "user-admin",
        lockedAt: "2026-05-01T00:00:00.000Z",
      },
    ];
    const hiddenTimeEntry = {
      ...sampleTimeEntries[0]!,
      id: "time-hidden-locked",
      matterId: "matter-hidden",
      narrative: "Synthetic hidden matter time narrative",
    };
    const hiddenExpenseEntry = {
      ...sampleExpenseEntries[0]!,
      id: "expense-hidden-locked",
      matterId: "matter-hidden",
      description: "Synthetic hidden matter expense description",
    };
    const invoiceSourceOnly = {
      ...sampleInvoices[0]!,
      id: "invoice-source-only",
      invoiceNumber: "INV-SOURCE-ONLY",
      status: "approved" as const,
      createdAt: "2026-06-01T00:00:00.000Z",
      approvedAt: "2026-06-02T00:00:00.000Z",
      issuedAt: undefined,
      dueAt: "2026-06-30T00:00:00.000Z",
      memo: "Synthetic invoice source memo",
      lines: [{ timeEntryId: "time-001" }],
    };
    const invoiceLifecycle = {
      ...sampleInvoices[0]!,
      id: "invoice-lifecycle-locked",
      invoiceNumber: "INV-LIFECYCLE-LOCKED",
      status: "issued" as const,
      createdAt: "2026-04-06T17:00:00.000Z",
      approvedAt: "2026-04-07T17:00:00.000Z",
      issuedAt: "2026-04-08T17:00:00.000Z",
      dueAt: "2026-05-06T17:00:00.000Z",
      memo: "Synthetic invoice lifecycle memo",
      lines: [],
    };
    const hiddenInvoice = {
      ...sampleInvoices[0]!,
      id: "invoice-hidden-locked",
      matterId: "matter-hidden",
      memo: "Synthetic hidden matter invoice memo",
      lines: [{ timeEntryId: "time-hidden-locked" }],
    };

    const projection = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "billing_period_lock_impact",
      matters: sampleMatters,
      users: sampleUsers,
      invoices: [invoiceSourceOnly, invoiceLifecycle, hiddenInvoice],
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      billingPeriodLocks,
      timeEntries: [...sampleTimeEntries, hiddenTimeEntry],
      expenseEntries: [...sampleExpenseEntries, hiddenExpenseEntry],
      taskDeadlines: sampleTaskDeadlines,
    });

    expect(projection).toMatchObject({
      definitionKey: "billing_period_lock_impact",
      groupingKey: "lock",
      summary: {
        metrics: expect.objectContaining({
          impactRowCount: 4,
          impactedLockCount: 1,
          impactedMatterCount: 1,
          totalSafeIdCount: 4,
          timeEntryImpactCount: 1,
          expenseEntryImpactCount: 1,
          invoiceImpactCount: 2,
        }),
      },
    });
    expect(projection.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          safeIds: ["time-001"],
          metadata: expect.objectContaining({
            lockId: "billing-lock-april",
            sourceType: "time_entry",
            status: "approved",
            matterNumber: "2026-0001",
            safeIdCount: 1,
            firstSafeId: "time-001",
          }),
        }),
        expect.objectContaining({
          safeIds: ["expense-001"],
          metadata: expect.objectContaining({
            sourceType: "expense_entry",
            status: "approved",
          }),
        }),
        expect.objectContaining({
          safeIds: ["invoice-lifecycle-locked"],
          metadata: expect.objectContaining({
            sourceType: "invoice",
            status: "issued",
          }),
        }),
        expect.objectContaining({
          safeIds: ["invoice-source-only"],
          metadata: expect.objectContaining({
            sourceType: "invoice",
            status: "approved",
          }),
        }),
      ]),
    );

    const byStatus = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "billing_period_lock_impact",
      groupingKey: "status",
      matters: sampleMatters,
      users: sampleUsers,
      invoices: [invoiceSourceOnly, invoiceLifecycle],
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      billingPeriodLocks,
      timeEntries: sampleTimeEntries,
      expenseEntries: sampleExpenseEntries,
      taskDeadlines: sampleTaskDeadlines,
    });
    const bySource = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "billing_period_lock_impact",
      groupingKey: "source_type",
      matters: sampleMatters,
      users: sampleUsers,
      invoices: [invoiceSourceOnly, invoiceLifecycle],
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      billingPeriodLocks,
      timeEntries: sampleTimeEntries,
      expenseEntries: sampleExpenseEntries,
      taskDeadlines: sampleTaskDeadlines,
    });
    const byMatter = buildStaffReportProjection({
      firmId: "firm-west-legal",
      generatedAt,
      definitionKey: "billing_period_lock_impact",
      groupingKey: "matter",
      matters: sampleMatters,
      users: sampleUsers,
      invoices: [invoiceSourceOnly, invoiceLifecycle],
      ledgerAccounts: sampleLedgerAccounts,
      ledgerEntries: sampleLedgerEntries,
      reconciliations,
      legalClinicMatterProfiles: sampleLegalClinicMatterProfiles,
      billingPeriodLocks,
      timeEntries: sampleTimeEntries,
      expenseEntries: sampleExpenseEntries,
      taskDeadlines: sampleTaskDeadlines,
    });

    expect(new Set(byStatus.summary.groups.map((group) => group.key))).toEqual(
      new Set(["approved", "issued"]),
    );
    expect(new Set(bySource.summary.groups.map((group) => group.key))).toEqual(
      new Set(["time_entry", "expense_entry", "invoice"]),
    );
    expect(byMatter.summary.groups[0]).toMatchObject({
      key: "matter-001",
      label: "2026-0001 Morgan tenancy dispute",
    });
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain("Reviewed tenancy branch materials");
    expect(serialized).not.toContain("Tribunal evidence package");
    expect(serialized).not.toContain("Synthetic invoice source memo");
    expect(serialized).not.toContain("Synthetic invoice lifecycle memo");
    expect(serialized).not.toContain("matter-hidden");
    expect(serialized).not.toContain("time-hidden-locked");
    expect(serialized).not.toContain("expense-hidden-locked");
    expect(serialized).not.toContain("invoice-hidden-locked");
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
