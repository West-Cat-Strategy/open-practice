import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  LedgerAccountingReviewProfileRecord,
  LedgerReconciliationRecord,
  LedgerStatementImportBatchRecord,
  LedgerStatementMatchRuleProfileRecord,
} from "@open-practice/domain";
import {
  buildLedgerReconciliationExceptionResolutionStatementRow,
  ledgerAccountingBankFeedImportStatuses,
  ledgerAccountingDimensionPostures,
  ledgerAccountingProtectedFundsReviewCadences,
  ledgerReconciliationExceptionVarianceDecisions,
  ledgerReconciliationReviewSummary,
  ledgerStatementImportBatchStatuses,
  ledgerStatementMatchDescriptionStrategies,
  ledgerStatementMatchReferenceStrategies,
  previewLedgerStatementImport,
} from "@open-practice/domain";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertLedgerAccess, assertTrustAssetAccount, getLedgerAccount } from "./shared.js";

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

const ledgerStatementImportBatchBodySchema = z.object({
  accountId: z.string().min(1),
  sourceLabel: z.string().min(1),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  importedStatementRowCount: z.number().int().positive(),
  duplicateStatementRowCount: z.number().int().nonnegative(),
  status: z.enum(ledgerStatementImportBatchStatuses).optional(),
  matchingProfileId: z.string().min(1).optional(),
});

const ledgerStatementImportBatchesQuerySchema = z.object({
  accountId: z.string().min(1),
});

const ledgerOptionalAccountQuerySchema = z.object({
  accountId: z.string().min(1).optional(),
});

const ledgerStatementMatchRuleProfileBodySchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1),
  referenceStrategy: z.enum(ledgerStatementMatchReferenceStrategies),
  descriptionStrategy: z.enum(ledgerStatementMatchDescriptionStrategies),
  dateWindowDays: z.number().int().min(0).max(30),
  amountToleranceCents: z.number().int().min(0).max(100_000),
  varianceCategories: z.array(z.enum(ledgerReconciliationExceptionVarianceDecisions)).min(1),
  reviewerExplanationRequired: z.boolean().optional(),
});

const ledgerAccountingReviewProfileBodySchema = z.object({
  accountId: z.string().min(1),
  boundaryPosture: z.enum(["trust_only", "operating_only", "expense_only", "review_required"]),
  protectedFunds: z.object({
    protected: z.boolean(),
    reason: z.string().min(1).optional(),
    reviewCadence: z.enum(ledgerAccountingProtectedFundsReviewCadences),
  }),
  bankFeedImport: z.object({
    status: z.enum(ledgerAccountingBankFeedImportStatuses),
    sourceLabel: z.string().min(1).optional(),
    lastImportedAt: z.string().datetime().optional(),
    automaticMatching: z.literal(false).optional(),
  }),
  dimensions: z.object({
    vendorTracking: z.enum(ledgerAccountingDimensionPostures),
    expenseCategoryTracking: z.enum(ledgerAccountingDimensionPostures),
    clientMatterTracking: z.literal("required").optional(),
    notes: z.string().min(1).optional(),
  }),
});

const ledgerReconciliationExceptionResolutionsQuerySchema = z.object({
  accountId: z.string().min(1),
});

const ledgerReconciliationExceptionResolutionBodySchema = z.object({
  accountId: z.string().min(1),
  statementRow: z.object({
    id: z.string().min(1),
    postedAt: z.string().datetime(),
    description: z.string().min(1),
    amountCents: z.number().int(),
    reference: z.string().min(1).optional(),
    duplicateOfRowId: z.string().min(1).optional(),
    reviewDecision: z.literal("unmatched"),
  }),
  varianceDecision: z.enum(ledgerReconciliationExceptionVarianceDecisions),
  resolutionNote: z.string().min(1),
});

type LedgerReconciliationRouteDependencies = Pick<ApiRouteDependencies, "repository">;

