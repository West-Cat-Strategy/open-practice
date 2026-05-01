import { describe, expect, it } from "vitest";
import {
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
      templateVersion: 1,
      definition: sampleResidentialTenancyIntakeDefinition,
      answers: { issue_type: "repair", urgent: true },
    });

    expect(resolution).toMatchObject({
      templateId: "intake-template-001",
      templateVersion: 1,
      visibleQuestionIds: expect.arrayContaining(["issue_type", "urgent", "repair_details"]),
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
    });
  });

  it("keeps branch-only questions hidden until their branch matches", () => {
    const resolution = resolveEmbeddedIntakeAnswers({
      templateId: "intake-template-001",
      templateVersion: 1,
      definition: sampleResidentialTenancyIntakeDefinition,
      answers: { issue_type: "deposit", urgent: false },
    });

    expect(resolution.visibleQuestionIds).toEqual(["issue_type", "urgent"]);
    expect(resolution.visibleQuestionIds).not.toContain("repair_details");
  });
});
