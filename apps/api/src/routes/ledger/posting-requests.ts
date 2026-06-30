import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ledgerPostingRequestFromTransaction,
  ledgerPostingRequestStatuses,
  ledgerRequestFingerprint,
  type LedgerPostingRequestRecord,
  type LedgerTransaction,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess } from "../../http/auth-guards.js";
import { requireFreshAuth } from "../../http/fresh-auth.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { appendRouteAuditEvent, appendWorkflowAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertLedgerAccess } from "./shared.js";

const proposedLedgerTransactionSchema = z.object({
  id: z.string().min(1),
  idempotencyKey: z.string().min(1),
  requestFingerprint: z.string().min(1).optional(),
  postedAt: z.string().datetime().optional(),
  reversesTransactionId: z.string().min(1).optional(),
  entries: z
    .array(
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
    )
    .min(2),
});

const preparePostingRequestBodySchema = z.object({
  id: z.string().min(1).optional(),
  preparedAt: z.string().datetime().optional(),
  preparationNotes: z.string().min(1).optional(),
  proposedTransaction: proposedLedgerTransactionSchema,
});

const postingRequestListQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(ledgerPostingRequestStatuses).optional(),
});

const postingRequestParamsSchema = z.object({ id: z.string().min(1) });

const approvePostingRequestBodySchema = z.object({
  reviewedAt: z.string().datetime().optional(),
  reviewNotes: z.string().min(1).optional(),
});

const rejectPostingRequestBodySchema = z.object({
  reviewedAt: z.string().datetime().optional(),
  reviewNotes: z.string().min(1).optional(),
  rejectionReason: z.string().min(1),
});

type LedgerPostingRequestRouteDependencies = Pick<ApiRouteDependencies, "repository">;

