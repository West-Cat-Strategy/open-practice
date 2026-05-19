import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import {
  validateContactQualityReviewDecisionRecord,
  type ContactDossier,
  type ContactDossierQualitySignal,
  type ContactDossierQualitySignalKind,
  type ContactQualityReviewDecision,
  type ContactQualityReviewDecisionRecord,
  type User,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import { appendRouteAuditEvent } from "./audit-events.js";

const contactReviewDecisionQuerySchema = z.object({
  contactId: z.string().min(1).optional(),
});

const contactReviewDecisionParamsSchema = z.object({
  contactId: z.string().min(1),
});

const contactReviewDecisionBodySchema = z
  .object({
    signalKind: z.enum(["duplicate_candidate", "protected_party_cue", "conflict_revalidation"]),
    decision: z.enum([
      "duplicate_confirmed",
      "not_duplicate",
      "protected_party_handling_confirmed",
      "protected_party_handling_not_required",
      "conflict_revalidation_required",
      "conflict_revalidation_not_required",
      "needs_more_review",
    ]),
    matterId: z.string().min(1).optional(),
    relatedContactIds: z.array(z.string().min(1)).default([]),
    sourceRecordId: z.string().min(1).optional(),
    decidedAt: z.string().datetime().optional(),
    reason: z.string().min(1).max(500).optional(),
    evidence: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

type ContactReviewDecisionBody = z.infer<typeof contactReviewDecisionBodySchema>;

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
    signals: dossier.qualityReview.signals.map(({ matchedValue: _matchedValue, ...signal }) => ({
      ...signal,
      matchedValueRedacted: Boolean(_matchedValue),
    })),
    auditSafe: true,
  };
}

function sorted(values: string[] = []): string[] {
  return [...values].sort();
}

function sameValues(left: string[] = [], right: string[] = []): boolean {
  const sortedLeft = sorted(left);
  const sortedRight = sorted(right);
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
}

function signalMatchesDecisionInput(
  signal: ContactDossierQualitySignal,
  input: {
    signalKind: ContactDossierQualitySignalKind;
    matterId?: string;
    relatedContactIds: string[];
    sourceRecordId?: string;
  },
): boolean {
  if (signal.kind !== input.signalKind) return false;
  if (signal.kind === "duplicate_candidate") {
    return sameValues(signal.relatedContactIds ?? [], input.relatedContactIds);
  }
  if (signal.kind === "protected_party_cue") {
    return signal.matterId === input.matterId;
  }
  return signal.matterId === input.matterId && signal.sourceRecordId === input.sourceRecordId;
}

function validateDecisionRecord(
  record: ContactQualityReviewDecisionRecord,
): ContactQualityReviewDecisionRecord {
  try {
    return validateContactQualityReviewDecisionRecord(record);
  } catch (error) {
    throw new ApiHttpError(
      400,
      "CONTACT_QUALITY_DECISION_INVALID",
      error instanceof Error ? error.message : "Contact quality review decision is invalid",
    );
  }
}

async function visibleContactDossier(
  repository: OpenPracticeRepository,
  user: User,
  contactId: string,
): Promise<ContactDossier> {
  const dossiers = await repository.listContactDossiersForUser(user);
  const dossier = dossiers.find((candidate) => candidate.contact.id === contactId);
  if (!dossier) {
    throw new ApiHttpError(
      404,
      "CONTACT_DOSSIER_NOT_FOUND",
      "Contact dossier is not visible to the current user",
    );
  }
  return dossier;
}

function buildContactQualityDecisionRecord(input: {
  auth: { firmId: string; user: User };
  contactId: string;
  body: ContactReviewDecisionBody;
  now: string;
}): ContactQualityReviewDecisionRecord {
  return validateDecisionRecord({
    id: crypto.randomUUID(),
    firmId: input.auth.firmId,
    contactId: input.contactId,
    signalKind: input.body.signalKind,
    decision: input.body.decision as ContactQualityReviewDecision,
    matterId: input.body.matterId,
    relatedContactIds: input.body.relatedContactIds,
    sourceRecordId: input.body.sourceRecordId,
    decidedByUserId: input.auth.user.id,
    decidedAt: input.body.decidedAt ?? input.now,
    reason: input.body.reason,
    evidence: input.body.evidence,
    createdAt: input.now,
  });
}

export function registerContactRoutes(
  server: FastifyInstance,
  options: { repository: OpenPracticeRepository },
): void {
  server.get("/api/contacts/dossiers", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    return options.repository.listContactDossiersForUser(request.auth.user);
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

  server.get("/api/contacts/review-decisions", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const query = parseRequestPart(contactReviewDecisionQuerySchema, request.query, "query");
    const decisions = await options.repository.listContactQualityReviewDecisionsForUser(
      request.auth.user,
    );
    return {
      decisions: query.contactId
        ? decisions.filter((decision) => decision.contactId === query.contactId)
        : decisions,
    };
  });

  server.post("/api/contacts/:contactId/review-decisions", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "update" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(contactReviewDecisionParamsSchema, request.params, "params");
    const body = parseRequestPart(contactReviewDecisionBodySchema, request.body, "body");
    const now = new Date().toISOString();
    const decision = buildContactQualityDecisionRecord({
      auth: request.auth,
      contactId: params.contactId,
      body,
      now,
    });
    const dossier = await visibleContactDossier(
      options.repository,
      request.auth.user,
      params.contactId,
    );
    if (
      !dossier.qualityReview.signals.some((signal) => signalMatchesDecisionInput(signal, decision))
    ) {
      throw new ApiHttpError(
        409,
        "CONTACT_QUALITY_SIGNAL_NOT_VISIBLE",
        "Contact quality decision must reference a visible current review signal",
      );
    }

    const created = await options.repository.createContactQualityReviewDecision(decision);
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "contact_quality_decision.recorded",
      resourceType: "contact_quality_review_decision",
      resourceId: created.id,
      metadata: {
        contactId: created.contactId,
        matterId: created.matterId,
        signalKind: created.signalKind,
        decision: created.decision,
        relatedContactCount: created.relatedContactIds.length,
        sourceRecordId: created.sourceRecordId,
        evidenceKeyCount: Object.keys(created.evidence).length,
      },
    });
    return created;
  });
}
