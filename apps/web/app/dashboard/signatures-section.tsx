import type { SignatureRequestsResponse } from "../types";

interface SignaturesSectionProps {
  activeSignatures: SignatureRequestsResponse;
}

export function SignaturesSection({ activeSignatures }: SignaturesSectionProps) {
  return (
    <div className="party-list">
      {activeSignatures.map((signature) => (
        <div className="party-row" key={signature.id}>
          <span>
            <strong>{signature.title}</strong>
            <small>
              {signature.provider} · {signature.externalId}
            </small>
          </span>
          <em>{signature.status.replace("_", " ")}</em>
        </div>
      ))}
      {activeSignatures.length === 0 ? (
        <p className="inline-empty">No signature requests are linked to this matter.</p>
      ) : null}
    </div>
  );
}
