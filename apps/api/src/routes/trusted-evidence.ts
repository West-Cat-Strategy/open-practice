type EvidenceRecord = Record<string, unknown>;

function cleanClientEvidence(evidence: EvidenceRecord | undefined): EvidenceRecord | undefined {
  if (!evidence) return undefined;
  const entries = Object.entries(evidence).filter(([, value]) => value !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function trustedEvidence(
  serverEvidence: EvidenceRecord,
  clientEvidence?: EvidenceRecord,
): EvidenceRecord {
  const cleanedClientEvidence = cleanClientEvidence(clientEvidence);
  if (!cleanedClientEvidence) return serverEvidence;
  return {
    ...serverEvidence,
    clientEvidence: cleanedClientEvidence,
  };
}
