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
  variableMapping?: IntakeVariableMapping;
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

export type EmbeddedIntakeFormItem =
  | {
      id: string;
      kind: "display";
      label?: string;
      body: string;
    }
  | {
      id: string;
      kind: "question";
      questionId: string;
    }
  | {
      id: string;
      kind: "upload";
      label: string;
      required?: boolean;
      acceptedFileTypes?: string[];
      classification?: "general" | "privileged" | "work_product" | "financial" | "identity";
      legalHold?: boolean;
    }
  | {
      id: string;
      kind: "signature";
      label: string;
      required?: boolean;
      consentText: string;
      documentId?: string;
    };

export interface EmbeddedIntakeFormSection {
  id: string;
  title: string;
  description?: string;
  items: EmbeddedIntakeFormItem[];
}

export interface EmbeddedIntakeTemplateDefinitionV2 {
  schemaVersion: 2;
  questions: EmbeddedIntakeQuestion[];
  branchRules: EmbeddedIntakeBranchRule[];
  packages: EmbeddedIntakePackage[];
  sections: EmbeddedIntakeFormSection[];
}

export type EmbeddedIntakeTemplateDefinition =
  | EmbeddedIntakeTemplateDefinitionV1
  | EmbeddedIntakeTemplateDefinitionV2;

export type IntakeVariableTargetScope = "client" | "matter";

export type IntakeClientVariableField = "displayName" | "notes";

export type IntakeMatterVariableField = "title" | "practiceArea" | "jurisdiction";

export interface IntakeVariableMapping {
  targetScope: IntakeVariableTargetScope;
  targetField: IntakeClientVariableField | IntakeMatterVariableField;
}

export type IntakeVariableProposalStatus = "pending" | "approved" | "rejected";

export interface IntakeVariableProposal {
  id: string;
  firmId: string;
  matterId: string;
  intakeSessionId: string;
  answerSnapshotId: string;
  sourceQuestionId: string;
  targetScope: IntakeVariableTargetScope;
  targetField: IntakeClientVariableField | IntakeMatterVariableField;
  targetRecordId: string;
  proposedValue: string;
  status: IntakeVariableProposalStatus;
  createdAt: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  appliedAt?: string;
}

export interface IntakeFormLinkRecord {
  id: string;
  firmId: string;
  matterId: string;
  intakeSessionId: string;
  tokenHash: string;
  requestedByUserId: string;
  clientContactId?: string;
  expiresAt: string;
  revokedAt?: string;
  submittedAt?: string;
  createdAt: string;
}

export type IntakeFormItemActionKind = "upload" | "signature";

export type IntakeFormItemActionStatus = "intent_created" | "uploaded" | "completed" | "declined";

