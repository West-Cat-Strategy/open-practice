import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  buildBuiltInOperationalViews,
  canAccess,
  type Action,
  type ResourceKind,
  type SavedOperationalViewDefinition,
  type SavedOperationalViewPermissionScope,
} from "@open-practice/domain";
import { requireStaffAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";

const operationalViewsQuerySchema = z.object({
  now: z.string().datetime().optional(),
});
const savedOperationalViewSurfaceSchema = z.enum(["queues", "matters"]);
const permissionScopeSchema = z
  .string()
  .regex(/^[a-z_]+:(create|read|update|delete|approve|export)$/)
  .transform((value) => value as SavedOperationalViewPermissionScope);
const definitionPayloadSchema = z.object({
  surface: savedOperationalViewSurfaceSchema.default("queues"),
  name: z.string().trim().min(1).max(120),
  filters: z.record(z.string(), z.unknown()).default({}),
  columns: z.array(z.unknown()).default([]),
  sort: z.record(z.string(), z.unknown()).default({}),
  rowLimit: z.number().int().min(1).max(250).default(25),
  dashboardBehavior: z.record(z.string(), z.unknown()).default({}),
  permissionScope: z.array(permissionScopeSchema).min(1).max(20).default(["matter:read"]),
});
const definitionPatchSchema = z.object({
  surface: savedOperationalViewSurfaceSchema.optional(),
  name: z.string().trim().min(1).max(120).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  columns: z.array(z.unknown()).optional(),
  sort: z.record(z.string(), z.unknown()).optional(),
  rowLimit: z.number().int().min(1).max(250).optional(),
  dashboardBehavior: z.record(z.string(), z.unknown()).optional(),
  permissionScope: z.array(permissionScopeSchema).min(1).max(20).optional(),
});
const definitionParamsSchema = z.object({
  id: z.string().min(1),
});
const definitionQuerySchema = z.object({
  surface: savedOperationalViewSurfaceSchema.optional(),
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});
const matterDashboardPresetFamilies = new Set([
  "matter_follow_up",
  "matter_risk_review",
  "matter_action_required",
]);

const actions = new Set<Action>(["create", "read", "update", "delete", "approve", "export"]);

type AuthenticatedRequest = FastifyRequest & { auth: ApiAuthContext };

function parsePermissionScope(scope: SavedOperationalViewPermissionScope): {
  resource: ResourceKind;
  action: Action;
} {
  const [resource, action] = scope.split(":") as [ResourceKind, Action];
  if (!resource || !actions.has(action)) {
    throw new ApiHttpError(400, "INVALID_OPERATIONAL_VIEW_SCOPE", "Invalid permission scope");
  }
  return { resource, action };
}

function scopeMatterId(resource: ResourceKind, userMatterIds: string[]): string | undefined {
  if (
    [
      "matter",
      "document",
      "portal_message",
      "signature_request",
      "trust_ledger",
      "time_entry",
      "expense_entry",
      "conversation_thread",
      "task",
      "calendar_event",
      "intake_session",
      "email",
      "inbound_email",
      "document_processing",
      "share_link",
      "external_upload",
      "draft",
    ].includes(resource)
  ) {
    return userMatterIds[0];
  }
  return undefined;
}

function canUsePermissionScope(
  request: AuthenticatedRequest,
  scope: SavedOperationalViewPermissionScope,
): boolean {
  const parsed = parsePermissionScope(scope);
  return canAccess({
    user: request.auth.user,
    firmId: request.auth.firmId,
    resource: parsed.resource,
    action: parsed.action,
    matterId: scopeMatterId(parsed.resource, request.auth.user.assignedMatterIds),
  });
}

function canUseDefinition(
  request: AuthenticatedRequest,
  definition: Pick<SavedOperationalViewDefinition, "permissionScope">,
): boolean {
  return definition.permissionScope.every((scope) => canUsePermissionScope(request, scope));
}

function assertDefinitionOwner(
  request: AuthenticatedRequest,
  definition: SavedOperationalViewDefinition | undefined,
): SavedOperationalViewDefinition {
  if (!definition || definition.ownerUserId !== request.auth.user.id) {
    throw new ApiHttpError(
      404,
      "OPERATIONAL_VIEW_DEFINITION_NOT_FOUND",
      "Saved operational view definition was not found",
    );
  }
  return definition;
}

function assertCanUseDefinition(
  request: AuthenticatedRequest,
  definition: Pick<SavedOperationalViewDefinition, "permissionScope">,
): void {
  if (!canUseDefinition(request, definition)) {
    throw new ApiHttpError(
      403,
      "OPERATIONAL_VIEW_SCOPE_FORBIDDEN",
      "Saved operational view definition includes a permission scope unavailable to this user",
    );
  }
}

function assertValidMatterPresetFilters(
  surface: SavedOperationalViewDefinition["surface"],
  filters: Record<string, unknown>,
): void {
  if (surface !== "matters") return;
  const presetFamily = filters.presetFamily;
  if (typeof presetFamily !== "string" || !matterDashboardPresetFamilies.has(presetFamily)) {
    throw new ApiHttpError(
      400,
      "INVALID_MATTER_PRESET_FILTER",
      "Matter dashboard preset filters require a supported preset family",
    );
  }
}

export function registerOperationalViewRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/operational-views/definitions", async (request) => {
    const query = parseRequestPart(definitionQuerySchema, request.query, "query");
    const definitions = await repository.listSavedOperationalViewDefinitions(request.auth.firmId, {
      ownerUserId: request.auth.user.id,
      surface: query.surface,
      includeArchived: query.includeArchived,
    });
    return {
      definitions: definitions.filter((definition) => canUseDefinition(request, definition)),
    };
  });

  server.post("/api/operational-views/definitions", async (request) => {
    const body = parseRequestPart(definitionPayloadSchema, request.body, "body");
    assertValidMatterPresetFilters(body.surface, body.filters);
    assertCanUseDefinition(request, body);
    const now = new Date().toISOString();
    const definition = await repository.createSavedOperationalViewDefinition({
      ...body,
      firmId: request.auth.firmId,
      ownerUserId: request.auth.user.id,
      createdAt: now,
      updatedAt: now,
    });
    return { definition };
  });

  server.patch("/api/operational-views/definitions/:id", async (request) => {
    const params = parseRequestPart(definitionParamsSchema, request.params, "params");
    const body = parseRequestPart(definitionPatchSchema, request.body, "body");
    const existing = assertDefinitionOwner(
      request,
      await repository.getSavedOperationalViewDefinition(request.auth.firmId, params.id),
    );
    const permissionScope = body.permissionScope ?? existing.permissionScope;
    assertValidMatterPresetFilters(
      body.surface ?? existing.surface,
      body.filters ?? existing.filters,
    );
    assertCanUseDefinition(request, { permissionScope });
    const updated = await repository.updateSavedOperationalViewDefinition(
      request.auth.firmId,
      params.id,
      {
        ...body,
        permissionScope,
        updatedAt: new Date().toISOString(),
      },
    );
    return { definition: assertDefinitionOwner(request, updated) };
  });

  server.post("/api/operational-views/definitions/:id/archive", async (request) => {
    const params = parseRequestPart(definitionParamsSchema, request.params, "params");
    const existing = assertDefinitionOwner(
      request,
      await repository.getSavedOperationalViewDefinition(request.auth.firmId, params.id),
    );
    assertCanUseDefinition(request, existing);
    const archived = await repository.archiveSavedOperationalViewDefinition({
      firmId: request.auth.firmId,
      id: params.id,
      archivedAt: new Date().toISOString(),
    });
    return { definition: assertDefinitionOwner(request, archived) };
  });

  server.get("/api/operational-views", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const query = parseRequestPart(operationalViewsQuerySchema, request.query, "query");
    const matters = await repository.listMattersForUser(request.auth.user);
    const matterIds = new Set(matters.map((matter) => matter.id));
    const [
      signatures,
      shareLinks,
      externalUploadLinks,
      intakeFormLinks,
      calendarGuestLinks,
      accessLogs,
      contactDossiers,
      emailOutbox,
      inboundEmailMessages,
      calendarEvents,
    ] = await Promise.all([
      repository.listSignatureRequests(request.auth.firmId),
      repository.listShareLinks(request.auth.firmId),
      repository.listExternalUploadLinks(request.auth.firmId),
      repository.listIntakeFormLinks(request.auth.firmId),
      repository.listCalendarGuestLinks(request.auth.firmId),
      repository.listAccessLogs(request.auth.firmId),
      repository.listContactDossiersForUser(request.auth.user),
      repository.listEmailOutbox(request.auth.firmId),
      repository.listInboundEmailMessages(request.auth.firmId),
      Promise.all(
        matters.map((matter) =>
          repository.listCalendarEvents(request.auth.firmId, { matterId: matter.id }),
        ),
      ).then((events) => events.flat()),
    ]);

    const views = buildBuiltInOperationalViews({
      now: query.now,
      matters: matters.map((matter) => ({
        id: matter.id,
        firmId: matter.firmId,
        number: matter.number,
        title: matter.title,
        practiceArea: matter.practiceArea,
        status: matter.status,
        openedOn: matter.openedOn,
        parties: matter.parties.map((party) => ({
          role: party.role,
          contactId: party.contactId,
          adverse: party.adverse,
          confidential: party.confidential,
        })),
        activity: matter.activity,
      })),
      signatures: signatures.filter((signature) => matterIds.has(signature.matterId)),
      shareLinks: shareLinks.filter((link) => matterIds.has(link.matterId)),
      externalUploadLinks: externalUploadLinks.filter((link) => matterIds.has(link.matterId)),
      intakeFormLinks: intakeFormLinks.filter((link) => matterIds.has(link.matterId)),
      calendarGuestLinks: calendarGuestLinks.filter((link) => matterIds.has(link.matterId)),
      accessLogs,
      calendarEvents: calendarEvents.filter((event) => matterIds.has(event.matterId)),
      contactDossiers,
      emailOutbox: emailOutbox
        .filter((email) => email.matterId !== undefined && matterIds.has(email.matterId))
        .map((email) => ({
          matterId: email.matterId!,
          status: email.status,
          queuedAt: email.queuedAt,
          sentAt: email.sentAt,
          relatedResourceType: email.relatedResourceType,
        })),
      inboundEmailMessages: inboundEmailMessages
        .filter((message) => message.matterId && matterIds.has(message.matterId))
        .map((message) => ({
          matterId: message.matterId,
          receivedAt: message.receivedAt,
          status: message.status,
        })),
    });

    return {
      generatedAt: query.now ?? new Date().toISOString(),
      views,
    };
  });
}
