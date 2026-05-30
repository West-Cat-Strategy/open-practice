import type {
  DocumentAssemblyDashboardResponse,
  DocumentAssemblyWorkbenchResponse,
  MatterSummary,
} from "./types";

export function buildDocumentAssemblyWorkbenchPath(matterId: string): string {
  return `/api/document-assembly/workbench?matterId=${encodeURIComponent(matterId)}`;
}

export function emptyDocumentAssemblyWorkbench(
  matterId: string,
  status: DocumentAssemblyWorkbenchResponse["status"] = "unavailable",
): DocumentAssemblyWorkbenchResponse {
  return {
    status,
    matterId,
    definitions: [],
    packages: [],
    summary: {
      packageCount: 0,
      activeDefinitionCount: 0,
      blockedPackageCount: 0,
      envelopeCount: 0,
      validEnvelopeCount: 0,
    },
  };
}

export async function loadDocumentAssemblyDashboardData(input: {
  matters: MatterSummary[];
  getWorkbench: (matterId: string) => Promise<DocumentAssemblyWorkbenchResponse>;
}): Promise<DocumentAssemblyDashboardResponse> {
  const entries = await Promise.all(
    input.matters.map(async (matter) => [matter.id, await input.getWorkbench(matter.id)] as const),
  );
  return { workbenchesByMatterId: Object.fromEntries(entries) };
}

export function replaceDocumentAssemblyWorkbench(
  current: Record<string, DocumentAssemblyWorkbenchResponse>,
  workbench: DocumentAssemblyWorkbenchResponse,
): Record<string, DocumentAssemblyWorkbenchResponse> {
  return { ...current, [workbench.matterId]: workbench };
}

export function summarizeDocumentAssemblyWorkbench(
  workbench: DocumentAssemblyWorkbenchResponse,
): string {
  if (workbench.status === "access_denied") return "Document assembly is not available.";
  if (workbench.status === "unavailable") return "Document assembly workbench is unavailable.";
  return `${workbench.summary.packageCount} packages · ${workbench.summary.envelopeCount} envelopes · ${workbench.summary.blockedPackageCount} blocked`;
}

export function compactDocumentAssemblyStatus(value?: string): string {
  if (!value) return "not set";
  return value.replaceAll("_", " ").replaceAll("-", " ");
}
