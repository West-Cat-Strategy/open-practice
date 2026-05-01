export type EmbeddedIntakeQuestionType = "text" | "textarea" | "select" | "boolean" | "date";

export interface EmbeddedIntakeQuestionOption {
  value: string;
  label: string;
}

export interface EmbeddedIntakeQuestion {
  id: string;
  label: string;
  type: EmbeddedIntakeQuestionType;
  required?: boolean;
  options?: EmbeddedIntakeQuestionOption[];
}

export type EmbeddedIntakeBranchOperator = "equals" | "not_equals" | "includes" | "present";

export interface EmbeddedIntakeBranchRule {
  id: string;
  questionId: string;
  operator: EmbeddedIntakeBranchOperator;
  value?: string | number | boolean;
  showQuestionIds?: string[];
  eligiblePackageIds?: string[];
}

export interface EmbeddedIntakePackageDocument {
  id: string;
  title: string;
  description?: string;
}

export interface EmbeddedIntakePackage {
  id: string;
  title: string;
  description?: string;
  default?: boolean;
  documents: EmbeddedIntakePackageDocument[];
}

export interface EmbeddedIntakeTemplateDefinitionV1 {
  schemaVersion: 1;
  questions: EmbeddedIntakeQuestion[];
  branchRules: EmbeddedIntakeBranchRule[];
  packages: EmbeddedIntakePackage[];
}

export type EmbeddedIntakeTemplateDefinition = EmbeddedIntakeTemplateDefinitionV1;

export interface IntakePackageDocumentResolution {
  packageId: string;
  packageDocumentId: string;
  title: string;
}

export interface IntakeResolutionSnapshot {
  templateId: string;
  templateVersion: number;
  visibleQuestionIds: string[];
  eligiblePackageIds: string[];
  selectedPackageIds: string[];
  packageDocuments: IntakePackageDocumentResolution[];
}

export function validateEmbeddedIntakeTemplateDefinition(
  definition: EmbeddedIntakeTemplateDefinition,
): EmbeddedIntakeTemplateDefinition {
  if (definition.schemaVersion !== 1) {
    throw new Error(`Unsupported embedded intake schema version ${definition.schemaVersion}`);
  }

  const questionIds = assertUniqueIds(
    "question",
    definition.questions.map((question) => question.id),
  );
  const packageIds = assertUniqueIds(
    "package",
    definition.packages.map((intakePackage) => intakePackage.id),
  );

  for (const question of definition.questions) {
    if (question.type === "select") {
      const optionIds = assertUniqueIds(
        `option for question ${question.id}`,
        (question.options ?? []).map((option) => option.value),
      );
      if (optionIds.size === 0) {
        throw new Error(`Select question ${question.id} must define at least one option`);
      }
    }
  }

  assertUniqueIds(
    "branch rule",
    definition.branchRules.map((rule) => rule.id),
  );
  for (const rule of definition.branchRules) {
    if (!questionIds.has(rule.questionId)) {
      throw new Error(`Branch rule ${rule.id} references unknown question ${rule.questionId}`);
    }
    for (const questionId of rule.showQuestionIds ?? []) {
      if (!questionIds.has(questionId)) {
        throw new Error(`Branch rule ${rule.id} shows unknown question ${questionId}`);
      }
    }
    for (const packageId of rule.eligiblePackageIds ?? []) {
      if (!packageIds.has(packageId)) {
        throw new Error(`Branch rule ${rule.id} references unknown package ${packageId}`);
      }
    }
  }

  for (const intakePackage of definition.packages) {
    if (intakePackage.documents.length === 0) {
      throw new Error(`Package ${intakePackage.id} must define at least one document`);
    }
    assertUniqueIds(
      `document for package ${intakePackage.id}`,
      intakePackage.documents.map((document) => document.id),
    );
  }

  return definition;
}

export function resolveEmbeddedIntakeAnswers(input: {
  templateId: string;
  templateVersion: number;
  definition: EmbeddedIntakeTemplateDefinition;
  answers: Record<string, unknown>;
  selectedPackageIds?: string[];
}): IntakeResolutionSnapshot {
  const definition = validateEmbeddedIntakeTemplateDefinition(input.definition);
  const conditionalQuestionIds = new Set(
    definition.branchRules.flatMap((rule) => rule.showQuestionIds ?? []),
  );
  const visibleQuestionIds = new Set(
    definition.questions
      .filter((question) => !conditionalQuestionIds.has(question.id))
      .map((question) => question.id),
  );
  const eligiblePackageIds = new Set(
    definition.packages.filter((intakePackage) => intakePackage.default).map((item) => item.id),
  );

  for (const rule of definition.branchRules) {
    if (!branchRuleMatches(rule, input.answers[rule.questionId])) continue;
    for (const questionId of rule.showQuestionIds ?? []) visibleQuestionIds.add(questionId);
    for (const packageId of rule.eligiblePackageIds ?? []) eligiblePackageIds.add(packageId);
  }

  const requestedPackageIds = input.selectedPackageIds ?? [...eligiblePackageIds];
  const selectedPackageIds = requestedPackageIds.filter((packageId) =>
    eligiblePackageIds.has(packageId),
  );
  const packageDocuments = definition.packages
    .filter((intakePackage) => selectedPackageIds.includes(intakePackage.id))
    .flatMap((intakePackage) =>
      intakePackage.documents.map((document) => ({
        packageId: intakePackage.id,
        packageDocumentId: document.id,
        title: document.title,
      })),
    );

  return {
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    visibleQuestionIds: [...visibleQuestionIds],
    eligiblePackageIds: [...eligiblePackageIds],
    selectedPackageIds,
    packageDocuments,
  };
}

function assertUniqueIds(label: string, ids: string[]): Set<string> {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id) throw new Error(`Embedded intake ${label} id is required`);
    if (seen.has(id)) throw new Error(`Duplicate embedded intake ${label} id ${id}`);
    seen.add(id);
  }
  return seen;
}

function branchRuleMatches(rule: EmbeddedIntakeBranchRule, answer: unknown): boolean {
  if (rule.operator === "present") return answer !== undefined && answer !== null && answer !== "";
  if (rule.operator === "includes") {
    return Array.isArray(answer) && answer.includes(rule.value);
  }
  if (rule.operator === "equals") return answer === rule.value;
  return answer !== rule.value;
}
