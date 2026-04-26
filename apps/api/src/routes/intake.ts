import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AccessRequest,
  AnswerSnapshotRecord,
  IntakeSessionRecord,
} from "@open-practice/domain";
import { EmbeddedAutomationProvider } from "@open-practice/providers";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";

const intakeSessionQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

const intakeSessionBodySchema = z.object({
  matterId: z.string().min(1),
  templateId: z.string().min(1).default("intake-template-001"),
  clientContactId: z.string().min(1).optional(),
  interviewUrl: z.string().url().optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const generatedDocumentBodySchema = z.object({
  title: z.string().min(1),
  externalId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  storageKey: z.string().min(1).optional(),
  checksumSha256: z.string().min(16).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const answerSnapshotBodySchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  capturedAt: z.string().datetime().optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function assertIntakeAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function registerIntakeRoutes(
  server: FastifyInstance,
  { repository, automationProvider }: ApiRouteDependencies,
): void {
  server.get("/api/intake-sessions", async (request) => {
    const query = parseRequestPart(intakeSessionQuerySchema, request.query, "query");
    const templates = await repository.listIntakeTemplates(request.auth.firmId);
    if (query.matterId) {
      assertIntakeAccess(request.auth, {
        resource: "intake_session",
        action: "read",
        matterId: query.matterId,
      });
      return {
        templates,
        sessions: await repository.listIntakeSessions(request.auth.firmId, query),
      };
    }
    if (request.auth.user.role === "owner_admin" || request.auth.user.role === "auditor") {
      assertIntakeAccess(request.auth, { resource: "intake_session", action: "read" });
      return {
        templates,
        sessions: await repository.listIntakeSessions(request.auth.firmId),
      };
    }
    const sessions = await Promise.all(
      request.auth.user.assignedMatterIds.map((matterId) => {
        assertIntakeAccess(request.auth, {
          resource: "intake_session",
          action: "read",
          matterId,
        });
        return repository.listIntakeSessions(request.auth.firmId, { matterId });
      }),
    );
    return {
      templates,
      sessions: sessions.flat(),
    };
  });

  server.post("/api/intake-sessions", async (request) => {
    const body = parseRequestPart(intakeSessionBodySchema, request.body, "body");
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "create",
      matterId: body.matterId,
    });
    const template = (await repository.listIntakeTemplates(request.auth.firmId)).find(
      (candidate) => candidate.id === body.templateId,
    );
    if (!template) {
      throw Object.assign(new Error("Intake template was not found"), { statusCode: 404 });
    }
    if (template.provider === "docassemble") {
      throw Object.assign(new Error("docassemble intake templates are deprecated"), {
        statusCode: 410,
      });
    }
    const now = new Date().toISOString();
    const provider = automationProvider ?? new EmbeddedAutomationProvider();
    const providerRef = await provider.startInterview({
      firmId: request.auth.firmId,
      matterId: body.matterId,
      templateId: template.externalTemplateId,
      clientContactId: body.clientContactId,
      metadata: body.evidence,
    });
    const session: IntakeSessionRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      templateId: body.templateId,
      provider: providerRef.provider,
      externalId: providerRef.externalId,
      status: providerRef.status,
      clientContactId: body.clientContactId,
      interviewUrl: body.interviewUrl ?? providerRef.interviewUrl,
      evidence: providerRef.evidence ?? body.evidence,
      createdAt: now,
      updatedAt: now,
    };
    return repository.createIntakeSession(session);
  });

  server.get("/api/intake-sessions/:id/answer-snapshots", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const session = await repository.getIntakeSession(request.auth.firmId, params.id);
    if (!session) {
      throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    }
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "read",
      matterId: session.matterId,
    });
    return {
      snapshots: await repository.listAnswerSnapshots(request.auth.firmId, {
        intakeSessionId: session.id,
      }),
    };
  });

  server.post("/api/intake-sessions/:id/answer-snapshots", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const session = await repository.getIntakeSession(request.auth.firmId, params.id);
    if (!session) {
      throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    }
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "update",
      matterId: session.matterId,
    });
    const body = parseRequestPart(answerSnapshotBodySchema, request.body, "body");
    const snapshot: AnswerSnapshotRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      intakeSessionId: session.id,
      capturedAt: body.capturedAt ?? new Date().toISOString(),
      answers: body.answers,
    };
    return repository.createAnswerSnapshot(snapshot);
  });

  server.post("/api/intake-sessions/:id/generated-documents", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const session = await repository.getIntakeSession(request.auth.firmId, params.id);
    if (!session) {
      throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    }
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "update",
      matterId: session.matterId,
    });
    const body = parseRequestPart(generatedDocumentBodySchema, request.body, "body");
    if (session.provider === "docassemble") {
      throw Object.assign(new Error("docassemble generated documents are deprecated"), {
        statusCode: 410,
      });
    }
    const provider = automationProvider ?? new EmbeddedAutomationProvider();
    const generated = await provider.renderDocument({
      firmId: request.auth.firmId,
      matterId: session.matterId,
      sessionExternalId: session.externalId,
      documentTitle: body.title,
    });
    return repository.createGeneratedDocument({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: session.matterId,
      intakeSessionId: session.id,
      provider: generated.provider,
      externalId: generated.externalId,
      title: generated.title,
      documentId: body.documentId,
      storageKey: generated.storageKey ?? body.storageKey,
      checksumSha256: generated.checksumSha256 ?? body.checksumSha256,
      evidence: { ...body.evidence, ...(generated.evidence ?? {}) },
      createdAt: new Date().toISOString(),
    });
  });
}
