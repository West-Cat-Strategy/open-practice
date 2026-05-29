"use client";

import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PublicTokenActionItem } from "./publicTokenActions";
import { PublicTokenNeedsAttention } from "./publicTokenActions";
import { PublicStatusMessage } from "./publicTokenUi";
import type {
  ClientPortalWorkspaceAction,
  ClientPortalWorkspaceMatter,
  ClientPortalWorkspaceResponse,
} from "./types";

const actionKindLabel: Record<ClientPortalWorkspaceAction["kind"], string> = {
  share_link: "Secure share",
  external_upload: "Upload",
  intake_form: "Intake",
  guest_session: "Meeting",
  email_receipt: "Receipt",
  manual: "Update",
};

const permissionLabels: Record<string, string> = {
  view_documents: "Shared documents",
  upload_documents: "Uploads",
  message: "Messages",
  sign: "Signatures",
};

const clientPortalWorkspacePath = "/api/client-portal/workspace";
const authLogoutPath = "/api/auth/logout";

function buildPortalApiUrl(apiBaseUrl: string, path: string): string {
  return `${apiBaseUrl}${path}`;
}

function credentialedGetInit(): RequestInit {
  return { credentials: "include" };
}

function credentialedLogoutInit(): RequestInit {
  return { method: "POST", credentials: "include" };
}

function countLabel(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatPermission(permission: string): string {
  return permissionLabels[permission] ?? permission.replace(/_/g, " ");
}

function compactStatusCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(([, value]) => value > 0);
  if (entries.length === 0) return "0 tracked";
  return entries
    .map(([key, value]) => `${value} ${key.replace(/_/g, " ")}`)
    .slice(0, 3)
    .join(" / ");
}

function toAttentionItem(item: ClientPortalWorkspaceAction): PublicTokenActionItem {
  return {
    id: item.id,
    title: item.title,
    detail: `${actionKindLabel[item.kind]} / ${item.detail}`,
    status: item.status,
    tone: item.tone,
  };
}

function workspaceActions(workspace: ClientPortalWorkspaceResponse): ClientPortalWorkspaceAction[] {
  return workspace.matters.flatMap((matter) => matter.clientActions);
}

function portalNeedsAttentionItems(
  workspace: ClientPortalWorkspaceResponse,
): PublicTokenActionItem[] {
  return workspaceActions(workspace)
    .filter((item) => item.tone === "risk" || item.tone === "ready")
    .slice(0, 6)
    .map(toAttentionItem);
}

function portalRecentUpdates(
  workspace: ClientPortalWorkspaceResponse,
): ClientPortalWorkspaceAction[] {
  const neutral = workspaceActions(workspace).filter((item) => item.tone === "neutral");
  return (neutral.length > 0 ? neutral : workspaceActions(workspace)).slice(0, 6);
}

function matterMetricRows(matter: ClientPortalWorkspaceMatter) {
  return [
    {
      label: "Secure shares",
      value: countLabel(matter.summaries.secureShares.sharedDocumentCount, "document"),
      detail: `${matter.summaries.secureShares.activeLinkCount} active links`,
    },
    {
      label: "Uploads",
      value: countLabel(matter.summaries.externalUploads.remainingUploadSlots, "slot"),
      detail: compactStatusCounts(matter.summaries.externalUploads.reviewCounts),
    },
    {
      label: "Intake",
      value: countLabel(matter.summaries.intake.activeLinkCount, "active form"),
      detail: `${matter.summaries.intake.submittedLinkCount} submitted / ${matter.summaries.intake.draftLinkCount} drafts`,
    },
    {
      label: "Meetings",
      value: countLabel(matter.summaries.guestSessions.activeLinkCount, "guest link"),
      detail: compactStatusCounts(matter.summaries.guestSessions.statusCounts),
    },
    {
      label: "Receipts",
      value: countLabel(matter.summaries.receipts.pendingCount, "pending"),
      detail: `${matter.summaries.receipts.recordedCount} recorded / ${matter.summaries.receipts.expiredCount} expired`,
    },
    {
      label: "Signatures",
      value: countLabel(matter.summaries.signatures.pendingCount, "pending"),
      detail: `${matter.summaries.signatures.completedCount} completed`,
    },
  ];
}

function ActionItem({ item }: { item: ClientPortalWorkspaceAction }) {
  return (
    <li className={`client-portal-action ${item.tone}`}>
      <div>
        <span>{actionKindLabel[item.kind]}</span>
        <strong>{item.title}</strong>
        <small>{item.detail}</small>
      </div>
      <em>{item.status}</em>
    </li>
  );
}

