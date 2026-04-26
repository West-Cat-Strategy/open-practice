import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AccessRequest,
  LedgerReconciliationRecord,
  LedgerTransaction,
  LedgerTransactionApprovalRecord,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";

const ledgerPostBodySchema = z.object({
  id: z.string().min(1),
  idempotencyKey: z.string().min(1),
  requestFingerprint: z.string().min(1).optional(),
  postedAt: z.string().datetime().optional(),
  reversesTransactionId: z.string().min(1).optional(),
  entries: z.array(
    z.object({
      firmId: z.string().min(1).optional(),
      matterId: z.string().min(1),
      clientId: z.string().min(1),
      accountId: z.string().min(1),
      debitCents: z.number().int().nonnegative(),
      creditCents: z.number().int().nonnegative(),
      memo: z.string().min(1),
      reversingTransactionId: z.string().min(1).optional(),
    }),
  ),
});

const ledgerQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

const ledgerApprovalBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().min(1).optional(),
  decidedAt: z.string().datetime().optional(),
});

const ledgerReconciliationBodySchema = z.object({
  accountId: z.string().min(1),
  statementPeriodStart: z.string().datetime(),
  statementPeriodEnd: z.string().datetime(),
  expectedBalanceCents: z.number().int(),
  actualBalanceCents: z.number().int(),
  status: z.enum(["draft", "matched", "exception", "reviewed"]).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function assertLedgerAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function registerLedgerRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/ledger", async (request) => {
    const query = parseRequestPart(ledgerQuerySchema, request.query, "query");
    if (!query.matterId && !hasFirmWideLedgerAccess(request.auth.user)) {
      throw Object.assign(new Error("matterId is required for matter-scoped ledger access"), {
        statusCode: 400,
      });
    }
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "read",
      matterId: query.matterId,
    });
    return repository.getLedger(request.auth.firmId, query);
  });

  server.post("/api/ledger/transactions", async (request) => {
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "create",
      matterId: request.auth.user.assignedMatterIds[0],
    });
    const body = parseRequestPart(ledgerPostBodySchema, request.body, "body");
    const transaction: LedgerTransaction = {
      id: body.id,
      firmId: request.auth.firmId,
      idempotencyKey: body.idempotencyKey,
      requestFingerprint: body.requestFingerprint,
      postedByUserId: request.auth.user.id,
      postedAt: body.postedAt ?? new Date().toISOString(),
      reversesTransactionId: body.reversesTransactionId,
      entries: body.entries.map((entry) => ({
        ...entry,
        firmId: entry.firmId ?? request.auth.firmId,
      })),
    };
    await repository.validateLedgerTransactionScope({
      user: request.auth.user,
      transaction,
    });
    return repository.postLedgerTransaction(transaction);
  });

  server.post("/api/ledger/transactions/:id/approvals", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
      matterId: request.auth.user.assignedMatterIds[0],
    });
    const body = parseRequestPart(ledgerApprovalBodySchema, request.body, "body");
    const approval: LedgerTransactionApprovalRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      transactionId: params.id,
      decidedByUserId: request.auth.user.id,
      decision: body.decision,
      decidedAt: body.decidedAt ?? new Date().toISOString(),
      notes: body.notes,
    };
    return repository.createLedgerTransactionApproval(approval);
  });

  server.post("/api/ledger/reconciliations", async (request) => {
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
      matterId: request.auth.user.assignedMatterIds[0],
    });
    const body = parseRequestPart(ledgerReconciliationBodySchema, request.body, "body");
    const reconciliation: LedgerReconciliationRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      accountId: body.accountId,
      statementPeriodStart: body.statementPeriodStart,
      statementPeriodEnd: body.statementPeriodEnd,
      expectedBalanceCents: body.expectedBalanceCents,
      actualBalanceCents: body.actualBalanceCents,
      status:
        body.status ??
        (body.expectedBalanceCents === body.actualBalanceCents ? "matched" : "exception"),
      reviewedByUserId: request.auth.user.id,
      evidence: body.evidence,
      createdAt: new Date().toISOString(),
    };
    return repository.createLedgerReconciliation(reconciliation);
  });
}
