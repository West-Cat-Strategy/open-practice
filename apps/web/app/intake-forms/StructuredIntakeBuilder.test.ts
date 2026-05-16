import { describe, expect, it } from "vitest";
import type { EmbeddedIntakeTemplateDefinitionV2 } from "@open-practice/domain";
import { structuredIntakeDiagnostics } from "./structured-builder-diagnostics";

const validDefinition: EmbeddedIntakeTemplateDefinitionV2 = {
  schemaVersion: 2,
  questions: [{ id: "client_name", label: "Client name", type: "text", required: true }],
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
      items: [{ id: "client-name-item", kind: "question", questionId: "client_name" }],
    },
  ],
};

describe("structured intake builder diagnostics", () => {
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
