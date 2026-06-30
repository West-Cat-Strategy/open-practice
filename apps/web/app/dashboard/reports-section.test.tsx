import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { StaffReportingWorkspaceResponse } from "../types";
import { ReportsSection } from "./reports-section";

const generatedAt = "2026-06-04T12:00:00.000Z";

const reportingWorkspace: StaffReportingWorkspaceResponse = {
  generatedAt,
  definitions: [
    {
      key: "invoice_aging",
      name: "Invoice aging",
      description: "Synthetic invoice aging report.",
      category: "billing",
      defaultGrouping: "aging_bucket",
      filters: [{ key: "asOf", label: "As of", type: "date", defaultValue: "generatedAt" }],
      groupings: [
        {
          key: "aging_bucket",
          label: "Aging bucket",
          description: "Synthetic aging buckets.",
        },
      ],
      exportProfileIds: ["summary_json"],
      permissionScope: ["report:read", "report:export"],
      source: "open_practice_builtin",
      savedAt: generatedAt,
      updatedAt: generatedAt,
      scheduleReadiness: {
        status: "manual_export_ready",
        cadence: "not_scheduled",
        manualExportReady: true,
        scheduledRunReady: false,
        scheduledEmailDelivery: false,
        readinessReasons: ["saved_definition_available", "scheduled_delivery_not_enabled"],
      },
      builderPosture: {
        status: "saved_definition_metadata",
        supportedFilterCount: 1,
        supportedGroupingCount: 1,
        exportProfileCount: 1,
        customSql: false,
        biEmbed: false,
        broadReportExecution: false,
        mutableDefinitionBuilder: false,
        storesRawReportBodies: false,
      },
    },
    {
      key: "aged_receivables",
      name: "Aged receivables",
      description: "Synthetic aged receivables report.",
      category: "billing",
      defaultGrouping: "client",
      filters: [{ key: "asOf", label: "As of", type: "date", defaultValue: "generatedAt" }],
      groupings: [
        {
          key: "client",
          label: "Client",
          description: "Synthetic client grouping.",
        },
        {
          key: "invoice",
          label: "Invoice",
          description: "Synthetic invoice grouping.",
        },
        {
          key: "aging_bucket",
          label: "Aging bucket",
          description: "Synthetic aging buckets.",
        },
      ],
      exportProfileIds: ["summary_json"],
      permissionScope: ["report:read", "report:export"],
      source: "open_practice_builtin",
      savedAt: generatedAt,
      updatedAt: generatedAt,
      scheduleReadiness: {
        status: "manual_export_ready",
        cadence: "not_scheduled",
        manualExportReady: true,
        scheduledRunReady: false,
        scheduledEmailDelivery: false,
        readinessReasons: ["saved_definition_available", "scheduled_delivery_not_enabled"],
      },
      builderPosture: {
        status: "saved_definition_metadata",
        supportedFilterCount: 1,
        supportedGroupingCount: 3,
        exportProfileCount: 1,
        customSql: false,
        biEmbed: false,
        broadReportExecution: false,
        mutableDefinitionBuilder: false,
        storesRawReportBodies: false,
      },
    },
  ],
  exportProfiles: [
    {
      id: "summary_json",
      label: "Summary JSON",
      format: "json",
      detailLevel: "summary",
      manualDownloadOnly: true,
      scheduledEmailDelivery: false,
      includesRawReportBody: false,
    },
  ],
  exportProfileAlignment: {
    status: "read_only_metadata_alignment",
    staffReportProfiles: [
      {
        id: "summary_json",
        label: "Summary JSON",
        format: "json",
        detailLevel: "summary",
        manualDownloadOnly: true,
        scheduledEmailDelivery: false,
        includesRawReportBody: false,
      },
      {
        id: "review_csv",
        label: "Review CSV profile",
        format: "csv",
        detailLevel: "row_summary",
        manualDownloadOnly: true,
        scheduledEmailDelivery: false,
        includesRawReportBody: false,
      },
    ],
    financialFieldProfiles: [
      {
        id: "billing_operational_records_json",
        label: "Billing operational records JSON",
        format: "json",
        source: "generated_local_projection",
        fieldKeyCount: 78,
        sampleFieldKeys: ["fieldProfile", "generatedAt", "reportType"],
        manualDownloadOnly: true,
        scheduledDelivery: false,
        storesRawExportBody: false,
      },
      {
        id: "jurisdictional_trust_summary_json",
        label: "Jurisdictional trust summary JSON",
        format: "json",
        source: "generated_local_projection",
        fieldKeyCount: 28,
        sampleFieldKeys: ["fieldProfile", "groupBy", "filters"],
        manualDownloadOnly: true,
        scheduledDelivery: false,
        storesRawExportBody: false,
      },
    ],
    differences: [
      {
        key: "purpose",
        label: "Purpose",
        staffReporting: "Manual saved-report downloads for staff review.",
        financialFieldProfiles:
          "Allowlisted field metadata for generated local financial downloads.",
      },
      {
        key: "field_key_behavior",
        label: "Field-key behavior",
        staffReporting: "No field-key allowlist is attached to manual report export profiles.",
        financialFieldProfiles: "Each financial field profile lists generated-projection keys.",
      },
      {
        key: "download_body_behavior",
        label: "Download body",
        staffReporting: "Downloads regenerate authorized report projections at request time.",
        financialFieldProfiles:
          "Downloads include field metadata while preserving existing serialization.",
      },
    ],
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
  },
  reports: [
    {
      definitionKey: "invoice_aging",
      generatedAt,
      groupingKey: "aging_bucket",
      filters: { asOf: generatedAt },
      dimensionFilters: {},
      rowCount: 1,
      summary: { totalRows: 1, metrics: { invoiceCount: 1 }, groups: [] },
      rows: [
        {
          id: "invoice-row-001",
          label: "INV-2026-0001",
          groupKey: "clinic-program-tenancy-stability",
          groupLabel: "Tenancy Stability Clinic",
          status: "issued",
          tone: "risk",
          matterId: "matter-001",
          matterNumber: "2026-0001",
          metricCents: 13230,
          dimensions: {
            jurisdiction: "BC",
            practiceArea: "Residential tenancy",
            clinicProgramId: "clinic-program-tenancy-stability",
            restrictedFundReviewStatus: "not_reviewed",
          },
          metadata: {},
        },
      ],
      projectionPolicy: {
        customSql: false,
        biEmbed: false,
        rawBodiesStoredInJobMetadata: false,
        scheduledEmailDelivery: false,
      },
    },
    {
      definitionKey: "aged_receivables",
      generatedAt,
      groupingKey: "client",
      filters: { asOf: generatedAt },
      dimensionFilters: {},
      rowCount: 1,
      summary: {
        totalRows: 1,
        metrics: { invoiceCount: 1, totalReceivableCents: 13230 },
        groups: [],
      },
      rows: [
        {
          id: "invoice-aged-001",
          label: "INV-AR-001 Ada Morgan",
          groupKey: "contact-ada",
          groupLabel: "Ada Morgan",
          status: "issued",
          tone: "risk",
          matterId: "matter-001",
          matterNumber: "2026-0001",
          metricCents: 13230,
          dimensions: {
            jurisdiction: "BC",
            practiceArea: "Residential tenancy",
            clinicProgramId: "clinic-program-tenancy-stability",
            restrictedFundReviewStatus: "not_reviewed",
          },
          metadata: {
            clientContactId: "contact-ada",
            clientDisplayName: "Ada Morgan",
            invoiceId: "invoice-aged-001",
            invoiceNumber: "INV-AR-001",
            bucketKey: "61_90",
            bucketLabel: "61-90 days",
            daysPastDue: 75,
            balanceDueCents: 13230,
          },
        },
      ],
      projectionPolicy: {
        customSql: false,
        biEmbed: false,
        rawBodiesStoredInJobMetadata: false,
        scheduledEmailDelivery: false,
      },
    },
    {
      definitionKey: "billing_period_lock_impact",
      generatedAt,
      groupingKey: "lock",
      filters: { asOf: generatedAt, sourceTypes: "time_entry,expense_entry,invoice" },
      dimensionFilters: {},
      rowCount: 1,
      summary: {
        totalRows: 1,
        metrics: { impactRowCount: 1, totalSafeIdCount: 2 },
        groups: [],
      },
      rows: [
        {
          id: "lock-test:time_entry:approved:matter-001",
          label: "2026-06-01 to 2026-06-30 Time entries",
          groupKey: "lock-test",
          groupLabel: "2026-06-01 to 2026-06-30",
          status: "approved",
          tone: "neutral",
          matterId: "matter-001",
          matterNumber: "2026-0001",
          occurredAt: "2026-06-06T09:00:00.000Z",
          metricCount: 2,
          safeIds: ["time-safe-001", "time-safe-002"],
          dimensions: {
            jurisdiction: "BC",
            practiceArea: "Residential tenancy",
            clinicProgramId: "clinic-program-tenancy-stability",
            restrictedFundReviewStatus: "not_reviewed",
          },
          metadata: {
            lockId: "lock-test",
            lockPeriodStart: "2026-06-01T00:00:00.000Z",
            lockPeriodEnd: "2026-06-30T00:00:00.000Z",
            sourceType: "time_entry",
            status: "approved",
            matterId: "matter-001",
            matterNumber: "2026-0001",
            safeIdCount: 2,
            firstSafeId: "time-safe-001",
          },
        },
      ],
      projectionPolicy: {
        customSql: false,
        biEmbed: false,
        rawBodiesStoredInJobMetadata: false,
        scheduledEmailDelivery: false,
      },
    },
  ],
  history: [],
  scheduleReadinessSummary: {
    totalDefinitions: 2,
    manualExportReadyDefinitions: 2,
    manualOnlyDefinitionKeys: ["invoice_aging", "aged_receivables"],
    recentExportRequestCount: 0,
    scheduledDefinitionCount: 0,
    automaticExecution: false,
    scheduledEmailDeliveryEnabled: false,
    rawReportBodyStorage: false,
  },
  reportBuilderPosture: {
    status: "metadata_only",
    savedDefinitionsOnly: true,
    filterCount: 2,
    groupingCount: 4,
    exportProfileCount: 1,
    customSql: false,
    biEmbeds: false,
    broadReportExecution: false,
    mutableDefinitionBuilder: false,
    rawReportBodyStorage: false,
  },
  exportJobPosture: {
    queueName: "reports",
    jobName: "staff_report_export",
    historyCount: 0,
    boundedMetadataOnly: true,
    storesReportBodiesInJobMetadata: false,
    downloadsRegenerateProjection: true,
    scheduledDeliveryJobs: false,
  },
  workspacePolicy: {
    customSql: false,
    biEmbeds: false,
    scheduledEmailDelivery: false,
    rawReportBodiesInJobMetadata: false,
  },
};

