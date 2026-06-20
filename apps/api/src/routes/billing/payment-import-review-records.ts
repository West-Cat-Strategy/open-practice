import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  defaultPaymentImportReviewBoundary,
  paymentImportEventFamilies,
  paymentImportReviewConflictReasons,
  type PaymentImportReviewRecord,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireStaffAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import { buildIdempotencyFingerprint, rethrowIdempotencyConflict } from "../idempotency.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertMatterAccess } from "./shared.js";

const providerSafeLabelSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_.:-]+$/);
const safeExternalIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_.:-]+$/);
const safeEventStatusSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_.:-]+$/);

const paymentImportReviewQuerySchema = z
  .object({
    matterId: z.string().min(1).optional(),
    candidateInvoiceId: z.string().min(1).optional(),
    candidateHostedPaymentRequestId: z.string().min(1).optional(),
    candidateManualPaymentId: z.string().min(1).optional(),
    eventFamily: z.enum(paymentImportEventFamilies).optional(),
  })
  .strict();

const paymentImportReviewBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1),
    providerLabel: providerSafeLabelSchema,
    eventFamily: z.enum(paymentImportEventFamilies),
    eventStatus: safeEventStatusSchema,
    externalEventId: safeExternalIdSchema,
    externalPaymentId: safeExternalIdSchema.optional(),
    externalDepositId: safeExternalIdSchema.optional(),
    amountCents: z.number().int().positive(),
    currency: z.literal("CAD").default("CAD"),
    observedAt: z.string().datetime().optional(),
    candidateInvoiceId: z.string().min(1).optional(),
    candidateHostedPaymentRequestId: z.string().min(1).optional(),
    candidateManualPaymentId: z.string().min(1).optional(),
    duplicateOfRecordId: z.string().min(1).optional(),
    conflictReason: z.enum(paymentImportReviewConflictReasons).optional(),
  })
  .strict();

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

async function assertCandidateLinks(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  matterId: string;
  candidateInvoiceId?: string;
  candidateHostedPaymentRequestId?: string;
  candidateManualPaymentId?: string;
}): Promise<void> {
  let candidateInvoiceMatterId: string | undefined;
  let candidateInvoiceId = input.candidateInvoiceId;
  if (input.candidateInvoiceId) {
    const invoice = await input.repository.getInvoice(input.firmId, input.candidateInvoiceId);
    if (!invoice) {
      throw new ApiHttpError(404, "CANDIDATE_INVOICE_NOT_FOUND", "Candidate invoice was not found");
    }
    if (invoice.matterId !== input.matterId) {
      throw new ApiHttpError(
        409,
        "PAYMENT_IMPORT_CANDIDATE_MATTER_MISMATCH",
        "Candidate invoice must belong to the import review matter",
      );
    }
    candidateInvoiceMatterId = invoice.matterId;
  }

  if (input.candidateHostedPaymentRequestId) {
    const paymentRequest = await input.repository.getHostedPaymentRequest(
      input.firmId,
      input.candidateHostedPaymentRequestId,
    );
    if (!paymentRequest) {
      throw new ApiHttpError(
        404,
        "CANDIDATE_PAYMENT_REQUEST_NOT_FOUND",
        "Candidate hosted payment request was not found",
      );
    }
    if (paymentRequest.matterId !== input.matterId) {
      throw new ApiHttpError(
        409,
        "PAYMENT_IMPORT_CANDIDATE_MATTER_MISMATCH",
        "Candidate hosted payment request must belong to the import review matter",
      );
    }
    if (input.candidateInvoiceId && paymentRequest.invoiceId !== input.candidateInvoiceId) {
      throw new ApiHttpError(
        409,
        "PAYMENT_IMPORT_CANDIDATE_INVOICE_MISMATCH",
        "Candidate hosted payment request must reference the candidate invoice",
      );
    }
    candidateInvoiceMatterId = candidateInvoiceMatterId ?? paymentRequest.matterId;
    candidateInvoiceId = candidateInvoiceId ?? paymentRequest.invoiceId;
  }

  if (input.candidateManualPaymentId) {
    const manualPayment = (await input.repository.listPayments(input.firmId)).find(
      (candidate) => candidate.id === input.candidateManualPaymentId,
    );
    if (!manualPayment) {
      throw new ApiHttpError(
        404,
        "CANDIDATE_MANUAL_PAYMENT_NOT_FOUND",
        "Candidate manual payment was not found",
      );
    }
    if (manualPayment.matterId !== input.matterId) {
      throw new ApiHttpError(
        409,
        "PAYMENT_IMPORT_CANDIDATE_MATTER_MISMATCH",
        "Candidate manual payment must belong to the import review matter",
      );
    }
    if (
      candidateInvoiceId &&
      manualPayment.invoiceId &&
      manualPayment.invoiceId !== candidateInvoiceId
    ) {
      throw new ApiHttpError(
        409,
        "PAYMENT_IMPORT_CANDIDATE_INVOICE_MISMATCH",
        "Candidate manual payment must reference the candidate invoice",
      );
    }
  }

  if (candidateInvoiceMatterId && candidateInvoiceMatterId !== input.matterId) {
    throw new ApiHttpError(
      409,
      "PAYMENT_IMPORT_CANDIDATE_MATTER_MISMATCH",
      "Payment import candidate links must stay within the review matter",
    );
  }
}

