import { describe, expect, it } from "vitest";
import {
  buildEmbeddedIntakeTemplateQaReport,
  createIntakeVariableProposals,
  embeddedIntakeFormItemKinds,
  embeddedIntakeFormItemRegistry,
  previewEmbeddedIntakeTemplate,
  resolveEmbeddedIntakeAnswers,
  validateEmbeddedIntakeTemplateDefinition,
  type EmbeddedIntakeTemplateDefinition,
} from "./intake.js";
import {
  sampleDocumentAssemblyPackages,
  sampleDocumentAssemblySetDefinitions,
  sampleDocuments,
  sampleGeneratedDocuments,
  sampleResidentialTenancyIntakeDefinition,
  sampleSignatureRequests,
} from "./sample-data.js";

describe("embedded intake templates", () => {
  it("exposes registry adapters for the current V2 form item kinds", () => {
    expect(embeddedIntakeFormItemKinds).toEqual(["display", "question", "upload", "signature"]);
    expect(Object.keys(embeddedIntakeFormItemRegistry)).toEqual(embeddedIntakeFormItemKinds);
    for (const kind of embeddedIntakeFormItemKinds) {
      expect(embeddedIntakeFormItemRegistry[kind]).toMatchObject({
        kind,
        label: expect.any(String),
        validate: expect.any(Function),
        isVisible: expect.any(Function),
        isRequiredIncomplete: expect.any(Function),
        collectPreviewChecks: expect.any(Function),
        collectQaIssues: expect.any(Function),
      });
    }
  });

  it("validates the seeded residential tenancy definition", () => {
    expect(validateEmbeddedIntakeTemplateDefinition(sampleResidentialTenancyIntakeDefinition)).toBe(
      sampleResidentialTenancyIntakeDefinition,
    );
    const serialized = JSON.stringify(sampleResidentialTenancyIntakeDefinition);
    expect(serialized).toContain("BC residential tenancy");
    expect(serialized).toContain("Residential Tenancy Branch");
    expect(serialized).not.toMatch(/\bstate\b|\bcounty\b|\battorney\b|zip code/i);
  });

  it("keeps seeded Canadian document samples synthetic and BC-scoped", () => {
    expect(sampleDocuments[0]).toMatchObject({
      id: "doc-001",
      title: "BC tenancy retainer and review plan.pdf",
      reviewMetadata: {
        source: "seed",
        jurisdiction: "BC",
        sampleContext: "canadian_residential_tenancy",
      },
    });
    expect(sampleSignatureRequests[0]).toMatchObject({
      title: "BC tenancy retainer and review plan",
      consentText: expect.stringContaining("synthetic Canadian retainer package"),
    });
    expect(sampleGeneratedDocuments[0]).toMatchObject({
      title: "BC tenancy retainer and review plan",
      evidence: { jurisdiction: "BC", sampleContext: "canadian_residential_tenancy" },
    });
    expect(sampleDocumentAssemblySetDefinitions[0]).toMatchObject({
      name: "BC tenancy retainer signature package",
      practiceArea: "Residential tenancy",
    });
    expect(sampleDocumentAssemblyPackages[0]).toMatchObject({
      title: "BC tenancy retainer signature package",
      metadata: { jurisdiction: "BC", sampleContext: "canadian_residential_tenancy" },
    });
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

  it("rejects form item kinds outside the embedded registry", () => {
    const unknownItemKind = {
      schemaVersion: 2,
      questions: [],
      branchRules: [],
      packages: [{ id: "base", title: "Base", documents: [{ id: "doc", title: "Doc" }] }],
      sections: [
        {
          id: "custom-section",
          title: "Custom section",
          items: [{ id: "custom-item", kind: "custom", label: "Custom" }],
        },
      ],
    } as unknown as EmbeddedIntakeTemplateDefinition;

    expect(() => validateEmbeddedIntakeTemplateDefinition(unknownItemKind)).toThrow(
      "Unsupported form item kind custom",
    );
  });

  it("resolves visible questions and package documents from answers", () => {
    const resolution = resolveEmbeddedIntakeAnswers({
      templateId: "intake-template-001",
      templateVersion: 2,
      definition: sampleResidentialTenancyIntakeDefinition,
      answers: {
        issue_type: "repair",
        urgent: true,
        client_display_name: "Ada Morgan",
        matter_title: "Morgan tenancy dispute",
        rental_address: "123 Synthetic Street, Vancouver, BC",
        client_role: "tenant",
      },
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
          title: "BC repair notice letter",
        },
        {
          packageId: "urgent_review_package",
          packageDocumentId: "urgent_review_memo",
          title: "Urgent BC tenancy review memo",
        },
      ]),
      packageSummaries: expect.arrayContaining([
        expect.objectContaining({
          packageId: "repair_notice_package",
          title: "BC repair notice review package",
          documentCount: 2,
          documentIds: ["repair_notice_letter", "client_instruction_summary"],
        }),
        expect.objectContaining({
          packageId: "urgent_review_package",
          title: "Urgent BC tenancy review package",
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
      "rental_address",
      "client_role",
      "evidence_status",
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
      answers: {
        issue_type: "repair",
        urgent: true,
        client_display_name: "Ada Morgan",
        matter_title: "Morgan tenancy dispute",
        rental_address: "123 Synthetic Street, Vancouver, BC",
        client_role: "tenant",
      },
    });
    const complete = resolveEmbeddedIntakeAnswers({
      templateId: "intake-template-001",
      templateVersion: 2,
      definition: sampleResidentialTenancyIntakeDefinition,
      answers: {
        issue_type: "repair",
        urgent: true,
        client_display_name: "Ada Morgan",
        matter_title: "Morgan tenancy dispute",
        rental_address: "123 Synthetic Street, Vancouver, BC",
        client_role: "tenant",
      },
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

  it("persists named QA scenario previews across branch paths and package combinations", () => {
    if (sampleResidentialTenancyIntakeDefinition.schemaVersion !== 2) {
      throw new Error("Seeded V2 intake template is required");
    }
    const definition: Extract<EmbeddedIntakeTemplateDefinition, { schemaVersion: 2 }> = {
      ...sampleResidentialTenancyIntakeDefinition,
      qaScenarios: [
        {
          id: "deposit-base-path",
          name: "Deposit base path",
          answers: { issue_type: "deposit", urgent: false },
          selectedPackageIds: ["repair_notice_package"],
        },
        {
          id: "repair-branch-path",
          name: "Repair branch path",
          answers: {
            issue_type: "repair",
            urgent: false,
            repair_details: "Synthetic repair details for staff QA.",
          },
          selectedPackageIds: ["repair_notice_package"],
        },
        {
          id: "urgent-repair-package-combo",
          name: "Urgent repair package combo",
          answers: {
            issue_type: "repair",
            urgent: true,
            repair_details: "Synthetic urgent repair details.",
          },
          selectedPackageIds: ["repair_notice_package", "urgent_review_package"],
        },
      ],
    };
    const before = JSON.stringify(definition);

    expect(validateEmbeddedIntakeTemplateDefinition(definition)).toBe(definition);
    const report = buildEmbeddedIntakeTemplateQaReport({
      templateId: "intake-template-001",
      templateVersion: 2,
      definition,
    });

    expect(JSON.stringify(definition)).toBe(before);
    expect(report.summary).toMatchObject({
      branchRuleCount: 2,
      previewCount: 6,
      blockingIssueCount: 0,
    });
    expect(report.previews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "scenario:deposit-base-path",
          label: "Deposit base path",
          matchedBranchRuleIds: [],
          selectedPackageIds: ["repair_notice_package"],
        }),
        expect.objectContaining({
          id: "scenario:repair-branch-path",
          matchedBranchRuleIds: ["repair-package"],
          visibleQuestionIds: expect.arrayContaining(["repair_details"]),
          packageDocuments: expect.arrayContaining([
            expect.objectContaining({ packageDocumentId: "repair_notice_letter" }),
          ]),
        }),
        expect.objectContaining({
          id: "scenario:urgent-repair-package-combo",
          matchedBranchRuleIds: ["repair-package", "urgent-review-package"],
          selectedPackageIds: ["repair_notice_package", "urgent_review_package"],
          packageDocuments: expect.arrayContaining([
            expect.objectContaining({ packageDocumentId: "repair_notice_letter" }),
            expect.objectContaining({ packageDocumentId: "urgent_review_memo" }),
          ]),
        }),
      ]),
    );
  });

  it("rejects QA scenarios with duplicate ids or unknown references", () => {
    if (sampleResidentialTenancyIntakeDefinition.schemaVersion !== 2) {
      throw new Error("Seeded V2 intake template is required");
    }
    const baseDefinition = sampleResidentialTenancyIntakeDefinition;

    expect(() =>
      validateEmbeddedIntakeTemplateDefinition({
        ...baseDefinition,
        qaScenarios: [
          { id: "duplicate", name: "First", answers: {} },
          { id: "duplicate", name: "Second", answers: {} },
        ],
      }),
    ).toThrow("Duplicate embedded intake QA scenario id duplicate");

    expect(() =>
      validateEmbeddedIntakeTemplateDefinition({
        ...baseDefinition,
        qaScenarios: [
          {
            id: "unknown-question",
            name: "Unknown question",
            answers: { missing_question: "synthetic" },
          },
        ],
      }),
    ).toThrow("QA scenario unknown-question answers unknown question missing_question");

    expect(() =>
      validateEmbeddedIntakeTemplateDefinition({
        ...baseDefinition,
        qaScenarios: [
          {
            id: "unknown-package",
            name: "Unknown package",
            answers: {},
            selectedPackageIds: ["missing-package"],
          },
        ],
      }),
    ).toThrow("QA scenario unknown-package selects unknown package missing-package");
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

  it("previews V2 intake QA checks without creating intake records", () => {
    const preview = previewEmbeddedIntakeTemplate({
      templateId: "preview",
      templateVersion: 1,
      definition: sampleResidentialTenancyIntakeDefinition,
      answers: { issue_type: "repair" },
    });

    expect(preview.status).toBe("warnings");
    expect(preview.preview).toMatchObject({
      visibleQuestionIds: expect.arrayContaining(["issue_type", "repair_details"]),
      requiredIncompleteItemIds: expect.arrayContaining(["evidence-upload", "client-attestation"]),
      eligiblePackageIds: expect.arrayContaining(["repair_notice_package"]),
    });
    expect(preview.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "required_question_unmapped",
          severity: "warning",
          questionId: "issue_type",
        }),
      ]),
    );
  });

  it("returns blocking preview checks for invalid definitions", () => {
    const invalid: EmbeddedIntakeTemplateDefinition = {
      schemaVersion: 2,
      questions: [{ id: "client_name", label: "Client name", type: "text" }],
      branchRules: [],
      packages: [{ id: "base", title: "Base", documents: [{ id: "doc", title: "Doc" }] }],
      sections: [
        {
          id: "client-basics",
          title: "Client basics",
          items: [{ id: "client-name-item", kind: "question", questionId: "missing" }],
        },
      ],
    };

    expect(
      previewEmbeddedIntakeTemplate({
        templateId: "preview",
        templateVersion: 1,
        definition: invalid,
      }),
    ).toMatchObject({
      status: "blocked",
      checks: [
        expect.objectContaining({
          code: "invalid_definition",
          severity: "blocking",
          message: "Form item client-name-item references unknown question missing",
        }),
      ],
      preview: null,
    });
  });
});
