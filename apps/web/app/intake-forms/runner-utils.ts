import type {
  EmbeddedIntakeBranchRule,
  EmbeddedIntakeFormItem,
  EmbeddedIntakeQuestion,
  EmbeddedIntakeTemplateDefinition,
} from "@open-practice/domain";
import type { PublicTokenActionItem } from "../publicTokenActions";

export interface PublicIntakeFormItemAction {
  itemId: string;
  kind: "upload" | "signature";
  status: "intent_created" | "uploaded" | "completed" | "declined";
  documentId?: string;
  signatureRequestId?: string;
  completedAt?: string;
}

export interface PublicIntakeFormPayload {
  link: {
    status: string;
    expiresAt: string;
    createdAt?: string;
    submittedAt?: string;
  };
  template: {
    id: string;
    name: string;
    definitionVersion: number;
    definition: EmbeddedIntakeTemplateDefinition;
  };
  actions: PublicIntakeFormItemAction[];
  draft?: { answers: Record<string, unknown>; updatedAt: string } | null;
  review?: {
    decision: "accepted" | "rejected" | "request_more_info";
    decidedAt: string;
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

export function actionComplete(action?: PublicIntakeFormItemAction): boolean {
  return action?.status === "uploaded" || action?.status === "completed";
}

export function itemAction(
  actions: PublicIntakeFormItemAction[],
  item: EmbeddedIntakeFormItem,
): PublicIntakeFormItemAction | undefined {
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

export function intakeFormAttentionItems(
  payload: PublicIntakeFormPayload | null,
): PublicTokenActionItem[] {
  if (!payload) return [];
  if (payload.review?.decision === "request_more_info") {
    return [
      {
        id: "intake-more-info",
        title: "More information requested",
        detail: "Use the new secure link from the staff request to continue.",
        status: "requested",
        tone: "risk",
      },
    ];
  }
  if (payload.review) return [];
  if (payload.link.status === "submitted") {
    return [
      {
        id: "intake-submitted",
        title: "Submitted for staff review",
        detail: "Staff can review this intake. No further action is available from this link.",
        status: "submitted",
        tone: "ready",
      },
    ];
  }
  if (payload.link.status !== "active") return [];
  if (payload.template.definition.schemaVersion !== 2) {
    return [
      {
        id: "intake-version-unavailable",
        title: "Form unavailable",
        detail: "This intake form version is not available for public completion.",
        status: "locked",
        tone: "risk",
      },
    ];
  }

  return [
    {
      id: "intake-complete-form",
      title: payload.draft?.updatedAt ? "Review and submit saved draft" : "Complete intake form",
      detail: payload.draft?.updatedAt
        ? "A saved draft is available. Review it before submitting."
        : "Complete the requested answers and required items before submitting.",
      status: "open",
    },
  ];
}

export function canSubmitPublicIntakeForm(payload: PublicIntakeFormPayload | null): boolean {
  return Boolean(
    payload && payload.link.status === "active" && payload.template.definition.schemaVersion === 2,
  );
}

export function requiredIncompleteItemIds(body: ApiErrorBody | null): string[] | undefined {
  return (
    body?.details?.requiredIncompleteItemIds ?? body?.error?.details?.requiredIncompleteItemIds
  );
}