export interface IntakeFormItemActionRecord {
  id: string;
  firmId: string;
  matterId: string;
  intakeSessionId: string;
  formLinkId: string;
  itemId: string;
  kind: IntakeFormItemActionKind;
  status: IntakeFormItemActionStatus;
  documentId?: string;
  signatureRequestId?: string;
  evidence: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

export interface IntakePackageDocumentResolution {
  packageId: string;
  packageDocumentId: string;
  title: string;
}

export interface IntakeResolutionSnapshot {
  templateId: string;
  templateVersion: number;
  visibleQuestionIds: string[];
  visibleFormItemIds?: string[];
  requiredIncompleteItemIds?: string[];
  eligiblePackageIds: string[];
  selectedPackageIds: string[];
  packageDocuments: IntakePackageDocumentResolution[];
}

export function validateEmbeddedIntakeTemplateDefinition(
  definition: EmbeddedIntakeTemplateDefinition,
): EmbeddedIntakeTemplateDefinition {
  const schemaVersion = (definition as { schemaVersion?: number }).schemaVersion;
  if (schemaVersion !== 1 && schemaVersion !== 2) {
    throw new Error(`Unsupported embedded intake schema version ${String(schemaVersion)}`);
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
    if (question.variableMapping) {
      assertVariableMapping(question.variableMapping);
    }
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

  if (definition.schemaVersion === 2) {
    assertUniqueIds(
      "form section",
      definition.sections.map((section) => section.id),
    );
    const formItemIds = assertUniqueIds(
      "form item",
      definition.sections.flatMap((section) => section.items.map((item) => item.id)),
    );
    for (const section of definition.sections) {
      if (section.items.length === 0) {
        throw new Error(`Form section ${section.id} must define at least one item`);
      }
      for (const item of section.items) {
        if (!formItemIds.has(item.id)) {
          throw new Error(`Form item ${item.id} is not registered`);
        }
        if (item.kind === "question" && !questionIds.has(item.questionId)) {
          throw new Error(`Form item ${item.id} references unknown question ${item.questionId}`);
        }
        if (item.kind === "upload") {
          for (const acceptedFileType of item.acceptedFileTypes ?? []) {
            if (acceptedFileType.trim().length === 0) {
              throw new Error(`Upload item ${item.id} has an empty accepted file type`);
            }
          }
        }
        if (item.kind === "signature" && item.required && item.consentText.trim().length === 0) {
          throw new Error(`Signature item ${item.id} requires consent text`);
        }
        if (item.kind === "signature" && item.documentId) {
          throw new Error(`Signature item ${item.id} must use embedded attestation evidence`);
        }
      }
    }
  }

  return definition;
}

export function resolveEmbeddedIntakeAnswers(input: {
  templateId: string;
  templateVersion: number;
  definition: EmbeddedIntakeTemplateDefinition;
  answers: Record<string, unknown>;
  selectedPackageIds?: string[];
  completedItemIds?: string[];
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

  const visibleFormItems =
    definition.schemaVersion === 2
      ? definition.sections
          .flatMap((section) => section.items)
          .filter((item) => item.kind !== "question" || visibleQuestionIds.has(item.questionId))
      : undefined;
  const visibleFormItemIds = visibleFormItems?.map((item) => item.id);
  const completedItemIds = new Set(input.completedItemIds ?? []);
  const requiredIncompleteItemIds =
    definition.schemaVersion === 2
      ? (visibleFormItems ?? [])
          .filter((item) => {
            if (item.kind === "question") {
              const question = definition.questions.find(
                (candidate) => candidate.id === item.questionId,
              );
              return (
                Boolean(question?.required) && !answerIsPresent(input.answers[item.questionId])
              );
            }
            if (item.kind === "display") return false;
            if (!item.required) return false;
            return !completedItemIds.has(item.id);
          })
          .map((item) => item.id)
      : undefined;

  return {
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    visibleQuestionIds: [...visibleQuestionIds],
    visibleFormItemIds,
    requiredIncompleteItemIds,
    eligiblePackageIds: [...eligiblePackageIds],
    selectedPackageIds,
    packageDocuments,
  };
}

export function createIntakeVariableProposals(input: {
  firmId: string;
  matterId: string;
  clientContactId?: string;
  intakeSessionId: string;
  answerSnapshotId: string;
  definition: EmbeddedIntakeTemplateDefinition;
  answers: Record<string, unknown>;
  now: string;
}): IntakeVariableProposal[] {
  const definition = validateEmbeddedIntakeTemplateDefinition(input.definition);
  return definition.questions.flatMap((question) => {
    if (!question.variableMapping) return [];
    const value = input.answers[question.id];
    if (!answerIsPresent(value)) return [];
    const targetRecordId =
      question.variableMapping.targetScope === "client" ? input.clientContactId : input.matterId;
    if (!targetRecordId) return [];
    return [
      {
        id: `${input.answerSnapshotId}:${question.id}:${question.variableMapping.targetScope}:${question.variableMapping.targetField}`,
        firmId: input.firmId,
        matterId: input.matterId,
        intakeSessionId: input.intakeSessionId,
        answerSnapshotId: input.answerSnapshotId,
        sourceQuestionId: question.id,
        targetScope: question.variableMapping.targetScope,
        targetField: question.variableMapping.targetField,
        targetRecordId,
        proposedValue: String(value),
        status: "pending" as const,
        createdAt: input.now,
      },
    ];
  });
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

function assertVariableMapping(mapping: IntakeVariableMapping): void {
  const clientFields = new Set<IntakeClientVariableField>(["displayName", "notes"]);
  const matterFields = new Set<IntakeMatterVariableField>([
    "title",
    "practiceArea",
    "jurisdiction",
  ]);
  if (
    mapping.targetScope === "client" &&
    !clientFields.has(mapping.targetField as IntakeClientVariableField)
  ) {
    throw new Error(`Unsupported client variable field ${mapping.targetField}`);
  }
  if (
    mapping.targetScope === "matter" &&
    !matterFields.has(mapping.targetField as IntakeMatterVariableField)
  ) {
    throw new Error(`Unsupported matter variable field ${mapping.targetField}`);
  }
}

function answerIsPresent(answer: unknown): boolean {
  return answer !== undefined && answer !== null && answer !== "";
}

function branchRuleMatches(rule: EmbeddedIntakeBranchRule, answer: unknown): boolean {
  if (rule.operator === "present") return answerIsPresent(answer);
  if (rule.operator === "includes") {
    return Array.isArray(answer) && answer.includes(rule.value);
  }
  if (rule.operator === "equals") return answer === rule.value;
  return answer !== rule.value;
}
