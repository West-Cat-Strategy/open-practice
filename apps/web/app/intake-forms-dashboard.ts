import {
  describeOperationalActionState,
  disabledOperationalAction,
  type OperationalActionState,
} from "@open-practice/domain/operational-actions";
import type {
  AnswerSnapshotRecord,
  EmbeddedIntakeBranchOperator,
  EmbeddedIntakeBranchRule,
  EmbeddedIntakeFormItem,
  EmbeddedIntakeFormItemKind,
  EmbeddedIntakeTemplateDefinitionV2,
  IntakeTemplatePreviewCheckSeverity,
  IntakeFormItemActionRecord,
  IntakeFormReviewRecord,
  IntakeVariableMapping,
  IntakeVariableTargetScope,
  IntakeTemplateRecord,
  IntakeVariableProposal,
} from "@open-practice/domain";
import type {
  IntakeFormLinkSummary,
  IntakeFormReviewResponse,
  IntakeFormsDashboardResponse,
  IntakeTemplatePreviewResponse,
  MatterSummary,
} from "./types";

export interface IntakeFormLinkCreateFormState {
  intakeSessionId: string;
  expiresAtLocal: string;
}

export type IntakePreviewAnswers = Record<string, string | boolean>;

export const clientVariableFields = ["displayName", "notes"] as const;
export const matterVariableFields = ["title", "practiceArea", "jurisdiction"] as const;
export const questionTypes = ["text", "textarea", "select", "boolean", "date"] as const;
export const branchRuleOperators = [
  "equals",
  "not_equals",
  "includes",
  "present",
] as const satisfies readonly EmbeddedIntakeBranchOperator[];
export const itemKinds = [
  "display",
  "question",
  "upload",
  "signature",
] as const satisfies readonly EmbeddedIntakeFormItemKind[];

export interface IntakeBuilderItemAdapter {
  kind: EmbeddedIntakeFormItemKind;
  makeItem: (index: number) => EmbeddedIntakeFormItem;
}

export const intakeBuilderItemRegistry = {
  display: {
    kind: "display",
    makeItem: (index) => ({
      id: `display-${index + 1}`,
      kind: "display",
      body: "Client-facing text.",
    }),
  },
  question: {
    kind: "question",
    makeItem: (index) => ({
      id: `question-${index + 1}`,
      kind: "question",
      questionId: "client_display_name",
    }),
  },
  upload: {
    kind: "upload",
    makeItem: (index) => ({
      id: `upload-${index + 1}`,
      kind: "upload",
      label: "Supporting document",
      required: false,
      acceptedFileTypes: ["application/pdf", "image/png", "image/jpeg"],
    }),
  },
  signature: {
    kind: "signature",
    makeItem: (index) => ({
      id: `signature-${index + 1}`,
      kind: "signature",
      label: "Client attestation",
      required: true,
      consentText: "I confirm these intake answers are accurate.",
    }),
  },
} satisfies Record<EmbeddedIntakeFormItemKind, IntakeBuilderItemAdapter>;

export interface IntakeBuilderDiagnostic {
  id: string;
  code:
    | "duplicate_id"
    | "missing_question_reference"
    | "unsupported_mapping_target"
    | "broken_branch_reference"
    | "broken_package_reference"
    | "broken_document_reference"
    | "branch_value_mismatch"
    | "empty_section"
    | "signature_document_unverified";
  severity: IntakeTemplatePreviewCheckSeverity;
  message: string;
  sectionId?: string;
  itemId?: string;
  questionId?: string;
  branchRuleId?: string;
  packageId?: string;
  documentId?: string;
}

