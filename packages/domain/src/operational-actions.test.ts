import { describe, expect, it } from "vitest";
import {
  compactDocumentRetentionHoldReviewActionReason,
  compactLegalResearchArtifactReviewActionReason,
  compactMatterLifecycleReviewActionReason,
  compactTrustPostingRequestReviewActionReason,
  describeDocumentRetentionHoldReviewAction,
  describeLegalResearchArtifactReviewAction,
  describeMatterLifecycleReviewAction,
  describeOperationalActionState,
  describeTrustPostingRequestReviewAction,
  disabledOperationalAction,
  legalResearchArtifactReviewBusyAction,
  legalResearchArtifactReviewBusyKey,
  trustPostingRequestReviewBusyAction,
  trustPostingRequestReviewBusyKey,
} from "./operational-actions.js";

describe("operational action states", () => {
  it("describes available actions with the requested label and tone", () => {
    expect(
      describeOperationalActionState({
        actionKey: "document_processing.queue_ocr",
        label: "Queue OCR",
        availableLabel: "Retry OCR",
        availableTone: "risk",
        disabledWhen: [false, null, undefined],
      }),
    ).toEqual({
      actionKey: "document_processing.queue_ocr",
      available: true,
      availability: "available",
      label: "Retry OCR",
      tone: "risk",
    });
  });

  it("uses the first disabled condition as the action explanation", () => {
    expect(
      describeOperationalActionState({
        actionKey: "connector_outbox.dead_letter",
        label: "Dead-letter",
        disabledWhen: [
          false,
          disabledOperationalAction("active_lease", {
            label: "Wait for lease",
            tone: "risk",
          }),
          disabledOperationalAction("status_not_dead_letterable"),
        ],
      }),
    ).toEqual({
      actionKey: "connector_outbox.dead_letter",
      available: false,
      availability: "disabled",
      label: "Wait for lease",
      disabledReason: "active_lease",
      tone: "risk",
    });
  });

  it("falls back to the default disabled tone when a reason has no tone", () => {
    expect(
      describeOperationalActionState({
        actionKey: "connector_outbox.retry",
        label: "Retry",
        defaultDisabledTone: "risk",
        disabledWhen: [disabledOperationalAction("permission_required")],
      }),
    ).toMatchObject({
      available: false,
      availability: "disabled",
      disabledReason: "permission_required",
      tone: "risk",
    });
  });

  it("describes lifecycle review action labels and disabled states without matter data", () => {
    expect(
      describeMatterLifecycleReviewAction({
        action: "record_review",
        canRecord: true,
        recording: false,
      }),
    ).toEqual({
      actionKey: "matter_lifecycle_review.record",
      available: true,
      availability: "available",
      label: "Record review",
      tone: "ready",
    });

    expect(
      describeMatterLifecycleReviewAction({
        action: "record_review",
        canRecord: false,
        recording: false,
      }),
    ).toMatchObject({
      actionKey: "matter_lifecycle_review.record",
      available: false,
      availability: "disabled",
      label: "Record review",
      disabledReason: "permission_required",
    });

    const busyAction = describeMatterLifecycleReviewAction({
      action: "record_review",
      canRecord: true,
      recording: true,
    });
    expect(busyAction).toMatchObject({
      actionKey: "matter_lifecycle_review.record",
      available: false,
      availability: "disabled",
      label: "Recording",
      disabledReason: "record_review_in_progress",
    });

    expect(compactMatterLifecycleReviewActionReason("permission_required")).toBe(
      "permission required",
    );
    expect(compactMatterLifecycleReviewActionReason("record_review_in_progress")).toBe(
      "record review in progress",
    );

    const serialized = JSON.stringify(busyAction);
    expect(serialized).not.toContain("matter_lifecycle_synthetic");
    expect(serialized).not.toContain("Synthetic pause review");
    expect(serialized).not.toContain("Synthetic blocker evidence");
  });

  it("describes available legal research artifact review actions", () => {
    expect(
      describeLegalResearchArtifactReviewAction({
        action: "reviewed",
        status: "ready_for_review",
        canReview: true,
        workspaceStatus: "available",
      }),
    ).toEqual({
      actionKey: "legal_research_artifact.review",
      available: true,
      availability: "available",
      label: "Review",
      tone: "ready",
    });

    expect(
      describeLegalResearchArtifactReviewAction({
        action: "rejected",
        status: "ready_for_review",
        canReview: true,
        workspaceStatus: "available",
      }),
    ).toEqual({
      actionKey: "legal_research_artifact.reject",
      available: true,
      availability: "available",
      label: "Reject",
      tone: "risk",
    });
  });

  it("describes legal research artifact review busy states without artifact data", () => {
    const busyKey = legalResearchArtifactReviewBusyKey(
      "reviewed",
      "legal_research_artifact_synthetic",
    );

    expect(
      legalResearchArtifactReviewBusyAction(busyKey, "legal_research_artifact_synthetic"),
    ).toBe("reviewed");
    expect(
      legalResearchArtifactReviewBusyAction("", "legal_research_artifact_synthetic"),
    ).toBeUndefined();
    expect(
      legalResearchArtifactReviewBusyAction(
        "archived:legal_research_artifact_synthetic",
        "legal_research_artifact_synthetic",
      ),
    ).toBe("other");

    const busyAction = describeLegalResearchArtifactReviewAction({
      action: "reviewed",
      status: "ready_for_review",
      busyAction: "reviewed",
      canReview: true,
      workspaceStatus: "available",
    });
    expect(busyAction).toMatchObject({
      actionKey: "legal_research_artifact.review",
      available: false,
      availability: "disabled",
      label: "Saving",
      disabledReason: "reviewed_in_progress",
    });

    expect(
      describeLegalResearchArtifactReviewAction({
        action: "rejected",
        status: "ready_for_review",
        busyAction: "reviewed",
        canReview: true,
        workspaceStatus: "available",
      }),
    ).toMatchObject({
      actionKey: "legal_research_artifact.reject",
      available: false,
      availability: "disabled",
      label: "Reject",
      disabledReason: "review_action_in_progress",
    });

    expect(
      describeLegalResearchArtifactReviewAction({
        action: "rejected",
        status: "ready_for_review",
        busyAction: "rejected",
        canReview: true,
        workspaceStatus: "available",
      }),
    ).toMatchObject({
      label: "Saving",
      disabledReason: "rejected_in_progress",
    });

    const serialized = JSON.stringify(busyAction);
    expect(serialized).not.toContain("legal_research_artifact_synthetic");
    expect(serialized).not.toContain("Synthetic staff-authored source note");
    expect(serialized).not.toContain("Residential tenancy source note");
    expect(serialized).not.toContain("raw authority text");
  });

  it("describes unavailable legal research artifact review states", () => {
    expect(
      describeLegalResearchArtifactReviewAction({
        action: "reviewed",
        status: "ready_for_review",
        canReview: false,
        workspaceStatus: "available",
      }),
    ).toMatchObject({
      actionKey: "legal_research_artifact.review",
      available: false,
      availability: "disabled",
      label: "Review",
      disabledReason: "permission_required",
    });

    expect(
      describeLegalResearchArtifactReviewAction({
        action: "reviewed",
        status: "draft",
        canReview: true,
        workspaceStatus: "available",
      }),
    ).toMatchObject({
      actionKey: "legal_research_artifact.review",
      available: false,
      availability: "disabled",
      label: "Review",
      disabledReason: "status_not_ready_for_review",
    });

    expect(
      describeLegalResearchArtifactReviewAction({
        action: "rejected",
        status: "ready_for_review",
        canReview: true,
        workspaceStatus: "unavailable",
      }),
    ).toMatchObject({
      actionKey: "legal_research_artifact.reject",
      available: false,
      availability: "disabled",
      label: "Reject",
      disabledReason: "workspace_unavailable",
    });

    expect(compactLegalResearchArtifactReviewActionReason("reviewed_in_progress")).toBe(
      "review in progress",
    );
    expect(compactLegalResearchArtifactReviewActionReason("rejected_in_progress")).toBe(
      "rejection in progress",
    );
    expect(compactLegalResearchArtifactReviewActionReason("review_action_in_progress")).toBe(
      "review action in progress",
    );
    expect(compactLegalResearchArtifactReviewActionReason("permission_required")).toBe(
      "permission required",
    );
    expect(compactLegalResearchArtifactReviewActionReason("status_not_ready_for_review")).toBe(
      "not ready for review",
    );
    expect(compactLegalResearchArtifactReviewActionReason("workspace_unavailable")).toBe(
      "workspace unavailable",
    );
  });

  it("describes document retention and hold review actions without document data", () => {
    expect(
      describeDocumentRetentionHoldReviewAction({
        action: "record_review",
        label: "needs review",
      }),
    ).toEqual({
      actionKey: "document_retention_hold_review.record",
      available: true,
      availability: "available",
      label: "needs review",
      tone: "ready",
    });

    const busyAction = describeDocumentRetentionHoldReviewAction({
      action: "record_review",
      label: "blocked by hold",
      busyAction: "record_review",
    });
    expect(busyAction).toMatchObject({
      actionKey: "document_retention_hold_review.record",
      available: false,
      availability: "disabled",
      label: "Recording",
      disabledReason: "retention_hold_review_in_progress",
    });

    expect(
      describeDocumentRetentionHoldReviewAction({
        action: "record_review",
        label: "ready for reviewer packet",
        busyAction: "other",
      }),
    ).toMatchObject({
      actionKey: "document_retention_hold_review.record",
      available: false,
      availability: "disabled",
      label: "ready for reviewer packet",
      disabledReason: "review_action_in_progress",
    });

    expect(
      compactDocumentRetentionHoldReviewActionReason("retention_hold_review_in_progress"),
    ).toBe("retention/hold review in progress");
    expect(compactDocumentRetentionHoldReviewActionReason("review_action_in_progress")).toBe(
      "review action in progress",
    );

    const serialized = JSON.stringify(busyAction);
    expect(serialized).not.toContain("doc_retention_synthetic");
    expect(serialized).not.toContain("Synthetic retention packet");
    expect(serialized).not.toContain("legal_hold");
    expect(serialized).not.toContain("minimumRetainThrough");
  });

  it("describes available trust posting request review actions", () => {
    expect(
      describeTrustPostingRequestReviewAction({
        action: "approved",
        status: "pending_approval",
      }),
    ).toEqual({
      actionKey: "ledger_posting_request.approve",
      available: true,
      availability: "available",
      label: "Approve",
      tone: "ready",
    });

    expect(
      describeTrustPostingRequestReviewAction({
        action: "rejected",
        status: "pending_approval",
      }),
    ).toEqual({
      actionKey: "ledger_posting_request.reject",
      available: true,
      availability: "available",
      label: "Reject",
      tone: "risk",
    });
  });

  it("describes trust posting request review busy states without request data", () => {
    const busyKey = trustPostingRequestReviewBusyKey("approved", "posting_request_synthetic");

    expect(trustPostingRequestReviewBusyAction(busyKey, "posting_request_synthetic")).toBe(
      "approved",
    );
    expect(trustPostingRequestReviewBusyAction("", "posting_request_synthetic")).toBeUndefined();
    expect(
      trustPostingRequestReviewBusyAction(
        "archived:posting_request_synthetic",
        "posting_request_synthetic",
      ),
    ).toBe("other");

    expect(
      describeTrustPostingRequestReviewAction({
        action: "approved",
        status: "pending_approval",
        busyAction: "approved",
      }),
    ).toMatchObject({
      available: false,
      availability: "disabled",
      label: "Approving",
      disabledReason: "approved_in_progress",
    });

    expect(
      describeTrustPostingRequestReviewAction({
        action: "rejected",
        status: "pending_approval",
        busyAction: "approved",
      }),
    ).toMatchObject({
      available: false,
      availability: "disabled",
      label: "Reject",
      disabledReason: "review_action_in_progress",
    });

    const serialized = JSON.stringify(
      describeTrustPostingRequestReviewAction({
        action: "approved",
        status: "pending_approval",
        busyAction: "approved",
      }),
    );
    expect(serialized).not.toContain("posting_request_synthetic");
    expect(serialized).not.toContain("Synthetic preparation note");
    expect(serialized).not.toContain("Synthetic rejection reason");
  });

  it("describes unavailable trust posting request review actions", () => {
    expect(
      describeTrustPostingRequestReviewAction({
        action: "approved",
        status: "posted",
      }),
    ).toMatchObject({
      actionKey: "ledger_posting_request.approve",
      available: false,
      availability: "disabled",
      label: "Approve",
      disabledReason: "status_not_pending_approval",
    });

    expect(
      describeTrustPostingRequestReviewAction({
        action: "rejected",
        status: "rejected",
      }),
    ).toMatchObject({
      actionKey: "ledger_posting_request.reject",
      available: false,
      availability: "disabled",
      label: "Reject",
      disabledReason: "status_not_pending_approval",
    });

    expect(compactTrustPostingRequestReviewActionReason("approved_in_progress")).toBe(
      "approval in progress",
    );
    expect(compactTrustPostingRequestReviewActionReason("review_action_in_progress")).toBe(
      "review action in progress",
    );
    expect(compactTrustPostingRequestReviewActionReason("status_not_pending_approval")).toBe(
      "not pending approval",
    );
  });
});
