import cors from "@fastify/cors";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { jwtVerify } from "jose";
import { z } from "zod";
import {
  createDatabaseRuntime,
  DrizzleOpenPracticeRepository,
  InMemoryOpenPracticeRepository,
  seedSampleData,
  type OpenPracticeRepository,
} from "@open-practice/database";
import {
  canAccess,
  canShareDocumentThroughPortal,
  assertBillingStatusTransition,
  calculateInvoiceTotals,
  createInvoiceLineTotals,
  dashboardCapabilities,
  getSignatureProviderEventReplayMetadata,
  isBillableUnbilled,
  type AccessRequest,
} from "@open-practice/domain";
import type {
  AnswerSnapshotRecord,
  DocumentAutomationProvider,
  ExpenseEntry,
  InvoiceLineRecord,
  InvoiceRecord,
  IntakeSessionRecord,
  LedgerReconciliationRecord,
  LedgerTransaction,
  LedgerTransactionApprovalRecord,
  ManualPaymentRecord,
  PaymentAllocationRecord,
  SignatureProvider,
  SignatureProviderEventRecord,
  SignatureProviderStatus,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  SignatureWebhookAttemptRecord,
  TimeEntry,
  TrustTransferRequestRecord,
  User,
} from "@open-practice/domain";
import {
  DocassembleAutomationProvider,
  DocuSealSignatureProvider,
  ManualSignatureProvider,
} from "@open-practice/providers";

const envSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().optional(),
  OPEN_PRACTICE_USE_MEMORY_REPO: z.coerce.boolean().default(false),
  OPEN_PRACTICE_DEV_SEED: z.coerce.boolean().default(false),
  AUTH_JWT_SECRET: z.string().min(16).optional(),
  DEV_AUTH_USER_ID: z.string().default("user-admin"),
  DEV_AUTH_FIRM_ID: z.string().default("firm-west-legal"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("local"),
  S3_BUCKET: z.string().default("open-practice-documents"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  DOCUSEAL_BASE_URL: z.string().url().optional(),
  DOCUSEAL_API_KEY: z.string().optional(),
  DOCUSEAL_WEBHOOK_SECRET_HEADER: z.string().min(1).optional(),
  DOCUSEAL_WEBHOOK_SECRET_VALUE: z.string().min(1).optional(),
  DOCUSEAL_WEBHOOK_REPLAY_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
  DOCASSEMBLE_BASE_URL: z.string().url().optional(),
  DOCASSEMBLE_API_KEY: z.string().optional(),
  DOCASSEMBLE_RETURN_URL: z.string().url().optional(),
});

const conflictBodySchema = z.object({
  prospectiveName: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  identifiers: z.array(z.object({ type: z.string().min(1), value: z.string().min(1) })).optional(),
  prospectiveRole: z.enum(["client", "opposing_party", "third_party"]).optional(),
  includeClosedMatters: z.boolean().default(true),
});

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

const timeEntryBodySchema = z.object({
  id: z.string().min(1).optional(),
  matterId: z.string().min(1),
  userId: z.string().min(1).optional(),
  performedAt: z.string().datetime().optional(),
  minutes: z.number().int().positive(),
  rateCents: z.number().int().nonnegative(),
  narrative: z.string().min(1),
  billable: z.boolean().default(true),
  billingStatus: z
    .enum(["draft", "submitted", "approved", "billed", "written_off"])
    .default("draft"),
});

const timeEntryPatchBodySchema = timeEntryBodySchema
  .omit({ id: true, matterId: true, userId: true })
  .partial();

const expenseEntryBodySchema = z.object({
  id: z.string().min(1).optional(),
  matterId: z.string().min(1),
  incurredAt: z.string().datetime().optional(),
  amountCents: z.number().int().positive(),
  category: z.string().min(1),
  description: z.string().min(1),
  reimbursable: z.boolean().default(true),
  billingStatus: z
    .enum(["draft", "submitted", "approved", "billed", "written_off"])
    .default("draft"),
});

const expenseEntryPatchBodySchema = expenseEntryBodySchema
  .omit({ id: true, matterId: true })
  .partial();

const billingEntryQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(["draft", "submitted", "approved", "billed", "written_off"]).optional(),
});

const invoiceQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(["draft", "approved", "issued", "partially_paid", "paid", "void"]).optional(),
});

const invoiceBodySchema = z.object({
  id: z.string().min(1).optional(),
  matterId: z.string().min(1),
  clientContactId: z.string().min(1).optional(),
  invoiceNumber: z.string().min(1).optional(),
  dueAt: z.string().datetime().optional(),
  memo: z.string().min(1).optional(),
  timeEntryIds: z.array(z.string().min(1)).default([]),
  expenseEntryIds: z.array(z.string().min(1)).default([]),
  adjustmentLines: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().int().positive().default(1),
        unitAmountCents: z.number().int(),
        taxName: z.string().min(1).optional(),
        taxRateBps: z.number().int().nonnegative().default(0),
      }),
    )
    .default([]),
  taxName: z.string().min(1).optional(),
  taxRateBps: z.number().int().nonnegative().default(0),
});

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

const billingTrustTransferRequestBodySchema = z.object({
  id: z.string().min(1).optional(),
  matterId: z.string().min(1),
  invoiceId: z.string().min(1),
  clientContactId: z.string().min(1).optional(),
  amountCents: z.number().int().positive(),
  reason: z.string().min(1).optional(),
  status: z
    .enum(["pending_approval", "approved", "rejected", "linked", "cancelled"])
    .default("pending_approval"),
  ledgerTransactionId: z.string().min(1).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const trustTransferRequestQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(["pending_approval", "approved", "rejected", "linked", "cancelled"]).optional(),
});

const presignQuerySchema = z.object({
  matterId: z.string().min(1),
  filename: z.string().min(1),
  checksumSha256: z.string().min(16).default("pending-client-checksum"),
  supersedesDocumentId: z.string().min(1).optional(),
  classification: z
    .enum(["general", "privileged", "work_product", "financial", "identity"])
    .default("general"),
  legalHold: z.coerce.boolean().default(false),
});

const uploadCompleteBodySchema = z.object({
  checksumSha256: z.string().min(16),
  scanStatus: z.enum(["pending", "queued", "passed", "failed", "not_required"]).default("queued"),
});

const documentScanStatusBodySchema = z.object({
  scanStatus: z.enum(["pending", "queued", "passed", "failed", "not_required"]),
});

const signatureRequestBodySchema = z.object({
  matterId: z.string().min(1),
  documentId: z.string().min(1),
  title: z.string().min(1),
  consentText: z.string().min(1),
  signers: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.string().min(1),
      }),
    )
    .min(1),
});

