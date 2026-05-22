import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AccessRequest,
  JobLifecycleRecord,
  LedgerReconciliationRecord,
  LedgerTransaction,
  LedgerTransactionApprovalRecord,
  Province,
} from "@open-practice/domain";
import {
  buildLedgerReconciliationExceptionResolutionStatementRow,
  buildJurisdictionalTrustReport,
  ledgerControlsDiagnostics,
  ledgerReconciliationExceptionVarianceDecisions,
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

const jurisdictionalTrustExportRequestBodySchema = z
  .object({
    idempotencyKey: z.string().min(1).max(160).optional(),
    jurisdiction: z.enum(["BC", "ON", "CANADA", "OTHER"]).optional(),
  })
  .strict();

const jurisdictionalTrustExportParamsSchema = z.object({
  exportJobId: z.string().min(1),
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

async function assertTrustAssetAccount(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  accountId: string,
): Promise<void> {
  const ledger = await repository.getLedger(firmId);
  const account = ledger.accounts.find((candidate) => candidate.id === accountId);
  if (!account || account.type !== "trust_asset") {
    throw new Error("Reconciliation exception resolutions require an existing trust asset account");
  }
}

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function jurisdictionalTrustExportJobId(): string {
  return `jurisdictional-trust-export-${crypto.randomUUID()}`;
}

function jurisdictionalTrustExportRequestFingerprint(
  auth: ApiAuthContext,
  jurisdiction: Province | undefined,
) {
  return `jurisdictional-trust:${auth.firmId}:${auth.user.id}:${jurisdiction ?? "all"}`;
}

function assertJurisdictionalTrustExportAccess(context: ApiAuthContext): void {
  const access = requireAccess(context, {
    resource: "trust_ledger",
    action: "export",
  });
  if (!access.ok) throw access.error;
  if (!hasFirmWideLedgerAccess(context.user)) {
    throw new ApiHttpError(403, "TRUST_LEDGER_ACCESS_REQUIRED", "Trust ledger access required");
  }
}

async function jurisdictionalTrustReportForRequest(input: {
  repository: ApiRouteDependencies["repository"];
  auth: ApiAuthContext;
  jurisdiction?: Province;
}) {
  const [ledger, approvals, reconciliations, matters] = await Promise.all([
    input.repository.getLedger(input.auth.firmId),
    input.repository.listLedgerTransactionApprovals(input.auth.firmId),
    input.repository.listLedgerReconciliations(input.auth.firmId),
    input.repository.listMattersForUser(input.auth.user),
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
    jurisdiction: input.jurisdiction,
  });
}

async function findJurisdictionalTrustExportJob(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  jobId: string,
): Promise<JobLifecycleRecord | undefined> {
  return (await repository.listJobLifecycleRecords(firmId, { queueName: "reports" })).find(
    (record) => record.id === jobId && record.jobName === "jurisdictional_trust_export",
  );
}

function jurisdictionalTrustExportJurisdiction(job: JobLifecycleRecord): Province | undefined {
  const value = job.metadata.jurisdiction;
  return value === "BC" || value === "ON" || value === "CANADA" || value === "OTHER"
    ? value
    : undefined;
}

function serializeJurisdictionalTrustExportRequest(job: JobLifecycleRecord) {
  return {
    id: job.id,
    jobId: job.id,
    status: job.status,
    queuedAt: job.queuedAt,
    finishedAt: job.finishedAt,
    failedAt: job.failedAt,
    pollUrl: `/api/ledger/reports/jurisdictional-trust/export-requests/${job.id}`,
    downloadUrl: `/api/ledger/reports/jurisdictional-trust/export-requests/${job.id}/download`,
  };
}

export function registerLedgerRoutes(
  server: FastifyInstance,
  { repository, reportJobQueue }: ApiRouteDependencies,
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

    return jurisdictionalTrustReportForRequest({
      repository,
      auth: request.auth,
      jurisdiction: query.jurisdiction,
    });
  });

  server.post(
    "/api/ledger/reports/jurisdictional-trust/export-requests",
    async (request, reply) => {
      assertJurisdictionalTrustExportAccess(request.auth);
      const body = parseRequestPart(
        jurisdictionalTrustExportRequestBodySchema,
        request.body,
        "body",
      );
      const jobId = jurisdictionalTrustExportJobId();
      const queueConfigured = Boolean(reportJobQueue);
      const now = new Date().toISOString();
      const idempotencyKey =
        body.idempotencyKey ??
        `jurisdictional-trust-export:${request.auth.user.id}:${body.jurisdiction ?? "all"}:${now.slice(
          0,
          10,
        )}`;
      const metadata = compactMetadata({
        reportType: "jurisdictional_trust",
        reportScope: "firm",
        jurisdiction: body.jurisdiction,
        requestedByUserId: request.auth.user.id,
        enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
        idempotencyFingerprint: jurisdictionalTrustExportRequestFingerprint(
          request.auth,
          body.jurisdiction,
        ),
      });

      const job = await repository.createJobLifecycleRecord({
        id: jobId,
        firmId: request.auth.firmId,
        queueName: "reports",
        jobName: "jurisdictional_trust_export",
        bullJobId: queueConfigured ? jobId : undefined,
        idempotencyKey,
        status: queueConfigured ? "queued" : "completed",
        targetResourceType: "jurisdictional_trust_export",
        targetResourceId: jobId,
        attemptsMade: 0,
        maxAttempts: queueConfigured ? 2 : 1,
        queuedAt: now,
        finishedAt: queueConfigured ? undefined : now,
        metadata,
      });

      if (reportJobQueue && job.id === jobId) {
        try {
          await reportJobQueue.add(
            "jurisdictional_trust_export",
            {
              firmId: request.auth.firmId,
              resourceType: "jurisdictional_trust_export",
              resourceId: job.id,
              metadata: compactMetadata({
                reportType: "jurisdictional_trust",
                reportScope: "firm",
                jurisdiction: body.jurisdiction,
                requestedByUserId: request.auth.user.id,
              }),
            },
            { jobId: job.id },
          );
        } catch (error) {
          await repository.updateJobLifecycleRecord(request.auth.firmId, job.id, {
            status: "failed",
            failedAt: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      }

      await appendRouteAuditEvent(repository, request.auth, {
        action: "jurisdictional_trust_export.requested",
        resourceType: "jurisdictional_trust_export",
        resourceId: job.id,
        metadata: compactMetadata({
          jobId: job.id,
          reportType: "jurisdictional_trust",
          reportScope: "firm",
          jurisdiction: body.jurisdiction,
          idempotencyKeyPresent: Boolean(body.idempotencyKey),
          enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
        }),
      });

      reply.status(202);
      return { exportRequest: serializeJurisdictionalTrustExportRequest(job) };
    },
  );

  server.get(
    "/api/ledger/reports/jurisdictional-trust/export-requests/:exportJobId",
    async (request) => {
      assertJurisdictionalTrustExportAccess(request.auth);
      const params = parseRequestPart(
        jurisdictionalTrustExportParamsSchema,
        request.params,
        "params",
      );
      const job = await findJurisdictionalTrustExportJob(
        repository,
        request.auth.firmId,
        params.exportJobId,
      );
      if (!job) {
        throw new ApiHttpError(
          404,
          "JURISDICTIONAL_TRUST_EXPORT_NOT_FOUND",
          "Jurisdictional trust export was not found",
        );
      }
      return { exportRequest: serializeJurisdictionalTrustExportRequest(job) };
    },
  );

  server.get(
    "/api/ledger/reports/jurisdictional-trust/export-requests/:exportJobId/download",
    async (request) => {
      assertJurisdictionalTrustExportAccess(request.auth);
      const params = parseRequestPart(
        jurisdictionalTrustExportParamsSchema,
        request.params,
        "params",
      );
      const job = await findJurisdictionalTrustExportJob(
        repository,
        request.auth.firmId,
        params.exportJobId,
      );
      if (!job) {
        throw new ApiHttpError(
          404,
          "JURISDICTIONAL_TRUST_EXPORT_NOT_FOUND",
          "Jurisdictional trust export was not found",
        );
      }
      if (job.status === "failed" || job.status === "dead_letter") {
        throw new ApiHttpError(
          409,
          "JURISDICTIONAL_TRUST_EXPORT_FAILED",
          "Jurisdictional trust export did not complete",
        );
      }
      if (job.status !== "completed") {
        throw new ApiHttpError(
          409,
          "JURISDICTIONAL_TRUST_EXPORT_NOT_READY",
          "Jurisdictional trust export is not ready yet",
        );
      }

      return {
        exportRequest: serializeJurisdictionalTrustExportRequest(job),
        export: await jurisdictionalTrustReportForRequest({
          repository,
          auth: request.auth,
          jurisdiction: jurisdictionalTrustExportJurisdiction(job),
        }),
      };
    },
  );

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
    await assertTrustAssetAccount(repository, request.auth.firmId, query.accountId);
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
    await assertTrustAssetAccount(repository, request.auth.firmId, body.accountId);
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
