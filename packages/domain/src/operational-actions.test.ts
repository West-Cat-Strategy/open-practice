import { describe, expect, it } from "vitest";
import {
  compactMatterLifecycleReviewActionReason,
  compactTrustPostingRequestReviewActionReason,
  describeMatterLifecycleReviewAction,
  describeOperationalActionState,
  describeTrustPostingRequestReviewAction,
  disabledOperationalAction,
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
