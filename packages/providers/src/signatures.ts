import type {
  CreateSignatureRequestInput,
  SignatureProvider,
  SignatureProviderSubmission,
} from "@open-practice/domain";
import { ProviderConfigurationError, ProviderResponseError } from "./errors.js";

export class ManualSignatureProvider implements SignatureProvider {
  async createSubmission(input: CreateSignatureRequestInput): Promise<SignatureProviderSubmission> {
    return {
      provider: "manual",
      externalId: `manual:${input.matterId}:${input.documentId}`,
      status: "sent",
      evidence: {
        title: input.title,
        signerCount: input.signers.length,
        consentTextCaptured: input.consentText.length > 0,
      },
    };
  }
}

export class DocuSealSignatureProvider implements SignatureProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async createSubmission(input: CreateSignatureRequestInput): Promise<SignatureProviderSubmission> {
    if (!this.baseUrl || !this.apiKey) {
      throw new ProviderConfigurationError("DocuSeal base URL and API key are required");
    }

    const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}/api/submissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.title,
        document_id: input.documentId,
        metadata: {
          matterId: input.matterId,
          consentText: input.consentText,
        },
        submitters: input.signers.map((signer) => ({
          name: signer.name,
          email: signer.email,
          role: signer.role,
        })),
      }),
    });

    if (!response.ok) {
      throw new ProviderResponseError(`DocuSeal submission failed with status ${response.status}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const id = payload.id ?? payload.submission_id ?? payload.slug;
    if (typeof id !== "string" && typeof id !== "number") {
      throw new ProviderResponseError("DocuSeal response did not include a submission identifier");
    }
    const signingUrl = payload.signing_url ?? payload.submitter_slug;

    return {
      provider: "docuseal",
      externalId: String(id),
      status: "sent",
      signingUrl: typeof signingUrl === "string" ? signingUrl : undefined,
      evidence: payload,
    };
  }

  async getSubmission(externalId: string): Promise<SignatureProviderSubmission> {
    if (!this.baseUrl || !this.apiKey) {
      throw new ProviderConfigurationError("DocuSeal base URL and API key are required");
    }

    const response = await this.fetchImpl(
      `${this.baseUrl.replace(/\/$/, "")}/api/submissions/${encodeURIComponent(externalId)}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    );

    if (!response.ok) {
      throw new ProviderResponseError(`DocuSeal lookup failed with status ${response.status}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return {
      provider: "docuseal",
      externalId,
      status: mapDocuSealStatus(payload.status),
      evidence: payload,
    };
  }
}

function mapDocuSealStatus(status: unknown): SignatureProviderSubmission["status"] {
  if (status === "completed") return "completed";
  if (status === "declined") return "declined";
  if (status === "opened" || status === "viewed") return "viewed";
  if (status === "pending" || status === "sent") return "sent";
  return "provider_error";
}