type RegisterBillingPaymentImportReviewRoutesOptions = Pick<ApiRouteDependencies, "repository">;

export function registerBillingPaymentImportReviewRoutes(
  server: FastifyInstance,
  { repository }: RegisterBillingPaymentImportReviewRoutesOptions,
): void {
  server.get("/api/billing/payment-import-review-records", async (request) => {
    const query = parseRequestPart(paymentImportReviewQuerySchema, request.query, "query");
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;

    if (query.matterId) {
      assertMatterAccess(request.auth, {
        resource: "expense_entry",
        action: "read",
        matterId: query.matterId,
      });
      return {
        records: await repository.listPaymentImportReviewRecords(request.auth.firmId, query),
      };
    }

    if (hasFirmWideLedgerAccess(request.auth.user)) {
      return {
        records: await repository.listPaymentImportReviewRecords(request.auth.firmId, query),
      };
    }

    const records = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          repository.listPaymentImportReviewRecords(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { records };
  });

  server.post("/api/billing/payment-import-review-records", async (request) => {
    const body = parseRequestPart(paymentImportReviewBodySchema, request.body, "body");
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    assertMatterAccess(request.auth, {
      resource: "expense_entry",
      action: "create",
      matterId: body.matterId,
    });
    await assertCandidateLinks({
      repository,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      candidateInvoiceId: body.candidateInvoiceId,
      candidateHostedPaymentRequestId: body.candidateHostedPaymentRequestId,
      candidateManualPaymentId: body.candidateManualPaymentId,
    });

    const now = new Date().toISOString();
    const boundaries = defaultPaymentImportReviewBoundary();
    const normalizedEvidenceFingerprint = buildIdempotencyFingerprint({
      providerLabel: body.providerLabel,
      eventFamily: body.eventFamily,
      eventStatus: body.eventStatus,
      externalEventId: body.externalEventId,
      externalPaymentId: body.externalPaymentId,
      externalDepositId: body.externalDepositId,
      amountCents: body.amountCents,
      currency: body.currency,
      observedAt: body.observedAt,
      candidateInvoiceId: body.candidateInvoiceId,
      candidateHostedPaymentRequestId: body.candidateHostedPaymentRequestId,
      candidateManualPaymentId: body.candidateManualPaymentId,
      duplicateOfRecordId: body.duplicateOfRecordId,
      conflictReason: body.conflictReason,
      boundaries,
    });
    const record: PaymentImportReviewRecord = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      providerLabel: body.providerLabel,
      eventFamily: body.eventFamily,
      eventStatus: body.eventStatus,
      externalEventId: body.externalEventId,
      externalPaymentId: body.externalPaymentId,
      externalDepositId: body.externalDepositId,
      amountCents: body.amountCents,
      currency: body.currency,
      observedAt: body.observedAt,
      importedAt: now,
      importedByUserId: request.auth.user.id,
      candidateInvoiceId: body.candidateInvoiceId,
      candidateHostedPaymentRequestId: body.candidateHostedPaymentRequestId,
      candidateManualPaymentId: body.candidateManualPaymentId,
      duplicateOfRecordId: body.duplicateOfRecordId,
      conflictReason: body.conflictReason,
      reviewState: "needs_review",
      normalizedEvidenceFingerprint,
      boundaries,
      updatedAt: now,
    };

    let created: PaymentImportReviewRecord;
    try {
      created = await repository.createPaymentImportReviewRecord(record);
    } catch (error) {
      rethrowIdempotencyConflict(error);
    }

    await appendRouteAuditEvent(repository, request.auth, {
      action: "payment_import_review_record.created",
      resourceType: "payment_import_review_record",
      resourceId: created.id,
      metadata: compactMetadata({
        matterId: created.matterId,
        paymentImportReviewRecordId: created.id,
        providerLabel: created.providerLabel,
        eventFamily: created.eventFamily,
        eventStatus: created.eventStatus,
        externalEventId: created.externalEventId,
        externalPaymentIdPresent: Boolean(created.externalPaymentId),
        externalDepositIdPresent: Boolean(created.externalDepositId),
        amountCents: created.amountCents,
        currency: created.currency,
        candidateInvoiceId: created.candidateInvoiceId,
        candidateHostedPaymentRequestId: created.candidateHostedPaymentRequestId,
        candidateManualPaymentId: created.candidateManualPaymentId,
        duplicateCuePresent: Boolean(created.duplicateOfRecordId),
        conflictReason: created.conflictReason,
        reviewState: created.reviewState,
        rawProviderPayloadRetained: created.boundaries.rawProviderPayloadRetained,
        invoiceBalanceMutation: created.boundaries.invoiceBalanceMutation,
        settlementAutomation: created.boundaries.settlementAutomation,
        reconciliationMutation: created.boundaries.reconciliationMutation,
        trustPosting: created.boundaries.trustPosting,
      }),
    });
    return { record: created };
  });
}
