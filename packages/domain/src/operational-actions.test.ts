import { describe, expect, it } from "vitest";
import {
  describeOperationalActionState,
  disabledOperationalAction,
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
});
