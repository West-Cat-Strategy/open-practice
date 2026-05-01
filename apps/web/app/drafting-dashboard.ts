import type {
  DraftRecord,
  DraftAssistRecord,
  DraftTemplateRecord,
  TipTapDocument,
  TipTapNode,
} from "@open-practice/domain";
import type { DraftingDashboardResponse, MatterSummary } from "./types";

export const blankDraftDocument: TipTapDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export async function loadDraftingDashboardData(input: {
  matters: Pick<MatterSummary, "id">[];
  listTemplates: () => Promise<DraftTemplateRecord[]>;
  listDraftsForMatter: (matterId: string) => Promise<DraftRecord[]>;
}): Promise<DraftingDashboardResponse> {
  const [templates, matterDraftEntries] = await Promise.all([
    input.listTemplates(),
    Promise.all(
      input.matters.map(async (matter) => {
        const drafts = await input.listDraftsForMatter(matter.id);
        return [matter.id, drafts] as const;
      }),
    ),
  ]);

  return {
    templates,
    draftsByMatterId: Object.fromEntries(matterDraftEntries),
  };
}

export function buildDraftFromTemplatePayload(input: {
  matter: Pick<MatterSummary, "id" | "number">;
  template: Pick<DraftTemplateRecord, "id" | "name">;
}): { matterId: string; title: string; templateId: string } {
  return {
    matterId: input.matter.id,
    title: `${input.template.name} - ${input.matter.number}`,
    templateId: input.template.id,
  };
}

export function buildBlankDraftPayload(input: { matter: Pick<MatterSummary, "id" | "number"> }): {
  matterId: string;
  title: string;
  editorJson: TipTapDocument;
} {
  return {
    matterId: input.matter.id,
    title: `Blank Draft - ${input.matter.number}`,
    editorJson: structuredClone(blankDraftDocument),
  };
}

export function buildDraftUpdatePayload(input: { editorJson: TipTapDocument }): {
  editorJson: TipTapDocument;
} {
  return {
    editorJson: input.editorJson,
  };
}

export function formatDraftApiFailure(
  action: "creation" | "save",
  status: number,
  payload?: unknown,
): string {
  const message =
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
      ? `: ${payload.message}`
      : "";

  return `Draft ${action} failed: ${status}${message}`;
}

export function isSameDraftDocument(left: TipTapDocument, right: TipTapDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function appendDraftToMatterDrafts(
  draftsByMatterId: DraftingDashboardResponse["draftsByMatterId"],
  draft: DraftRecord,
): DraftingDashboardResponse["draftsByMatterId"] {
  if (!draft.matterId) return draftsByMatterId;

  return {
    ...draftsByMatterId,
    [draft.matterId]: [...(draftsByMatterId[draft.matterId] ?? []), draft],
  };
}

export function extractDraftPlainText(node: TipTapNode | DraftRecord["editorJson"]): string {
  const parts: string[] = [];

  function visit(current: TipTapNode): void {
    if (typeof current.text === "string") {
      parts.push(current.text);
    }
    for (const child of current.content ?? []) {
      visit(child);
    }
  }

  visit(node);

  return parts.join(" ").replace(/\s+/g, " ").trim() || "No preview text.";
}

function appendPlainTextToDraftDocument(
  document: TipTapDocument,
  plainText: string,
): TipTapDocument {
  const paragraphs = plainText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map<TipTapNode>((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }],
    }));

  if (paragraphs.length === 0) return structuredClone(document);
  return {
    ...structuredClone(document),
    content: [...(document.content ?? []), ...paragraphs],
  };
}

export function insertDraftAssistSuggestion(input: {
  editorJson: TipTapDocument;
  record: Pick<DraftAssistRecord, "suggestedText">;
}): TipTapDocument {
  return appendPlainTextToDraftDocument(input.editorJson, input.record.suggestedText);
}

export function describeDraftAssistStatus(input: { status: string; reason?: string }): string {
  if (input.status === "configured") return "Draft assist is available for review-first use.";
  return `Draft assist unavailable${input.reason ? `: ${input.reason.replaceAll("_", " ")}` : ""}.`;
}