const signatureProviderEventBodySchema = z.object({
  signatureRequestId: z.string().min(1),
  provider: z.enum(["docuseal", "manual"]),
  externalId: z.string().min(1),
  status: z.enum([
    "draft",
    "pending_provider_submission",
    "sent",
    "viewed",
    "completed",
    "declined",
    "provider_error",
  ]),
  occurredAt: z.string().datetime().optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const intakeSessionBodySchema = z.object({
  matterId: z.string().min(1),
  templateId: z.string().min(1).default("intake-template-001"),
  clientContactId: z.string().min(1).optional(),
  interviewUrl: z.string().url().optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const generatedDocumentBodySchema = z.object({
  title: z.string().min(1),
  externalId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  storageKey: z.string().min(1).optional(),
  checksumSha256: z.string().min(16).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const answerSnapshotBodySchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  capturedAt: z.string().datetime().optional(),
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

const docusealWebhookBodySchema = z.record(z.string(), z.unknown());

export interface ApiAuthContext {
  user: User;
  firmId: string;
}

interface ApiOptions {
  repository: OpenPracticeRepository;
  jwtSecret?: string;
  devUserId: string;
  devFirmId: string;
  signatureProvider?: SignatureProvider;
  automationProvider?: DocumentAutomationProvider;
  automationReturnUrl?: string;
  docusealWebhook?: {
    secretHeader: string;
    secretValue: string;
    replayWindowSeconds: number;
  };
  s3?: {
    client: S3Client;
    bucket: string;
  };
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function authenticate(
  request: FastifyRequest,
  repository: OpenPracticeRepository,
  options: Pick<ApiOptions, "jwtSecret" | "devFirmId" | "devUserId">,
): Promise<ApiAuthContext> {
  const authorization = request.headers.authorization;
  let firmId = options.devFirmId;
  let userId = options.devUserId;

  if (authorization?.startsWith("Bearer ")) {
    if (!options.jwtSecret) {
      throw Object.assign(new Error("JWT authentication is not configured"), { statusCode: 503 });
    }
    const secret = new TextEncoder().encode(options.jwtSecret);
    const { payload } = await jwtVerify(authorization.slice("Bearer ".length), secret);
    firmId = z.string().parse(payload.firmId);
    userId = z.string().parse(payload.sub);
  } else if (request.headers["x-open-practice-user-id"]) {
    userId = z.string().parse(request.headers["x-open-practice-user-id"]);
    firmId = z.string().parse(request.headers["x-open-practice-firm-id"] ?? options.devFirmId);
  } else if (process.env.NODE_ENV === "production") {
    throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  }

  const user = await repository.getUser(firmId, userId);
  if (!user) {
    throw Object.assign(new Error("Authenticated user was not found"), { statusCode: 401 });
  }
  return { user, firmId };
}

function requireAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  if (!canAccess({ ...request, user: context.user, firmId: context.firmId })) {
    throw Object.assign(new Error("Matter access required"), { statusCode: 403 });
  }
}

function hasFirmWideLedgerAccess(user: User): boolean {
  return ["owner_admin", "auditor", "billing_bookkeeper"].includes(user.role);
}

function readString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function readPayloadString(payload: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readString(payload[key]);
    if (value) return value;
  }
  const metadata = payload.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    for (const key of keys) {
      const value = readString((metadata as Record<string, unknown>)[key]);
      if (value) return value;
    }
  }
  const submission = payload.submission;
  if (submission && typeof submission === "object" && !Array.isArray(submission)) {
    for (const key of keys) {
      const value = readString((submission as Record<string, unknown>)[key]);
      if (value) return value;
    }
  }
  return undefined;
}

function mapDocuSealWebhookStatus(payload: Record<string, unknown>): SignatureProviderStatus {
  const status = readPayloadString(payload, ["status", "event", "event_type", "type"]);
  if (status === "completed" || status === "complete_form" || status === "api_complete_form") {
    return "completed";
  }
  if (status === "declined" || status === "decline_form") return "declined";
  if (status === "opened" || status === "viewed" || status === "view_form") return "viewed";
  if (status === "pending" || status === "sent" || status === "invite_party") return "sent";
  return "provider_error";
}

function payloadReplayKey(payload: Record<string, unknown>, fallback: string): string {
  return (
    readPayloadString(payload, [
      "eventId",
      "event_id",
      "webhookId",
      "webhook_id",
      "deliveryId",
      "delivery_id",
      "id",
    ]) ?? fallback
  );
}

function sameReplayKey(attempt: SignatureWebhookAttemptRecord, replayKey: string): boolean {
  return attempt.payload.replayKey === replayKey;
}

export function createApiServer(options: ApiOptions): FastifyInstance {
  const server = Fastify({ logger: true });

  server.register(cors, {
    origin: [/^http:\/\/localhost:\d+$/],
  });

  server.get("/health", async () => ({
    ok: true,
    service: "open-practice-api",
    persistence:
      options.repository instanceof InMemoryOpenPracticeRepository ? "memory" : "postgres",
  }));

  server.addHook("preHandler", async (request) => {
    if (request.url === "/health") return;
    if (
      request.method === "POST" &&
      request.url.startsWith("/api/signature-requests/webhooks/docuseal")
    ) {
      return;
    }
    request.auth = await authenticate(request, options.repository, options);
  });

  server.get("/api/session", async (request) => ({ user: request.auth.user }));

  server.get("/api/capabilities", async (request) => ({
    sections: dashboardCapabilities({
      user: request.auth.user,
      firmId: request.auth.firmId,
      matterId: request.auth.user.assignedMatterIds[0],
    }),
  }));

  server.get("/api/overview", async (request) =>
    options.repository.getOverview(request.auth.firmId),
  );

  server.get("/api/matters", async (request) =>
    options.repository.listMattersForUser(request.auth.user),
  );

  server.post("/api/conflicts/check", async (request) => {
    requireAccess(request.auth, { resource: "contact", action: "read" });
    const body = conflictBodySchema.parse(request.body);
    return options.repository.runConflictCheck({
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      ...body,
    });
  });

  server.get("/api/ledger", async (request) => {
    const query = ledgerQuerySchema.parse(request.query);
    if (!query.matterId && !hasFirmWideLedgerAccess(request.auth.user)) {
      throw Object.assign(new Error("matterId is required for matter-scoped ledger access"), {
        statusCode: 400,
      });
    }
    requireAccess(request.auth, {
      resource: "trust_ledger",
      action: "read",
      matterId: query.matterId,
    });
    return options.repository.getLedger(request.auth.firmId, query);
  });

  server.post("/api/ledger/transactions", async (request) => {
    requireAccess(request.auth, {
      resource: "trust_ledger",
      action: "create",
      matterId: request.auth.user.assignedMatterIds[0],
    });
    const body = ledgerPostBodySchema.parse(request.body);
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
    await options.repository.validateLedgerTransactionScope({
      user: request.auth.user,
      transaction,
    });
    return options.repository.postLedgerTransaction(transaction);
  });

  server.post("/api/ledger/transactions/:id/approvals", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    requireAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
      matterId: request.auth.user.assignedMatterIds[0],
    });
    const body = ledgerApprovalBodySchema.parse(request.body);
    const approval: LedgerTransactionApprovalRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      transactionId: params.id,
      decidedByUserId: request.auth.user.id,
      decision: body.decision,
      decidedAt: body.decidedAt ?? new Date().toISOString(),
      notes: body.notes,
    };
    return options.repository.createLedgerTransactionApproval(approval);
  });

  server.post("/api/ledger/reconciliations", async (request) => {
    requireAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
      matterId: request.auth.user.assignedMatterIds[0],
    });
    const body = ledgerReconciliationBodySchema.parse(request.body);
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
    return options.repository.createLedgerReconciliation(reconciliation);
  });

  server.get("/api/time-entries", async (request) => {
    const query = billingEntryQuerySchema.parse(request.query);
    if (query.matterId) {
      requireAccess(request.auth, {
        resource: "time_entry",
        action: "read",
        matterId: query.matterId,
      });
      return { entries: await options.repository.listTimeEntries(request.auth.firmId, query) };
    }

    if (["owner_admin", "billing_bookkeeper", "auditor"].includes(request.auth.user.role)) {
      return { entries: await options.repository.listTimeEntries(request.auth.firmId, query) };
    }

    const entries = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          options.repository.listTimeEntries(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { entries };
  });

  server.post("/api/time-entries", async (request) => {
    const body = timeEntryBodySchema.parse(request.body);
    requireAccess(request.auth, {
      resource: "time_entry",
      action: "create",
      matterId: body.matterId,
    });
    const entry: TimeEntry = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      userId: body.userId ?? request.auth.user.id,
      performedAt: body.performedAt ?? new Date().toISOString(),
      minutes: body.minutes,
      rateCents: body.rateCents,
      narrative: body.narrative,
      billable: body.billable,
      billingStatus: body.billingStatus,
    };
    return options.repository.createTimeEntry(entry);
  });

  server.patch("/api/time-entries/:id", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const existing = await options.repository.getTimeEntry(request.auth.firmId, params.id);
    if (!existing) throw Object.assign(new Error("Time entry was not found"), { statusCode: 404 });
    requireAccess(request.auth, {
      resource: "time_entry",
      action: "update",
      matterId: existing.matterId,
    });
    if (["billed", "written_off"].includes(existing.billingStatus)) {
      throw Object.assign(new Error("Finalized time entries cannot be edited"), {
        statusCode: 409,
      });
    }
    const body = timeEntryPatchBodySchema.parse(request.body);
    return options.repository.updateTimeEntry(request.auth.firmId, params.id, body);
  });

  for (const [route, nextStatus] of [
    ["submit", "submitted"],
    ["approve", "approved"],
    ["write-off", "written_off"],
  ] as const) {
    server.post(`/api/time-entries/:id/${route}`, async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const existing = await options.repository.getTimeEntry(request.auth.firmId, params.id);
      if (!existing)
        throw Object.assign(new Error("Time entry was not found"), { statusCode: 404 });
      requireAccess(request.auth, {
        resource: "time_entry",
        action: route === "approve" ? "approve" : "update",
        matterId: existing.matterId,
      });
      assertBillingStatusTransition(existing.billingStatus, nextStatus);
      return options.repository.updateTimeEntry(request.auth.firmId, params.id, {
        billingStatus: nextStatus,
      });
    });
  }

  server.get("/api/expense-entries", async (request) => {
    const query = billingEntryQuerySchema.parse(request.query);
    if (query.matterId) {
      requireAccess(request.auth, {
        resource: "expense_entry",
        action: "read",
        matterId: query.matterId,
      });
      return { entries: await options.repository.listExpenseEntries(request.auth.firmId, query) };
    }

    if (["owner_admin", "billing_bookkeeper", "auditor"].includes(request.auth.user.role)) {
      return { entries: await options.repository.listExpenseEntries(request.auth.firmId, query) };
    }

    const entries = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          options.repository.listExpenseEntries(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { entries };
  });

  server.post("/api/expense-entries", async (request) => {
    const body = expenseEntryBodySchema.parse(request.body);
    requireAccess(request.auth, {
      resource: "expense_entry",
      action: "create",
      matterId: body.matterId,
    });
    const entry: ExpenseEntry = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      incurredAt: body.incurredAt ?? new Date().toISOString(),
      amountCents: body.amountCents,
      category: body.category,
      description: body.description,
      reimbursable: body.reimbursable,
      billingStatus: body.billingStatus,
    };
    return options.repository.createExpenseEntry(entry);
  });

  server.patch("/api/expense-entries/:id", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const existing = await options.repository.getExpenseEntry(request.auth.firmId, params.id);
    if (!existing)
      throw Object.assign(new Error("Expense entry was not found"), { statusCode: 404 });
    requireAccess(request.auth, {
      resource: "expense_entry",
      action: "update",
      matterId: existing.matterId,
    });
    if (["billed", "written_off"].includes(existing.billingStatus)) {
      throw Object.assign(new Error("Finalized expense entries cannot be edited"), {
        statusCode: 409,
      });
    }
    const body = expenseEntryPatchBodySchema.parse(request.body);
    return options.repository.updateExpenseEntry(request.auth.firmId, params.id, body);
  });

  for (const [route, nextStatus] of [
    ["submit", "submitted"],
    ["approve", "approved"],
    ["write-off", "written_off"],
  ] as const) {
    server.post(`/api/expense-entries/:id/${route}`, async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const existing = await options.repository.getExpenseEntry(request.auth.firmId, params.id);
      if (!existing)
        throw Object.assign(new Error("Expense entry was not found"), { statusCode: 404 });
      requireAccess(request.auth, {
        resource: "expense_entry",
        action: route === "approve" ? "approve" : "update",
        matterId: existing.matterId,
      });
      assertBillingStatusTransition(existing.billingStatus, nextStatus);
      return options.repository.updateExpenseEntry(request.auth.firmId, params.id, {
        billingStatus: nextStatus,
      });
    });
  }

  server.get("/api/invoices", async (request) => {
    const query = invoiceQuerySchema.parse(request.query);
    if (query.matterId) {
      requireAccess(request.auth, {
        resource: "time_entry",
        action: "read",
        matterId: query.matterId,
      });
      return { invoices: await options.repository.listInvoices(request.auth.firmId, query) };
    }

    if (["owner_admin", "billing_bookkeeper", "auditor"].includes(request.auth.user.role)) {
      return { invoices: await options.repository.listInvoices(request.auth.firmId, query) };
    }

    const invoices = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          options.repository.listInvoices(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { invoices };
  });

  server.post("/api/invoices", async (request) => {
    const body = invoiceBodySchema.parse(request.body);
    requireAccess(request.auth, {
      resource: "time_entry",
      action: "create",
      matterId: body.matterId,
    });
    requireAccess(request.auth, {
      resource: "expense_entry",
      action: "create",
      matterId: body.matterId,
    });
    const availableTimeEntries = await options.repository.listTimeEntries(request.auth.firmId, {
      matterId: body.matterId,
    });
    const availableExpenseEntries = await options.repository.listExpenseEntries(
      request.auth.firmId,
      {
        matterId: body.matterId,
      },
    );
    const timeEntries = availableTimeEntries.filter((entry) =>
      body.timeEntryIds.includes(entry.id),
    );
    const expenseEntries = availableExpenseEntries.filter((entry) =>
      body.expenseEntryIds.includes(entry.id),
    );
    if (
      timeEntries.length !== body.timeEntryIds.length ||
      expenseEntries.length !== body.expenseEntryIds.length
    ) {
      throw Object.assign(new Error("Invoice entries must belong to the requested matter"), {
        statusCode: 400,
      });
    }
    if (![...timeEntries, ...expenseEntries].every(isBillableUnbilled)) {
      throw Object.assign(new Error("Only approved unbilled entries can be invoiced"), {
        statusCode: 409,
      });
    }
    const now = new Date().toISOString();
    const lines: InvoiceLineRecord[] = [
      ...timeEntries.map((entry) => {
        const totals = createInvoiceLineTotals({
          quantity: entry.minutes,
          unitAmountCents: Math.round(entry.rateCents / 60),
          taxRateBps: body.taxRateBps,
        });
        return {
          id: crypto.randomUUID(),
          firmId: request.auth.firmId,
          invoiceId: body.id ?? "",
          matterId: body.matterId,
          kind: "time" as const,
          description: entry.narrative,
          quantity: entry.minutes,
          unitAmountCents: Math.round(entry.rateCents / 60),
          taxName: body.taxName,
          taxRateBps: body.taxRateBps,
          timeEntryId: entry.id,
          createdAt: now,
          ...totals,
        };
      }),
      ...expenseEntries.map((entry) => {
        const totals = createInvoiceLineTotals({
          quantity: 1,
          unitAmountCents: entry.amountCents,
          taxRateBps: body.taxRateBps,
        });
        return {
          id: crypto.randomUUID(),
          firmId: request.auth.firmId,
          invoiceId: body.id ?? "",
          matterId: body.matterId,
          kind: "expense" as const,
          description: entry.description,
          quantity: 1,
          unitAmountCents: entry.amountCents,
          taxName: body.taxName,
          taxRateBps: body.taxRateBps,
          expenseEntryId: entry.id,
          createdAt: now,
          ...totals,
        };
      }),
      ...body.adjustmentLines.map((line) => {
        const totals = createInvoiceLineTotals(line);
        return {
          id: crypto.randomUUID(),
          firmId: request.auth.firmId,
          invoiceId: body.id ?? "",
          matterId: body.matterId,
          kind: "adjustment" as const,
          description: line.description,
          quantity: line.quantity,
          unitAmountCents: line.unitAmountCents,
          taxName: line.taxName,
          taxRateBps: line.taxRateBps,
          createdAt: now,
          ...totals,
        };
      }),
    ];
    const invoiceId = body.id ?? crypto.randomUUID();
    const invoiceLines = lines.map((line) => ({ ...line, invoiceId }));
    const totals = calculateInvoiceTotals({ lines: invoiceLines, allocations: [] });
    const invoice: InvoiceRecord = {
      id: invoiceId,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      clientContactId: body.clientContactId,
      invoiceNumber: body.invoiceNumber ?? `INV-${invoiceId.slice(0, 8)}`,
      status: "draft",
      dueAt: body.dueAt,
      memo: body.memo,
      createdByUserId: request.auth.user.id,
      createdAt: now,
      ...totals,
    };
    return options.repository.createInvoice({ invoice, lines: invoiceLines });
  });

  server.get("/api/invoices/:id", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const invoice = await options.repository.getInvoice(request.auth.firmId, params.id);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    requireAccess(request.auth, {
      resource: "time_entry",
      action: "read",
      matterId: invoice.matterId,
    });
    return invoice;
  });

  server.post("/api/invoices/:id/approve", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const invoice = await options.repository.getInvoice(request.auth.firmId, params.id);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    requireAccess(request.auth, {
      resource: "time_entry",
      action: "approve",
      matterId: invoice.matterId,
    });
    if (invoice.status !== "draft") {
      throw Object.assign(new Error("Only draft invoices can be approved"), { statusCode: 409 });
    }
    for (const line of invoice.lines) {
      if (line.timeEntryId) {
        await options.repository.updateTimeEntry(request.auth.firmId, line.timeEntryId, {
          billingStatus: "billed",
        });
      }
      if (line.expenseEntryId) {
        await options.repository.updateExpenseEntry(request.auth.firmId, line.expenseEntryId, {
          billingStatus: "billed",
        });
      }
    }
    return options.repository.updateInvoice({
      ...invoice,
      status: "approved",
      approvedAt: new Date().toISOString(),
    });
  });

  server.post("/api/invoices/:id/issue", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const invoice = await options.repository.getInvoice(request.auth.firmId, params.id);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    requireAccess(request.auth, {
      resource: "time_entry",
      action: "update",
      matterId: invoice.matterId,
    });
    if (invoice.status !== "approved") {
      throw Object.assign(new Error("Only approved invoices can be issued"), { statusCode: 409 });
    }
    return options.repository.updateInvoice({
      ...invoice,
      status: "issued",
      issuedAt: new Date().toISOString(),
    });
  });

  server.post("/api/invoices/:id/void", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const invoice = await options.repository.getInvoice(request.auth.firmId, params.id);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    requireAccess(request.auth, {
      resource: "time_entry",
      action: "delete",
      matterId: invoice.matterId,
    });
    if (invoice.status === "paid") {
      throw Object.assign(new Error("Paid invoices cannot be voided"), { statusCode: 409 });
    }
    return options.repository.updateInvoice({
      ...invoice,
      status: "void",
      voidedAt: new Date().toISOString(),
    });
  });

  server.get("/api/payments", async (request) => {
    const query = paymentQuerySchema.parse(request.query);
    if (query.matterId) {
      requireAccess(request.auth, {
        resource: "expense_entry",
        action: "read",
        matterId: query.matterId,
      });
      return { payments: await options.repository.listPayments(request.auth.firmId, query) };
    }

    if (["owner_admin", "billing_bookkeeper", "auditor"].includes(request.auth.user.role)) {
      return { payments: await options.repository.listPayments(request.auth.firmId, query) };
    }

    const payments = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          options.repository.listPayments(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { payments };
  });

  server.post("/api/payments", async (request) => {
    const body = paymentBodySchema.parse(request.body);
    requireAccess(request.auth, {
      resource: "expense_entry",
      action: "create",
      matterId: body.matterId,
    });
    const invoice = await options.repository.getInvoice(request.auth.firmId, body.invoiceId);
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
      status: "received",
      receivedByUserId: request.auth.user.id,
      notes: body.notes,
      evidence: body.evidence,
    };
    const allocation: PaymentAllocationRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      paymentId: payment.id,
      invoiceId: invoice.id,
      amountCents: body.amountCents,
      allocatedAt: now,
    };
    return options.repository.createPayment({ payment, allocations: [allocation] });
  });

  server.get("/api/billing/trust-transfer-requests", async (request) => {
    const query = trustTransferRequestQuerySchema.parse(request.query);
    if (query.matterId) {
      requireAccess(request.auth, {
        resource: "trust_ledger",
        action: "read",
        matterId: query.matterId,
      });
      return {
        requests: await options.repository.listTrustTransferRequests(request.auth.firmId, query),
      };
    }

    if (hasFirmWideLedgerAccess(request.auth.user)) {
      return {
        requests: await options.repository.listTrustTransferRequests(request.auth.firmId, query),
      };
    }

    const requests = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          options.repository.listTrustTransferRequests(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { requests };
  });

  server.post("/api/billing/trust-transfer-requests", async (request) => {
    const body = billingTrustTransferRequestBodySchema.parse(request.body);
    requireAccess(request.auth, {
      resource: "trust_ledger",
      action: "create",
      matterId: body.matterId,
    });
    const invoice = await options.repository.getInvoice(request.auth.firmId, body.invoiceId);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    if (invoice.matterId !== body.matterId) {
      throw Object.assign(new Error("Trust transfer invoice must belong to the matter"), {
        statusCode: 400,
      });
    }
    const requestRecord: TrustTransferRequestRecord = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      clientContactId: body.clientContactId,
      invoiceId: body.invoiceId,
      amountCents: body.amountCents,
      reason: body.reason,
      status: body.status,
      requestedByUserId: request.auth.user.id,
      requestedAt: new Date().toISOString(),
      ledgerTransactionId: body.ledgerTransactionId,
      evidence: body.evidence,
    };
    return options.repository.createTrustTransferRequest(requestRecord);
  });

  server.get("/api/billing/dashboard", async (request) => {
    if (!["owner_admin", "billing_bookkeeper", "auditor"].includes(request.auth.user.role)) {
      throw Object.assign(new Error("Billing dashboard access required"), { statusCode: 403 });
    }
    const matters = await options.repository.listMattersForUser(request.auth.user);
    const matterIds = matters.map((matter) => matter.id);
    const [timeEntries, expenseEntries, invoices, payments] = await Promise.all([
      options.repository.listTimeEntries(request.auth.firmId),
      options.repository.listExpenseEntries(request.auth.firmId),
      options.repository.listInvoices(request.auth.firmId),
      options.repository.listPayments(request.auth.firmId),
    ]);
    const matterSummaries = matterIds.map((matterId) => {
      const unbilledTime = timeEntries
        .filter((entry) => entry.matterId === matterId && entry.billingStatus === "approved")
        .map((entry) => ({
          id: entry.id,
          matterId: entry.matterId,
          userId: entry.userId,
          minutes: entry.minutes,
          rateCents: entry.rateCents,
          amountCents: Math.round((entry.minutes * entry.rateCents) / 60),
          narrative: entry.narrative,
          status: entry.billingStatus,
        }));
      const unbilledExpenses = expenseEntries
        .filter((entry) => entry.matterId === matterId && entry.billingStatus === "approved")
        .map((entry) => ({
          id: entry.id,
          matterId: entry.matterId,
          amountCents: entry.amountCents,
          category: entry.category,
          description: entry.description,
          status: entry.billingStatus,
        }));
      return {
        matterId,
        unbilledTime,
        unbilledExpenses,
        invoices: invoices
          .filter((invoice) => invoice.matterId === matterId)
          .map((invoice) => ({
            id: invoice.id,
            matterId: invoice.matterId,
            number: invoice.invoiceNumber,
            status: invoice.status,
            totalCents: invoice.totalCents,
            balanceDueCents: invoice.balanceDueCents,
            issuedAt: invoice.issuedAt,
            dueAt: invoice.dueAt,
          })),
        payments: payments
          .filter((payment) => payment.matterId === matterId)
          .map((payment) => ({
            id: payment.id,
            matterId: payment.matterId,
            invoiceId: payment.invoiceId,
            amountCents: payment.amountCents,
            method: payment.method,
            receivedAt: payment.receivedAt,
            reference: payment.reference,
          })),
      };
    });
    return {
      canView: true,
      summary: {
        unbilledTimeCents: matterSummaries.reduce(
          (sum, matter) =>
            sum +
            matter.unbilledTime.reduce((matterSum, entry) => matterSum + entry.amountCents, 0),
          0,
        ),
        unbilledExpenseCents: matterSummaries.reduce(
          (sum, matter) =>
            sum +
            matter.unbilledExpenses.reduce((matterSum, entry) => matterSum + entry.amountCents, 0),
          0,
        ),
        draftInvoiceCents: invoices
          .filter((invoice) => invoice.status === "draft")
          .reduce((sum, invoice) => sum + invoice.totalCents, 0),
        issuedBalanceDueCents: invoices
          .filter((invoice) => ["issued", "partially_paid"].includes(invoice.status))
          .reduce((sum, invoice) => sum + invoice.balanceDueCents, 0),
      },
      matters: matterSummaries,
    };
  });

  server.get("/api/audit", async (request) => {
    requireAccess(request.auth, { resource: "audit_log", action: "read" });
    return options.repository.listAuditEvents(request.auth.firmId);
  });

  server.get("/api/documents/presign-upload", async (request) => {
    const query = presignQuerySchema.parse(request.query);
    requireAccess(request.auth, {
      resource: "document",
      action: "create",
      matterId: query.matterId,
    });
    if (!options.s3) {
      throw Object.assign(new Error("S3 upload signing is not configured"), { statusCode: 503 });
    }

    const documentId = crypto.randomUUID();
    const storageKey = `matters/${query.matterId}/${documentId}-${sanitizeFilename(query.filename)}`;
    const command = new PutObjectCommand({
      Bucket: options.s3.bucket,
      Key: storageKey,
      ChecksumSHA256:
        query.checksumSha256 === "pending-client-checksum" ? undefined : query.checksumSha256,
      Metadata: {
        "open-practice-matter-id": query.matterId,
        "open-practice-scan": "required-before-share",
      },
    });
    const uploadUrl = await getSignedUrl(options.s3.client, command, { expiresIn: 600 });
    const document = await options.repository.createDocumentUploadIntent({
      id: documentId,
      firmId: request.auth.firmId,
      matterId: query.matterId,
      title: query.filename,
      storageKey,
      checksumSha256: query.checksumSha256,
      classification: query.classification,
      legalHold: query.legalHold,
      supersedesDocumentId: query.supersedesDocumentId,
    });

    return {
      method: "PUT",
      uploadUrl,
      expiresInSeconds: 600,
      storageKey,
      document,
      requiredHeaders: {
        "x-open-practice-malware-scan": "required-before-share",
      },
    };
  });

  server.post("/api/documents/:id/upload-complete", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const document = await options.repository.getDocument(request.auth.firmId, params.id);
    if (!document) {
      throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
    }
    requireAccess(request.auth, {
      resource: "document",
      action: "update",
      matterId: document.matterId,
    });
    const body = uploadCompleteBodySchema.parse(request.body);
    return options.repository.completeDocumentUpload({
      firmId: request.auth.firmId,
      documentId: params.id,
      checksumSha256: body.checksumSha256,
      scanStatus: body.scanStatus,
    });
  });

  server.post("/api/documents/:id/scan-status", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const document = await options.repository.getDocument(request.auth.firmId, params.id);
    if (!document) {
      throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
    }
    requireAccess(request.auth, {
      resource: "document",
      action: "update",
      matterId: document.matterId,
    });
    const body = documentScanStatusBodySchema.parse(request.body);
    return options.repository.updateDocumentScanStatus({
      firmId: request.auth.firmId,
      documentId: params.id,
      scanStatus: body.scanStatus,
    });
  });

  server.get("/api/signature-requests", async (request) => {
    const query = ledgerQuerySchema.parse(request.query);
    if (query.matterId) {
      requireAccess(request.auth, {
        resource: "signature_request",
        action: "read",
        matterId: query.matterId,
      });
      return options.repository.listSignatureRequests(request.auth.firmId, query);
    }
    if (request.auth.user.role === "owner_admin" || request.auth.user.role === "auditor") {
      requireAccess(request.auth, { resource: "signature_request", action: "read" });
      return options.repository.listSignatureRequests(request.auth.firmId);
    } else {
      const requests = await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) => {
          requireAccess(request.auth, {
            resource: "signature_request",
            action: "read",
            matterId,
          });
          return options.repository.listSignatureRequests(request.auth.firmId, { matterId });
        }),
      );
      return requests.flat();
    }
  });

  server.post("/api/signature-requests", async (request) => {
    const body = signatureRequestBodySchema.parse(request.body);
    requireAccess(request.auth, {
      resource: "signature_request",
      action: "create",
      matterId: body.matterId,
    });
    const document = await options.repository.getDocument(request.auth.firmId, body.documentId);
    if (!document || document.matterId !== body.matterId) {
      throw Object.assign(new Error("Document does not belong to the requested matter"), {
        statusCode: 400,
      });
    }

    const provider = options.signatureProvider ?? new ManualSignatureProvider();
    const submission = await provider.createSubmission(body);
    const now = new Date().toISOString();
    const requestRecord: SignatureRequestRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      documentId: body.documentId,
      title: body.title,
      requestedByUserId: request.auth.user.id,
      provider: submission.provider,
      externalId: submission.externalId,
      status: submission.status ?? "sent",
      signingUrl: submission.signingUrl,
      consentText: body.consentText,
      evidence: submission.evidence ?? {},
      createdAt: now,
    };
    const signers: SignatureRequestSignerRecord[] = body.signers.map((signer) => ({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      signatureRequestId: requestRecord.id,
      ...signer,
      status: requestRecord.status,
      signingUrl: submission.signingUrl,
    }));
    const event: SignatureProviderEventRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      signatureRequestId: requestRecord.id,
      provider: requestRecord.provider,
      externalId: requestRecord.externalId,
      status: requestRecord.status,
      occurredAt: now,
      evidence: requestRecord.evidence,
    };
    return options.repository.createSignatureRequest({ request: requestRecord, signers, event });
  });

  server.post("/api/signature-requests/provider-events", async (request) => {
    const body = signatureProviderEventBodySchema.parse(request.body);
    const signature = (await options.repository.listSignatureRequests(request.auth.firmId)).find(
      (candidate) => candidate.id === body.signatureRequestId,
    );
    if (!signature) {
      throw Object.assign(new Error("Signature request was not found"), { statusCode: 404 });
    }
    requireAccess(request.auth, {
      resource: "signature_request",
      action: "update",
      matterId: signature.matterId,
    });
    if (signature.provider !== body.provider || signature.externalId !== body.externalId) {
      throw Object.assign(new Error("Provider event does not match signature request"), {
        statusCode: 409,
      });
    }
    const event: SignatureProviderEventRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      signatureRequestId: body.signatureRequestId,
      provider: body.provider,
      externalId: body.externalId,
      status: body.status as SignatureProviderStatus,
      occurredAt: body.occurredAt ?? new Date().toISOString(),
      evidence: body.evidence,
    };
    const attempt: SignatureWebhookAttemptRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      provider: body.provider,
      externalId: body.externalId,
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      status: "processed",
      payload: body,
    };
    return options.repository.recordSignatureProviderEvent(event, attempt);
  });

  server.post("/api/signature-requests/webhooks/docuseal", async (request, reply) => {
    const payload = docusealWebhookBodySchema.parse(request.body);
    const firmId = readPayloadString(payload, ["firmId", "firm_id"]) ?? options.devFirmId;
    const externalId =
      readPayloadString(payload, ["externalId", "external_id", "submissionId", "submission_id"]) ??
      "unknown";
    const receivedAt = new Date().toISOString();
    const configured = options.docusealWebhook;
    const submittedSecret = configured
      ? readString(request.headers[configured.secretHeader.toLowerCase()])
      : undefined;
    const baseAttempt = {
      id: crypto.randomUUID(),
      firmId,
      provider: "docuseal" as const,
      externalId,
      receivedAt,
      payload,
    };

    if (!configured) {
      await options.repository.recordSignatureWebhookAttempt({
        ...baseAttempt,
        processedAt: receivedAt,
        status: "failed",
        errorMessage: "DocuSeal webhook verification is not configured",
      });
      throw Object.assign(new Error("DocuSeal webhook verification is not configured"), {
        statusCode: 503,
      });
    }

    if (submittedSecret !== configured.secretValue) {
      await options.repository.recordSignatureWebhookAttempt({
        ...baseAttempt,
        processedAt: receivedAt,
        status: "failed",
        errorMessage: "DocuSeal webhook secret did not match",
      });
      throw Object.assign(new Error("DocuSeal webhook secret did not match"), { statusCode: 401 });
    }

    const status = mapDocuSealWebhookStatus(payload);
    const occurredAt =
      readPayloadString(payload, ["occurredAt", "occurred_at", "createdAt", "created_at"]) ??
      receivedAt;
    const signatureRequestId = readPayloadString(payload, [
      "signatureRequestId",
      "signature_request_id",
    ]);
    const matchingRequest = signatureRequestId
      ? (await options.repository.listSignatureRequests(firmId)).find(
          (candidate) => candidate.id === signatureRequestId,
        )
      : (await options.repository.listSignatureRequests(firmId)).find(
          (candidate) => candidate.provider === "docuseal" && candidate.externalId === externalId,
        );

    if (!matchingRequest) {
      await options.repository.recordSignatureWebhookAttempt({
        ...baseAttempt,
        processedAt: receivedAt,
        status: "failed",
        errorMessage: "No matching signature request",
      });
      throw Object.assign(new Error("No matching signature request"), { statusCode: 404 });
    }
    if (matchingRequest.provider !== "docuseal" || matchingRequest.externalId !== externalId) {
      await options.repository.recordSignatureWebhookAttempt({
        ...baseAttempt,
        processedAt: receivedAt,
        status: "failed",
        errorMessage: "DocuSeal webhook request did not match provider submission",
      });
      throw Object.assign(new Error("DocuSeal webhook request did not match provider submission"), {
        statusCode: 409,
      });
    }

    const event: SignatureProviderEventRecord = {
      id: crypto.randomUUID(),
      firmId,
      signatureRequestId: matchingRequest.id,
      provider: "docuseal",
      externalId,
      status,
      occurredAt,
      evidence: payload,
    };
    const replayMetadata = getSignatureProviderEventReplayMetadata(event);
    const replayKey = payloadReplayKey(payload, replayMetadata.replayKey);
    const recentAttempts = await options.repository.listSignatureWebhookAttempts(firmId, {
      provider: "docuseal",
      externalId,
    });
    const replayWindowMs = configured.replayWindowSeconds * 1000;
    const duplicate = recentAttempts.some(
      (attempt) =>
        sameReplayKey(attempt, replayKey) &&
        Date.parse(receivedAt) - Date.parse(attempt.receivedAt) <= replayWindowMs,
    );

    const attempt: SignatureWebhookAttemptRecord = {
      ...baseAttempt,
      processedAt: receivedAt,
      status: duplicate ? "failed" : "processed",
      errorMessage: duplicate ? "Duplicate webhook replay" : undefined,
      payload: { ...payload, replayKey },
    };
    if (duplicate) {
      await options.repository.recordSignatureWebhookAttempt(attempt);
      return reply.status(202).send({ status: "duplicate", replayKey });
    }

    const recorded = await options.repository.recordSignatureProviderEvent(event, attempt);
    return { status: "processed", event: recorded, replayKey };
  });

  server.get("/api/signature-requests/:id/events", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const signature = (await options.repository.listSignatureRequests(request.auth.firmId)).find(
      (candidate) => candidate.id === params.id,
    );
    if (!signature) {
      throw Object.assign(new Error("Signature request was not found"), { statusCode: 404 });
    }
    requireAccess(request.auth, {
      resource: "signature_request",
      action: "read",
      matterId: signature.matterId,
    });
    return {
      events: await options.repository.listSignatureProviderEvents(request.auth.firmId, {
        signatureRequestId: params.id,
      }),
    };
  });

  server.get("/api/intake-sessions", async (request) => {
    const query = ledgerQuerySchema.parse(request.query);
    const templates = await options.repository.listIntakeTemplates(request.auth.firmId);
    if (query.matterId) {
      requireAccess(request.auth, {
        resource: "intake_session",
        action: "read",
        matterId: query.matterId,
      });
      return {
        templates,
        sessions: await options.repository.listIntakeSessions(request.auth.firmId, query),
      };
    }
    if (request.auth.user.role === "owner_admin" || request.auth.user.role === "auditor") {
      requireAccess(request.auth, { resource: "intake_session", action: "read" });
      return {
        templates,
        sessions: await options.repository.listIntakeSessions(request.auth.firmId),
      };
    }
    const sessions = await Promise.all(
      request.auth.user.assignedMatterIds.map((matterId) => {
        requireAccess(request.auth, {
          resource: "intake_session",
          action: "read",
          matterId,
        });
        return options.repository.listIntakeSessions(request.auth.firmId, { matterId });
      }),
    );
    return {
      templates,
      sessions: sessions.flat(),
    };
  });

  server.post("/api/intake-sessions", async (request) => {
    const body = intakeSessionBodySchema.parse(request.body);
    requireAccess(request.auth, {
      resource: "intake_session",
      action: "create",
      matterId: body.matterId,
    });
    const template = (await options.repository.listIntakeTemplates(request.auth.firmId)).find(
      (candidate) => candidate.id === body.templateId,
    );
    if (!template) {
      throw Object.assign(new Error("Intake template was not found"), { statusCode: 404 });
    }
    const now = new Date().toISOString();
    const providerRef =
      template.provider === "docassemble"
        ? await (async () => {
            if (!options.automationProvider) {
              throw Object.assign(new Error("docassemble automation is not configured"), {
                statusCode: 503,
              });
            }
            return options.automationProvider.startInterview({
              firmId: request.auth.firmId,
              matterId: body.matterId,
              templateId: template.externalTemplateId,
              clientContactId: body.clientContactId,
              returnUrl: options.automationReturnUrl,
              metadata: body.evidence,
            });
          })()
        : {
            provider: "manual" as const,
            externalId: `manual:${crypto.randomUUID()}`,
            interviewUrl: body.interviewUrl,
            status: "created" as const,
            evidence: body.evidence,
          };
    const session: IntakeSessionRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      templateId: body.templateId,
      provider: providerRef.provider,
      externalId: providerRef.externalId,
      status: providerRef.status,
      clientContactId: body.clientContactId,
      interviewUrl: providerRef.interviewUrl,
      evidence: providerRef.evidence ?? body.evidence,
      createdAt: now,
      updatedAt: now,
    };
    return options.repository.createIntakeSession(session);
  });

  server.get("/api/intake-sessions/:id/answer-snapshots", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const session = await options.repository.getIntakeSession(request.auth.firmId, params.id);
    if (!session)
      throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    requireAccess(request.auth, {
      resource: "intake_session",
      action: "read",
      matterId: session.matterId,
    });
    return {
      snapshots: await options.repository.listAnswerSnapshots(request.auth.firmId, {
        intakeSessionId: session.id,
      }),
    };
  });

  server.post("/api/intake-sessions/:id/answer-snapshots", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const session = await options.repository.getIntakeSession(request.auth.firmId, params.id);
    if (!session)
      throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    requireAccess(request.auth, {
      resource: "intake_session",
      action: "update",
      matterId: session.matterId,
    });
    const body = answerSnapshotBodySchema.parse(request.body);
    const snapshot: AnswerSnapshotRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      intakeSessionId: session.id,
      capturedAt: body.capturedAt ?? new Date().toISOString(),
      answers: body.answers,
    };
    return options.repository.createAnswerSnapshot(snapshot);
  });

  server.post("/api/intake-sessions/:id/generated-documents", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const session = await options.repository.getIntakeSession(request.auth.firmId, params.id);
    if (!session)
      throw Object.assign(new Error("Intake session was not found"), { statusCode: 404 });
    requireAccess(request.auth, {
      resource: "intake_session",
      action: "update",
      matterId: session.matterId,
    });
    const body = generatedDocumentBodySchema.parse(request.body);
    const generated =
      session.provider === "docassemble"
        ? await (async () => {
            if (!options.automationProvider) {
              throw Object.assign(new Error("docassemble automation is not configured"), {
                statusCode: 503,
              });
            }
            return options.automationProvider.renderDocument({
              firmId: request.auth.firmId,
              matterId: session.matterId,
              sessionExternalId: session.externalId,
              documentTitle: body.title,
            });
          })()
        : {
            provider: session.provider,
            externalId: body.externalId ?? `manual:${crypto.randomUUID()}`,
            title: body.title,
            storageKey: body.storageKey,
            checksumSha256: body.checksumSha256,
            evidence: body.evidence,
          };
    return options.repository.createGeneratedDocument({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: session.matterId,
      intakeSessionId: session.id,
      provider: generated.provider,
      externalId: generated.externalId,
      title: generated.title,
      documentId: body.documentId,
      storageKey: generated.storageKey ?? body.storageKey,
      checksumSha256: generated.checksumSha256 ?? body.checksumSha256,
      evidence: { ...body.evidence, ...(generated.evidence ?? {}) },
      createdAt: new Date().toISOString(),
    });
  });

  server.get("/api/queues", async (request) => {
    const matters = await options.repository.listMattersForUser(request.auth.user);
    const grants = await options.repository.listPortalGrants(request.auth.firmId);
    const signatures = await options.repository.listSignatureRequests(request.auth.firmId);
    const intake = await options.repository.listIntakeSessions(request.auth.firmId);
    const canReadAudit = canAccess({
      user: request.auth.user,
      firmId: request.auth.firmId,
      resource: "audit_log",
      action: "read",
    });
    const canReadFirmLedger = hasFirmWideLedgerAccess(request.auth.user);
    const audit = canReadAudit
      ? await options.repository.listAuditEvents(request.auth.firmId)
      : undefined;
    const reconciliations = canReadFirmLedger
      ? await options.repository.listLedgerReconciliations(request.auth.firmId)
      : [];
    const matterIds = new Set(matters.map((matter) => matter.id));
    const visibleSignatures = signatures.filter((signature) => matterIds.has(signature.matterId));
    const visibleIntake = intake.filter((session) => matterIds.has(session.matterId));
    const documents = matters.flatMap((matter) => matter.documents);

    return {
      sections: [
        {
          key: "matters",
          label: "Matter work",
          items: matters
            .filter((matter) => matter.status === "intake" || matter.activity.length === 0)
            .map((matter) => ({
              id: matter.id,
              matterId: matter.id,
              title: matter.title,
              status: matter.status,
              priority: matter.status === "intake" ? "medium" : "low",
            })),
        },
        {
          key: "documents",
          label: "Document review",
          items: documents
            .filter(
              (document) =>
                !grants.some((grant) => canShareDocumentThroughPortal({ document, grant })),
            )
            .map((document) => ({
              id: document.id,
              matterId: document.matterId,
              title: document.title,
              status: `${document.uploadStatus}/${document.checksumStatus}/${document.scanStatus}`,
              priority:
                document.legalHold ||
                document.checksumStatus === "mismatch" ||
                document.scanStatus === "failed"
                  ? "high"
                  : "medium",
            })),
        },
        {
          key: "signatures",
          label: "Signature follow-up",
          items: visibleSignatures
            .filter((signature) => !["completed", "declined"].includes(signature.status))
            .map((signature) => ({
              id: signature.id,
              matterId: signature.matterId,
              title: signature.title,
              status: signature.status,
              priority: signature.status === "provider_error" ? "high" : "medium",
            })),
        },
        {
          key: "intake",
          label: "Intake automation",
          items: visibleIntake
            .filter((session) => session.status !== "completed")
            .map((session) => ({
              id: session.id,
              matterId: session.matterId,
              title: session.templateId,
              status: session.status,
              priority: session.status === "provider_error" ? "high" : "medium",
            })),
        },
        {
          key: "ledger",
          label: "Ledger exceptions",
          items: reconciliations
            .filter((reconciliation) => reconciliation.status === "exception")
            .map((reconciliation) => ({
              id: reconciliation.id,
              title: reconciliation.accountId,
              status: reconciliation.status,
              priority: "high",
            })),
        },
        {
          key: "audit",
          label: "Audit review",
          items:
            !audit || audit.valid
              ? []
              : [
                  {
                    id: "audit-chain",
                    title: "Audit chain validation",
                    status: "invalid",
                    priority: "high",
                  },
                ],
        },
      ],
    };
  });

  server.setErrorHandler((error, _request, reply) => {
    server.log.error(error);
    const normalizedError = error as Error & { statusCode?: number };
    const statusCode =
      typeof normalizedError.statusCode === "number" ? normalizedError.statusCode : 400;
    reply.status(statusCode).send({
      error: normalizedError.name,
      message: normalizedError.message,
    });
  });

  return server;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: ApiAuthContext;
  }
}

