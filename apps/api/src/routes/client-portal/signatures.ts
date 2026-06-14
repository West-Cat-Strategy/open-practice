import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type {
  Matter,
  PortalGrant,
  SignatureProviderEventRecord,
  SignatureProviderStatus,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  User,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import { trustedEvidence } from "../trusted-evidence.js";
import type { ApiRouteDependencies } from "../types.js";
import { getClientVisiblePortalDocument } from "./documents.js";
import {
  clientContactGrantPairs,
  hasPortalPermission,
  normalizedEmail,
  portalGrantVisibleOnMatter,
} from "./shared.js";

const idParamsSchema = z.object({ id: z.string().min(1) });

const clientSignatureEventBodySchema = z.object({
  status: z.enum(["viewed", "completed", "declined"]),
  consentText: z.string().min(1).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

type ClientPortalSignatureActionState = "ready_to_sign" | "viewed" | "completed" | "declined";

export interface ClientPortalSignatureSummary {
  id: string;
  matterId: string;
  documentId: string;
  documentTitle?: string;
  title: string;
  status: SignatureProviderStatus;
  signerStatus: SignatureProviderStatus;
  createdAt: string;
  completedAt?: string;
  declinedAt?: string;
  actionState: ClientPortalSignatureActionState;
}

function userAgentFromRequest(request: FastifyRequest): string | undefined {
  const userAgent = request.headers["user-agent"];
  return Array.isArray(userAgent) ? userAgent.join(", ") : userAgent;
}

function latestSignerEvent(
  events: SignatureProviderEventRecord[],
  signerId: string,
): SignatureProviderEventRecord | undefined {
  return events
    .filter((event) => event.evidence.signerId === signerId)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
}

function signatureActionState(status: SignatureProviderStatus): ClientPortalSignatureActionState {
  if (status === "completed") return "completed";
  if (status === "declined") return "declined";
  if (status === "viewed") return "viewed";
  return "ready_to_sign";
}

function signatureSummary(input: {
  request: SignatureRequestRecord;
  signer: SignatureRequestSignerRecord;
  signerStatus: SignatureProviderStatus;
  documentTitle?: string;
}): ClientPortalSignatureSummary {
  return {
    id: input.request.id,
    matterId: input.request.matterId,
    documentId: input.request.documentId,
    documentTitle: input.documentTitle,
    title: input.request.title,
    status: input.request.status,
    signerStatus: input.signerStatus,
    createdAt: input.request.createdAt,
    completedAt: input.request.completedAt,
    declinedAt: input.request.declinedAt,
    actionState: signatureActionState(input.signerStatus),
  };
}

async function visibleMatterSignGrants(input: {
  repository: ApiRouteDependencies["repository"];
  user: User;
  matterId: string;
  now: string;
}): Promise<PortalGrant[]> {
  const grantPairs = await clientContactGrantPairs(input.repository, input.user, input.now);
  const matter = (
    await input.repository.listMattersForUser({
      ...input.user,
      assignedMatterIds: [input.matterId],
    })
  ).find((candidate: Matter) => candidate.id === input.matterId);
  if (!matter) return [];
  return grantPairs
    .map((pair) => pair.grant)
    .filter((grant) => grant.matterId === input.matterId)
    .filter((grant) => portalGrantVisibleOnMatter(grant, matter))
    .filter((grant) => hasPortalPermission([grant], "sign"));
}

async function getClientVisibleSignature(input: {
  repository: ApiRouteDependencies["repository"];
  user: User;
  signatureId: string;
  now: string;
}): Promise<
  | {
      request: SignatureRequestRecord;
      signer: SignatureRequestSignerRecord;
      events: SignatureProviderEventRecord[];
      summary: ClientPortalSignatureSummary;
    }
  | undefined
> {
  const request = (await input.repository.listSignatureRequests(input.user.firmId)).find(
    (candidate) => candidate.id === input.signatureId,
  );
  if (!request) return undefined;
  const grants = await visibleMatterSignGrants({
    repository: input.repository,
    user: input.user,
    matterId: request.matterId,
    now: input.now,
  });
  if (grants.length === 0) return undefined;
  const [signers, events, visibleDocument] = await Promise.all([
    input.repository.listSignatureRequestSigners(input.user.firmId, request.id),
    input.repository.listSignatureProviderEvents(input.user.firmId, {
      signatureRequestId: request.id,
    }),
    getClientVisiblePortalDocument({
      repository: input.repository,
      user: input.user,
      documentId: request.documentId,
      now: input.now,
    }),
  ]);
  const signer = signers.find(
    (candidate) => normalizedEmail(candidate.email) === normalizedEmail(input.user.email),
  );
  if (!signer) return undefined;
  const signerEvent = latestSignerEvent(events, signer.id);
  const signerStatus = signerEvent?.status ?? signer.status;
  return {
    request,
    signer,
    events,
    summary: signatureSummary({
      request,
      signer,
      signerStatus,
      documentTitle: visibleDocument?.document.title,
    }),
  };
}

function assertCanRecordSignatureEvent(input: {
  request: SignatureRequestRecord;
  currentSignerStatus: SignatureProviderStatus;
  nextStatus: SignatureProviderStatus;
}): void {
  if (input.request.status === "completed" || input.request.status === "declined") {
    throw new ApiHttpError(
      409,
      "SIGNATURE_REQUEST_TERMINAL",
      "Signature request already has a terminal status",
    );
  }
  if (input.currentSignerStatus === "completed" || input.currentSignerStatus === "declined") {
    throw new ApiHttpError(
      409,
      "SIGNATURE_SIGNER_TERMINAL",
      "Signer already has a terminal status",
    );
  }
}

export function registerClientPortalSignatureRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
  server.get("/api/client-portal/signatures/:id", async (request) => {
    if (request.auth.user.role !== "client_external") {
      throw new ApiHttpError(
        403,
        "CLIENT_PORTAL_ACCOUNT_REQUIRED",
        "Client portal account required",
      );
    }
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const now = new Date().toISOString();
    const visible = await getClientVisibleSignature({
      repository,
      user: request.auth.user,
      signatureId: params.id,
      now,
    });
    if (!visible) {
      throw new ApiHttpError(404, "PORTAL_SIGNATURE_NOT_FOUND", "Signature request was not found");
    }
    await repository.createAccessLog({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      resourceType: "signature_request",
      resourceId: visible.request.id,
      action: "view",
      occurredAt: now,
      ipAddress: request.ip,
      userAgent: userAgentFromRequest(request),
      metadata: { outcome: "granted", matterId: visible.request.matterId },
    });
    return { signature: visible.summary };
  });

  server.post("/api/client-portal/signatures/:id/events", async (request) => {
    if (request.auth.user.role !== "client_external") {
      throw new ApiHttpError(
        403,
        "CLIENT_PORTAL_ACCOUNT_REQUIRED",
        "Client portal account required",
      );
    }
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(clientSignatureEventBodySchema, request.body, "body");
    const now = new Date().toISOString();
    const visible = await getClientVisibleSignature({
      repository,
      user: request.auth.user,
      signatureId: params.id,
      now,
    });
    if (!visible) {
      throw new ApiHttpError(404, "PORTAL_SIGNATURE_NOT_FOUND", "Signature request was not found");
    }
    assertCanRecordSignatureEvent({
      request: visible.request,
      currentSignerStatus: visible.summary.signerStatus,
      nextStatus: body.status,
    });
    const occurredAt = body.occurredAt ?? now;
    const event: SignatureProviderEventRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      signatureRequestId: visible.request.id,
      provider: visible.request.provider,
      externalId: visible.request.externalId,
      status: body.status,
      occurredAt,
      evidence: trustedEvidence(
        {
          mode: "client_portal_embedded",
          actorUserId: request.auth.user.id,
          signerId: visible.signer.id,
          consentText: body.consentText,
          ip: request.ip,
          userAgent: userAgentFromRequest(request),
        },
        body.evidence,
      ),
    };
    const recorded = await repository.recordSignatureProviderEvent(event);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "signature_client_portal_event.recorded",
      resourceType: "signature_request",
      resourceId: visible.request.id,
      occurredAt: recorded.occurredAt,
      metadata: {
        matterId: visible.request.matterId,
        signatureRequestId: visible.request.id,
        status: recorded.status,
        signerId: visible.signer.id,
      },
    });
    await repository.createAccessLog({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      resourceType: "signature_request",
      resourceId: visible.request.id,
      action: "sign",
      occurredAt: recorded.occurredAt,
      ipAddress: request.ip,
      userAgent: userAgentFromRequest(request),
      metadata: {
        outcome: "recorded",
        matterId: visible.request.matterId,
        status: recorded.status,
      },
    });
    const refreshed = await getClientVisibleSignature({
      repository,
      user: request.auth.user,
      signatureId: visible.request.id,
      now,
    });
    return { status: "processed", signature: refreshed?.summary ?? visible.summary };
  });
}
