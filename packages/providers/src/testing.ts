import type {
  AiOperationalProposalProvider,
  AiOperationalProposalProviderResult,
  AiOperationalProposalRequest,
  DraftAssistProvider,
  DraftAssistRequest,
  DraftAssistResult,
  DraftAssistStatusResult,
} from "@open-practice/domain";

export class FakeDraftAssistProvider implements DraftAssistProvider, AiOperationalProposalProvider {
  constructor(private readonly options: { providerKey?: string; model?: string } = {}) {}

  getStatus(): DraftAssistStatusResult {
    return {
      status: "configured",
      provider: this.options.providerKey ?? "fake-local-ai",
      model: this.options.model ?? "fake-draft-assist-v1",
      supportedTasks: ["summarize", "suggest_revision", "continue_draft"],
    };
  }

  async createSuggestion(request: DraftAssistRequest): Promise<DraftAssistResult> {
    const providerKey = this.options.providerKey ?? "fake-local-ai";
    const providerModel = this.options.model ?? "fake-draft-assist-v1";
    const sourceWords = request.sourceText.split(/\s+/).filter(Boolean).length;
    const taskLabel = request.task.replaceAll("_", " ");
    const instructionSuffix = request.instruction
      ? ` Instruction noted (${request.instruction.length} chars).`
      : "";

    return {
      providerKey,
      providerModel,
      suggestedText: `[${taskLabel}] Synthetic assist suggestion for ${sourceWords} source words.${instructionSuffix}`,
      summary: `Synthetic ${taskLabel} suggestion`,
      metadata: {
        sourceWordCount: sourceWords,
        instructionLength: request.instruction?.length ?? 0,
      },
    };
  }

  async createOperationalProposals(
    request: AiOperationalProposalRequest,
  ): Promise<AiOperationalProposalProviderResult> {
    const providerKey = this.options.providerKey ?? "fake-local-ai";
    const providerModel = this.options.model ?? "fake-operational-proposals-v1";
    const sourceWords = request.sourceText.split(/\s+/).filter(Boolean).length;

    return {
      providerKey,
      providerModel,
      proposals: request.requestedKinds.map((kind) => ({
        kind,
        proposal: {
          title: syntheticProposalTitle(kind),
          summary: `Synthetic ${kind.replaceAll("_", " ")} proposal from ${sourceWords} source words.`,
          proposedAction: "Review this proposal before changing any operational record.",
          ...syntheticProposalPayload(kind),
        },
        metadata: {
          sourceWordCount: sourceWords,
          requestedKind: kind,
        },
      })),
    };
  }
}

function syntheticProposalTitle(
  kind: AiOperationalProposalRequest["requestedKinds"][number],
): string {
  switch (kind) {
    case "deadline_extraction":
      return "Review possible deadline";
    case "task_creation":
      return "Review proposed task";
    case "document_organization":
      return "Review document organization cue";
    case "draft_invoice_cue":
      return "Review draft invoice cue";
    case "client_update_draft":
      return "Review client update draft";
  }
}

function syntheticProposalPayload(kind: AiOperationalProposalRequest["requestedKinds"][number]) {
  switch (kind) {
    case "deadline_extraction":
      return { deadline: { suggestedDueAt: "2026-06-15T16:00:00.000Z" } };
    case "task_creation":
      return { task: { title: "Review synthetic action item" } };
    case "document_organization":
      return { documentOrganization: { category: "review", suggestedFolder: "Matter review" } };
    case "draft_invoice_cue":
      return { invoiceCue: { cueType: "review" as const } };
    case "client_update_draft":
      return { clientUpdate: { tone: "neutral" as const, audience: "client" as const } };
  }
}