async function createRepositoryFromEnv(env: z.infer<typeof envSchema>): Promise<{
  repository: OpenPracticeRepository;
  close?: () => Promise<void>;
}> {
  if (env.OPEN_PRACTICE_USE_MEMORY_REPO || !env.DATABASE_URL) {
    return { repository: new InMemoryOpenPracticeRepository() };
  }

  const runtime = createDatabaseRuntime(env.DATABASE_URL);
  if (env.OPEN_PRACTICE_DEV_SEED) {
    await seedSampleData(runtime.db);
  }
  return {
    repository: new DrizzleOpenPracticeRepository(runtime.db),
    close: runtime.close,
  };
}

function createS3FromEnv(env: z.infer<typeof envSchema>): ApiOptions["s3"] {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) return undefined;
  return {
    bucket: env.S3_BUCKET,
    client: new S3Client({
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    }),
  };
}

function createSignatureProviderFromEnv(env: z.infer<typeof envSchema>): SignatureProvider {
  if (env.DOCUSEAL_BASE_URL && env.DOCUSEAL_API_KEY) {
    return new DocuSealSignatureProvider(env.DOCUSEAL_BASE_URL, env.DOCUSEAL_API_KEY);
  }
  return new ManualSignatureProvider();
}

function createAutomationProviderFromEnv(
  env: z.infer<typeof envSchema>,
): DocumentAutomationProvider | undefined {
  if (env.DOCASSEMBLE_BASE_URL && env.DOCASSEMBLE_API_KEY) {
    return new DocassembleAutomationProvider(env.DOCASSEMBLE_BASE_URL, env.DOCASSEMBLE_API_KEY);
  }
  return undefined;
}