export const blankIntakeFormDefinition: EmbeddedIntakeTemplateDefinitionV2 = {
  schemaVersion: 2,
  questions: [
    {
      id: "client_display_name",
      label: "Client name",
      type: "text",
      required: true,
      variableMapping: { targetScope: "client", targetField: "displayName" },
    },
    {
      id: "matter_title",
      label: "Matter title",
      type: "text",
      required: true,
      variableMapping: { targetScope: "matter", targetField: "title" },
    },
  ],
  branchRules: [],
  packages: [],
  sections: [
    {
      id: "client-basics",
      title: "Client basics",
      items: [
        {
          id: "intro",
          kind: "display",
          body: "Synthetic intake details for staff review.",
        },
        {
          id: "client-name-item",
          kind: "question",
          questionId: "client_display_name",
        },
        {
          id: "matter-title-item",
          kind: "question",
          questionId: "matter_title",
        },
        {
          id: "supporting-upload",
          kind: "upload",
          label: "Supporting document",
          required: false,
          acceptedFileTypes: ["application/pdf", "image/png", "image/jpeg"],
        },
        {
          id: "client-attestation",
          kind: "signature",
          label: "Client attestation",
          required: true,
          consentText:
            "I confirm that these intake answers are accurate to the best of my knowledge.",
        },
      ],
    },
  ],
};

export function buildIntakeFormLinkListPath(matterId: string): string {
  return `/api/intake-form-links?matterId=${encodeURIComponent(matterId)}`;
}

export function buildIntakePortalPath(token: string): string {
  return `/intake-forms#${encodeURIComponent(token)}`;
}

export function buildIntakeVariableProposalListPath(matterId: string): string {
  return `/api/intake-variable-proposals?matterId=${encodeURIComponent(matterId)}`;
}

export function buildIntakeFormReviewPath(linkId: string): string {
  return `/api/intake-form-links/${encodeURIComponent(linkId)}/review`;
}

export function buildIntakeFormReviewDecisionPath(
  linkId: string,
  decision: "accept" | "reject" | "request-more-info",
): string {
  return `/api/intake-form-links/${encodeURIComponent(linkId)}/review/${decision}`;
}

export type SubmittedIntakeReviewAction = "load" | "accept" | "reject" | "request_more_info";
export type SubmittedIntakeReviewBusyAction = SubmittedIntakeReviewAction | "other";

const submittedIntakeReviewActionDescriptors: Record<
  SubmittedIntakeReviewAction,
  {
    actionKey: string;
    label: string;
    busyLabel: string;
  }
> = {
  load: {
    actionKey: "submitted_intake_review.load",
    label: "Load review",
    busyLabel: "Loading...",
  },
  accept: {
    actionKey: "submitted_intake_review.accept",
    label: "Accept",
    busyLabel: "Accepting...",
  },
  reject: {
    actionKey: "submitted_intake_review.reject",
    label: "Reject",
    busyLabel: "Rejecting...",
  },
  request_more_info: {
    actionKey: "submitted_intake_review.request_more_info",
    label: "More info",
    busyLabel: "Creating follow-up...",
  },
};

export function submittedIntakeReviewBusyAction(input: {
  linkId: string;
  loadingLinkId?: string;
  reviewingKey?: string;
}): SubmittedIntakeReviewBusyAction | undefined {
  if (input.loadingLinkId === input.linkId) return "load";
  if (!input.reviewingKey?.startsWith(`${input.linkId}:`)) return undefined;
  const action = input.reviewingKey.slice(input.linkId.length + 1);
  if (action === "accept" || action === "reject") return action;
  if (action === "request-more-info") return "request_more_info";
  return "other";
}

