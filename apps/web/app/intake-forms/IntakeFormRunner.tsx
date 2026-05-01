"use client";

import { CheckCircle2, FileText, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  EmbeddedIntakeFormItem,
  EmbeddedIntakeQuestion,
  IntakeFormItemActionRecord,
} from "@open-practice/domain";
import {
  actionComplete,
  coerceAnswer,
  errorMessage,
  itemAction,
  readApiError,
  requiredIncompleteItemIds,
  visibleSections,
  type Answers,
  type PublicIntakeFormPayload,
} from "./runner-utils";

interface IntakeFormRunnerProps {
  apiBaseUrl: string;
  token: string;
}

async function sha256Hex(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function IntakeFormRunner({ apiBaseUrl, token }: IntakeFormRunnerProps) {
  const [payload, setPayload] = useState<PublicIntakeFormPayload | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [status, setStatus] = useState("Loading form...");
  const [submitting, setSubmitting] = useState(false);
  const [busyItemId, setBusyItemId] = useState("");
  const [acceptedSignatures, setAcceptedSignatures] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadForm(): Promise<void> {
      const response = await fetch(
        `${apiBaseUrl}/api/portal/intake-forms/${encodeURIComponent(token)}`,
      );
      if (cancelled) return;
      if (!response.ok) {
        const body = await readApiError(response);
        setStatus(
          response.status === 403
            ? "This form link is not available."
            : errorMessage(body, `Load failed: ${response.status}`),
        );
        return;
      }
      const nextPayload = (await response.json()) as PublicIntakeFormPayload;
      setPayload(nextPayload);
      setStatus(
        nextPayload.link.status === "active"
          ? "Form ready."
          : `This form is ${nextPayload.link.status}.`,
      );
    }
    void loadForm();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, token]);

  const sections = useMemo(() => visibleSections(payload, answers), [answers, payload]);
  const disabled = payload?.link.status !== "active";

  function updateAnswer(question: EmbeddedIntakeQuestion, value: string | boolean): void {
    setAnswers((current) => ({ ...current, [question.id]: coerceAnswer(question, value) }));
  }

  async function uploadFile(item: Extract<EmbeddedIntakeFormItem, { kind: "upload" }>, file: File) {
    if (!payload) return;
    setBusyItemId(item.id);
    setStatus(`Uploading ${file.name}...`);
    const checksumSha256 = await sha256Hex(file);
    const contentType = file.type || "application/octet-stream";
    const intent = await fetch(
      `${apiBaseUrl}/api/portal/intake-forms/${encodeURIComponent(token)}/items/${encodeURIComponent(
        item.id,
      )}/uploads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, checksumSha256, contentType }),
      },
    );
    if (!intent.ok) {
      const body = await readApiError(intent);
      setStatus(errorMessage(body, `Upload intent failed: ${intent.status}`));
      setBusyItemId("");
      return;
    }
    const intentPayload = (await intent.json()) as {
      uploadUrl: string;
      document: { id: string };
    };
    const put = await fetch(intentPayload.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-amz-checksum-sha256": checksumSha256,
      },
      body: file,
    });
    if (!put.ok) {
      setStatus(`Upload failed: ${put.status}`);
      setBusyItemId("");
      return;
    }
    const completed = await fetch(
      `${apiBaseUrl}/api/portal/intake-forms/${encodeURIComponent(token)}/items/${encodeURIComponent(
        item.id,
      )}/documents/${encodeURIComponent(intentPayload.document.id)}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checksumSha256 }),
      },
    );
    if (!completed.ok) {
      const body = await readApiError(completed);
      setStatus(errorMessage(body, `Upload completion failed: ${completed.status}`));
      setBusyItemId("");
      return;
    }
    const completedPayload = (await completed.json()) as { action: IntakeFormItemActionRecord };
    setPayload((current) =>
      current
        ? {
            ...current,
            actions: [
              completedPayload.action,
              ...current.actions.filter((action) => action.id !== completedPayload.action.id),
            ],
          }
        : current,
    );
    setStatus(`${file.name} uploaded.`);
    setBusyItemId("");
  }

  async function recordSignature(item: Extract<EmbeddedIntakeFormItem, { kind: "signature" }>) {
    setBusyItemId(item.id);
    setStatus("Recording attestation...");
    const response = await fetch(
      `${apiBaseUrl}/api/portal/intake-forms/${encodeURIComponent(token)}/items/${encodeURIComponent(
        item.id,
      )}/signature`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          consentText: item.consentText,
          evidence: { acceptedInBrowser: true },
        }),
      },
    );
    if (!response.ok) {
      const body = await readApiError(response);
      setStatus(errorMessage(body, `Attestation failed: ${response.status}`));
      setBusyItemId("");
      return;
    }
    const signaturePayload = (await response.json()) as { action: IntakeFormItemActionRecord };
    setPayload((current) =>
      current
        ? {
            ...current,
            actions: [
              signaturePayload.action,
              ...current.actions.filter((action) => action.id !== signaturePayload.action.id),
            ],
          }
        : current,
    );
    setStatus("Attestation recorded.");
    setBusyItemId("");
  }

  async function submitForm() {
    setSubmitting(true);
    setStatus("Submitting form...");
    const response = await fetch(
      `${apiBaseUrl}/api/portal/intake-forms/${encodeURIComponent(token)}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      },
    );
    if (!response.ok) {
      const body = await readApiError(response);
      const missing = requiredIncompleteItemIds(body);
      setStatus(
        missing?.length
          ? `Submit blocked: complete ${missing.join(", ")}.`
          : `Submit failed: ${response.status}`,
      );
      setSubmitting(false);
      return;
    }
    const submitted = (await response.json()) as Pick<PublicIntakeFormPayload, "link">;
    setPayload((current) => (current ? { ...current, link: submitted.link } : current));
    setStatus("Submitted. Your information is ready for staff review.");
    setSubmitting(false);
  }

  return (
    <main className="public-form-shell">
      <section className="public-form-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Client intake</p>
            <h1>{payload?.template.name ?? "Intake form"}</h1>
          </div>
          <FileText size={22} />
        </div>
        <p className="inline-empty">{status}</p>

        {payload?.template.definition.schemaVersion !== 2 && payload ? (
          <p className="inline-empty">
            This intake form version is not available for public completion.
          </p>
        ) : null}

        {sections.map((section) => (
          <div className="public-form-section" key={section.id}>
            <div className="section-title">
              <h2>{section.title}</h2>
              <span>{section.items.length} items</span>
            </div>
            {section.description ? <p className="field-hint">{section.description}</p> : null}
            <div className="public-form-items">
              {section.items.map((item) => {
                const action = payload ? itemAction(payload.actions, item) : undefined;
                if (item.kind === "display") {
                  return (
                    <p className="inline-empty" key={item.id}>
                      {item.body}
                    </p>
                  );
                }
                if (item.kind === "question" && payload?.template.definition.schemaVersion === 2) {
                  const question = payload.template.definition.questions.find(
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
                            if (file) void uploadFile(item, file);
                          }}
                          type="file"
                        />
                      </label>
                    </div>
                  );
                }
                if (item.kind === "signature") {
                  return (
                    <div className="public-form-action" key={item.id}>
                      <div>
                        <strong>{item.label}</strong>
                        <small>{actionComplete(action) ? "signed" : item.consentText}</small>
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
                        onClick={() => void recordSignature(item)}
                        type="button"
                      >
                        <CheckCircle2 size={16} />
                        Sign
                      </button>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        <button
          className="primary-button public-submit-button"
          disabled={disabled || submitting || !payload}
          onClick={() => void submitForm()}
          type="button"
        >
          {submitting ? "Submitting..." : "Submit intake"}
        </button>
      </section>
    </main>
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
