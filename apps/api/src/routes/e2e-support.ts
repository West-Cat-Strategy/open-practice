import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";

const shareableDocumentBodySchema = z.object({
  matterId: z.string().min(1).default("matter-001"),
  title: z.string().min(1).default("Synthetic shareable disclosure.pdf"),
});

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function registerE2ESupportRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
  server.post("/api/e2e/shareable-document", async (request, reply) => {
    const body = parseRequestPart(shareableDocumentBodySchema, request.body, "body");
    const access = requireAccess(request.auth, {
      resource: "document",
      action: "create",
      matterId: body.matterId,
    });
    if (!access.ok) throw access.error;

    const documentId = crypto.randomUUID();
    const checksumSha256 = "b8f3bcb433c2666c1f9f72d8c9f6f2bf792ee18f746375a42dbf17447275d4b2";
    const document = await repository.createDocumentUploadIntent({
      id: documentId,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      title: body.title,
      storageKey: `e2e/${body.matterId}/${documentId}-${sanitizeFilename(body.title)}`,
      checksumSha256,
      classification: "general",
      legalHold: false,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "document.upload_intent.created",
      resourceType: "document",
      resourceId: document.id,
      metadata: {
        matterId: document.matterId,
        documentId: document.id,
        status: document.uploadStatus,
        source: "e2e_support",
      },
    });

    const completed = await repository.completeDocumentUpload({
      firmId: request.auth.firmId,
      documentId: document.id,
      checksumSha256,
      scanStatus: "passed",
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "document.upload.completed",
      resourceType: "document",
      resourceId: completed.id,
      metadata: {
        matterId: completed.matterId,
        documentId: completed.id,
        status: completed.uploadStatus,
        checksumStatus: completed.checksumStatus,
        scanStatus: completed.scanStatus,
        source: "e2e_support",
      },
    });

    reply.code(201);
    return {
      document: {
        id: completed.id,
        matterId: completed.matterId,
        title: completed.title,
        classification: completed.classification,
        uploadStatus: completed.uploadStatus,
        checksumStatus: completed.checksumStatus,
        scanStatus: completed.scanStatus,
      },
    };
  });
}
