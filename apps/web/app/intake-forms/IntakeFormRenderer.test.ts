import { describe, expect, it } from "vitest";
import type { EmbeddedIntakeTemplateDefinition } from "@open-practice/domain";
import { answersFromDraft, intakeLifecycleMessage, visibleSections } from "./runner-utils";

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
  it("keeps public runner and staff preview on the same schema-v2 item set", () => {
    const publicRunnerSections = visibleSections(
      {
        link: {
          id: "link-001",
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
          id: "preview-link",
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
          id: "submitted-link",
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
});
