import {
  compactDocumentAssemblyStatus,
  summarizeDocumentAssemblyWorkbench,
} from "../document-assembly-dashboard";
import type { DocumentAssemblyWorkbenchResponse } from "../_features/document-assembly/models";

export function DocumentAssemblyDashboardBlock({
  workbench,
}: {
  workbench: DocumentAssemblyWorkbenchResponse;
}) {
  const summary = summarizeDocumentAssemblyWorkbench(workbench);

  return (
    <>
      <div className="section-title">
        <h3>Document assembly</h3>
        <span>{summary}</span>
      </div>
      <div className="detail-grid compact-detail-grid">
        <div>
          <span className="field-label">Document sets</span>
          <strong>{workbench.summary.activeDefinitionCount}</strong>
          <small>OP-authored reusable definitions</small>
        </div>
        <div>
          <span className="field-label">Packages</span>
          <strong>{workbench.summary.packageCount}</strong>
          <small>{workbench.summary.blockedPackageCount} need review</small>
        </div>
        <div>
          <span className="field-label">Envelopes</span>
          <strong>{workbench.summary.envelopeCount}</strong>
          <small>{workbench.summary.validEnvelopeCount} validated</small>
        </div>
        <div>
          <span className="field-label">Payload posture</span>
          <strong>{compactDocumentAssemblyStatus(workbench.status)}</strong>
          <small>IDs, roles, counts, and statuses only</small>
        </div>
      </div>
      <div className="party-list">
        {workbench.packages.map((assemblyPackage) => (
          <div className="party-row" key={assemblyPackage.package.id}>
            <span>
              <strong>{assemblyPackage.package.title}</strong>
              <small>
                {assemblyPackage.definition?.name ?? "Definition unavailable"} ·{" "}
                {assemblyPackage.readiness.documentCount} documents ·{" "}
                {assemblyPackage.readiness.generatedDocumentCount} generated ·{" "}
                {assemblyPackage.readiness.signatureRequestCount} signatures
              </small>
              <small>
                {assemblyPackage.readiness.blockedReasons.length > 0
                  ? assemblyPackage.readiness.blockedReasons.join(" · ")
                  : "Ready package metadata with no raw matter values returned."}
              </small>
            </span>
            <em
              className={assemblyPackage.readiness.blockedReasons.length > 0 ? "risk" : undefined}
            >
              {compactDocumentAssemblyStatus(assemblyPackage.package.status)}
            </em>
          </div>
        ))}
        {workbench.packages.length === 0 ? (
          <p className="inline-empty">No document assembly packages are linked to this matter.</p>
        ) : null}
      </div>
      {workbench.packages.some((item) => item.envelopes.length > 0) ? (
        <div className="party-list">
          {workbench.packages.flatMap((assemblyPackage) =>
            assemblyPackage.envelopes.map((envelope) => (
              <div className="party-row" key={envelope.envelope.id}>
                <span>
                  <strong>{envelope.envelope.title}</strong>
                  <small>
                    {envelope.envelope.signerOrder.length} signer roles ·{" "}
                    {envelope.envelope.fieldSummaries.length} field summaries ·{" "}
                    {envelope.linkedSignature
                      ? compactDocumentAssemblyStatus(envelope.linkedSignature.status)
                      : "not linked to a signature request"}
                  </small>
                  <small>
                    {envelope.validationIssues.length > 0
                      ? envelope.validationIssues.join(" · ")
                      : "Signer order and field placement metadata are valid."}
                  </small>
                </span>
                <em className={envelope.validationIssues.length > 0 ? "risk" : undefined}>
                  {compactDocumentAssemblyStatus(envelope.envelope.validationStatus)}
                </em>
              </div>
            )),
          )}
        </div>
      ) : null}
    </>
  );
}
