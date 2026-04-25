import type { MatterSummary } from "./types";

export function filterMatters(matters: MatterSummary[], query: string): MatterSummary[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return matters;
  return matters.filter((matter) =>
    [matter.title, matter.number, matter.practiceArea, matter.status, matter.jurisdiction]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}
