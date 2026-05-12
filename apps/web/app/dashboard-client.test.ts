import { describe, expect, it } from "vitest";
import type {
  ActivityTimelineEntry,
  CalendarEventRecord,
  DashboardSectionCapability,
  DashboardSectionKey,
  DraftRecord,
  DraftTemplateRecord,
} from "@open-practice/domain";
import { sampleResidentialTenancyIntakeDefinition } from "@open-practice/domain/sample-data";
import { buildSidebarNavigationSections } from "../routes/routeCatalog";
import {
  applySavedQueueFocus,
  describeSavedQueueFocus,
  describeDisabledNavigationReason,
  filterMatters,
  summarizeQueues,
} from "./dashboard-utils";
import {
  buildConflictCheckPayload,
  describeConflictCheckStatus,
  describeConflictResult,
  formatConflictProspectiveRole,
  parseConflictAliases,
  parseConflictIdentifiers,
  summarizeConflictCheckPayload,
} from "./conflict-check-dashboard";
import {
  buildCreateShareLinkPayload,
  describeCreateShareLinkResult,
  describeShareLinkState,
  formatSharePermission,
  replaceShareLink,
} from "./share-links-dashboard";
import {
  buildPublicSharePath,
  buildShareEmailVerificationPath,
  describePublicShareStatus,
  isShareEmailVerificationRequired,
  publicShareErrorMessage,
} from "./share-link-portal";
import {
  appendDraftToMatterDrafts,
  appendDraftExportRecord,
  appendMergeFieldToDraftDocument,
  buildBlankDraftPayload,
  buildDraftExportPayload,
  buildDraftFromTemplatePayload,
  buildDraftUpdatePayload,
  describeDraftAssistStatus,
  extractDraftPlainText,
  formatDraftExportSize,
  formatDraftApiFailure,
  insertDraftAssistSuggestion,
  isSameDraftDocument,
  loadDraftingDashboardData,
} from "./drafting-dashboard";
import {
  buildExternalUploadReviewPayload,
  buildExternalUploadReviewPath,
  buildExternalUploadCreatePayload,
  buildExternalUploadListPath,
  buildExternalUploadRevokePath,
  canCreateExternalUpload,
  describeExternalUploadReviewState,
  getExternalUploadLinkState,
  loadExternalUploadsDashboardData,
  upsertExternalUploadDocument,
  upsertExternalUploadLink,
} from "./external-uploads-dashboard";
import {
  buildDocumentProcessingQueuePath,
  buildDocumentProcessingWorkbenchPath,
  describeDocumentQueueAction,
  describeDocumentReviewSuggestion,
  describeLatestDocumentJob,
  describeLatestExtraction,
  documentProcessingRowsForMatter,
  emptyDocumentReviewSuggestions,
  emptyDocumentProcessingWorkbench,
  loadDocumentProcessingDashboardData,
  replaceDocumentProcessingWorkbench,
  summarizeDocumentReviewSuggestions,
  summarizeDocumentProcessingWorkbench,
} from "./document-processing-dashboard";
import {
  buildCalendarEventPayload,
  buildCalendarInvitationPayload,
  buildCalendarMeetingLinkPayload,
  buildCalendarRadarBuckets,
  buildCalendarReminderPayload,
  buildCalendarReschedulePayload,
  describeCalendarEventTiming,
  describeMeetingInvitationBoundary,
  describeMeetingLinkAvailability,
  loadCalendarDashboardData,
  removeCalendarEventReminder,
  removeCalendarEventAttendee,
  upsertCalendarEvent,
  upsertCalendarEventAttendee,
  upsertCalendarCredential,
  upsertCalendarEventReminder,
} from "./calendar-dashboard";
import {
  buildContactDossierConflictCheckPrefill,
  contactDossierRiskClass,
  contactReviewQueueRiskClass,
  filterContactDossiers,
  formatContactReviewSignalKind,
  summarizeContactDossier,
  summarizeContactReviewQueueItem,
} from "./contact-dossiers-dashboard";
import {
  activeJurisdictionTrustReportSummary,
  buildJurisdictionalTrustReportPath,
  buildTrustControlsPath,
  emptyJurisdictionalTrustReport,
  loadTrustControlsDashboardData,
  matterTrustBalanceCents,
  recentTrustPostings,
  summarizeTrustControls,
  trustControlsForMatter,
} from "./trust-controls-dashboard";
import {
  buildDraftInvoicePayload,
  describeDraftInvoiceCreated,
  updateBillingDashboardWithCreatedInvoice,
} from "./billing-dashboard";
import {
  buildWorkerHealthPath,
  buildWorkerRunsPath,
  emptyWorkerHealthResponse,
  describeWorkerRunStatus,
  emptyWorkerRunsResponse,
  formatWorkerRunAttempts,
  formatWorkerRunTiming,
  summarizeWorkerHealth,
  summarizeWorkerRuns,
  workerHealthTone,
  workerRunsForFilter,
  workerRunSafeContext,
} from "./worker-runs-dashboard";
import {
  buildProvidersStatusPath,
  emptyProvidersStatusResponse,
  providerPostureRows,
  summarizeProvidersStatus,
} from "./provider-status-dashboard";
import {
  connectorDisplayName,
  connectorOutboxStatusTone,
  emptyConnectorOperationsResponse,
  summarizeConnectorOperations,
  summarizeConnectorPayload,
} from "./connector-outbox-dashboard";
import {
  buildOperationalFocusSummary,
  operationalFocusEmptyMessage,
} from "./operational-focus-panel";
import {
  buildIntakeFormLinkCreatePayload,
  buildIntakeFormLinkListPath,
  buildIntakeFormReviewDecisionPath,
  buildIntakeFormReviewPath,
  buildIntakePortalPath,
  buildIntakeTemplatePreviewPayload,
  buildIntakeTemplateEditorValue,
  buildVariableMapping,
  currentProposalValue,
  describeRequestMoreInfoResult,
  describeIntakeTemplatePreview,
  buildIntakeVariableProposalListPath,
  getIntakeFormLinkState,
  loadIntakeFormsDashboardData,
  pendingSubmittedIntakeReviewLinks,
  previewStatusClass,
  summarizeAnswerValue,
  summarizeIntakeItemAction,
  summarizeIntakeReview,
  upsertIntakeFormLink,
  upsertIntakeVariableProposal,
} from "./intake-forms-dashboard";
import {
  buildLegalClinicMatterProfilePath,
  coerceLegalClinicProfilesResponse,
  describeFiscalHostProgramMetadata,
  describeLegalClinicProfileStatus,
  describeLegalClinicProgram,
  describeRestrictedFundMetadata,
  findLegalClinicProgram,
  fiscalHostWorkflowMetadata,
  legalClinicProgramsPath,
  loadLegalClinicDashboardData,
} from "./legal-clinic-dashboard";
import {
  buildCommunicationsInboxPath,
  describeCommunicationsDeliveryState,
  loadCommunicationsInboxDashboardData,
} from "./communications-inbox-dashboard";
import {
  actionComplete,
  coerceAnswer,
  errorMessage,
  itemAction,
  requiredIncompleteItemIds,
  visibleSections,
  type PublicIntakeFormPayload,
} from "./intake-forms/runner-utils";
import {
  buildMatterFileCommandCenter,
  filterMatterActivity,
  formatMatterActivityKind,
  matterActivityStatus,
  summarizeMatterActivity,
} from "./matter-command-center";
import {
  buildEmailDeliveryConfirmation,
  buildIntakeSessionCreatePayload,
  upsertIntakeSession,
} from "./types";
import type {
  ExternalUploadLinkRecord,
  ExternalUploadReviewItem,
  DocumentProcessingWorkbenchResponse,
  CommunicationsInboxMatterResponse,
  BillingDashboardResponse,
  ConnectorOperationsResponse,
  IntakeFormLinkSummary,
  MatterSummary,
  ProvidersStatusResponse,
  QueuesResponse,
  SavedOperationalViewDefinition,
  ShareLinkRecord,
  TaskDeadlineWorkbenchResponse,
  TrustControlsDashboardResponse,
  WorkerRunsDashboardResponse,
} from "./types";

const capabilityResources: Record<DashboardSectionKey, DashboardSectionCapability["resource"]> = {
  matters: "matter",
  contacts: "contact",
  funds: "trust_ledger",
  billing: "time_entry",
  documents: "document",
  drafting: "draft",
  calendar: "calendar_event",
  signatures: "signature_request",
  intake: "intake_session",
  audit: "audit_log",
};

function capability(
  key: DashboardSectionKey,
  overrides: Partial<DashboardSectionCapability> = {},
): DashboardSectionCapability {
  return {
    key,
    label: `${key} from API`,
    enabled: true,
    resource: capabilityResources[key],
    actions: ["read"],
    ...overrides,
  };
}

function matter(overrides: Partial<MatterSummary>): MatterSummary {
  return {
    id: "matter-001",
    firmId: "firm-west-legal",
    number: "2026-0001",
    title: "Morgan tenancy dispute",
    practiceArea: "Residential tenancy",
    status: "open",
    jurisdiction: "BC",
    responsibleUserId: "user-licensee",
    parties: [],
    documents: [],
    timeEntries: [],
    expenses: [],
    activity: [],
    trustBalanceCents: 0,
    ...overrides,
  } as MatterSummary;
}

const editorJson = {
  type: "doc" as const,
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Synthetic letter opening" }],
    },
  ],
};

