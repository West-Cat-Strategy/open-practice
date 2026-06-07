import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  clientTrustBalanceByMatter,
  summarizeTrustTransferLedgerLink,
  trustTransferRequestAvailableBalanceCents,
  type InvoiceRecord,
  type TrustTransferRequestRecord,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireStaffAccess } from "../../http/auth-guards.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertMatterAccess, idParamsSchema } from "./shared.js";

const billingTrustTransferRequestBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1),
    invoiceId: z.string().min(1),
    clientContactId: z.string().min(1).optional(),
    amountCents: z.number().int().positive(),
    reason: z.string().min(1).optional(),
    evidence: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const trustTransferRequestQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(["pending_approval", "approved", "rejected", "linked", "cancelled"]).optional(),
});

const trustTransferRequestReviewBodySchema = z
  .object({
    evidence: z.record(z.string(), z.unknown()).default({}),
  })
  .default({ evidence: {} });

const trustTransferRequestLinkBodySchema = z.object({
  ledgerTransactionId: z.string().min(1),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

function hasEvidence(evidence: Record<string, unknown>): boolean {
  return Object.keys(evidence).length > 0;
}

function assertTrustTransferInvoiceClientMatches(
  invoice: Pick<InvoiceRecord, "clientContactId">,
  clientContactId: string | undefined,
): void {
  if (invoice.clientContactId && clientContactId !== invoice.clientContactId) {
    throw Object.assign(new Error("Trust transfer request client must match the invoice client"), {
      statusCode: 400,
    });
  }
}

function assertTrustTransferAmountWithinInvoiceBalance(
  amountCents: number,
  invoice: Pick<InvoiceRecord, "balanceDueCents">,
): void {
  if (amountCents > invoice.balanceDueCents) {
    throw Object.assign(new Error("Trust transfer amount exceeds invoice balance due"), {
      statusCode: 409,
    });
  }
}

type RegisterBillingTrustTransferRequestRoutesOptions = Pick<ApiRouteDependencies, "repository">;

export function registerBillingTrustTransferRequestRoutes(
  server: FastifyInstance,
  { repository }: RegisterBillingTrustTransferRequestRoutesOptions,
): void {
  server.get("/api/billing/trust-transfer-requests", async (request) => {
    const query = parseRequestPart(trustTransferRequestQuerySchema, request.query, "query");
    if (query.matterId) {
      assertMatterAccess(request.auth, {
        resource: "trust_ledger",
        action: "read",
        matterId: query.matterId,
      });
      return {
        requests: await repository.listTrustTransferRequests(request.auth.firmId, query),
      };
    }

    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;

    if (hasFirmWideLedgerAccess(request.auth.user)) {
      return {
        requests: await repository.listTrustTransferRequests(request.auth.firmId, query),
      };
    }

    const requests = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          repository.listTrustTransferRequests(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { requests };
  });

  server.post("/api/billing/trust-transfer-requests", async (request) => {
    const body = parseRequestPart(billingTrustTransferRequestBodySchema, request.body, "body");
    assertMatterAccess(request.auth, {
      resource: "trust_ledger",
      action: "create",
      matterId: body.matterId,
    });
    const invoice = await repository.getInvoice(request.auth.firmId, body.invoiceId);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    if (invoice.matterId !== body.matterId) {
      throw Object.assign(new Error("Trust transfer invoice must belong to the matter"), {
        statusCode: 400,
      });
    }
    const clientContactId = body.clientContactId ?? invoice.clientContactId;
    assertTrustTransferInvoiceClientMatches(invoice, clientContactId);
    const requestRecord: TrustTransferRequestRecord = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      clientContactId,
      invoiceId: body.invoiceId,
      amountCents: body.amountCents,
      reason: body.reason,
      status: "pending_approval",
      requestedByUserId: request.auth.user.id,
      requestedAt: new Date().toISOString(),
      evidence: body.evidence,
    };
    const created = await repository.createTrustTransferRequest(requestRecord);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "trust_transfer_request.created",
      resourceType: "trust_transfer_request",
      resourceId: created.id,
      metadata: {
        matterId: created.matterId,
        trustTransferRequestId: created.id,
        invoiceId: created.invoiceId,
        status: created.status,
        amountCents: created.amountCents,
      },
    });
    return created;
  });

  server.post("/api/billing/trust-transfer-requests/:id/approve", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(trustTransferRequestReviewBodySchema, request.body, "body");
    const existing = await repository.getTrustTransferRequest(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Trust transfer request was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
      matterId: existing.matterId,
    });
    if (existing.status !== "pending_approval") {
      throw Object.assign(new Error("Only pending trust transfer requests can be approved"), {
        statusCode: 409,
      });
    }
    const invoice = await repository.getInvoice(request.auth.firmId, existing.invoiceId);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    if (invoice.matterId !== existing.matterId) {
      throw Object.assign(new Error("Trust transfer invoice must belong to the matter"), {
        statusCode: 400,
      });
    }
    assertTrustTransferInvoiceClientMatches(invoice, existing.clientContactId);
    assertTrustTransferAmountWithinInvoiceBalance(existing.amountCents, invoice);
    const ledger = await repository.getLedger(request.auth.firmId, { matterId: existing.matterId });
    const availableTrustBalanceCents = trustTransferRequestAvailableBalanceCents({
      request: existing,
      trustBalances: ledger.trustBalances,
    });
    if (existing.amountCents > availableTrustBalanceCents) {
      throw Object.assign(new Error("Trust transfer amount exceeds available trust balance"), {
        statusCode: 409,
      });
    }
    let updated: TrustTransferRequestRecord;
    try {
      updated = await repository.updateTrustTransferRequest(
        request.auth.firmId,
        existing.id,
        {
          status: "approved",
          reviewedByUserId: request.auth.user.id,
          reviewedAt: new Date().toISOString(),
          evidence: body.evidence,
        },
        { expectedStatus: "pending_approval" },
      );
    } catch {
      throw Object.assign(new Error("Trust transfer request status changed"), {
        statusCode: 409,
      });
    }
    await appendRouteAuditEvent(repository, request.auth, {
      action: "trust_transfer_request.approved",
      resourceType: "trust_transfer_request",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        trustTransferRequestId: updated.id,
        invoiceId: updated.invoiceId,
        previousStatus: existing.status,
        status: updated.status,
        amountCents: updated.amountCents,
        invoiceBalanceDueCents: invoice.balanceDueCents,
        availableTrustBalanceCents,
        evidencePresent: hasEvidence(body.evidence),
      },
    });
    return updated;
  });

  server.post("/api/billing/trust-transfer-requests/:id/reject", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(trustTransferRequestReviewBodySchema, request.body, "body");
    const existing = await repository.getTrustTransferRequest(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Trust transfer request was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
      matterId: existing.matterId,
    });
    if (existing.status !== "pending_approval") {
      throw Object.assign(new Error("Only pending trust transfer requests can be rejected"), {
        statusCode: 409,
      });
    }
    let updated: TrustTransferRequestRecord;
    try {
      updated = await repository.updateTrustTransferRequest(
        request.auth.firmId,
        existing.id,
        {
          status: "rejected",
          reviewedByUserId: request.auth.user.id,
          reviewedAt: new Date().toISOString(),
          evidence: body.evidence,
        },
        { expectedStatus: "pending_approval" },
      );
    } catch {
      throw Object.assign(new Error("Trust transfer request status changed"), {
        statusCode: 409,
      });
    }
    await appendRouteAuditEvent(repository, request.auth, {
      action: "trust_transfer_request.rejected",
      resourceType: "trust_transfer_request",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        trustTransferRequestId: updated.id,
        invoiceId: updated.invoiceId,
        previousStatus: existing.status,
        status: updated.status,
        amountCents: updated.amountCents,
        evidencePresent: hasEvidence(body.evidence),
      },
    });
    return updated;
  });

  server.post("/api/billing/trust-transfer-requests/:id/link", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(trustTransferRequestLinkBodySchema, request.body, "body");
    const existing = await repository.getTrustTransferRequest(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Trust transfer request was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
      matterId: existing.matterId,
    });
    if (existing.status !== "approved") {
      throw Object.assign(new Error("Only approved trust transfer requests can be linked"), {
        statusCode: 409,
      });
    }
    if (existing.ledgerTransactionId) {
      throw Object.assign(new Error("Trust transfer request is already linked"), {
        statusCode: 409,
      });
    }
    const invoice = await repository.getInvoice(request.auth.firmId, existing.invoiceId);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    if (invoice.matterId !== existing.matterId) {
      throw Object.assign(new Error("Trust transfer invoice must belong to the matter"), {
        statusCode: 400,
      });
    }
    assertTrustTransferInvoiceClientMatches(invoice, existing.clientContactId);
    assertTrustTransferAmountWithinInvoiceBalance(existing.amountCents, invoice);
    const ledger = await repository.getLedger(request.auth.firmId);
    const linkSummary = summarizeTrustTransferLedgerLink({
      request: existing,
      ledgerTransactionId: body.ledgerTransactionId,
      accounts: ledger.accounts,
      entries: ledger.entries,
    });
    if (!linkSummary.transactionExists) {
      throw Object.assign(new Error("Ledger transaction was not found"), { statusCode: 404 });
    }
    if (!linkSummary.matterMatches) {
      throw Object.assign(new Error("Ledger transaction was not found"), { statusCode: 404 });
    }
    if (!linkSummary.clientMatches) {
      throw Object.assign(new Error("Ledger transaction client must match the request client"), {
        statusCode: 400,
      });
    }
    if (!linkSummary.amountMatches) {
      throw Object.assign(new Error("Ledger transaction amount must match the request amount"), {
        statusCode: 400,
      });
    }
    const alreadyLinked = (await repository.listTrustTransferRequests(request.auth.firmId)).some(
      (candidate) =>
        candidate.id !== existing.id && candidate.ledgerTransactionId === body.ledgerTransactionId,
    );
    if (alreadyLinked) {
      throw Object.assign(
        new Error("Ledger transaction is already linked to a trust transfer request"),
        { statusCode: 409 },
      );
    }
    const trustBalancesBeforeLink = clientTrustBalanceByMatter(
      ledger.entries.filter((entry) => entry.transactionId !== body.ledgerTransactionId),
      ledger.accounts,
    );
    const availableTrustBalanceCents = trustTransferRequestAvailableBalanceCents({
      request: existing,
      trustBalances: trustBalancesBeforeLink,
    });
    if (existing.amountCents > availableTrustBalanceCents) {
      throw Object.assign(new Error("Trust transfer amount exceeds available trust balance"), {
        statusCode: 409,
      });
    }
    let updated: TrustTransferRequestRecord;
    try {
      updated = await repository.updateTrustTransferRequest(
        request.auth.firmId,
        existing.id,
        {
          status: "linked",
          reviewedByUserId: request.auth.user.id,
          reviewedAt: new Date().toISOString(),
          ledgerTransactionId: body.ledgerTransactionId,
          evidence: body.evidence,
        },
        { expectedStatus: "approved", requireLedgerTransactionUnlinked: true },
      );
    } catch {
      throw Object.assign(new Error("Trust transfer request link state changed"), {
        statusCode: 409,
      });
    }
    await appendRouteAuditEvent(repository, request.auth, {
      action: "trust_transfer_request.linked",
      resourceType: "trust_transfer_request",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        trustTransferRequestId: updated.id,
        invoiceId: updated.invoiceId,
        ledgerTransactionId: updated.ledgerTransactionId,
        previousStatus: existing.status,
        status: updated.status,
        amountCents: updated.amountCents,
        invoiceBalanceDueCents: invoice.balanceDueCents,
        availableTrustBalanceCents,
        trustAssetCreditCents: linkSummary.trustAssetCreditCents,
        clientLiabilityDebitCents: linkSummary.clientLiabilityDebitCents,
        evidencePresent: hasEvidence(body.evidence),
      },
    });
    return updated;
  });
}
