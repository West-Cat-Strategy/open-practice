import type { FastifyRequest } from "fastify";
import { z } from "zod";
import type {
  AccessLogRecord,
  DocumentRecord,
  ExternalUploadLinkRecord,
} from "@open-practice/domain";
import {
  hashToken,
  publicTokenPathFromHeader,
  readPublicTokenHeader,
} from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiRouteDependencies } from "../types.js";

export type ExternalUploadRepository = ApiRouteDependencies["repository"] & {
  listExternalUploadLinks: (
    firmId: string,
    options?: { matterId?: string },
  ) => Promise<ExternalUploadLinkRecord[]>;
  createExternalUploadLink: (input: ExternalUploadLinkRecord) => Promise<ExternalUploadLinkRecord>;
  getExternalUploadLinkByTokenHash: (
    tokenHash: string,
  ) => Promise<ExternalUploadLinkRecord | undefined>;
  revokeExternalUploadLink: (...args: unknown[]) => Promise<ExternalUploadLinkRecord | undefined>;
  claimExternalUploadUse: (...args: unknown[]) => Promise<ExternalUploadLinkRecord | undefined>;
  createAccessLog?: (input: AccessLogRecord) => Promise<AccessLogRecord>;
};

const publicTokenParamsSchema = z.object({ token: z.string().min(1) });

function isExternalUploadRepository(
  repository: ApiRouteDependencies["repository"],
): repository is ExternalUploadRepository {
  const candidate = repository as Partial<ExternalUploadRepository>;
  return (
    typeof candidate.listExternalUploadLinks === "function" &&
    typeof candidate.createExternalUploadLink === "function" &&
    typeof candidate.getExternalUploadLinkByTokenHash === "function" &&
    typeof candidate.revokeExternalUploadLink === "function" &&
    typeof candidate.claimExternalUploadUse === "function"
  );
}

export function requireExternalUploadRepository(
  repository: ApiRouteDependencies["repository"],
): ExternalUploadRepository {
  if (!isExternalUploadRepository(repository)) {
    throw new ApiHttpError(
      503,
      "EXTERNAL_UPLOAD_REPOSITORY_NOT_CONFIGURED",
      "External upload repository is not configured",
    );
  }
  return repository;
}

export function requireJwtSecret(jwtSecret?: string): string {
  if (!jwtSecret) {
    throw new ApiHttpError(
      503,
      "EXTERNAL_UPLOAD_TOKEN_SIGNING_NOT_CONFIGURED",
      "External upload token signing is not configured",
    );
  }
  return jwtSecret;
}

export function readExternalUploadPublicToken(request: FastifyRequest): string {
  const params = request.params as { token?: string } | undefined;
  return parseRequestPart(
    publicTokenParamsSchema,
    params?.token ? params : publicTokenPathFromHeader(readPublicTokenHeader(request.headers)),
    "params",
  ).token;
}

export function linkStatus(link: ExternalUploadLinkRecord, now = new Date()): string {
  if (link.revokedAt) return "revoked";
  if (Date.parse(link.expiresAt) <= now.getTime()) return "expired";
  if (link.usedUploads >= link.maxUploads) return "exhausted";
  return "active";
}

export function externalUploadLinkIdForDocument(document: DocumentRecord): string | undefined {
  if (document.externalUploadLinkId) return document.externalUploadLinkId;
  const [, linkId] = document.storageKey.match(/^external-uploads\/([^/]+)\//) ?? [];
  return linkId;
}

function unavailableLinkReason(
  link: ExternalUploadLinkRecord,
  options: { enforceUploadLimit: boolean },
): string | undefined {
  if (link.revokedAt) return "revoked";
  if (Date.parse(link.expiresAt) <= Date.now()) return "expired";
  if (options.enforceUploadLimit && link.usedUploads >= link.maxUploads) return "upload_limit";
  return undefined;
}

export function externalUploadDenied(): ApiHttpError {
  return new ApiHttpError(
    403,
    "EXTERNAL_UPLOAD_LINK_UNAVAILABLE",
    "External upload link is not available",
  );
}

function requestUserAgent(request: FastifyRequest): string | undefined {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value.join(", ") : value;
}

export async function recordAccessLog(
  repository: ExternalUploadRepository,
  input: {
    link: ExternalUploadLinkRecord;
    request: FastifyRequest;
    resourceType: string;
    resourceId: string;
    metadata: Record<string, unknown>;
    actorId?: string;
  },
): Promise<void> {
  if (!repository.createAccessLog) return;
  await repository.createAccessLog({
    id: crypto.randomUUID(),
    firmId: input.link.firmId,
    actorId: input.actorId,
    externalUploadLinkId: input.link.id,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    action: "upload",
    occurredAt: new Date().toISOString(),
    ipAddress: input.request.ip,
    userAgent: requestUserAgent(input.request),
    metadata: input.metadata,
  });
}

export async function revokeExternalUploadLink(
  repository: ExternalUploadRepository,
  input: { firmId: string; id: string; revokedAt: string },
): Promise<ExternalUploadLinkRecord | undefined> {
  if (repository.revokeExternalUploadLink.length >= 3) {
    return repository.revokeExternalUploadLink(input.firmId, input.id, input.revokedAt);
  }
  return repository.revokeExternalUploadLink(input);
}

export async function claimExternalUploadUse(
  repository: ExternalUploadRepository,
  input: { firmId: string; id: string; usedAt: string },
): Promise<ExternalUploadLinkRecord | undefined> {
  if (repository.claimExternalUploadUse.length >= 3) {
    return repository.claimExternalUploadUse(input.firmId, input.id, input.usedAt);
  }
  return repository.claimExternalUploadUse(input);
}

export async function resolvePublicLink(
  repository: ExternalUploadRepository,
  input: {
    token: string;
    jwtSecret: string;
    request: FastifyRequest;
    enforceUploadLimit: boolean;
  },
): Promise<ExternalUploadLinkRecord> {
  const link = await repository.getExternalUploadLinkByTokenHash(
    hashToken(input.token, input.jwtSecret),
  );

  if (!link) {
    throw externalUploadDenied();
  }

  const reason = unavailableLinkReason(link, { enforceUploadLimit: input.enforceUploadLimit });
  if (reason) {
    await recordAccessLog(repository, {
      link,
      request: input.request,
      resourceType: "external_upload_link",
      resourceId: link.id,
      metadata: { outcome: "denied", reason },
    });
    throw externalUploadDenied();
  }

  return link;
}
