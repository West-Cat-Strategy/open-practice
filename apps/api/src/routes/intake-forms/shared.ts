import { z } from "zod";
import type {
  AccessRequest,
  EmbeddedIntakeFormItem,
  EmbeddedIntakeTemplateDefinition,
  IntakeFormLinkRecord,
  IntakeTemplateRecord,
} from "@open-practice/domain";
import { validateEmbeddedIntakeTemplateDefinition } from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import type { ApiAuthContext } from "../../server.js";
import type { ApiRouteDependencies } from "../types.js";

export type IntakeFormRouteDependencies = ApiRouteDependencies & {
  jwtSecret?: string;
  publicWebBaseUrl?: string;
};

export const intakeTemplateParamsSchema = z.object({ id: z.string().min(1) });

export function linkStatus(link: IntakeFormLinkRecord, now = new Date()): string {
  if (link.revokedAt) return "revoked";
  if (link.submittedAt) return "submitted";
  if (Date.parse(link.expiresAt) <= now.getTime()) return "expired";
  return "active";
}

export function intakeReviewTaskId(formLinkId: string): string {
  return `intake-review:${formLinkId}`;
}

export function assertIntakeAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export async function getTemplate(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  id: string,
): Promise<IntakeTemplateRecord> {
  const template = (await repository.listIntakeTemplates(firmId)).find(
    (candidate) => candidate.id === id,
  );
  if (!template)
    throw Object.assign(new Error("Intake template was not found"), { statusCode: 404 });
  validateEmbeddedIntakeTemplateDefinition(template.definition);
  return template;
}

export function signatureItems(definition: EmbeddedIntakeTemplateDefinition): Array<{
  sectionId: string;
  item: Extract<EmbeddedIntakeFormItem, { kind: "signature" }>;
}> {
  if (definition.schemaVersion !== 2) return [];
  return definition.sections.flatMap((section) =>
    section.items
      .filter(
        (item): item is Extract<EmbeddedIntakeFormItem, { kind: "signature" }> =>
          item.kind === "signature",
      )
      .map((item) => ({ sectionId: section.id, item })),
  );
}

export async function ensureIntakeReviewTask(
  repository: ApiRouteDependencies["repository"],
  link: IntakeFormLinkRecord,
  now: string,
): Promise<void> {
  const taskId = intakeReviewTaskId(link.id);
  const existing = await repository.getTaskDeadline(link.firmId, taskId);
  if (existing) return;
  await repository.createTaskDeadline({
    id: taskId,
    firmId: link.firmId,
    matterId: link.matterId,
    title: "Review submitted intake form",
    dueAt: now,
  });
}

export async function completeIntakeReviewTask(
  repository: ApiRouteDependencies["repository"],
  link: IntakeFormLinkRecord,
  completedAt: string,
): Promise<void> {
  await repository.completeTaskDeadline({
    firmId: link.firmId,
    taskId: intakeReviewTaskId(link.id),
    completedAt,
  });
}
