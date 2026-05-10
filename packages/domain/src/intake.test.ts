import { describe, expect, it } from "vitest";
import {
  buildEmbeddedIntakeTemplateQaReport,
  createIntakeVariableProposals,
  resolveEmbeddedIntakeAnswers,
  validateEmbeddedIntakeTemplateDefinition,
  type EmbeddedIntakeTemplateDefinition,
} from "./intake.js";
import { sampleResidentialTenancyIntakeDefinition } from "./sample-data.js";

describe("embedded intake templates", () => {
  it("validates the seeded residential tenancy definition", () => {
    expect(validateEmbeddedIntakeTemplateDefinition(sampleResidentialTenancyIntakeDefinition)).toBe(
      sampleResidentialTenancyIntakeDefinition,
    );
  });

  it("rejects duplicate IDs and unknown branch references", () => {
    const duplicateQuestions: EmbeddedIntakeTemplateDefinition = {
      schemaVersion: 1,
      questions: [
        { id: "issue", label: "Issue", type: "text" },
        { id: "issue", label: "Issue again", type: "text" },
      ],
      branchRules: [],
      packages: [{ id: "base", title: "Base", documents: [{ id: "doc", title: "Doc" }] }],
    };
    const unknownPackage: EmbeddedIntakeTemplateDefinition = {
      schemaVersion: 1,
      questions: [{ id: "issue", label: "Issue", type: "text" }],
      branchRules: [
        {
          id: "unknown-package",
          questionId: "issue",
          operator: "present",
          eligiblePackageIds: ["missing"],
        },
      ],
      packages: [{ id: "base", title: "Base", documents: [{ id: "doc", title: "Doc" }] }],
    };

    expect(() => validateEmbeddedIntakeTemplateDefinition(duplicateQuestions)).toThrow(
      "Duplicate embedded intake question id issue",
    );
    expect(() => validateEmbeddedIntakeTemplateDefinition(unknownPackage)).toThrow(
      "Branch rule unknown-package references unknown package missing",
    );
  });

  it("resolves visible questions and package documents from answers", () => {
    const resolution = resolveEmbeddedIntakeAnswers({
      templateId: "intake-template-001",
      templateVersion: 2,
      definition: sampleResidentialTenancyIntakeDefinition,
      answers: { issue_type: "repair", urgent: true },
      completedItemIds: ["evidence-upload", "client-attestation"],
    });

    expect(resolution).toMatchObject({
      templateId: "intake-template-001",
      templateVersion: 2,
      visibleQuestionIds: expect.arrayContaining(["issue_type", "urgent", "repair_details"]),
      visibleFormItemIds: expect.arrayContaining([
        "issue-type-item",
        "evidence-upload",
        "client-attestation",
      ]),
      requiredIncompleteItemIds: [],
      matchedBranchRuleIds: expect.arrayContaining(["repair-package", "urgent-review-package"]),
      eligiblePackageIds: expect.arrayContaining([
        "repair_notice_package",
        "urgent_review_package",
      ]),
      selectedPackageIds: expect.arrayContaining([
        "repair_notice_package",
        "urgent_review_package",
      ]),
      packageDocuments: expect.arrayContaining([
        {
          packageId: "repair_notice_package",
          packageDocumentId: "repair_notice_letter",
          title: "Repair notice letter",
        },
        {
          packageId: "urgent_review_package",
          packageDocumentId: "urgent_review_memo",
          title: "Urgent review memo",
        },
      ]),
      packageSummaries: expect.arrayContaining([
        expect.objectContaining({
          packageId: "repair_notice_package",
          title: "Repair notice package",
          documentCount: 2,
          documentIds: ["repair_notice_letter", "client_instruction_summary"],
        }),
        expect.objectContaining({
          packageId: "urgent_review_package",
          title: "Urgent review package",
          documentCount: 1,
          documentIds: ["urgent_review_memo"],
        }),
      ]),
    });
  });

  it("keeps branch-only questions hidden until their branch matches", () => {
    const resolution = resolveEmbeddedIntakeAnswers({
      templateId: "intake-template-001",
      templateVersion: 2,
      definition: sampleResidentialTenancyIntakeDefinition,
      answers: { issue_type: "deposit", urgent: false },
    });

    expect(resolution.visibleQuestionIds).toEqual([
      "issue_type",
      "urgent",
      "client_display_name",
      "matter_title",
    ]);
    expect(resolution.matchedBranchRuleIds).toEqual([]);
    expect(resolution.visibleQuestionIds).not.toContain("repair_details");
  });

  it("tracks required upload and signature form items independently from answers", () => {
    const incomplete = resolveEmbeddedIntakeAnswers({
      templateId: "intake-template-001",
      templateVersion: 2,
      definition: sampleResidentialTenancyIntakeDefinition,
      answers: { issue_type: "repair", urgent: true },
    });
    const complete = resolveEmbeddedIntakeAnswers({
      templateId: "intake-template-001",
      templateVersion: 2,
      definition: sampleResidentialTenancyIntakeDefinition,
      answers: { issue_type: "repair", urgent: true },
      completedItemIds: ["evidence-upload", "client-attestation"],
    });

    expect(incomplete.requiredIncompleteItemIds).toEqual(["evidence-upload", "client-attestation"]);
    expect(complete.requiredIncompleteItemIds).toEqual([]);
  });

  it("builds staff QA previews with branch coverage and non-mutating issue cues", () => {
    const report = buildEmbeddedIntakeTemplateQaReport({
      templateId: "intake-template-001",
      templateVersion: 2,
      definition: sampleResidentialTenancyIntakeDefinition,
    });

    expect(report.summary).toMatchObject({
      schemaVersion: 2,
      branchRuleCount: 2,
      previewCount: 3,
      blockingIssueCount: 0,
    });
    expect(report.previews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "base",
          matchedBranchRuleIds: [],
          visibleQuestionIds: expect.arrayContaining(["issue_type", "urgent"]),
        }),
        expect.objectContaining({
          id: "branch:repair-package",
          matchedBranchRuleIds: ["repair-package"],
          visibleQuestionIds: expect.arrayContaining(["repair_details"]),
          packageDocuments: expect.arrayContaining([
            expect.objectContaining({ packageDocumentId: "repair_notice_letter" }),
          ]),
        }),
      ]),
    );
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "missing_required_item",
          formItemId: "evidence-upload",
          severity: "info",
        }),
      ]),
    );
  });

  it("gates only visible required V2 items and preserves upload file type metadata", () => {
    const definition: EmbeddedIntakeTemplateDefinition = {
      schemaVersion: 2,
      questions: [
        {
          id: "issue",
          label: "Issue",
          type: "select",
          options: [{ value: "other", label: "Other" }],
        },
        { id: "hidden_required", label: "Hidden", type: "text", required: true },
      ],
      branchRules: [
        {
          id: "show-hidden",
          questionId: "issue",
          operator: "equals",
          value: "repair",
          showQuestionIds: ["hidden_required"],
        },
      ],
      packages: [{ id: "base", title: "Base", documents: [{ id: "doc", title: "Doc" }] }],
      sections: [
        {
          id: "details",
          title: "Details",
          items: [
            { id: "issue-item", kind: "question", questionId: "issue" },
            { id: "hidden-required-item", kind: "question", questionId: "hidden_required" },
            {
              id: "evidence-upload",
              kind: "upload",
              label: "Evidence",
              acceptedFileTypes: ["application/pdf", "image/png"],
            },
          ],
        },
      ],
    };

    expect(validateEmbeddedIntakeTemplateDefinition(definition)).toBe(definition);
    expect(
      resolveEmbeddedIntakeAnswers({
        templateId: "intake-template-001",
        templateVersion: 2,
        definition,
        answers: { issue: "other" },
      }).requiredIncompleteItemIds,
    ).toEqual([]);
    expect(
      resolveEmbeddedIntakeAnswers({
        templateId: "intake-template-001",
        templateVersion: 2,
        definition,
        answers: { issue: "repair" },
      }).requiredIncompleteItemIds,
    ).toEqual(["hidden-required-item"]);
  });

  it("rejects invalid structured uploads and allows document-backed signature definitions", () => {
    const invalidUpload: EmbeddedIntakeTemplateDefinition = {
      schemaVersion: 2,
      questions: [],
      branchRules: [],
      packages: [{ id: "base", title: "Base", documents: [{ id: "doc", title: "Doc" }] }],
      sections: [
        {
          id: "uploads",
          title: "Uploads",
          items: [
            {
              id: "bad-upload",
              kind: "upload",
              label: "Bad upload",
              acceptedFileTypes: ["application/pdf", ""],
            },
          ],
        },
      ],
    };
    const documentBackedSignature: EmbeddedIntakeTemplateDefinition = {
      schemaVersion: 2,
      questions: [],
      branchRules: [],
      packages: [{ id: "base", title: "Base", documents: [{ id: "doc", title: "Doc" }] }],
      sections: [
        {
          id: "signatures",
          title: "Signatures",
          items: [
            {
              id: "attached-signature",
              kind: "signature",
              label: "Attached signature",
              consentText: "I agree.",
              documentId: "doc-001",
            },
          ],
        },
      ],
    };

    expect(() => validateEmbeddedIntakeTemplateDefinition(invalidUpload)).toThrow(
      "Upload item bad-upload has an empty accepted file type",
    );
    expect(validateEmbeddedIntakeTemplateDefinition(documentBackedSignature)).toBe(
      documentBackedSignature,
    );
  });

  it("creates reviewed variable proposals without mutating client or matter records", () => {
    const proposals = createIntakeVariableProposals({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      clientContactId: "contact-ada",
      intakeSessionId: "intake-session-001",
      answerSnapshotId: "answer-snapshot-001",
      definition: sampleResidentialTenancyIntakeDefinition,
      answers: {
        client_display_name: "Ada M.",
        matter_title: "Ada tenancy repairs",
      },
      now: "2026-05-01T12:00:00.000Z",
    });

    expect(proposals).toEqual([
      expect.objectContaining({
        targetScope: "client",
        targetField: "displayName",
        targetRecordId: "contact-ada",
        proposedValue: "Ada M.",
        status: "pending",
      }),
      expect.objectContaining({
        targetScope: "matter",
        targetField: "title",
        targetRecordId: "matter-001",
        proposedValue: "Ada tenancy repairs",
        status: "pending",
      }),
    ]);
  });
});
