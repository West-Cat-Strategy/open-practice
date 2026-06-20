import type {
  CreateSignatureRequestInput,
  SignatureProvider,
  SignatureProviderSubmission,
} from "@open-practice/domain";

export class EmbeddedSignatureProvider implements SignatureProvider {
  async createSubmission(input: CreateSignatureRequestInput): Promise<SignatureProviderSubmission> {
    return {
      provider: "embedded",
      externalId: `embedded:${input.matterId}:${input.documentId}`,
      status: "sent",
      evidence: {
        mode: "embedded",
        title: input.title,
        signerCount: input.signers.length,
        consentTextCaptured: input.consentText.length > 0,
      },
    };
  }

  async getSubmission(externalId: string): Promise<SignatureProviderSubmission> {
    return {
      provider: "embedded",
      externalId,
      status: "sent",
      evidence: {
        mode: "embedded_provider_sync",
      },
    };
  }
}
