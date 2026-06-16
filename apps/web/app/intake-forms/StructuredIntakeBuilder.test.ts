import { describe, expect, it } from "vitest";
import type { EmbeddedIntakeTemplateDefinitionV2 } from "@open-practice/domain";
import {
  intakeBuilderItemRegistry,
  itemKinds,
  makeIntakeBranchRule,
  makeIntakeItem,
  makeIntakeQaScenario,
  summarizeIntakeBranchPathCounts,
  summarizeIntakeBranchRulePath,
  summarizeIntakeBranchRuleTrigger,
  summarizeIntakeQaScenarioPath,
} from "../intake-forms-dashboard";
import { structuredIntakeDiagnostics } from "./structured-builder-diagnostics";

const validDefinition: EmbeddedIntakeTemplateDefinitionV2 = {
  schemaVersion: 2,
  questions: [
    { id: "client_name", label: "Client name", type: "text", required: true },
    {
      id: "matter_type",
      label: "Matter type",
      type: "select",
      options: [
        { value: "tenancy", label: "Tenancy" },
        { value: "employment", label: "Employment" },
      ],
    },
    { id: "urgent", label: "Urgent filing", type: "boolean" },
  ],
  branchRules: [],
  packages: [
    {
      id: "residential-tenancy",
      title: "Residential tenancy",
      documents: [{ id: "notice", title: "Notice" }],
    },
  ],
  sections: [
    {
      id: "client",
      title: "Client",
      items: [
        { id: "client-name-item", kind: "question", questionId: "client_name" },
        { id: "matter-type-item", kind: "question", questionId: "matter_type" },
        { id: "urgent-item", kind: "question", questionId: "urgent" },
      ],
    },
  ],
};

