"use client";

import { Plus } from "lucide-react";
import type { ChangeEvent } from "react";

import {
  canSubmitFirstMatter,
  firstMatterJurisdictionOptions,
  type FirstMatterFormState,
} from "../dashboard-utils";

interface FirstMatterWorkspaceProps {
  canCreateMatter: boolean;
  creating: boolean;
  form: FirstMatterFormState;
  onChange: <Field extends keyof FirstMatterFormState>(
    field: Field,
    value: FirstMatterFormState[Field],
  ) => void;
  onCreate: () => void;
  status: string;
}

export function FirstMatterWorkspace({
  canCreateMatter,
  creating,
  form,
  onChange,
  onCreate,
  status,
}: FirstMatterWorkspaceProps) {
  const canSubmit = canCreateMatter && canSubmitFirstMatter(form) && !creating;

  function handleTextChange<Field extends keyof FirstMatterFormState>(field: Field) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange(field, event.currentTarget.value as FirstMatterFormState[Field]);
    };
  }

  return (
    <article
      aria-labelledby="first-matter-title"
      className="panel first-matter-panel"
      id="matter-workspace"
      tabIndex={-1}
    >
      <div className="panel-header first-matter-header">
        <div>
          <p className="eyebrow">Matter command centre</p>
          <h2 id="first-matter-title">Create the first matter</h2>
        </div>
        <span className="status-chip">Starter intake</span>
      </div>

      <div className="first-matter-layout">
        <div className="first-matter-form-grid">
          <label>
            <span className="field-label">Matter title</span>
            <input
              className="compact-input first-matter-input"
              onChange={handleTextChange("title")}
              placeholder="Synthetic starter intake"
              value={form.title}
            />
          </label>
          <label>
            <span className="field-label">Practice area</span>
            <input
              className="compact-input first-matter-input"
              onChange={handleTextChange("practiceArea")}
              placeholder="Residential tenancy"
              value={form.practiceArea}
            />
          </label>
          <label>
            <span className="field-label">Jurisdiction</span>
            <select
              className="compact-select first-matter-input"
              onChange={handleTextChange("jurisdiction")}
              value={form.jurisdiction}
            >
              {firstMatterJurisdictionOptions.map((jurisdiction) => (
                <option key={jurisdiction} value={jurisdiction}>
                  {jurisdiction}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="first-matter-kind-field">
            <legend className="field-label">Client kind</legend>
            <div className="segmented-control" role="group" aria-label="Client kind">
              {(["person", "organization"] as const).map((kind) => (
                <button
                  aria-pressed={form.clientKind === kind}
                  className={form.clientKind === kind ? "active" : ""}
                  key={kind}
                  onClick={() => onChange("clientKind", kind)}
                  type="button"
                >
                  {kind === "person" ? "Person" : "Organization"}
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            <span className="field-label">Client display name</span>
            <input
              className="compact-input first-matter-input"
              onChange={handleTextChange("clientDisplayName")}
              placeholder="Synthetic Client"
              value={form.clientDisplayName}
            />
          </label>
          <label>
            <span className="field-label">Client email</span>
            <input
              className="compact-input first-matter-input"
              inputMode="email"
              onChange={handleTextChange("clientEmail")}
              placeholder="client@example.test"
              type="email"
              value={form.clientEmail}
            />
          </label>
          <label>
            <span className="field-label">Client phone</span>
            <input
              className="compact-input first-matter-input"
              inputMode="tel"
              onChange={handleTextChange("clientPhone")}
              placeholder="+1-555-0100"
              type="tel"
              value={form.clientPhone}
            />
          </label>
        </div>

        <aside className="first-matter-controls" aria-label="Created records">
          <div className="detail-grid compact-detail-grid">
            <div>
              <span className="field-label">Matter</span>
              <strong>Intake</strong>
            </div>
            <div>
              <span className="field-label">Party</span>
              <strong>Prospective</strong>
            </div>
            <div>
              <span className="field-label">Assignment</span>
              <strong>Current user</strong>
            </div>
            <div>
              <span className="field-label">Audit</span>
              <strong>Safe metadata</strong>
            </div>
          </div>
          <button
            className="primary-button first-matter-submit"
            disabled={!canSubmit}
            onClick={onCreate}
            type="button"
          >
            <Plus size={18} aria-hidden="true" />
            {creating ? "Creating matter" : "Create matter"}
          </button>
          <p className="inline-empty" role="status" aria-live="polite">
            {canCreateMatter
              ? status
              : "Your current role can use operational surfaces, but matter creation is not available."}
          </p>
        </aside>
      </div>
    </article>
  );
}
