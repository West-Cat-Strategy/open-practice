import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AccessRequest,
  SignatureProviderEventRecord,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "./outbound-email.js";
import type { ApiRouteDependencies } from "./types.js";

const signatureQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

const signatureRequestBodySchema = z.object({
  matterId: z.string().min(1),
  documentId: z.string().min(1),
  title: z.string().min(1),
  consentText: z.string().min(1),
  signers: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.string().min(1),
      }),
    )
    .min(1),
});

const signatureProviderEventBodySchema = z.object({
  signatureRequestId: z.string().min(1),
  provider: z.enum(["embedded", "manual", "docuseal"]),
  externalId: z.string().min(1),
  status: z.enum([
    "draft",
    "pending_provider_submission",
    "sent",
    "viewed",
    "completed",
    "declined",
    "provider_error",
  ]),
  occurredAt: z.string().datetime().optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const embeddedSignatureEventBodySchema = z.object({
  signerId: z.string().min(1).optional(),
  status: z.enum(["viewed", "completed", "declined"]),
  consentText: z.string().min(1).optional(),
  occurredAt: z.string().datetime().optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function assertSignatureAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function registerSignatureRoutes(
  server: FastifyInstance,
  { repository, signatureProvider, emailJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/signature-requests", async (request) => {
    const query = parseRequestPart(signatureQuerySchema, request.query, "query");
    if (query.matterId) {
      assertSignatureAccess(request.auth, {
        resource: "signature_request",
        action: "read",
        matterId: query.matterId,
      });
      return repository.listSignatureRequests(request.auth.firmId, query);
    }
    if (request.auth.user.role === "owner_admin" || request.auth.user.role === "auditor") {
      assertSignatureAccess(request.auth, { resource: "signature_request", action: "read" });
      return repository.listSignatureRequests(request.auth.firmId);
    }

    const requests = await Promise.all(
      request.auth.user.assignedMatterIds.map((matterId) => {
        assertSignatureAccess(request.auth, {
          resource: "signature_request",
          action: "read",
          matterId,
        });
        return repository.listSignatureRequests(request.auth.firmId, { matterId });
      }),
    );
    return requests.flat();
  });

  server.post("/api/signature-requests", async (request) => {
    const body = parseRequestPart(signatureRequestBodySchema, request.body, "body");
    assertSignatureAccess(request.auth, {
      resource: "signature_request",
      action: "create",
      matterId: body.matterId,
    });
    const document = await repository.getDocument(request.auth.firmId, body.documentId);
    if (!document || document.matterId !== body.matterId) {
      throw Object.assign(new Error("Document does not belong to the requested matter"), {
        statusCode: 400,
      });
    }
    if (!signatureProvider) {
      throw Object.assign(new Error("Signature provider is not configured"), { statusCode: 503 });
    }

    const submission = await signatureProvider.createSubmission(body);
    const now = new Date().toISOString();
    const requestRecord: SignatureRequestRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      documentId: body.documentId,
      title: body.title,
      requestedByUserId: request.auth.user.id,
      provider: submission.provider,
      externalId: submission.externalId,
      status: submission.status ?? "sent",
      signingUrl: submission.signingUrl,
      consentText: body.consentText,
      evidence: submission.evidence ?? {},
      createdAt: now,
    };
    const signers: SignatureRequestSignerRecord[] = body.signers.map((signer) => ({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      signatureRequestId: requestRecord.id,
      ...signer,
      status: requestRecord.status,
      signingUrl: submission.signingUrl,
    }));
    const event: SignatureProviderEventRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      signatureRequestId: requestRecord.id,
      provider: requestRecord.provider,
      externalId: requestRecord.externalId,
      status: requestRecord.status,
      occurredAt: now,
      evidence: requestRecord.evidence,
    };
    const created = await repository.createSignatureRequest({
      request: requestRecord,
      signers,
      event,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "signature_request.created",
      resourceType: "signature_request",
      resourceId: created.request.id,
      occurredAt: now,
      metadata: {
        matterId: created.request.matterId,
        documentId: created.request.documentId,
        provider: created.request.provider,
        status: created.request.status,
        signerCount: created.signers.length,
      },
    });
    const queuedEmail = await queueRouteEmailOutbox(repository, emailJobQueue, request.auth, {
      matterId: created.request.matterId,
      templateKey: "signature.requested",
      to: created.signers.map((signer) => signer.email),
      subject: `Signature requested: ${created.request.title}`,
      textBody: `Please review the signature request for ${created.request.title}.`,
      relatedResourceType: "signature_request",
      relatedResourceId: created.request.id,
      metadata: {
        documentId: created.request.documentId,
        signerCount: created.signers.length,
      },
    });
    return { ...created, queuedEmail: summarizeQueuedRouteEmail(queuedEmail) };
  });

  server.post("/api/signature-requests/provider-events", async (request) => {
    const body = parseRequestPart(signatureProviderEventBodySchema, request.body, "body");
    const signature = (await repository.listSignatureRequests(request.auth.firmId)).find(
      (candidate) => candidate.id === body.signatureRequestId,
    );
    if (!signature) {
      throw Object.assign(new Error("Signature request was not found"), { statusCode: 404 });
    }
    assertSignatureAccess(request.auth, {
      resource: "signature_request",
      action: "update",
      matterId: signature.matterId,
    });
    if (signature.provider !== body.provider || signature.externalId !== body.externalId) {
      throw Object.assign(new Error("Provider event does not match signature request"), {
        statusCode: 409,
      });
    }
    const event: SignatureProviderEventRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      signatureRequestId: body.signatureRequestId,
      provider: body.provider,
      externalId: body.externalId,
      status: body.status,
      occurredAt: body.occurredAt ?? new Date().toISOString(),
      evidence: body.evidence,
    };
    const recorded = await repository.recordSignatureProviderEvent(event);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "signature_provider_event.recorded",
      resourceType: "signature_request",
      resourceId: signature.id,
      occurredAt: recorded.occurredAt,
      metadata: {
        matterId: signature.matterId,
        signatureRequestId: signature.id,
        provider: recorded.provider,
        externalId: recorded.externalId,
        status: recorded.status,
      },
    });
    return recorded;
  });

  server.post("/api/signature-requests/:id/embedded-events", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(embeddedSignatureEventBodySchema, request.body, "body");
    const signature = (await repository.listSignatureRequests(request.auth.firmId)).find(
      (candidate) => candidate.id === params.id,
    );
    if (!signature) {
      throw Object.assign(new Error("Signature request was not found"), { statusCode: 404 });
    }
    assertSignatureAccess(request.auth, {
      resource: "signature_request",
      action: "update",
      matterId: signature.matterId,
    });
    if (signature.provider === "docuseal") {
      throw Object.assign(new Error("DocuSeal signature events are deprecated"), {
        statusCode: 410,
      });
    }
    const occurredAt = body.occurredAt ?? new Date().toISOString();
    const event: SignatureProviderEventRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      signatureRequestId: signature.id,
      provider: signature.provider,
      externalId: signature.externalId,
      status: body.status,
      occurredAt,
      evidence: {
        mode: "embedded",
        actorUserId: request.auth.user.id,
        signerId: body.signerId,
        consentText: body.consentText,
        ip: request.ip,
        userAgent: request.headers["user-agent"],
        ...body.evidence,
      },
    };
    const recorded = await repository.recordSignatureProviderEvent(event);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "signature_embedded_event.recorded",
      resourceType: "signature_request",
      resourceId: signature.id,
      occurredAt: recorded.occurredAt,
      metadata: {
        matterId: signature.matterId,
        signatureRequestId: signature.id,
        provider: recorded.provider,
        externalId: recorded.externalId,
        status: recorded.status,
        signerId: body.signerId,
      },
    });
    return { status: "processed", event: recorded };
  });

  server.get("/api/signature-requests/:id/events", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const signature = (await repository.listSignatureRequests(request.auth.firmId)).find(
      (candidate) => candidate.id === params.id,
    );
    if (!signature) {
      throw Object.assign(new Error("Signature request was not found"), { statusCode: 404 });
    }
    assertSignatureAccess(request.auth, {
      resource: "signature_request",
      action: "read",
      matterId: signature.matterId,
    });
    return {
      events: await repository.listSignatureProviderEvents(request.auth.firmId, {
        signatureRequestId: params.id,
      }),
    };
  });
}
