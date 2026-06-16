import type { SignatureRequestsResponse } from "../types";

interface SignaturesSectionProps {
  activeSignatures: SignatureRequestsResponse;
}

function compactStatus(value: string): string {
  return value.replaceAll("_", " ");
}

function signatureEnvelopeSummary(signature: SignatureRequestsResponse[number]): string {
  const validationStatus = signature.validationStatus ?? "unchecked";
  const signerCount = signature.signerOrder?.length ?? 0;
  const fieldCount = signature.fieldPlacements?.length ?? 0;
  if (validationStatus === "unchecked" && signerCount === 0 && fieldCount === 0) {
    return "Envelope unchecked";
  }
  return `${compactStatus(validationStatus)} envelope · ${signerCount} signer ${
    signerCount === 1 ? "role" : "roles"
  } · ${fieldCount} ${fieldCount === 1 ? "field" : "fields"}`;
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
            <small>{signatureEnvelopeSummary(signature)}</small>
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