describe("ReportsSection", () => {
  it("renders schedule readiness and builder posture without risky execution controls", () => {
    const html = renderToStaticMarkup(
      createElement(ReportsSection, {
        compactDate: (value?: string) => value ?? "none",
        cents: (value: number) => `$${value}`,
        exportingReportKey: "",
        exportStatus: "No report export requested in this session.",
        minutes: (value: number) => `${value}m`,
        onPollReportExport: () => {},
        onDownloadReportExport: () => {},
        onRequestReportExport: () => {},
        reportingWorkspace,
      }),
    );

    expect(html).toContain("Schedule readiness");
    expect(html).toContain("Report builder posture");
    expect(html).toContain("Manual exports only");
    expect(html).toContain("No custom SQL");
    expect(html).toContain("No BI embeds");
    expect(html).toContain("No scheduled email delivery");
    expect(html).toContain("No raw report bodies");
    expect(html).toContain("Export profile alignment");
    expect(html).toContain("Manual report export profiles");
    expect(html).toContain("Summary JSON (JSON)");
    expect(html).toContain("Review CSV profile (CSV)");
    expect(html).toContain("Financial export field profiles");
    expect(html).toContain("Billing operational records JSON (78 keys)");
    expect(html).toContain("Jurisdictional trust summary JSON (28 keys)");
    expect(html).toContain("No payment processor exposure");
    expect(html).toContain("No invoice mutation");
    expect(html).toContain("No trust posting");
    expect(html).toContain("No certification claims");
    expect(html).toContain("Field-key behavior");
    expect(html).toContain("Downloads regenerate authorized report projections");
    expect(html).toContain("Aged receivables");
    expect(html).toContain("Ada Morgan");
    expect(html).toContain("invoice INV-AR-001");
    expect(html).toContain("61-90 days");
    expect(html).toContain("75 days past due");
    expect(html).toContain("billing period lock impact");
    expect(html).toContain("lock-test");
    expect(html).toContain("safe IDs time-safe-001, time-safe-002");
    expect(html).toContain("Residential tenancy");
    expect(html).toContain("clinic-program-tenancy-stability");
    expect(html).toContain("not reviewed");
    expect(html).not.toContain("custom SQL editor");
    expect(html).not.toContain("schedule export email");
    expect(html).not.toContain("payment processor setup");
    expect(html).not.toContain("post trust entry");
    expect(html).not.toContain("unlock");
    expect(html).not.toContain("override");
    expect(html).not.toContain("bypass");
    expect(html).not.toContain("ada@example.test");
    expect(html).not.toContain("Initial tenancy dispute invoice");
    expect(html).not.toContain("Synthetic private productivity report body");
  });
});
