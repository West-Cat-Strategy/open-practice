import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";

const idParamsSchema = z.object({ id: z.string().min(1) });

function assertDocumentProcessingAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function registerDocumentProcessingRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/document-processing/status", async (request) => {
    const providers = await Promise.all([
      repository.listProviderSettings(request.auth.firmId, { kind: "ocr" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "transcription" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "media" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "ai" }),
    ]);
    const configured = providers.flat().filter((provider) => provider.enabled);
    return {
      status: configured.length > 0 ? "configured" : "disabled",
      reason: configured.length > 0 ? undefined : "not_configured",
      workers: [],
      supportedTasks: ["malware_scan", "ocr", "classification", "transcription", "media"],
      providers: configured.map((provider) => ({ kind: provider.kind, key: provider.key })),
    };
  });

  server.post("/api/document-processing/documents/:id/queue", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const document = await repository.getDocument(request.auth.firmId, params.id);
    if (!document) {
      throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
    }
    assertDocumentProcessingAccess(request.auth, {
      resource: "document",
      action: "update",
      matterId: document.matterId,
    });

    throw Object.assign(new Error("Document processing worker is not configured"), {
      statusCode: 503,
    });
  });
}