export function registerLedgerPostingRequestRoutes(
  server: FastifyInstance,
  { repository }: LedgerPostingRequestRouteDependencies,
): void {
  server.get("/api/ledger/posting-requests", async (request) => {
    const query = parseRequestPart(postingRequestListQuerySchema, request.query, "query");
    if (!query.matterId && !hasFirmWideLedgerAccess(request.auth.user)) {
      throw new ApiHttpError(
        400,
        "LEDGER_MATTER_ID_REQUIRED",
        "matterId is required for matter-scoped ledger access",
      );
    }
    assertLedgerAccess(request.auth, {
      resource: "trust_ledger",
      action: "read",
      matterId: query.matterId,
    });
    return repository.listLedgerPostingRequests(request.auth.firmId, query);
  });

  server.post("/api/ledger/posting-requests/prepare", async (request) => {
    const body = parseRequestPart(preparePostingRequestBodySchema, request.body, "body");
    const transaction = buildProposedTransaction(request.auth, body.proposedTransaction);
    assertPostingRequestMatterAccess(request.auth, "create", transaction.entries);

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

    const preparedAt = body.preparedAt ?? new Date().toISOString();
    const postingRequest = ledgerPostingRequestFromTransaction({
      id: body.id ?? crypto.randomUUID(),
      preparedByUserId: request.auth.user.id,
      preparedAt,
      preparationNotes: body.preparationNotes,
      transaction,
    });

    let prepared: LedgerPostingRequestRecord;
    try {
      prepared = await repository.prepareLedgerPostingRequest(postingRequest);
    } catch (error) {
      mapLedgerPostingRequestError(error);
      throw error;
    }

    await appendRouteAuditEvent(repository, request.auth, {
      action: "ledger.posting_request.prepared",
      resourceType: "ledger_posting_request",
      resourceId: prepared.id,
      occurredAt: prepared.preparedAt,
      metadata: {
        postingRequestId: prepared.id,
        transactionId: prepared.transactionId,
        matterIds: prepared.matterIds,
        accountIds: prepared.accountIds,
        status: prepared.status,
        entryCount: prepared.entries.length,
        idempotencyKeyPresent: true,
        preparationNotesPresent: Boolean(prepared.preparationNotes),
      },
    });
    return prepared;
  });

  server.post("/api/ledger/posting-requests/:id/approve", async (request) => {
    const params = parseRequestPart(postingRequestParamsSchema, request.params, "params");
    const body = parseRequestPart(approvePostingRequestBodySchema, request.body, "body");
    const postingRequest = await getAuthorizedPostingRequestForDecision(
      repository,
      request.auth,
      params.id,
    );
    if (postingRequest.preparedByUserId === request.auth.user.id) {
      throw new ApiHttpError(
        403,
        "LEDGER_POSTING_REQUEST_SELF_APPROVAL_DENIED",
        "Ledger posting request requires checker approval by a different user",
      );
    }

    requireFreshAuth(request.auth);
    let approved: Awaited<ReturnType<typeof repository.approveLedgerPostingRequest>>;
    try {
      approved = await repository.approveLedgerPostingRequest(request.auth.firmId, params.id, {
        reviewedByUserId: request.auth.user.id,
        reviewedAt: body.reviewedAt ?? new Date().toISOString(),
        reviewNotes: body.reviewNotes,
      });
    } catch (error) {
      mapLedgerPostingRequestError(error);
      throw error;
    }

    await appendWorkflowAuditEvent(repository, request.auth, {
      action: "ledger.transaction.posted",
      resourceType: "ledger_transaction",
      resourceId: approved.postedTransaction.id,
      occurredAt: approved.request.reviewedAt,
      metadata: {
        transactionId: approved.postedTransaction.id,
        postingRequestId: approved.request.id,
        matterIds: approved.request.matterIds,
        accountIds: approved.request.accountIds,
        status: "posted",
        entryCount: approved.postedTransaction.entries.length,
      },
      workflow: {
        requestId: request.id,
        matterIds: approved.request.matterIds,
        status: "succeeded",
        idempotencyKeyPresent: true,
      },
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "ledger.posting_request.approved",
      resourceType: "ledger_posting_request",
      resourceId: approved.request.id,
      occurredAt: approved.request.reviewedAt,
      metadata: {
        postingRequestId: approved.request.id,
        transactionId: approved.request.transactionId,
        ledgerTransactionId: approved.request.ledgerTransactionId,
        matterIds: approved.request.matterIds,
        accountIds: approved.request.accountIds,
        previousStatus: postingRequest.status,
        status: approved.request.status,
        reviewNotesPresent: Boolean(approved.request.reviewNotes),
      },
    });
    return approved.request;
  });

  server.post("/api/ledger/posting-requests/:id/reject", async (request) => {
    const params = parseRequestPart(postingRequestParamsSchema, request.params, "params");
    const body = parseRequestPart(rejectPostingRequestBodySchema, request.body, "body");
    const postingRequest = await getAuthorizedPostingRequestForDecision(
      repository,
      request.auth,
      params.id,
    );
    if (postingRequest.preparedByUserId === request.auth.user.id) {
      throw new ApiHttpError(
        403,
        "LEDGER_POSTING_REQUEST_SELF_APPROVAL_DENIED",
        "Ledger posting request requires checker approval by a different user",
      );
    }

    requireFreshAuth(request.auth);
    let rejected: LedgerPostingRequestRecord;
    try {
      rejected = await repository.rejectLedgerPostingRequest(request.auth.firmId, params.id, {
        reviewedByUserId: request.auth.user.id,
        reviewedAt: body.reviewedAt ?? new Date().toISOString(),
        rejectionReason: body.rejectionReason,
        reviewNotes: body.reviewNotes,
      });
    } catch (error) {
      mapLedgerPostingRequestError(error);
      throw error;
    }

    await appendRouteAuditEvent(repository, request.auth, {
      action: "ledger.posting_request.rejected",
      resourceType: "ledger_posting_request",
      resourceId: rejected.id,
      occurredAt: rejected.reviewedAt,
      metadata: {
        postingRequestId: rejected.id,
        transactionId: rejected.transactionId,
        matterIds: rejected.matterIds,
        accountIds: rejected.accountIds,
        previousStatus: postingRequest.status,
        status: rejected.status,
        reviewNotesPresent: Boolean(rejected.reviewNotes),
        rejectionReasonPresent: Boolean(rejected.rejectionReason),
      },
    });
    return rejected;
  });
}

