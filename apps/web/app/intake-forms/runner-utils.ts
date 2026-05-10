import type {
  EmbeddedIntakeBranchRule,
  EmbeddedIntakeFormItem,
  EmbeddedIntakeQuestion,
  EmbeddedIntakeTemplateDefinition,
  IntakeFormItemActionRecord,
} from "@open-practice/domain";

export interface PublicIntakeFormPayload {
  link: {
    id: string;
    status: string;
    expiresAt: string;
    submittedAt?: string;
    revokedAt?: string;
  };
  template: {
    id: string;
    name: string;
    definitionVersion: number;
    definition: EmbeddedIntakeTemplateDefinition;
  };
  actions: IntakeFormItemActionRecord[];
  draft?: { answers: Record<string, unknown>; updatedAt: string } | null;
  review?: {
    decision: "accepted" | "rejected" | "request_more_info";
    decidedAt: string;
    reason?: string;
    followUpFormLinkId?: string;
  } | null;
}

export type Answers = Record<string, string | boolean>;
export type VisibleIntakeSection = Extract<
  EmbeddedIntakeTemplateDefinition,
  { schemaVersion: 2 }
>["sections"][number];

export interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: { requiredIncompleteItemIds?: string[]; [key: string]: unknown };
  error?: {
    code?: string;
    message?: string;
    details?: { requiredIncompleteItemIds?: string[]; [key: string]: unknown };
  };
}

export function actionComplete(action?: IntakeFormItemActionRecord): boolean {
  return action?.status === "uploaded" || action?.status === "completed";
}

export function itemAction(
  actions: IntakeFormItemActionRecord[],
  item: EmbeddedIntakeFormItem,
): IntakeFormItemActionRecord | undefined {
  return actions.find((action) => action.itemId === item.id);
}

export function visibleSections(payload: PublicIntakeFormPayload | null, answers: Answers) {
  if (!payload || payload.template.definition.schemaVersion !== 2) return [];
  const visibleQuestionIds = visibleRunnerQuestionIds(payload.template.definition, answers);
  return payload.template.definition.sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.kind !== "question" || visibleQuestionIds.has(item.questionId),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

function visibleRunnerQuestionIds(
  definition: Extract<EmbeddedIntakeTemplateDefinition, { schemaVersion: 2 }>,
  answers: Answers,
): Set<string> {
  const conditionalQuestionIds = new Set(
    definition.branchRules.flatMap((rule) => rule.showQuestionIds ?? []),
  );
  const visibleQuestionIds = new Set(
    definition.questions
      .filter((question) => !conditionalQuestionIds.has(question.id))
      .map((question) => question.id),
  );

  for (const rule of definition.branchRules) {
    if (!branchRuleMatches(rule, answers[rule.questionId])) continue;
    for (const questionId of rule.showQuestionIds ?? []) visibleQuestionIds.add(questionId);
  }

  return visibleQuestionIds;
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

export function coerceAnswer(
  question: EmbeddedIntakeQuestion,
  value: string | boolean,
): string | boolean {
  if (question.type === "boolean") return Boolean(value);
  return String(value);
}

export function answersFromDraft(
  definition: EmbeddedIntakeTemplateDefinition,
  draftAnswers: Record<string, unknown> | undefined,
): Answers {
  if (!draftAnswers) return {};
  const answers: Answers = {};
  for (const question of definition.questions) {
    const value = draftAnswers[question.id];
    if (value === undefined || value === null) continue;
    answers[question.id] = question.type === "boolean" ? Boolean(value) : String(value);
  }
  return answers;
}

export function intakeLifecycleMessage(payload: PublicIntakeFormPayload): string {
  if (payload.review?.decision === "request_more_info") {
    return "Staff requested more information. Use the new secure link from the request to continue.";
  }
  if (payload.review) return "This intake form has been reviewed by staff.";
  if (payload.link.status === "active") {
    return payload.draft?.updatedAt ? "Draft restored." : "Form ready.";
  }
  if (payload.link.status === "submitted")
    return "Submitted. Your information is ready for staff review.";
  return `This form is ${payload.link.status}.`;
}

export async function readApiError(response: Response): Promise<ApiErrorBody | null> {
  return response.json().catch(() => null) as Promise<ApiErrorBody | null>;
}

export function errorMessage(body: ApiErrorBody | null, fallback: string): string {
  return body?.message ?? body?.error?.message ?? fallback;
}

export function requiredIncompleteItemIds(body: ApiErrorBody | null): string[] | undefined {
  return (
    body?.details?.requiredIncompleteItemIds ?? body?.error?.details?.requiredIncompleteItemIds
  );
}
