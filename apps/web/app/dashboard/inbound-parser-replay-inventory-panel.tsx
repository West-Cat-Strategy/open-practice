import type { InboundParserReplayInventoryResponse } from "../types";

const replayInventoryBoundary =
  "no raw MIME · no object key · no provider payload · no mailbox secret · no document promotion · no matter creation";

export function formatReplayInventoryAge(ageSeconds: number): string {
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0) return "unknown age";
  if (ageSeconds < 60) return `${Math.floor(ageSeconds)}s old`;
  const ageMinutes = Math.floor(ageSeconds / 60);
  if (ageMinutes < 60) return `${ageMinutes}m old`;
  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 48) return `${ageHours}h old`;
  return `${Math.floor(ageHours / 24)}d old`;
}

export function InboundParserReplayInventoryPanel({
  compactDate,
  inventory,
}: {
  compactDate: (value?: string) => string;
  inventory: InboundParserReplayInventoryResponse;
}) {
  if (inventory.status === "access_denied" || inventory.status === "unavailable") return null;

  return (
    <article className="panel matter-detail matter-detail-panel">
      <div className="panel-header matter-detail-header">
        <div>
          <p className="eyebrow">Owner review</p>
          <h2>Inbound parser replay inventory</h2>
        </div>
        <span className="status-chip">{inventory.summary.total} jobs</span>
      </div>
      <div className="detail-grid compact-detail-grid">
        <div>
          <span className="field-label">Failed</span>
          <strong>{inventory.summary.failed}</strong>
        </div>
        <div>
          <span className="field-label">Dead letter</span>
          <strong>{inventory.summary.deadLetter}</strong>
        </div>
        <div>
          <span className="field-label">Generated</span>
          <strong>{compactDate(inventory.generatedAt)}</strong>
        </div>
        <div>
          <span className="field-label">Boundary</span>
          <strong>metadata only</strong>
        </div>
      </div>
      <div className="party-list">
        {inventory.jobs.slice(0, 5).map((job) => (
          <div className="party-row stacked-row" key={job.jobId}>
            <span>
              <strong>{job.jobId}</strong>
              <small>
                {job.providerFamily} · {job.failureStage} · {job.status.replaceAll("_", " ")}
              </small>
              <small>
                {formatReplayInventoryAge(job.ageSeconds)} · {job.attemptsMade}/{job.maxAttempts}{" "}
                attempts · queued {compactDate(job.queuedAt)}
              </small>
              <small>{replayInventoryBoundary}</small>
            </span>
            <em className="risk">{job.status.replaceAll("_", " ")}</em>
          </div>
        ))}
        {inventory.jobs.length === 0 ? (
          <p className="inline-empty">
            No failed or dead-letter inbound parser jobs are waiting for owner review.
          </p>
        ) : null}
      </div>
    </article>
  );
}