function buildProposedTransaction(
  auth: ApiAuthContext,
  proposed: z.infer<typeof proposedLedgerTransactionSchema>,
): LedgerTransaction {
  return {
    id: proposed.id,
    firmId: auth.firmId,
    idempotencyKey: proposed.idempotencyKey,
    requestFingerprint: proposed.requestFingerprint,
    postedByUserId: auth.user.id,
    postedAt: proposed.postedAt ?? new Date().toISOString(),
    reversesTransactionId: proposed.reversesTransactionId,
    entries: proposed.entries.map((entry) => ({
      ...entry,
      firmId: entry.firmId ?? auth.firmId,
    })),
  };
}

function assertPostingRequestMatterAccess(
  auth: ApiAuthContext,
  action: "create" | "approve",
  entries: LedgerTransaction["entries"],
): void {
  const matterIds = [...new Set(entries.map((entry) => entry.matterId))];
  for (const matterId of matterIds) {
    assertLedgerAccess(auth, {
      resource: "trust_ledger",
      action,
      matterId,
    });
  }
}

async function getAuthorizedPostingRequestForDecision(
  repository: ApiRouteDependencies["repository"],
  auth: ApiAuthContext,
  requestId: string,
): Promise<LedgerPostingRequestRecord> {
  const postingRequest = await repository.getLedgerPostingRequest(auth.firmId, requestId);
  if (!postingRequest) {
    throw new ApiHttpError(
      404,
      "LEDGER_POSTING_REQUEST_NOT_FOUND",
      "Ledger posting request was not found",
    );
  }
  for (const matterId of postingRequest.matterIds) {
    assertLedgerAccess(auth, {
      resource: "trust_ledger",
      action: "approve",
      matterId,
    });
  }
  return postingRequest;
}

export async function assertNoPendingLedgerPostingRequestForTransaction(
  repository: ApiRouteDependencies["repository"],
  transaction: LedgerTransaction,
): Promise<void> {
  const pendingRequests = await repository.listLedgerPostingRequests(transaction.firmId, {
    idempotencyKey: transaction.idempotencyKey,
    status: "pending_approval",
  });
  if (pendingRequests.length === 0) return;
  const requestFingerprint =
    transaction.requestFingerprint ?? ledgerRequestFingerprint(transaction);
  const selectedRequest = pendingRequests.find(
    (request) => request.requestFingerprint === requestFingerprint,
  );
  throw new ApiHttpError(
    409,
    "LEDGER_POSTING_REQUEST_PENDING",
    selectedRequest
      ? "Selected trust posting is pending approval"
      : "Trust posting idempotency key is already pending approval",
  );
}

function mapLedgerPostingRequestError(error: unknown): never | void {
  if (!(error instanceof Error)) return;
  if (error.message === "Idempotency key was reused with a different ledger payload") {
    throw new ApiHttpError(
      409,
      "IDEMPOTENCY_KEY_CONFLICT",
      "Idempotency key was reused with a different payload",
    );
  }
  if (error.message === "Ledger posting request was not found") {
    throw new ApiHttpError(
      404,
      "LEDGER_POSTING_REQUEST_NOT_FOUND",
      "Ledger posting request was not found",
    );
  }
  if (error.message === "Ledger posting request is not pending approval") {
    throw new ApiHttpError(
      409,
      "LEDGER_POSTING_REQUEST_NOT_PENDING",
      "Ledger posting request is not pending approval",
    );
  }
  if (error.message === "Trust transaction would overdraw the client matter balance") {
    throw new ApiHttpError(
      409,
      "TRUST_POSTING_REQUEST_OVERDRAFT",
      "Trust posting request would overdraw the client matter balance",
    );
  }
  if (error.message === "Ledger posting request requires checker approval by a different user") {
    throw new ApiHttpError(
      403,
      "LEDGER_POSTING_REQUEST_SELF_APPROVAL_DENIED",
      "Ledger posting request requires checker approval by a different user",
    );
  }
}
