import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest, ManualPaymentRecord } from "@open-practice/domain";
import {
  hasFirmWideLedgerAccess,
  requireAccess,
  requireStaffAccess,
} from "../../http/auth-guards.js";
import { requireFreshAuth } from "../../http/fresh-auth.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import { orderByMatterIds } from "./shared.js";

const paymentBodySchema = z.object({
  id: z.string().min(1).optional(),
  matterId: z.string().min(1),
  invoiceId: z.string().min(1),
  clientContactId: z.string().min(1).optional(),
  amountCents: z.number().int().positive(),
  receivedAt: z.string().datetime().optional(),
  method: z.enum(["cash", "cheque", "card", "eft", "other"]).default("other"),
  reference: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const paymentQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  invoiceId: z.string().min(1).optional(),
});

const paymentParamsSchema = z.object({
  paymentId: z.string().min(1),
});

const reconcilePaymentBodySchema = z.object({
  reconciledAt: z.string().datetime().optional(),
  notes: z.string().min(1).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

function assertMatterAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function hasEvidence(evidence: Record<string, unknown>): boolean {
  return Object.keys(evidence).length > 0;
}

export function registerBillingPaymentRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
  server.get("/api/payments", async (request) => {
    const query = parseRequestPart(paymentQuerySchema, request.query, "query");
    if (query.matterId) {
      assertMatterAccess(request.auth, {
        resource: "expense_entry",
        action: "read",
        matterId: query.matterId,
      });
      return { payments: await repository.listPayments(request.auth.firmId, query) };
    }

    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;

    if (hasFirmWideLedgerAccess(request.auth.user)) {
      return { payments: await repository.listPayments(request.auth.firmId, query) };
    }

    const assignedMatterIds = request.auth.user.assignedMatterIds;
    const payments = await repository.listPayments(request.auth.firmId, {
      ...query,
      matterIds: assignedMatterIds,
    });
    return { payments: orderByMatterIds(payments, assignedMatterIds) };
  });

  server.post("/api/payments", async (request) => {
    const body = parseRequestPart(paymentBodySchema, request.body, "body");
    assertMatterAccess(request.auth, {
      resource: "expense_entry",
      action: "create",
      matterId: body.matterId,
    });
    const invoice = await repository.getInvoice(request.auth.firmId, body.invoiceId);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    if (invoice.matterId !== body.matterId) {
      throw Object.assign(new Error("Payment invoice must belong to the matter"), {
        statusCode: 400,
      });
    }
    const now = new Date().toISOString();
    const payment: ManualPaymentRecord = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      invoiceId: body.invoiceId,
      clientContactId: body.clientContactId,
      amountCents: body.amountCents,
      receivedAt: body.receivedAt ?? now,
      method: body.method,
      reference: body.reference,
      status: "pending_reconciliation",
      receivedByUserId: request.auth.user.id,
      notes: body.notes,
      evidence: body.evidence,
    };
    const created = await repository.createPayment({ payment, allocations: [] });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "manual_payment.created",
      resourceType: "manual_payment",
      resourceId: created.id,
      metadata: {
        matterId: created.matterId,
        paymentId: created.id,
        invoiceId: created.invoiceId,
        status: created.status,
        amountCents: created.amountCents,
        allocationCount: created.allocations.length,
        evidencePresent: hasEvidence(created.evidence ?? {}),
      },
    });
    return created;
  });

  server.post("/api/payments/:paymentId/reconcile", async (request) => {
    const params = parseRequestPart(paymentParamsSchema, request.params, "params");
    const body = parseRequestPart(reconcilePaymentBodySchema, request.body, "body");
    const existing = (await repository.listPayments(request.auth.firmId)).find(
      (candidate) => candidate.id === params.paymentId,
    );
    if (!existing) {
      throw Object.assign(new Error("Manual payment was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "expense_entry",
      action: "create",
      matterId: existing.matterId,
    });
    if (existing.status !== "pending_reconciliation") {
      throw Object.assign(new Error("Manual payment is not pending reconciliation"), {
        statusCode: 409,
      });
    }
    if (!existing.invoiceId) {
      throw Object.assign(new Error("Manual payment invoice was not found"), { statusCode: 404 });
    }
    const invoice = await repository.getInvoice(request.auth.firmId, existing.invoiceId);
    if (!invoice) {
      throw Object.assign(new Error("Manual payment invoice was not found"), { statusCode: 404 });
    }
    if (invoice.matterId !== existing.matterId) {
      throw Object.assign(new Error("Manual payment invoice must belong to the payment matter"), {
        statusCode: 400,
      });
    }
    if (existing.amountCents > invoice.balanceDueCents) {
      throw Object.assign(new Error("Payment allocation exceeds invoice balance"), {
        statusCode: 409,
      });
    }
    requireFreshAuth(request.auth);
    const reconciled = await repository.reconcilePayment({
      firmId: request.auth.firmId,
      paymentId: existing.id,
      reconciledByUserId: request.auth.user.id,
      reconciledAt: body.reconciledAt ?? new Date().toISOString(),
      notes: body.notes,
      evidence: body.evidence,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "manual_payment.reconciled",
      resourceType: "manual_payment",
      resourceId: reconciled.id,
      metadata: {
        matterId: reconciled.matterId,
        paymentId: reconciled.id,
        invoiceId: reconciled.invoiceId,
        status: reconciled.status,
        amountCents: reconciled.amountCents,
        allocationCount: reconciled.allocations.length,
        evidencePresent: hasEvidence(reconciled.reconciliationEvidence ?? {}),
      },
    });
    return reconciled;
  });
}