function createDocuSealWebhookOptions(
  env: z.infer<typeof envSchema>,
): ApiOptions["docusealWebhook"] {
  if (!env.DOCUSEAL_WEBHOOK_SECRET_HEADER || !env.DOCUSEAL_WEBHOOK_SECRET_VALUE) {
    return undefined;
  }
  return {
    secretHeader: env.DOCUSEAL_WEBHOOK_SECRET_HEADER,
    secretValue: env.DOCUSEAL_WEBHOOK_SECRET_VALUE,
    replayWindowSeconds: env.DOCUSEAL_WEBHOOK_REPLAY_WINDOW_SECONDS,
  };
}

if (process.env.NODE_ENV !== "test") {
  const env = envSchema.parse(process.env);
  const { repository, close } = await createRepositoryFromEnv(env);
  const server = createApiServer({
    repository,
    jwtSecret: env.AUTH_JWT_SECRET,
    devFirmId: env.DEV_AUTH_FIRM_ID,
    devUserId: env.DEV_AUTH_USER_ID,
    signatureProvider: createSignatureProviderFromEnv(env),
    automationProvider: createAutomationProviderFromEnv(env),
    automationReturnUrl: env.DOCASSEMBLE_RETURN_URL,
    docusealWebhook: createDocuSealWebhookOptions(env),
    s3: createS3FromEnv(env),
  });
  process.once("SIGTERM", () => void close?.());
  await server.listen({ host: "0.0.0.0", port: env.API_PORT });
}
