import type {
  ExternalUploadLinkRecord,
  ExternalUploadsDashboardResponse,
  ExternalUploadsStatusResponse,
  MatterSummary,
} from "./types";

export interface ExternalUploadCreateFormState {
  matterId: string;
  maxUploads: string;
  expiresAtLocal: string;
}

export const externalUploadsStatusFallback: ExternalUploadsStatusResponse = {
  status: "unavailable",
  reason: "external_uploads_unavailable",
};

export function buildExternalUploadListPath(matterId: string): string {
  return `/api/external-uploads?matterId=${encodeURIComponent(matterId)}`;
}

export function buildExternalUploadRevokePath(uploadId: string): string {
  return `/api/external-uploads/${encodeURIComponent(uploadId)}/revoke`;
}

export function canCreateExternalUpload(status: ExternalUploadsStatusResponse): boolean {
  return status.status === "available";
}

export function coerceExternalUploadMaxUploads(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function buildExternalUploadCreatePayload(input: ExternalUploadCreateFormState): {
  matterId: string;
  maxUploads: number;
  expiresAt?: string;
} {
  const expiresAt = input.expiresAtLocal.trim()
    ? new Date(input.expiresAtLocal).toISOString()
    : undefined;

  return {
    matterId: input.matterId,
    maxUploads: coerceExternalUploadMaxUploads(input.maxUploads),
    ...(expiresAt ? { expiresAt } : {}),
  };
}

export function upsertExternalUploadLink(
  uploadsByMatterId: Record<string, ExternalUploadLinkRecord[]>,
  upload: ExternalUploadLinkRecord,
): Record<string, ExternalUploadLinkRecord[]> {
  const matterUploads = uploadsByMatterId[upload.matterId] ?? [];
  const nextMatterUploads = matterUploads.some((candidate) => candidate.id === upload.id)
    ? matterUploads.map((candidate) => (candidate.id === upload.id ? upload : candidate))
    : [upload, ...matterUploads];

  return {
    ...uploadsByMatterId,
    [upload.matterId]: nextMatterUploads,
  };
}

export function getExternalUploadLinkState(
  upload: ExternalUploadLinkRecord,
  now = new Date(),
): "active" | "expired" | "revoked" | "used" {
  if (upload.revokedAt) return "revoked";
  if (Date.parse(upload.expiresAt) <= now.getTime()) return "expired";
  if (upload.usedUploads >= upload.maxUploads) return "used";
  return "active";
}

export async function loadExternalUploadsDashboardData(input: {
  matters: MatterSummary[];
  getStatus: () => Promise<ExternalUploadsStatusResponse>;
  listUploadsForMatter: (matterId: string) => Promise<ExternalUploadLinkRecord[]>;
}): Promise<ExternalUploadsDashboardResponse> {
  const [status, uploadsByMatterEntries] = await Promise.all([
    input.getStatus(),
    Promise.all(
      input.matters.map(async (matter) => {
        const uploads = await input.listUploadsForMatter(matter.id);
        return [matter.id, uploads] as const;
      }),
    ),
  ]);

  return {
    status,
    uploadsByMatterId: Object.fromEntries(uploadsByMatterEntries),
  };
}
