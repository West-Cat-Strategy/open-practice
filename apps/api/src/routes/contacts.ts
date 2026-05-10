import type { FastifyInstance } from "fastify";
import type { OpenPracticeRepository } from "@open-practice/database";
import type { ContactDossier } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";

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
}
