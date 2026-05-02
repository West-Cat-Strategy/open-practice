import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildBuiltInOperationalViews } from "@open-practice/domain";
import { parseRequestPart } from "../http/validation.js";
import type { ApiRouteDependencies } from "./types.js";

const operationalViewsQuerySchema = z.object({
  now: z.string().datetime().optional(),
});

export function registerOperationalViewRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/operational-views", async (request) => {
    const query = parseRequestPart(operationalViewsQuerySchema, request.query, "query");
    const matters = await repository.listMattersForUser(request.auth.user);
    const matterIds = new Set(matters.map((matter) => matter.id));
    const [
      signatures,
      externalUploadLinks,
      contactDossiers,
      emailOutbox,
      inboundEmailMessages,
      calendarEvents,
    ] = await Promise.all([
      repository.listSignatureRequests(request.auth.firmId),
      repository.listExternalUploadLinks(request.auth.firmId),
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
      externalUploadLinks: externalUploadLinks.filter((link) => matterIds.has(link.matterId)),
      calendarEvents: calendarEvents.filter((event) => matterIds.has(event.matterId)),
      contactDossiers,
      emailOutbox: emailOutbox
        .filter((email) => matterIds.has(email.matterId))
        .map((email) => ({
          matterId: email.matterId,
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
