import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  defaultPaymentImportDepositMatchReviewBoundary,
  defaultPaymentImportRefundChargebackReviewBoundary,
  defaultPaymentImportReviewBoundary,
  paymentImportDepositMatchReviewDecisions,
  paymentImportDepositMatchReviewReasons,
  paymentImportEventFamilies,
  paymentImportReviewConflictReasons,
  paymentImportRefundChargebackReviewDecisionMatchesCue,
  paymentImportRefundChargebackReviewDecisions,
  paymentImportRefundChargebackReviewCue,
  paymentImportRefundChargebackReviewReasons,
  type ManualPaymentRecord,
  type PaymentImportDepositMatchReviewRecord,
  type PaymentImportRefundChargebackReviewRecord,
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

const paymentImportReviewRecordParamsSchema = z.object({
  recordId: z.string().min(1),
});

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

const depositMatchReviewBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    decision: z.enum(paymentImportDepositMatchReviewDecisions),
    reason: z.enum(paymentImportDepositMatchReviewReasons),
    idempotencyKey: safeExternalIdSchema,
  })
  .strict()
  .superRefine((body, context) => {
    if (body.decision === "candidate_supported" && body.reason !== "candidate_evidence_matches") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "candidate_supported requires candidate_evidence_matches",
      });
    }
    if (body.decision !== "candidate_supported" && body.reason === "candidate_evidence_matches") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "candidate_evidence_matches is only valid for candidate_supported",
      });
    }
  });

const refundChargebackReviewBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    decision: z.enum(paymentImportRefundChargebackReviewDecisions),
    reason: z.enum(paymentImportRefundChargebackReviewReasons),
    idempotencyKey: safeExternalIdSchema,
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
}): Promise<{ candidateManualPayment?: ManualPaymentRecord }> {
  let candidateInvoiceMatterId: string | undefined;
  let candidateInvoiceId = input.candidateInvoiceId;
  let candidateManualPayment: ManualPaymentRecord | undefined;
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
    candidateManualPayment = manualPayment;
  }

  if (candidateInvoiceMatterId && candidateInvoiceMatterId !== input.matterId) {
    throw new ApiHttpError(
      409,
      "PAYMENT_IMPORT_CANDIDATE_MATTER_MISMATCH",
      "Payment import candidate links must stay within the review matter",
    );
  }
  return { candidateManualPayment };
}

function assertDepositMatchReviewRecord(record: PaymentImportReviewRecord): void {
  if (record.eventFamily !== "deposit") {
    throw new ApiHttpError(
      409,
      "PAYMENT_IMPORT_DEPOSIT_MATCH_REVIEW_UNSUPPORTED",
      "Deposit match reviews require normalized deposit evidence",
    );
  }
  if (!record.candidateManualPaymentId) {
    throw new ApiHttpError(
      409,
      "PAYMENT_IMPORT_DEPOSIT_MATCH_CANDIDATE_REQUIRED",
      "Deposit match reviews require a candidate manual payment",
    );
  }
}

function assertRefundChargebackReviewRecord(
  record: PaymentImportReviewRecord,
): NonNullable<ReturnType<typeof paymentImportRefundChargebackReviewCue>> {
  const cue = paymentImportRefundChargebackReviewCue(record);
  if (!cue) {
    throw new ApiHttpError(
      409,
      "PAYMENT_IMPORT_REFUND_CHARGEBACK_REVIEW_UNSUPPORTED",
      "Refund and chargeback reviews require normalized refund or chargeback payment evidence",
    );
  }
  return cue;
}

