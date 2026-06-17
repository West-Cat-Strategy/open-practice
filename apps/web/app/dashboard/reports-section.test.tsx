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
    expect(html).toContain("Aged receivables");
    expect(html).toContain("Ada Morgan");
    expect(html).toContain("invoice INV-AR-001");
    expect(html).toContain("61-90 days");
    expect(html).toContain("75 days past due");
    expect(html).toContain("Residential tenancy");
    expect(html).toContain("clinic-program-tenancy-stability");
    expect(html).toContain("not reviewed");
    expect(html).not.toContain("custom SQL editor");
    expect(html).not.toContain("ada@example.test");
    expect(html).not.toContain("Initial tenancy dispute invoice");
    expect(html).not.toContain("Synthetic private productivity report body");
  });
});
