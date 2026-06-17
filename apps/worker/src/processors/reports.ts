import type { OpenPracticeRepository } from "@open-practice/database";
import {
  buildStaffReportProjection,
  canAccess,
  getStaffSavedReportDefinition,
  isStaffReportDefinitionKey,
  isStaffReportExportProfileId,
  isStaffReportGroupingKey,
  type StaffReportDimensionFilters,
} from "@open-practice/domain";
import { compactMetadata, metadataString } from "./metadata.js";
import type { WorkerJobEnvelope, WorkerJobResult } from "./types.js";

function metadataJurisdiction(metadata: Record<string, unknown>): string | undefined {
  const value = metadataString(metadata, "jurisdiction");
  return value === "BC" || value === "ON" || value === "CANADA" || value === "OTHER"
    ? value
    : undefined;
}

function metadataStaffReportDefinitionKey(metadata: Record<string, unknown>) {
  const value = metadataString(metadata, "reportDefinitionKey");
  return value && isStaffReportDefinitionKey(value) ? value : undefined;
}

function metadataStaffReportExportProfileId(metadata: Record<string, unknown>) {
  const value = metadataString(metadata, "exportProfileId");
  return value && isStaffReportExportProfileId(value) ? value : undefined;
}

function metadataStaffReportGroupingKey(metadata: Record<string, unknown>) {
  const value = metadataString(metadata, "groupingKey");
  return value && isStaffReportGroupingKey(value) ? value : undefined;
}

function metadataStaffReportDimensionFilters(
  metadata: Record<string, unknown>,
): StaffReportDimensionFilters {
  return compactMetadata({
    jurisdiction: metadataJurisdiction(metadata),
    practiceArea: metadataString(metadata, "practiceArea"),
    clinicProgramId: metadataString(metadata, "clinicProgramId"),
    restrictedFundReviewStatus: metadataString(metadata, "restrictedFundReviewStatus"),
  }) as StaffReportDimensionFilters;
}

function visibleMatterIds(
  dossiers: Awaited<ReturnType<OpenPracticeRepository["listContactDossiersForUser"]>>,
): Set<string> {
  return new Set(dossiers.flatMap((dossier) => dossier.matters.map((matter) => matter.matterId)));
}

function visibleContactIds(
  dossiers: Awaited<ReturnType<OpenPracticeRepository["listContactDossiersForUser"]>>,
): Set<string> {
  return new Set(dossiers.map((dossier) => dossier.contact.id));
}

