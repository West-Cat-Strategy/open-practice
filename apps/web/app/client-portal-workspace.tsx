import { CheckCircle2, Clock3, FileText, LockKeyhole } from "lucide-react";
import {
  clientPortalAccessLabel,
  clientPortalActionFamilyLabel,
  clientPortalAttentionCount,
  clientPortalMatterActionLabel,
} from "./client-portal-workspace-utils";
import type { ClientPortalWorkspaceResponse } from "./types";

interface ClientPortalWorkspaceProps {
  workspace: ClientPortalWorkspaceResponse;
}

function toneClass(tone: "neutral" | "ready" | "risk"): string {
  if (tone === "ready") return "ready";
  if (tone === "risk") return "risk";
  return "";
}

export default function ClientPortalWorkspace({ workspace }: ClientPortalWorkspaceProps) {
  const attentionCount = clientPortalAttentionCount(workspace);
  return (
    <main className="client-portal-shell legal-ops-shell" aria-labelledby="client-portal-title">
      <section className="client-portal-header">
        <div className="client-portal-title">
          <span className="setup-icon-box auth-icon-box" aria-hidden="true">
            <LockKeyhole size={24} />
          </span>
          <div>
            <p className="eyebrow">Client Portal</p>
            <h1 id="client-portal-title">{workspace.account.displayName}</h1>
            <p>{workspace.account.email}</p>
          </div>
        </div>
        <div className="client-portal-status" aria-label="Client portal status">
          <span>{clientPortalAccessLabel(workspace.access)}</span>
          <strong>{attentionCount} need attention</strong>
        </div>
      </section>

      <section className="client-portal-band" aria-labelledby="client-matters-title">
        <div className="section-title">
          <h2 id="client-matters-title">Matters</h2>
          <span>{workspace.matters.length} visible</span>
        </div>
        <div className="client-portal-matter-grid">
          {workspace.matters.map((matter) => (
            <article className="client-portal-matter" key={matter.id}>
              <div>
                <strong>{matter.number}</strong>
                <h3>{matter.title}</h3>
                <p>{matter.status}</p>
              </div>
              <span>{clientPortalMatterActionLabel(matter.actionCount)}</span>
            </article>
          ))}
          {workspace.matters.length === 0 ? (
            <p className="inline-empty">No active matter access is linked to this account.</p>
          ) : null}
        </div>
      </section>

      <section className="client-portal-band" aria-labelledby="client-actions-title">
        <div className="section-title">
          <h2 id="client-actions-title">Actions</h2>
          <span>{workspace.actions.length} summaries</span>
        </div>
        <div className="client-portal-actions">
          {workspace.actions.map((action) => (
            <article className="client-portal-action" key={action.id}>
              <span className={`client-portal-action-icon ${toneClass(action.tone)}`}>
                {action.tone === "ready" ? (
                  <CheckCircle2 size={18} aria-hidden="true" />
                ) : action.tone === "risk" ? (
                  <Clock3 size={18} aria-hidden="true" />
                ) : (
                  <FileText size={18} aria-hidden="true" />
                )}
              </span>
              <div>
                <span>{clientPortalActionFamilyLabel(action.family)}</span>
                <strong>{action.title}</strong>
                <p>{action.detail}</p>
              </div>
              <em className={toneClass(action.tone)}>{action.status.replaceAll("_", " ")}</em>
            </article>
          ))}
          {workspace.actions.length === 0 ? (
            <p className="inline-empty">No client actions are open for this account.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
