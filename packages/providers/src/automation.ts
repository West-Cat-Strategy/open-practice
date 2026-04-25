import type {
  AutomationSessionRef,
  DocumentAutomationProvider,
  GeneratedDocumentRef,
  RenderAutomatedDocumentInput,
  StartAutomationInterviewInput,
} from "@open-practice/domain";

export class EmbeddedAutomationProvider implements DocumentAutomationProvider {
  async startInterview(input: StartAutomationInterviewInput): Promise<AutomationSessionRef> {
    return {
      provider: "embedded",
      externalId: `embedded:${input.matterId}:${input.templateId}`,
      status: "created",
      evidence: {
        mode: "embedded",
        firmId: input.firmId,
        matterId: input.matterId,
        templateId: input.templateId,
        clientContactId: input.clientContactId,
        ...input.metadata,
      },
    };
  }

  async getInterviewStatus(externalId: string): Promise<AutomationSessionRef> {
    return {
      provider: "embedded",
      externalId,
      status: "in_progress",
      evidence: { mode: "embedded" },
    };
  }

  async renderDocument(input: RenderAutomatedDocumentInput): Promise<GeneratedDocumentRef> {
    return {
      provider: "embedded",
      externalId: `embedded:${input.sessionExternalId}:${input.documentTitle}`,
      title: input.documentTitle,
      evidence: {
        mode: "embedded",
        firmId: input.firmId,
        matterId: input.matterId,
      },
    };
  }
}
