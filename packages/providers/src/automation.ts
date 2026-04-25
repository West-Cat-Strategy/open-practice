import type {
  AutomationSessionRef,
  DocumentAutomationProvider,
  GeneratedDocumentRef,
  RenderAutomatedDocumentInput,
  StartAutomationInterviewInput,
} from "@open-practice/domain";
import { ProviderConfigurationError, ProviderResponseError } from "./errors.js";

export class DocassembleAutomationProvider implements DocumentAutomationProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async startInterview(input: StartAutomationInterviewInput): Promise<AutomationSessionRef> {
    if (!this.baseUrl || !this.apiKey) {
      throw new ProviderConfigurationError("docassemble base URL and API key are required");
    }

    const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}/api/interviews`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: input.templateId,
        metadata: {
          firmId: input.firmId,
          matterId: input.matterId,
          clientContactId: input.clientContactId,
          returnUrl: input.returnUrl,
          ...input.metadata,
        },
      }),
    });

    if (!response.ok) {
      throw new ProviderResponseError(
        `docassemble interview creation failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const id = payload.id ?? payload.session_id;
    if (typeof id !== "string" && typeof id !== "number") {
      throw new ProviderResponseError("docassemble response did not include a session identifier");
    }

    return {
      provider: "docassemble",
      externalId: String(id),
      interviewUrl: typeof payload.interview_url === "string" ? payload.interview_url : undefined,
      status: "created",
      evidence: payload,
    };
  }

  async getInterviewStatus(externalId: string): Promise<AutomationSessionRef> {
    if (!this.baseUrl || !this.apiKey) {
      throw new ProviderConfigurationError("docassemble base URL and API key are required");
    }

    const response = await this.fetchImpl(
      `${this.baseUrl.replace(/\/$/, "")}/api/interviews/${encodeURIComponent(externalId)}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    );

    if (!response.ok) {
      throw new ProviderResponseError(
        `docassemble interview lookup failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return {
      provider: "docassemble",
      externalId,
      status: mapDocassembleStatus(payload.status),
      evidence: payload,
    };
  }

  async renderDocument(input: RenderAutomatedDocumentInput): Promise<GeneratedDocumentRef> {
    if (!this.baseUrl || !this.apiKey) {
      throw new ProviderConfigurationError("docassemble base URL and API key are required");
    }

    const response = await this.fetchImpl(
      `${this.baseUrl.replace(/\/$/, "")}/api/interviews/${encodeURIComponent(
        input.sessionExternalId,
      )}/documents`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firm_id: input.firmId,
          matter_id: input.matterId,
          title: input.documentTitle,
        }),
      },
    );

    if (!response.ok) {
      throw new ProviderResponseError(
        `docassemble document generation failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const id = payload.id ?? payload.document_id;
    if (typeof id !== "string" && typeof id !== "number") {
      throw new ProviderResponseError("docassemble response did not include a document identifier");
    }

    return {
      provider: "docassemble",
      externalId: String(id),
      title: input.documentTitle,
      storageKey: typeof payload.storage_key === "string" ? payload.storage_key : undefined,
      checksumSha256:
        typeof payload.checksum_sha256 === "string" ? payload.checksum_sha256 : undefined,
      evidence: payload,
    };
  }
}

function mapDocassembleStatus(status: unknown): AutomationSessionRef["status"] {
  if (status === "complete" || status === "completed") return "completed";
  if (status === "ready" || status === "ready_to_generate") return "ready_to_generate";
  if (status === "started" || status === "in_progress") return "in_progress";
  if (status === "created") return "created";
  return "provider_error";
}
