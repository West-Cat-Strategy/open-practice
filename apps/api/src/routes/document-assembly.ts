import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildDocumentAssemblyWorkspace } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";

const documentAssemblyWorkbenchQuerySchema = z.object({
  matterId: z.string().min(1),
});

export type DocumentAssemblyWorkbenchAccessGuard = typeof requireAccess;

export function assertDocumentAssemblyWorkbenchAccess(
  context: ApiAuthContext,
  matterId: string,
  guard: DocumentAssemblyWorkbenchAccessGuard = requireAccess,
): void {
  const documentAccess = guard(context, {
    resource: "document",
    action: "read",
    matterId,
  });
  if (!documentAccess.ok) throw documentAccess.error;

  const signatureAccess = guard(context, {
    resource: "signature_request",
    action: "read",
    matterId,
  });
  if (!signatureAccess.ok) throw signatureAccess.error;
}

export function registerDocumentAssemblyRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/document-assembly/workbench", async (request) => {
    const query = parseRequestPart(documentAssemblyWorkbenchQuerySchema, request.query, "query");
    assertDocumentAssemblyWorkbenchAccess(request.auth, query.matterId);

    const [definitions, packages, envelopes, documents, generatedDocuments, signatureRequests] =
      await Promise.all([
        repository.listDocumentAssemblySetDefinitions(request.auth.firmId, { activeOnly: true }),
        repository.listDocumentAssemblyPackages(request.auth.firmId, { matterId: query.matterId }),
        repository.listSignatureEnvelopes(request.auth.firmId, { matterId: query.matterId }),
        repository.listMatterDocuments(request.auth.firmId, query.matterId),
        repository.listGeneratedDocuments(request.auth.firmId, { matterId: query.matterId }),
        repository.listSignatureRequests(request.auth.firmId, { matterId: query.matterId }),
      ]);

    return {
      status: "available" as const,
      ...buildDocumentAssemblyWorkspace({
        matterId: query.matterId,
        definitions,
        packages,
        envelopes,
        documents,
        generatedDocuments,
        signatureRequests,
      }),
    };
  });
}
