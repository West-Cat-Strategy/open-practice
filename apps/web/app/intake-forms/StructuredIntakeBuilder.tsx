"use client";

import { AlertTriangle, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  EmbeddedIntakeBranchOperator,
  EmbeddedIntakeBranchRule,
  EmbeddedIntakeFormItem,
  EmbeddedIntakeQuestion,
  EmbeddedIntakeTemplateDefinitionV2,
  IntakeVariableTargetScope,
} from "@open-practice/domain";
import {
  branchRuleOperators,
  buildVariableMapping,
  buildIntakeBuilderDiagnostics,
  itemKinds,
  makeIntakeBranchRule,
  makeIntakeItem,
  questionTypes,
  summarizeIntakeBranchRulePath,
  summarizeIntakeBranchRuleTrigger,
  variableTargetFields,
} from "../intake-forms-dashboard";
import { structuredIntakeDiagnostics } from "./structured-builder-diagnostics";

interface StructuredIntakeBuilderProps {
  definition: EmbeddedIntakeTemplateDefinitionV2;
  name: string;
  saving: boolean;
  status: string;
  onDefinitionChange: (definition: EmbeddedIntakeTemplateDefinitionV2) => void;
  onNameChange: (name: string) => void;
  onSave: () => void;
}

function cloneDefinition(
  definition: EmbeddedIntakeTemplateDefinitionV2,
): EmbeddedIntakeTemplateDefinitionV2 {
  return JSON.parse(JSON.stringify(definition)) as EmbeddedIntakeTemplateDefinitionV2;
}