export async function processReportJob(input: {
  jobName: string;
  data: WorkerJobEnvelope;
  repository: OpenPracticeRepository;
}): Promise<WorkerJobResult> {
  const { data, repository } = input;

  if (input.jobName === "audit_export" && data.resourceType === "audit_export") {
    const audit = await repository.listAuditEvents(data.firmId);
    return {
      status: "completed",
      metadata: {
        firmId: data.firmId,
        resourceType: "audit_export",
        resourceId: data.resourceId,
        reportType: "audit_log",
        reportScope: "firm",
        eventCount: audit.events.length,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  if (input.jobName === "billing_export" && data.resourceType === "billing_export") {
    const matterId = metadataString(data.metadata ?? {}, "matterId");
    const [timeEntries, expenseEntries, invoices, payments, trustTransferRequests] =
      await Promise.all([
        repository.listTimeEntries(data.firmId, matterId ? { matterId } : {}),
        repository.listExpenseEntries(data.firmId, matterId ? { matterId } : {}),
        repository.listInvoices(data.firmId, matterId ? { matterId } : {}),
        repository.listPayments(data.firmId, matterId ? { matterId } : {}),
        repository.listTrustTransferRequests(data.firmId, matterId ? { matterId } : {}),
      ]);
    const recordCount =
      timeEntries.length +
      expenseEntries.length +
      invoices.length +
      payments.length +
      trustTransferRequests.length;
    return {
      status: "completed",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: "billing_export",
        resourceId: data.resourceId,
        reportType: "billing",
        reportScope: matterId ? "matter" : "firm",
        matterId,
        recordCount,
        timeEntryCount: timeEntries.length,
        expenseEntryCount: expenseEntries.length,
        invoiceCount: invoices.length,
        paymentCount: payments.length,
        trustTransferRequestCount: trustTransferRequests.length,
        generatedAt: new Date().toISOString(),
      }),
    };
  }

  if (
    input.jobName === "jurisdictional_trust_export" &&
    data.resourceType === "jurisdictional_trust_export"
  ) {
    const jurisdiction = metadataJurisdiction(data.metadata ?? {});
    return {
      status: "completed",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: "jurisdictional_trust_export",
        resourceId: data.resourceId,
        reportType: "jurisdictional_trust",
        reportScope: "firm",
        jurisdiction,
        generatedAt: new Date().toISOString(),
      }),
    };
  }

  if (input.jobName === "staff_report_export" && data.resourceType === "staff_report_export") {
    const metadata = data.metadata ?? {};
    const reportDefinitionKey = metadataStaffReportDefinitionKey(metadata);
    const exportProfileId = metadataStaffReportExportProfileId(metadata);
    if (!reportDefinitionKey || !exportProfileId) {
      return {
        status: "skipped",
        reason: "Staff report export metadata was incomplete",
        metadata: compactMetadata({
          firmId: data.firmId,
          resourceType: "staff_report_export",
          resourceId: data.resourceId,
          reportType: "staff_reporting",
          reportStatus: "invalid_metadata",
        }),
      };
    }
    const definition = getStaffSavedReportDefinition(reportDefinitionKey);
    const groupingKey = metadataStaffReportGroupingKey(metadata) ?? definition.defaultGrouping;
    const dimensionFilters = metadataStaffReportDimensionFilters(metadata);
    const overview = await repository.getOverview(data.firmId);
    const firmWideMatterReader =
      overview.users.find((user) => user.role === "owner_admin") ??
      overview.users.find((user) => user.role === "auditor") ??
      overview.users[0];
    const [matters, invoices, ledger, reconciliations, timeEntries, taskDeadlines] =
      await Promise.all([
        firmWideMatterReader ? repository.listMattersForUser(firmWideMatterReader) : [],
        repository.listInvoices(data.firmId),
        repository.getLedger(data.firmId),
        repository.listLedgerReconciliations(data.firmId),
        repository.listTimeEntries(data.firmId),
        repository.listTaskDeadlines(data.firmId, { includeCompleted: true }),
      ]);
    const legalClinicMatterProfiles = (
      await Promise.all(
        matters.map((matter) => repository.getLegalClinicMatterProfile(data.firmId, matter.id)),
      )
    ).filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));
    const projection = buildStaffReportProjection({
      firmId: data.firmId,
      definitionKey: reportDefinitionKey,
      groupingKey,
      dimensionFilters,
      matters,
      users: overview.users,
      invoices,
      ledgerAccounts: ledger.accounts,
      ledgerEntries: ledger.entries,
      reconciliations,
      legalClinicMatterProfiles,
      timeEntries,
      taskDeadlines,
    });
    return {
      status: "completed",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: "staff_report_export",
        resourceId: data.resourceId,
        reportType: "staff_reporting",
        reportDefinitionKey,
        exportProfileId,
        groupingKey,
        jurisdiction: dimensionFilters.jurisdiction,
        practiceArea: dimensionFilters.practiceArea,
        clinicProgramId: dimensionFilters.clinicProgramId,
        restrictedFundReviewStatus: dimensionFilters.restrictedFundReviewStatus,
        rowCount: projection.rowCount,
        generatedAt: projection.generatedAt,
      }),
    };
  }

  if (
    input.jobName === "conversation_thread_export" &&
    data.resourceType === "conversation_thread_export"
  ) {
    const threadId = metadataString(data.metadata ?? {}, "threadId");
    const thread = threadId
      ? await repository.getConversationThread(data.firmId, threadId)
      : undefined;
    if (!thread) {
      return {
        status: "skipped",
        reason: "Conversation thread export target was not found",
        metadata: compactMetadata({
          firmId: data.firmId,
          resourceType: "conversation_thread_export",
          resourceId: data.resourceId,
          reportType: "conversation_thread",
          reportScope: "matter",
          threadId,
          reportStatus: "missing_thread",
        }),
      };
    }
    const messages = await repository.listConversationMessages(data.firmId, {
      threadId: thread.id,
    });
    return {
      status: "completed",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: "conversation_thread_export",
        resourceId: data.resourceId,
        reportType: "conversation_thread",
        reportScope: "matter",
        matterId: thread.matterId,
        threadId: thread.id,
        messageCount: messages.length,
        generatedAt: new Date().toISOString(),
      }),
    };
  }

  if (
    input.jobName === "contact_history_export" &&
    data.resourceType === "contact_history_export"
  ) {
    const metadata = data.metadata ?? {};
    const contactId = metadataString(metadata, "contactId");
    const requestedByUserId = metadataString(metadata, "requestedByUserId");
    if (!contactId || !requestedByUserId) {
      return {
        status: "skipped",
        reason: "Contact-history export metadata was incomplete",
        metadata: compactMetadata({
          firmId: data.firmId,
          resourceType: "contact_history_export",
          resourceId: data.resourceId,
          reportType: "contact_history_export",
          reportScope: "contact",
          contactId,
          contactExportStatus: "invalid_metadata",
        }),
      };
    }
    const requester = await repository.getUser(data.firmId, requestedByUserId);
    if (
      !requester ||
      !canAccess({
        user: requester,
        firmId: data.firmId,
        resource: "contact",
        action: "export",
      })
    ) {
      return {
        status: "skipped",
        reason: "Contact-history export requester is no longer authorized",
        metadata: compactMetadata({
          firmId: data.firmId,
          resourceType: "contact_history_export",
          resourceId: data.resourceId,
          reportType: "contact_history_export",
          reportScope: "contact",
          contactId,
          requestedByUserId,
          contactExportStatus: "requester_not_authorized",
        }),
      };
    }
    const dossiers = await repository.listContactDossiersForUser(requester);
    const dossier = dossiers.find((candidate) => candidate.contact.id === contactId);
    if (!dossier) {
      return {
        status: "skipped",
        reason: "Contact-history export target is no longer visible",
        metadata: compactMetadata({
          firmId: data.firmId,
          resourceType: "contact_history_export",
          resourceId: data.resourceId,
          reportType: "contact_history_export",
          reportScope: "contact",
          contactId,
          requestedByUserId,
          contactExportStatus: "contact_not_visible",
        }),
      };
    }
    const [portalGrants, timeline, resolutions] = await Promise.all([
      repository.listContactPortalGrantsForUser(requester, contactId),
      repository.listContactTimelineForUser(requester, contactId),
      repository.listContactDataQualityResolutions(data.firmId, { contactId }),
    ]);
    const matterIds = visibleMatterIds(dossiers);
    const contactIds = visibleContactIds(dossiers);
    const visibleResolutionCount = resolutions.filter(
      (resolution) =>
        resolution.contactId === contactId &&
        (!resolution.matterId || matterIds.has(resolution.matterId)) &&
        (!resolution.relatedContactId || contactIds.has(resolution.relatedContactId)),
    ).length;
    return {
      status: "completed",
      metadata: compactMetadata({
        firmId: data.firmId,
        resourceType: "contact_history_export",
        resourceId: data.resourceId,
        reportType: "contact_history_export",
        reportScope: "contact",
        contactId,
        requestedByUserId,
        purpose: "staff_review",
        reviewReasonPresent: true,
        downloadExpiresAt: metadataString(metadata, "downloadExpiresAt"),
        generatedCategoryCount: 9,
        timelineEntryCount: timeline.length,
        matterAssociationCount: dossier.matters.length,
        portalGrantCount: portalGrants.length,
        conflictSummaryCount: dossier.conflictHistory.length + dossier.conflictCues.length,
        recordCount: visibleResolutionCount,
        retentionPosture: "queued_regenerated_download_no_retained_export_body",
        legalHoldPosture: "respects_existing_matter_visibility_no_hold_override",
        privacyPosture: "redacted_authorized_projection_only",
        storedBody: false,
        retainedExportArtifact: false,
        deletionAutomation: false,
        retentionDeadline: false,
        legalHoldOverride: false,
        redactedAuthorizedProjection: true,
        exportBodyStoredInJobMetadata: false,
        contactExportStatus: "completed",
        generatedAt: new Date().toISOString(),
      }),
    };
  }

  return {
    status: "skipped",
    reason: "Unsupported report export job",
    metadata: {
      firmId: data.firmId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      reportStatus: "unsupported",
    },
  };
}
