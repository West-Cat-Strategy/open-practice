import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DocumentAssemblyWorkbenchResponse } from "../_features/document-assembly/models";
import type { DocumentProcessingWorkbenchResponse } from "../_features/document-processing/models";
import {
  documentMetadataSearchFilterCount,
  summarizeDocumentMetadataSearch,
  summarizeDocumentProcessingWorkbench,
  summarizeDocumentReviewSuggestions,
} from "../document-processing-dashboard";
import { DocumentsSection } from "./documents-section";

function noop(): void {}

function buildSyntheticDocumentProcessingWorkbench(): DocumentProcessingWorkbenchResponse {
  return {
    matterId: "matter_synthetic",
    status: "configured",
    providerStatus: [
      {
        kind: "ocr",
        status: "configured",
        reason: "synthetic_provider_ready",
        providers: [{ key: "synthetic_ocr", enabled: true }],
      },
    ],
    workerQueues: [
      { queueName: "ocr", status: "configured" },
      { queueName: "ai_triage", status: "reserved", reason: "deferred_worker" },
    ],
    reservedQueues: [{ queueName: "ai_triage", status: "reserved", reason: "deferred_worker" }],
    actionableTasks: ["ocr"],
    reservedTasks: [{ task: "classification", queueName: "ai_triage", status: "reserved" }],
    summary: { total: 1, queued: 0, active: 0, failed: 0, terminal: 1, byQueue: [] },
    metadataSearch: {
      reviewOnly: true,
      mutating: false,
      filters: { q: "synthetic", classification: "general" },
      totalCount: 1,
      matchedCount: 1,
      tags: [
        {
          key: "classification:general",
          label: "Classification: general",
          value: "general",
          group: "classification",
          tone: "neutral",
          count: 1,
        },
        {
          key: "cue:classification",
          label: "Cue: classification",
          value: "classification",
          group: "reviewer_cue",
          tone: "neutral",
          count: 1,
        },
      ],
      ocrPosture: {
        rawTextSearch: false,
        rawTextReturned: false,
        searchableFields: ["document_title", "op_authored_metadata", "reviewer_cue_labels"],
        statusCounts: { not_available: 0, queued: 0, completed: 1, failed: 0 },
      },
      results: [
        {
          documentId: "doc_synthetic",
          title: "Synthetic tenancy evidence",
          matterId: "matter_synthetic",
          classification: "general",
          reviewStatus: "accepted",
          scanStatus: "passed",
          legalHold: false,
          ocrStatus: "completed",
          tagKeys: ["classification:general", "cue:classification"],
          matchedFields: [],
          cueCounts: {
            classification: 1,
            duplicate_or_supersession: 0,
            matter_contact: 1,
            missing_metadata: 0,
            retention_review: 0,
            total: 2,
          },
        },
      ],
    },
    documents: [
      {
        document: {
          id: "doc_synthetic",
          matterId: "matter_synthetic",
          title: "Synthetic tenancy evidence",
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
          id: "job_synthetic",
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
        conversionReview: {
          posture: "ready_for_review",
          summaryPosture: "op_authored_metadata_only",
          jobId: "job_conversion_review_synthetic",
          artifactId: "artifact_conversion_review_synthetic",
          counts: {
            sourceTextLength: 1800,
            wordCount: 260,
            estimatedPageCount: 1,
          },
          policy: {
            metadataOnly: true,
            reviewOnly: true,
            rawOcrTextStored: false,
            rawMarkdownStored: false,
            annotationBodiesStored: false,
            chunksStored: false,
            embeddingsStored: false,
            providerPayloadsStored: false,
          },
        },
        reviewSuggestions: {
          reviewerOnly: true,
          mutating: false,
          summaryCounts: {
            classification: 1,
            duplicate_or_supersession: 0,
            matter_contact: 1,
            missing_metadata: 0,
            retention_review: 0,
            total: 2,
          },
          groups: {
            classification: [
              {
                id: "doc_synthetic:classification",
                group: "classification",
                label: "Extraction suggests financial",
                detail: "Current classification is general.",
                tone: "risk",
                documentId: "doc_synthetic",
                classification: "financial",
                confidence: 0.88,
                metadataKeys: ["suggestedClassification"],
              },
            ],
            duplicate_or_supersession: [],
            matter_contact: [
              {
                id: "doc_synthetic:matter",
                group: "matter_contact",
                label: "Synthetic matter context",
                detail: "Synthetic matter cue",
                tone: "neutral",
                documentId: "doc_synthetic",
              },
            ],
            missing_metadata: [],
            retention_review: [],
          },
        },
        retentionHoldReview: {
          reviewerOnly: true,
          mutating: false,
          destructiveAction: false,
          retentionDeadlineEnforced: false,
          legalHoldOverride: false,
          retainedExportBody: false,
          status: "needs_review",
          blockers: [],
          sourceCueCounts: {
            classification: 1,
            duplicate_or_supersession: 0,
            matter_contact: 1,
            missing_metadata: 0,
            retention_review: 0,
            total: 2,
          },
        },
        metadataTags: [
          {
            key: "classification:general",
            label: "Classification: general",
            value: "general",
            group: "classification",
            tone: "neutral",
            count: 1,
          },
          {
            key: "cue:classification",
            label: "Cue: classification",
            value: "classification",
            group: "reviewer_cue",
            tone: "neutral",
            count: 1,
          },
        ],
      },
    ],
  };
}

const syntheticAssemblyWorkbench: DocumentAssemblyWorkbenchResponse = {
  status: "available",
  matterId: "matter_synthetic",
  definitions: [],
  packages: [],
  summary: {
    packageCount: 0,
    activeDefinitionCount: 0,
    blockedPackageCount: 0,
    envelopeCount: 0,
    validEnvelopeCount: 0,
  },
};

type DocumentsSectionRenderProps = Parameters<typeof DocumentsSection>[0];

function buildDocumentsSectionProps(
  overrides: Partial<DocumentsSectionRenderProps> = {},
): DocumentsSectionRenderProps {
  const workbench = buildSyntheticDocumentProcessingWorkbench();
  return {
    activeDocumentAssembly: syntheticAssemblyWorkbench,
    activeDocumentMetadataFilterCount: documentMetadataSearchFilterCount(
      workbench.metadataSearch?.filters,
    ),
    activeDocumentMetadataTags: workbench.metadataSearch?.tags ?? [],
    activeDocumentProcessing: workbench,
    activeDocumentProcessingRows: workbench.documents,
    activeMatterNumber: "OP-SYN-001",
    documentMetadataClassificationFilter: "general",
    documentMetadataCueGroupFilter: "",
    documentMetadataOcrStatusFilter: "",
    documentMetadataQuery: "synthetic",
    documentMetadataReviewStatusFilter: "",
    documentMetadataScanStatusFilter: "",
    documentMetadataSearchSummary: summarizeDocumentMetadataSearch(workbench.metadataSearch),
    documentProcessingStatus: "Document processing loaded.",
    documentProcessingSummary: summarizeDocumentProcessingWorkbench(workbench),
    documentReviewSuggestionsSummary: summarizeDocumentReviewSuggestions(workbench.documents),
    portalDocumentAccess: [],
    portalDocumentAccessBusyId: "",
    portalDocumentAccessStatus: "No files are visible to this portal contact.",
    queueingDocumentId: "",
    retentionHoldReviewBusyId: "",
    selectedClientPortalContactId: "contact_synthetic",
    selectedClientPortalContactLabel: "Ada Morgan",
    onClearDocumentMetadataSearch: noop,
    onDocumentMetadataClassificationFilterChange: noop,
    onDocumentMetadataCueGroupFilterChange: noop,
    onDocumentMetadataOcrStatusFilterChange: noop,
    onDocumentMetadataQueryChange: noop,
    onDocumentMetadataReviewStatusFilterChange: noop,
    onDocumentMetadataScanStatusFilterChange: noop,
    onGrantPortalDocumentAccess: noop,
    onQueueDocumentOcr: noop,
    onRecordRetentionHoldDecision: noop,
    onRefreshDocumentMetadataSearch: noop,
    onRevokePortalDocumentAccess: noop,
    onSelectDocumentMetadataTag: noop,
    ...overrides,
  };
}

describe("DocumentsSection", () => {
  it("renders the document-processing workbench without changing copy or classes", () => {
    const html = renderToStaticMarkup(
      createElement(
        DocumentsSection,
        buildDocumentsSectionProps({
          portalDocumentAccess: [
            {
              id: "portal-document-access-synthetic",
              firmId: "firm_synthetic",
              matterId: "matter_synthetic",
              documentId: "doc_synthetic",
              portalGrantId: "portal-grant-synthetic",
              permission: "view_document",
              grantedByUserId: "user_synthetic",
              createdAt: "2026-06-13T10:00:00.000Z",
              expiresAt: "2099-01-01T00:00:00.000Z",
            },
          ],
          portalDocumentAccessStatus: "1 file visibility row loaded.",
        }),
      ),
    );

    expect(html).toContain('class="detail-grid"');
    expect(html).toContain("Workbench");
    expect(html).toContain("Provider state");
    expect(html).toContain("Worker queues");
    expect(html).toContain("Document assembly");
    expect(html).toContain("Metadata search");
    expect(html).toContain("Classification");
    expect(html).toContain("2 active filters");
    expect(html).toContain("Search");
    expect(html).toContain("Clear");
    expect(html).toContain("Document metadata tags");
    expect(html).toContain("Classification: general");
    expect(html).toContain("Synthetic tenancy evidence");
    expect(html).toContain("Metadata posture match");
    expect(html).toContain("Providers and workers");
    expect(html).toContain("OP-SYN-001");
    expect(html).toContain("Document processing workbench");
    expect(html).toContain("1 portal-visible");
    expect(html).toContain("Portal visibility for Ada Morgan");
    expect(html).toContain("Revoke portal");
    expect(html).toContain("Ready to process");
    expect(html).toContain(
      "Conversion review ready for review · 1800 chars · 260 words · 1 estimated pages · artifact ready · OP-authored metadata only · metadata only",
    );
    expect(html).toContain("Reviewer suggestions");
    expect(html).toContain("Extraction suggests financial");
    expect(html).toContain("Retention/hold needs review");
    expect(html).toContain("no deletion");
    expect(html).toContain("Queue OCR");
    expect(html).toContain("needs review");
    expect(html).toContain('data-action-key="document_retention_hold_review.record"');
    expect(html).toContain('aria-label="needs review"');
    expect(html).toContain("No document assembly packages are linked to this matter.");
  });

  it("renders a portal grant action when the selected client has no file visibility", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentsSection, buildDocumentsSectionProps()),
    );

    expect(html).toContain("Portal visibility for Ada Morgan");
    expect(html).toContain("No files are visible to this portal contact.");
    expect(html).toContain("Grant portal");
    expect(html).not.toContain("Revoke portal");
  });

  it("renders descriptor-backed retention and hold review busy states", () => {
    const workbench = buildSyntheticDocumentProcessingWorkbench();
    const firstDocument = workbench.documents[0];
    expect(firstDocument).toBeDefined();
    const secondDocument = {
      ...firstDocument!,
      document: {
        ...firstDocument!.document,
        id: "doc_synthetic_other",
        title: "Synthetic second tenancy evidence",
      },
    };
    const rows = [firstDocument!, secondDocument];
    const html = renderToStaticMarkup(
      createElement(
        DocumentsSection,
        buildDocumentsSectionProps({
          activeDocumentProcessing: { ...workbench, documents: rows },
          activeDocumentProcessingRows: rows,
          retentionHoldReviewBusyId: "doc_synthetic",
        }),
      ),
    );

    expect(html).toContain('data-action-key="document_retention_hold_review.record"');
    expect(html).toContain('aria-label="Recording: retention/hold review in progress"');
    expect(html).toContain('aria-label="needs review: review action in progress"');
    expect(html).toContain(">Recording</button>");
    expect(html.match(/data-action-key="document_retention_hold_review\.record"/g)).toHaveLength(2);
    expect(
      html.match(/data-action-key="document_retention_hold_review\.record" disabled=""/g),
    ).toHaveLength(2);
    expect(html).toContain("Retention/hold needs review");
    expect(html).toContain("no deletion");
    expect(html).toContain("Grant portal");
  });
});