function uniqueId(prefix: string, existing: string[]): string {
  let index = existing.length + 1;
  let id = `${prefix}-${index}`;
  while (existing.includes(id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }
  return id;
}

function mappingScope(question: EmbeddedIntakeQuestion): IntakeVariableTargetScope | "none" {
  return question.variableMapping?.targetScope ?? "none";
}

function normalizeAcceptedTypes(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export default function StructuredIntakeBuilder({
  definition,
  name,
  saving,
  status,
  onDefinitionChange,
  onNameChange,
  onSave,
}: StructuredIntakeBuilderProps) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonValue, setJsonValue] = useState(JSON.stringify(definition, null, 2));
  const [jsonStatus, setJsonStatus] = useState("Advanced JSON ready.");
  const authoringDiagnostics = buildIntakeBuilderDiagnostics(definition);
  const blockingAuthoringDiagnostics = authoringDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "blocking",
  );
  const builderDiagnostics = structuredIntakeDiagnostics(definition);
  const saveBlocked = builderDiagnostics.blocking.length > 0;

  useEffect(() => {
    if (!jsonOpen) setJsonValue(JSON.stringify(definition, null, 2));
  }, [definition, jsonOpen]);

  function updateDefinition(updater: (draft: EmbeddedIntakeTemplateDefinitionV2) => void): void {
    const next = cloneDefinition(definition);
    updater(next);
    onDefinitionChange(next);
  }

  function addSection(): void {
    updateDefinition((draft) => {
      const id = uniqueId(
        "section",
        draft.sections.map((section) => section.id),
      );
      draft.sections.push({ id, title: "New section", items: [] });
    });
  }

  function removeSection(sectionIndex: number): void {
    updateDefinition((draft) => {
      draft.sections.splice(sectionIndex, 1);
    });
  }

  function addItem(sectionIndex: number, kind: (typeof itemKinds)[number]): void {
    updateDefinition((draft) => {
      const existingItemIds = draft.sections.flatMap((section) =>
        section.items.map((item) => item.id),
      );
      if (kind === "question") {
        const questionId = uniqueId(
          "question",
          draft.questions.map((question) => question.id),
        );
        draft.questions.push({
          id: questionId,
          label: "New question",
          type: "text",
          required: false,
        });
        draft.sections[sectionIndex]?.items.push({
          id: uniqueId("question-item", existingItemIds),
          kind,
          questionId,
        });
        return;
      }
      draft.sections[sectionIndex]?.items.push(makeIntakeItem(kind, existingItemIds.length));
    });
  }

  function removeItem(sectionIndex: number, itemIndex: number): void {
    updateDefinition((draft) => {
      const [removed] = draft.sections[sectionIndex]?.items.splice(itemIndex, 1) ?? [];
      if (removed?.kind === "question") {
        const stillReferenced = draft.sections.some((section) =>
          section.items.some(
            (item) => item.kind === "question" && item.questionId === removed.questionId,
          ),
        );
        if (!stillReferenced) {
          draft.questions = draft.questions.filter(
            (question) => question.id !== removed.questionId,
          );
        }
      }
    });
  }

  function updateItem(
    sectionIndex: number,
    itemIndex: number,
    updater: (item: EmbeddedIntakeFormItem) => void,
  ): void {
    updateDefinition((draft) => {
      const item = draft.sections[sectionIndex]?.items[itemIndex];
      if (item) updater(item);
    });
  }

  function updateQuestion(
    questionId: string,
    updater: (question: EmbeddedIntakeQuestion) => void,
  ): void {
    updateDefinition((draft) => {
      const question = draft.questions.find((candidate) => candidate.id === questionId);
      if (question) updater(question);
    });
  }

  function addBranchRule(): void {
    updateDefinition((draft) => {
      draft.branchRules.push(makeIntakeBranchRule(draft));
    });
  }

  function removeBranchRule(ruleIndex: number): void {
    updateDefinition((draft) => {
      draft.branchRules.splice(ruleIndex, 1);
    });
  }

  function updateBranchRule(
    ruleIndex: number,
    updater: (rule: EmbeddedIntakeBranchRule) => void,
  ): void {
    updateDefinition((draft) => {
      const rule = draft.branchRules[ruleIndex];
      if (rule) updater(rule);
    });
  }

  function applyJson(): void {
    try {
      const parsed = JSON.parse(jsonValue) as EmbeddedIntakeTemplateDefinitionV2;
      if (parsed.schemaVersion !== 2) {
        setJsonStatus("Only schema version 2 can be applied here.");
        return;
      }
      const parsedDiagnostics = structuredIntakeDiagnostics(parsed);
      if (parsedDiagnostics.blocking.length > 0) {
        setJsonStatus(
          `Advanced JSON has blocking issues: ${parsedDiagnostics.blocking[0]!.message}`,
        );
        return;
      }
      onDefinitionChange(parsed);
      setJsonStatus("Applied JSON to structured builder.");
    } catch {
      setJsonStatus("Advanced JSON is invalid.");
    }
  }

  return (
    <div className="intake-template-editor">
      <label className="form-field">
        <span>Template name</span>
        <input onChange={(event) => onNameChange(event.target.value)} value={name} />
      </label>

      <div className="section-title">
        <h3>Sections</h3>
        <button className="secondary-button compact-button" onClick={addSection} type="button">
          <Plus size={16} />
          Add section
        </button>
      </div>

      <div className="intake-section-editor-list">
        {definition.sections.map((section, sectionIndex) => (
          <div className="intake-section-editor" key={section.id}>
            <div className="intake-section-editor-header">
              <label className="form-field">
                <span>Section title</span>
                <input
                  onChange={(event) =>
                    updateDefinition((draft) => {
                      draft.sections[sectionIndex]!.title = event.target.value;
                    })
                  }
                  value={section.title}
                />
              </label>
              <button
                aria-label={`Remove ${section.title}`}
                className="icon-button"
                onClick={() => removeSection(sectionIndex)}
                title="Remove section"
                type="button"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <label className="form-field">
              <span>Description</span>
              <input
                onChange={(event) =>
                  updateDefinition((draft) => {
                    draft.sections[sectionIndex]!.description = event.target.value || undefined;
                  })
                }
                value={section.description ?? ""}
              />
            </label>

            <div className="intake-item-add-row">
              {itemKinds.map((kind) => (
                <button
                  className="secondary-button compact-button"
                  key={kind}
                  onClick={() => addItem(sectionIndex, kind)}
                  type="button"
                >
                  <Plus size={14} />
                  {kind}
                </button>
              ))}
            </div>

            <div className="intake-item-editor-list">
              {section.items.map((item, itemIndex) => (
                <div className="intake-item-editor" key={item.id}>
                  <div className="intake-item-editor-header">
                    <strong>{item.kind}</strong>
                    <button
                      aria-label={`Remove ${item.kind} item`}
                      className="icon-button"
                      onClick={() => removeItem(sectionIndex, itemIndex)}
                      title="Remove item"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {item.kind === "display" ? (
                    <label className="form-field">
                      <span>Display text</span>
                      <textarea
                        onChange={(event) =>
                          updateItem(sectionIndex, itemIndex, (draftItem) => {
                            if (draftItem.kind === "display") draftItem.body = event.target.value;
                          })
                        }
                        value={item.body}
                      />
                    </label>
                  ) : null}
                  {item.kind === "question"
                    ? (() => {
                        const question = definition.questions.find(
                          (candidate) => candidate.id === item.questionId,
                        );
                        return question ? (
                          <QuestionItemEditor question={question} updateQuestion={updateQuestion} />
                        ) : (
                          <p className="risk">
                            Missing question definition for {item.questionId}; remove this item or
                            repair advanced JSON.
                          </p>
                        );
                      })()
                    : null}
                  {item.kind === "upload" ? (
                    <UploadItemEditor
                      item={item}
                      updateItem={(updater) => updateItem(sectionIndex, itemIndex, updater)}
                    />
                  ) : null}
                  {item.kind === "signature" ? (
                    <SignatureItemEditor
                      item={item}
                      updateItem={(updater) => updateItem(sectionIndex, itemIndex, updater)}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">
        <h3>Branch rules</h3>
        <button
          className="secondary-button compact-button"
          disabled={definition.questions.length === 0}
          onClick={addBranchRule}
          type="button"
        >
          <Plus size={16} />
          Add rule
        </button>
      </div>

      <div className="intake-branch-rule-list">
        {definition.branchRules.map((rule, ruleIndex) => (
          <BranchRuleEditor
            definition={definition}
            key={rule.id}
            removeRule={() => removeBranchRule(ruleIndex)}
            rule={rule}
            updateRule={(updater) => updateBranchRule(ruleIndex, updater)}
          />
        ))}
        {definition.branchRules.length === 0 ? (
          <p className="inline-empty">
            No branch rules yet. Add one to show follow-up questions or packages from a
            staff-defined answer path.
          </p>
        ) : null}
      </div>

      <details
        className="advanced-json-editor"
        open={jsonOpen}
        onToggle={(event) => setJsonOpen(event.currentTarget.open)}
      >
        <summary>Advanced JSON</summary>
        <label className="form-field">
          <span>Definition JSON</span>
          <textarea
            onChange={(event) => setJsonValue(event.target.value)}
            spellCheck={false}
            value={jsonValue}
          />
        </label>
        <div className="row-actions">
          <button className="secondary-button compact-button" onClick={applyJson} type="button">
            Apply JSON
          </button>
          <p className="inline-empty">{jsonStatus}</p>
        </div>
      </details>

      <div className="intake-diagnostics-panel" role="status">
        <strong>Builder diagnostics</strong>
        {saveBlocked ? (
          <p className="risk">Save is blocked until definition errors are fixed.</p>
        ) : builderDiagnostics.warnings.length > 0 ? (
          <p>Review the warnings before sending this form to clients.</p>
        ) : (
          <p>No blocking definition issues found.</p>
        )}
        {[...builderDiagnostics.blocking, ...builderDiagnostics.warnings]
          .slice(0, 6)
          .map((check, index) => (
            <p
              className={check.severity === "blocking" ? "risk" : "inline-empty"}
              key={`${check.code}-${index}`}
            >
              {check.severity}: {check.message}
              {check.questionId ? ` (${check.questionId})` : ""}
              {check.itemId ? ` (${check.itemId})` : ""}
            </p>
          ))}
      </div>

      <div className="row-actions">
        <button
          className="secondary-button compact-button"
          disabled={saving || saveBlocked}
          onClick={onSave}
          type="button"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save form"}
        </button>
        <p className="inline-empty">{status}</p>
      </div>

      <div className="intake-authoring-diagnostics">
        <div className="section-title">
          <h3>Authoring diagnostics</h3>
          <span className={blockingAuthoringDiagnostics.length > 0 ? "warning" : "success"}>
            {blockingAuthoringDiagnostics.length > 0
              ? `${blockingAuthoringDiagnostics.length} blocking`
              : "no blocking issues"}
          </span>
        </div>
        {authoringDiagnostics.length > 0 ? (
          <ul className="intake-diagnostic-list">
            {authoringDiagnostics.map((diagnostic, index) => (
              <li
                className={`intake-diagnostic ${diagnostic.severity}`}
                key={`${diagnostic.code}-${index}`}
              >
                <AlertTriangle size={14} />
                <span>{diagnostic.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inline-empty">No local authoring diagnostics found.</p>
        )}
      </div>
    </div>
  );
}

function BranchRuleEditor({
  definition,
  rule,
  removeRule,
  updateRule,
}: {
  definition: EmbeddedIntakeTemplateDefinitionV2;
  rule: EmbeddedIntakeBranchRule;
  removeRule: () => void;
  updateRule: (updater: (rule: EmbeddedIntakeBranchRule) => void) => void;
}) {
  const sourceQuestion = definition.questions.find((question) => question.id === rule.questionId);
  const pathSummary = summarizeIntakeBranchRulePath(rule, definition);
  const showQuestionIds = new Set(rule.showQuestionIds ?? []);
  const eligiblePackageIds = new Set(rule.eligiblePackageIds ?? []);

  function setRuleValue(value: string): void {
    updateRule((draft) => {
      if (sourceQuestion?.type === "boolean") {
        draft.value = value === "true";
      } else {
        draft.value = value;
      }
    });
  }

  function toggleShownQuestion(questionId: string, checked: boolean): void {
    updateRule((draft) => {
      const next = new Set(draft.showQuestionIds ?? []);
      if (checked) next.add(questionId);
      else next.delete(questionId);
      draft.showQuestionIds = [...next];
    });
  }

  function toggleEligiblePackage(packageId: string, checked: boolean): void {
    updateRule((draft) => {
      const next = new Set(draft.eligiblePackageIds ?? []);
      if (checked) next.add(packageId);
      else next.delete(packageId);
      draft.eligiblePackageIds = [...next];
    });
  }

  return (
    <div className="intake-branch-rule-editor">
      <div className="intake-item-editor-header">
        <strong>{rule.id}</strong>
        <button
          aria-label={`Remove branch rule ${rule.id}`}
          className="icon-button"
          onClick={removeRule}
          title="Remove branch rule"
          type="button"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="intake-question-grid">
        <label className="form-field">
          <span>Rule ID</span>
          <input
            onChange={(event) =>
              updateRule((draft) => {
                draft.id = event.target.value;
              })
            }
            value={rule.id}
          />
        </label>
        <label className="form-field">
          <span>Source question</span>
          <select
            onChange={(event) =>
              updateRule((draft) => {
                draft.questionId = event.target.value;
                draft.value =
                  definition.questions.find((question) => question.id === event.target.value)
                    ?.type === "boolean"
                    ? false
                    : undefined;
              })
            }
            value={rule.questionId}
          >
            {definition.questions.map((question) => (
              <option key={question.id} value={question.id}>
                {question.label}
              </option>
            ))}
            {sourceQuestion ? null : (
              <option value={rule.questionId}>Missing question: {rule.questionId}</option>
            )}
          </select>
        </label>
      </div>
      <div className="intake-question-grid">
        <label className="form-field">
          <span>Operator</span>
          <select
            onChange={(event) =>
              updateRule((draft) => {
                draft.operator = event.target.value as EmbeddedIntakeBranchOperator;
                if (draft.operator === "present") draft.value = undefined;
                else if (sourceQuestion?.type === "boolean" && typeof draft.value !== "boolean") {
                  draft.value = false;
                }
              })
            }
            value={rule.operator}
          >
            {branchRuleOperators.map((operator) => (
              <option key={operator} value={operator}>
                {operator.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        {rule.operator === "present" ? (
          <p className="field-hint">This rule matches when the source answer is not blank.</p>
        ) : sourceQuestion?.type === "boolean" ? (
          <label className="form-field">
            <span>Value</span>
            <select
              onChange={(event) => setRuleValue(event.target.value)}
              value={String(rule.value ?? false)}
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </label>
        ) : sourceQuestion?.type === "select" ? (
          <label className="form-field">
            <span>Value</span>
            <select
              onChange={(event) => setRuleValue(event.target.value)}
              value={String(rule.value ?? "")}
            >
              <option value="">No value selected</option>
              {(sourceQuestion.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="form-field">
            <span>Value</span>
            <input
              onChange={(event) => setRuleValue(event.target.value)}
              value={String(rule.value ?? "")}
            />
          </label>
        )}
      </div>

      <div className="intake-branch-target-grid">
        <fieldset>
          <legend>Shown questions</legend>
          {definition.questions
            .filter((question) => question.id !== rule.questionId)
            .map((question) => (
              <label className="check-row share-check-row" key={question.id}>
                <input
                  checked={showQuestionIds.has(question.id)}
                  onChange={(event) => toggleShownQuestion(question.id, event.target.checked)}
                  type="checkbox"
                />
                <span>{question.label}</span>
              </label>
            ))}
          {definition.questions.length <= 1 ? (
            <p className="inline-empty">No follow-up questions are available.</p>
          ) : null}
        </fieldset>
        <fieldset>
          <legend>Eligible packages</legend>
          {definition.packages.map((intakePackage) => (
            <label className="check-row share-check-row" key={intakePackage.id}>
              <input
                checked={eligiblePackageIds.has(intakePackage.id)}
                onChange={(event) => toggleEligiblePackage(intakePackage.id, event.target.checked)}
                type="checkbox"
              />
              <span>{intakePackage.title}</span>
            </label>
          ))}
          {definition.packages.length === 0 ? (
            <p className="inline-empty">No packages are defined.</p>
          ) : null}
        </fieldset>
      </div>

      <div className="intake-branch-path-summary">
        <strong>{summarizeIntakeBranchRuleTrigger(rule, definition)}</strong>
        <span>{pathSummary.path}</span>
        <small>
          Matched rules:{" "}
          {pathSummary.matchedBranchRuleIds.length
            ? pathSummary.matchedBranchRuleIds.join(", ")
            : "none"}
        </small>
      </div>
    </div>
  );
}

function QuestionItemEditor({
  question,
  updateQuestion,
}: {
  question: EmbeddedIntakeQuestion;
  updateQuestion: (questionId: string, updater: (question: EmbeddedIntakeQuestion) => void) => void;
}) {
  const scope = mappingScope(question);
  const mappingField = question.variableMapping?.targetField ?? "";

  return (
    <div className="intake-question-editor">
      <label className="form-field">
        <span>Question label</span>
        <input
          onChange={(event) =>
            updateQuestion(question.id, (draft) => {
              draft.label = event.target.value;
            })
          }
          value={question.label}
        />
      </label>
      <div className="intake-question-grid">
        <label className="form-field">
          <span>Type</span>
          <select
            onChange={(event) =>
              updateQuestion(question.id, (draft) => {
                draft.type = event.target.value as EmbeddedIntakeQuestion["type"];
                if (draft.type === "select" && !draft.options?.length) {
                  draft.options = [{ value: "option", label: "Option" }];
                }
              })
            }
            value={question.type}
          >
            {questionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="check-row share-check-row">
          <input
            checked={Boolean(question.required)}
            onChange={(event) =>
              updateQuestion(question.id, (draft) => {
                draft.required = event.target.checked;
              })
            }
            type="checkbox"
          />
          <span>Required</span>
        </label>
      </div>

      {question.type === "select" ? (
        <label className="form-field">
          <span>Options</span>
          <textarea
            onChange={(event) =>
              updateQuestion(question.id, (draft) => {
                draft.options = event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line) => {
                    const [value, label] = line.split("|").map((part) => part.trim());
                    return { value: value ?? "", label: label || value || "Option" };
                  });
              })
            }
            value={(question.options ?? [])
              .map((option) => `${option.value}|${option.label}`)
              .join("\n")}
          />
        </label>
      ) : null}

      <div className="intake-question-grid">
        <label className="form-field">
          <span>Mapping scope</span>
          <select
            onChange={(event) =>
              updateQuestion(question.id, (draft) => {
                const nextScope = event.target.value as IntakeVariableTargetScope | "none";
                draft.variableMapping =
                  nextScope === "none"
                    ? undefined
                    : buildVariableMapping(nextScope, variableTargetFields(nextScope)[0] ?? "");
              })
            }
            value={scope}
          >
            <option value="none">none</option>
            <option value="client">client</option>
            <option value="matter">matter</option>
          </select>
        </label>
        <label className="form-field">
          <span>Mapping field</span>
          <select
            disabled={scope === "none"}
            onChange={(event) =>
              updateQuestion(question.id, (draft) => {
                if (scope !== "none") {
                  draft.variableMapping = buildVariableMapping(scope, event.target.value);
                }
              })
            }
            value={mappingField}
          >
            {scope === "none" ? <option value="">none</option> : null}
            {scope !== "none"
              ? variableTargetFields(scope).map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))
              : null}
          </select>
        </label>
      </div>
    </div>
  );
}

function UploadItemEditor({
  item,
  updateItem,
}: {
  item: Extract<EmbeddedIntakeFormItem, { kind: "upload" }>;
  updateItem: (updater: (item: EmbeddedIntakeFormItem) => void) => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>Upload label</span>
        <input
          onChange={(event) =>
            updateItem((draft) => {
              if (draft.kind === "upload") draft.label = event.target.value;
            })
          }
          value={item.label}
        />
      </label>
      <div className="intake-question-grid">
        <label className="form-field">
          <span>Accepted file types</span>
          <input
            onChange={(event) =>
              updateItem((draft) => {
                if (draft.kind === "upload") {
                  draft.acceptedFileTypes = normalizeAcceptedTypes(event.target.value);
                }
              })
            }
            value={(item.acceptedFileTypes ?? []).join(", ")}
          />
        </label>
        <label className="check-row share-check-row">
          <input
            checked={Boolean(item.required)}
            onChange={(event) =>
              updateItem((draft) => {
                if (draft.kind === "upload") draft.required = event.target.checked;
              })
            }
            type="checkbox"
          />
          <span>Required</span>
        </label>
      </div>
    </>
  );
}

function SignatureItemEditor({
  item,
  updateItem,
}: {
  item: Extract<EmbeddedIntakeFormItem, { kind: "signature" }>;
  updateItem: (updater: (item: EmbeddedIntakeFormItem) => void) => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>Signature label</span>
        <input
          onChange={(event) =>
            updateItem((draft) => {
              if (draft.kind === "signature") draft.label = event.target.value;
            })
          }
          value={item.label}
        />
      </label>
      <label className="form-field">
        <span>Document ID to sign</span>
        <input
          onChange={(event) =>
            updateItem((draft) => {
              if (draft.kind === "signature") {
                draft.documentId = event.target.value.trim() || undefined;
              }
            })
          }
          value={item.documentId ?? ""}
        />
      </label>
      <label className="form-field">
        <span>Consent text</span>
        <textarea
          onChange={(event) =>
            updateItem((draft) => {
              if (draft.kind === "signature") draft.consentText = event.target.value;
            })
          }
          value={item.consentText}
        />
      </label>
      <label className="check-row share-check-row">
        <input
          checked={Boolean(item.required)}
          onChange={(event) =>
            updateItem((draft) => {
              if (draft.kind === "signature") draft.required = event.target.checked;
            })
          }
          type="checkbox"
        />
        <span>Required</span>
      </label>
    </>
  );
}
