import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import type {
  ContactIdentifier,
  ContactDataQualityResolutionRecord,
  ContactDossier,
  ContactDossierQualitySignal,
} from "@open-practice/domain";
import {
  contactDataQualityResolutionDecisions,
  contactDossierQualitySignalKinds,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import { appendRouteAuditEvent } from "./audit-events.js";

const contactDataQualityResolutionsQuerySchema = z.object({
  contactId: z.string().min(1).optional(),
  matterId: z.string().min(1).optional(),
});

const contactDataQualityResolutionBodySchema = z.object({
  contactId: z.string().min(1),
  signalKind: z.enum(contactDossierQualitySignalKinds),
  decision: z.enum(contactDataQualityResolutionDecisions),
  matterId: z.string().min(1).optional(),
  relatedContactId: z.string().min(1).optional(),
  sourceRecordId: z.string().min(1).optional(),
  resolutionNote: z.string().min(1),
});

const createContactBodySchema = z.object({
  kind: z.enum(["person", "organization"]),
  displayName: z.string().trim().min(1).max(160),
  aliases: z.array(z.string().trim().min(1).max(160)).default([]),
  identifiers: z
    .array(
      z.object({
        type: z.enum(["email", "phone", "tax_id", "registry_id"]),
        value: z.string().trim().min(1).max(320),
      }),
    )
    .default([]),
});

const contactDataQualityResolutionDecisionsByKind: Record<
  ContactDossierQualitySignal["kind"],
  ReadonlySet<ContactDataQualityResolutionRecord["decision"]>
> = {
  duplicate_candidate: new Set(["acknowledged", "false_positive", "needs_follow_up"]),
  protected_party_cue: new Set(["acknowledged", "needs_follow_up"]),
  conflict_revalidation: new Set([
    "revalidation_requested",
    "revalidation_completed",
    "needs_follow_up",
  ]),
};

function redactSignalMatchedValue(signal: ContactDossierQualitySignal) {
  const { matchedValue, ...redactedSignal } = signal;
  return { redactedSignal, matchedValueRedacted: Boolean(matchedValue) };
}

function serializeContactDossier(dossier: ContactDossier): ContactDossier {
  return {
    ...dossier,
    qualityReview: {
      ...dossier.qualityReview,
      signals: dossier.qualityReview.signals.map(
        (signal) => redactSignalMatchedValue(signal).redactedSignal,
      ),
    },
  };
}

function serializeContactReviewQueueItem(dossier: ContactDossier) {
  return {
    contact: {
      id: dossier.contact.id,
      kind: dossier.contact.kind,
      displayName: dossier.contact.displayName,
      aliasCount: dossier.contact.aliases.length,
      identifierCount: dossier.contact.identifiers.length,
    },
    matters: dossier.matters,
    summary: dossier.qualityReview.summary,
    signals: dossier.qualityReview.signals.map((signal) => {
      const { redactedSignal, matchedValueRedacted } = redactSignalMatchedValue(signal);
      return { ...redactedSignal, matchedValueRedacted };
    }),
    auditSafe: true,
  };
}

function visibleMatterIds(dossiers: ContactDossier[]): Set<string> {
  return new Set(dossiers.flatMap((dossier) => dossier.matters.map((matter) => matter.matterId)));
}

function visibleContactIds(dossiers: ContactDossier[]): Set<string> {
  return new Set(dossiers.map((dossier) => dossier.contact.id));
}

function findVisibleDossier(dossiers: ContactDossier[], contactId: string): ContactDossier {
  const dossier = dossiers.find((candidate) => candidate.contact.id === contactId);
  if (!dossier) {
    throw new ApiHttpError(
      403,
      "CONTACT_NOT_VISIBLE",
      "Contact data-quality resolution contact is not visible",
    );
  }
  return dossier;
}

function assertResolutionScopeVisible(
  dossiers: ContactDossier[],
  input: { contactId: string; matterId?: string; relatedContactId?: string },
): ContactDossier {
  const dossier = findVisibleDossier(dossiers, input.contactId);
  const matterIds = visibleMatterIds(dossiers);
  const contactIds = visibleContactIds(dossiers);

  if (input.matterId && !matterIds.has(input.matterId)) {
    throw new ApiHttpError(
      403,
      "CONTACT_MATTER_NOT_VISIBLE",
      "Contact data-quality resolution matter is not visible",
    );
  }
  if (input.matterId && !dossier.matters.some((matter) => matter.matterId === input.matterId)) {
    throw new ApiHttpError(
      403,
      "CONTACT_MATTER_LINK_NOT_VISIBLE",
      "Contact data-quality resolution contact is not visible on the requested matter",
    );
  }
  if (input.relatedContactId && !contactIds.has(input.relatedContactId)) {
    throw new ApiHttpError(
      403,
      "RELATED_CONTACT_NOT_VISIBLE",
      "Contact data-quality resolution related contact is not visible",
    );
  }

  return dossier;
}

function signalMatchesResolution(
  signal: ContactDossierQualitySignal,
  input: z.infer<typeof contactDataQualityResolutionBodySchema>,
): boolean {
  if (signal.kind !== input.signalKind) return false;
  if (signal.matterId && signal.matterId !== input.matterId) return false;
  if (input.matterId && signal.matterId !== input.matterId) return false;
  if (signal.sourceRecordId && signal.sourceRecordId !== input.sourceRecordId) return false;
  if (input.sourceRecordId && signal.sourceRecordId !== input.sourceRecordId) return false;
  if (input.relatedContactId) {
    return (signal.relatedContactIds ?? []).includes(input.relatedContactId);
  }
  return input.signalKind !== "duplicate_candidate" || !signal.relatedContactIds?.length;
}

function resolutionMatchesVisibleSignal(
  resolution: ContactDataQualityResolutionRecord,
  signal: ContactDossierQualitySignal,
): boolean {
  if (signal.kind !== resolution.signalKind) return false;
  if (signal.matterId && signal.matterId !== resolution.matterId) return false;
  if (resolution.matterId && signal.matterId !== resolution.matterId) return false;
  if (signal.sourceRecordId && signal.sourceRecordId !== resolution.sourceRecordId) return false;
  if (resolution.sourceRecordId && signal.sourceRecordId !== resolution.sourceRecordId) {
    return false;
  }
  if (resolution.relatedContactId) {
    return (signal.relatedContactIds ?? []).includes(resolution.relatedContactId);
  }
  return resolution.signalKind !== "duplicate_candidate" || !signal.relatedContactIds?.length;
}

function filterVisibleResolutions(
  resolutions: ContactDataQualityResolutionRecord[],
  dossiers: ContactDossier[],
): ContactDataQualityResolutionRecord[] {
  const contactIds = visibleContactIds(dossiers);
  const matterIds = visibleMatterIds(dossiers);
  return resolutions.filter(
    (resolution) =>
      contactIds.has(resolution.contactId) &&
      (!resolution.relatedContactId || contactIds.has(resolution.relatedContactId)) &&
      (!resolution.matterId || matterIds.has(resolution.matterId)) &&
      dossiers.some(
        (dossier) =>
          dossier.contact.id === resolution.contactId &&
          dossier.qualityReview.signals.some((signal) =>
            resolutionMatchesVisibleSignal(resolution, signal),
          ),
      ),
  );
}

export function registerContactRoutes(
  server: FastifyInstance,
  options: { repository: OpenPracticeRepository },
): void {
  server.get("/api/contacts/dossiers", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    return dossiers.map(serializeContactDossier);
  });

  server.post("/api/contacts", async (request, reply) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "create" });
    if (!access.ok) throw access.error;
    const body = parseRequestPart(createContactBodySchema, request.body, "body");
    const contact = await options.repository.createContact({
      id: `contact-${randomUUID()}`,
      firmId: request.auth.firmId,
      kind: body.kind,
      displayName: body.displayName,
      aliases: Array.from(new Set(body.aliases)),
      identifiers: body.identifiers as ContactIdentifier[],
      createdByUserId: request.auth.user.id,
    });
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "contact.created",
      resourceType: "contact",
      resourceId: contact.id,
      metadata: {
        contactId: contact.id,
        kind: contact.kind,
        aliasCount: contact.aliases.length,
        identifierTypes: Array.from(
          new Set(contact.identifiers.map((identifier) => identifier.type)),
        ),
      },
    });
    return reply.code(201).send({
      contact: {
        id: contact.id,
        firmId: contact.firmId,
        kind: contact.kind,
        displayName: contact.displayName,
        aliases: contact.aliases,
        identifiers: contact.identifiers,
      },
    });
  });

  server.get("/api/contacts/review-queue", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    const items = dossiers
      .filter((dossier) => dossier.qualityReview.signals.length > 0)
      .map(serializeContactReviewQueueItem);
    return {
      summary: {
        totalContacts: dossiers.length,
        reviewItemCount: items.length,
        duplicateCandidateCount: items.reduce(
          (total, item) => total + item.summary.duplicateCandidateCount,
          0,
        ),
        sensitivePartyCueCount: items.reduce(
          (total, item) => total + item.summary.sensitivePartyCueCount,
          0,
        ),
        revalidationPromptCount: items.reduce(
          (total, item) => total + item.summary.revalidationPromptCount,
          0,
        ),
      },
      items,
    };
  });

  server.get("/api/contacts/data-quality-resolutions", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const query = parseRequestPart(
      contactDataQualityResolutionsQuerySchema,
      request.query,
      "query",
    );
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    if (query.contactId || query.matterId) {
      if (query.contactId) {
        assertResolutionScopeVisible(dossiers, {
          contactId: query.contactId,
          matterId: query.matterId,
        });
      } else if (query.matterId && !visibleMatterIds(dossiers).has(query.matterId)) {
        throw new ApiHttpError(
          403,
          "CONTACT_MATTER_NOT_VISIBLE",
          "Contact data-quality resolution matter is not visible",
        );
      }
    }
    const resolutions = await options.repository.listContactDataQualityResolutions(
      request.auth.firmId,
      query,
    );
    return filterVisibleResolutions(resolutions, dossiers);
  });

  server.post("/api/contacts/data-quality-resolutions", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "update" });
    if (!access.ok) throw access.error;
    const body = parseRequestPart(contactDataQualityResolutionBodySchema, request.body, "body");
    if (!contactDataQualityResolutionDecisionsByKind[body.signalKind].has(body.decision)) {
      throw new ApiHttpError(
        400,
        "CONTACT_RESOLUTION_DECISION_INVALID",
        "Contact data-quality resolution decision is invalid for the signal kind",
      );
    }
    const dossiers = await options.repository.listContactDossiersForUser(request.auth.user);
    const dossier = assertResolutionScopeVisible(dossiers, body);
    if (!dossier.qualityReview.signals.some((signal) => signalMatchesResolution(signal, body))) {
      throw new ApiHttpError(
        403,
        "CONTACT_SIGNAL_NOT_VISIBLE",
        "Contact data-quality resolution signal is not visible",
      );
    }

    const created = await options.repository.createContactDataQualityResolution({
      id: randomUUID(),
      firmId: request.auth.firmId,
      contactId: body.contactId,
      signalKind: body.signalKind,
      decision: body.decision,
      matterId: body.matterId,
      relatedContactId: body.relatedContactId,
      sourceRecordId: body.sourceRecordId,
      resolutionNote: body.resolutionNote,
      recordedByUserId: request.auth.user.id,
      recordedAt: new Date().toISOString(),
    });
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "contact.data_quality_resolution.recorded",
      resourceType: "contact_data_quality_resolution",
      resourceId: created.id,
      metadata: {
        contactId: created.contactId,
        matterId: created.matterId,
        signalKind: created.signalKind,
        decision: created.decision,
        relatedContactPresent: Boolean(created.relatedContactId),
        sourceRecordPresent: Boolean(created.sourceRecordId),
        resolutionNotePresent: Boolean(created.resolutionNote.trim()),
      },
    });
    return created;
  });
}
