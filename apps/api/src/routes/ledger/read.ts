import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildLedgerBalanceSnapshotComparison,
  ledgerAccountingReviewSummary,
  ledgerBankFeedReconciliationReviewSummary,
  buildFinancialCommandJournal,
  financialCommandJournalActions,
  ledgerControlsDiagnostics,
  ledgerPostingRequestReviewSummary,
  ledgerReconciliationFreshnessReview,
  ledgerReconciliationPacketReview,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess } from "../../http/auth-guards.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertLedgerAccess } from "./shared.js";

const ledgerQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

type LedgerReadRouteDependencies = Pick<ApiRouteDependencies, "repository">;

export function registerLedgerReadRoutes(
  server: FastifyInstance,
  { repository }: LedgerReadRouteDependencies,
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
    const [postingRequests, trustTransferRequests, paymentImportReviewRecords] = await Promise.all([
      repository.listLedgerPostingRequests(request.auth.firmId, query),
      repository.listTrustTransferRequests(request.auth.firmId, query),
      repository.listPaymentImportReviewRecords(request.auth.firmId, query),
    ]);
    const visibleTransactionIds = new Set(ledger.entries.map((entry) => entry.transactionId));
    const [allApprovals, audit, financialCommandAuditEvents] = await Promise.all([
      repository.listLedgerTransactionApprovals(request.auth.firmId),
      repository.listAuditEvents(request.auth.firmId),
      repository.listFilteredAuditEvents(request.auth.firmId, {
        actions: financialCommandJournalActions,
        ...(query.matterId ? { matterId: query.matterId } : {}),
      }),
    ]);
    const approvals = allApprovals.filter((approval) =>
      visibleTransactionIds.has(approval.transactionId),
    );
    const [
      reconciliations,
      importBatches,
      matchRuleProfiles,
      accountingProfiles,
      exceptionResolutions,
    ] = hasFirmWideAccess
      ? await Promise.all([
          repository.listLedgerReconciliations(request.auth.firmId),
          repository.listLedgerStatementImportBatches(request.auth.firmId),
          repository.listLedgerStatementMatchRuleProfiles(request.auth.firmId),
          repository.listLedgerAccountingReviewProfiles(request.auth.firmId),
          repository.listLedgerReconciliationExceptionResolutions(request.auth.firmId),
        ])
      : [[], [], [], [], []];
    const diagnostics = ledgerControlsDiagnostics({
      ledger,
      approvals,
      reconciliations,
      includeReconciliationDiagnostics: hasFirmWideAccess,
    });
    const generatedAt = new Date().toISOString();

    return {
      ledger,
      approvals,
      postingRequests,
      postingRequestSummary: ledgerPostingRequestReviewSummary(postingRequests),
      reconciliations,
      balanceSnapshotComparison: buildLedgerBalanceSnapshotComparison({
        ledger,
        importBatches,
        reconciliations,
        generatedAt,
      }),
      reconciliationFreshness: ledgerReconciliationFreshnessReview({
        accounts: hasFirmWideAccess ? ledger.accounts : [],
        reconciliations: hasFirmWideAccess ? reconciliations : [],
        generatedAt,
      }),
      reconciliationPacketReview: ledgerReconciliationPacketReview({
        ledger,
        approvals,
        postingRequests,
        reconciliations,
        importBatches,
        exceptionResolutions,
        trustTransferRequests,
        paymentImportReviewRecords,
        diagnostics,
        generatedAt,
      }),
      diagnostics,
      accountingReview: {
        importBatches,
        matchRuleProfiles,
        accountingProfiles,
        summary: ledgerAccountingReviewSummary({
          matchRuleProfiles,
          accountingProfiles,
        }),
        bankFeedReviewSummary: ledgerBankFeedReconciliationReviewSummary({
          accountingProfiles,
          importBatches,
          reconciliations,
          diagnostics,
        }),
      },
      financialCommandJournal: buildFinancialCommandJournal({
        audit: { events: financialCommandAuditEvents, valid: audit.valid },
        matterId: query.matterId,
      }),
      trustControlPolicy: {
        automaticTrustPosting: false,
        transferRequestPosting: "requires_explicit_approval_and_manual_post",
        makerChecker: {
          ledgerTransactionApproval: "second_review_required",
          ledgerPostingRequest: "prepared_postings_require_checker_approval_before_posting",
          trustTransferRequest: "request_and_posting_are_separate_records",
          reconciliation: "firm_wide_review_required",
        },
        compliancePosture: "operational_controls_only_not_jurisdiction_certified",
      },
    };
  });
}
