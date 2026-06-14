"use client";

import { CheckCircle2, Upload } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type {
  EmbeddedIntakeFormItem,
  EmbeddedIntakeQuestion,
  EmbeddedIntakeTemplateDefinition,
} from "@open-practice/domain";
import {
  actionComplete,
  itemAction,
  type Answers,
  type PublicIntakeFormItemAction,
} from "./runner-utils";

export type IntakeFormWidgetKind = EmbeddedIntakeFormItem["kind"];

export const intakeFormWidgetKinds = [
  "display",
  "question",
  "upload",
  "signature",
] as const satisfies readonly IntakeFormWidgetKind[];

export interface IntakeFormWidgetRenderContext {
  actions: PublicIntakeFormItemAction[];
  answers: Answers;
  acceptedSignatures: Record<string, boolean>;
  busyItemId: string;
  definition: Extract<EmbeddedIntakeTemplateDefinition, { schemaVersion: 2 }>;
  disabled: boolean;
  setAcceptedSignatures: Dispatch<SetStateAction<Record<string, boolean>>>;
  updateAnswer: (question: EmbeddedIntakeQuestion, value: string | boolean) => void;
  uploadFile: (item: Extract<EmbeddedIntakeFormItem, { kind: "upload" }>, file: File) => void;
  recordSignature: (item: Extract<EmbeddedIntakeFormItem, { kind: "signature" }>) => void;
}

export interface IntakeFormWidgetAdapter {
  kind: IntakeFormWidgetKind;
  render: (item: EmbeddedIntakeFormItem, context: IntakeFormWidgetRenderContext) => ReactNode;
}

export const intakeFormWidgetRegistry = {
  display: {
    kind: "display",
    render: (item) => {
      if (item.kind !== "display") return null;
      return (
        <p className="inline-empty" key={item.id}>
          {item.body}
        </p>
      );
    },
  },
  question: {
    kind: "question",
    render: (item, context) => {
      if (item.kind !== "question") return null;
      const question = context.definition.questions.find(
        (candidate) => candidate.id === item.questionId,
      );
      if (!question) return null;
      return (
        <QuestionField
          answers={context.answers}
          disabled={context.disabled}
          key={item.id}
          question={question}
          updateAnswer={context.updateAnswer}
        />
      );
    },
  },
  upload: {
    kind: "upload",
    render: (item, context) => {
      if (item.kind !== "upload") return null;
      const action = itemAction(context.actions, item);
      return (
        <div className="public-form-action" key={item.id}>
          <div>
            <strong>{item.label}</strong>
            <small>
              {actionComplete(action) ? "uploaded" : item.required ? "required" : "optional"}
            </small>
          </div>
          <label className="secondary-button compact-button file-button">
            <Upload size={16} />
            {context.busyItemId === item.id ? "Uploading..." : "Choose file"}
            <input
              accept={item.acceptedFileTypes?.join(",")}
              disabled={context.disabled || context.busyItemId === item.id}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) context.uploadFile(item, file);
              }}
              type="file"
            />
          </label>
        </div>
      );
    },
  },
  signature: {
    kind: "signature",
    render: (item, context) => {
      if (item.kind !== "signature") return null;
      const action = itemAction(context.actions, item);
      return (
        <div className="public-form-action" key={item.id}>
          <div>
            <strong>{item.label}</strong>
            <small>
              {actionComplete(action)
                ? action?.signatureRequestId
                  ? "signature request completed"
                  : "signed"
                : item.consentText}
            </small>
          </div>
          <label className="check-row share-check-row signature-consent">
            <input
              checked={Boolean(context.acceptedSignatures[item.id])}
              disabled={context.disabled || actionComplete(action)}
              onChange={(event) =>
                context.setAcceptedSignatures((current) => ({
                  ...current,
                  [item.id]: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>I agree</span>
          </label>
          <button
            className="secondary-button compact-button"
            disabled={
              context.disabled ||
              actionComplete(action) ||
              !context.acceptedSignatures[item.id] ||
              context.busyItemId === item.id
            }
            onClick={() => context.recordSignature(item)}
            type="button"
          >
            <CheckCircle2 size={16} />
            Sign
          </button>
        </div>
      );
    },
  },
} satisfies Record<IntakeFormWidgetKind, IntakeFormWidgetAdapter>;

export function renderIntakeFormItem(
  item: EmbeddedIntakeFormItem,
  context: IntakeFormWidgetRenderContext,
): ReactNode {
  return intakeFormWidgetRegistry[item.kind].render(item, context);
}

function QuestionField({
  answers,
  disabled,
  question,
  updateAnswer,
}: {
  answers: Answers;
  disabled: boolean;
  question: EmbeddedIntakeQuestion;
  updateAnswer: (question: EmbeddedIntakeQuestion, value: string | boolean) => void;
}) {
  const value = answers[question.id];
  if (question.type === "textarea") {
    return (
      <label className="form-field public-question">
        <span>{question.label}</span>
        <textarea
          disabled={disabled}
          onChange={(event) => updateAnswer(question, event.target.value)}
          value={typeof value === "string" ? value : ""}
        />
      </label>
    );
  }
  if (question.type === "select") {
    return (
      <label className="form-field public-question">
        <span>{question.label}</span>
        <select
          disabled={disabled}
          onChange={(event) => updateAnswer(question, event.target.value)}
          value={typeof value === "string" ? value : ""}
        >
          <option value="">Select</option>
          {(question.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (question.type === "boolean") {
    return (
      <label className="check-row share-check-row public-question">
        <input
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => updateAnswer(question, event.target.checked)}
          type="checkbox"
        />
        <span>{question.label}</span>
      </label>
    );
  }
  return (
    <label className="form-field public-question">
      <span>{question.label}</span>
      <input
        disabled={disabled}
        onChange={(event) => updateAnswer(question, event.target.value)}
        type={question.type === "date" ? "date" : "text"}
        value={typeof value === "string" ? value : ""}
      />
    </label>
  );
}
