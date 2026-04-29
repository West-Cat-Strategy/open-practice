import type { DraftRecord, DraftTemplateRecord, TipTapNode } from "@open-practice/domain";
import type { DraftingDashboardResponse, MatterSummary } from "./types";

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