export function registerLedgerReconciliationRoutes(
  server: FastifyInstance,
  { repository }: LedgerReconciliationRouteDependencies,
): void {
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

  server.get("/api/ledger/reconciliations/import-batches", async (request) => {
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
    });
    const query = parseRequestPart(ledgerStatementImportBatchesQuerySchema, request.query, "query");
    await assertTrustAssetAccount(
      repository,
      request.auth.firmId,
      query.accountId,
      "Statement import batches require an existing trust asset account",
    );
    return repository.listLedgerStatementImportBatches(request.auth.firmId, {
      accountId: query.accountId,
    });
  });

  server.post("/api/ledger/reconciliations/import-batches", async (request) => {
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
    });
    const body = parseRequestPart(ledgerStatementImportBatchBodySchema, request.body, "body");
    await assertTrustAssetAccount(
      repository,
      request.auth.firmId,
      body.accountId,
      "Statement import batches require an existing trust asset account",
    );
    const batch: LedgerStatementImportBatchRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      accountId: body.accountId,
      sourceLabel: body.sourceLabel.trim(),
      checksumSha256: body.checksumSha256,
      importedStatementRowCount: body.importedStatementRowCount,
      duplicateStatementRowCount: body.duplicateStatementRowCount,
      status: body.status ?? "previewed",
      matchingProfileId: body.matchingProfileId?.trim(),
      createdByUserId: request.auth.user.id,
      createdAt: new Date().toISOString(),
    };
    const created = await repository.createLedgerStatementImportBatch(batch);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "ledger.statement_import_batch.recorded",
      resourceType: "ledger_statement_import_batch",
      resourceId: created.id,
      metadata: {
        accountId: created.accountId,
        importedStatementRowCount: created.importedStatementRowCount,
        duplicateStatementRowCount: created.duplicateStatementRowCount,
        status: created.status,
        sourceLabelPresent: Boolean(created.sourceLabel.trim()),
        checksumPresent: Boolean(created.checksumSha256),
        matchingProfilePresent: Boolean(created.matchingProfileId),
      },
    });
    return created;
  });

  server.get("/api/ledger/reconciliations/match-rule-profiles", async (request) => {
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
    });
    const query = parseRequestPart(ledgerOptionalAccountQuerySchema, request.query, "query");
    if (query.accountId) {
      await assertTrustAssetAccount(
        repository,
        request.auth.firmId,
        query.accountId,
        "Statement match-rule profiles require an existing trust asset account",
      );
    }
    return repository.listLedgerStatementMatchRuleProfiles(request.auth.firmId, {
      accountId: query.accountId,
    });
  });

  server.post("/api/ledger/reconciliations/match-rule-profiles", async (request) => {
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
    });
    const body = parseRequestPart(ledgerStatementMatchRuleProfileBodySchema, request.body, "body");
    await assertTrustAssetAccount(
      repository,
      request.auth.firmId,
      body.accountId,
      "Statement match-rule profiles require an existing trust asset account",
    );
    const now = new Date().toISOString();
    const profile: LedgerStatementMatchRuleProfileRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      accountId: body.accountId,
      name: body.name.trim(),
      referenceStrategy: body.referenceStrategy,
      descriptionStrategy: body.descriptionStrategy,
      dateWindowDays: body.dateWindowDays,
      amountToleranceCents: body.amountToleranceCents,
      varianceCategories: body.varianceCategories,
      reviewerExplanationRequired: body.reviewerExplanationRequired ?? true,
      reviewOnly: true,
      createdByUserId: request.auth.user.id,
      createdAt: now,
      updatedAt: now,
    };
    const created = await repository.createLedgerStatementMatchRuleProfile(profile);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "ledger.statement_match_rule_profile.recorded",
      resourceType: "ledger_statement_match_rule_profile",
      resourceId: created.id,
      metadata: {
        accountId: created.accountId,
        referenceStrategy: created.referenceStrategy,
        descriptionStrategy: created.descriptionStrategy,
        dateWindowDays: created.dateWindowDays,
        amountToleranceCents: created.amountToleranceCents,
        varianceCategoryCount: created.varianceCategories.length,
        reviewerExplanationRequired: created.reviewerExplanationRequired,
        reviewOnly: created.reviewOnly,
      },
    });
    return created;
  });

  server.get("/api/ledger/accounting-review-profiles", async (request) => {
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
    });
    const query = parseRequestPart(ledgerOptionalAccountQuerySchema, request.query, "query");
    if (query.accountId) await getLedgerAccount(repository, request.auth.firmId, query.accountId);
    return repository.listLedgerAccountingReviewProfiles(request.auth.firmId, {
      accountId: query.accountId,
    });
  });

  server.post("/api/ledger/accounting-review-profiles", async (request) => {
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
    });
    const body = parseRequestPart(ledgerAccountingReviewProfileBodySchema, request.body, "body");
    const account = await getLedgerAccount(repository, request.auth.firmId, body.accountId);
    const now = new Date().toISOString();
    const profile: LedgerAccountingReviewProfileRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      accountId: body.accountId,
      accountType: account.type,
      boundaryPosture: body.boundaryPosture,
      protectedFunds: {
        ...body.protectedFunds,
        reason: body.protectedFunds.reason?.trim(),
      },
      bankFeedImport: {
        status: body.bankFeedImport.status,
        sourceLabel: body.bankFeedImport.sourceLabel?.trim(),
        lastImportedAt: body.bankFeedImport.lastImportedAt,
        automaticMatching: false,
      },
      dimensions: {
        vendorTracking: body.dimensions.vendorTracking,
        expenseCategoryTracking: body.dimensions.expenseCategoryTracking,
        clientMatterTracking: "required",
        notes: body.dimensions.notes?.trim(),
      },
      reviewOnly: true,
      createdByUserId: request.auth.user.id,
      createdAt: now,
      updatedAt: now,
    };
    const created = await repository.createLedgerAccountingReviewProfile(profile);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "ledger.accounting_review_profile.recorded",
      resourceType: "ledger_accounting_review_profile",
      resourceId: created.id,
      metadata: {
        accountId: created.accountId,
        accountType: created.accountType,
        boundaryPosture: created.boundaryPosture,
        protectedFunds: created.protectedFunds.protected,
        bankFeedImportStatus: created.bankFeedImport.status,
        bankFeedSourceLabelPresent: Boolean(created.bankFeedImport.sourceLabel),
        automaticMatching: created.bankFeedImport.automaticMatching,
        vendorTracking: created.dimensions.vendorTracking,
        expenseCategoryTracking: created.dimensions.expenseCategoryTracking,
        clientMatterTracking: created.dimensions.clientMatterTracking,
        reviewOnly: created.reviewOnly,
      },
    });
    return created;
  });

  server.get("/api/ledger/reconciliation-exception-resolutions", async (request) => {
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
    });
    const query = parseRequestPart(
      ledgerReconciliationExceptionResolutionsQuerySchema,
      request.query,
      "query",
    );
    await assertTrustAssetAccount(
      repository,
      request.auth.firmId,
      query.accountId,
      "Reconciliation exception resolutions require an existing trust asset account",
    );
    return repository.listLedgerReconciliationExceptionResolutions(request.auth.firmId, {
      accountId: query.accountId,
    });
  });

  server.post("/api/ledger/reconciliation-exception-resolutions", async (request) => {
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
    });
    const body = parseRequestPart(
      ledgerReconciliationExceptionResolutionBodySchema,
      request.body,
      "body",
    );
    await assertTrustAssetAccount(
      repository,
      request.auth.firmId,
      body.accountId,
      "Reconciliation exception resolutions require an existing trust asset account",
    );
    const created = await repository.createLedgerReconciliationExceptionResolution({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      accountId: body.accountId,
      statementRow: buildLedgerReconciliationExceptionResolutionStatementRow(body.statementRow),
      varianceDecision: body.varianceDecision,
      resolutionNote: body.resolutionNote,
      recordedByUserId: request.auth.user.id,
      recordedAt: new Date().toISOString(),
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "ledger.reconciliation_exception_resolution.recorded",
      resourceType: "ledger_reconciliation_exception_resolution",
      resourceId: created.id,
      metadata: {
        accountId: created.accountId,
        statementRowId: created.statementRow.id,
        varianceDecision: created.varianceDecision,
        resolutionNotePresent: Boolean(created.resolutionNote.trim()),
      },
    });
    return created;
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
