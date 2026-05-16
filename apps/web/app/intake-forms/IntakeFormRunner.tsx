"use client";

import { FileText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  EmbeddedIntakeFormItem,
  EmbeddedIntakeQuestion,
  IntakeFormItemActionRecord,
} from "@open-practice/domain";
import {
  buildPublicTokenPath,
  publicTokenErrorMessage,
  readPublicTokenError,
} from "../publicTokenClient";
import { PublicTokenNeedsAttention } from "../publicTokenActions";
import { PublicStatusMessage, PublicTokenShell } from "../publicTokenUi";
import IntakeFormRenderer from "./IntakeFormRenderer";
import {
  coerceAnswer,
  answersFromDraft,
  canSubmitPublicIntakeForm,
  intakeFormAttentionItems,
  intakeLifecycleMessage,
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
  const [draftStatus, setDraftStatus] = useState("Draft not saved yet.");
  const [draftSaving, setDraftSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyItemId, setBusyItemId] = useState("");
  const [acceptedSignatures, setAcceptedSignatures] = useState<Record<string, boolean>>({});
  const [clientSubmissionId] = useState(() => crypto.randomUUID());
  const draftSnapshotRef = useRef("");
  const loadedDraftRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadForm(): Promise<void> {
      const response = await fetch(
        `${apiBaseUrl}${buildPublicTokenPath("/api/portal/intake-forms", token)}`,
      );
      if (cancelled) return;
      if (!response.ok) {
        const body = await readPublicTokenError(response);
        setStatus(
          response.status === 403
            ? "This form link is not available."
            : publicTokenErrorMessage(body, `Load failed: ${response.status}`),
        );
        return;
      }
      const nextPayload = (await response.json()) as PublicIntakeFormPayload;
      const draftAnswers = answersFromDraft(
        nextPayload.template.definition,
        nextPayload.draft?.answers,
      );
      setPayload(nextPayload);
      setAnswers(draftAnswers);
      draftSnapshotRef.current = JSON.stringify(draftAnswers);
      loadedDraftRef.current = true;
      setDraftStatus(
        nextPayload.draft?.updatedAt
          ? `Draft saved ${new Date(nextPayload.draft.updatedAt).toLocaleString()}.`
          : "Draft not saved yet.",
      );
      setStatus(intakeLifecycleMessage(nextPayload));
    }
    void loadForm();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, token]);

  const sections = useMemo(() => visibleSections(payload, answers), [answers, payload]);
  const disabled = !canSubmitPublicIntakeForm(payload);
  const attentionItems = intakeFormAttentionItems(payload);

  function updateAnswer(question: EmbeddedIntakeQuestion, value: string | boolean): void {
    setAnswers((current) => ({ ...current, [question.id]: coerceAnswer(question, value) }));
  }

  async function saveDraft(manual = false): Promise<void> {
    if (!payload || disabled) return;
    const snapshot = JSON.stringify(answers);
    if (!manual && snapshot === draftSnapshotRef.current) return;
    setDraftSaving(true);
    setDraftStatus("Saving draft...");
    const response = await fetch(
      `${apiBaseUrl}${buildPublicTokenPath("/api/portal/intake-forms", token, "draft")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      },
    );
    if (!response.ok) {
      const body = await readPublicTokenError(response);
      setDraftStatus(publicTokenErrorMessage(body, `Draft save failed: ${response.status}`));
      setDraftSaving(false);
      return;
    }
    const saved = (await response.json()) as { status: "draft_saved"; draftUpdatedAt: string };
    draftSnapshotRef.current = snapshot;
    setPayload((current) =>
      current
        ? {
            ...current,
            draft: { answers, updatedAt: saved.draftUpdatedAt },
          }
        : current,
    );
    setDraftStatus(`Draft saved ${new Date(saved.draftUpdatedAt).toLocaleTimeString()}.`);
    setDraftSaving(false);
  }

  useEffect(() => {
    if (!payload || disabled || !loadedDraftRef.current) return;
    const timeout = window.setTimeout(() => {
      void saveDraft(false);
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [answers, apiBaseUrl, disabled, payload, token]);

  async function uploadFile(item: Extract<EmbeddedIntakeFormItem, { kind: "upload" }>, file: File) {
    if (!payload) return;
    setBusyItemId(item.id);
    setStatus(`Uploading ${file.name}...`);
    const checksumSha256 = await sha256Hex(file);
    const contentType = file.type || "application/octet-stream";
    const intent = await fetch(
      `${apiBaseUrl}${buildPublicTokenPath(
        "/api/portal/intake-forms",
        token,
        "items",
        item.id,
        "uploads",
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, checksumSha256, contentType }),
      },
    );
    if (!intent.ok) {
      const body = await readPublicTokenError(intent);
      setStatus(publicTokenErrorMessage(body, `Upload intent failed: ${intent.status}`));
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
      `${apiBaseUrl}${buildPublicTokenPath(
        "/api/portal/intake-forms",
        token,
        "items",
        item.id,
        "documents",
        intentPayload.document.id,
        "complete",
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checksumSha256 }),
      },
    );
    if (!completed.ok) {
      const body = await readPublicTokenError(completed);
      setStatus(publicTokenErrorMessage(body, `Upload completion failed: ${completed.status}`));
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
    setStatus(item.documentId ? "Creating signature request..." : "Recording attestation...");
    const response = await fetch(
      `${apiBaseUrl}${buildPublicTokenPath(
        "/api/portal/intake-forms",
        token,
        "items",
        item.id,
        "signature",
      )}`,
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
      const body = await readPublicTokenError(response);
      setStatus(publicTokenErrorMessage(body, `Signature failed: ${response.status}`));
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
    setStatus(item.documentId ? "Signature request completed." : "Attestation recorded.");
    setBusyItemId("");
  }

  async function submitForm() {
    setSubmitting(true);
    setStatus("Submitting form...");
    const response = await fetch(
      `${apiBaseUrl}${buildPublicTokenPath("/api/portal/intake-forms", token, "submit")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, clientSubmissionId }),
      },
    );
    if (!response.ok) {
      const body = await readPublicTokenError(response);
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
    setPayload((current) =>
      current ? { ...current, draft: null, link: submitted.link } : current,
    );
    setStatus("Submitted. Your information is ready for staff review.");
    setDraftStatus("Draft closed after submission.");
    setSubmitting(false);
  }

  return (
    <PublicTokenShell
      description="Complete the requested intake items from this secure link."
      eyebrow="Client intake"
      icon={<FileText size={22} />}
      title={payload?.template.name ?? "Intake form"}
    >
      <PublicStatusMessage>{status}</PublicStatusMessage>

      {payload ? (
        <PublicTokenNeedsAttention
          emptyLabel="No action is needed on this intake link right now."
          items={attentionItems}
        />
      ) : null}

      {payload?.template.definition.schemaVersion !== 2 && payload ? (
        <PublicStatusMessage>
          This intake form version is not available for public completion.
        </PublicStatusMessage>
      ) : null}

      {payload?.template.definition.schemaVersion === 2 ? (
        <IntakeFormRenderer
          acceptedSignatures={acceptedSignatures}
          actions={payload.actions}
          answers={answers}
          busyItemId={busyItemId}
          definition={payload.template.definition}
          disabled={disabled}
          recordSignature={(item) => void recordSignature(item)}
          sections={sections}
          setAcceptedSignatures={setAcceptedSignatures}
          updateAnswer={updateAnswer}
          uploadFile={(item, file) => void uploadFile(item, file)}
        />
      ) : null}

      <PublicStatusMessage>{draftStatus}</PublicStatusMessage>

      <button
        className="secondary-button public-submit-button"
        disabled={disabled || draftSaving || submitting || !payload}
        onClick={() => void saveDraft(true)}
        type="button"
      >
        {draftSaving ? "Saving draft..." : "Save draft"}
      </button>

      <button
        className="primary-button public-submit-button"
        disabled={disabled || submitting || !payload}
        onClick={() => void submitForm()}
        type="button"
      >
        {submitting ? "Submitting..." : "Submit intake"}
      </button>
    </PublicTokenShell>
  );
}
