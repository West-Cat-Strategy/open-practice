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

export interface EmbeddedIntakeQaScenario {
  id: string;
  name: string;
  answers: Record<string, unknown>;
  selectedPackageIds?: string[];
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
  qaScenarios?: EmbeddedIntakeQaScenario[];
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
  parentFormLinkId?: string;
  answerSnapshotId?: string;
  clientSubmissionId?: string;
  submissionFingerprint?: string;
  draftAnswers?: Record<string, unknown>;
  draftUpdatedAt?: string;
  expiresAt: string;
  revokedAt?: string;
  submittedAt?: string;
  createdAt: string;
}

export type IntakeFormReviewDecision = "accepted" | "rejected" | "request_more_info";

export interface IntakeFormReviewRecord {
  id: string;
  firmId: string;
  matterId: string;
  intakeSessionId: string;
  formLinkId: string;
  answerSnapshotId: string;
  decision: IntakeFormReviewDecision;
  decidedByUserId: string;
  decidedAt: string;
  reason?: string;
  followUpFormLinkId?: string;
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

export interface IntakeSelectedPackageSummary {
  packageId: string;
  title: string;
  description?: string;
  default?: boolean;
  documentCount: number;
  documentIds: string[];
}

export interface IntakeResolutionSnapshot {
  templateId: string;
  templateVersion: number;
  visibleQuestionIds: string[];
  visibleFormItemIds?: string[];
  requiredIncompleteItemIds?: string[];
  matchedBranchRuleIds: string[];
  eligiblePackageIds: string[];
  selectedPackageIds: string[];
  packageSummaries: IntakeSelectedPackageSummary[];
  packageDocuments: IntakePackageDocumentResolution[];
}

export type IntakeTemplatePreviewStatus = "pass" | "warnings" | "blocked";

export type IntakeTemplatePreviewCheckSeverity = "warning" | "blocking";

export interface IntakeTemplatePreviewCheck {
  code: string;
  severity: IntakeTemplatePreviewCheckSeverity;
  message: string;
  sectionId?: string;
  itemId?: string;
  questionId?: string;
  packageId?: string;
}

export interface IntakeTemplatePreviewResult {
  status: IntakeTemplatePreviewStatus;
  checks: IntakeTemplatePreviewCheck[];
  preview: IntakeResolutionSnapshot | null;
}

export type IntakeTemplateQaIssueKind =
  | "unmapped_question"
  | "unreachable_branch_question"
  | "broken_signature_document_reference"
  | "missing_required_item"
  | "empty_preview_path";

export interface IntakeTemplateQaIssue {
  kind: IntakeTemplateQaIssueKind;
  severity: "blocker" | "review" | "info";
  message: string;
  questionId?: string;
  branchRuleId?: string;
  formItemId?: string;
  documentId?: string;
}

export interface IntakeTemplateQaPreview {
  id: string;
  label: string;
  answers: Record<string, unknown>;
  selectedPackageIds: string[];
  visibleQuestionIds: string[];
  visibleFormItemIds?: string[];
  requiredIncompleteItemIds?: string[];
  matchedBranchRuleIds: string[];
  eligiblePackageIds: string[];
  packageDocuments: IntakePackageDocumentResolution[];
}

export interface IntakeTemplateQaReport {
  summary: {
    schemaVersion: EmbeddedIntakeTemplateDefinition["schemaVersion"];
    questionCount: number;
    branchRuleCount: number;
    packageCount: number;
    formItemCount: number;
    previewCount: number;
    issueCount: number;
    blockingIssueCount: number;
  };
  issues: IntakeTemplateQaIssue[];
  previews: IntakeTemplateQaPreview[];
}

export type EmbeddedIntakeFormItemKind = EmbeddedIntakeFormItem["kind"];

export const embeddedIntakeFormItemKinds = [
  "display",
  "question",
  "upload",
  "signature",
] as const satisfies readonly EmbeddedIntakeFormItemKind[];

export interface IntakeFormItemValidationContext {
  questionIds: ReadonlySet<string>;
}

export interface IntakeFormItemVisibilityContext {
  visibleQuestionIds: ReadonlySet<string>;
}

export interface IntakeFormItemCompletionContext {
  definition: Extract<EmbeddedIntakeTemplateDefinition, { schemaVersion: 2 }>;
  answers: Record<string, unknown>;
  completedItemIds: ReadonlySet<string>;
}

export interface IntakeFormItemPreviewContext {
  checks: IntakeTemplatePreviewCheck[];
  definition: Extract<EmbeddedIntakeTemplateDefinition, { schemaVersion: 2 }>;
  referencedQuestionIds: Set<string>;
  sectionId: string;
  visibleFormItemIds: readonly string[];
  visibleQuestionIds: ReadonlySet<string>;
}

export interface IntakeFormItemQaContext {
  issues: IntakeTemplateQaIssue[];
  packageDocumentIds: ReadonlySet<string>;
}

export interface EmbeddedIntakeFormItemAdapter {
  kind: EmbeddedIntakeFormItemKind;
  label: string;
  validate: (item: EmbeddedIntakeFormItem, context: IntakeFormItemValidationContext) => void;
  isVisible: (item: EmbeddedIntakeFormItem, context: IntakeFormItemVisibilityContext) => boolean;
  isRequiredIncomplete: (
    item: EmbeddedIntakeFormItem,
    context: IntakeFormItemCompletionContext,
  ) => boolean;
  referencedQuestionId?: (item: EmbeddedIntakeFormItem) => string | undefined;
  collectPreviewChecks: (
    item: EmbeddedIntakeFormItem,
    context: IntakeFormItemPreviewContext,
  ) => void;
  collectQaIssues: (item: EmbeddedIntakeFormItem, context: IntakeFormItemQaContext) => void;
}

export const embeddedIntakeFormItemRegistry = {
  display: {
    kind: "display",
    label: "Display",
    validate: () => undefined,
    isVisible: () => true,
    isRequiredIncomplete: () => false,
    collectPreviewChecks: () => undefined,
    collectQaIssues: () => undefined,
  },
  question: {
    kind: "question",
    label: "Question",
    validate: (item, context) => {
      if (item.kind !== "question") return;
      if (!context.questionIds.has(item.questionId)) {
        throw new Error(`Form item ${item.id} references unknown question ${item.questionId}`);
      }
    },
    isVisible: (item, context) =>
      item.kind !== "question" || context.visibleQuestionIds.has(item.questionId),
    isRequiredIncomplete: (item, context) => {
      if (item.kind !== "question") return false;
      const question = context.definition.questions.find(
        (candidate) => candidate.id === item.questionId,
      );
      return Boolean(question?.required) && !answerIsPresent(context.answers[item.questionId]);
    },
    referencedQuestionId: (item) => (item.kind === "question" ? item.questionId : undefined),
    collectPreviewChecks: (item, context) => {
      if (item.kind !== "question") return;
      context.referencedQuestionIds.add(item.questionId);
      const question = context.definition.questions.find(
        (candidate) => candidate.id === item.questionId,
      );
      if (question?.required && !context.visibleQuestionIds.has(item.questionId)) {
        context.checks.push({
          code: "required_question_hidden",
          severity: "warning",
          message: "A required question is hidden by the current preview answers.",
          sectionId: context.sectionId,
          itemId: item.id,
          questionId: item.questionId,
        });
      }
    },
    collectQaIssues: () => undefined,
  },
  upload: {
    kind: "upload",
    label: "Upload",
    validate: (item) => {
      if (item.kind !== "upload") return;
      for (const acceptedFileType of item.acceptedFileTypes ?? []) {
        if (acceptedFileType.trim().length === 0) {
          throw new Error(`Upload item ${item.id} has an empty accepted file type`);
        }
      }
    },
    isVisible: () => true,
    isRequiredIncomplete: (item, context) => {
      if (item.kind !== "upload" || !item.required) return false;
      return !context.completedItemIds.has(item.id);
    },
    collectPreviewChecks: (item, context) => {
      if (item.kind !== "upload") return;
      if (item.required && !context.visibleFormItemIds.includes(item.id)) {
        context.checks.push({
          code: "required_upload_hidden",
          severity: "warning",
          message: "A required upload item is hidden by the current preview answers.",
          sectionId: context.sectionId,
          itemId: item.id,
        });
      }
    },
    collectQaIssues: (item, context) => {
      if (item.kind !== "upload" || item.required !== true) return;
      context.issues.push({
        kind: "missing_required_item",
        severity: "info",
        message: `Required ${item.kind} item ${item.id} is included in completion coverage`,
        formItemId: item.id,
      });
    },
  },
  signature: {
    kind: "signature",
    label: "Signature",
    validate: (item) => {
      if (item.kind === "signature" && item.required && item.consentText.trim().length === 0) {
        throw new Error(`Signature item ${item.id} requires consent text`);
      }
    },
    isVisible: () => true,
    isRequiredIncomplete: (item, context) => {
      if (item.kind !== "signature" || !item.required) return false;
      return !context.completedItemIds.has(item.id);
    },
    collectPreviewChecks: (item, context) => {
      if (item.kind !== "signature") return;
      if (item.required && !context.visibleFormItemIds.includes(item.id)) {
        context.checks.push({
          code: "required_signature_hidden",
          severity: "warning",
          message: "A required signature item is hidden by the current preview answers.",
          sectionId: context.sectionId,
          itemId: item.id,
        });
      }
      if (item.documentId) {
        context.checks.push({
          code: "signature_document_unverified",
          severity: "warning",
          message: "Signature document availability needs matter-scoped verification.",
          sectionId: context.sectionId,
          itemId: item.id,
        });
      }
    },
    collectQaIssues: (item, context) => {
      if (item.kind !== "signature") return;
      if (item.documentId && !context.packageDocumentIds.has(item.documentId)) {
        context.issues.push({
          kind: "broken_signature_document_reference",
          severity: "blocker",
          message: `Signature item ${item.id} references unknown package document ${item.documentId}`,
          formItemId: item.id,
          documentId: item.documentId,
        });
      }
      if (item.required === true) {
        context.issues.push({
          kind: "missing_required_item",
          severity: "info",
          message: `Required ${item.kind} item ${item.id} is included in completion coverage`,
          formItemId: item.id,
        });
      }
    },
  },
} satisfies Record<EmbeddedIntakeFormItemKind, EmbeddedIntakeFormItemAdapter>;

export function embeddedIntakeFormItemAdapter(
  kind: string,
): EmbeddedIntakeFormItemAdapter | undefined {
  return (embeddedIntakeFormItemRegistry as Partial<Record<string, EmbeddedIntakeFormItemAdapter>>)[
    kind
  ];
}

const legacyIntakeFormItemAdapter = {
  isVisible: (item: EmbeddedIntakeFormItem, context: IntakeFormItemVisibilityContext): boolean =>
    item.kind !== "question" || context.visibleQuestionIds.has(item.questionId),
  isRequiredIncomplete: (
    item: EmbeddedIntakeFormItem,
    context: IntakeFormItemCompletionContext,
  ): boolean => {
    if (item.kind === "question") {
      const question = context.definition.questions.find(
        (candidate) => candidate.id === item.questionId,
      );
      return Boolean(question?.required) && !answerIsPresent(context.answers[item.questionId]);
    }
    if (item.kind === "display") return false;
    if (!item.required) return false;
    return !context.completedItemIds.has(item.id);
  },
};

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
    validateEmbeddedIntakeQaScenarios(definition, { questionIds, packageIds });

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
        const adapter = embeddedIntakeFormItemAdapter(item.kind);
        if (!adapter) {
          throw new Error(`Unsupported form item kind ${String(item.kind)}`);
        }
        adapter.validate(item, { questionIds });
      }
    }
  }

  return definition;
}

