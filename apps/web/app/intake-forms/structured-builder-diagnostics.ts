import type {
  EmbeddedIntakeBranchRule,
  EmbeddedIntakeTemplateDefinitionV2,
  IntakeTemplatePreviewCheck,
} from "@open-practice/domain";

const clientVariableFields = new Set(["displayName", "notes"]);
const matterVariableFields = new Set(["title", "practiceArea", "jurisdiction"]);

function duplicateIds(label: string, ids: string[]): IntakeTemplatePreviewCheck[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates].map((id) => ({
    code: "invalid_definition",
    severity: "blocking",
    message: `Duplicate ${label} id ${id}`,
  }));
}

function branchRuleCanMatch(
  rule: EmbeddedIntakeBranchRule,
  definition: EmbeddedIntakeTemplateDefinitionV2,
): boolean {
  if (rule.operator === "present" || rule.operator === "not_equals") return true;
  const question = definition.questions.find((candidate) => candidate.id === rule.questionId);
  if (!question) return false;
  if (question.type === "select") {
    return Boolean(question.options?.some((option) => option.value === rule.value));
  }
  if (question.type === "boolean") return typeof rule.value === "boolean";
  if (rule.operator === "includes") return false;
  return rule.value !== undefined;
}

export function structuredIntakeDiagnostics(definition: EmbeddedIntakeTemplateDefinitionV2): {
  blocking: IntakeTemplatePreviewCheck[];
  warnings: IntakeTemplatePreviewCheck[];
} {
  const questionIds = new Set(definition.questions.map((question) => question.id));
  const packageIds = new Set(definition.packages.map((intakePackage) => intakePackage.id));
  const referencedQuestionIds = new Set<string>();
  const conditionalQuestionIds = new Set(
    definition.branchRules.flatMap((rule) => rule.showQuestionIds ?? []),
  );
  const blocking: IntakeTemplatePreviewCheck[] = [
    ...duplicateIds(
      "question",
      definition.questions.map((question) => question.id),
    ),
    ...duplicateIds(
      "branch rule",
      definition.branchRules.map((rule) => rule.id),
    ),
    ...duplicateIds(
      "package",
      definition.packages.map((intakePackage) => intakePackage.id),
    ),
    ...duplicateIds(
      "form section",
      definition.sections.map((section) => section.id),
    ),
    ...duplicateIds(
      "form item",
      definition.sections.flatMap((section) => section.items.map((item) => item.id)),
    ),
  ];
  const warnings: IntakeTemplatePreviewCheck[] = [];

  for (const rule of definition.branchRules) {
    if (!questionIds.has(rule.questionId)) {
      blocking.push({
        code: "invalid_definition",
        severity: "blocking",
        message: `Branch rule ${rule.id} references unknown question ${rule.questionId}`,
        questionId: rule.questionId,
      });
    }
    for (const questionId of rule.showQuestionIds ?? []) {
      if (!questionIds.has(questionId)) {
        blocking.push({
          code: "invalid_definition",
          severity: "blocking",
          message: `Branch rule ${rule.id} shows unknown question ${questionId}`,
          questionId,
        });
      }
    }
    for (const packageId of rule.eligiblePackageIds ?? []) {
      if (!packageIds.has(packageId)) {
        blocking.push({
          code: "invalid_definition",
          severity: "blocking",
          message: `Branch rule ${rule.id} references unknown package ${packageId}`,
        });
      }
    }
    if (!branchRuleCanMatch(rule, definition)) {
      warnings.push({
        code: "branch_question_without_trigger",
        severity: "warning",
        message: "Branch rule has no practical trigger in the current definition.",
        questionId: rule.questionId,
      });
    }
  }

  for (const section of definition.sections) {
    if (section.items.length === 0) {
      blocking.push({
        code: "invalid_definition",
        severity: "blocking",
        message: `Form section ${section.id} must define at least one item`,
        sectionId: section.id,
      });
    }
    for (const item of section.items) {
      if (item.kind === "question") {
        referencedQuestionIds.add(item.questionId);
        if (!questionIds.has(item.questionId)) {
          blocking.push({
            code: "invalid_definition",
            severity: "blocking",
            message: `Form item ${item.id} references unknown question ${item.questionId}`,
            sectionId: section.id,
            itemId: item.id,
            questionId: item.questionId,
          });
        }
      }
      if (item.kind === "upload" && item.required && conditionalQuestionIds.has(item.id)) {
        warnings.push({
          code: "required_upload_hidden",
          severity: "warning",
          message: "A required upload item may be hidden by the current preview answers.",
          sectionId: section.id,
          itemId: item.id,
        });
      }
      if (item.kind === "signature" && item.required && item.consentText.trim().length === 0) {
        blocking.push({
          code: "invalid_definition",
          severity: "blocking",
          message: `Signature item ${item.id} requires consent text`,
          sectionId: section.id,
          itemId: item.id,
        });
      }
      if (item.kind === "signature" && item.documentId) {
        warnings.push({
          code: "signature_document_unverified",
          severity: "warning",
          message: "Signature document availability needs matter-scoped verification.",
          sectionId: section.id,
          itemId: item.id,
        });
      }
    }
  }

  if (definition.packages.length === 0) {
    warnings.push({
      code: "no_packages",
      severity: "warning",
      message: "Definition does not include any reusable package previews.",
    });
  }

  for (const question of definition.questions) {
    if (!referencedQuestionIds.has(question.id)) {
      warnings.push({
        code: "unreferenced_question",
        severity: "warning",
        message: "Question is not placed in any form section.",
        questionId: question.id,
      });
    }
    if (question.required && !question.variableMapping) {
      warnings.push({
        code: "required_question_unmapped",
        severity: "warning",
        message: "Required question has no reviewed-merge variable mapping.",
        questionId: question.id,
      });
    }
    const mapping = question.variableMapping;
    if (
      mapping &&
      ((mapping.targetScope !== "client" && mapping.targetScope !== "matter") ||
        (mapping.targetScope === "client" && !clientVariableFields.has(mapping.targetField)) ||
        (mapping.targetScope === "matter" && !matterVariableFields.has(mapping.targetField)))
    ) {
      blocking.push({
        code: "invalid_definition",
        severity: "blocking",
        message: `Question ${question.id} has an unsupported variable mapping target.`,
        questionId: question.id,
      });
    }
  }

  return {
    blocking,
    warnings,
  };
}
