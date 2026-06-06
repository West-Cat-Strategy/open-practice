import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  MatterSummary,
  OpenPracticeRepository,
  PracticeOverview,
} from "@open-practice/database";
import type {
  ConflictCandidate,
  ContactIdentifier,
  ProfessionalRole,
  User,
} from "@open-practice/domain";
import { requireAccess, requireStaffAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";

const provinceSchema = z.enum(["BC", "ON", "CANADA", "OTHER"]);

const optionalEmailSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email().optional(),
);

const optionalPhoneSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const createMatterBodySchema = z.object({
  title: z.string().trim().min(1),
  practiceArea: z.string().trim().min(1),
  jurisdiction: provinceSchema,
  client: z.object({
    kind: z.enum(["person", "organization"]),
    displayName: z.string().trim().min(1),
    email: optionalEmailSchema,
    phone: optionalPhoneSchema,
  }),
});

const conflictBodySchema = z.object({
  prospectiveName: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  identifiers: z.array(z.object({ type: z.string().min(1), value: z.string().min(1) })).optional(),
  prospectiveRole: z.enum(["client", "opposing_party", "third_party"]).optional(),
  includeClosedMatters: z.boolean().default(true),
});

function scopedOverview(input: {
  overview: PracticeOverview;
  matters: MatterSummary[];
  user: User;
}): PracticeOverview {
  return {
    firm: input.overview.firm,
    metrics: {
      openMatters: input.matters.filter((matter) => matter.status === "open").length,
      intakeMatters: input.matters.filter((matter) => matter.status === "intake").length,
      portalGrants: 0,
      trustBalanceCents: input.matters.reduce((sum, matter) => sum + matter.trustBalanceCents, 0),
      unbilledMinutes: input.matters
        .flatMap((matter) => matter.timeEntries)
        .filter(
          (entry) =>
            entry.billable && ["draft", "submitted", "approved"].includes(entry.billingStatus),
        )
        .reduce((sum, entry) => sum + entry.minutes, 0),
    },
    users: [input.user],
  };
}

function prefixedId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function contactIdentifiers(input: { email?: string; phone?: string }): ContactIdentifier[] {
  const identifiers: ContactIdentifier[] = [];
  if (input.email) identifiers.push({ type: "email", value: input.email });
  if (input.phone) identifiers.push({ type: "phone", value: input.phone });
  return identifiers;
}

function canReadFirmWideConflictDetails(role: ProfessionalRole): boolean {
  return role === "owner_admin" || role === "auditor";
}

function severityRank(severity: ConflictCandidate["severity"]): number {
  return severity === "blocker" ? 3 : severity === "review" ? 2 : 1;
}

function summarizeConflictResults(results: ConflictCandidate[]) {
  const countsBySeverity = { blocker: 0, review: 0, info: 0 };
  for (const result of results) countsBySeverity[result.severity] += 1;
  const topSeverity =
    results
      .map((result) => result.severity)
      .sort((left, right) => severityRank(right) - severityRank(left))[0] ?? "none";
  return {
    results: [],
    summary: {
      matchCount: results.length,
      severity: topSeverity,
      countsBySeverity,
      detailsRedacted: true,
    },
  };
}

export function registerMatterRoutes(
  server: FastifyInstance,
  options: { repository: OpenPracticeRepository },
): void {
  server.get("/api/overview", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const firmWideAccess = requireAccess(request.auth, { resource: "firm", action: "read" });
    const overview = await options.repository.getOverview(request.auth.firmId);
    if (firmWideAccess.ok) return overview;

    const matters = await options.repository.listMattersForUser(request.auth.user);
    return scopedOverview({ overview, matters, user: request.auth.user });
  });

  server.get("/api/matters", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    return options.repository.listMattersForUser(request.auth.user);
  });

  server.post("/api/matters", async (request, reply) => {
    const access = requireAccess(request.auth, { resource: "matter", action: "create" });
    if (!access.ok) throw access.error;
    const contactAccess = requireAccess(request.auth, { resource: "contact", action: "create" });
    if (!contactAccess.ok) throw contactAccess.error;

    const body = parseRequestPart(createMatterBodySchema, request.body, "body");
    const occurredAt = new Date();
    const openedOn = occurredAt.toISOString().slice(0, 10);
    const matter = await options.repository.createMatterWithClient({
      firmId: request.auth.firmId,
      actorUserId: request.auth.user.id,
      matterId: prefixedId("matter"),
      contactId: prefixedId("contact"),
      partyId: prefixedId("party"),
      title: body.title,
      practiceArea: body.practiceArea,
      jurisdiction: body.jurisdiction,
      openedOn,
      occurredAt: occurredAt.toISOString(),
      auditEventId: prefixedId("audit"),
      client: {
        kind: body.client.kind,
        displayName: body.client.displayName,
        identifiers: contactIdentifiers(body.client),
      },
    });

    reply.code(201);
    return matter;
  });

  server.post("/api/conflicts/check", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const body = parseRequestPart(conflictBodySchema, request.body, "body");
    const conflictCheck = await options.repository.runConflictCheck({
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      ...body,
    });
    if (canReadFirmWideConflictDetails(request.auth.user.role)) return conflictCheck;
    return summarizeConflictResults(conflictCheck.results);
  });
}