function assertCandidateSupportedAllowed(input: {
  record: PaymentImportReviewRecord;
  manualPayment: ManualPaymentRecord;
}): void {
  if (input.record.duplicateOfRecordId || input.record.conflictReason) {
    throw new ApiHttpError(
      409,
      "PAYMENT_IMPORT_DEPOSIT_MATCH_CONFLICT_REVIEW_REQUIRED",
      "Candidate support is blocked while duplicate or conflict cues remain active",
    );
  }
  if (input.manualPayment.status !== "pending_reconciliation") {
    throw new ApiHttpError(
      409,
      "PAYMENT_IMPORT_DEPOSIT_MATCH_PAYMENT_NOT_PENDING",
      "Candidate support requires a pending manual payment",
    );
  }
  if (input.manualPayment.amountCents !== input.record.amountCents) {
    throw new ApiHttpError(
      409,
      "PAYMENT_IMPORT_DEPOSIT_MATCH_AMOUNT_MISMATCH",
      "Candidate support requires matching import and manual-payment amounts",
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

  server.get(
    "/api/billing/payment-import-review-records/:recordId/deposit-match-reviews",
    async (request) => {
      const params = parseRequestPart(
        paymentImportReviewRecordParamsSchema,
        request.params,
        "params",
      );
      const staffAccess = requireStaffAccess(request.auth);
      if (!staffAccess.ok) throw staffAccess.error;

      const record = await repository.getPaymentImportReviewRecord(
        request.auth.firmId,
        params.recordId,
      );
      if (!record) {
        throw new ApiHttpError(
          404,
          "PAYMENT_IMPORT_REVIEW_RECORD_NOT_FOUND",
          "Payment import review record was not found",
        );
      }
      assertMatterAccess(request.auth, {
        resource: "expense_entry",
        action: "read",
        matterId: record.matterId,
      });
      return {
        reviewOnly: true,
        reviews: await repository.listPaymentImportDepositMatchReviews(request.auth.firmId, {
          paymentImportReviewRecordId: record.id,
        }),
      };
    },
  );

  server.get(
    "/api/billing/payment-import-review-records/:recordId/refund-chargeback-reviews",
    async (request) => {
      const params = parseRequestPart(
        paymentImportReviewRecordParamsSchema,
        request.params,
        "params",
      );
      const staffAccess = requireStaffAccess(request.auth);
      if (!staffAccess.ok) throw staffAccess.error;

      const record = await repository.getPaymentImportReviewRecord(
        request.auth.firmId,
        params.recordId,
      );
      if (!record) {
        throw new ApiHttpError(
          404,
          "PAYMENT_IMPORT_REVIEW_RECORD_NOT_FOUND",
          "Payment import review record was not found",
        );
      }
      assertMatterAccess(request.auth, {
        resource: "expense_entry",
        action: "read",
        matterId: record.matterId,
      });
      assertRefundChargebackReviewRecord(record);
      return {
        reviewOnly: true,
        reviews: await repository.listPaymentImportRefundChargebackReviews(request.auth.firmId, {
          paymentImportReviewRecordId: record.id,
        }),
      };
    },
  );

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

    const refundChargebackReviewCue = paymentImportRefundChargebackReviewCue(created);
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
        refundChargebackReviewCueCategory: refundChargebackReviewCue?.category,
        refundChargebackReviewCueStatus: refundChargebackReviewCue?.status,
        refundChargebackReviewAction: refundChargebackReviewCue?.reviewAction,
        rawProviderPayloadRetained: created.boundaries.rawProviderPayloadRetained,
        invoiceBalanceMutation: created.boundaries.invoiceBalanceMutation,
        settlementAutomation: created.boundaries.settlementAutomation,
        reconciliationMutation: created.boundaries.reconciliationMutation,
        refundHandling: created.boundaries.refundHandling,
        chargebackHandling: created.boundaries.chargebackHandling,
        trustPosting: created.boundaries.trustPosting,
        providerCommand: created.boundaries.providerCommand,
        clientNotification: created.boundaries.clientNotification,
      }),
    });
    return { record: created };
  });

  server.post(
    "/api/billing/payment-import-review-records/:recordId/deposit-match-reviews",
    async (request) => {
      const params = parseRequestPart(
        paymentImportReviewRecordParamsSchema,
        request.params,
        "params",
      );
      const body = parseRequestPart(depositMatchReviewBodySchema, request.body, "body");
      const staffAccess = requireStaffAccess(request.auth);
      if (!staffAccess.ok) throw staffAccess.error;

      const importRecord = await repository.getPaymentImportReviewRecord(
        request.auth.firmId,
        params.recordId,
      );
      if (!importRecord) {
        throw new ApiHttpError(
          404,
          "PAYMENT_IMPORT_REVIEW_RECORD_NOT_FOUND",
          "Payment import review record was not found",
        );
      }
      assertMatterAccess(request.auth, {
        resource: "expense_entry",
        action: "create",
        matterId: importRecord.matterId,
      });
      assertDepositMatchReviewRecord(importRecord);
      const { candidateManualPayment } = await assertCandidateLinks({
        repository,
        firmId: request.auth.firmId,
        matterId: importRecord.matterId,
        candidateInvoiceId: importRecord.candidateInvoiceId,
        candidateHostedPaymentRequestId: importRecord.candidateHostedPaymentRequestId,
        candidateManualPaymentId: importRecord.candidateManualPaymentId,
      });
      if (!candidateManualPayment) {
        throw new ApiHttpError(
          404,
          "CANDIDATE_MANUAL_PAYMENT_NOT_FOUND",
          "Candidate manual payment was not found",
        );
      }
      if (body.decision === "candidate_supported") {
        assertCandidateSupportedAllowed({
          record: importRecord,
          manualPayment: candidateManualPayment,
        });
      }

      const now = new Date().toISOString();
      const boundaries = defaultPaymentImportDepositMatchReviewBoundary();
      const decisionFingerprint = buildIdempotencyFingerprint({
        paymentImportReviewRecordId: importRecord.id,
        candidateManualPaymentId: candidateManualPayment.id,
        candidateInvoiceId: importRecord.candidateInvoiceId,
        decision: body.decision,
        reason: body.reason,
        importAmountCents: importRecord.amountCents,
        manualPaymentAmountCents: candidateManualPayment.amountCents,
        currency: importRecord.currency,
        candidateManualPaymentStatus: candidateManualPayment.status,
        reviewerEvidencePresent: true,
        boundaries,
      });
      const review: PaymentImportDepositMatchReviewRecord = {
        id: body.id ?? crypto.randomUUID(),
        firmId: request.auth.firmId,
        matterId: importRecord.matterId,
        paymentImportReviewRecordId: importRecord.id,
        candidateManualPaymentId: candidateManualPayment.id,
        candidateInvoiceId: importRecord.candidateInvoiceId,
        decision: body.decision,
        reason: body.reason,
        importAmountCents: importRecord.amountCents,
        manualPaymentAmountCents: candidateManualPayment.amountCents,
        currency: importRecord.currency,
        candidateManualPaymentStatus: candidateManualPayment.status,
        reviewerEvidencePresent: true,
        idempotencyKey: body.idempotencyKey,
        decisionFingerprint,
        boundaries,
        reviewedByUserId: request.auth.user.id,
        reviewedAt: now,
        createdAt: now,
      };

      let created: PaymentImportDepositMatchReviewRecord;
      try {
        created = await repository.createPaymentImportDepositMatchReview(review);
      } catch (error) {
        rethrowIdempotencyConflict(error);
      }

      await appendRouteAuditEvent(repository, request.auth, {
        action: "payment_import_deposit_match_review.recorded",
        resourceType: "payment_import_deposit_match_review",
        resourceId: created.id,
        metadata: compactMetadata({
          matterId: created.matterId,
          paymentImportDepositMatchReviewId: created.id,
          paymentImportReviewRecordId: created.paymentImportReviewRecordId,
          candidateManualPaymentId: created.candidateManualPaymentId,
          candidateInvoiceId: created.candidateInvoiceId,
          decision: created.decision,
          reason: created.reason,
          importAmountCents: created.importAmountCents,
          manualPaymentAmountCents: created.manualPaymentAmountCents,
          currency: created.currency,
          candidateManualPaymentStatus: created.candidateManualPaymentStatus,
          reviewerEvidencePresent: created.reviewerEvidencePresent,
          idempotencyKeyPresent: Boolean(created.idempotencyKey),
          rawProviderPayloadRetained: created.boundaries.rawProviderPayloadRetained,
          invoiceBalanceMutation: created.boundaries.invoiceBalanceMutation,
          settlementAutomation: created.boundaries.settlementAutomation,
          reconciliationMutation: created.boundaries.reconciliationMutation,
          refundHandling: created.boundaries.refundHandling,
          chargebackHandling: created.boundaries.chargebackHandling,
          trustPosting: created.boundaries.trustPosting,
          providerCommand: created.boundaries.providerCommand,
          clientNotification: created.boundaries.clientNotification,
          depositMatching: created.boundaries.depositMatching,
        }),
      });
      return { review: created };
    },
  );

  server.post(
    "/api/billing/payment-import-review-records/:recordId/refund-chargeback-reviews",
    async (request) => {
      const params = parseRequestPart(
        paymentImportReviewRecordParamsSchema,
        request.params,
        "params",
      );
      const body = parseRequestPart(refundChargebackReviewBodySchema, request.body, "body");
      const staffAccess = requireStaffAccess(request.auth);
      if (!staffAccess.ok) throw staffAccess.error;

      const importRecord = await repository.getPaymentImportReviewRecord(
        request.auth.firmId,
        params.recordId,
      );
      if (!importRecord) {
        throw new ApiHttpError(
          404,
          "PAYMENT_IMPORT_REVIEW_RECORD_NOT_FOUND",
          "Payment import review record was not found",
        );
      }
      assertMatterAccess(request.auth, {
        resource: "expense_entry",
        action: "create",
        matterId: importRecord.matterId,
      });
      const cue = assertRefundChargebackReviewRecord(importRecord);

      const now = new Date().toISOString();
      const boundaries = defaultPaymentImportRefundChargebackReviewBoundary();
      const decisionFingerprint = buildIdempotencyFingerprint({
        paymentImportReviewRecordId: importRecord.id,
        category: cue.category,
        decision: body.decision,
        reason: body.reason,
        reviewerEvidencePresent: true,
        boundaries,
      });
      const review: PaymentImportRefundChargebackReviewRecord = {
        id: body.id ?? crypto.randomUUID(),
        firmId: request.auth.firmId,
        matterId: importRecord.matterId,
        paymentImportReviewRecordId: importRecord.id,
        category: cue.category,
        decision: body.decision,
        reason: body.reason,
        reviewerEvidencePresent: true,
        idempotencyKey: body.idempotencyKey,
        decisionFingerprint,
        boundaries,
        reviewedByUserId: request.auth.user.id,
        reviewedAt: now,
        createdAt: now,
      };
      if (!paymentImportRefundChargebackReviewDecisionMatchesCue(review)) {
        throw new ApiHttpError(
          409,
          "PAYMENT_IMPORT_REFUND_CHARGEBACK_REVIEW_REASON_MISMATCH",
          "Confirmed refund and chargeback review decisions must match the observed cue category",
        );
      }

      let created: PaymentImportRefundChargebackReviewRecord;
      try {
        created = await repository.createPaymentImportRefundChargebackReview(review);
      } catch (error) {
        rethrowIdempotencyConflict(error);
      }

      await appendRouteAuditEvent(repository, request.auth, {
        action: "payment_import_refund_chargeback_review.recorded",
        resourceType: "payment_import_refund_chargeback_review",
        resourceId: created.id,
        metadata: compactMetadata({
          matterId: created.matterId,
          paymentImportRefundChargebackReviewId: created.id,
          paymentImportReviewRecordId: created.paymentImportReviewRecordId,
          category: created.category,
          decision: created.decision,
          reason: created.reason,
          reviewerEvidencePresent: created.reviewerEvidencePresent,
          idempotencyKeyPresent: Boolean(created.idempotencyKey),
          rawProviderPayloadRetained: created.boundaries.rawProviderPayloadRetained,
          refundArtifactRetained: created.boundaries.refundArtifactRetained,
          disputeArtifactRetained: created.boundaries.disputeArtifactRetained,
          invoiceBalanceMutation: created.boundaries.invoiceBalanceMutation,
          ledgerReversal: created.boundaries.ledgerReversal,
          trustPosting: created.boundaries.trustPosting,
          providerCommand: created.boundaries.providerCommand,
          clientNotification: created.boundaries.clientNotification,
          fundsMovement: created.boundaries.fundsMovement,
          refundHandling: created.boundaries.refundHandling,
          chargebackHandling: created.boundaries.chargebackHandling,
        }),
      });
      return { review: created };
    },
  );
}