function validateEmbeddedIntakeQaScenarios(
  definition: EmbeddedIntakeTemplateDefinitionV2,
  context: {
    questionIds: ReadonlySet<string>;
    packageIds: ReadonlySet<string>;
  },
): void {
  const scenarios = definition.qaScenarios ?? [];
  assertUniqueIds(
    "QA scenario",
    scenarios.map((scenario) => scenario.id),
  );

  for (const scenario of scenarios) {
    if (!scenario.name.trim()) {
      throw new Error(`QA scenario ${scenario.id} must define a name`);
    }
    if (
      !scenario.answers ||
      typeof scenario.answers !== "object" ||
      Array.isArray(scenario.answers)
    ) {
      throw new Error(`QA scenario ${scenario.id} answers must be an object`);
    }
    for (const questionId of Object.keys(scenario.answers)) {
      if (!context.questionIds.has(questionId)) {
        throw new Error(`QA scenario ${scenario.id} answers unknown question ${questionId}`);
      }
    }
    assertUniqueIds(
      `selected package for QA scenario ${scenario.id}`,
      scenario.selectedPackageIds ?? [],
    );
    for (const packageId of scenario.selectedPackageIds ?? []) {
      if (!context.packageIds.has(packageId)) {
        throw new Error(`QA scenario ${scenario.id} selects unknown package ${packageId}`);
      }
    }
  }
}

