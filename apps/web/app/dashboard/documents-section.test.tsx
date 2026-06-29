import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DocumentAssemblyWorkbenchResponse } from "../_features/document-assembly/models";
import type { DocumentProcessingWorkbenchResponse } from "../_features/document-processing/models";
import {
  documentMetadataSearchFilterCount,
  describeDocumentConversionReview,
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
          posture: "reviewed",
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
            internalExtractedTextStored: true,
            rawOcrTextStored: false,
            rawOcrTextStoredInMetadata: false,
            rawOcrTextReturned: false,
            rawMarkdownStored: false,
            annotationBodiesStored: false,
            chunksStored: false,
            embeddingsStored: false,
            providerPayloadsStored: false,
          },
          reviewReadiness: {
            status: "reviewed",
            artifactStatus: "metadata_only",
            reviewedAt: "2026-06-26T18:30:00.000Z",
            staffReviewRequired: true,
            terminalReview: true,
            reviewOnly: true,
            metadataOnly: true,
            downstreamMutation: false,
            providerEvidenceStored: false,
            rawOcrTextReturned: false,
          },
          latestDecision: {
            artifactId: "artifact_conversion_review_synthetic",
            decision: "reviewed",
            decidedAt: "2026-06-26T18:30:00.000Z",
            decidedByUserId: "user_synthetic",
            artifactStatus: "metadata_only",
            reviewOnly: true,
            metadataOnly: true,
            terminalReview: true,
            downstreamMutation: false,
            providerEvidenceStored: false,
            rawOcrTextReturned: false,
          },
          decisionHistory: [
            {
              artifactId: "artifact_conversion_review_synthetic",
              decision: "reviewed",
              decidedAt: "2026-06-26T18:30:00.000Z",
              decidedByUserId: "user_synthetic",
              artifactStatus: "metadata_only",
              reviewOnly: true,
              metadataOnly: true,
              terminalReview: true,
              downstreamMutation: false,
              providerEvidenceStored: false,
              rawOcrTextReturned: false,
            },
          ],
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
          dispositionMetadata: {
            candidateState: "not_ready",
            readyForReviewerPacket: false,
            blockerCounts: { total: 0, legalHold: 0, uploadIntegrity: 0, reviewState: 0 },
            sourceCueCounts: {
              classification: 1,
              duplicate_or_supersession: 0,
              matter_contact: 1,
              missing_metadata: 0,
              retention_review: 0,
              total: 2,
            },
            destructiveAction: false,
            objectDeletion: false,
            retentionDeadlineEnforced: false,
            legalHoldReleaseCommand: false,
            retainedExportBody: false,
            rawPayloadRetention: false,
            complianceClaim: false,
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
      "Conversion review reviewed · 1800 chars · 260 words · 1 estimated pages · artifact metadata only · OP-authored metadata only · metadata only · latest decision reviewed at 2026-06-26T18:30:00.000Z · reviewer user_synthetic · 1 decision cue · decision metadata only · decision review only · decision no downstream mutation · decision no provider evidence · decision no raw OCR returned · readiness reviewed · reviewed 2026-06-26T18:30:00.000Z · staff review required · terminal review · review only · no downstream mutation · no provider evidence · no raw OCR returned",
    );
    expect(html).toContain("Reviewer suggestions");
    expect(html).toContain("Extraction suggests financial");
    expect(html).toContain("Retention/hold needs review");
    expect(html).toContain(
      "disposition not ready · 0 blockers · 0 hold · 0 integrity · 0 review · no deletion · no deadline enforcement",
    );
    expect(html).toContain("no deletion");
    expect(html).toContain("no deadline enforcement");
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

  it("renders scheduled disposition reviewer-packet metadata without adding controls", () => {
    const workbench = buildSyntheticDocumentProcessingWorkbench();
    const firstDocument = workbench.documents[0];
    expect(firstDocument).toBeDefined();
    const scheduledDocument = {
      ...firstDocument!,
      retentionHoldReview: {
        ...firstDocument!.retentionHoldReview!,
        status: "ready_for_reviewer_packet" as const,
        latestDecision: {
          decision: "ready_for_reviewer_packet" as const,
          reason: "practice_review" as const,
          reviewAfter: "2026-07-01T00:00:00.000Z",
          minimumRetainThrough: "2026-08-01T00:00:00.000Z",
          recordedByUserId: "user_synthetic",
          recordedAt: "2026-06-29T10:00:00.000Z",
          sourceCueCounts: firstDocument!.retentionHoldReview!.sourceCueCounts,
        },
        dispositionMetadata: {
          ...firstDocument!.retentionHoldReview!.dispositionMetadata,
          candidateState: "ready_for_reviewer_packet" as const,
          readyForReviewerPacket: true,
          reviewAfter: "2026-07-01T00:00:00.000Z",
          minimumRetainThrough: "2026-08-01T00:00:00.000Z",
        },
      },
    };
    const html = renderToStaticMarkup(
      createElement(
        DocumentsSection,
        buildDocumentsSectionProps({
          activeDocumentProcessing: { ...workbench, documents: [scheduledDocument] },
          activeDocumentProcessingRows: [scheduledDocument],
        }),
      ),
    );

    expect(html).toContain("Retention/hold ready for reviewer packet");
    expect(html).toContain("disposition ready for reviewer packet");
    expect(html).toContain("review after 2026-07-01T00:00:00.000Z");
    expect(html).toContain("retain through 2026-08-01T00:00:00.000Z");
    expect(html).toContain("no deletion");
    expect(html).toContain("no deadline enforcement");
    expect(html.match(/data-action-key="document_retention_hold_review\.record"/g)).toHaveLength(1);
  });

  it("describes rejected conversion review readiness without exposing provider evidence", () => {
    expect(
      describeDocumentConversionReview({
        posture: "rejected",
        summaryPosture: "op_authored_metadata_only",
        artifactId: "artifact_conversion_review_rejected",
        policy: {
          metadataOnly: true,
          reviewOnly: true,
          internalExtractedTextStored: true,
          rawOcrTextStored: false,
          rawOcrTextStoredInMetadata: false,
          rawOcrTextReturned: false,
          rawMarkdownStored: false,
          annotationBodiesStored: false,
          chunksStored: false,
          embeddingsStored: false,
          providerPayloadsStored: false,
        },
        reviewReadiness: {
          status: "rejected",
          artifactStatus: "metadata_only",
          reviewedAt: "2026-06-26T18:35:00.000Z",
          staffReviewRequired: true,
          terminalReview: true,
          reviewOnly: true,
          metadataOnly: true,
          downstreamMutation: false,
          providerEvidenceStored: false,
          rawOcrTextReturned: false,
        },
        latestDecision: {
          artifactId: "artifact_conversion_review_rejected",
          decision: "rejected",
          decidedAt: "2026-06-26T18:35:00.000Z",
          decidedByUserId: "user_synthetic",
          artifactStatus: "metadata_only",
          reviewOnly: true,
          metadataOnly: true,
          terminalReview: true,
          downstreamMutation: false,
          providerEvidenceStored: false,
          rawOcrTextReturned: false,
        },
        decisionHistory: [
          {
            artifactId: "artifact_conversion_review_rejected",
            decision: "rejected",
            decidedAt: "2026-06-26T18:35:00.000Z",
            decidedByUserId: "user_synthetic",
            artifactStatus: "metadata_only",
            reviewOnly: true,
            metadataOnly: true,
            terminalReview: true,
            downstreamMutation: false,
            providerEvidenceStored: false,
            rawOcrTextReturned: false,
          },
        ],
      }),
    ).toBe(
      "rejected · artifact metadata only · OP-authored metadata only · metadata only · latest decision rejected at 2026-06-26T18:35:00.000Z · reviewer user_synthetic · 1 decision cue · decision metadata only · decision review only · decision no downstream mutation · decision no provider evidence · decision no raw OCR returned · readiness rejected · reviewed 2026-06-26T18:35:00.000Z · staff review required · terminal review · review only · no downstream mutation · no provider evidence · no raw OCR returned",
    );
  });
});
