import { describe, expect, it } from "vitest";
import type { EmbeddedIntakeTemplateDefinition } from "@open-practice/domain";
import type { PublicIntakeFormPayload } from "./runner-utils";
import {
  answersFromDraft,
  canSubmitPublicIntakeForm,
  intakeFormAttentionItems,
  intakeLifecycleMessage,
  visibleSections,
} from "./runner-utils";
import { intakeFormWidgetKinds, intakeFormWidgetRegistry } from "./widget-registry";

const definition: Extract<EmbeddedIntakeTemplateDefinition, { schemaVersion: 2 }> = {
  schemaVersion: 2,
  questions: [
    { id: "client_name", label: "Client name", type: "text", required: true },
    { id: "urgent", label: "Urgent filing", type: "boolean" },
  ],
  branchRules: [],
  packages: [],
  sections: [
    {
      id: "client-basics",
      title: "Client basics",
      items: [
        { id: "intro", kind: "display", body: "Synthetic staff preview." },
        { id: "client-name-item", kind: "question", questionId: "client_name" },
        { id: "urgent-item", kind: "question", questionId: "urgent" },
        {
          id: "supporting-upload",
          kind: "upload",
          label: "Supporting upload",
          required: true,
        },
        {
          id: "client-attestation",
          kind: "signature",
          label: "Client attestation",
          required: true,
          consentText: "I agree to submit these synthetic answers.",
        },
      ],
    },
  ],
};

describe("shared intake renderer inputs", () => {
  it("registers renderer adapters for the current public intake item kinds", () => {
    expect(intakeFormWidgetKinds).toEqual(["display", "question", "upload", "signature"]);
    expect(Object.keys(intakeFormWidgetRegistry)).toEqual(intakeFormWidgetKinds);
    for (const kind of intakeFormWidgetKinds) {
      expect(intakeFormWidgetRegistry[kind]).toMatchObject({
        kind,
        render: expect.any(Function),
      });
    }
  });

  it("keeps public runner and staff preview on the same schema-v2 item set", () => {
    const publicRunnerSections = visibleSections(
      {
        link: {
          status: "active",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
        draft: null,
        review: null,
        template: {
          id: "template-001",
          name: "Synthetic intake",
          definitionVersion: 2,
          definition,
        },
        actions: [],
      },
      { client_name: "Ada M.", urgent: true },
    );
    const staffPreviewSections = visibleSections(
      {
        link: {
          status: "active",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
        draft: null,
        review: null,
        template: {
          id: "template-001",
          name: "Synthetic intake preview",
          definitionVersion: 2,
          definition,
        },
        actions: [],
      },
      { client_name: "Ada M.", urgent: true },
    );

    expect(publicRunnerSections).toEqual(staffPreviewSections);
    expect(publicRunnerSections.flatMap((section) => section.items.map((item) => item.id))).toEqual(
      ["intro", "client-name-item", "urgent-item", "supporting-upload", "client-attestation"],
    );
  });

  it("keeps public runner branch visibility unchanged for staff-authored rules", () => {
    const branchDefinition: Extract<EmbeddedIntakeTemplateDefinition, { schemaVersion: 2 }> = {
      ...definition,
      questions: [
        ...definition.questions,
        { id: "deadline", label: "Deadline", type: "date", required: true },
      ],
      branchRules: [
        {
          id: "urgent-deadline",
          questionId: "urgent",
          operator: "equals",
          value: true,
          showQuestionIds: ["deadline"],
        },
      ],
      sections: [
        {
          ...definition.sections[0]!,
          items: [
            ...definition.sections[0]!.items,
            { id: "deadline-item", kind: "question", questionId: "deadline" },
          ],
        },
      ],
    };
    const payload: PublicIntakeFormPayload = {
      link: {
        status: "active",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      draft: null,
      review: null,
      template: {
        id: "template-001",
        name: "Synthetic intake",
        definitionVersion: 2,
        definition: branchDefinition,
      },
      actions: [],
    };

    expect(
      visibleSections(payload, { client_name: "Ada M.", urgent: false }).flatMap((section) =>
        section.items.map((item) => item.id),
      ),
    ).not.toContain("deadline-item");
    expect(
      visibleSections(payload, { client_name: "Ada M.", urgent: true }).flatMap((section) =>
        section.items.map((item) => item.id),
      ),
    ).toContain("deadline-item");
  });

  it("restores only question-shaped draft answers and keeps receipts locked", () => {
    expect(
      answersFromDraft(definition, {
        client_name: "Ada M.",
        urgent: true,
        ignored: "not in this template",
      }),
    ).toEqual({ client_name: "Ada M.", urgent: true });

    expect(
      intakeLifecycleMessage({
        link: {
          status: "submitted",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
        draft: { answers: { client_name: "Ada M." }, updatedAt: "2026-01-01T00:00:00.000Z" },
        review: { decision: "request_more_info", decidedAt: "2026-01-02T00:00:00.000Z" },
        template: {
          id: "template-001",
          name: "Synthetic intake",
          definitionVersion: 2,
          definition,
        },
        actions: [],
      }),
    ).toContain("new secure link");
  });

  it("summarizes public intake actions and locks unsupported schema versions", () => {
    const activePayload = {
      link: {
        status: "active",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      draft: null,
      review: null,
      template: {
        id: "template-001",
        name: "Synthetic intake",
        definitionVersion: 2,
        definition,
      },
      actions: [],
    };

    expect(canSubmitPublicIntakeForm(activePayload)).toBe(true);
    expect(intakeFormAttentionItems(activePayload)).toEqual([
      {
        id: "intake-complete-form",
        title: "Complete intake form",
        detail: "Complete the requested answers and required items before submitting.",
        status: "open",
      },
    ]);

    const unsupportedPayload = {
      ...activePayload,
      template: {
        ...activePayload.template,
        definitionVersion: 1,
        definition: { schemaVersion: 1, questions: [] as never[] },
      },
    } as unknown as PublicIntakeFormPayload;

    expect(canSubmitPublicIntakeForm(unsupportedPayload)).toBe(false);
    expect(intakeFormAttentionItems(unsupportedPayload)).toEqual([
      {
        id: "intake-version-unavailable",
        title: "Form unavailable",
        detail: "This intake form version is not available for public completion.",
        status: "locked",
        tone: "risk",
      },
    ]);
  });
});
