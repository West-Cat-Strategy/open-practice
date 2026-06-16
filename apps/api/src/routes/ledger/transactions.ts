import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { LedgerTransaction, LedgerTransactionApprovalRecord } from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { appendRouteAuditEvent, appendWorkflowAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertNoPendingLedgerPostingRequestForTransaction } from "./posting-requests.js";
import { assertLedgerAccess } from "./shared.js";

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

const ledgerApprovalBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().min(1).optional(),
  decidedAt: z.string().datetime().optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

async function assertLedgerTransactionApprovalAccess(
  context: ApiAuthContext,
  repository: ApiRouteDependencies["repository"],
  transactionId: string,
): Promise<string[]> {
  const ledger = await repository.getLedger(context.firmId);
  const transactionEntries = ledger.entries.filter(
    (entry) => entry.transactionId === transactionId,
  );
  if (transactionEntries.length === 0) {
    throw new Error(`Unknown ledger transaction ${transactionId}`);
  }

  const matterIds = [...new Set(transactionEntries.map((entry) => entry.matterId))];
  for (const matterId of matterIds) {
    assertLedgerAccess(context, {
      resource: "trust_ledger",
      action: "approve",
      matterId,
    });
  }
  return matterIds;
}

type LedgerTransactionRouteDependencies = Pick<ApiRouteDependencies, "repository">;

export function registerLedgerTransactionRoutes(
  server: FastifyInstance,
  { repository }: LedgerTransactionRouteDependencies,
): void {
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
    try {
      await repository.validateLedgerTransactionScope({
        user: request.auth.user,
        transaction,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new ApiHttpError(400, "LEDGER_TRANSACTION_SCOPE_INVALID", error.message);
      }
      throw error;
    }
    await assertNoPendingLedgerPostingRequestForTransaction(repository, transaction);
    let posted: Awaited<ReturnType<typeof repository.postLedgerTransaction>>;
    try {
      posted = await repository.postLedgerTransaction(transaction);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Idempotency key was reused with a different ledger payload"
      ) {
        throw new ApiHttpError(
          409,
          "IDEMPOTENCY_KEY_CONFLICT",
          "Idempotency key was reused with a different payload",
        );
      }
      throw error;
    }
    const matterIds = [...new Set(posted.entries.map((entry) => entry.matterId))];
    await appendWorkflowAuditEvent(repository, request.auth, {
      action: "ledger.transaction.posted",
      resourceType: "ledger_transaction",
      resourceId: posted.id,
      metadata: {
        transactionId: posted.id,
        matterIds,
        accountIds: [...new Set(posted.entries.map((entry) => entry.accountId))],
        status: "posted",
        entryCount: posted.entries.length,
      },
      workflow: {
        requestId: request.id,
        matterIds,
        status: "succeeded",
        idempotencyKeyPresent: true,
      },
    });
    return posted;
  });

  server.post("/api/ledger/transactions/:id/approvals", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const matterIds = await assertLedgerTransactionApprovalAccess(
      request.auth,
      repository,
      params.id,
    );
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
    const created = await repository.createLedgerTransactionApproval(approval);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "ledger.transaction_approval.decided",
      resourceType: "ledger_transaction_approval",
      resourceId: created.id,
      metadata: {
        transactionId: created.transactionId,
        matterIds,
        decision: created.decision,
      },
    });
    return created;
  });
}
