import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildFiscalHostWorkflowSelector,
  type LegalClinicMatterProfile,
  type LegalClinicProgram,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";

const legalClinicProgramStatusSchema = z.enum(["active", "paused", "archived"]);
const legalClinicEligibilityStatusSchema = z.enum([
  "unknown",
  "likely_eligible",
  "ineligible",
  "needs_review",
]);
const legalClinicReferralStatusSchema = z.enum([
  "not_referred",
  "referral_needed",
  "referred",
  "accepted",
  "declined",
]);
const referralSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9_.:-]+$/i, "Referral source must be a provider-neutral source key");

const programBodySchema = z.object({
  name: z.string().min(1).max(160),
  status: legalClinicProgramStatusSchema.default("active"),
  serviceArea: z.string().min(1).max(160),
  eligibilitySummary: z.string().min(1).max(1000),
  defaultReferralSource: referralSourceSchema.optional(),
  defaultReferralStatus: legalClinicReferralStatusSchema.default("not_referred"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const matterProfileParamsSchema = z.object({
  matterId: z.string().min(1),
});

const matterProfileQuerySchema = z.object({
  matterId: z.string().min(1),
});

const matterProfileBodySchema = z.object({
  programId: z.string().min(1),
  eligibilityStatus: legalClinicEligibilityStatusSchema.default("unknown"),
  referralSource: referralSourceSchema.optional(),
  referralStatus: legalClinicReferralStatusSchema.default("not_referred"),
  referralDate: z.string().date().optional(),
  nextReviewDate: z.string().datetime().optional(),
  clinicRelationshipRole: z.string().min(1).max(120),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

type LegalClinicProgramResponse = Omit<LegalClinicProgram, "metadata"> & {
  metadata: {
    fiscalHost?: {
      hostName?: string;
      programCode?: string;
      reportingCadence?: string;
    };
  };
};

type LegalClinicMatterProfileResponse = Omit<LegalClinicMatterProfile, "metadata"> & {
  metadata: {
    restrictedFund?: {
      fundCode?: string;
      purpose?: string;
      reviewStatus?: string;
      nextReviewDate?: string;
    };
  };
};

function assertLegalClinicAccess(
  context: ApiAuthContext,
  action: "create" | "read" | "update",
  matterId?: string,
): void {
  const access = requireAccess(context, { resource: "legal_clinic", action, matterId });
  if (!access.ok) throw access.error;
}

function referralSourceKey(value: string | undefined): string | undefined {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toLegalClinicProgramResponse(program: LegalClinicProgram): LegalClinicProgramResponse {
  const fiscalHost = compactStringMetadata({
    hostName: stringMetadata(objectMetadata(program.metadata.fiscalHost).hostName),
    programCode: stringMetadata(objectMetadata(program.metadata.fiscalHost).programCode),
    reportingCadence: stringMetadata(objectMetadata(program.metadata.fiscalHost).reportingCadence),
  });
  return {
    ...program,
    metadata: Object.keys(fiscalHost).length > 0 ? { fiscalHost } : {},
  };
}

function toLegalClinicMatterProfileResponse(
  profile: LegalClinicMatterProfile,
): LegalClinicMatterProfileResponse {
  const restrictedFund = compactStringMetadata({
    fundCode: stringMetadata(objectMetadata(profile.metadata.restrictedFund).fundCode),
    purpose: stringMetadata(objectMetadata(profile.metadata.restrictedFund).purpose),
    reviewStatus: stringMetadata(objectMetadata(profile.metadata.restrictedFund).reviewStatus),
    nextReviewDate: stringMetadata(objectMetadata(profile.metadata.restrictedFund).nextReviewDate),
  });
  return {
    ...profile,
    metadata: Object.keys(restrictedFund).length > 0 ? { restrictedFund } : {},
  };
}

function objectMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function compactStringMetadata<T extends Record<string, string | undefined>>(
  metadata: T,
): {
  [K in keyof T]?: string;
} {
  return Object.fromEntries(
    Object.entries(metadata).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ) as { [K in keyof T]?: string };
}

async function ensureProgramExists(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  programId: string,
): Promise<LegalClinicProgram> {
  const program = (await repository.listLegalClinicPrograms(firmId)).find(
    (candidate) => candidate.id === programId,
  );
  if (!program) {
    throw new ApiHttpError(
      404,
      "LEGAL_CLINIC_PROGRAM_NOT_FOUND",
      "Legal clinic program was not found",
      { programId },
    );
  }
  return program;
}

export function registerLegalClinicRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/legal-clinic/programs", async (request) => {
    assertLegalClinicAccess(request.auth, "read");
    const programs = await repository.listLegalClinicPrograms(request.auth.firmId);
    return { programs: programs.map(toLegalClinicProgramResponse) };
  });

  server.get("/api/legal-clinic/fiscal-host-workflow", async (request) => {
    const query = parseRequestPart(matterProfileQuerySchema, request.query, "query");
    assertLegalClinicAccess(request.auth, "read", query.matterId);
    const profile = await repository.getLegalClinicMatterProfile(
      request.auth.firmId,
      query.matterId,
    );
    const program = profile
      ? (await repository.listLegalClinicPrograms(request.auth.firmId)).find(
          (candidate) => candidate.id === profile.programId,
        )
      : undefined;

    return {
      selector: buildFiscalHostWorkflowSelector({
        matterId: query.matterId,
        profile,
        program,
      }),
    };
  });

  server.post("/api/legal-clinic/programs", async (request, reply) => {
    const body = parseRequestPart(programBodySchema, request.body, "body");
    assertLegalClinicAccess(request.auth, "create");

    const now = new Date().toISOString();
    const program: LegalClinicProgram = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      name: body.name,
      status: body.status,
      serviceArea: body.serviceArea,
      eligibilitySummary: body.eligibilitySummary,
      defaultReferralSource: body.defaultReferralSource,
      defaultReferralStatus: body.defaultReferralStatus,
      createdAt: now,
      updatedAt: now,
      metadata: body.metadata,
    };
    const created = await repository.createLegalClinicProgram(program);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "legal_clinic.program.created",
      resourceType: "legal_clinic_program",
      resourceId: created.id,
      metadata: {
        programId: created.id,
        status: created.status,
        serviceArea: created.serviceArea,
        defaultReferralSourceKey: referralSourceKey(created.defaultReferralSource),
        defaultReferralStatus: created.defaultReferralStatus,
      },
    });

    reply.code(201);
    return { program: toLegalClinicProgramResponse(created) };
  });

  server.get("/api/legal-clinic/profiles", async (request) => {
    const query = parseRequestPart(matterProfileQuerySchema, request.query, "query");
    assertLegalClinicAccess(request.auth, "read", query.matterId);
    const profile = await repository.getLegalClinicMatterProfile(
      request.auth.firmId,
      query.matterId,
    );
    return { profiles: profile ? [toLegalClinicMatterProfileResponse(profile)] : [] };
  });

  server.put("/api/legal-clinic/profiles/:matterId", async (request) => {
    const params = parseRequestPart(matterProfileParamsSchema, request.params, "params");
    const body = parseRequestPart(matterProfileBodySchema, request.body, "body");
    assertLegalClinicAccess(request.auth, "update", params.matterId);
    await ensureProgramExists(repository, request.auth.firmId, body.programId);

    const existing = await repository.getLegalClinicMatterProfile(
      request.auth.firmId,
      params.matterId,
    );
    const now = new Date().toISOString();
    const profile: LegalClinicMatterProfile = {
      id: existing?.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: params.matterId,
      programId: body.programId,
      eligibilityStatus: body.eligibilityStatus,
      referralSource: body.referralSource,
      referralStatus: body.referralStatus,
      referralDate: body.referralDate,
      nextReviewDate: body.nextReviewDate,
      clinicRelationshipRole: body.clinicRelationshipRole,
      notes: body.notes,
      metadata: body.metadata,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
    };
    const updated = await repository.upsertLegalClinicMatterProfile(profile);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "legal_clinic.profile.upserted",
      resourceType: "legal_clinic_matter_profile",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        programId: updated.programId,
        eligibilityStatus: updated.eligibilityStatus,
        referralStatus: updated.referralStatus,
        referralSourceKey: referralSourceKey(updated.referralSource),
      },
    });

    return { profile: toLegalClinicMatterProfileResponse(updated) };
  });
}
