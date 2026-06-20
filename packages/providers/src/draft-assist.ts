import type {
  DraftAssistProvider,
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
