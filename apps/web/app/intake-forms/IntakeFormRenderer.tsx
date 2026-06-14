"use client";

import type { Dispatch, SetStateAction } from "react";
import type {
  EmbeddedIntakeFormItem,
  EmbeddedIntakeQuestion,
  EmbeddedIntakeTemplateDefinition,
} from "@open-practice/domain";
import {
  type Answers,
  type PublicIntakeFormItemAction,
  type VisibleIntakeSection,
} from "./runner-utils";
import { renderIntakeFormItem } from "./widget-registry";

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
  const renderContext = {
    actions,
    answers,
    acceptedSignatures,
    busyItemId,
    definition,
    disabled,
    setAcceptedSignatures,
    updateAnswer,
    uploadFile,
    recordSignature,
  };

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
            {section.items.map((item) => renderIntakeFormItem(item, renderContext))}
          </div>
        </div>
      ))}
    </>
  );
}
