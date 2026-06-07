import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { EmbeddedIntakeTemplateDefinition, IntakeTemplateRecord } from "@open-practice/domain";
import {
  buildEmbeddedIntakeTemplateQaReport,
  intakeTemplatePreviewStatus,
  previewEmbeddedIntakeTemplate,
  validateEmbeddedIntakeTemplateDefinition,
} from "@open-practice/domain";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import {
  assertIntakeAccess,
  getTemplate,
  intakeTemplateParamsSchema,
  signatureItems,
} from "./shared.js";
import type { IntakeFormRouteDependencies } from "./shared.js";

const intakeTemplateBodySchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  active: z.boolean().default(true),
  definitionVersion: z.coerce.number().int().positive().default(1),
  definition: z.custom<EmbeddedIntakeTemplateDefinition>((value) => {
    validateEmbeddedIntakeTemplateDefinition(value as EmbeddedIntakeTemplateDefinition);
    return true;
  }),
});

const intakeTemplatePreviewBodySchema = z.object({
  definition: z.custom<EmbeddedIntakeTemplateDefinition>(
    (value) => typeof value === "object" && value !== null,
  ),
  matterId: z.string().min(1).optional(),
  answers: z.record(z.string(), z.unknown()).default({}),
  selectedPackageIds: z.array(z.string().min(1)).optional(),
});

export function registerIntakeTemplateRoutes(
  server: FastifyInstance,
  dependencies: IntakeFormRouteDependencies,
): void {
  const { repository } = dependencies;

  server.post("/api/intake-templates", async (request) => {
    const body = parseRequestPart(intakeTemplateBodySchema, request.body, "body");
    assertIntakeAccess(request.auth, { resource: "intake_session", action: "create" });
    const templateId = body.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const template: IntakeTemplateRecord = {
      id: templateId,
      firmId: request.auth.firmId,
      name: body.name,
      category: "custom-intake",
      provider: "embedded",
      externalTemplateId: `embedded-form:${templateId}`,
      active: body.active,
      definitionVersion: body.definitionVersion,
      definition: validateEmbeddedIntakeTemplateDefinition(body.definition),
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: "open-practice-form-builder",
        editable: true,
      },
    };
    const created = await repository.createIntakeTemplate(template);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_template.created",
      resourceType: "intake_template",
      resourceId: created.id,
      metadata: {
        templateId: created.id,
        definitionVersion: created.definitionVersion,
        schemaVersion: created.definition.schemaVersion,
      },
    });
    return created;
  });

  server.patch("/api/intake-templates/:id", async (request) => {
    const params = parseRequestPart(intakeTemplateParamsSchema, request.params, "params");
    const body = parseRequestPart(intakeTemplateBodySchema, request.body, "body");
    assertIntakeAccess(request.auth, { resource: "intake_session", action: "update" });
    const existing = await getTemplate(repository, request.auth.firmId, params.id);
    const updated = await repository.updateIntakeTemplate({
      ...existing,
      name: body.name,
      active: body.active,
      definitionVersion: body.definitionVersion,
      definition: validateEmbeddedIntakeTemplateDefinition(body.definition),
      updatedAt: new Date().toISOString(),
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "intake_template.updated",
      resourceType: "intake_template",
      resourceId: updated.id,
      metadata: {
        templateId: updated.id,
        definitionVersion: updated.definitionVersion,
        schemaVersion: updated.definition.schemaVersion,
      },
    });
    return updated;
  });

  server.post("/api/intake-templates/preview", async (request) => {
    const body = parseRequestPart(intakeTemplatePreviewBodySchema, request.body, "body");
    assertIntakeAccess(request.auth, {
      resource: "intake_session",
      action: "update",
      matterId: body.matterId,
    });
    const preview = previewEmbeddedIntakeTemplate({
      templateId: "preview",
      templateVersion: 1,
      definition: body.definition,
      answers: body.answers,
      selectedPackageIds: body.selectedPackageIds,
    });
    if (preview.preview === null || !body.matterId) return preview;

    const checks = preview.checks.filter((check) => check.code !== "signature_document_unverified");
    for (const { sectionId, item } of signatureItems(body.definition)) {
      if (!item.documentId) continue;
      const document = await repository.getDocument(request.auth.firmId, item.documentId);
      if (!document || document.matterId !== body.matterId) {
        checks.push({
          code: "signature_document_unavailable",
          severity: "blocking",
          message: "Signature document is not available for the selected matter.",
          sectionId,
          itemId: item.id,
        });
      }
    }

    return {
      ...preview,
      checks,
      status: intakeTemplatePreviewStatus(checks),
    };
  });

  server.get("/api/intake-templates/:id/qa-preview", async (request) => {
    const params = parseRequestPart(intakeTemplateParamsSchema, request.params, "params");
    assertIntakeAccess(request.auth, { resource: "intake_session", action: "read" });
    const template = await getTemplate(repository, request.auth.firmId, params.id);
    const qaReport = buildEmbeddedIntakeTemplateQaReport({
      templateId: template.id,
      templateVersion: template.definitionVersion,
      definition: template.definition,
    });
    return {
      template: {
        id: template.id,
        name: template.name,
        active: template.active,
        provider: template.provider,
        definitionVersion: template.definitionVersion,
      },
      qa: {
        ...qaReport,
        previews: qaReport.previews.map((preview) => ({
          id: preview.id,
          label: preview.label,
          selectedPackageIds: preview.selectedPackageIds,
          visibleQuestionIds: preview.visibleQuestionIds,
          visibleFormItemIds: preview.visibleFormItemIds,
          requiredIncompleteItemIds: preview.requiredIncompleteItemIds,
          matchedBranchRuleIds: preview.matchedBranchRuleIds,
          eligiblePackageIds: preview.eligiblePackageIds,
          packageDocuments: preview.packageDocuments,
        })),
      },
    };
  });
}