export function intakeTemplatePreviewStatus(
  checks: IntakeTemplatePreviewCheck[],
): IntakeTemplatePreviewStatus {
  if (checks.some((check) => check.severity === "blocking")) return "blocked";
  if (checks.some((check) => check.severity === "warning")) return "warnings";
  return "pass";
}

export function previewEmbeddedIntakeTemplate(input: {
  templateId: string;
  templateVersion: number;
  definition: EmbeddedIntakeTemplateDefinition;
  answers?: Record<string, unknown>;
  selectedPackageIds?: string[];
}): IntakeTemplatePreviewResult {
  const checks: IntakeTemplatePreviewCheck[] = [];
  let definition: EmbeddedIntakeTemplateDefinition;
  try {
    definition = validateEmbeddedIntakeTemplateDefinition(input.definition);
  } catch (error) {
    checks.push({
      code: "invalid_definition",
      severity: "blocking",
      message: error instanceof Error ? error.message : "Intake definition is invalid",
    });
    return {
      status: "blocked",
      checks,
      preview: null,
    };
  }

  const answers = input.answers ?? {};
  const preview = resolveEmbeddedIntakeAnswers({
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    definition,
    answers,
    selectedPackageIds: input.selectedPackageIds,
  });

  const referencedQuestionIds = new Set<string>();
  const visibleQuestionIds = new Set(preview.visibleQuestionIds);
  const conditionalQuestionIds = new Set(
    definition.branchRules.flatMap((rule) => rule.showQuestionIds ?? []),
  );

  if (definition.packages.length === 0) {
    checks.push({
      code: "no_packages",
      severity: "warning",
      message: "Definition does not include any reusable package previews.",
    });
  } else if (preview.eligiblePackageIds.length === 0) {
    checks.push({
      code: "no_eligible_packages",
      severity: "warning",
      message: "Preview answers do not make any package eligible.",
    });
  }

  if (definition.schemaVersion !== 2) {
    checks.push({
      code: "legacy_schema_preview",
      severity: "warning",
      message: "Staff preview is optimized for schema version 2 intake forms.",
    });
  } else {
    const allItems = definition.sections.flatMap((section) =>
      section.items.map((item) => ({ sectionId: section.id, item })),
    );
    for (const { sectionId, item } of allItems) {
      embeddedIntakeFormItemAdapter(item.kind)?.collectPreviewChecks(item, {
        checks,
        definition,
        referencedQuestionIds,
        sectionId,
        visibleFormItemIds: preview.visibleFormItemIds ?? [],
        visibleQuestionIds,
      });
    }
  }

  for (const question of definition.questions) {
    if (!referencedQuestionIds.has(question.id) && definition.schemaVersion === 2) {
      checks.push({
        code: "unreferenced_question",
        severity: "warning",
        message: "Question is not placed in any form section.",
        questionId: question.id,
      });
    }
    if (question.required && !question.variableMapping) {
      checks.push({
        code: "required_question_unmapped",
        severity: "warning",
        message: "Required question has no reviewed-merge variable mapping.",
        questionId: question.id,
      });
    }
    if (conditionalQuestionIds.has(question.id)) {
      const matchingRules = definition.branchRules.filter((rule) =>
        (rule.showQuestionIds ?? []).includes(question.id),
      );
      const hasPracticalTrigger = matchingRules.some((rule) =>
        branchRuleCanMatch(rule, definition),
      );
      if (!hasPracticalTrigger) {
        checks.push({
          code: "branch_question_without_trigger",
          severity: "warning",
          message: "Branch-only question has no practical trigger in the current definition.",
          questionId: question.id,
        });
      }
    }
  }

  return {
    status: intakeTemplatePreviewStatus(checks),
    checks,
    preview,
  };
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
  const matchedBranchRuleIds: string[] = [];

  for (const rule of definition.branchRules) {
    if (!branchRuleMatches(rule, input.answers[rule.questionId])) continue;
    matchedBranchRuleIds.push(rule.id);
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
  const packageSummaries = definition.packages
    .filter((intakePackage) => selectedPackageIds.includes(intakePackage.id))
    .map((intakePackage) => ({
      packageId: intakePackage.id,
      title: intakePackage.title,
      description: intakePackage.description,
      default: intakePackage.default,
      documentCount: intakePackage.documents.length,
      documentIds: intakePackage.documents.map((document) => document.id),
    }));

  const visibleFormItems =
    definition.schemaVersion === 2
      ? definition.sections
          .flatMap((section) => section.items)
          .filter((item) =>
            (embeddedIntakeFormItemAdapter(item.kind) ?? legacyIntakeFormItemAdapter).isVisible(
              item,
              { visibleQuestionIds },
            ),
          )
      : undefined;
  const visibleFormItemIds = visibleFormItems?.map((item) => item.id);
  const completedItemIds = new Set(input.completedItemIds ?? []);
  const requiredIncompleteItemIds =
    definition.schemaVersion === 2
      ? (visibleFormItems ?? [])
          .filter((item) =>
            (
              embeddedIntakeFormItemAdapter(item.kind) ?? legacyIntakeFormItemAdapter
            ).isRequiredIncomplete(item, {
              answers: input.answers,
              completedItemIds,
              definition,
            }),
          )
          .map((item) => item.id)
      : undefined;

  return {
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    visibleQuestionIds: [...visibleQuestionIds],
    visibleFormItemIds,
    requiredIncompleteItemIds,
    matchedBranchRuleIds,
    eligiblePackageIds: [...eligiblePackageIds],
    selectedPackageIds,
    packageSummaries,
    packageDocuments,
  };
}

export function buildEmbeddedIntakeTemplateQaReport(input: {
  templateId: string;
  templateVersion: number;
  definition: EmbeddedIntakeTemplateDefinition;
}): IntakeTemplateQaReport {
  const definition = validateEmbeddedIntakeTemplateDefinition(input.definition);
  const issues: IntakeTemplateQaIssue[] = [];
  const formItems =
    definition.schemaVersion === 2 ? definition.sections.flatMap((section) => section.items) : [];
  const formQuestionIds = new Set<string>();
  for (const item of formItems) {
    const questionId = embeddedIntakeFormItemAdapter(item.kind)?.referencedQuestionId?.(item);
    if (questionId) formQuestionIds.add(questionId);
  }
  const branchShownQuestionIds = new Set(
    definition.branchRules.flatMap((rule) => rule.showQuestionIds ?? []),
  );
  const packageDocumentIds = new Set(
    definition.packages.flatMap((intakePackage) =>
      intakePackage.documents.map((document) => document.id),
    ),
  );

  if (definition.schemaVersion === 2) {
    for (const question of definition.questions) {
      if (!formQuestionIds.has(question.id)) {
        issues.push({
          kind: "unmapped_question",
          severity: "review",
          message: `Question ${question.id} is not present in any staff-authored form section`,
          questionId: question.id,
        });
      }
    }

    for (const questionId of branchShownQuestionIds) {
      if (!formQuestionIds.has(questionId)) {
        issues.push({
          kind: "unreachable_branch_question",
          severity: "blocker",
          message: `Branch-visible question ${questionId} is not reachable from form sections`,
          questionId,
        });
      }
    }

    for (const item of formItems) {
      embeddedIntakeFormItemAdapter(item.kind)?.collectQaIssues(item, {
        issues,
        packageDocumentIds,
      });
    }
  }

  const previews: IntakeTemplateQaPreview[] = [
    buildQaPreview({
      id: "base",
      label: "Base path",
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      definition,
      answers: {},
    }),
    ...definition.branchRules.map((rule) =>
      buildQaPreview({
        id: `branch:${rule.id}`,
        label: `Branch rule ${rule.id}`,
        templateId: input.templateId,
        templateVersion: input.templateVersion,
        definition,
        answers: { [rule.questionId]: sampleAnswerForBranchRule(rule) },
        branchRuleId: rule.id,
      }),
    ),
    ...(definition.schemaVersion === 2
      ? (definition.qaScenarios ?? []).map((scenario) =>
          buildQaPreview({
            id: `scenario:${scenario.id}`,
            label: scenario.name,
            templateId: input.templateId,
            templateVersion: input.templateVersion,
            definition,
            answers: scenario.answers,
            selectedPackageIds: scenario.selectedPackageIds,
          }),
        )
      : []),
  ];

  for (const preview of previews) {
    if (
      preview.visibleQuestionIds.length === 0 &&
      (preview.visibleFormItemIds?.length ?? 0) === 0
    ) {
      issues.push({
        kind: "empty_preview_path",
        severity: "blocker",
        message: `Synthetic preview ${preview.id} does not expose any questions or form items`,
      });
    }
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === "blocker").length;
  return {
    summary: {
      schemaVersion: definition.schemaVersion,
      questionCount: definition.questions.length,
      branchRuleCount: definition.branchRules.length,
      packageCount: definition.packages.length,
      formItemCount: formItems.length,
      previewCount: previews.length,
      issueCount: issues.length,
      blockingIssueCount,
    },
    issues,
    previews,
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

function buildQaPreview(input: {
  id: string;
  label: string;
  templateId: string;
  templateVersion: number;
  definition: EmbeddedIntakeTemplateDefinition;
  answers: Record<string, unknown>;
  selectedPackageIds?: string[];
  branchRuleId?: string;
}): IntakeTemplateQaPreview {
  const snapshot = resolveEmbeddedIntakeAnswers({
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    definition: input.definition,
    answers: input.answers,
    selectedPackageIds: input.selectedPackageIds,
  });
  return {
    id: input.id,
    label: input.label,
    answers: input.answers,
    selectedPackageIds: snapshot.selectedPackageIds,
    visibleQuestionIds: snapshot.visibleQuestionIds,
    visibleFormItemIds: snapshot.visibleFormItemIds,
    requiredIncompleteItemIds: snapshot.requiredIncompleteItemIds,
    matchedBranchRuleIds: snapshot.matchedBranchRuleIds,
    eligiblePackageIds: snapshot.eligiblePackageIds,
    packageDocuments: snapshot.packageDocuments,
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

function sampleAnswerForBranchRule(rule: EmbeddedIntakeBranchRule): unknown {
  if (rule.operator === "present") return "synthetic-preview-value";
  if (rule.operator === "not_equals") return `not-${String(rule.value ?? "empty")}`;
  if (rule.operator === "includes") return [rule.value ?? "synthetic-preview-value"];
  return rule.value ?? "synthetic-preview-value";
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

function branchRuleCanMatch(
  rule: EmbeddedIntakeBranchRule,
  definition: EmbeddedIntakeTemplateDefinition,
): boolean {
  if (rule.operator === "present") return true;
  if (rule.operator === "not_equals") return true;
  const question = definition.questions.find((candidate) => candidate.id === rule.questionId);
  if (!question) return false;
  if (question.type === "select") {
    return Boolean(question.options?.some((option) => option.value === rule.value));
  }
  if (question.type === "boolean") return typeof rule.value === "boolean";
  if (rule.operator === "includes") return false;
  return rule.value !== undefined;
}
