import type {
  DraftAssistProvider,
  DraftAssistRequest,
  DraftAssistResult,
  DraftAssistStatusResult,
} from "@open-practice/domain";

export class DisabledDraftAssistProvider implements DraftAssistProvider {
  getStatus(): DraftAssistStatusResult {
    return {
      status: "disabled",
      reason: "not_configured",
      supportedTasks: ["summarize", "suggest_revision", "continue_draft"],
    };
  }

  async createSuggestion(): Promise<DraftAssistResult> {
    throw new Error("Draft assist provider is not configured");
  }
}

export class FakeDraftAssistProvider implements DraftAssistProvider {
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
}