export function compactSubmittedIntakeReviewActionReason(value?: string): string {
  if (!value) return "available";
  const labels: Record<string, string> = {
    load_in_progress: "review load in progress",
    decision_in_progress: "decision in progress",
    review_payload_required: "review payload required",
    decision_already_recorded: "decision already recorded",
    reason_required: "reason required",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function describeSubmittedIntakeReviewAction(input: {
  action: SubmittedIntakeReviewAction;
  reviewLoaded: boolean;
  reviewDecisionCount?: number;
  reason?: string;
  busyAction?: SubmittedIntakeReviewBusyAction;
}): OperationalActionState {
  const descriptor = submittedIntakeReviewActionDescriptors[input.action];
  const loadBusy = input.busyAction === "load";
  const decisionBusy = input.busyAction !== undefined && input.busyAction !== "load";
  const sameDecisionBusy = decisionBusy && input.busyAction === input.action;
  const decisionAction = input.action !== "load";
  const decisionAlreadyRecorded = decisionAction && (input.reviewDecisionCount ?? 0) > 0;
  const reasonRequired =
    (input.action === "reject" || input.action === "request_more_info") &&
    input.reviewLoaded &&
    !decisionAlreadyRecorded &&
    !input.reason?.trim();

  return describeOperationalActionState({
    actionKey: descriptor.actionKey,
    label: descriptor.label,
    availableTone:
      input.action === "reject" ? "risk" : input.action === "accept" ? "ready" : "neutral",
    disabledWhen: [
      loadBusy &&
        disabledOperationalAction("load_in_progress", {
          label: input.action === "load" ? descriptor.busyLabel : undefined,
        }),
      sameDecisionBusy &&
        disabledOperationalAction("decision_in_progress", {
          label: descriptor.busyLabel,
        }),
      decisionBusy && disabledOperationalAction("decision_in_progress"),
      decisionAction && !input.reviewLoaded && disabledOperationalAction("review_payload_required"),
      decisionAlreadyRecorded && disabledOperationalAction("decision_already_recorded"),
      reasonRequired && disabledOperationalAction("reason_required"),
    ],
  });
}

export function describeRequestMoreInfoResult(payload: IntakeFormReviewResponse): string {
  if (payload.followUp?.token && payload.followUp.portalUrl) {
    return "Follow-up intake link created. One-time token remains available below.";
  }
  return "Follow-up intake link created; token unavailable.";
}

export interface IntakeFormReviewLoadResponse {
  link: IntakeFormLinkSummary;
  snapshot: AnswerSnapshotRecord;
  actions: IntakeFormItemActionRecord[];
  reviews: IntakeFormReviewRecord[];
}

export function pendingSubmittedIntakeReviewLinks(
  links: IntakeFormLinkSummary[],
  loadedReviews: Record<string, IntakeFormReviewLoadResponse | undefined> = {},
): IntakeFormLinkSummary[] {
  return links.filter((link) => {
    if (!link.submittedAt && link.status !== "submitted") return false;
    const loaded = loadedReviews[link.id];
    return !loaded || loaded.reviews.length === 0;
  });
}

export function summarizeIntakeReview(review: IntakeFormReviewRecord): string {
  const reason = review.reason ? ` · ${review.reason}` : "";
  const followUp = review.followUpFormLinkId ? ` · follow-up ${review.followUpFormLinkId}` : "";
  return `${review.decision.replaceAll("_", " ")} · ${review.decidedAt}${reason}${followUp}`;
}

export function summarizeAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return "blank";
  const normalized =
    typeof value === "string" ? value : JSON.stringify(value, (_key, nested) => nested);
  if (!normalized) return "blank";
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

export function buildIntakeTemplatePreviewPayload(input: {
  definition: EmbeddedIntakeTemplateDefinitionV2;
  matterId?: string;
  answers: IntakePreviewAnswers;
  selectedPackageIds?: string[];
}): {
  definition: EmbeddedIntakeTemplateDefinitionV2;
  matterId?: string;
  answers: IntakePreviewAnswers;
  selectedPackageIds?: string[];
} {
  return {
    definition: input.definition,
    ...(input.matterId ? { matterId: input.matterId } : {}),
    answers: input.answers,
    ...(input.selectedPackageIds ? { selectedPackageIds: input.selectedPackageIds } : {}),
  };
}

export function describeIntakeTemplatePreview(
  result: IntakeTemplatePreviewResponse | null,
): string {
  if (!result) return "Preview checks have not run.";
  if (result.status === "pass") return "Preview passed with no checks.";
  const warnings = result.checks.filter((check) => check.severity === "warning").length;
  const blocking = result.checks.filter((check) => check.severity === "blocking").length;
  if (blocking > 0) return `Preview blocked by ${blocking} check${blocking === 1 ? "" : "s"}.`;
  return `Preview has ${warnings} warning${warnings === 1 ? "" : "s"}.`;
}

export function previewStatusClass(result: IntakeTemplatePreviewResponse | null): string {
  if (!result) return "muted";
  if (result.status === "blocked") return "risk";
  if (result.status === "warnings") return "warning";
  return "success";
}

export function buildIntakeFormLinkCreatePayload(input: IntakeFormLinkCreateFormState): {
  intakeSessionId: string;
  expiresAt?: string;
} {
  const expiresAt = input.expiresAtLocal.trim()
    ? new Date(input.expiresAtLocal).toISOString()
    : undefined;
  return {
    intakeSessionId: input.intakeSessionId,
    ...(expiresAt ? { expiresAt } : {}),
  };
}

export function getIntakeFormLinkState(
  link: IntakeFormLinkSummary,
  now = new Date(),
): "active" | "expired" | "revoked" | "submitted" {
  if (link.revokedAt) return "revoked";
  if (link.submittedAt || link.status === "submitted") return "submitted";
  if (Date.parse(link.expiresAt) <= now.getTime()) return "expired";
  return "active";
}

export function upsertIntakeFormLink(
  linksByMatterId: Record<string, IntakeFormLinkSummary[]>,
  link: IntakeFormLinkSummary,
): Record<string, IntakeFormLinkSummary[]> {
  const matterLinks = linksByMatterId[link.matterId] ?? [];
  const nextMatterLinks = matterLinks.some((candidate) => candidate.id === link.id)
    ? matterLinks.map((candidate) => (candidate.id === link.id ? link : candidate))
    : [link, ...matterLinks];

  return {
    ...linksByMatterId,
    [link.matterId]: nextMatterLinks,
  };
}

export function upsertIntakeVariableProposal(
  proposalsByMatterId: Record<string, IntakeVariableProposal[]>,
  proposal: IntakeVariableProposal,
): Record<string, IntakeVariableProposal[]> {
  const matterProposals = proposalsByMatterId[proposal.matterId] ?? [];
  const nextMatterProposals = matterProposals.some((candidate) => candidate.id === proposal.id)
    ? matterProposals.map((candidate) => (candidate.id === proposal.id ? proposal : candidate))
    : [proposal, ...matterProposals];

  return {
    ...proposalsByMatterId,
    [proposal.matterId]: nextMatterProposals,
  };
}

export function buildIntakeTemplateEditorValue(template?: IntakeTemplateRecord): string {
  return JSON.stringify(template?.definition ?? blankIntakeFormDefinition, null, 2);
}

export function cloneIntakeDefinition(
  definition: EmbeddedIntakeTemplateDefinitionV2,
): EmbeddedIntakeTemplateDefinitionV2 {
  return JSON.parse(JSON.stringify(definition)) as EmbeddedIntakeTemplateDefinitionV2;
}

export function coerceIntakeDefinitionV2(
  template?: IntakeTemplateRecord,
): EmbeddedIntakeTemplateDefinitionV2 {
  if (template?.definition.schemaVersion === 2) return cloneIntakeDefinition(template.definition);
  return cloneIntakeDefinition(blankIntakeFormDefinition);
}

export function variableTargetFields(scope: IntakeVariableTargetScope): readonly string[] {
  return scope === "client" ? clientVariableFields : matterVariableFields;
}

export function buildVariableMapping(
  scope: IntakeVariableTargetScope,
  field: string,
): IntakeVariableMapping | undefined {
  if (field.length === 0) return undefined;
  if (!variableTargetFields(scope).includes(field)) return undefined;
  return { targetScope: scope, targetField: field as IntakeVariableMapping["targetField"] };
}

export interface IntakeBranchRulePathSummary {
  ruleId: string;
  trigger: string;
  path: string;
  visibleQuestionIds: string[];
  visibleFormItemIds: string[];
  requiredIncompleteItemIds: string[];
  matchedBranchRuleIds: string[];
  eligiblePackageIds: string[];
  packageDocumentCount: number;
}

export function makeIntakeBranchRule(
  definition: EmbeddedIntakeTemplateDefinitionV2,
): EmbeddedIntakeBranchRule {
  return {
    id: uniqueDefinitionId(
      "branch",
      definition.branchRules.map((rule) => rule.id),
    ),
    questionId: definition.questions[0]?.id ?? "",
    operator: "present",
    showQuestionIds: [],
    eligiblePackageIds: [],
  };
}

export function summarizeIntakeBranchRuleTrigger(
  rule: EmbeddedIntakeBranchRule,
  definition: EmbeddedIntakeTemplateDefinitionV2,
): string {
  const question = definition.questions.find((candidate) => candidate.id === rule.questionId);
  const questionLabel = (question?.label ?? rule.questionId) || "missing question";
  if (rule.operator === "present") return `${questionLabel} is present`;
  const value = summarizeAnswerValue(rule.value);
  if (rule.operator === "equals") return `${questionLabel} equals ${value}`;
  if (rule.operator === "not_equals") return `${questionLabel} is not ${value}`;
  return `${questionLabel} includes ${value}`;
}

export function summarizeIntakeBranchPathCounts(summary: {
  visibleQuestionIds: readonly string[];
  visibleFormItemIds: readonly string[];
  requiredIncompleteItemIds: readonly string[];
  eligiblePackageIds: readonly string[];
  packageDocumentCount: number;
}): string {
  return [
    `${summary.visibleQuestionIds.length} visible question${summary.visibleQuestionIds.length === 1 ? "" : "s"}`,
    `${summary.visibleFormItemIds.length} visible item${summary.visibleFormItemIds.length === 1 ? "" : "s"}`,
    `${summary.requiredIncompleteItemIds.length} required incomplete`,
    `${summary.eligiblePackageIds.length} package${summary.eligiblePackageIds.length === 1 ? "" : "s"}`,
    `${summary.packageDocumentCount} document${summary.packageDocumentCount === 1 ? "" : "s"}`,
  ].join(" · ");
}

export function summarizeIntakeBranchRulePath(
  rule: EmbeddedIntakeBranchRule,
  definition: EmbeddedIntakeTemplateDefinitionV2,
): IntakeBranchRulePathSummary {
  const answers = { [rule.questionId]: sampleBranchRuleAnswer(rule) };
  const conditionalQuestionIds = new Set(
    definition.branchRules.flatMap((candidate) => candidate.showQuestionIds ?? []),
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

  for (const candidate of definition.branchRules) {
    if (!branchRuleMatches(candidate, answers[candidate.questionId])) continue;
    matchedBranchRuleIds.push(candidate.id);
    for (const questionId of candidate.showQuestionIds ?? []) visibleQuestionIds.add(questionId);
    for (const packageId of candidate.eligiblePackageIds ?? []) eligiblePackageIds.add(packageId);
  }

  const selectedPackageIds = [...eligiblePackageIds];
  const packageDocumentCount = definition.packages
    .filter((intakePackage) => selectedPackageIds.includes(intakePackage.id))
    .reduce((total, intakePackage) => total + intakePackage.documents.length, 0);
  const visibleFormItems = definition.sections
    .flatMap((section) => section.items)
    .filter((item) => item.kind !== "question" || visibleQuestionIds.has(item.questionId));
  const visibleFormItemIds = visibleFormItems.map((item) => item.id);
  const requiredIncompleteItemIds = visibleFormItems
    .filter((item) => {
      if (item.kind === "question") {
        const question = definition.questions.find((candidate) => candidate.id === item.questionId);
        return Boolean(question?.required) && !answerIsPresent(answers[item.questionId]);
      }
      if (item.kind === "display") return false;
      return Boolean(item.required);
    })
    .map((item) => item.id);
  const summary = {
    visibleQuestionIds: [...visibleQuestionIds],
    visibleFormItemIds,
    requiredIncompleteItemIds,
    matchedBranchRuleIds,
    eligiblePackageIds: [...eligiblePackageIds],
    packageDocumentCount,
  };

  return {
    ruleId: rule.id,
    trigger: summarizeIntakeBranchRuleTrigger(rule, definition),
    path: summarizeIntakeBranchPathCounts(summary),
    ...summary,
  };
}

function uniqueDefinitionId(prefix: string, existing: string[]): string {
  let index = existing.length + 1;
  let id = `${prefix}-${index}`;
  while (existing.includes(id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }
  return id;
}

function sampleBranchRuleAnswer(rule: EmbeddedIntakeBranchRule): unknown {
  if (rule.operator === "present") return "synthetic-preview-value";
  if (rule.operator === "not_equals") return `not-${String(rule.value ?? "empty")}`;
  if (rule.operator === "includes") return [rule.value ?? "synthetic-preview-value"];
  return rule.value ?? "synthetic-preview-value";
}

function branchRuleMatches(rule: EmbeddedIntakeBranchRule, answer: unknown): boolean {
  if (rule.operator === "present") return answerIsPresent(answer);
  if (rule.operator === "includes") {
    return Array.isArray(answer) && answer.includes(rule.value);
  }
  if (rule.operator === "equals") return answer === rule.value;
  return answer !== rule.value;
}

function answerIsPresent(answer: unknown): boolean {
  return answer !== undefined && answer !== null && answer !== "";
}

function duplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

function pushDuplicateDiagnostics(input: {
  diagnostics: IntakeBuilderDiagnostic[];
  label: string;
  values: string[];
  scopeId: string;
  makeDiagnostic: (id: string) => IntakeBuilderDiagnostic;
}): void {
  for (const id of duplicateValues(input.values)) {
    input.diagnostics.push({
      ...input.makeDiagnostic(id),
      id: `duplicate-${input.scopeId}-${id}`,
      code: "duplicate_id",
      severity: "blocking",
      message: `Duplicate ${input.label} ID "${id}".`,
    });
  }
}

export function buildIntakeBuilderDiagnostics(
  definition: EmbeddedIntakeTemplateDefinitionV2,
): IntakeBuilderDiagnostic[] {
  const diagnostics: IntakeBuilderDiagnostic[] = [];
  const questionIds = definition.questions.map((question) => question.id);
  const questionIdSet = new Set(questionIds);
  const packageIds = definition.packages.map((intakePackage) => intakePackage.id);
  const packageIdSet = new Set(packageIds);
  const packageDocumentIdSet = new Set(
    definition.packages.flatMap((intakePackage) =>
      intakePackage.documents.map((document) => document.id),
    ),
  );
  const sectionIds = definition.sections.map((section) => section.id);
  const itemIds = definition.sections.flatMap((section) => section.items.map((item) => item.id));
  const branchRuleIds = definition.branchRules.map((rule) => rule.id);

  pushDuplicateDiagnostics({
    diagnostics,
    label: "question",
    values: questionIds,
    scopeId: "questions",
    makeDiagnostic: (questionId) => ({ questionId }) as IntakeBuilderDiagnostic,
  });
  pushDuplicateDiagnostics({
    diagnostics,
    label: "section",
    values: sectionIds,
    scopeId: "sections",
    makeDiagnostic: (sectionId) => ({ sectionId }) as IntakeBuilderDiagnostic,
  });
  pushDuplicateDiagnostics({
    diagnostics,
    label: "form item",
    values: itemIds,
    scopeId: "items",
    makeDiagnostic: (itemId) => ({ itemId }) as IntakeBuilderDiagnostic,
  });
  pushDuplicateDiagnostics({
    diagnostics,
    label: "branch rule",
    values: branchRuleIds,
    scopeId: "branch-rules",
    makeDiagnostic: (branchRuleId) => ({ branchRuleId }) as IntakeBuilderDiagnostic,
  });
  pushDuplicateDiagnostics({
    diagnostics,
    label: "package",
    values: packageIds,
    scopeId: "packages",
    makeDiagnostic: (packageId) => ({ packageId }) as IntakeBuilderDiagnostic,
  });

  for (const question of definition.questions) {
    const mapping = question.variableMapping;
    if (!mapping) continue;
    const fields =
      mapping.targetScope === "client" || mapping.targetScope === "matter"
        ? variableTargetFields(mapping.targetScope)
        : [];
    if (!fields.includes(mapping.targetField)) {
      diagnostics.push({
        id: `mapping-${question.id}`,
        code: "unsupported_mapping_target",
        severity: "blocking",
        message: `Question "${question.id}" maps to unsupported target "${mapping.targetScope}.${mapping.targetField}".`,
        questionId: question.id,
      });
    }
  }

  for (const section of definition.sections) {
    if (section.items.length === 0) {
      diagnostics.push({
        id: `empty-section-${section.id}`,
        code: "empty_section",
        severity: "blocking",
        message: `Section "${section.id}" has no form items.`,
        sectionId: section.id,
      });
    }

    for (const item of section.items) {
      if (item.kind === "question" && !questionIdSet.has(item.questionId)) {
        diagnostics.push({
          id: `missing-question-${section.id}-${item.id}-${item.questionId}`,
          code: "missing_question_reference",
          severity: "blocking",
          message: `Form item "${item.id}" references missing question "${item.questionId}".`,
          sectionId: section.id,
          itemId: item.id,
          questionId: item.questionId,
        });
      }
      if (item.kind === "signature" && item.documentId) {
        if (!packageDocumentIdSet.has(item.documentId)) {
          diagnostics.push({
            id: `signature-document-missing-${section.id}-${item.id}-${item.documentId}`,
            code: "broken_document_reference",
            severity: "blocking",
            message: `Signature item "${item.id}" references missing package document "${item.documentId}".`,
            sectionId: section.id,
            itemId: item.id,
            documentId: item.documentId,
          });
        } else {
          diagnostics.push({
            id: `signature-document-${section.id}-${item.id}-${item.documentId}`,
            code: "signature_document_unverified",
            severity: "warning",
            message: `Signature item "${item.id}" references document "${item.documentId}", which needs matter-scoped verification before client use.`,
            sectionId: section.id,
            itemId: item.id,
            documentId: item.documentId,
          });
        }
      }
    }
  }

  for (const rule of definition.branchRules) {
    const sourceQuestion = definition.questions.find((question) => question.id === rule.questionId);
    if (!sourceQuestion) {
      diagnostics.push({
        id: `branch-question-${rule.id}-${rule.questionId}`,
        code: "broken_branch_reference",
        severity: "blocking",
        message: `Branch rule "${rule.id}" depends on missing question "${rule.questionId}".`,
        branchRuleId: rule.id,
        questionId: rule.questionId,
      });
    } else if (
      rule.value !== undefined &&
      (rule.operator === "equals" || rule.operator === "not_equals" || rule.operator === "includes")
    ) {
      const allowedValues =
        sourceQuestion.type === "select"
          ? (sourceQuestion.options ?? []).map((option) => option.value)
          : [];
      const mismatched =
        sourceQuestion.type === "boolean"
          ? typeof rule.value !== "boolean"
          : sourceQuestion.type === "select" && !allowedValues.includes(String(rule.value));
      if (mismatched) {
        diagnostics.push({
          id: `branch-value-${rule.id}-${rule.questionId}`,
          code: "branch_value_mismatch",
          severity: "warning",
          message: `Branch rule "${rule.id}" uses a value that does not match question "${rule.questionId}".`,
          branchRuleId: rule.id,
          questionId: rule.questionId,
        });
      }
    }
    for (const questionId of rule.showQuestionIds ?? []) {
      if (!questionIdSet.has(questionId)) {
        diagnostics.push({
          id: `branch-show-question-${rule.id}-${questionId}`,
          code: "broken_branch_reference",
          severity: "blocking",
          message: `Branch rule "${rule.id}" shows missing question "${questionId}".`,
          branchRuleId: rule.id,
          questionId,
        });
      }
    }
    for (const packageId of rule.eligiblePackageIds ?? []) {
      if (!packageIdSet.has(packageId)) {
        diagnostics.push({
          id: `branch-package-${rule.id}-${packageId}`,
          code: "broken_package_reference",
          severity: "blocking",
          message: `Branch rule "${rule.id}" references missing package "${packageId}".`,
          branchRuleId: rule.id,
          packageId,
        });
      }
    }
  }

  for (const intakePackage of definition.packages) {
    if (intakePackage.documents.length === 0) {
      diagnostics.push({
        id: `package-documents-empty-${intakePackage.id}`,
        code: "broken_document_reference",
        severity: "blocking",
        message: `Package "${intakePackage.id}" has no document definitions.`,
        packageId: intakePackage.id,
      });
    }
    pushDuplicateDiagnostics({
      diagnostics,
      label: `document for package ${intakePackage.id}`,
      values: intakePackage.documents.map((document) => document.id),
      scopeId: `package-${intakePackage.id}-documents`,
      makeDiagnostic: (documentId) =>
        ({
          packageId: intakePackage.id,
          documentId,
        }) as IntakeBuilderDiagnostic,
    });
  }

  return diagnostics;
}

export function summarizeIntakeItemAction(action: IntakeFormItemActionRecord): string {
  const label =
    action.kind === "upload"
      ? "upload"
      : action.signatureRequestId
        ? "signature request"
        : "signature";
  return `${label}: ${action.status.replaceAll("_", " ")}`;
}

export function currentProposalValue(
  proposal: IntakeVariableProposal,
  matter?: MatterSummary,
): string {
  if (!matter) return "unknown";
  if (proposal.targetScope === "matter") {
    if (proposal.targetField === "title") return matter.title;
    if (proposal.targetField === "practiceArea") return matter.practiceArea;
    if (proposal.targetField === "jurisdiction") return matter.jurisdiction;
    return "unknown";
  }
  const contact = matter.parties
    .map((party) => party.contact)
    .find((candidate) => candidate.id === proposal.targetRecordId);
  if (!contact) return "unknown";
  if (proposal.targetField === "displayName") return contact.displayName;
  if (proposal.targetField === "notes") return contact.notes ?? "";
  return "unknown";
}

export function makeIntakeItem(
  kind: EmbeddedIntakeFormItemKind,
  index: number,
): EmbeddedIntakeFormItem {
  return intakeBuilderItemRegistry[kind].makeItem(index);
}

export async function loadIntakeFormsDashboardData(input: {
  matters: MatterSummary[];
  listLinksForMatter: (matterId: string) => Promise<{
    links: IntakeFormLinkSummary[];
    actionsByLinkId?: Record<string, IntakeFormItemActionRecord[]>;
  }>;
  listProposalsForMatter: (matterId: string) => Promise<IntakeVariableProposal[]>;
}): Promise<IntakeFormsDashboardResponse> {
  const entries = await Promise.all(
    input.matters.map(async (matter) => {
      const [linkPayload, proposals] = await Promise.all([
        input.listLinksForMatter(matter.id),
        input.listProposalsForMatter(matter.id),
      ]);
      return [matter.id, { ...linkPayload, proposals }] as const;
    }),
  );

  return {
    linksByMatterId: Object.fromEntries(entries.map(([matterId, data]) => [matterId, data.links])),
    actionsByLinkId: Object.assign(
      {},
      ...entries.map(([, data]) => data.actionsByLinkId ?? {}),
    ) as Record<string, IntakeFormItemActionRecord[]>,
    proposalsByMatterId: Object.fromEntries(
      entries.map(([matterId, data]) => [matterId, data.proposals]),
    ),
  };
}
