"use client";

import { CheckCircle2, Upload } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
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
  type VisibleIntakeSection,
} from "./runner-utils";

interface IntakeFormRendererProps {
  actions: PublicIntakeFormItemAction[];
  answers: Answers;
  acceptedSignatures: Record<string, boolean>;
  busyItemId: string;
  disabled: boolean;
  sections: VisibleIntakeSection[];
  definition: Extract<EmbeddedIntakeTemplateDefinition, { schemaVersion: 2 }>;
  setAcceptedSignatures: Dispatch<SetStateAction<Record<string, boolean>>>;
  updateAnswer: (question: EmbeddedIntakeQuestion, value: string | boolean) => void;
  uploadFile: (item: Extract<EmbeddedIntakeFormItem, { kind: "upload" }>, file: File) => void;
  recordSignature: (item: Extract<EmbeddedIntakeFormItem, { kind: "signature" }>) => void;
}

export default function IntakeFormRenderer({
  actions,
  answers,
  acceptedSignatures,
  busyItemId,
  definition,
  disabled,
  sections,
  setAcceptedSignatures,
  updateAnswer,
  uploadFile,
  recordSignature,
}: IntakeFormRendererProps) {
  return (
    <>
      {sections.map((section) => (
        <div className="public-form-section" key={section.id}>
          <div className="section-title">
            <h2>{section.title}</h2>
            <span>{section.items.length} items</span>
          </div>
          {section.description ? <p className="field-hint">{section.description}</p> : null}
          <div className="public-form-items">
            {section.items.map((item) => {
              const action = itemAction(actions, item);
              if (item.kind === "display") {
                return (
                  <p className="inline-empty" key={item.id}>
                    {item.body}
                  </p>
                );
              }
              if (item.kind === "question") {
                const question = definition.questions.find(
                  (candidate) => candidate.id === item.questionId,
                );
                if (!question) return null;
                return (
                  <QuestionField
                    answers={answers}
                    disabled={disabled}
                    key={item.id}
                    question={question}
                    updateAnswer={updateAnswer}
                  />
                );
              }
              if (item.kind === "upload") {
                return (
                  <div className="public-form-action" key={item.id}>
                    <div>
                      <strong>{item.label}</strong>
                      <small>
                        {actionComplete(action)
                          ? "uploaded"
                          : item.required
                            ? "required"
                            : "optional"}
                      </small>
                    </div>
                    <label className="secondary-button compact-button file-button">
                      <Upload size={16} />
                      {busyItemId === item.id ? "Uploading..." : "Choose file"}
                      <input
                        accept={item.acceptedFileTypes?.join(",")}
                        disabled={disabled || busyItemId === item.id}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadFile(item, file);
                        }}
                        type="file"
                      />
                    </label>
                  </div>
                );
              }
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
                      checked={Boolean(acceptedSignatures[item.id])}
                      disabled={disabled || actionComplete(action)}
                      onChange={(event) =>
                        setAcceptedSignatures((current) => ({
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
                      disabled ||
                      actionComplete(action) ||
                      !acceptedSignatures[item.id] ||
                      busyItemId === item.id
                    }
                    onClick={() => recordSignature(item)}
                    type="button"
                  >
                    <CheckCircle2 size={16} />
                    Sign
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
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
