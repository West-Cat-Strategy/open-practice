import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AccessRequest,
  LedgerReconciliationRecord,
  LedgerTransaction,
  LedgerTransactionApprovalRecord,
} from "@open-practice/domain";
import {
  buildJurisdictionalTrustReport,
  ledgerControlsDiagnostics,
  ledgerReconciliationReviewSummary,
  previewLedgerStatementImport,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent, appendWorkflowAuditEvent } from "./audit-events.js";
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

const jurisdictionalTrustReportQuerySchema = z.object({
  jurisdiction: z.enum(["BC", "ON", "CANADA", "OTHER"]).optional(),
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
  beginningBalanceCents: z.number().int(),
  endingBalanceCents: z.number().int(),
  expectedBalanceCents: z.number().int(),
  actualBalanceCents: z.number().int(),
  status: z.enum(["draft", "matched", "exception", "reviewed"]).optional(),
  statementRows: z
    .array(
      z.object({
        id: z.string().min(1),
        postedAt: z.string().datetime(),
        description: z.string().min(1),
        amountCents: z.number().int(),
        reference: z.string().min(1).optional(),
        matchedLedgerEntryIds: z.array(z.string().min(1)).default([]),
        reviewDecision: z.enum(["matched", "unmatched"]),
        reviewedAt: z.string().datetime().optional(),
        notes: z.string().min(1).optional(),
      }),
    )
    .min(1),
  varianceExplanation: z.string().min(1).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const ledgerStatementImportPreviewBodySchema = z.object({
  accountId: z.string().min(1),
  statementRows: z
    .array(
      z.object({
        id: z.string().min(1),
        postedAt: z.string().datetime(),
        description: z.string().min(1),
        amountCents: z.number().int(),
        reference: z.string().min(1).optional(),
      }),
    )
    .min(1),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function assertLedgerAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

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

  server.get("/api/ledger/controls", async (request) => {
    const query = parseRequestPart(ledgerQuerySchema, request.query, "query");
    const hasFirmWideAccess = hasFirmWideLedgerAccess(request.auth.user);
    if (!query.matterId && !hasFirmWideAccess) {
      throw Object.assign(new Error("matterId is required for matter-scoped ledger access"), {
        statusCode: 400,
      });
    }
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "read",
      matterId: query.matterId,
    });

    const ledger = await repository.getLedger(request.auth.firmId, query);
    const visibleTransactionIds = new Set(ledger.entries.map((entry) => entry.transactionId));
    const approvals = (await repository.listLedgerTransactionApprovals(request.auth.firmId)).filter(
      (approval) => visibleTransactionIds.has(approval.transactionId),
    );
    const reconciliations = hasFirmWideAccess
      ? await repository.listLedgerReconciliations(request.auth.firmId)
      : [];
    const diagnostics = ledgerControlsDiagnostics({
      ledger,
      approvals,
      reconciliations,
      includeReconciliationDiagnostics: hasFirmWideAccess,
    });

    return {
      ledger,
      approvals,
      reconciliations,
      diagnostics,
      trustControlPolicy: {
        automaticTrustPosting: false,
        transferRequestPosting: "requires_explicit_approval_and_manual_post",
        makerChecker: {
          ledgerTransactionApproval: "second_review_required",
          trustTransferRequest: "request_and_posting_are_separate_records",
          reconciliation: "firm_wide_review_required",
        },
        compliancePosture: "operational_controls_only_not_jurisdiction_certified",
      },
    };
  });

  server.get("/api/ledger/reports/jurisdictional-trust", async (request) => {
    const query = parseRequestPart(jurisdictionalTrustReportQuerySchema, request.query, "query");
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "read",
    });
    if (!hasFirmWideLedgerAccess(request.auth.user)) {
      throw new ApiHttpError(403, "TRUST_LEDGER_ACCESS_REQUIRED", "Trust ledger access required");
    }

    const [ledger, approvals, reconciliations, matters] = await Promise.all([
      repository.getLedger(request.auth.firmId),
      repository.listLedgerTransactionApprovals(request.auth.firmId),
      repository.listLedgerReconciliations(request.auth.firmId),
      repository.listMattersForUser(request.auth.user),
    ]);
    const diagnostics = ledgerControlsDiagnostics({
      ledger,
      approvals,
      reconciliations,
      includeReconciliationDiagnostics: true,
    });

    return buildJurisdictionalTrustReport({
      matters,
      ledger,
      approvals,
      reconciliations,
      diagnostics,
      jurisdiction: query.jurisdiction,
    });
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

  server.post("/api/ledger/reconciliations/preview", async (request) => {
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
    });
    const body = parseRequestPart(ledgerStatementImportPreviewBodySchema, request.body, "body");
    const ledger = await repository.getLedger(request.auth.firmId);
    const account = ledger.accounts.find((candidate) => candidate.id === body.accountId);
    if (!account || account.type !== "trust_asset") {
      throw new Error("Statement import preview requires an existing trust asset account");
    }

    return previewLedgerStatementImport({
      accountId: body.accountId,
      statementRows: body.statementRows,
      ledgerEntries: ledger.entries,
    });
  });

  server.post("/api/ledger/reconciliations", async (request) => {
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
    });
    const body = parseRequestPart(ledgerReconciliationBodySchema, request.body, "body");
    const createdAt = new Date().toISOString();
    const statementRows = body.statementRows.map((row) => ({
      ...row,
      reviewedByUserId: request.auth.user.id,
      reviewedAt: row.reviewedAt ?? createdAt,
    }));
    const ledger = await repository.getLedger(request.auth.firmId);
    const accountLedgerEntryIds = new Set(
      ledger.entries.filter((entry) => entry.accountId === body.accountId).map((entry) => entry.id),
    );
    for (const row of statementRows) {
      if (
        row.reviewDecision === "matched" &&
        row.matchedLedgerEntryIds.some((entryId) => !accountLedgerEntryIds.has(entryId))
      ) {
        throw new Error(
          "Matched statement rows must reference existing ledger entries for the reconciliation account",
        );
      }
    }
    const hasUnmatchedRows = statementRows.some((row) => row.reviewDecision === "unmatched");
    const reconciliation: LedgerReconciliationRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      accountId: body.accountId,
      statementPeriodStart: body.statementPeriodStart,
      statementPeriodEnd: body.statementPeriodEnd,
      beginningBalanceCents: body.beginningBalanceCents,
      endingBalanceCents: body.endingBalanceCents,
      expectedBalanceCents: body.expectedBalanceCents,
      actualBalanceCents: body.actualBalanceCents,
      status:
        body.status ??
        (body.expectedBalanceCents === body.actualBalanceCents && !hasUnmatchedRows
          ? "matched"
          : "exception"),
      reviewedByUserId: request.auth.user.id,
      statementRows,
      varianceExplanation: body.varianceExplanation,
      evidence: body.evidence,
      createdAt,
    };
    const created = await repository.createLedgerReconciliation(reconciliation);
    const reviewSummary = ledgerReconciliationReviewSummary(created);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "ledger.reconciliation.created",
      resourceType: "ledger_reconciliation",
      resourceId: created.id,
      metadata: {
        accountId: created.accountId,
        status: created.status,
        statementRowCount: reviewSummary.importedStatementRowCount,
        matchedStatementRowCount: reviewSummary.matchedStatementRowCount,
        unmatchedStatementRowCount: reviewSummary.unmatchedStatementRowCount,
        varianceCents: reviewSummary.varianceCents,
        varianceExplanationPresent: Boolean(created.varianceExplanation),
      },
    });
    return created;
  });
}