function draftTemplate(overrides: Partial<DraftTemplateRecord> = {}): DraftTemplateRecord {
  return {
    id: "draft-template-legal-letter",
    firmId: "firm-west-legal",
    name: "Generic Legal Letter",
    description: "Synthetic correspondence template.",
    editorJson,
    category: "correspondence",
    active: true,
    createdAt: "2026-04-29T12:00:00.000Z",
    updatedAt: "2026-04-29T12:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

function draftRecord(overrides: Partial<DraftRecord> = {}): DraftRecord {
  return {
    id: "draft-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    title: "Generic Legal Letter - 2026-0001",
    editorJson,
    version: 1,
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    createdAt: "2026-04-29T12:00:00.000Z",
    updatedAt: "2026-04-29T12:00:00.000Z",
    metadata: { templateId: "draft-template-legal-letter" },
    ...overrides,
  };
}

function shareLink(overrides: Partial<ShareLinkRecord> = {}): ShareLinkRecord {
  return {
    id: "share-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    grantedByUserId: "user-admin",
    permissions: ["view_documents"],
    requireEmailVerification: true,
    createdAt: "2026-04-29T12:00:00.000Z",
    ...overrides,
  };
}

function externalUploadLink(
  overrides: Partial<ExternalUploadLinkRecord> = {},
): ExternalUploadLinkRecord {
  return {
    ...baseExternalUploadLink(),
    ...overrides,
  };
}

function externalUploadDocument(
  overrides: Partial<ExternalUploadReviewItem> = {},
): ExternalUploadReviewItem {
  return {
    id: "external-upload-document-001",
    matterId: "matter-001",
    externalUploadLinkId: "external-upload-link-001",
    title: "Synthetic upload.pdf",
    version: 1,
    classification: "general",
    legalHold: false,
    uploadStatus: "verified",
    checksumStatus: "verified",
    scanStatus: "queued",
    reviewStatus: "pending_review",
    reviewMetadata: {},
    uploadedAt: "2026-04-29T12:05:00.000Z",
    verifiedAt: "2026-04-29T12:06:00.000Z",
    ...overrides,
  };
}

function documentRecord(
  overrides: Partial<MatterSummary["documents"][number]> = {},
): MatterSummary["documents"][number] {
  return {
    id: "doc-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    title: "Residential tenancy evidence",
    storageKey: "private/storage/key.pdf",
    checksumSha256: "not-rendered-in-web",
    version: 1,
    classification: "general",
    legalHold: false,
    uploadStatus: "verified",
    checksumStatus: "verified",
    scanStatus: "passed",
    reviewStatus: "accepted",
    reviewMetadata: {},
    uploadedAt: "2026-05-01T12:00:00.000Z",
    verifiedAt: "2026-05-01T12:01:00.000Z",
    ...overrides,
  };
}

function activityEntry(overrides: Partial<ActivityTimelineEntry> = {}): ActivityTimelineEntry {
  return {
    id: "activity-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    occurredAt: "2026-05-01T12:00:00.000Z",
    title: "Document verified",
    kind: "document",
    metadata: { status: "verified" },
    ...overrides,
  };
}

function documentProcessingWorkbench(
  overrides: Partial<DocumentProcessingWorkbenchResponse> = {},
): DocumentProcessingWorkbenchResponse {
  return {
    matterId: "matter-001",
    status: "configured",
    providerStatus: [{ kind: "ocr", status: "configured", providers: [] }],
    workerQueues: [
      { queueName: "ai_triage", status: "reserved", reason: "deferred_worker" },
      { queueName: "ocr", status: "configured" },
      { queueName: "transcription", status: "reserved", reason: "deferred_worker" },
      { queueName: "media", status: "reserved", reason: "deferred_worker" },
    ],
    reservedQueues: [
      { queueName: "ai_triage", status: "reserved", reason: "deferred_worker" },
      { queueName: "transcription", status: "reserved", reason: "deferred_worker" },
      { queueName: "media", status: "reserved", reason: "deferred_worker" },
    ],
    actionableTasks: ["ocr"],
    reservedTasks: [
      { task: "classification", queueName: "ai_triage", status: "reserved" },
      { task: "transcription", queueName: "transcription", status: "reserved" },
      { task: "media", queueName: "media", status: "reserved" },
    ],
    summary: { total: 1, queued: 0, active: 0, failed: 0, terminal: 1, byQueue: [] },
    documents: [
      {
        document: {
          id: "doc-001",
          matterId: "matter-001",
          title: "Residential tenancy evidence",
          version: 1,
          classification: "general",
          legalHold: false,
          uploadStatus: "verified",
          checksumStatus: "verified",
          scanStatus: "passed",
          reviewStatus: "accepted",
        },
        group: "ready_to_process",
        queueEligibility: { eligible: true },
        latestJob: {
          id: "job-001",
          queueName: "ocr",
          status: "completed",
          terminal: true,
          failed: false,
        },
        latestExtraction: {
          status: "completed",
          language: "eng",
          pageCount: 2,
          confidence: 0.91,
        },
        reviewSuggestions: {
          reviewerOnly: true,
          mutating: false,
          summaryCounts: {
            classification: 1,
            duplicate_or_supersession: 0,
            matter_contact: 1,
            missing_metadata: 0,
            total: 2,
          },
          groups: {
            classification: [
              {
                id: "doc-001:classification",
                group: "classification",
                label: "Extraction suggests financial",
                detail: "Current classification is general.",
                tone: "risk",
                documentId: "doc-001",
                classification: "financial",
                confidence: 0.88,
                metadataKeys: ["suggestedClassification"],
              },
            ],
            duplicate_or_supersession: [],
            matter_contact: [
              {
                id: "doc-001:matter",
                group: "matter_contact",
                label: "Matter 2026-0001",
                detail: "Synthetic matter context",
                tone: "neutral",
                documentId: "doc-001",
              },
            ],
            missing_metadata: [],
          },
        },
      },
    ],
    ...overrides,
  };
}

function calendarEvent(overrides: Partial<CalendarEventRecord> = {}): CalendarEventRecord {
  return {
    id: "calendar-event-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    uid: "calendar-event-001@open-practice.local",
    title: "Synthetic filing deadline",
    startsAt: "2026-05-05T16:00:00.000Z",
    endsAt: "2026-05-05T16:30:00.000Z",
    status: "confirmed",
    sequence: 0,
    createdAt: "2026-04-29T12:00:00.000Z",
    updatedAt: "2026-04-29T12:00:00.000Z",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    ...overrides,
  };
}

function trustControls(
  overrides: Partial<Omit<TrustControlsDashboardResponse, "ledger" | "diagnostics">> & {
    ledger?: Partial<TrustControlsDashboardResponse["ledger"]>;
    diagnostics?: Partial<TrustControlsDashboardResponse["diagnostics"]>;
  } = {},
): TrustControlsDashboardResponse {
  const base: TrustControlsDashboardResponse = {
    ledger: {
      accounts: [
        {
          id: "acct-trust-bank",
          firmId: "firm-west-legal",
          name: "Pooled trust bank",
          type: "trust_asset",
        },
        {
          id: "acct-client-liability",
          firmId: "firm-west-legal",
          name: "Client trust liability",
          type: "client_liability",
        },
      ],
      entries: [
        {
          id: "trust-retainer-1",
          transactionId: "trust-retainer",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-trust-bank",
          debitCents: 150000,
          creditCents: 0,
          memo: "Retainer received into pooled trust",
          postedAt: "2026-04-02T17:00:00.000Z",
        },
        {
          id: "trust-retainer-2",
          transactionId: "trust-retainer",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-client-liability",
          debitCents: 0,
          creditCents: 150000,
          memo: "Client trust liability",
          postedAt: "2026-04-02T17:00:00.000Z",
        },
      ],
      balances: { "contact-ada:matter-001": 150000 },
      trustBalances: { "contact-ada:matter-001": 150000 },
    },
    approvals: [
      {
        id: "approval-001",
        firmId: "firm-west-legal",
        transactionId: "trust-retainer",
        decidedByUserId: "user-admin",
        decision: "approved",
        decidedAt: "2026-04-02T18:00:00.000Z",
      },
    ],
    reconciliations: [
      {
        id: "reconciliation-001",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        statementPeriodStart: "2026-04-01T00:00:00.000Z",
        statementPeriodEnd: "2026-04-30T00:00:00.000Z",
        beginningBalanceCents: 0,
        endingBalanceCents: 149000,
        expectedBalanceCents: 150000,
        actualBalanceCents: 149000,
        status: "exception",
        reviewedByUserId: "user-admin",
        statementRows: [
          {
            id: "statement-row-001",
            postedAt: "2026-04-02T17:00:00.000Z",
            description: "Synthetic retainer deposit",
            amountCents: 149000,
            matchedLedgerEntryIds: [],
            reviewDecision: "unmatched",
          },
        ],
        varianceExplanation: "Synthetic statement row needs review.",
        evidence: {},
        createdAt: "2026-05-01T12:00:00.000Z",
      },
    ],
    diagnostics: {
      pendingApprovalTransactionIds: ["trust-transfer-pending"],
      rejectedApprovalTransactionIds: [],
      unreconciledAccountIds: ["acct-client-liability"],
      exceptionReconciliationIds: ["reconciliation-001"],
      overdrawnBalanceKeys: [],
    },
  };

  return {
    ...base,
    ...overrides,
    ledger: { ...base.ledger, ...overrides.ledger },
    diagnostics: { ...base.diagnostics, ...overrides.diagnostics },
  };
}

function baseExternalUploadLink(): ExternalUploadLinkRecord {
  return {
    id: "external-upload-link-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    requestedByUserId: "user-admin",
    expiresAt: "2026-05-01T12:00:00.000Z",
    maxUploads: 2,
    usedUploads: 0,
    createdAt: "2026-04-29T12:00:00.000Z",
  };
}

function intakeFormLink(overrides: Partial<IntakeFormLinkSummary> = {}): IntakeFormLinkSummary {
  return {
    id: "intake-form-link-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    intakeSessionId: "intake-session-001",
    requestedByUserId: "user-admin",
    expiresAt: "2026-05-01T12:00:00.000Z",
    createdAt: "2026-04-29T12:00:00.000Z",
    status: "active",
    ...overrides,
  };
}

function publicRunnerPayload(
  overrides: Partial<PublicIntakeFormPayload> = {},
): PublicIntakeFormPayload {
  return {
    link: {
      id: "intake-form-link-001",
      status: "active",
      expiresAt: "2099-06-01T00:00:00.000Z",
    },
    template: {
      id: "intake-template-001",
      name: "Residential tenancy intake",
      definitionVersion: 2,
      definition: sampleResidentialTenancyIntakeDefinition,
    },
    actions: [],
    ...overrides,
  };
}

describe("dashboard client behavior", () => {
  it("builds expanded conflict-check payloads for the existing API contract", () => {
    const result = buildConflictCheckPayload({
      prospectiveName: " Morgan Tenant ",
      aliasesText: "Morgan Holdings\nM. Tenant, Morgan Holdings",
      identifiersText: "email: morgan@example.test\nbusiness_number=BN-123",
      prospectiveRole: "opposing_party",
    });

    expect(parseConflictAliases("Alpha\nBeta, Alpha")).toEqual(["Alpha", "Beta"]);
    expect(parseConflictIdentifiers("client_id: C-123")).toEqual({
      identifiers: [{ type: "client_id", value: "C-123" }],
    });
    expect(formatConflictProspectiveRole("opposing_party")).toBe("Opposing party");
    expect(result.payload).toEqual({
      prospectiveName: "Morgan Tenant",
      aliases: ["Morgan Holdings", "M. Tenant"],
      identifiers: [
        { type: "email", value: "morgan@example.test" },
        { type: "business_number", value: "BN-123" },
      ],
      prospectiveRole: "opposing_party",
      includeClosedMatters: true,
    });
    expect(summarizeConflictCheckPayload(result.payload!)).toBe(
      "Opposing party · 2 aliases · 2 identifiers · closed matters included",
    );
    expect(describeConflictCheckStatus(result.payload!, 0)).toBe(
      "No conflicts found for Opposing party · 2 aliases · 2 identifiers · closed matters included.",
    );
    expect(describeConflictCheckStatus(result.payload!, 2)).toBe(
      "2 potential conflicts found for Opposing party · 2 aliases · 2 identifiers · closed matters included.",
    );
  });

  it("rejects malformed conflict identifiers before calling the API", () => {
    expect(
      buildConflictCheckPayload({
        prospectiveName: "Morgan Tenant",
        aliasesText: "",
        identifiersText: "email only",
        prospectiveRole: "client",
      }),
    ).toEqual({ error: "Use identifier lines as type: value." });
  });

  it("describes conflict result matches with matter context", () => {
    expect(
      describeConflictResult({
        contactId: "contact-001",
        matterId: "matter-001",
        severity: "blocker",
        reason: "Shared email identifier",
        matchedValue: "morgan@example.test",
      }),
    ).toBe("Matter matter-001 · matched morgan@example.test");
  });

  it("loads matter-scoped communications inbox payloads", async () => {
    const inbox: CommunicationsInboxMatterResponse = {
      status: "available",
      matterId: "matter-001",
      channelState: {
        inboundEmailStatus: "configured",
        outboundEmailStatus: "disabled",
        inboundEmailAddressCount: 1,
        enabledInboundEmailAddressCount: 1,
      },
      inboundEmail: [
        {
          id: "inbound-message-001",
          matterId: "matter-001",
          status: "triage_pending",
          labels: ["client"],
          receivedAt: "2026-05-05T12:00:00.000Z",
          attachmentCount: 1,
          triage: { status: "needs_review" },
        },
      ],
      outboundDeliveryHistory: [],
      conversations: [],
      contactCues: [],
    };

    const dashboard = await loadCommunicationsInboxDashboardData({
      matters: [matter({ id: "matter-001" })],
      getInboxForMatter: async (matterId) => ({ ...inbox, matterId }),
    });

    expect(buildCommunicationsInboxPath("matter 001")).toBe(
      "/api/communications/inbox?matterId=matter%20001",
    );
    expect(dashboard.inboxByMatterId["matter-001"]).toMatchObject({
      matterId: "matter-001",
      inboundEmail: [expect.objectContaining({ id: "inbound-message-001" })],
    });
  });

  it("summarizes unified provider status posture for the queues surface", () => {
    const status = emptyProvidersStatusResponse();
    status.providerSettings = [
      {
        kind: "smtp",
        status: "configured",
        providers: [
          {
            key: "mailpit",
            enabled: true,
            updatedAt: "2026-05-07T10:00:00.000Z",
          },
        ],
      },
      {
        kind: "ocr",
        status: "disabled",
        reason: "not_configured",
        providers: [],
      },
    ];
    status.email = {
      status: "configured",
      provider: "mailpit",
      providers: [{ key: "mailpit", enabled: true }],
      queue: { queueName: "email", status: "configured" },
    };
    status.bullmq.producerQueues = [{ queueName: "email", status: "configured" }];
    status.bullmq.workerQueues = [
      { queueName: "email", status: "configured" },
      { queueName: "ocr", status: "not_configured", reason: "queue_not_configured" },
      { queueName: "ai_triage", status: "reserved", reason: "deferred_worker" },
    ];
    status.bullmq.reservedWorkerQueues = [
      { queueName: "ai_triage", status: "reserved", reason: "deferred_worker" },
    ];
    status.documentProcessing = {
      ...status.documentProcessing,
      status: "disabled",
      reason: "not_configured",
      workerQueues: [
        { queueName: "ocr", status: "not_configured", reason: "queue_not_configured" },
      ],
      reservedQueues: [{ queueName: "ai_triage", status: "reserved", reason: "deferred_worker" }],
    };
    status.jobs.summary = {
      total: 2,
      queued: 1,
      active: 0,
      failed: 1,
      terminal: 0,
      byQueue: [],
    };

    expect(buildProvidersStatusPath()).toBe("/api/providers/status");
    expect(summarizeProvidersStatus(status)).toBe(
      "1 providers enabled. 1 producer queues and 1 worker queues configured. 1 active or queued jobs. 1 failed jobs.",
    );
    expect(providerPostureRows(status)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "email",
          status: "configured",
          detail: "Provider mailpit · queue configured",
          tone: "ready",
        }),
        expect.objectContaining({
          key: "document-processing",
          status: "disabled",
          detail: "not configured OCR queue · 1 reserved queues",
          tone: "risk",
        }),
      ]),
    );
  });

  it("summarizes connector outbox posture with redacted payload context only", () => {
    const response: ConnectorOperationsResponse = {
      status: "available",
      connectors: [
        {
          id: "connector-001",
          type: "generic",
          key: "synthetic.review",
          displayName: "Synthetic Review Connector",
          status: "enabled",
        },
      ],
      outbox: [
        {
          id: "connector-outbox-001",
          connectorId: "connector-001",
          eventType: "matter.summary.ready",
          resourceType: "matter",
          resourceId: "matter-001",
          idempotencyKeyPresent: true,
          status: "dead_letter",
          payloadSummary: {
            fieldCount: 3,
            matterId: "matter-001",
            secretToken: "raw-secret-value-must-not-render",
          },
          attemptCount: 4,
          maxAttempts: 4,
          nextAttemptAt: "2026-05-02T10:10:00.000Z",
          leasePresent: false,
          deadLetteredAt: "2026-05-02T10:11:00.000Z",
          lastErrorSummary:
            "Delivery failed. Error details are redacted; review server logs for diagnostics.",
        },
      ],
    };

    expect(emptyConnectorOperationsResponse("access_denied")).toEqual({
      connectors: [],
      outbox: [],
      status: "access_denied",
    });
    expect(summarizeConnectorOperations(response)).toBe(
      "1 connector loaded. 1 outbox item: 0 pending, 0 leased, 1 dead letter.",
    );
    expect(connectorDisplayName(response.connectors[0])).toBe("Synthetic Review Connector");
    expect(connectorOutboxStatusTone(response.outbox[0]!)).toBe("risk");
    expect(summarizeConnectorPayload(response.outbox[0]!.payloadSummary)).toBe(
      "2 payload-summary keys: fieldCount, matterId",
    );
    expect(summarizeConnectorPayload(response.outbox[0]!.payloadSummary)).not.toContain(
      "secretToken",
    );
    expect(summarizeConnectorPayload(response.outbox[0]!.payloadSummary)).not.toContain(
      "raw-secret-value",
    );
  });

  it("describes communications delivery state without provider details", () => {
    expect(
      describeCommunicationsDeliveryState({
        id: "email-outbox-001",
        matterId: "matter-001",
        templateKey: "client.update",
        status: "failed",
        recipientCount: 1,
        attemptCount: 1,
        queuedAt: "2026-05-05T12:00:00.000Z",
        failureSummary: "Mailbox unavailable",
        events: [],
      }),
    ).toEqual({ label: "failed", tone: "risk" });
  });

  it("filters and summarizes contact dossiers without requiring contact edits", () => {
    const dossiers = [
      {
        contact: {
          id: "contact-ada",
          firmId: "firm-west-legal",
          kind: "person" as const,
          displayName: "Ada Morgan",
          aliases: ["Ada M. Nguyen"],
          identifiers: [{ type: "email" as const, value: "ada@example.test" }],
        },
        matters: [
          {
            matterId: "matter-001",
            matterNumber: "2026-0001",
            matterTitle: "Morgan tenancy dispute",
            matterStatus: "open" as const,
            practiceArea: "Residential tenancy",
            role: "client" as const,
            adverse: false,
            confidential: true,
            portalActive: true,
            portalPermissions: ["view_documents" as const],
          },
        ],
        portal: { activeGrantCount: 1, permissionLabels: ["view_documents" as const] },
        conflictCues: [
          {
            severity: "review" as const,
            reason: "Linked to a confidential matter party record",
            matterId: "matter-001",
          },
        ],
        qualityReview: {
          summary: {
            duplicateCandidateCount: 0,
            sensitivePartyCueCount: 2,
            revalidationPromptCount: 0,
          },
          signals: [
            {
              kind: "protected_party_cue" as const,
              severity: "review" as const,
              reason: "Confidential party link requires scoped handling",
              matterId: "matter-001",
            },
            {
              kind: "protected_party_cue" as const,
              severity: "review" as const,
              reason: "Active portal access protects contact-matter communications",
              matterId: "matter-001",
            },
          ],
        },
        conflictHistory: [],
      },
      {
        contact: {
          id: "contact-river",
          firmId: "firm-west-legal",
          kind: "organization" as const,
          displayName: "River City Rentals Inc.",
          aliases: [],
          identifiers: [],
        },
        matters: [
          {
            matterId: "matter-001",
            matterNumber: "2026-0001",
            matterTitle: "Morgan tenancy dispute",
            matterStatus: "open" as const,
            practiceArea: "Residential tenancy",
            role: "opposing_party" as const,
            adverse: true,
            confidential: false,
            portalActive: false,
            portalPermissions: [],
          },
        ],
        portal: { activeGrantCount: 0, permissionLabels: [] },
        conflictCues: [
          {
            severity: "blocker" as const,
            reason: "Linked as an adverse party on an accessible matter",
            matterId: "matter-001",
          },
        ],
        qualityReview: {
          summary: {
            duplicateCandidateCount: 1,
            sensitivePartyCueCount: 1,
            revalidationPromptCount: 1,
          },
          signals: [
            {
              kind: "duplicate_candidate" as const,
              severity: "review" as const,
              reason: "Possible duplicate contact identifier",
              relatedContactIds: ["contact-river-duplicate"],
              matchedOn: "identifier" as const,
              matchedValue: "email:legal@rivercity.example",
            },
            {
              kind: "protected_party_cue" as const,
              severity: "blocker" as const,
              reason: "Adverse party link requires sensitive-party caution",
              matterId: "matter-001",
            },
            {
              kind: "conflict_revalidation" as const,
              severity: "review" as const,
              reason:
                "Approved contact name change should prompt manual conflict-check revalidation",
              matterId: "matter-001",
              sourceRecordId: "proposal-river-name",
              changedAt: "2026-05-01T11:00:00.000Z",
            },
          ],
        },
        conflictHistory: [
          {
            id: "conflict-check-river",
            createdAt: "2026-05-10T12:00:00.000Z",
            disposition: "pending_review" as const,
            matchedContactId: "contact-river",
            visibleMatchedMatterIds: ["matter-001"],
            matchCount: 1,
            maxSeverity: "blocker" as const,
          },
        ],
      },
    ];

    expect(filterContactDossiers(dossiers, "nguyen").map((dossier) => dossier.contact.id)).toEqual([
      "contact-ada",
    ]);
    expect(
      filterContactDossiers(dossiers, "proposal-river-name").map((dossier) => dossier.contact.id),
    ).toEqual(["contact-river"]);
    expect(summarizeContactDossier(dossiers[0]!)).toBe("confidential / portal active");
    expect(summarizeContactDossier(dossiers[1]!)).toBe(
      "duplicate review / conflict recheck / adverse",
    );
    expect(contactDossierRiskClass(dossiers[1]!)).toBe("risk");
    expect(filterContactDossiers(dossiers, "conflict-check-river")).toEqual([dossiers[1]]);
    expect(buildContactDossierConflictCheckPrefill(dossiers[1]!, "matter-001")).toEqual({
      prospectiveName: "River City Rentals Inc.",
      aliasesText: "",
      identifiersText: "",
      prospectiveRole: "opposing_party",
      matterId: "matter-001",
    });
    expect(buildContactDossierConflictCheckPrefill(dossiers[0]!, "matter-001")).toMatchObject({
      prospectiveName: "Ada Morgan",
      aliasesText: "Ada M. Nguyen",
      identifiersText: "email: ada@example.test",
      prospectiveRole: "client",
    });
  });

  it("summarizes redacted contact review queue items without merge decisions", () => {
    const item = {
      contact: {
        id: "contact-river",
        kind: "organization" as const,
        displayName: "River City Rentals Inc.",
        aliasCount: 0,
        identifierCount: 1,
      },
      matters: [
        {
          matterId: "matter-001",
          matterNumber: "2026-0001",
          matterTitle: "Morgan tenancy dispute",
          matterStatus: "open" as const,
          practiceArea: "Residential tenancy",
          role: "opposing_party" as const,
          adverse: true,
          confidential: false,
          portalActive: false,
          portalPermissions: [],
        },
      ],
      summary: {
        duplicateCandidateCount: 1,
        sensitivePartyCueCount: 1,
        revalidationPromptCount: 1,
      },
      signals: [
        {
          kind: "duplicate_candidate" as const,
          severity: "review" as const,
          reason: "Possible duplicate contact identifier",
          relatedContactIds: ["contact-river-duplicate"],
          matchedOn: "identifier" as const,
          matchedValueRedacted: true,
        },
        {
          kind: "protected_party_cue" as const,
          severity: "blocker" as const,
          reason: "Adverse party link requires sensitive-party caution",
          matterId: "matter-001",
          matchedValueRedacted: false,
        },
      ],
      auditSafe: true as const,
    };

    expect(summarizeContactReviewQueueItem(item)).toBe(
      "duplicate review / protected-party cue / conflict recheck",
    );
    expect(contactReviewQueueRiskClass(item)).toBe("risk");
    expect(formatContactReviewSignalKind("conflict_revalidation")).toBe("conflict revalidation");
    expect(JSON.stringify(item)).not.toContain("legal@rivercity.example");
  });

  it("filters matters by API-backed matter fields", () => {
    const matters = [
      matter({ id: "matter-001", title: "Morgan tenancy dispute" }),
      matter({ id: "matter-002", number: "2026-0002", title: "North Star records" }),
    ];

    expect(filterMatters(matters, "north").map((result) => result.id)).toEqual(["matter-002"]);
    expect(filterMatters(matters, "2026-0001").map((result) => result.id)).toEqual(["matter-001"]);
  });

  it("builds sidebar navigation from catalog order and labels", () => {
    const navigationSections = buildSidebarNavigationSections({
      billingCanView: true,
      shareLinksEnabled: true,
      externalUploadsEnabled: true,
      capabilitySections: [
        capability("matters"),
        capability("contacts"),
        capability("funds"),
        capability("documents"),
        capability("drafting"),
        capability("calendar"),
        capability("billing"),
        capability("signatures"),
        capability("intake"),
        capability("audit"),
      ],
    });

    expect(navigationSections).toEqual([
      { key: "matters", label: "Matters", enabled: true },
      { key: "contacts", label: "Contacts", enabled: true },
      { key: "funds", label: "Funds", enabled: true },
      { key: "billing", label: "Billing", enabled: true },
      { key: "documents", label: "Documents", enabled: true },
      { key: "shares", label: "Shares", enabled: true },
      { key: "externalUploads", label: "Uploads", enabled: true },
      { key: "drafting", label: "Drafting", enabled: true },
      { key: "calendar", label: "Calendar", enabled: true },
      { key: "signatures", label: "Signatures", enabled: true },
      { key: "intake", label: "Intake", enabled: true },
      { key: "audit", label: "Audit", enabled: true },
      { key: "queues", label: "Queues", enabled: true },
    ]);
  });

  it("keeps billing visibility compatible with billing dashboard access", () => {
    const navigationSections = buildSidebarNavigationSections({
      billingCanView: false,
      shareLinksEnabled: false,
      externalUploadsEnabled: false,
      capabilitySections: [
        capability("matters"),
        capability("contacts"),
        capability("funds"),
        capability("documents"),
        capability("drafting"),
        capability("calendar", { enabled: false }),
        capability("signatures"),
        capability("intake"),
        capability("audit"),
      ],
    });

    expect(navigationSections.find((section) => section.key === "billing")).toEqual({
      key: "billing",
      label: "Billing",
      enabled: false,
    });
    expect(navigationSections.find((section) => section.key === "shares")).toEqual({
      key: "shares",
      label: "Shares",
      enabled: false,
    });
    expect(navigationSections.find((section) => section.key === "externalUploads")).toEqual({
      key: "externalUploads",
      label: "Uploads",
      enabled: false,
    });
    expect(navigationSections.find((section) => section.key === "calendar")).toEqual({
      key: "calendar",
      label: "Calendar",
      enabled: false,
    });
    expect(navigationSections.find((section) => section.key === "queues")).toEqual({
      key: "queues",
      label: "Queues",
      enabled: true,
    });
  });

  it("builds draft invoice payloads from approved unbilled dashboard rows", () => {
    const activeMatter = matter({
      parties: [
        {
          id: "party-client",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          contactId: "contact-ada",
          role: "client",
          adverse: false,
          confidential: true,
          contact: {
            id: "contact-ada",
            firmId: "firm-west-legal",
            kind: "person",
            displayName: "Ada Morgan",
            aliases: [],
            identifiers: [],
          },
        },
        {
          id: "party-opposing",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          contactId: "contact-river",
          role: "opposing_party",
          adverse: true,
          confidential: false,
          contact: {
            id: "contact-river",
            firmId: "firm-west-legal",
            kind: "organization",
            displayName: "River City Rentals Inc.",
            aliases: [],
            identifiers: [],
          },
        },
      ],
    });

    const result = buildDraftInvoicePayload({
      matter: activeMatter,
      unbilledTime: [
        {
          id: "time-001",
          matterId: "matter-001",
          userId: "user-licensee",
          minutes: 60,
          rateCents: 18000,
          amountCents: 18000,
          narrative: "Prepare tenancy hearing materials.",
          status: "approved",
        },
      ],
      unbilledExpenses: [
        {
          id: "expense-001",
          matterId: "matter-001",
          amountCents: 2500,
          category: "Filing",
          description: "Courier evidence package.",
          status: "approved",
        },
      ],
      dueAtDate: "2026-05-31",
      taxName: " GST ",
      taxRatePercent: "5",
    });

    expect(result.payload).toEqual({
      matterId: "matter-001",
      clientContactId: "contact-ada",
      dueAt: new Date("2026-05-31").toISOString(),
      timeEntryIds: ["time-001"],
      expenseEntryIds: ["expense-001"],
      taxName: "GST",
      taxRateBps: 500,
    });
    expect(
      buildDraftInvoicePayload({
        matter: activeMatter,
        unbilledTime: [
          {
            id: "time-001",
            matterId: "matter-001",
            userId: "user-licensee",
            minutes: 60,
            rateCents: 18000,
            amountCents: 18000,
            narrative: "Prepare tenancy hearing materials.",
            status: "approved",
          },
        ],
        unbilledExpenses: [],
        dueAtDate: "",
        taxName: "",
        taxRatePercent: "",
      }).payload,
    ).toEqual({
      matterId: "matter-001",
      clientContactId: "contact-ada",
      timeEntryIds: ["time-001"],
      expenseEntryIds: [],
      taxRateBps: 0,
    });
    expect(
      buildDraftInvoicePayload({
        matter: activeMatter,
        unbilledTime: [],
        unbilledExpenses: [],
        dueAtDate: "",
        taxName: "",
        taxRatePercent: "",
      }),
    ).toEqual({ error: "No approved unbilled time or reimbursable expenses are available." });
    expect(
      buildDraftInvoicePayload({
        matter: activeMatter,
        unbilledTime: [
          {
            id: "time-001",
            matterId: "matter-001",
            userId: "user-licensee",
            minutes: 60,
            rateCents: 18000,
            amountCents: 18000,
            narrative: "Prepare tenancy hearing materials.",
            status: "approved",
          },
        ],
        unbilledExpenses: [],
        dueAtDate: "",
        taxName: "",
        taxRatePercent: "-1",
      }),
    ).toEqual({ error: "Tax rate must be zero or greater." });
  });

  it("updates local billing dashboard state after creating a draft invoice", () => {
    const dashboard: BillingDashboardResponse = {
      canView: true,
      summary: {
        unbilledTimeCents: 18000,
        unbilledExpenseCents: 2500,
        draftInvoiceCents: 0,
        issuedBalanceDueCents: 1000,
      },
      matters: [
        {
          matterId: "matter-001",
          unbilledTime: [
            {
              id: "time-001",
              matterId: "matter-001",
              userId: "user-licensee",
              minutes: 60,
              rateCents: 18000,
              amountCents: 18000,
              narrative: "Prepare tenancy hearing materials.",
              status: "approved",
            },
          ],
          unbilledExpenses: [
            {
              id: "expense-001",
              matterId: "matter-001",
              amountCents: 2500,
              category: "Filing",
              description: "Courier evidence package.",
              status: "approved",
            },
          ],
          invoices: [],
          payments: [],
        },
      ],
    };

    const updated = updateBillingDashboardWithCreatedInvoice(dashboard, {
      invoice: {
        id: "invoice-001",
        matterId: "matter-001",
        invoiceNumber: "INV-001",
        status: "draft",
        totalCents: 20500,
        balanceDueCents: 20500,
      },
      timeEntryIds: ["time-001"],
      expenseEntryIds: ["expense-001"],
    });

    expect(updated.summary).toEqual({
      unbilledTimeCents: 0,
      unbilledExpenseCents: 0,
      draftInvoiceCents: 20500,
      issuedBalanceDueCents: 1000,
    });
    expect(updated.matters[0]!.unbilledTime).toEqual([]);
    expect(updated.matters[0]!.unbilledExpenses).toEqual([]);
    expect(updated.matters[0]!.invoices[0]).toMatchObject({
      id: "invoice-001",
      number: "INV-001",
      status: "draft",
    });
    expect(
      describeDraftInvoiceCreated(
        {
          id: "invoice-001",
          matterId: "matter-001",
          invoiceNumber: "INV-001",
          status: "draft",
          totalCents: 20500,
          balanceDueCents: 20500,
        },
        2,
      ),
    ).toBe("Created draft INV-001 from 2 source records.");
  });

  it("summarizes read-only trust controls for the Funds workbench", async () => {
    const controls = trustControls({
      approvals: [
        {
          id: "approval-rejected",
          firmId: "firm-west-legal",
          transactionId: "trust-transfer-rejected",
          decidedByUserId: "user-admin",
          decision: "rejected",
          decidedAt: "2026-04-03T18:00:00.000Z",
        },
      ],
      diagnostics: {
        pendingApprovalTransactionIds: ["trust-transfer-pending"],
        rejectedApprovalTransactionIds: ["trust-transfer-rejected"],
        overdrawnBalanceKeys: ["contact-ada:matter-001"],
      },
    });
    const loaded = await loadTrustControlsDashboardData({
      matter: matter({ id: "matter-001" }),
      getControls: async () => controls,
    });

    expect(buildTrustControlsPath("matter 001")).toBe("/api/ledger/controls?matterId=matter%20001");
    expect(buildJurisdictionalTrustReportPath("BC")).toBe(
      "/api/ledger/reports/jurisdictional-trust?jurisdiction=BC",
    );
    expect(emptyJurisdictionalTrustReport()).toEqual({
      summaries: [],
      compliancePosture: "operational_controls_only_not_jurisdiction_certified",
    });
    expect(loaded).toBe(controls);
    expect(matterTrustBalanceCents(controls, "matter-001", 0)).toBe(150000);
    expect(recentTrustPostings(controls, "matter-001")).toEqual([
      {
        transactionId: "trust-retainer",
        postedAt: "2026-04-02T17:00:00.000Z",
        memo: "Retainer received into pooled trust",
        entryCount: 2,
        matterDeltaCents: 150000,
      },
    ]);
    expect(summarizeTrustControls(controls)).toEqual({
      pendingApprovalCount: 1,
      approvedApprovalCount: 0,
      rejectedApprovalCount: 1,
      totalApprovalCount: 1,
      exceptionReconciliationCount: 1,
      importedStatementRowCount: 1,
      matchedStatementRowCount: 0,
      unmatchedStatementRowCount: 1,
      totalVarianceCents: -1000,
      unreconciledAccountCount: 1,
      overdrawnBalanceCount: 1,
    });
    expect(trustControlsForMatter({}, "matter-001", controls)).toEqual({
      "matter-001": controls,
    });
    expect(
      activeJurisdictionTrustReportSummary({
        matter: matter({ id: "matter-001", jurisdiction: "BC" }),
        report: {
          compliancePosture: "operational_controls_only_not_jurisdiction_certified",
          summaries: [
            {
              jurisdiction: "BC",
              matterCount: 2,
              trustBalanceCents: 149000,
              pendingApprovalCount: 1,
              rejectedApprovalCount: 0,
              exceptionReconciliationCount: 1,
              importedStatementRowCount: 1,
              matchedStatementRowCount: 0,
              unmatchedStatementRowCount: 1,
              totalVarianceCents: -1000,
              unreconciledAccountCount: 1,
              overdrawnBalanceCount: 0,
              compliancePosture: "operational_controls_only_not_jurisdiction_certified",
            },
          ],
        },
      }),
    ).toMatchObject({
      jurisdiction: "BC",
      trustBalanceCents: 149000,
      compliancePosture: "operational_controls_only_not_jurisdiction_certified",
    });
  });

  it("describes disabled dashboard navigation and summarizes queues for live regions", () => {
    expect(
      describeDisabledNavigationReason({ key: "billing", label: "Billing", enabled: false }),
    ).toBe("Billing is unavailable for your current role.");
    expect(
      describeDisabledNavigationReason({
        key: "externalUploads",
        label: "Uploads",
        enabled: false,
      }),
    ).toBe("External uploads are unavailable until the storage provider is configured.");
    expect(
      summarizeQueues({
        sections: [
          {
            key: "review",
            label: "Review",
            items: [
              {
                id: "queue-001",
                matterId: "matter-001",
                title: "Review draft",
                status: "ready",
                priority: "high",
              },
              {
                id: "queue-002",
                title: "Check intake",
                status: "waiting",
                priority: "medium",
              },
            ],
          },
        ],
      }),
    ).toBe("2 queue items need attention. 1 high priority item.");
    expect(summarizeQueues({ sections: [] })).toBe("No queue items need attention.");
  });

  it("applies saved queue focuses to authorized queue data without fetching archive rows", () => {
    const queues: QueuesResponse = {
      sections: [
        {
          key: "review",
          label: "Review",
          items: [
            {
              id: "queue-001",
              matterId: "matter-001",
              title: "Review draft",
              status: "ready",
              priority: "high",
            },
            {
              id: "queue-002",
              matterId: "matter-002",
              title: "Review intake",
              status: "waiting",
              priority: "medium",
            },
          ],
        },
        {
          key: "worker",
          label: "Worker review",
          items: [
            {
              id: "queue-003",
              title: "Check worker result",
              status: "needs_review",
              priority: "medium",
            },
          ],
        },
      ],
    };
    const savedFocus: SavedOperationalViewDefinition = {
      id: "saved-review-focus",
      firmId: "firm-west-legal",
      ownerUserId: "user-001",
      surface: "queues",
      name: "Review queue",
      filters: {
        source: "dashboard-queues",
        queueSections: ["review"],
      },
      columns: ["title", "status", "priority"],
      sort: { priority: "desc" },
      rowLimit: 1,
      dashboardBehavior: { pinToFocus: true },
      permissionScope: ["matter:read"],
      status: "active",
      createdAt: "2026-05-10T12:00:00.000Z",
      updatedAt: "2026-05-10T12:00:00.000Z",
    };

    expect(applySavedQueueFocus(queues, savedFocus)).toEqual({
      sections: [
        {
          key: "review",
          label: "Review",
          items: [queues.sections[0]!.items[0]],
        },
      ],
    });
    expect(describeSavedQueueFocus(savedFocus, queues)).toBe(
      "Review queue applies 1 item across 1 section.",
    );
  });

  it("loads document-processing workbenches and preserves sanitized document fallbacks", async () => {
    const activeDocument = documentRecord();
    const activeMatter = matter({ id: "matter-001", documents: [activeDocument] });
    const fallback = emptyDocumentProcessingWorkbench("matter-001");
    const loaded = await loadDocumentProcessingDashboardData({
      matters: [activeMatter],
      getWorkbench: async () => fallback,
    });
    const rows = documentProcessingRowsForMatter(
      activeMatter.documents,
      loaded.workbenchesByMatterId["matter-001"]!,
    );

    expect(buildDocumentProcessingWorkbenchPath("matter 001")).toBe(
      "/api/document-processing/workbench?matterId=matter%20001",
    );
    expect(buildDocumentProcessingQueuePath("doc/001")).toBe(
      "/api/document-processing/documents/doc%2F001/queue",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.document).toEqual(
      expect.objectContaining({
        id: "doc-001",
        title: "Residential tenancy evidence",
        reviewStatus: "accepted",
      }),
    );
    expect(rows[0]!.document).not.toHaveProperty("storageKey");
    expect(rows[0]!.document).not.toHaveProperty("checksumSha256");
    expect(summarizeDocumentProcessingWorkbench(fallback)).toContain("Document list is preserved");
  });

  it("describes document-processing queue states without raw extraction fields", () => {
    const workbench = documentProcessingWorkbench();
    const item = workbench.documents[0]!;

    expect(describeDocumentQueueAction(item, workbench)).toEqual({
      canQueue: true,
      label: "Queue OCR",
      tone: "ready",
    });
    expect(describeLatestDocumentJob(item.latestJob)).toEqual({
      label: "completed",
      tone: "ready",
    });
    expect(
      describeLatestExtraction({
        status: "completed",
        language: "eng",
        pageCount: 3,
        confidence: 0.88,
        extractedText: "raw text must not render",
        storageKey: "private/storage/key.txt",
      } as unknown as Parameters<typeof describeLatestExtraction>[0]),
    ).toBe("completed · language eng · 3 pages · 88% confidence");
    expect(summarizeDocumentReviewSuggestions(workbench.documents)).toBe(
      "2 reviewer suggestion cues. 0 duplicate or supersession. 0 missing metadata.",
    );
    expect(
      describeDocumentReviewSuggestion(item.reviewSuggestions!.groups.classification[0]!),
    ).toBe(
      "Current classification is general. · classification financial · 88% confidence · metadata suggestedClassification",
    );
    expect(emptyDocumentReviewSuggestions()).toMatchObject({
      reviewerOnly: true,
      mutating: false,
      summaryCounts: { total: 0 },
    });
    expect(summarizeDocumentProcessingWorkbench(workbench)).toBe(
      "1 providers configured. 1/1 actionable worker queues configured. 3 reserved queues. 0 active or queued jobs. 0 failed jobs.",
    );

    expect(
      summarizeDocumentProcessingWorkbench(
        documentProcessingWorkbench({
          workerQueues: [
            { queueName: "ocr", status: "configured" },
            {
              queueName: "transcription",
              status: "reserved",
              reason: "deferred_worker",
              task: "transcription",
              actionable: false,
            },
          ],
          reservedQueues: [],
        }),
      ),
    ).toBe(
      "1 providers configured. 1/1 actionable worker queues configured. 1 reserved queue. 0 active or queued jobs. 0 failed jobs.",
    );

    const disabled = documentProcessingWorkbench({
      status: "disabled",
      reason: "provider_disabled",
    });
    expect(describeDocumentQueueAction(item, disabled)).toEqual({
      canQueue: false,
      label: "Queue OCR",
      disabledReason: "provider disabled",
      tone: "risk",
    });
    expect(
      describeDocumentQueueAction(
        item,
        documentProcessingWorkbench({
          workerQueues: [
            { queueName: "ocr", status: "not_configured", reason: "queue_not_configured" },
          ],
        }),
      ),
    ).toEqual({
      canQueue: false,
      label: "Queue OCR",
      disabledReason: "queue not configured",
      tone: "risk",
    });

    expect(
      describeDocumentQueueAction(
        {
          ...item,
          queueEligibility: { eligible: false, reason: "review_required" },
          group: "needs_review",
        },
        workbench,
      ),
    ).toEqual({
      canQueue: false,
      label: "Queue OCR",
      disabledReason: "review required",
      tone: "risk",
    });
    expect(
      describeDocumentQueueAction(
        {
          ...item,
          group: "queued_or_active",
          latestJob: { id: "job-queued", queueName: "ocr", status: "queued" },
        },
        workbench,
      ),
    ).toEqual({
      canQueue: false,
      label: "queued",
      disabledReason: "job already queued",
      tone: "neutral",
    });
    expect(
      describeDocumentQueueAction(
        {
          ...item,
          group: "blocked",
          latestJob: {
            id: "job-failed",
            queueName: "ocr",
            status: "failed",
            failed: true,
            errorSummary: "Provider returned a retryable error",
          },
        },
        workbench,
      ),
    ).toEqual({
      canQueue: true,
      label: "Retry OCR",
      tone: "risk",
    });
    expect(
      replaceDocumentProcessingWorkbench(
        {},
        documentProcessingWorkbench({ matterId: "matter-002" }),
      ),
    ).toHaveProperty("matter-002");
  });

  it("derives matter activity and file command-center summaries without raw file fields", () => {
    const activeMatter = matter({
      documents: [
        documentRecord(),
        documentRecord({
          id: "doc-002",
          title: "Superseded photo evidence",
          scanStatus: "failed",
          reviewStatus: "pending_review",
          supersedesDocumentId: "doc-001",
        }),
      ],
      activity: [
        activityEntry({
          id: "activity-document",
          kind: "document",
          title: "Document verified",
          metadata: { scanStatus: "passed", storageKey: "must-not-drive-status" },
        }),
        activityEntry({
          id: "activity-upload",
          kind: "upload",
          title: "External upload needs metadata",
          occurredAt: "2026-05-02T12:00:00.000Z",
          metadata: { reviewStatus: "needs_metadata" },
        }),
        activityEntry({
          id: "activity-email",
          kind: "email",
          title: "Outbound email sent",
          occurredAt: "2026-05-03T12:00:00.000Z",
          metadata: { status: "sent" },
        }),
      ],
    });
    const rows = documentProcessingRowsForMatter(
      activeMatter.documents,
      documentProcessingWorkbench({
        documents: [
          documentProcessingWorkbench().documents[0]!,
          {
            document: {
              id: "doc-002",
              matterId: "matter-001",
              title: "Superseded photo evidence",
              version: 1,
              classification: "general",
              legalHold: false,
              uploadStatus: "verified",
              checksumStatus: "verified",
              scanStatus: "failed",
              reviewStatus: "pending_review",
            },
            group: "blocked",
            queueEligibility: { eligible: false, reason: "scan_failed" },
          },
        ],
      }),
    );
    const summary = buildMatterFileCommandCenter({
      matter: activeMatter,
      documentRows: rows,
      shares: [shareLink(), shareLink({ id: "share-revoked", revokedAt: "2026-05-04" })],
      externalUploadDocuments: [externalUploadDocument()],
      communicationsInbox: {
        matterId: "matter-001",
        status: "available",
        channelState: {
          inboundEmailStatus: "configured",
          outboundEmailStatus: "configured",
          inboundEmailAddressCount: 1,
          enabledInboundEmailAddressCount: 1,
        },
        inboundEmail: [
          { id: "inbound-001" } as CommunicationsInboxMatterResponse["inboundEmail"][number],
        ],
        outboundDeliveryHistory: [],
        conversations: [
          { id: "conversation-001" } as CommunicationsInboxMatterResponse["conversations"][number],
        ],
        contactCues: [],
      },
    });

    expect(matterActivityStatus(activeMatter.activity[1]!)).toBe("attention");
    expect(formatMatterActivityKind("upload")).toBe("Upload");
    expect(summarizeMatterActivity(activeMatter.activity)).toEqual({
      total: 3,
      attention: 1,
      complete: 2,
      byKind: [
        { kind: "document", count: 1 },
        { kind: "email", count: 1 },
        { kind: "upload", count: 1 },
      ],
    });
    expect(
      filterMatterActivity({
        entries: activeMatter.activity,
        kind: "upload",
        status: "attention",
      }).map((entry) => entry.id),
    ).toEqual(["activity-upload"]);
    expect(summary.summary).toEqual(
      expect.objectContaining({
        documents: 2,
        readyForOcr: 1,
        blocked: 1,
        activeShares: 1,
        externalUploads: 1,
        externalReviewAttention: 1,
        supersessionCues: 1,
        communicationRecords: 2,
      }),
    );
    expect(JSON.stringify(summary)).not.toContain("private/storage/key");
  });

  it("describes worker run filters and redacted run context", () => {
    const dashboard: WorkerRunsDashboardResponse = {
      all: {
        ...emptyWorkerRunsResponse("available"),
        summary: { total: 2, queued: 0, active: 1, failed: 1, terminal: 1, byQueue: [] },
        jobs: [
          {
            id: "job-email-sent",
            queueName: "email",
            jobName: "send",
            status: "completed",
            terminal: true,
            attemptsMade: 1,
            maxAttempts: 3,
            targetResourceType: "email_outbox",
            targetResourceId: "email-001",
            finishedAt: "2026-05-02T09:01:00.000Z",
            metadata: {
              emailId: "email-001",
              templateKey: "signature.requested",
              body: "raw email body must not render",
            },
          },
          {
            id: "job-ocr-retry",
            queueName: "ocr",
            jobName: "extract_document_text",
            status: "failed",
            failed: true,
            retryable: true,
            attemptsMade: 2,
            maxAttempts: 4,
            nextAttemptAt: "2026-05-02T10:10:00.000Z",
            targetResourceType: "document",
            targetResourceId: "doc-001",
            errorSummary:
              "Job failed. Error details are redacted; review server logs for privileged diagnostics.",
            metadata: {
              matterId: "matter-001",
              documentId: "doc-001",
              task: "ocr",
              storageKey: "private/storage/key.pdf",
              rawBody: "raw document text must not render",
            },
          },
        ],
      },
      email: {
        ...emptyWorkerRunsResponse("available"),
        summary: { total: 1, queued: 0, active: 0, failed: 0, terminal: 1, byQueue: [] },
        jobs: [
          {
            id: "job-email-sent",
            queueName: "email",
            status: "completed",
            terminal: true,
            attemptsMade: 1,
            maxAttempts: 3,
          },
        ],
      },
      ocr: {
        ...emptyWorkerRunsResponse("available"),
        summary: { total: 1, queued: 0, active: 0, failed: 1, terminal: 0, byQueue: [] },
        jobs: [
          {
            id: "job-ocr-retry",
            queueName: "ocr",
            status: "failed",
            failed: true,
            retryable: true,
            attemptsMade: 2,
            maxAttempts: 4,
          },
        ],
      },
    };

    expect(buildWorkerRunsPath()).toBe("/api/jobs");
    expect(buildWorkerRunsPath("email")).toBe("/api/jobs?queueName=email");
    expect(workerRunsForFilter(dashboard, "email").jobs).toHaveLength(1);
    expect(workerRunsForFilter(dashboard, "email").jobs[0]!.queueName).toBe("email");
    expect(workerRunsForFilter(dashboard, "ocr").jobs[0]!.queueName).toBe("ocr");
    expect(summarizeWorkerRuns(dashboard.all)).toBe(
      "2 worker runs. 1 active or queued. 1 failed. 1 terminal.",
    );
    expect(describeWorkerRunStatus(dashboard.all.jobs[0]!)).toEqual({
      label: "completed",
      tone: "ready",
    });
    expect(describeWorkerRunStatus(dashboard.all.jobs[1]!)).toEqual({
      label: "retry pending",
      tone: "risk",
    });
    expect(formatWorkerRunAttempts(dashboard.all.jobs[1]!)).toBe("2/4 attempts");
    expect(formatWorkerRunTiming(dashboard.all.jobs[1]!)).toContain("next");
    expect(workerRunSafeContext(dashboard.all.jobs[1]!)).toBe(
      "target document:doc-001 · matter matter-001 · document doc-001 · task ocr",
    );
    expect(workerRunSafeContext(dashboard.all.jobs[1]!)).not.toContain("storage");
    expect(workerRunSafeContext(dashboard.all.jobs[1]!)).not.toContain("raw document text");
  });

  it("describes compact worker health without raw job detail", () => {
    const fallback = emptyWorkerHealthResponse();
    const degraded = {
      ...fallback,
      status: "degraded" as const,
      generatedAt: "2026-05-02T10:06:00.000Z",
      configuredQueues: 2,
      reservedQueues: 3,
      notConfiguredQueues: 1,
      totalRuns: 2,
      activeOrQueued: 1,
      failed: 1,
      stalled: 1,
      lastObservedAt: "2026-05-02T10:05:00.000Z",
      queues: [
        {
          queueName: "email",
          status: "configured",
          health: "healthy" as const,
          total: 1,
          queued: 0,
          active: 0,
          failed: 0,
          terminal: 1,
          stalled: 0,
          lastObservedAt: "2026-05-02T09:01:00.000Z",
          degradedReasons: [],
        },
        {
          queueName: "ocr",
          status: "configured",
          health: "degraded" as const,
          total: 1,
          queued: 1,
          active: 0,
          failed: 1,
          terminal: 0,
          stalled: 1,
          lastObservedAt: "2026-05-02T10:05:00.000Z",
          lastFailureAt: "2026-05-02T10:05:00.000Z",
          degradedReasons: ["failed_jobs_observed", "stalled_jobs_observed"],
        },
      ],
    };

    expect(buildWorkerHealthPath()).toBe("/api/jobs/health");
    expect(workerHealthTone("healthy")).toBe("ready");
    expect(workerHealthTone("degraded")).toBe("risk");
    expect(workerHealthTone("unknown")).toBe("neutral");
    expect(summarizeWorkerHealth(degraded)).toContain(
      "2 configured queues, 3 reserved, 1 not configured.",
    );
    expect(summarizeWorkerHealth(degraded)).toContain("1 failed and 1 stalled.");
    expect(JSON.stringify(degraded)).not.toContain("rawBody");
  });

  it("builds an operations focus summary from existing authorized dashboard data", () => {
    const taskWorkbench: TaskDeadlineWorkbenchResponse = {
      tasks: [],
      counters: {
        my: { overdue: 2, today: 1, upcoming: 0 },
        team: { overdue: 2, today: 3, upcoming: 1 },
        matterQueues: [],
        contactQueues: [],
      },
      focusQueues: {
        myOverdueTaskIds: ["task-overdue-1", "task-overdue-2"],
        teamTodayTaskIds: ["task-today-1"],
        upcomingTaskIds: [],
        unassignedTaskIds: [],
      },
    };
    const queues: QueuesResponse = {
      sections: [
        {
          key: "intake",
          label: "Intake",
          items: [
            {
              id: "queue-1",
              matterId: "matter-001",
              title: "contains raw-token-secret but must not render",
              status: "pending_review",
              priority: "high",
            },
          ],
        },
      ],
    };
    const workerRuns: WorkerRunsDashboardResponse = {
      all: {
        ...emptyWorkerRunsResponse("loaded"),
        summary: { total: 3, queued: 1, active: 1, failed: 1, terminal: 1, byQueue: [] },
      },
      email: emptyWorkerRunsResponse("loaded"),
      ocr: emptyWorkerRunsResponse("loaded"),
    };
    const providerStatus = emptyProvidersStatusResponse("smtp_not_configured");

    const focus = buildOperationalFocusSummary({
      taskWorkbench,
      queues,
      operationalViews: {
        generatedAt: "2026-06-20T12:00:00.000Z",
        views: [
          {
            definition: {
              key: "uncontacted_clients",
              label: "Uncontacted clients",
              defaultPriority: "medium",
            },
            resultCount: 9,
            results: [
              {
                matterId: "matter-cross-scope",
                body: "raw body text must not render",
                metadata: { token: "private-token", hash: "private-hash" },
              },
            ],
          },
          {
            definition: {
              key: "conflicts_pending_review",
              label: "Conflicts pending review",
              defaultPriority: "high",
            },
            resultCount: 3,
            results: [
              {
                matterId: "matter-hidden",
                extractionText: "raw extraction text must not render",
              },
            ],
          },
          {
            definition: {
              key: "overdue_tasks_deadlines",
              label: "Overdue tasks and deadlines",
              defaultPriority: "high",
            },
            resultCount: 1,
          },
          {
            definition: {
              key: "awaiting_signature",
              label: "Awaiting signature",
              defaultPriority: "medium",
            },
            resultCount: 5,
          },
        ],
      },
      workerRuns,
      providerStatus,
      activeMatterCommandCenter: {
        rail: [
          {
            key: "communications",
            label: "Communication records",
            value: 2,
            detail: "Inbound and outbound delivery records",
            tone: "ready",
          },
        ],
      },
      activeMatterActivitySummary: { attention: 1 },
    });

    expect(focus.items.map((item) => item.key).slice(0, 4)).toEqual([
      "tasks-overdue",
      "tasks-today",
      "workers-failed",
      "workers-active",
    ]);
    expect(focus.items.map((item) => item.key).slice(4, 7)).toEqual([
      "operational-view-conflicts_pending_review",
      "operational-view-overdue_tasks_deadlines",
      "operational-view-uncontacted_clients",
    ]);
    expect(
      focus.items
        .filter((item) => item.section === "Operational views")
        .map((item) => [item.label, item.value, item.detail]),
    ).toEqual([
      ["Conflicts pending review", "3", ""],
      ["Overdue tasks and deadlines", "1", ""],
      ["Uncontacted clients", "9", ""],
    ]);
    expect(focus.attentionCount).toBe(9);
    expect(focus.providerRiskCount).toBe(1);
    expect(JSON.stringify(focus.items)).not.toContain("raw-token-secret");
    expect(JSON.stringify(focus.items)).not.toContain("token");
    expect(JSON.stringify(focus.items)).not.toContain("raw body text");
    expect(JSON.stringify(focus.items)).not.toContain("raw extraction text");
    expect(JSON.stringify(focus.items)).not.toContain("private-hash");
    expect(JSON.stringify(focus.items)).not.toContain("matter-cross-scope");
  });

  it("returns an empty operations focus message when no attention signals exist", () => {
    const emptyStatus = emptyProvidersStatusResponse();
    const providerStatus: ProvidersStatusResponse = {
      ...emptyStatus,
      email: {
        ...emptyStatus.email,
        status: "configured",
        provider: "smtp",
        queue: { queueName: "email", status: "configured" },
      },
      documentProcessing: {
        ...emptyStatus.documentProcessing,
        status: "configured",
        workerQueues: [{ queueName: "ocr", status: "configured" }],
      },
    };

    const focus = buildOperationalFocusSummary({
      taskWorkbench: {
        tasks: [],
        counters: {
          my: { overdue: 0, today: 0, upcoming: 0 },
          team: { overdue: 0, today: 0, upcoming: 0 },
          matterQueues: [],
          contactQueues: [],
        },
        focusQueues: {
          myOverdueTaskIds: [],
          teamTodayTaskIds: [],
          upcomingTaskIds: [],
          unassignedTaskIds: [],
        },
      },
      queues: { sections: [] },
      operationalViews: { views: [] },
      workerRuns: {
        all: emptyWorkerRunsResponse("loaded"),
        email: emptyWorkerRunsResponse("loaded"),
        ocr: emptyWorkerRunsResponse("loaded"),
      },
      providerStatus,
      activeMatterActivitySummary: { attention: 0 },
    });

    expect(focus.items).toEqual([]);
    expect(operationalFocusEmptyMessage(focus)).toBe(
      "No overdue tasks, operational views, failed runs, high-priority queues, or provider risks need attention.",
    );
  });

  it("builds share-link payloads and replaces revoked links without leaking token hashes", () => {
    const activeShare = shareLink();
    const revokedShare = shareLink({
      revokedAt: "2026-04-29T13:00:00.000Z",
    });

    expect(
      buildCreateShareLinkPayload({
        matterId: "matter-001",
        permissions: ["view_documents"],
        expiresAt: "2026-05-01",
        notificationEmail: " client@example.test ",
        requireEmailVerification: false,
      }),
    ).toEqual({
      matterId: "matter-001",
      permissions: ["view_documents"],
      expiresAt: "2026-05-01T00:00:00.000Z",
      notificationEmail: "client@example.test",
      requireEmailVerification: false,
    });
    expect(
      buildCreateShareLinkPayload({
        matterId: "matter-001",
        permissions: ["view_documents"],
        expiresAt: "",
        notificationEmail: " ",
        requireEmailVerification: true,
      }),
    ).toEqual({
      matterId: "matter-001",
      permissions: ["view_documents"],
      expiresAt: undefined,
      notificationEmail: undefined,
      requireEmailVerification: true,
    });
    expect(formatSharePermission("view_documents")).toBe("View documents");
    expect(
      describeCreateShareLinkResult({
        token: "one-time-token",
        queuedEmail: {
          id: "email-001",
          templateKey: "share_link.created",
          status: "queued",
          queuedAt: "2026-05-01T00:00:00.000Z",
          jobId: "job-001",
        },
      }),
    ).toBe(
      "Created share link; notification email queued. One-time token remains available below.",
    );
    expect(describeCreateShareLinkResult({ token: "one-time-token" })).toBe(
      "Created share link; use the one-time token below.",
    );
    expect(describeShareLinkState(activeShare)).toEqual({ label: "active", tone: "active" });
    expect(replaceShareLink([activeShare], revokedShare)).toEqual([revokedShare]);
  });

  it("builds public share-link verification paths and status copy", () => {
    expect(buildPublicSharePath("share token/with slash")).toBe(
      "/api/portal/shares/share%20token%2Fwith%20slash",
    );
    expect(buildShareEmailVerificationPath("share-token")).toBe(
      "/api/portal/shares/share-token/email-verification",
    );
    expect(
      isShareEmailVerificationRequired({
        code: "EMAIL_VERIFICATION_REQUIRED",
        message: "Email verification is required",
      }),
    ).toBe(true);
    expect(
      isShareEmailVerificationRequired({
        error: { code: "EMAIL_VERIFICATION_REQUIRED" },
      }),
    ).toBe(true);
    expect(publicShareErrorMessage({ error: { message: "Not available" } }, "Fallback")).toBe(
      "Not available",
    );
    expect(describePublicShareStatus({ documents: [{ id: "doc-001" }] })).toBe(
      "Email verification complete. 1 document is available.",
    );
    expect(describePublicShareStatus({ documents: [{ id: "doc-001" }, { id: "doc-002" }] })).toBe(
      "Email verification complete. 2 documents are available.",
    );
  });

  it("loads draft templates once and existing drafts per matter for first render", async () => {
    const template = draftTemplate();
    const draftCalls: string[] = [];
    const data = await loadDraftingDashboardData({
      matters: [matter({ id: "matter-001" }), matter({ id: "matter-002" })],
      listTemplates: async () => [template],
      listDraftsForMatter: async (matterId) => {
        draftCalls.push(matterId);
        return [draftRecord({ id: `draft-${matterId}`, matterId })];
      },
    });

    expect(data.templates).toEqual([template]);
    expect(draftCalls).toEqual(["matter-001", "matter-002"]);
    expect(data.draftsByMatterId["matter-001"]).toEqual([
      expect.objectContaining({ id: "draft-matter-001", matterId: "matter-001" }),
    ]);
    expect(data.draftsByMatterId["matter-002"]).toEqual([
      expect.objectContaining({ id: "draft-matter-002", matterId: "matter-002" }),
    ]);
  });

  it("builds template draft payloads, appends returned drafts, and previews TipTap text", () => {
    const template = draftTemplate();
    const activeMatter = matter({ id: "matter-001", number: "2026-0001" });
    const createdDraft = draftRecord();

    expect(buildDraftFromTemplatePayload({ matter: activeMatter, template })).toEqual({
      matterId: "matter-001",
      title: "Generic Legal Letter - 2026-0001",
      templateId: "draft-template-legal-letter",
    });
    expect(appendDraftToMatterDrafts({ "matter-001": [] }, createdDraft)).toEqual({
      "matter-001": [createdDraft],
    });
    expect(extractDraftPlainText(template.editorJson)).toBe("Synthetic letter opening");
  });

  it("builds explicit draft editor payloads without changing matter scope", () => {
    const activeMatter = matter({ id: "matter-001", number: "2026-0001" });
    const blankPayload = buildBlankDraftPayload({ matter: activeMatter });
    const updatedEditorJson = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Revised synthetic draft" }],
        },
      ],
    };

    expect(blankPayload).toEqual({
      matterId: "matter-001",
      title: "Blank Draft - 2026-0001",
      editorJson: { type: "doc", content: [{ type: "paragraph" }] },
    });
    expect(buildDraftUpdatePayload({ editorJson: updatedEditorJson })).toEqual({
      editorJson: updatedEditorJson,
    });
    expect(isSameDraftDocument(blankPayload.editorJson, updatedEditorJson)).toBe(false);
    expect(isSameDraftDocument(updatedEditorJson, updatedEditorJson)).toBe(true);
    expect(formatDraftApiFailure("creation", 400, { message: "Invalid request body" })).toBe(
      "Draft creation failed: 400: Invalid request body",
    );
    expect(formatDraftApiFailure("save", 500)).toBe("Draft save failed: 500");
  });

  it("builds draft export payloads and local export history", () => {
    const draft = draftRecord();
    const exportRecord = {
      format: "pdf" as const,
      title: "Synthetic export",
      contentType: "application/pdf",
      byteLength: 2048,
      checksumSha256: "a".repeat(64),
      storageKey: "matters/matter-001/draft-exports/export.pdf",
      document: documentRecord({ id: "doc-export-001", title: "Synthetic export.pdf" }),
      generatedDocument: {
        id: "generated-export-001",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        provider: "embedded" as const,
        externalId: "draft-export:draft-001:doc-export-001",
        title: "Synthetic export",
        documentId: "doc-export-001",
        storageKey: "matters/matter-001/draft-exports/export.pdf",
        checksumSha256: "a".repeat(64),
        evidence: { source: "draft_export", draftId: draft.id },
        createdAt: "2026-05-10T12:00:00.000Z",
      },
    };

    expect(buildDraftExportPayload({ format: "pdf", title: "  Synthetic export " })).toEqual({
      format: "pdf",
      title: "Synthetic export",
    });
    expect(buildDraftExportPayload({ format: "docx", title: " " })).toEqual({
      format: "docx",
      title: undefined,
    });
    expect(
      appendDraftExportRecord({}, draft.id, exportRecord)[draft.id]?.map((record) => record.title),
    ).toEqual(["Synthetic export"]);
    expect(formatDraftExportSize(512)).toBe("512 B");
    expect(formatDraftExportSize(2048)).toBe("2 KB");
  });

  it("inserts merge fields into local draft JSON", () => {
    const editorJson = {
      type: "doc" as const,
      content: [{ type: "paragraph", content: [{ type: "text", text: "Original draft" }] }],
    };

    const updated = appendMergeFieldToDraftDocument({
      editorJson,
      field: "matter.number",
    });

    expect(extractDraftPlainText(updated)).toBe("Original draft {{ matter.number }}");
    expect(extractDraftPlainText(editorJson)).toBe("Original draft");
  });

  it("describes draft assist status and inserts suggestions into local editor JSON", () => {
    const editorJson = {
      type: "doc" as const,
      content: [{ type: "paragraph", content: [{ type: "text", text: "Original draft" }] }],
    };
    const updated = insertDraftAssistSuggestion({
      editorJson,
      record: { suggestedText: "Suggested assist text" },
    });

    expect(describeDraftAssistStatus({ status: "disabled", reason: "not_configured" })).toBe(
      "Draft assist unavailable: not configured.",
    );
    expect(extractDraftPlainText(updated)).toBe("Original draft Suggested assist text");
    expect(extractDraftPlainText(editorJson)).toBe("Original draft");
  });

  it("builds external upload paths, create payloads, and local link state", () => {
    const expiresAtLocal = "2026-05-01T09:30";
    const upload = externalUploadLink();
    const updatedUpload = externalUploadLink({ usedUploads: 2 });
    const document = externalUploadDocument();
    const acceptedDocument = externalUploadDocument({
      reviewStatus: "accepted",
      reviewDecision: "accept",
    });

    expect(buildExternalUploadListPath("matter 001")).toBe(
      "/api/external-uploads?matterId=matter%20001",
    );
    expect(buildExternalUploadRevokePath("external/upload/001")).toBe(
      "/api/external-uploads/external%2Fupload%2F001/revoke",
    );
    expect(buildExternalUploadReviewPath("external/document/001")).toBe(
      "/api/external-uploads/documents/external%2Fdocument%2F001/review",
    );
    expect(
      buildExternalUploadCreatePayload({
        matterId: "matter-001",
        maxUploads: "3",
        expiresAtLocal,
      }),
    ).toEqual({
      matterId: "matter-001",
      maxUploads: 3,
      expiresAt: new Date(expiresAtLocal).toISOString(),
    });
    expect(
      buildExternalUploadCreatePayload({
        matterId: "matter-001",
        maxUploads: "0",
        expiresAtLocal: "",
      }),
    ).toEqual({ matterId: "matter-001", maxUploads: 1 });
    expect(canCreateExternalUpload({ status: "available", provider: "s3" })).toBe(true);
    expect(canCreateExternalUpload({ status: "not_configured", provider: "s3" })).toBe(false);
    expect(upsertExternalUploadLink({}, upload)).toEqual({ "matter-001": [upload] });
    expect(upsertExternalUploadLink({ "matter-001": [upload] }, updatedUpload)).toEqual({
      "matter-001": [updatedUpload],
    });
    expect(upsertExternalUploadDocument({}, document)).toEqual({ "matter-001": [document] });
    expect(upsertExternalUploadDocument({ "matter-001": [document] }, acceptedDocument)).toEqual({
      "matter-001": [acceptedDocument],
    });
    expect(buildExternalUploadReviewPayload({ decision: "accept" })).toEqual({
      decision: "accept",
    });
    expect(
      buildExternalUploadReviewPayload({
        decision: "discard",
        reason: "wrong_matter",
        duplicateOfDocumentId: "doc-001",
        note: "  Synthetic note  ",
      }),
    ).toEqual({
      decision: "discard",
      reason: "wrong_matter",
      duplicateOfDocumentId: "doc-001",
      note: "Synthetic note",
    });
    expect(getExternalUploadLinkState(upload, new Date("2026-04-30T12:00:00.000Z"))).toBe("active");
    expect(getExternalUploadLinkState(updatedUpload, new Date("2026-04-30T12:00:00.000Z"))).toBe(
      "used",
    );
    expect(
      getExternalUploadLinkState(
        externalUploadLink({ revokedAt: "2026-04-29T13:00:00.000Z" }),
        new Date("2026-04-30T12:00:00.000Z"),
      ),
    ).toBe("revoked");
    expect(describeExternalUploadReviewState(document)).toEqual({
      label: "Pending review",
      tone: "neutral",
    });
    expect(
      describeExternalUploadReviewState(
        externalUploadDocument({ reviewStatus: "retry_requested" }),
      ),
    ).toEqual({ label: "Retry requested", tone: "risk" });
  });

  it("loads external upload status and matter-scoped links for first render", async () => {
    const upload = externalUploadLink({ matterId: "matter-002" });
    const document = externalUploadDocument({ matterId: "matter-002" });
    const data = await loadExternalUploadsDashboardData({
      matters: [matter({ id: "matter-001" }), matter({ id: "matter-002" })],
      getStatus: async () => ({
        status: "available",
        provider: "s3",
      }),
      listUploadsForMatter: async (matterId) =>
        matterId === "matter-002"
          ? { uploads: [upload], reviewItems: [document] }
          : { uploads: [] },
    });

    expect(data.status).toEqual({ status: "available", provider: "s3" });
    expect(data.uploadsByMatterId).toEqual({
      "matter-001": [],
      "matter-002": [upload],
    });
    expect(data.reviewItemsByMatterId).toEqual({
      "matter-001": [],
      "matter-002": [document],
    });
  });

  it("buckets calendar radar events without changing source records", () => {
    const now = new Date("2026-05-01T12:00:00.000Z");
    const overdue = calendarEvent({
      id: "calendar-event-overdue",
      startsAt: "2026-04-30T12:00:00.000Z",
    });
    const soon = calendarEvent({ id: "calendar-event-soon", startsAt: "2026-05-03T12:00:00.000Z" });
    const near = calendarEvent({ id: "calendar-event-near", startsAt: "2026-05-20T12:00:00.000Z" });
    const tentative = calendarEvent({
      id: "calendar-event-tentative",
      startsAt: "2026-05-02T12:00:00.000Z",
      status: "tentative",
    });
    const cancelled = calendarEvent({
      id: "calendar-event-cancelled",
      startsAt: "2026-05-02T12:00:00.000Z",
      status: "cancelled",
    });

    const buckets = buildCalendarRadarBuckets([near, cancelled, soon, tentative, overdue], now);

    expect(buckets.overdue.map((event) => event.id)).toEqual(["calendar-event-overdue"]);
    expect(buckets.nextSevenDays.map((event) => event.id)).toEqual([
      "calendar-event-tentative",
      "calendar-event-soon",
    ]);
    expect(buckets.nextThirtyDays.map((event) => event.id)).toEqual(["calendar-event-near"]);
    expect(buckets.tentative.map((event) => event.id)).toEqual(["calendar-event-tentative"]);
    expect(buckets.cancelled.map((event) => event.id)).toEqual(["calendar-event-cancelled"]);
    expect(describeCalendarEventTiming(near, now)).toBe("next 30 days");
  });

  it("builds calendar invitation payloads only after recipient confirmation", () => {
    expect(buildCalendarInvitationPayload({ matterId: "matter-001", recipientCount: 2 })).toEqual({
      matterId: "matter-001",
      deliveryConfirmation: { confirmed: true, channel: "email", recipientCount: 2 },
    });
    expect(
      buildCalendarInvitationPayload({
        matterId: "matter-001",
        recipientCount: 1,
        includeMeetingLink: true,
      }),
    ).toEqual({
      matterId: "matter-001",
      includeMeetingLink: true,
      deliveryConfirmation: { confirmed: true, channel: "email", recipientCount: 1 },
    });
  });

  it("builds calendar meeting-link payloads for blank, hosted, and external modes", () => {
    expect(buildCalendarMeetingLinkPayload({ matterId: "matter-001", mode: "blank" })).toEqual({
      matterId: "matter-001",
      mode: "blank",
    });
    expect(
      buildCalendarMeetingLinkPayload({ matterId: "matter-001", mode: "hosted_webrtc" }),
    ).toEqual({
      matterId: "matter-001",
      mode: "hosted_webrtc",
    });
    expect(
      buildCalendarMeetingLinkPayload({
        matterId: "matter-001",
        mode: "external_url",
        externalUrl: "  https://video.example.test/client-prep  ",
      }),
    ).toEqual({
      matterId: "matter-001",
      mode: "external_url",
      url: "https://video.example.test/client-prep",
    });
  });

  it("builds calendar event and reminder lifecycle payloads", () => {
    expect(
      buildCalendarEventPayload({
        matterId: "matter-001",
        title: "  Synthetic conference  ",
        startsAt: "2026-05-12T16:00:00.000Z",
        endsAt: "2026-05-12T17:00:00.000Z",
        status: "tentative",
        description: "  Synthetic notes  ",
        location: "  Room 4  ",
      }),
    ).toEqual({
      matterId: "matter-001",
      title: "Synthetic conference",
      startsAt: "2026-05-12T16:00:00.000Z",
      endsAt: "2026-05-12T17:00:00.000Z",
      status: "tentative",
      description: "Synthetic notes",
      location: "Room 4",
    });
    expect(
      buildCalendarReschedulePayload({
        matterId: "matter-001",
        startsAt: "2026-05-13T16:00:00.000Z",
        endsAt: "2026-05-13T17:00:00.000Z",
      }),
    ).toEqual({
      matterId: "matter-001",
      startsAt: "2026-05-13T16:00:00.000Z",
      endsAt: "2026-05-13T17:00:00.000Z",
    });
    expect(
      buildCalendarReminderPayload({
        matterId: "matter-001",
        remindAt: "2026-05-12T15:45:00.000Z",
        status: "pending",
        note: "  Bring synthetic exhibit list  ",
      }),
    ).toEqual({
      matterId: "matter-001",
      remindAt: "2026-05-12T15:45:00.000Z",
      channel: "dashboard",
      status: "pending",
      note: "Bring synthetic exhibit list",
    });
  });

  it("loads calendar dashboard events, links, and credentials for first render", async () => {
    const event = calendarEvent({ matterId: "matter-002" });
    const data = await loadCalendarDashboardData({
      matters: [matter({ id: "matter-001" }), matter({ id: "matter-002" })],
      listEventsForMatter: async (matterId) => ({
        events: matterId === "matter-002" ? [event] : [],
        caldavUrl: "http://practice.example.test/caldav",
        subscriptionUrl: `webcal://practice.example.test/api/calendar/matters/${matterId}.ics`,
      }),
      listCredentials: async () => [
        {
          id: "calendar-credential-001",
          username: "firm.user.calendar-credential-001",
          label: "iOS Calendar",
          createdAt: "2026-05-01T12:00:00.000Z",
        },
      ],
    });

    expect(data.eventsByMatterId).toEqual({ "matter-001": [], "matter-002": [event] });
    expect(data.linksByMatterId["matter-001"]).toEqual({
      caldavUrl: "http://practice.example.test/caldav",
      subscriptionUrl: "webcal://practice.example.test/api/calendar/matters/matter-001.ics",
    });
    expect(
      upsertCalendarCredential(data.credentials, {
        ...data.credentials[0]!,
        revokedAt: "2026-05-01T13:00:00.000Z",
      }),
    ).toEqual([
      expect.objectContaining({ id: "calendar-credential-001", revokedAt: expect.any(String) }),
    ]);
  });

  it("updates calendar attendee state without mutating unrelated matter events", () => {
    const event = calendarEvent({
      id: "calendar-event-meeting",
      matterId: "matter-001",
      attendees: [],
    });
    const updated = upsertCalendarEventAttendee(
      { "matter-001": [event], "matter-002": [calendarEvent({ matterId: "matter-002" })] },
      "matter-001",
      event.id,
      {
        id: "calendar-attendee-test",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        eventId: event.id,
        name: "Synthetic Reviewer",
        email: "reviewer@example.test",
        role: "optional",
        responseStatus: "needs_action",
        invitationStatus: "queued",
        createdAt: "2026-05-01T12:00:00.000Z",
        updatedAt: "2026-05-01T12:00:00.000Z",
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
      },
    );

    expect(updated["matter-001"]![0]!.attendees).toMatchObject([
      {
        id: "calendar-attendee-test",
        invitationStatus: "queued",
      },
    ]);
    expect(
      removeCalendarEventAttendee(updated, "matter-001", event.id, "calendar-attendee-test")[
        "matter-001"
      ]![0]!.attendees,
    ).toEqual([]);
    expect(updated["matter-002"]).toHaveLength(1);
  });

  it("updates calendar event and reminder state without mutating unrelated matters", () => {
    const event = calendarEvent({
      id: "calendar-event-lifecycle",
      matterId: "matter-001",
      reminders: [],
    });
    const otherMatterEvent = calendarEvent({ id: "calendar-event-other", matterId: "matter-002" });
    const upsertedEvent = upsertCalendarEvent(
      { "matter-001": [event], "matter-002": [otherMatterEvent] },
      "matter-001",
      { ...event, title: "Updated lifecycle event" },
    );
    expect(upsertedEvent["matter-001"]![0]).toMatchObject({
      id: "calendar-event-lifecycle",
      title: "Updated lifecycle event",
    });

    const reminder = {
      id: "calendar-reminder-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      eventId: event.id,
      remindAt: "2026-05-12T15:45:00.000Z",
      channel: "dashboard" as const,
      status: "pending" as const,
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z",
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
    };
    const withReminder = upsertCalendarEventReminder(
      upsertedEvent,
      "matter-001",
      event.id,
      reminder,
    );
    expect(withReminder["matter-001"]![0]!.reminders).toMatchObject([
      { id: "calendar-reminder-test", status: "pending" },
    ]);
    expect(
      removeCalendarEventReminder(withReminder, "matter-001", event.id, reminder.id)[
        "matter-001"
      ]![0]!.reminders,
    ).toEqual([]);
    expect(withReminder["matter-002"]).toEqual([otherMatterEvent]);
  });

  it("describes meeting invitation boundaries without exposing links or tokens", () => {
    expect(describeMeetingInvitationBoundary(undefined)).toBe("Meeting links disabled.");
    expect(describeMeetingLinkAvailability(calendarEvent())).toEqual({
      label: "No meeting link",
      detail:
        "Add another meeting link, leave it blank, or configure Hosted WebRTC before using hosted links.",
      status: "disabled",
      actionable: false,
    });
    expect(
      describeMeetingInvitationBoundary({
        meetingLinks: { status: "disabled", reason: "not_configured" },
        guestAccess: { status: "disabled", reason: "not_configured" },
        invitationEmail: { status: "disabled", reason: "smtp_not_configured" },
      }),
    ).toBe("Meeting links disabled. Guest access tokens disabled.");
    expect(
      describeMeetingLinkAvailability(
        calendarEvent({
          meetingInvitationBoundary: {
            meetingLinks: { status: "disabled", reason: "not_configured" },
            guestAccess: { status: "disabled", reason: "not_configured" },
            invitationEmail: { status: "disabled", reason: "smtp_not_configured" },
          },
        }),
      ),
    ).toEqual({
      label: "No meeting link",
      detail:
        "Add another meeting link, leave it blank, or configure Hosted WebRTC before using hosted links.",
      status: "disabled",
      actionable: false,
    });
    expect(
      describeMeetingInvitationBoundary({
        meetingLinks: { status: "configured", provider: "synthetic-meeting" },
        guestAccess: { status: "configured", provider: "synthetic-meeting" },
        invitationEmail: { status: "configured", provider: "mailpit" },
      }),
    ).toBe("Meeting links configured (synthetic-meeting). Guest access tokens configured.");
    expect(
      describeMeetingLinkAvailability({
        ...calendarEvent({
          meetingLinkMode: "hosted_webrtc",
          meetingLinkUrl: "https://meet.example.test/rooms/calendar-room-001",
          meetingProviderKey: "synthetic-meeting",
          meetingInvitationBoundary: {
            meetingLinks: { status: "configured", provider: "synthetic-meeting" },
            guestAccess: { status: "configured", provider: "synthetic-meeting" },
            invitationEmail: { status: "configured", provider: "mailpit" },
          },
        }),
      }),
    ).toEqual({
      label: "Send link invite",
      detail:
        "synthetic-meeting link ready; the invitation action can include the stored meeting link.",
      status: "configured",
      actionable: true,
    });
  });

  it("builds intake form link paths, create payloads, and review state", async () => {
    const expiresAtLocal = "2026-05-01T09:30";
    const link = intakeFormLink();
    const submittedLink = intakeFormLink({
      submittedAt: "2026-04-30T12:00:00.000Z",
      status: "submitted",
    });
    const session = {
      id: "intake-session-dashboard",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      templateId: "intake-template-001",
      provider: "embedded" as const,
      externalId: "embedded:intake-session-dashboard",
      status: "created" as const,
      evidence: { source: "dashboard" },
      createdAt: "2026-04-30T12:00:00.000Z",
      updatedAt: "2026-04-30T12:00:00.000Z",
    };
    const updatedSession = {
      ...session,
      status: "in_progress" as const,
      updatedAt: "2026-04-30T12:30:00.000Z",
    };
    const proposal = {
      id: "proposal-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      intakeSessionId: "intake-session-001",
      answerSnapshotId: "snapshot-001",
      sourceQuestionId: "matter_title",
      targetScope: "matter" as const,
      targetField: "title" as const,
      targetRecordId: "matter-001",
      proposedValue: "Synthetic title",
      status: "pending" as const,
      createdAt: "2026-04-29T12:00:00.000Z",
    };
    if (sampleResidentialTenancyIntakeDefinition.schemaVersion !== 2) {
      throw new Error("Expected V2 intake sample");
    }

    expect(buildIntakeFormLinkListPath("matter 001")).toBe(
      "/api/intake-form-links?matterId=matter%20001",
    );
    expect(buildIntakePortalPath("client token")).toBe("/intake-forms/client%20token");
    expect(buildIntakeVariableProposalListPath("matter 001")).toBe(
      "/api/intake-variable-proposals?matterId=matter%20001",
    );
    expect(buildIntakeFormReviewPath("link 001")).toBe("/api/intake-form-links/link%20001/review");
    expect(buildIntakeFormReviewDecisionPath("link 001", "accept")).toBe(
      "/api/intake-form-links/link%20001/review/accept",
    );
    expect(buildIntakeFormReviewDecisionPath("link 001", "request-more-info")).toBe(
      "/api/intake-form-links/link%20001/review/request-more-info",
    );
    expect(
      describeRequestMoreInfoResult({
        review: {
          id: "review-001",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          intakeSessionId: "intake-session-001",
          formLinkId: "intake-form-link-001",
          answerSnapshotId: "snapshot-001",
          decision: "request_more_info",
          decidedByUserId: "user-admin",
          decidedAt: "2026-04-30T13:00:00.000Z",
          followUpFormLinkId: "intake-form-link-child",
        },
        followUp: {
          link: intakeFormLink({
            id: "intake-form-link-child",
            parentFormLinkId: "intake-form-link-001",
          }),
          token: "one-time-token",
          portalUrl: "http://localhost:3001/intake-forms/one-time-token",
        },
      }),
    ).toBe("Follow-up intake link created. One-time token remains available below.");
    expect(summarizeAnswerValue("x".repeat(130))).toBe(`${"x".repeat(117)}...`);
    expect(
      summarizeIntakeReview({
        id: "review-001",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        intakeSessionId: "intake-session-001",
        formLinkId: "intake-form-link-001",
        answerSnapshotId: "snapshot-001",
        decision: "request_more_info",
        decidedByUserId: "user-admin",
        decidedAt: "2026-04-30T13:00:00.000Z",
        reason: "Synthetic clarification needed.",
        followUpFormLinkId: "intake-form-link-child",
      }),
    ).toBe(
      "request more info · 2026-04-30T13:00:00.000Z · Synthetic clarification needed. · follow-up intake-form-link-child",
    );
    expect(pendingSubmittedIntakeReviewLinks([link, submittedLink])).toEqual([submittedLink]);
    expect(
      pendingSubmittedIntakeReviewLinks([submittedLink], {
        [submittedLink.id]: {
          link: submittedLink,
          snapshot: {
            id: "snapshot-001",
            firmId: "firm-west-legal",
            intakeSessionId: "intake-session-001",
            capturedAt: "2026-04-30T12:00:00.000Z",
            answers: { matter_title: "Synthetic title" },
            resolution: {
              templateId: "intake-template-001",
              templateVersion: 1,
              visibleQuestionIds: ["matter_title"],
              matchedBranchRuleIds: [],
              eligiblePackageIds: [],
              selectedPackageIds: [],
              packageSummaries: [],
              packageDocuments: [],
            },
          },
          actions: [],
          reviews: [
            {
              id: "review-001",
              firmId: "firm-west-legal",
              matterId: "matter-001",
              intakeSessionId: "intake-session-001",
              formLinkId: submittedLink.id,
              answerSnapshotId: "snapshot-001",
              decision: "accepted",
              decidedByUserId: "user-admin",
              decidedAt: "2026-04-30T13:00:00.000Z",
            },
          ],
        },
      }),
    ).toEqual([]);
    expect(
      buildIntakeTemplatePreviewPayload({
        definition: sampleResidentialTenancyIntakeDefinition,
        matterId: "matter-001",
        answers: { urgent: true },
      }),
    ).toEqual({
      definition: sampleResidentialTenancyIntakeDefinition,
      matterId: "matter-001",
      answers: { urgent: true },
    });
    expect(describeIntakeTemplatePreview(null)).toBe("Preview checks have not run.");
    expect(
      describeIntakeTemplatePreview({
        status: "blocked",
        checks: [
          {
            code: "invalid_definition",
            severity: "blocking",
            message: "Definition is invalid.",
          },
        ],
        preview: null,
      }),
    ).toBe("Preview blocked by 1 check.");
    expect(previewStatusClass(null)).toBe("muted");
    expect(
      previewStatusClass({
        status: "warnings",
        checks: [],
        preview: null,
      }),
    ).toBe("warning");
    expect(
      buildIntakeSessionCreatePayload({
        matter: matter({ id: "matter-001" }),
        template: { id: "intake-template-001" },
      }),
    ).toEqual({
      matterId: "matter-001",
      templateId: "intake-template-001",
      evidence: { source: "dashboard" },
    });
    expect(buildEmailDeliveryConfirmation(1)).toEqual({
      confirmed: true,
      channel: "email",
      recipientCount: 1,
    });
    expect(
      buildIntakeSessionCreatePayload({
        matter: matter({ id: "matter-001" }),
        template: { id: "intake-template-001" },
        deliveryConfirmation: buildEmailDeliveryConfirmation(1),
      }),
    ).toEqual({
      matterId: "matter-001",
      templateId: "intake-template-001",
      evidence: { source: "dashboard" },
      deliveryConfirmation: { confirmed: true, channel: "email", recipientCount: 1 },
    });
    expect(
      buildIntakeFormLinkCreatePayload({
        intakeSessionId: "intake-session-001",
        expiresAtLocal,
      }),
    ).toEqual({
      intakeSessionId: "intake-session-001",
      expiresAt: new Date(expiresAtLocal).toISOString(),
    });
    expect(
      buildIntakeFormLinkCreatePayload({
        intakeSessionId: "intake-session-001",
        expiresAtLocal: "",
      }),
    ).toEqual({ intakeSessionId: "intake-session-001" });
    expect(upsertIntakeSession([], session)).toEqual([session]);
    expect(upsertIntakeSession([session], updatedSession)).toEqual([updatedSession]);
    expect(upsertIntakeFormLink({}, link)).toEqual({ "matter-001": [link] });
    expect(upsertIntakeFormLink({ "matter-001": [link] }, submittedLink)).toEqual({
      "matter-001": [submittedLink],
    });
    expect(upsertIntakeVariableProposal({}, proposal)).toEqual({ "matter-001": [proposal] });
    expect(getIntakeFormLinkState(link, new Date("2026-04-30T12:00:00.000Z"))).toBe("active");
    expect(getIntakeFormLinkState(submittedLink, new Date("2026-04-30T12:00:00.000Z"))).toBe(
      "submitted",
    );
    expect(buildIntakeTemplateEditorValue()).toContain('"schemaVersion": 2');
    expect(buildVariableMapping("client", "displayName")).toEqual({
      targetScope: "client",
      targetField: "displayName",
    });
    expect(buildVariableMapping("matter", "unsupported")).toBeUndefined();
    expect(
      summarizeIntakeItemAction({
        id: "action-001",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        intakeSessionId: "intake-session-001",
        formLinkId: "intake-form-link-001",
        itemId: "evidence-upload",
        kind: "upload",
        status: "intent_created",
        evidence: {},
        createdAt: "2026-04-29T12:00:00.000Z",
      }),
    ).toBe("upload: intent created");
    expect(
      summarizeIntakeItemAction({
        id: "action-signature-001",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        intakeSessionId: "intake-session-001",
        formLinkId: "intake-form-link-001",
        itemId: "client-attestation",
        kind: "signature",
        status: "completed",
        documentId: "doc-001",
        signatureRequestId: "signature-request-001",
        evidence: {},
        createdAt: "2026-04-29T12:00:00.000Z",
      }),
    ).toBe("signature request: completed");
    expect(
      currentProposalValue(
        proposal,
        matter({
          id: "matter-001",
          title: "Current title",
          parties: [
            {
              id: "party-001",
              firmId: "firm-west-legal",
              matterId: "matter-001",
              contactId: "contact-ada",
              role: "client",
              adverse: false,
              confidential: true,
              contact: {
                id: "contact-ada",
                firmId: "firm-west-legal",
                kind: "person",
                displayName: "Ada Morgan",
                aliases: [],
                identifiers: [],
              },
            },
          ],
        }),
      ),
    ).toBe("Current title");

    const data = await loadIntakeFormsDashboardData({
      matters: [matter({ id: "matter-001" }), matter({ id: "matter-002" })],
      listLinksForMatter: async (matterId) =>
        matterId === "matter-001"
          ? {
              links: [link],
              actionsByLinkId: {
                [link.id]: [
                  {
                    id: "action-001",
                    firmId: "firm-west-legal",
                    matterId: "matter-001",
                    intakeSessionId: "intake-session-001",
                    formLinkId: link.id,
                    itemId: "evidence-upload",
                    kind: "upload",
                    status: "uploaded",
                    evidence: {},
                    createdAt: "2026-04-29T12:00:00.000Z",
                  },
                ],
              },
            }
          : { links: [], actionsByLinkId: {} },
      listProposalsForMatter: async (matterId) => (matterId === "matter-001" ? [proposal] : []),
    });

    expect(data.linksByMatterId).toEqual({ "matter-001": [link], "matter-002": [] });
    expect(data.actionsByLinkId[link.id]).toEqual([
      expect.objectContaining({ itemId: "evidence-upload", status: "uploaded" }),
    ]);
    expect(data.proposalsByMatterId).toEqual({ "matter-001": [proposal], "matter-002": [] });
  });

  it("derives public runner visibility, action state, and API error messages", () => {
    const payload = publicRunnerPayload({
      actions: [
        {
          id: "action-001",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          intakeSessionId: "intake-session-001",
          formLinkId: "intake-form-link-001",
          itemId: "evidence-upload",
          kind: "upload",
          status: "uploaded",
          evidence: { contentType: "application/pdf" },
          createdAt: "2026-04-29T12:00:00.000Z",
        },
      ],
    });
    const visibleItemIds = visibleSections(payload, { issue_type: "deposit", urgent: false })
      .flatMap((section) => section.items)
      .map((item) => item.id);

    expect(visibleItemIds).toContain("evidence-upload");
    expect(visibleItemIds).not.toContain("repair-details-item");
    expect(actionComplete(payload.actions[0])).toBe(true);
    expect(
      itemAction(payload.actions, { id: "evidence-upload", kind: "upload", label: "Evidence" }),
    )?.toMatchObject({ status: "uploaded" });
    expect(coerceAnswer({ id: "urgent", label: "Urgent", type: "boolean" }, false)).toBe(false);
    expect(
      requiredIncompleteItemIds({
        code: "INTAKE_FORM_INCOMPLETE",
        details: { requiredIncompleteItemIds: ["client-attestation"] },
      }),
    ).toEqual(["client-attestation"]);
    expect(errorMessage({ message: "Upload type is not accepted" }, "fallback")).toBe(
      "Upload type is not accepted",
    );
  });

  it("loads optional legal clinic programs and matter profiles for dashboard summaries", async () => {
    const program = {
      id: "clinic-program-tenancy",
      firmId: "firm-west-legal",
      name: "Tenancy Clinic",
      status: "active" as const,
      serviceArea: "Residential tenancy",
      eligibilitySummary: "Low-income tenant eligibility screening.",
      defaultReferralSource: "community_partner",
      defaultReferralStatus: "referral_needed" as const,
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z",
      metadata: {
        fiscalHost: {
          hostName: "Synthetic Community Host",
          programCode: "TEN-STAB",
          reportingCadence: "monthly",
          bankAccount: "Private notes",
        },
      },
    };
    const profile = {
      id: "clinic-profile-001",
      firmId: "firm-west-legal",
      matterId: "matter-002",
      programId: program.id,
      eligibilityStatus: "likely_eligible" as const,
      referralSource: "community_partner",
      referralStatus: "referred" as const,
      referralDate: "2026-05-01",
      nextReviewDate: "2026-05-08T12:00:00.000Z",
      clinicRelationshipRole: "clinic client",
      notes: "Synthetic eligibility notes.",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z",
      updatedByUserId: "user-licensee",
      metadata: {
        restrictedFund: {
          fundCode: "RF-HOUSING-01",
          purpose: "Synthetic housing stability grant",
          reviewStatus: "staff_review_ready",
          nextReviewDate: "2026-05-20",
          privateReviewerNote: "raw private facts",
        },
      },
    };
    const profileCalls: string[] = [];

    const data = await loadLegalClinicDashboardData({
      matters: [matter({ id: "matter-001" }), matter({ id: "matter-002" })],
      listPrograms: async () => [program],
      listProfilesForMatter: async (matterId) => {
        profileCalls.push(matterId);
        return matterId === "matter-002" ? [profile] : [];
      },
    });

    expect(legalClinicProgramsPath).toBe("/api/legal-clinic/programs");
    expect(buildLegalClinicMatterProfilePath("matter 002")).toBe(
      "/api/legal-clinic/profiles?matterId=matter%20002",
    );
    expect(profileCalls).toEqual(["matter-001", "matter-002"]);
    expect(data.profilesByMatterId).toEqual({
      "matter-001": [],
      "matter-002": [profile],
    });
    expect(coerceLegalClinicProfilesResponse({ profile })).toEqual([profile]);
    expect(coerceLegalClinicProfilesResponse({ profile: null })).toEqual([]);
    expect(findLegalClinicProgram(data.programs, profile)).toEqual(program);
    expect(describeLegalClinicProgram(program, profile)).toBe("Tenancy Clinic");
    expect(describeLegalClinicProfileStatus(profile)).toBe("likely eligible / referred");
    const fiscalHost = fiscalHostWorkflowMetadata(program, profile);
    expect(fiscalHost).toEqual({
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
    expect(describeFiscalHostProgramMetadata(fiscalHost.programMetadata)).toBe(
      "Synthetic Community Host / TEN-STAB",
    );
    expect(describeRestrictedFundMetadata(fiscalHost.restrictedFundMetadata)).toBe(
      "RF-HOUSING-01 / staff_review_ready",
    );
    expect(JSON.stringify(fiscalHost)).not.toContain("Private notes");
    expect(JSON.stringify(fiscalHost)).not.toContain("raw private facts");
    expect(describeFiscalHostProgramMetadata({})).toBe("Fiscal-host metadata needs staff review.");
    expect(describeRestrictedFundMetadata({})).toBe("Restricted-fund metadata needs staff review.");
  });
});