function RecentUpdate({ item }: { item: ClientPortalWorkspaceAction }) {
  return (
    <div className={`public-form-action public-attention-item ${item.tone}`}>
      <div>
        <strong>{item.title}</strong>
        <small>
          {actionKindLabel[item.kind]} / {item.detail}
        </small>
      </div>
      <span className={item.tone === "risk" ? "risk" : undefined}>{item.status}</span>
    </div>
  );
}

function MatterWorkspace({
  index,
  matter,
}: {
  index: number;
  matter: ClientPortalWorkspaceMatter;
}) {
  const permissions = matter.access.permissions.map(formatPermission).join(" / ");
  const titleId = `client-portal-matter-${index + 1}-title`;
  return (
    <section className="client-portal-matter panel" aria-labelledby={titleId}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Matter access</p>
          <h2 id={titleId}>{matter.contact.displayName}</h2>
        </div>
        <span className="status-pill">{matter.access.redacted ? "Redacted view" : "Active"}</span>
      </div>

      <div className="client-portal-access-strip">
        <span>{permissions || "No active permissions"}</span>
        <span>{countLabel(matter.access.grantCount, "active grant")}</span>
        <span>
          {matter.access.expiresAt
            ? `Expires ${matter.access.expiresAt.slice(0, 10)}`
            : "No expiry"}
        </span>
      </div>

      <div className="client-portal-metrics">
        {matterMetricRows(matter).map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </div>
        ))}
      </div>

      <div className="client-portal-actions-block">
        <div className="panel-header compact">
          <div>
            <p className="eyebrow">Client actions</p>
            <h3>Current summaries</h3>
          </div>
          <span className="status-pill">{countLabel(matter.clientActions.length, "item")}</span>
        </div>
        {matter.clientActions.length > 0 ? (
          <ul className="client-portal-actions">
            {matter.clientActions.map((item) => (
              <ActionItem key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <p className="inline-empty">No open client actions are visible for this matter.</p>
        )}
      </div>
    </section>
  );
}

export function ClientPortalWorkspaceView({
  workspace,
  loading = false,
  onSignOut,
  signOutDisabled = false,
  status = "",
}: {
  workspace: ClientPortalWorkspaceResponse;
  loading?: boolean;
  onSignOut?: () => void;
  signOutDisabled?: boolean;
  status?: string;
}) {
  const attentionItems = portalNeedsAttentionItems(workspace);
  const recentUpdates = portalRecentUpdates(workspace);

  return (
    <main className="client-portal-shell" aria-busy={loading}>
      <section className="client-portal-header">
        <div>
          <p className="eyebrow">Client portal</p>
          <h1>{workspace.account.displayName}</h1>
          <p>{workspace.account.email}</p>
        </div>
        <div>
          <div className="client-portal-posture" aria-label="Portal access posture">
            <span>{workspace.access.status === "active" ? "Active" : "No active grants"}</span>
            <span>{countLabel(workspace.access.activeGrantCount, "grant")}</span>
            <span>Account linked</span>
          </div>
          <button
            className="secondary-button"
            disabled={signOutDisabled || !onSignOut}
            onClick={onSignOut}
            type="button"
          >
            <LogOut size={16} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </section>

      {status ? <PublicStatusMessage>{status}</PublicStatusMessage> : null}

      <section className="client-portal-boundaries" aria-label="Current portal boundaries">
        <span>Secure links preserved</span>
        <span>Status-only meetings</span>
        <span>Document access summarized</span>
        <span>Receipt posture</span>
      </section>

      <PublicTokenNeedsAttention
        emptyLabel="No client actions need attention right now."
        items={attentionItems}
      />

      <section className="public-form-section" aria-labelledby="client-portal-recent-updates">
        <div className="section-title">
          <h2 id="client-portal-recent-updates">Recent updates</h2>
          <span>{recentUpdates.length ? countLabel(recentUpdates.length, "item") : "clear"}</span>
        </div>
        {recentUpdates.length > 0 ? (
          <div className="public-form-items">
            {recentUpdates.map((item) => (
              <RecentUpdate key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="inline-empty">No recent client-visible updates are available.</p>
        )}
      </section>

      {workspace.matters.length > 0 ? (
        <div className="client-portal-matter-grid">
          {workspace.matters.map((matter, index) => (
            <MatterWorkspace
              index={index}
              key={`${matter.matterId}:${matter.contact.id}`}
              matter={matter}
            />
          ))}
        </div>
      ) : (
        <section className="client-portal-empty panel">
          <p className="eyebrow">Access</p>
          <h2>No active portal workspace</h2>
          <p className="inline-empty">This account has no active portal grants.</p>
        </section>
      )}
    </main>
  );
}

function ClientPortalLoadingView({ status }: { status: string }) {
  return (
    <main className="client-portal-shell" aria-busy="true">
      <section className="client-portal-header">
        <div>
          <p className="eyebrow">Client portal</p>
          <h1>Workspace</h1>
          <p>Loading account access.</p>
        </div>
        <UserRound size={24} aria-hidden="true" />
      </section>
      <PublicStatusMessage>{status}</PublicStatusMessage>
    </main>
  );
}

function ClientPortalErrorView({ status, onRetry }: { status: string; onRetry?: () => void }) {
  return (
    <main className="client-portal-shell">
      <section className="client-portal-empty panel" aria-labelledby="client-portal-error">
        <p className="eyebrow">Client portal</p>
        <h1 id="client-portal-error">Workspace unavailable</h1>
        <PublicStatusMessage>{status}</PublicStatusMessage>
        {onRetry ? (
          <button className="secondary-button" onClick={onRetry} type="button">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Retry</span>
          </button>
        ) : null}
      </section>
    </main>
  );
}

type ClientPortalWorkspaceProps = {
  apiBaseUrl?: string;
  workspace?: ClientPortalWorkspaceResponse | null;
};

export default function ClientPortalWorkspace({
  apiBaseUrl = "",
  workspace: initialWorkspace = null,
}: ClientPortalWorkspaceProps) {
  const [workspace, setWorkspace] = useState<ClientPortalWorkspaceResponse | null>(
    initialWorkspace,
  );
  const [status, setStatus] = useState(
    initialWorkspace ? "Workspace loaded." : "Loading client workspace...",
  );
  const [loading, setLoading] = useState(!initialWorkspace);
  const [signingOut, setSigningOut] = useState(false);
  const canFetchWorkspace = apiBaseUrl.length > 0;

  useEffect(() => {
    if (!canFetchWorkspace) return;
    let cancelled = false;

    async function loadWorkspace(): Promise<void> {
      setLoading(true);
      setStatus("Loading client workspace...");
      const response = await fetch(
        buildPortalApiUrl(apiBaseUrl, clientPortalWorkspacePath),
        credentialedGetInit(),
      );
      if (cancelled) return;
      if (!response.ok) {
        setWorkspace(null);
        setStatus(`Client workspace unavailable: ${response.status}`);
        setLoading(false);
        return;
      }
      const nextWorkspace = (await response.json()) as ClientPortalWorkspaceResponse;
      setWorkspace(nextWorkspace);
      setStatus("Workspace loaded.");
      setLoading(false);
    }

    void loadWorkspace().catch((error: unknown) => {
      if (cancelled) return;
      setWorkspace(null);
      setStatus(error instanceof Error ? error.message : "Client workspace unavailable.");
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, canFetchWorkspace]);

  async function signOut(): Promise<void> {
    if (!apiBaseUrl) return;
    setSigningOut(true);
    setStatus("Signing out...");
    try {
      const response = await fetch(
        buildPortalApiUrl(apiBaseUrl, authLogoutPath),
        credentialedLogoutInit(),
      );
      if (!response.ok) {
        setStatus(`Sign out failed: ${response.status}`);
        setSigningOut(false);
        return;
      }
      setStatus("Signed out.");
      window.location.assign("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign out failed.");
      setSigningOut(false);
    }
  }

  const statusMessage = useMemo(() => {
    if (!apiBaseUrl && !workspace) return "Client workspace route is not configured.";
    return status;
  }, [apiBaseUrl, status, workspace]);

  if (!workspace && loading) return <ClientPortalLoadingView status={statusMessage} />;
  if (!workspace) {
    return (
      <ClientPortalErrorView
        onRetry={canFetchWorkspace ? () => window.location.reload() : undefined}
        status={statusMessage}
      />
    );
  }

  return (
    <ClientPortalWorkspaceView
      loading={loading}
      onSignOut={apiBaseUrl ? () => void signOut() : undefined}
      signOutDisabled={signingOut}
      status={status}
      workspace={workspace}
    />
  );
}

export const clientPortalWorkspaceTestExports = {
  compactStatusCounts,
  countLabel,
  formatPermission,
  authLogoutPath,
  buildPortalApiUrl,
  clientPortalWorkspacePath,
  credentialedGetInit,
  credentialedLogoutInit,
  portalNeedsAttentionItems,
  portalRecentUpdates,
};
