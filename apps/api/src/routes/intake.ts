import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AnswerSnapshotRecord, IntakeSessionRecord } from "@open-practice/domain";
import {
  resolveEmbeddedIntakeAnswers,
  validateEmbeddedIntakeTemplateDefinition,
} from "@open-practice/domain";
import { requireStaffAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "./delivery-confirmation.js";
import { registerIntakeGeneratedDocumentRoutes } from "./intake/generated-documents.js";
import { assertIntakeAccess, idParamsSchema, requireAutomationProvider } from "./intake/shared.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "./outbound-email.js";
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
  deliveryConfirmation: deliveryConfirmationSchema.optional(),
});

const answerSnapshotBodySchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  capturedAt: z.string().datetime().optional(),
});

async function getEmbeddedTemplate(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  templateId: string,
) {
  const template = (await repository.listIntakeTemplates(firmId)).find(
    (candidate) => candidate.id === templateId,
  );
  if (!template) {
    throw Object.assign(new Error("Intake template was not found"), { statusCode: 404 });
  }
  if (!template.active) {
    throw Object.assign(new Error("Intake template is inactive"), { statusCode: 409 });
  }
  if (template.provider === "docassemble") {
    throw Object.assign(new Error("docassemble intake templates are deprecated"), {
      statusCode: 410,
    });
  }
  validateEmbeddedIntakeTemplateDefinition(template.definition);
  return template;
}

export function registerIntakeRoutes(
  server: FastifyInstance,
  { repository, automationProvider, emailJobQueue }: ApiRouteDependencies,
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
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
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
    const template = await getEmbeddedTemplate(repository, request.auth.firmId, body.templateId);
    requireEmailDeliveryConfirmation(body.deliveryConfirmation, { recipientCount: 1 });
    const now = new Date().toISOString();
    const provider = requireAutomationProvider(automationProvider);
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
    const created = await repository.createIntakeSession(session);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_session.created",
      resourceType: "intake_session",
      resourceId: created.id,
      occurredAt: created.createdAt,
      metadata: {
        matterId: created.matterId,
        templateId: created.templateId,
        provider: created.provider,
        status: created.status,
      },
    });
    const queuedEmail = await queueRouteEmailOutbox(repository, emailJobQueue, request.auth, {
      matterId: created.matterId,
      templateKey: "intake.session.created",
      to: [request.auth.user.email],
      subject: "Intake session created",
      textBody: `An intake session was created for matter ${created.matterId}.`,
      relatedResourceType: "intake_session",
      relatedResourceId: created.id,
      metadata: {
        intakeSessionId: created.id,
        templateId: created.templateId,
        provider: created.provider,
      },
    });
    return { ...created, queuedEmail: summarizeQueuedRouteEmail(queuedEmail) };
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
    const template = await getEmbeddedTemplate(repository, request.auth.firmId, session.templateId);
    const resolution = resolveEmbeddedIntakeAnswers({
      templateId: template.id,
      templateVersion: template.definitionVersion,
      definition: template.definition,
      answers: body.answers,
    });
    const snapshot: AnswerSnapshotRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      intakeSessionId: session.id,
      capturedAt: body.capturedAt ?? new Date().toISOString(),
      answers: body.answers,
      resolution,
    };
    const created = await repository.createAnswerSnapshot(snapshot);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_answer_snapshot.created",
      resourceType: "intake_session",
      resourceId: session.id,
      occurredAt: created.capturedAt,
      metadata: {
        matterId: session.matterId,
        intakeSessionId: session.id,
        templateId: template.id,
        templateVersion: template.definitionVersion,
        answerCount: Object.keys(created.answers).length,
        visibleQuestionCount: resolution.visibleQuestionIds.length,
        eligiblePackageCount: resolution.eligiblePackageIds.length,
        selectedPackageCount: resolution.selectedPackageIds.length,
      },
    });
    return created;
  });

  registerIntakeGeneratedDocumentRoutes(server, { repository, automationProvider, emailJobQueue });
}
