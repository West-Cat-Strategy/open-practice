import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildPaymentSettlementReview,
  billDeliveryChannels,
  billDeliveryStatuses,
  billReminderStatuses,
  creditWriteOffPostureStatuses,
  defaultBillDeliveryState,
  defaultBillReminderState,
  defaultCreditWriteOffPosture,
  defaultHostedPaymentProcessorState,
  defaultPaymentPlanPlaceholder,
  hasHostedPaymentRequestEvidence,
  hostedPaymentRequestPath,
  hostedPaymentRequestStatuses,
  paymentPlanPlaceholderCadences,
  paymentPlanPlaceholderStatuses,
  paymentProcessorProviders,
  paymentSettlementEventTypes,
  paymentSettlementPaymentStatuses,
  type HostedPaymentRequestRecord,
  type InvoiceRecord,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireStaffAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertMatterAccess, idParamsSchema } from "./shared.js";

const hostedPaymentRequestQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  invoiceId: z.string().min(1).optional(),
  status: z.enum(hostedPaymentRequestStatuses).optional(),
});

const billDeliveryStateSchema = z
  .object({
    status: z.enum(billDeliveryStatuses),
    channel: z.enum(billDeliveryChannels),
    recipientCount: z.number().int().nonnegative(),
    deliveredAt: z.string().datetime().optional(),
    lastAttemptAt: z.string().datetime().optional(),
    failureSummary: z.string().min(1).max(240).optional(),
  })
  .strict();

const billReminderStateSchema = z
  .object({
    status: z.enum(billReminderStatuses),
    reminderCount: z.number().int().nonnegative(),
    nextReminderAt: z.string().datetime().optional(),
    lastReminderAt: z.string().datetime().optional(),
    pausedReason: z.string().min(1).max(240).optional(),
  })
  .strict();

const paymentPlanPlaceholderSchema = z
  .object({
    status: z.enum(paymentPlanPlaceholderStatuses),
    installmentCount: z.number().int().positive().optional(),
    cadence: z.enum(paymentPlanPlaceholderCadences).optional(),
    startsAt: z.string().datetime().optional(),
    reviewNote: z.string().min(1).max(240).optional(),
    enforcement: z.literal("none").default("none"),
  })
  .strict();

const creditWriteOffPostureSchema = z
  .object({
    status: z.enum(creditWriteOffPostureStatuses),
    amountCents: z.number().int().positive().optional(),
    reason: z.string().min(1).max(240).optional(),
    movement: z.literal("none").default("none"),
  })
  .strict();

const hostedPaymentRequestBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1),
    invoiceId: z.string().min(1),
    clientContactId: z.string().min(1).optional(),
    amountCents: z.number().int().positive().optional(),
    expiresAt: z.string().datetime().optional(),
    delivery: billDeliveryStateSchema.optional(),
    reminder: billReminderStateSchema.optional(),
    paymentPlan: paymentPlanPlaceholderSchema.optional(),
    creditWriteOffPosture: creditWriteOffPostureSchema.optional(),
    evidence: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const hostedPaymentRequestPatchBodySchema = z
  .object({
    status: z.enum(hostedPaymentRequestStatuses).optional(),
    delivery: billDeliveryStateSchema.optional(),
    reminder: billReminderStateSchema.optional(),
    paymentPlan: paymentPlanPlaceholderSchema.optional(),
    creditWriteOffPosture: creditWriteOffPostureSchema.optional(),
    expiresAt: z.string().datetime().optional(),
    evidence: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const paymentSettlementReviewBodySchema = z
  .object({
    provider: z.enum(paymentProcessorProviders),
    eventType: z.enum(paymentSettlementEventTypes),
    paymentStatus: z.enum(paymentSettlementPaymentStatuses),
    externalEventId: z.string().min(1).max(160),
    externalSessionId: z.string().min(1).max(160).optional(),
    amountCents: z.number().int().positive().optional(),
    currency: z.literal("CAD").default("CAD"),
    observedAt: z.string().datetime().optional(),
    evidenceSummary: z.string().min(1).max(240).optional(),
  })
  .strict();

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function assertHostedPaymentRequestInvoice(input: {
  invoice: Pick<InvoiceRecord, "matterId" | "status" | "balanceDueCents">;
  matterId: string;
  amountCents: number;
}): void {
  if (input.invoice.matterId !== input.matterId) {
    throw Object.assign(new Error("Payment request invoice must belong to the matter"), {
      statusCode: 400,
    });
  }
  if (!["issued", "partially_paid"].includes(input.invoice.status)) {
    throw Object.assign(
      new Error("Hosted payment requests can only be created for issued invoices"),
      { statusCode: 409 },
    );
  }
  if (input.invoice.balanceDueCents <= 0) {
    throw Object.assign(new Error("Invoice has no balance due for a payment request"), {
      statusCode: 409,
    });
  }
  if (input.amountCents > input.invoice.balanceDueCents) {
    throw Object.assign(new Error("Payment request amount exceeds invoice balance due"), {
      statusCode: 409,
    });
  }
}

function checkoutReturnUrl(input: {
  publicWebBaseUrl: string;
  paymentRequestId: string;
  outcome: "success" | "cancelled";
}): string {
  const url = new URL("/", input.publicWebBaseUrl);
  url.searchParams.set("paymentRequestId", input.paymentRequestId);
  url.searchParams.set("stripeCheckout", input.outcome);
  if (input.outcome === "success") {
    url.searchParams.set("stripeSessionId", "{CHECKOUT_SESSION_ID}");
  }
  return url.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");
}

function checkoutSessionStillUsable(input: {
  checkoutUrl?: string;
  expiresAt?: string;
  now: string;
}): boolean {
  return Boolean(
    input.checkoutUrl && (!input.expiresAt || Date.parse(input.expiresAt) > Date.parse(input.now)),
  );
}

type RegisterBillingPaymentRequestRoutesOptions = Pick<
  ApiRouteDependencies,
  "repository" | "paymentProcessorProvider" | "publicWebBaseUrl"
>;

export function registerBillingPaymentRequestRoutes(
  server: FastifyInstance,
  {
    repository,
    paymentProcessorProvider,
    publicWebBaseUrl,
  }: RegisterBillingPaymentRequestRoutesOptions,
): void {
  server.get("/api/billing/payment-requests", async (request) => {
    const query = parseRequestPart(hostedPaymentRequestQuerySchema, request.query, "query");
    if (query.matterId) {
      assertMatterAccess(request.auth, {
        resource: "expense_entry",
        action: "read",
        matterId: query.matterId,
      });
      return {
        requests: await repository.listHostedPaymentRequests(request.auth.firmId, query),
      };
    }

    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;

    if (hasFirmWideLedgerAccess(request.auth.user)) {
      return {
        requests: await repository.listHostedPaymentRequests(request.auth.firmId, query),
      };
    }

    const requests = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          repository.listHostedPaymentRequests(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { requests };
  });

  server.post("/api/billing/payment-requests", async (request) => {
    const body = parseRequestPart(hostedPaymentRequestBodySchema, request.body, "body");
    assertMatterAccess(request.auth, {
      resource: "expense_entry",
      action: "create",
      matterId: body.matterId,
    });
    const invoice = await repository.getInvoice(request.auth.firmId, body.invoiceId);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    const amountCents = body.amountCents ?? invoice.balanceDueCents;
    assertHostedPaymentRequestInvoice({ invoice, matterId: body.matterId, amountCents });
    if (
      invoice.clientContactId &&
      body.clientContactId &&
      invoice.clientContactId !== body.clientContactId
    ) {
      throw Object.assign(new Error("Payment request client must match the invoice client"), {
        statusCode: 400,
      });
    }
    const now = new Date().toISOString();
    const requestId = body.id ?? crypto.randomUUID();
    const paymentRequest: HostedPaymentRequestRecord = {
      id: requestId,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      invoiceId: body.invoiceId,
      clientContactId: body.clientContactId ?? invoice.clientContactId,
      status: "ready_to_send",
      amountCents,
      currency: "CAD",
      hostedPath: hostedPaymentRequestPath(requestId),
      delivery: body.delivery ?? defaultBillDeliveryState(),
      reminder: body.reminder ?? defaultBillReminderState(),
      paymentPlan: body.paymentPlan ?? defaultPaymentPlanPlaceholder(),
      creditWriteOffPosture: body.creditWriteOffPosture ?? defaultCreditWriteOffPosture(),
      processor: defaultHostedPaymentProcessorState(),
      evidence: body.evidence,
      createdByUserId: request.auth.user.id,
      createdAt: now,
      updatedAt: now,
      expiresAt: body.expiresAt,
    };
    const created = await repository.createHostedPaymentRequest(paymentRequest);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "hosted_payment_request.created",
      resourceType: "hosted_payment_request",
      resourceId: created.id,
      metadata: {
        matterId: created.matterId,
        paymentRequestId: created.id,
        invoiceId: created.invoiceId,
        status: created.status,
        amountCents: created.amountCents,
        deliveryStatus: created.delivery.status,
        reminderStatus: created.reminder.status,
        paymentPlanStatus: created.paymentPlan.status,
        creditWriteOffStatus: created.creditWriteOffPosture.status,
        evidencePresent: hasHostedPaymentRequestEvidence(created),
      },
    });
    return created;
  });

  server.patch("/api/billing/payment-requests/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(hostedPaymentRequestPatchBodySchema, request.body, "body");
    const existing = await repository.getHostedPaymentRequest(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Hosted payment request was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "expense_entry",
      action: "update",
      matterId: existing.matterId,
    });
    const now = new Date().toISOString();
    const updated = await repository.updateHostedPaymentRequest(request.auth.firmId, params.id, {
      ...body,
      updatedAt: now,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "hosted_payment_request.state_updated",
      resourceType: "hosted_payment_request",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        paymentRequestId: updated.id,
        invoiceId: updated.invoiceId,
        previousStatus: existing.status,
        status: updated.status,
        deliveryStatus: updated.delivery.status,
        reminderStatus: updated.reminder.status,
        paymentPlanStatus: updated.paymentPlan.status,
        creditWriteOffStatus: updated.creditWriteOffPosture.status,
        evidencePresent: hasHostedPaymentRequestEvidence(updated),
      },
    });
    return updated;
  });

  server.post("/api/billing/payment-requests/:id/checkout-session", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    if (!paymentProcessorProvider) {
      throw new ApiHttpError(
        503,
        "PAYMENT_PROCESSOR_NOT_CONFIGURED",
        "Payment processor provider is not configured",
      );
    }
    const existing = await repository.getHostedPaymentRequest(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Hosted payment request was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "expense_entry",
      action: "update",
      matterId: existing.matterId,
    });
    if (["cancelled", "expired"].includes(existing.status)) {
      throw Object.assign(new Error("Hosted payment request is closed"), { statusCode: 409 });
    }
    const invoice = await repository.getInvoice(request.auth.firmId, existing.invoiceId);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    assertHostedPaymentRequestInvoice({
      invoice,
      matterId: existing.matterId,
      amountCents: existing.amountCents,
    });

    const now = new Date().toISOString();
    if (
      existing.processor.status === "checkout_session_created" &&
      checkoutSessionStillUsable({
        checkoutUrl: existing.processor.checkoutUrl,
        expiresAt: existing.processor.expiresAt,
        now,
      })
    ) {
      return {
        request: existing,
        checkout: {
          provider: existing.processor.provider,
          externalSessionId: existing.processor.externalSessionId,
          checkoutUrl: existing.processor.checkoutUrl,
          expiresAt: existing.processor.expiresAt,
          reused: true,
        },
      };
    }

    const baseUrl = publicWebBaseUrl ?? "http://localhost:3000";
    const checkout = await paymentProcessorProvider.createCheckoutSession({
      firmId: request.auth.firmId,
      matterId: existing.matterId,
      invoiceId: existing.invoiceId,
      hostedPaymentRequestId: existing.id,
      amountCents: existing.amountCents,
      currency: existing.currency,
      description: `Open Practice invoice ${invoice.invoiceNumber}`,
      successUrl: checkoutReturnUrl({
        publicWebBaseUrl: baseUrl,
        paymentRequestId: existing.id,
        outcome: "success",
      }),
      cancelUrl: checkoutReturnUrl({
        publicWebBaseUrl: baseUrl,
        paymentRequestId: existing.id,
        outcome: "cancelled",
      }),
      idempotencyKey: `hosted-payment-request:${request.auth.firmId}:${existing.id}`,
      metadata: {
        firmId: request.auth.firmId,
        matterId: existing.matterId,
        invoiceId: existing.invoiceId,
        hostedPaymentRequestId: existing.id,
      },
    });
    const processor = {
      status: "checkout_session_created" as const,
      provider: checkout.provider,
      externalSessionId: checkout.externalSessionId,
      checkoutUrl: checkout.checkoutUrl,
      createdAt: now,
      expiresAt: checkout.expiresAt,
    };
    const updated = await repository.updateHostedPaymentRequest(request.auth.firmId, existing.id, {
      processor,
      evidence: {
        ...(existing.evidence ?? {}),
        paymentProcessor: {
          provider: checkout.provider,
          checkoutSessionId: checkout.externalSessionId,
          checkoutUrlPresent: Boolean(checkout.checkoutUrl),
          createdAt: now,
          ...checkout.evidence,
        },
      },
      updatedAt: now,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "hosted_payment_request.checkout_session_created",
      resourceType: "hosted_payment_request",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        paymentRequestId: updated.id,
        invoiceId: updated.invoiceId,
        provider: checkout.provider,
        checkoutSessionId: checkout.externalSessionId,
        checkoutUrlPresent: Boolean(checkout.checkoutUrl),
        amountCents: updated.amountCents,
        status: updated.status,
        processorStatus: updated.processor.status,
      },
    });
    return {
      request: updated,
      checkout: {
        provider: checkout.provider,
        externalSessionId: checkout.externalSessionId,
        checkoutUrl: checkout.checkoutUrl,
        expiresAt: checkout.expiresAt,
        reused: false,
      },
    };
  });

  server.post("/api/billing/payment-requests/:id/settlement-events", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(paymentSettlementReviewBodySchema, request.body, "body");
    const existing = await repository.getHostedPaymentRequest(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Hosted payment request was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "expense_entry",
      action: "update",
      matterId: existing.matterId,
    });
    if (
      body.externalSessionId &&
      existing.processor.externalSessionId &&
      body.externalSessionId !== existing.processor.externalSessionId
    ) {
      throw new ApiHttpError(
        409,
        "PAYMENT_SETTLEMENT_SESSION_MISMATCH",
        "Payment settlement event does not match the hosted payment request session",
      );
    }

    const now = new Date().toISOString();
    const settlementReview = buildPaymentSettlementReview({
      provider: body.provider,
      eventType: body.eventType,
      paymentStatus: body.paymentStatus,
      externalEventId: body.externalEventId,
      externalSessionId: body.externalSessionId,
      amountCents: body.amountCents,
      currency: body.currency,
      observedAt: body.observedAt,
      receivedAt: now,
    });
    const updated = await repository.updateHostedPaymentRequest(request.auth.firmId, existing.id, {
      processor: {
        ...existing.processor,
        provider: existing.processor.provider ?? body.provider,
        settlementReview,
      },
      evidence: {
        ...(existing.evidence ?? {}),
        paymentSettlementReview: {
          provider: body.provider,
          eventType: body.eventType,
          paymentStatus: body.paymentStatus,
          externalEventId: body.externalEventId,
          externalSessionIdPresent: Boolean(body.externalSessionId),
          amountCents: body.amountCents,
          currency: body.currency,
          observedAt: body.observedAt,
          receivedAt: now,
          evidenceSummaryPresent: Boolean(body.evidenceSummary),
          signatureVerified: false,
          rawWebhookBodyStored: false,
          automaticInvoiceMutation: false,
          automaticReconciliation: false,
          trustPosting: false,
        },
      },
      updatedAt: now,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "hosted_payment_request.settlement_event_reviewed",
      resourceType: "hosted_payment_request",
      resourceId: updated.id,
      metadata: compactMetadata({
        matterId: updated.matterId,
        paymentRequestId: updated.id,
        invoiceId: updated.invoiceId,
        provider: body.provider,
        eventType: body.eventType,
        paymentStatus: body.paymentStatus,
        externalEventId: body.externalEventId,
        externalSessionIdPresent: Boolean(body.externalSessionId),
        amountCents: body.amountCents,
        currency: body.currency,
        evidenceSummaryPresent: Boolean(body.evidenceSummary),
        invoiceBalanceMutation: settlementReview.invoiceBalanceMutation,
        reconciliationMutation: settlementReview.reconciliationMutation,
        trustPosting: settlementReview.trustPosting,
        rawWebhookBodyStored: settlementReview.webhookBoundary.rawWebhookBodyStored,
      }),
    });
    return { request: updated, settlementReview };
  });
}