describe("structured intake builder diagnostics", () => {
  it("uses the builder registry for the current intake item defaults", () => {
    expect(itemKinds).toEqual(["display", "question", "upload", "signature"]);
    expect(Object.keys(intakeBuilderItemRegistry)).toEqual(itemKinds);
    expect(itemKinds.map((kind) => makeIntakeItem(kind, 0))).toEqual([
      { id: "display-1", kind: "display", body: "Client-facing text." },
      { id: "question-1", kind: "question", questionId: "client_display_name" },
      {
        id: "upload-1",
        kind: "upload",
        label: "Supporting document",
        required: false,
        acceptedFileTypes: ["application/pdf", "image/png", "image/jpeg"],
      },
      {
        id: "signature-1",
        kind: "signature",
        label: "Client attestation",
        required: true,
        consentText: "I confirm these intake answers are accurate.",
      },
    ]);
  });

  it("blocks duplicate definition ids before staff save", () => {
    const diagnostics = structuredIntakeDiagnostics({
      ...validDefinition,
      questions: [
        ...validDefinition.questions,
        { id: "client_name", label: "Preferred name", type: "text" },
      ],
      packages: [
        ...validDefinition.packages,
        { id: "residential-tenancy", title: "Duplicate tenancy", documents: [] },
      ],
      sections: [
        ...validDefinition.sections,
        { id: "client", title: "Duplicate client", items: [] },
      ],
    });

    expect(diagnostics.blocking).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_definition",
          severity: "blocking",
          message: "Duplicate question id client_name",
        }),
        expect.objectContaining({
          code: "invalid_definition",
          severity: "blocking",
          message: "Duplicate package id residential-tenancy",
        }),
        expect.objectContaining({
          code: "invalid_definition",
          severity: "blocking",
          message: "Duplicate form section id client",
        }),
      ]),
    );
  });

  it("blocks broken question references before staff save", () => {
    const diagnostics = structuredIntakeDiagnostics({
      ...validDefinition,
      sections: [
        {
          id: "client",
          title: "Client",
          items: [{ id: "broken-item", kind: "question", questionId: "missing_question" }],
        },
      ],
    });

    expect(diagnostics.blocking).toEqual([
      expect.objectContaining({
        code: "invalid_definition",
        severity: "blocking",
        message: expect.stringContaining("missing_question"),
      }),
    ]);
  });

  it("blocks invalid package targets before staff save", () => {
    const diagnostics = structuredIntakeDiagnostics({
      ...validDefinition,
      branchRules: [
        {
          id: "bad-package-target",
          questionId: "client_name",
          operator: "present",
          eligiblePackageIds: ["missing-package"],
        },
      ],
    });

    expect(diagnostics.blocking).toEqual([
      expect.objectContaining({
        code: "invalid_definition",
        severity: "blocking",
        message: "Branch rule bad-package-target references unknown package missing-package",
      }),
    ]);
  });

  it("creates visual branch-rule defaults with unique staff IDs", () => {
    expect(makeIntakeBranchRule(validDefinition)).toEqual({
      id: "branch-1",
      questionId: "client_name",
      operator: "present",
      showQuestionIds: [],
      eligiblePackageIds: [],
    });
    expect(
      makeIntakeBranchRule({
        ...validDefinition,
        branchRules: [
          {
            id: "branch-1",
            questionId: "client_name",
            operator: "present",
          },
        ],
      }).id,
    ).toBe("branch-2");
  });

  it("summarizes visual branch-rule triggers and preview paths", () => {
    const rule = {
      id: "tenancy-path",
      questionId: "matter_type",
      operator: "equals" as const,
      value: "tenancy",
      showQuestionIds: ["urgent"],
      eligiblePackageIds: ["residential-tenancy"],
    };
    const definition = { ...validDefinition, branchRules: [rule] };

    expect(summarizeIntakeBranchRuleTrigger(rule, definition)).toBe("Matter type equals tenancy");
    expect(
      summarizeIntakeBranchPathCounts({
        visibleQuestionIds: ["client_name", "matter_type", "urgent"],
        visibleFormItemIds: ["client-name-item", "matter-type-item", "urgent-item"],
        requiredIncompleteItemIds: ["client-name-item"],
        eligiblePackageIds: ["residential-tenancy"],
        packageDocumentCount: 1,
      }),
    ).toBe(
      "3 visible questions · 3 visible items · 1 required incomplete · 1 package · 1 document",
    );

    expect(summarizeIntakeBranchRulePath(rule, definition)).toEqual(
      expect.objectContaining({
        ruleId: "tenancy-path",
        trigger: "Matter type equals tenancy",
        visibleQuestionIds: ["client_name", "matter_type", "urgent"],
        visibleFormItemIds: ["client-name-item", "matter-type-item", "urgent-item"],
        matchedBranchRuleIds: ["tenancy-path"],
        eligiblePackageIds: ["residential-tenancy"],
        packageDocumentCount: 1,
      }),
    );
  });

  it("creates and summarizes named QA scenario paths with package selections", () => {
    expect(makeIntakeQaScenario(validDefinition)).toEqual({
      id: "scenario-1",
      name: "New QA scenario",
      answers: {},
      selectedPackageIds: [],
    });
    expect(
      makeIntakeQaScenario({
        ...validDefinition,
        qaScenarios: [{ id: "scenario-1", name: "Existing", answers: {} }],
      }).id,
    ).toBe("scenario-2");

    const definition: EmbeddedIntakeTemplateDefinitionV2 = {
      ...validDefinition,
      branchRules: [
        {
          id: "tenancy-path",
          questionId: "matter_type",
          operator: "equals",
          value: "tenancy",
          showQuestionIds: ["urgent"],
          eligiblePackageIds: ["residential-tenancy"],
        },
        {
          id: "urgent-package",
          questionId: "urgent",
          operator: "equals",
          value: true,
          eligiblePackageIds: ["urgent-review"],
        },
      ],
      packages: [
        ...validDefinition.packages,
        {
          id: "urgent-review",
          title: "Urgent review",
          documents: [{ id: "urgent-memo", title: "Urgent memo" }],
        },
      ],
    };
    const summary = summarizeIntakeQaScenarioPath(
      {
        id: "urgent-tenancy",
        name: "Urgent tenancy",
        answers: { matter_type: "tenancy", urgent: true },
        selectedPackageIds: ["residential-tenancy", "urgent-review"],
      },
      definition,
    );

    expect(summary).toEqual(
      expect.objectContaining({
        scenarioId: "urgent-tenancy",
        name: "Urgent tenancy",
        matchedBranchRuleIds: ["tenancy-path", "urgent-package"],
        eligiblePackageIds: ["residential-tenancy", "urgent-review"],
        selectedPackageIds: ["residential-tenancy", "urgent-review"],
        packageDocumentCount: 2,
      }),
    );
  });

  it("blocks unsupported variable mappings before staff save", () => {
    const diagnostics = structuredIntakeDiagnostics({
      ...validDefinition,
      questions: [
        {
          ...validDefinition.questions[0]!,
          variableMapping: { targetScope: "client", targetField: "postalCode" },
        },
        {
          id: "invalid_scope",
          label: "Invalid scope",
          type: "text",
          variableMapping: { targetScope: "profile", targetField: "displayName" },
        },
      ] as unknown as EmbeddedIntakeTemplateDefinitionV2["questions"],
    });

    expect(diagnostics.blocking).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_definition",
          severity: "blocking",
          message: "Question client_name has an unsupported variable mapping target.",
          questionId: "client_name",
        }),
        expect.objectContaining({
          code: "invalid_definition",
          severity: "blocking",
          message: "Question invalid_scope has an unsupported variable mapping target.",
          questionId: "invalid_scope",
        }),
      ]),
    );
  });

  it("blocks invalid saved QA scenario references before staff save", () => {
    const diagnostics = structuredIntakeDiagnostics({
      ...validDefinition,
      qaScenarios: [
        {
          id: "bad-scenario",
          name: "",
          answers: { missing_question: "synthetic" },
          selectedPackageIds: ["missing-package"],
        },
      ],
    });

    expect(diagnostics.blocking).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_definition",
          severity: "blocking",
          message: "QA scenario bad-scenario must define a name",
        }),
        expect.objectContaining({
          code: "invalid_definition",
          severity: "blocking",
          message: "QA scenario bad-scenario answers unknown question missing_question",
          questionId: "missing_question",
        }),
        expect.objectContaining({
          code: "invalid_definition",
          severity: "blocking",
          message: "QA scenario bad-scenario selects unknown package missing-package",
        }),
      ]),
    );
  });

  it("keeps advanced JSON apply blocked when parsed diagnostics are blocking", () => {
    const parsed = JSON.parse(
      JSON.stringify({
        ...validDefinition,
        branchRules: [
          {
            id: "json-bad-package",
            questionId: "client_name",
            operator: "present",
            eligiblePackageIds: ["not-a-package"],
          },
        ],
      }),
    ) as EmbeddedIntakeTemplateDefinitionV2;
    const diagnostics = structuredIntakeDiagnostics(parsed);

    expect(diagnostics.blocking[0]).toEqual(
      expect.objectContaining({
        code: "invalid_definition",
        severity: "blocking",
        message: "Branch rule json-bad-package references unknown package not-a-package",
      }),
    );
  });

  it("surfaces review warnings without blocking structurally valid definitions", () => {
    const diagnostics = structuredIntakeDiagnostics(validDefinition);

    expect(diagnostics.blocking).toEqual([]);
    expect(diagnostics.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "required_question_unmapped",
          severity: "warning",
        }),
      ]),
    );
  });
});
