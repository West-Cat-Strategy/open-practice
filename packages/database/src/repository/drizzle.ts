import type {
  AnswerSnapshotRecord,
  DocumentTextExtractionRecord,
  GeneratedDocumentRecord,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  SignatureProviderEventRecord,
  SignatureProviderStatus,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  SignatureWebhookAttemptRecord,
} from "@open-practice/domain";
import {
  appendAuditEvent,
  buildBasicDraftTemplates,
  buildMatterSetupProfile,
  buildContactDossiers,
  buildPracticePresetTemplates,
  canAccess,
  billingPeriodLocksOverlap,
  billingRateRulesOverlapAtSameActiveScope,
  calculateInvoiceTotals,
  clientTrustBalanceByMatter,
  clientTrustBalanceDeltas,
  transitionCalendarGuestLinkStatus,
  transitionCalendarMeetingSessionStatus,
  invoiceStatusForPayment,
  ledgerBalanceByMatter,
  ledgerRequestFingerprint,
  postLedgerTransaction,
  runConflictCheck,
  shouldUpdateSignatureRequestStatus,
  validateBillingPeriodLock,
  validateBillingRateRule,
  validateContactDataQualityResolutionRecord,
  validateLedgerReconciliationExceptionResolutionRecord,
  validateLedgerReconciliationRecord,
  validateLedgerStatementImportBatchRecord,
  verifyAuditChain,
  type AccessLogRecord,
  type AuditEvent,
  type BillingPeriodLockRecord,
  type BillingRateRuleRecord,
  type CalendarCredentialRecord,
  type CalendarEventAttendeeRecord,
  type CalendarEventRecord,
  type CalendarEventReminderRecord,
  type CalendarGuestLinkRecord,
  type CalendarMeetingSessionRecord,
  type ConnectorDeliveryAttemptRecord,
  type ConnectorOutboxRecord,
  type ConnectorRecord,
  type Contact,
  type ContactDataQualityResolutionRecord,
  type ContactDossier,
  type ContactIdentifier,
  type ConversationMessageRecord,
  type ConversationMessageNotificationRecord,
  type ConversationThreadRecord,
  type DocumentRecord,
  type DraftAssistRecord,
  type DraftRecord,
  type DraftTemplateRecord,
  type EmailEventRecord,
  type EmailOutboxRecord,
  type EmailReceiptTokenRecord,
  type ExpenseEntry,
  type ExternalUploadLinkRecord,
  type Firm,
  type FirmSettings,
  type InboundEmailAddressRecord,
  type InboundEmailAttachmentRecord,
  type InboundEmailMessageRecord,
  type IntakeFormItemActionRecord,
  type IntakeFormLinkRecord,
  type IntakeFormReviewRecord,
  type IntakeVariableProposal,
  type InvoiceLineRecord,
  type InvoiceRecord,
  type JobLifecycleRecord,
  type LedgerAccount,
  type LedgerEntry,
  type LedgerReconciliationExceptionResolutionRecord,
  type LedgerReconciliationRecord,
  type LedgerStatementImportBatchRecord,
  type LedgerTransaction,
  type LedgerTransactionApprovalRecord,
  type LegalClinicMatterProfile,
  type LegalClinicProgram,
  type ManualPaymentRecord,
  type Matter,
  type MatterParty,
  type NewAuditEvent,
  type PaymentAllocationRecord,
  type PortalGrant,
  type PostedLedgerTransaction,
  type ProviderSettingRecord,
  type PublicConsultationIntakeRecord,
  type RecoveryCodeRecord,
  type SavedOperationalViewDefinition,
  type SavedOperationalViewDefinitionInput,
  type ShareLinkRecord,
  type TaskDeadlineRecord,
  type TimeEntry,
  type TrustTransferRequestRecord,
  type User,
  type WebAuthnChallengeRecord,
  type WebAuthnCredentialRecord,
} from "@open-practice/domain";
import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../runtime.js";
import * as schema from "../schema.js";

import type {
  AuthAccountRecord,
  AuthPasswordSetupTokenRecord,
  AuthSessionRecord,
  CalendarGuestLinkCreateInput,
  CalendarEventAttendeeUpsertInput,
  CalendarEventReminderUpsertInput,
  CalendarEventUpsertInput,
  CalendarMeetingSessionCreateInput,
  ConvertPublicConsultationIntakeInput,
  CreateMatterWithClientInput,
  DocumentUploadIntent,
  FirstRunSetupInput,
  FirstRunSetupResult,
  FirstRunSetupStatus,
  ConfiguredFirmResolution,
  InboundAttachmentPromotionInput,
  InboundAttachmentPromotionResult,
  InvoiceWithLines,
  MatterSummary,
  OpenPracticeRepository,
  PaymentWithAllocations,
  PracticeOverview,
  PublicConsultationIntakeListOptions,
  PublicConsultationIntakeUpdateInput,
  TaskDeadlineCompletionInput,
  TrustTransferRequestUpdate,
  TrustTransferRequestUpdateOptions,
} from "./contracts.js";
import {
  CalendarEventScopeConflictError,
  CalendarEventUidConflictError,
  FirstRunSetupConflictError,
  IdempotencyKeyConflictError,
  applyConversationThreadLifecycleAction,
  assertSameIdempotencyFingerprint,
  canonicalizeForIdempotency,
  clone,
  dateToIso,
  isPostgresUniqueViolation,
  sanitizeConnectorDeliveryMetadata,
  sanitizeConnectorDeliverySummary,
  type ConversationThreadLifecycleAction,
} from "./contracts.js";

import {
  accessLogInsert,
  applyVariableProposalWithTx,
  billingPeriodLockInsert,
  billingRateRuleInsert,
  buildActivityTimeline,
  calendarGuestLinkInsert,
  calendarMeetingSessionInsert,
  connectorDeliveryAttemptInsert,
  connectorInsert,
  connectorOutboxInsert,
  emailEventInsert,
  emailOutboxInsert,
  emailReceiptTokenInsert,
  externalUploadLinkInsert,
  intakeFormItemActionInsert,
  intakeFormLinkInsert,
  intakeFormReviewInsert,
  intakeVariableProposalInsert,
  invoiceInsert,
  invoiceLineInsert,
  jobLifecycleInsert,
  mapAccessLogRow,
  mapAnswerSnapshotRow,
  mapAuthAccountRow,
  mapAuthChallengeRow,
  mapAuthSessionRow,
  mapBillingPeriodLockRow,
  mapBillingRateRuleRow,
  mapCalendarCredentialRow,
  mapCalendarEventAttendeeRow,
  mapCalendarEventReminderRow,
  mapCalendarEventRow,
  mapCalendarGuestLinkRow,
  mapCalendarMeetingSessionRow,
  mapConflictCheckRow,
  mapConnectorDeliveryAttemptRow,
  mapConnectorOutboxRow,
  mapConnectorRow,
  mapContactDataQualityResolutionRow,
  mapContactRow,
  mapConversationMessageRow,
  mapConversationMessageNotificationRow,
  mapConversationThreadRow,
  mapDocumentRow,
  mapDocumentTextExtractionRow,
  mapDraftAssistRow,
  mapDraftRow,
  mapDraftTemplateRow,
  mapEmailEventRow,
  mapEmailOutboxRow,
  mapEmailReceiptTokenRow,
  mapExpenseEntryRow,
  mapExternalUploadLinkRow,
  mapFirmSettingsRow,
  mapGeneratedDocumentRow,
  mapInboundEmailAddressRow,
  mapInboundEmailAttachmentRow,
  mapInboundEmailMessageRow,
  mapIntakeFormItemActionRow,
  mapIntakeFormLinkRow,
  mapIntakeFormReviewRow,
  mapIntakeSessionRow,
  mapIntakeTemplateRow,
  mapIntakeVariableProposalRow,
  mapInvoiceLineRow,
  mapInvoiceRow,
  mapJobLifecycleRow,
  mapLedgerApprovalRow,
  mapLedgerReconciliationExceptionResolutionRow,
  mapLedgerReconciliationRow,
  mapLedgerStatementImportBatchRow,
  mapLegalClinicMatterProfileRow,
  mapLegalClinicProgramRow,
  mapMatter,
  mapPasswordSetupTokenRow,
  mapPaymentAllocationRow,
  mapPaymentRow,
  mapProviderSettingRow,
  mapPublicConsultationIntakeRow,
  mapRecoveryCodeRow,
  mapSavedOperationalViewDefinitionRow,
  mapShareLinkRow,
  mapSignatureProviderEventRow,
  mapSignatureRequestRow,
  mapSignatureRequestSignerRow,
  mapSignatureWebhookAttemptRow,
  mapTaskDeadlineRow,
  mapTimeEntryRow,
  mapTrustTransferRequestRow,
  mapWebAuthnCredentialRow,
  matterTrustBalance,
  nextEmailAttemptCount,
  paymentAllocationInsert,
  paymentInsert,
  publicConsultationIntakeInsert,
  sanitizeEmailFailureSummary,
  savedOperationalViewDefinitionInsert,
  setupStatusFromCounts,
  trustTransferRequestInsert,
  userHasFirmWideLedgerAccess,
} from "./drizzle-mappers.js";

function isFirmWideMatterReader(user: User): boolean {
  return user.role === "owner_admin" || user.role === "auditor";
}

function nextMatterNumber(
  matters: Array<Pick<Matter, "firmId" | "number">>,
  firmId: string,
  openedOn: string,
): string {
  const year = new Date(openedOn).getUTCFullYear();
  const prefix = `${year}-`;
  const maxExisting = matters
    .filter((matter) => matter.firmId === firmId && matter.number.startsWith(prefix))
    .reduce((max, matter) => {
      const value = Number.parseInt(matter.number.slice(prefix.length), 10);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
  return `${prefix}${String(maxExisting + 1).padStart(4, "0")}`;
}

export class DrizzleOpenPracticeRepository implements OpenPracticeRepository {
  constructor(private readonly db: OpenPracticeDatabase) {}

  async getSetupStatus(): Promise<FirstRunSetupStatus> {
    const firms = await this.db.select({ id: schema.firms.id }).from(schema.firms).limit(2);
    const users = await this.db.select({ id: schema.users.id }).from(schema.users).limit(2);
    return setupStatusFromCounts(firms.length, users.length);
  }

  async resolveConfiguredFirm(): Promise<ConfiguredFirmResolution> {
    const rows = await this.db.select().from(schema.firms).limit(2);
    const users = await this.db.select({ id: schema.users.id }).from(schema.users).limit(2);
    const status = setupStatusFromCounts(rows.length, users.length);
    if (status.blocked) {
      return {
        status: "blocked",
        reason: status.reason ?? "Practice setup state requires operator review.",
      };
    }
    if (status.required) {
      return { status: "setup_required" };
    }
    if (rows.length > 1) {
      return {
        status: "blocked",
        reason:
          "Multiple firm records found. Resolve practice records before using single-tenant authentication.",
      };
    }
    const row = rows[0];
    const firm: Firm = {
      id: row.id,
      name: row.name,
      defaultProvince: row.defaultProvince,
    };
    return { status: "ready", firm };
  }

  async completeFirstRunSetup(input: FirstRunSetupInput): Promise<FirstRunSetupResult> {
    return this.db.transaction(async (tx) => {
      const firms = await tx.select({ id: schema.firms.id }).from(schema.firms).limit(2);
      const users = await tx.select({ id: schema.users.id }).from(schema.users).limit(2);
      const status = setupStatusFromCounts(firms.length, users.length);
      if (!status.required || status.blocked) {
        throw new FirstRunSetupConflictError(
          status.reason ?? "First-run setup is already complete",
        );
      }

      await tx.insert(schema.firms).values(input.firm);
      await tx.insert(schema.users).values({
        id: input.owner.id,
        firmId: input.owner.firmId,
        displayName: input.owner.displayName,
        email: input.owner.email,
        role: input.owner.role,
        mfaEnabled: input.owner.mfaEnabled,
        practitionerProfile: input.owner.practitionerProfile || null,
      });
      await tx.insert(schema.authAccounts).values({
        firmId: input.owner.firmId,
        userId: input.owner.id,
        passwordHash: input.ownerPasswordHash,
        passwordUpdatedAt: new Date(input.ownerPasswordUpdatedAt),
      });
      await tx.insert(schema.firmSettings).values({
        firmId: input.settings.firmId,
        businessAddress: input.settings.businessAddress,
        officeEmail: input.settings.officeEmail,
        officePhone: input.settings.officePhone,
        practiceAreas: input.settings.practiceAreas,
        invoicePrefix: input.settings.invoicePrefix,
        defaultPaymentTermsDays: input.settings.defaultPaymentTermsDays,
        trustAccountLabel: input.settings.trustAccountLabel,
        trustFundsCaveatAcceptedAt: new Date(input.settings.trustFundsCaveatAcceptedAt),
        trustFundsCaveatAcceptedByUserId: input.settings.trustFundsCaveatAcceptedByUserId,
        website: input.settings.website || null,
        description: input.settings.description || null,
        businessNumber: input.settings.businessNumber || null,
        createdAt: new Date(input.settings.createdAt),
        updatedAt: new Date(input.settings.updatedAt),
      });

      if (input.firstContact) {
        await tx.insert(schema.contacts).values(input.firstContact);
      }
      if (input.firstMatter) {
        await tx.insert(schema.matters).values({
          ...input.firstMatter,
          openedOn: input.firstMatter.openedOn ? new Date(input.firstMatter.openedOn) : null,
          closedOn: input.firstMatter.closedOn ? new Date(input.firstMatter.closedOn) : null,
        });
        await tx.insert(schema.matterAssignments).values({
          matterId: input.firstMatter.id,
          userId: input.owner.id,
        });
      }
      if (input.firstMatterParty) {
        await tx.insert(schema.matterParties).values(input.firstMatterParty);
      }
      if (input.webAuthnCredential) {
        await tx.insert(schema.webAuthnCredentials).values({
          ...input.webAuthnCredential,
          createdAt: new Date(input.webAuthnCredential.createdAt),
          lastUsedAt: input.webAuthnCredential.lastUsedAt
            ? new Date(input.webAuthnCredential.lastUsedAt)
            : null,
          disabledAt: input.webAuthnCredential.disabledAt
            ? new Date(input.webAuthnCredential.disabledAt)
            : null,
        });
      }
      const presetTemplates = buildPracticePresetTemplates({
        firmId: input.firm.id,
        timestamp: input.settings.createdAt,
        selectedPresetIds: input.selectedPresetIds ?? [],
      });
      await tx.insert(schema.draftTemplates).values(
        [
          ...buildBasicDraftTemplates(input.firm.id, input.settings.createdAt),
          ...presetTemplates.draftTemplates,
        ].map((template) => ({
          ...template,
          createdAt: new Date(template.createdAt),
          updatedAt: new Date(template.updatedAt),
        })),
      );
      if (presetTemplates.intakeTemplates.length > 0) {
        await tx.insert(schema.intakeTemplates).values(
          presetTemplates.intakeTemplates.map((template) => ({
            ...template,
            createdAt: new Date(template.createdAt),
            updatedAt: new Date(template.updatedAt),
          })),
        );
      }
      await tx.insert(schema.auditEvents).values({
        ...input.auditEvent,
        occurredAt: new Date(input.auditEvent.occurredAt),
      });

      return {
        firm: input.firm,
        settings: input.settings,
        owner: input.owner,
        firstMatter: input.firstMatter,
      };
    });
  }

  async getFirmSettings(firmId: string): Promise<FirmSettings | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.firmSettings)
      .where(eq(schema.firmSettings.firmId, firmId));
    return row ? mapFirmSettingsRow(row) : undefined;
  }

  async listProviderSettings(
    firmId: string,
    options: { kind?: ProviderSettingRecord["kind"] } = {},
  ): Promise<ProviderSettingRecord[]> {
    const conditions = [eq(schema.providerSettings.firmId, firmId)];
    if (options.kind) conditions.push(eq(schema.providerSettings.kind, options.kind));
    const rows = await this.db
      .select()
      .from(schema.providerSettings)
      .where(and(...conditions))
      .orderBy(asc(schema.providerSettings.kind), asc(schema.providerSettings.key));
    return rows.map(mapProviderSettingRow);
  }

  async upsertProviderSetting(setting: ProviderSettingRecord): Promise<ProviderSettingRecord> {
    const [row] = await this.db
      .insert(schema.providerSettings)
      .values({
        ...setting,
        createdAt: new Date(setting.createdAt),
        updatedAt: new Date(setting.updatedAt),
      })
      .onConflictDoUpdate({
        target: [
          schema.providerSettings.firmId,
          schema.providerSettings.kind,
          schema.providerSettings.key,
        ],
        set: {
          enabled: setting.enabled,
          encryptedConfig: setting.encryptedConfig,
          updatedAt: new Date(setting.updatedAt),
        },
      })
      .returning();
    return mapProviderSettingRow(row);
  }

  async createConnector(connector: ConnectorRecord): Promise<ConnectorRecord> {
    const [row] = await this.db
      .insert(schema.connectors)
      .values(connectorInsert(connector))
      .returning();
    return mapConnectorRow(row);
  }

  async updateConnector(
    firmId: string,
    connectorId: string,
    updates: Partial<
      Pick<ConnectorRecord, "displayName" | "status" | "secretReference" | "configSummary">
    > & { updatedAt: string },
  ): Promise<ConnectorRecord | undefined> {
    const set: Partial<typeof schema.connectors.$inferInsert> = {
      updatedAt: new Date(updates.updatedAt),
    };
    if (updates.displayName !== undefined) set.displayName = updates.displayName;
    if (updates.status !== undefined) set.status = updates.status;
    if ("secretReference" in updates) set.secretReference = updates.secretReference ?? null;
    if (updates.configSummary !== undefined) set.configSummary = updates.configSummary;
    const [row] = await this.db
      .update(schema.connectors)
      .set(set)
      .where(and(eq(schema.connectors.firmId, firmId), eq(schema.connectors.id, connectorId)))
      .returning();
    return row ? mapConnectorRow(row) : undefined;
  }

  async listConnectors(
    firmId: string,
    options: { type?: ConnectorRecord["type"]; status?: ConnectorRecord["status"] } = {},
  ): Promise<ConnectorRecord[]> {
    const conditions = [eq(schema.connectors.firmId, firmId)];
    if (options.type) conditions.push(eq(schema.connectors.type, options.type));
    if (options.status) conditions.push(eq(schema.connectors.status, options.status));
    const rows = await this.db
      .select()
      .from(schema.connectors)
      .where(and(...conditions))
      .orderBy(asc(schema.connectors.key));
    return rows.map(mapConnectorRow);
  }

  async getConnector(firmId: string, connectorId: string): Promise<ConnectorRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.connectors)
      .where(and(eq(schema.connectors.firmId, firmId), eq(schema.connectors.id, connectorId)));
    return row ? mapConnectorRow(row) : undefined;
  }

  async createConnectorOutbox(
    input: ConnectorOutboxRecord,
  ): Promise<{ outbox: ConnectorOutboxRecord; created: boolean }> {
    const connector = await this.getConnector(input.firmId, input.connectorId);
    if (!connector) throw new Error(`Connector ${input.connectorId} was not found`);
    try {
      const [row] = await this.db
        .insert(schema.connectorOutbox)
        .values(connectorOutboxInsert(input))
        .returning();
      return { outbox: mapConnectorOutboxRow(row), created: true };
    } catch (error) {
      if (!isPostgresUniqueViolation(error, "connector_outbox_firm_idempotency_idx")) {
        throw error;
      }
      const [existingRow] = await this.db
        .select()
        .from(schema.connectorOutbox)
        .where(
          and(
            eq(schema.connectorOutbox.firmId, input.firmId),
            eq(schema.connectorOutbox.idempotencyKey, input.idempotencyKey),
          ),
        );
      if (!existingRow) throw error;
      const existing = mapConnectorOutboxRow(existingRow);
      const existingFingerprint = canonicalizeForIdempotency({
        connectorId: existing.connectorId,
        eventType: existing.eventType,
        resourceType: existing.resourceType,
        resourceId: existing.resourceId,
        payloadSummary: existing.payloadSummary,
        maxAttempts: existing.maxAttempts,
      });
      const inputFingerprint = canonicalizeForIdempotency({
        connectorId: input.connectorId,
        eventType: input.eventType,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        payloadSummary: input.payloadSummary,
        maxAttempts: input.maxAttempts,
      });
      if (existingFingerprint !== inputFingerprint) throw new IdempotencyKeyConflictError();
      return { outbox: existing, created: false };
    }
  }

  async listConnectorOutbox(
    firmId: string,
    options: {
      connectorId?: string;
      status?: ConnectorOutboxRecord["status"];
      limit?: number;
    } = {},
  ): Promise<ConnectorOutboxRecord[]> {
    const conditions = [eq(schema.connectorOutbox.firmId, firmId)];
    if (options.connectorId)
      conditions.push(eq(schema.connectorOutbox.connectorId, options.connectorId));
    if (options.status) conditions.push(eq(schema.connectorOutbox.status, options.status));
    const rows = await this.db
      .select()
      .from(schema.connectorOutbox)
      .where(and(...conditions))
      .orderBy(desc(schema.connectorOutbox.createdAt))
      .limit(options.limit ?? 50);
    return rows.map(mapConnectorOutboxRow);
  }

  async getConnectorOutbox(
    firmId: string,
    outboxId: string,
  ): Promise<ConnectorOutboxRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.connectorOutbox)
      .where(
        and(eq(schema.connectorOutbox.firmId, firmId), eq(schema.connectorOutbox.id, outboxId)),
      );
    return row ? mapConnectorOutboxRow(row) : undefined;
  }

  async retryConnectorOutbox(input: {
    firmId: string;
    outboxId: string;
    expectedStatus: Extract<ConnectorOutboxRecord["status"], "failed" | "dead_letter">;
    occurredAt: string;
  }): Promise<ConnectorOutboxRecord | undefined> {
    const current = await this.getConnectorOutbox(input.firmId, input.outboxId);
    if (!current || current.status !== input.expectedStatus) return undefined;
    const occurredAt = new Date(input.occurredAt);
    const [row] = await this.db
      .update(schema.connectorOutbox)
      .set({
        status: "pending",
        maxAttempts:
          current.attemptCount >= current.maxAttempts
            ? current.attemptCount + 1
            : current.maxAttempts,
        nextAttemptAt: occurredAt,
        leaseId: null,
        leasedUntil: null,
        deadLetteredAt: null,
        lastErrorSummary: null,
        updatedAt: occurredAt,
      })
      .where(
        and(
          eq(schema.connectorOutbox.firmId, input.firmId),
          eq(schema.connectorOutbox.id, input.outboxId),
          eq(schema.connectorOutbox.status, input.expectedStatus),
        ),
      )
      .returning();
    return row ? mapConnectorOutboxRow(row) : undefined;
  }

  async deadLetterConnectorOutbox(input: {
    firmId: string;
    outboxId: string;
    expectedStatus: Extract<ConnectorOutboxRecord["status"], "pending" | "failed" | "leased">;
    occurredAt: string;
    errorSummary: string;
  }): Promise<ConnectorOutboxRecord | undefined> {
    const occurredAt = new Date(input.occurredAt);
    const [row] = await this.db
      .update(schema.connectorOutbox)
      .set({
        status: "dead_letter",
        leaseId: null,
        leasedUntil: null,
        nextAttemptAt: null,
        deadLetteredAt: occurredAt,
        lastErrorSummary: sanitizeConnectorDeliverySummary(input.errorSummary) ?? null,
        updatedAt: occurredAt,
      })
      .where(
        and(
          eq(schema.connectorOutbox.firmId, input.firmId),
          eq(schema.connectorOutbox.id, input.outboxId),
          eq(schema.connectorOutbox.status, input.expectedStatus),
        ),
      )
      .returning();
    return row ? mapConnectorOutboxRow(row) : undefined;
  }

  async createConnectorDeliveryAttempt(
    attempt: ConnectorDeliveryAttemptRecord,
  ): Promise<ConnectorDeliveryAttemptRecord> {
    const [outbox] = await this.db
      .select()
      .from(schema.connectorOutbox)
      .where(
        and(
          eq(schema.connectorOutbox.firmId, attempt.firmId),
          eq(schema.connectorOutbox.id, attempt.outboxId),
          eq(schema.connectorOutbox.connectorId, attempt.connectorId),
        ),
      );
    if (!outbox) throw new Error(`Connector outbox ${attempt.outboxId} was not found`);
    const [row] = await this.db
      .insert(schema.connectorDeliveryAttempts)
      .values(connectorDeliveryAttemptInsert(attempt))
      .returning();
    return mapConnectorDeliveryAttemptRow(row);
  }

  async leaseConnectorOutbox(input: {
    firmId: string;
    leaseId: string;
    leasedUntil: string;
    now: string;
    limit?: number;
  }): Promise<
    Array<{
      connector: ConnectorRecord;
      outbox: ConnectorOutboxRecord;
      attempt: ConnectorDeliveryAttemptRecord;
    }>
  > {
    const now = new Date(input.now);
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          outbox: schema.connectorOutbox,
          connector: schema.connectors,
        })
        .from(schema.connectorOutbox)
        .innerJoin(
          schema.connectors,
          and(
            eq(schema.connectors.firmId, schema.connectorOutbox.firmId),
            eq(schema.connectors.id, schema.connectorOutbox.connectorId),
          ),
        )
        .where(
          and(
            eq(schema.connectorOutbox.firmId, input.firmId),
            eq(schema.connectors.status, "enabled"),
            or(
              and(
                inArray(schema.connectorOutbox.status, ["pending", "failed"]),
                or(
                  isNull(schema.connectorOutbox.nextAttemptAt),
                  lte(schema.connectorOutbox.nextAttemptAt, now),
                ),
              ),
              and(
                eq(schema.connectorOutbox.status, "leased"),
                or(
                  isNull(schema.connectorOutbox.leasedUntil),
                  lte(schema.connectorOutbox.leasedUntil, now),
                ),
              ),
            ),
          ),
        )
        .orderBy(asc(schema.connectorOutbox.nextAttemptAt), asc(schema.connectorOutbox.createdAt))
        .limit(input.limit ?? 10);

      const leased: Array<{
        connector: ConnectorRecord;
        outbox: ConnectorOutboxRecord;
        attempt: ConnectorDeliveryAttemptRecord;
      }> = [];
      for (const row of rows) {
        const attemptNumber = row.outbox.attemptCount + 1;
        const [updatedOutbox] = await tx
          .update(schema.connectorOutbox)
          .set({
            status: "leased",
            attemptCount: attemptNumber,
            leaseId: input.leaseId,
            leasedUntil: new Date(input.leasedUntil),
            lastErrorSummary: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.connectorOutbox.firmId, input.firmId),
              eq(schema.connectorOutbox.id, row.outbox.id),
              or(
                inArray(schema.connectorOutbox.status, ["pending", "failed"]),
                and(
                  eq(schema.connectorOutbox.status, "leased"),
                  or(
                    isNull(schema.connectorOutbox.leasedUntil),
                    lte(schema.connectorOutbox.leasedUntil, now),
                  ),
                ),
              ),
            ),
          )
          .returning();
        if (!updatedOutbox) continue;
        const attempt: ConnectorDeliveryAttemptRecord = {
          id: crypto.randomUUID(),
          firmId: updatedOutbox.firmId,
          connectorId: updatedOutbox.connectorId,
          outboxId: updatedOutbox.id,
          attemptNumber,
          status: "leased",
          idempotencyKey: updatedOutbox.idempotencyKey,
          leaseId: input.leaseId,
          startedAt: input.now,
          metadata: {
            eventType: updatedOutbox.eventType,
            resourceType: updatedOutbox.resourceType ?? undefined,
            resourceId: updatedOutbox.resourceId ?? undefined,
          },
        };
        const [attemptRow] = await tx
          .insert(schema.connectorDeliveryAttempts)
          .values(connectorDeliveryAttemptInsert(attempt))
          .returning();
        leased.push({
          connector: mapConnectorRow(row.connector),
          outbox: mapConnectorOutboxRow(updatedOutbox),
          attempt: mapConnectorDeliveryAttemptRow(attemptRow),
        });
      }
      return leased;
    });
  }

  async recordConnectorDeliveryResult(input: {
    firmId: string;
    connectorId: string;
    outboxId: string;
    attemptId: string;
    leaseId: string;
    status: "delivered" | "failed";
    occurredAt: string;
    terminal?: boolean;
    nextAttemptAt?: string;
    errorSummary?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    outbox: ConnectorOutboxRecord;
    attempt: ConnectorDeliveryAttemptRecord;
  }> {
    const occurredAt = new Date(input.occurredAt);
    const failureSummary = sanitizeConnectorDeliverySummary(input.errorSummary);
    return this.db.transaction(async (tx) => {
      const [outboxRow] = await tx
        .update(schema.connectorOutbox)
        .set(
          input.status === "delivered"
            ? {
                status: "delivered",
                leaseId: null,
                leasedUntil: null,
                deliveredAt: occurredAt,
                nextAttemptAt: null,
                lastErrorSummary: null,
                updatedAt: occurredAt,
              }
            : {
                status: input.terminal ? "dead_letter" : "failed",
                leaseId: null,
                leasedUntil: null,
                nextAttemptAt:
                  input.terminal || !input.nextAttemptAt ? null : new Date(input.nextAttemptAt),
                deadLetteredAt: input.terminal ? occurredAt : null,
                lastErrorSummary: failureSummary ?? null,
                updatedAt: occurredAt,
              },
        )
        .where(
          and(
            eq(schema.connectorOutbox.firmId, input.firmId),
            eq(schema.connectorOutbox.connectorId, input.connectorId),
            eq(schema.connectorOutbox.id, input.outboxId),
            eq(schema.connectorOutbox.leaseId, input.leaseId),
          ),
        )
        .returning();
      if (!outboxRow) throw new Error(`Connector outbox ${input.outboxId} lease was not found`);

      const [existingAttempt] = await tx
        .select()
        .from(schema.connectorDeliveryAttempts)
        .where(
          and(
            eq(schema.connectorDeliveryAttempts.firmId, input.firmId),
            eq(schema.connectorDeliveryAttempts.id, input.attemptId),
            eq(schema.connectorDeliveryAttempts.outboxId, input.outboxId),
            eq(schema.connectorDeliveryAttempts.leaseId, input.leaseId),
          ),
        );
      if (!existingAttempt) throw new Error(`Connector attempt ${input.attemptId} was not found`);

      const [attemptRow] = await tx
        .update(schema.connectorDeliveryAttempts)
        .set({
          status: input.status,
          finishedAt: occurredAt,
          errorSummary: failureSummary ?? null,
          metadata: {
            ...existingAttempt.metadata,
            ...sanitizeConnectorDeliveryMetadata(input.metadata),
            terminal: input.status === "failed" ? Boolean(input.terminal) : true,
          },
        })
        .where(eq(schema.connectorDeliveryAttempts.id, input.attemptId))
        .returning();
      return {
        outbox: mapConnectorOutboxRow(outboxRow),
        attempt: mapConnectorDeliveryAttemptRow(attemptRow),
      };
    });
  }

  async listConnectorDeliveryAttempts(
    firmId: string,
    options: { outboxId?: string; connectorId?: string } = {},
  ): Promise<ConnectorDeliveryAttemptRecord[]> {
    const conditions = [eq(schema.connectorDeliveryAttempts.firmId, firmId)];
    if (options.outboxId)
      conditions.push(eq(schema.connectorDeliveryAttempts.outboxId, options.outboxId));
    if (options.connectorId) {
      conditions.push(eq(schema.connectorDeliveryAttempts.connectorId, options.connectorId));
    }
    const rows = await this.db
      .select()
      .from(schema.connectorDeliveryAttempts)
      .where(and(...conditions))
      .orderBy(desc(schema.connectorDeliveryAttempts.startedAt));
    return rows.map(mapConnectorDeliveryAttemptRow);
  }

  async createJobLifecycleRecord(record: JobLifecycleRecord): Promise<JobLifecycleRecord> {
    try {
      const [row] = await this.db
        .insert(schema.jobLifecycleRecords)
        .values(jobLifecycleInsert(record))
        .returning();
      return mapJobLifecycleRow(row);
    } catch (error) {
      if (!isPostgresUniqueViolation(error, "job_lifecycle_records_firm_idempotency_idx")) {
        throw error;
      }
      const [existingRow] = await this.db
        .select()
        .from(schema.jobLifecycleRecords)
        .where(
          and(
            eq(schema.jobLifecycleRecords.firmId, record.firmId),
            eq(schema.jobLifecycleRecords.idempotencyKey, record.idempotencyKey ?? ""),
          ),
        );
      if (!existingRow) throw error;
      const existing = mapJobLifecycleRow(existingRow);
      assertSameIdempotencyFingerprint(existing.metadata, record.metadata);
      return existing;
    }
  }

  async createQueuedEmailOutbox(input: {
    email: EmailOutboxRecord;
    event: EmailEventRecord;
    job: JobLifecycleRecord;
  }): Promise<{
    email: EmailOutboxRecord;
    event: EmailEventRecord;
    job: JobLifecycleRecord;
  }> {
    return this.db.transaction(async (tx) => {
      let emailRow: typeof schema.emailOutbox.$inferSelect;
      try {
        [emailRow] = await tx
          .insert(schema.emailOutbox)
          .values(emailOutboxInsert(input.email))
          .returning();
      } catch (error) {
        if (!isPostgresUniqueViolation(error, "email_outbox_firm_idempotency_idx")) {
          throw error;
        }
        const [existingEmailRow] = await tx
          .select()
          .from(schema.emailOutbox)
          .where(
            and(
              eq(schema.emailOutbox.firmId, input.email.firmId),
              eq(schema.emailOutbox.idempotencyKey, input.email.idempotencyKey ?? ""),
            ),
          );
        if (!existingEmailRow) throw error;
        const existingEmail = mapEmailOutboxRow(existingEmailRow);
        assertSameIdempotencyFingerprint(existingEmail.metadata, input.email.metadata);
        const [existingEventRow] = await tx
          .select()
          .from(schema.emailEvents)
          .where(
            and(
              eq(schema.emailEvents.firmId, existingEmail.firmId),
              eq(schema.emailEvents.emailId, existingEmail.id),
            ),
          )
          .orderBy(asc(schema.emailEvents.occurredAt))
          .limit(1);
        const [existingJobRow] = await tx
          .select()
          .from(schema.jobLifecycleRecords)
          .where(
            and(
              eq(schema.jobLifecycleRecords.firmId, existingEmail.firmId),
              eq(schema.jobLifecycleRecords.targetResourceType, "email_outbox"),
              eq(schema.jobLifecycleRecords.targetResourceId, existingEmail.id),
            ),
          )
          .orderBy(asc(schema.jobLifecycleRecords.queuedAt))
          .limit(1);
        return {
          email: existingEmail,
          event: existingEventRow ? mapEmailEventRow(existingEventRow) : input.event,
          job: existingJobRow ? mapJobLifecycleRow(existingJobRow) : input.job,
        };
      }
      const [eventRow] = await tx
        .insert(schema.emailEvents)
        .values(emailEventInsert(input.event))
        .returning();
      const [jobRow] = await tx
        .insert(schema.jobLifecycleRecords)
        .values(jobLifecycleInsert(input.job))
        .returning();
      return {
        email: mapEmailOutboxRow(emailRow),
        event: mapEmailEventRow(eventRow),
        job: mapJobLifecycleRow(jobRow),
      };
    });
  }

  async getEmailOutbox(firmId: string, emailId: string): Promise<EmailOutboxRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.emailOutbox)
      .where(and(eq(schema.emailOutbox.firmId, firmId), eq(schema.emailOutbox.id, emailId)));
    return row ? mapEmailOutboxRow(row) : undefined;
  }

  async listEmailOutbox(
    firmId: string,
    options: { matterId?: string; limit?: number } = {},
  ): Promise<EmailOutboxRecord[]> {
    const conditions = [eq(schema.emailOutbox.firmId, firmId)];
    if (options.matterId) conditions.push(eq(schema.emailOutbox.matterId, options.matterId));
    const rows = await this.db
      .select()
      .from(schema.emailOutbox)
      .where(and(...conditions))
      .orderBy(desc(schema.emailOutbox.queuedAt))
      .limit(options.limit ?? 50);
    return rows.map(mapEmailOutboxRow);
  }

  async getEmailOutboxByReceiptTokenHash(
    receiptTokenHash: string,
  ): Promise<EmailOutboxRecord | undefined> {
    const token = await this.getEmailReceiptTokenByHash(receiptTokenHash);
    if (!token) return undefined;
    return this.getEmailOutbox(token.firmId, token.emailId);
  }

  async recordEmailDeliveryReceipt(input: {
    firmId: string;
    emailId: string;
    receiptTokenHash: string;
    recordedAt: string;
  }): Promise<{ email: EmailOutboxRecord; recorded: boolean }> {
    const token = await this.recordEmailReceiptToken({
      tokenHash: input.receiptTokenHash,
      recordedAt: input.recordedAt,
    });
    if (token) {
      if (token.firmId !== input.firmId || token.emailId !== input.emailId) {
        throw new Error(`Email outbox receipt ${input.emailId} was not found`);
      }
      const email = await this.getEmailOutbox(token.firmId, token.emailId);
      if (!email) throw new Error(`Email outbox record ${token.emailId} was not found`);
      return { email, recorded: token.recordedAt === input.recordedAt };
    }
    throw new Error(`Email outbox receipt ${input.emailId} was not found`);
  }

  async createEmailReceiptToken(token: EmailReceiptTokenRecord): Promise<EmailReceiptTokenRecord> {
    await this.db.insert(schema.emailReceiptTokens).values(emailReceiptTokenInsert(token));
    return clone(token);
  }

  async getEmailReceiptTokenByHash(
    tokenHash: string,
  ): Promise<EmailReceiptTokenRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.emailReceiptTokens)
      .where(eq(schema.emailReceiptTokens.tokenHash, tokenHash));
    return row ? mapEmailReceiptTokenRow(row) : undefined;
  }

  async recordEmailReceiptToken(input: {
    tokenHash: string;
    recordedAt: string;
  }): Promise<EmailReceiptTokenRecord | undefined> {
    return this.db.transaction(async (tx) => {
      const [existingRow] = await tx
        .select()
        .from(schema.emailReceiptTokens)
        .where(eq(schema.emailReceiptTokens.tokenHash, input.tokenHash));
      if (!existingRow) return undefined;
      const existing = mapEmailReceiptTokenRow(existingRow);
      if (existing.recordedAt) return existing;

      const [tokenRow] = await tx
        .update(schema.emailReceiptTokens)
        .set({ recordedAt: new Date(input.recordedAt) })
        .where(eq(schema.emailReceiptTokens.tokenHash, input.tokenHash))
        .returning();
      await tx.insert(schema.emailEvents).values(
        emailEventInsert({
          id: crypto.randomUUID(),
          firmId: existing.firmId,
          emailId: existing.emailId,
          eventType: "receipt_recorded",
          occurredAt: input.recordedAt,
          source: "api",
          metadata: {
            receiptTokenId: existing.id,
            matterId: existing.matterId,
            purpose: existing.purpose,
          },
        }),
      );
      return mapEmailReceiptTokenRow(tokenRow);
    });
  }

  async listEmailReceiptTokens(
    firmId: string,
    options: { emailId?: string; matterId?: string } = {},
  ): Promise<EmailReceiptTokenRecord[]> {
    const filters = [eq(schema.emailReceiptTokens.firmId, firmId)];
    if (options.emailId) filters.push(eq(schema.emailReceiptTokens.emailId, options.emailId));
    if (options.matterId) filters.push(eq(schema.emailReceiptTokens.matterId, options.matterId));
    const rows = await this.db
      .select()
      .from(schema.emailReceiptTokens)
      .where(and(...filters))
      .orderBy(asc(schema.emailReceiptTokens.createdAt));
    return rows.map(mapEmailReceiptTokenRow);
  }

  async recordEmailDeliveryResult(input: {
    firmId: string;
    emailId: string;
    status: "sending" | "sent" | "failed";
    occurredAt: string;
    providerMessageId?: string;
    attemptNumber?: number;
    jobId?: string;
    source?: EmailEventRecord["source"];
    terminal?: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ email: EmailOutboxRecord; event: EmailEventRecord }> {
    return this.db.transaction(async (tx) => {
      const occurredAt = new Date(input.occurredAt);
      const [existingRow] = await tx
        .select()
        .from(schema.emailOutbox)
        .where(
          and(
            eq(schema.emailOutbox.firmId, input.firmId),
            eq(schema.emailOutbox.id, input.emailId),
          ),
        );
      if (!existingRow) throw new Error(`Email outbox record ${input.emailId} was not found`);
      const existing = mapEmailOutboxRow(existingRow);
      const terminal = input.terminal ?? input.status === "failed";
      const failureSummary = sanitizeEmailFailureSummary(input.errorMessage);
      const attemptCount = nextEmailAttemptCount(existing, input.attemptNumber);
      const metadata = { ...existing.metadata, deliveryState: input.metadata ?? {} };
      const [emailRow] = await tx
        .update(schema.emailOutbox)
        .set({
          status:
            input.status === "failed" && !terminal
              ? "queued"
              : (input.status as EmailOutboxRecord["status"]),
          sentAt: input.status === "sent" ? occurredAt : null,
          failedAt: input.status === "failed" && terminal ? occurredAt : null,
          attemptCount,
          lastAttemptAt: input.attemptNumber ? occurredAt : null,
          terminalFailureAt: input.status === "failed" && terminal ? occurredAt : null,
          terminalFailureReason:
            input.status === "failed" && terminal ? (failureSummary ?? null) : null,
          errorMessage: input.status === "failed" && terminal ? (failureSummary ?? null) : null,
          metadata,
        })
        .where(
          and(
            eq(schema.emailOutbox.firmId, input.firmId),
            eq(schema.emailOutbox.id, input.emailId),
          ),
        )
        .returning();

      const event: EmailEventRecord = {
        id: crypto.randomUUID(),
        firmId: input.firmId,
        emailId: input.emailId,
        eventType: input.status,
        occurredAt: input.occurredAt,
        providerMessageId: input.providerMessageId,
        attemptNumber: input.attemptNumber,
        jobId: input.jobId,
        source: input.source ?? "worker",
        errorMessage: input.status === "failed" ? failureSummary : undefined,
        metadata: input.metadata ?? {},
      };
      const [eventRow] = await tx
        .insert(schema.emailEvents)
        .values(emailEventInsert(event))
        .returning();
      return { email: mapEmailOutboxRow(emailRow), event: mapEmailEventRow(eventRow) };
    });
  }

  async retryEmailOutbox(input: {
    firmId: string;
    emailId: string;
    occurredAt: string;
    requestedByUserId: string;
    job: JobLifecycleRecord;
    metadata?: Record<string, unknown>;
  }): Promise<{ email: EmailOutboxRecord; event: EmailEventRecord; job: JobLifecycleRecord }> {
    return this.db.transaction(async (tx) => {
      if (input.job.idempotencyKey) {
        const [existingJobRow] = await tx
          .select()
          .from(schema.jobLifecycleRecords)
          .where(
            and(
              eq(schema.jobLifecycleRecords.firmId, input.firmId),
              eq(schema.jobLifecycleRecords.idempotencyKey, input.job.idempotencyKey),
              eq(schema.jobLifecycleRecords.targetResourceType, "email_outbox"),
              eq(schema.jobLifecycleRecords.targetResourceId, input.emailId),
            ),
          );
        if (existingJobRow) {
          const existingJob = mapJobLifecycleRow(existingJobRow);
          assertSameIdempotencyFingerprint(existingJob.metadata, input.job.metadata);
          const [emailRow] = await tx
            .select()
            .from(schema.emailOutbox)
            .where(
              and(
                eq(schema.emailOutbox.firmId, input.firmId),
                eq(schema.emailOutbox.id, input.emailId),
              ),
            );
          if (!emailRow) throw new Error(`Email outbox record ${input.emailId} was not found`);
          const [eventRow] = await tx
            .select()
            .from(schema.emailEvents)
            .where(
              and(
                eq(schema.emailEvents.firmId, input.firmId),
                eq(schema.emailEvents.emailId, input.emailId),
                eq(schema.emailEvents.jobId, existingJob.id),
              ),
            );
          return {
            email: mapEmailOutboxRow(emailRow),
            event: eventRow
              ? mapEmailEventRow(eventRow)
              : {
                  id: crypto.randomUUID(),
                  firmId: input.firmId,
                  emailId: input.emailId,
                  eventType: "queued",
                  occurredAt: existingJob.queuedAt,
                  jobId: existingJob.id,
                  source: "api",
                  metadata: input.metadata ?? {},
                },
            job: existingJob,
          };
        }
      }
      const [existingRow] = await tx
        .select()
        .from(schema.emailOutbox)
        .where(
          and(
            eq(schema.emailOutbox.firmId, input.firmId),
            eq(schema.emailOutbox.id, input.emailId),
          ),
        );
      if (!existingRow) throw new Error(`Email outbox record ${input.emailId} was not found`);
      const metadata = {
        ...existingRow.metadata,
        deliveryState: {
          ...(input.metadata ?? {}),
          manualRetryRequestedAt: input.occurredAt,
          manualRetryRequestedByUserId: input.requestedByUserId,
          nextRetryAt: input.occurredAt,
          terminal: false,
        },
      };
      const [emailRow] = await tx
        .update(schema.emailOutbox)
        .set({
          status: "queued",
          failedAt: null,
          errorMessage: null,
          metadata,
        })
        .where(
          and(
            eq(schema.emailOutbox.firmId, input.firmId),
            eq(schema.emailOutbox.id, input.emailId),
          ),
        )
        .returning();

      const event: EmailEventRecord = {
        id: crypto.randomUUID(),
        firmId: input.firmId,
        emailId: input.emailId,
        eventType: "queued",
        occurredAt: input.occurredAt,
        jobId: input.job.id,
        source: "api",
        metadata: {
          ...(input.metadata ?? {}),
          manualRetry: true,
          requestedByUserId: input.requestedByUserId,
          jobId: input.job.id,
        },
      };
      const [eventRow] = await tx
        .insert(schema.emailEvents)
        .values(emailEventInsert(event))
        .returning();
      const [jobRow] = await tx
        .insert(schema.jobLifecycleRecords)
        .values(jobLifecycleInsert(input.job))
        .returning();
      return {
        email: mapEmailOutboxRow(emailRow),
        event: mapEmailEventRow(eventRow),
        job: mapJobLifecycleRow(jobRow),
      };
    });
  }

  async listEmailEvents(
    firmId: string,
    options: { emailId?: string } = {},
  ): Promise<EmailEventRecord[]> {
    const conditions = [eq(schema.emailEvents.firmId, firmId)];
    if (options.emailId) conditions.push(eq(schema.emailEvents.emailId, options.emailId));
    const rows = await this.db
      .select()
      .from(schema.emailEvents)
      .where(and(...conditions))
      .orderBy(asc(schema.emailEvents.occurredAt));
    return rows.map(mapEmailEventRow);
  }

  async updateJobLifecycleRecord(
    firmId: string,
    id: string,
    updates: Partial<
      Pick<
        JobLifecycleRecord,
        | "bullJobId"
        | "status"
        | "attemptsMade"
        | "startedAt"
        | "finishedAt"
        | "failedAt"
        | "errorMessage"
        | "metadata"
      >
    >,
  ): Promise<JobLifecycleRecord> {
    const [row] = await this.db
      .update(schema.jobLifecycleRecords)
      .set({
        ...updates,
        startedAt: updates.startedAt ? new Date(updates.startedAt) : undefined,
        finishedAt: updates.finishedAt ? new Date(updates.finishedAt) : undefined,
        failedAt: updates.failedAt ? new Date(updates.failedAt) : undefined,
      })
      .where(
        and(eq(schema.jobLifecycleRecords.firmId, firmId), eq(schema.jobLifecycleRecords.id, id)),
      )
      .returning();
    if (!row) throw new Error(`Job lifecycle record ${id} was not found`);
    return mapJobLifecycleRow(row);
  }

  async listJobLifecycleRecords(
    firmId: string,
    options: {
      status?: JobLifecycleRecord["status"];
      queueName?: JobLifecycleRecord["queueName"];
      queuedBefore?: string;
      limit?: number;
    } = {},
  ): Promise<JobLifecycleRecord[]> {
    const conditions = [eq(schema.jobLifecycleRecords.firmId, firmId)];
    if (options.status) conditions.push(eq(schema.jobLifecycleRecords.status, options.status));
    if (options.queueName)
      conditions.push(eq(schema.jobLifecycleRecords.queueName, options.queueName));
    if (options.queuedBefore)
      conditions.push(lt(schema.jobLifecycleRecords.queuedAt, new Date(options.queuedBefore)));
    let query = this.db
      .select()
      .from(schema.jobLifecycleRecords)
      .where(and(...conditions))
      .orderBy(desc(schema.jobLifecycleRecords.queuedAt))
      .$dynamic();
    if (options.limit && options.limit > 0) query = query.limit(options.limit);
    const rows = await query;
    return rows.map(mapJobLifecycleRow);
  }

  async getUser(firmId: string, userId: string): Promise<User | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.firmId, firmId), eq(schema.users.id, userId)));
    if (!row) return undefined;
    const assignments = await this.db
      .select()
      .from(schema.matterAssignments)
      .where(eq(schema.matterAssignments.userId, userId));
    return {
      id: row.id,
      firmId: row.firmId,
      displayName: row.displayName,
      email: row.email,
      role: row.role,
      assignedMatterIds: assignments.map((assignment) => assignment.matterId),
      mfaEnabled: row.mfaEnabled,
      practitionerProfile: row.practitionerProfile ?? undefined,
    };
  }

  async createUser(user: User): Promise<User> {
    const [row] = await this.db
      .insert(schema.users)
      .values({
        id: user.id,
        firmId: user.firmId,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        practitionerProfile: user.practitionerProfile,
      })
      .returning();
    return {
      ...user,
      id: row.id,
    };
  }

  async getUserByEmail(firmId: string, email: string): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    const users = await this.listUsers(firmId);
    return users.find((user) => user.email.trim().toLowerCase() === normalized);
  }

  async getAuthAccount(firmId: string, userId: string): Promise<AuthAccountRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.authAccounts)
      .where(and(eq(schema.authAccounts.firmId, firmId), eq(schema.authAccounts.userId, userId)));
    return row ? mapAuthAccountRow(row) : undefined;
  }

  async setAuthPassword(input: {
    firmId: string;
    userId: string;
    passwordHash: string;
    passwordUpdatedAt: string;
  }): Promise<AuthAccountRecord> {
    const [row] = await this.db
      .insert(schema.authAccounts)
      .values({
        firmId: input.firmId,
        userId: input.userId,
        passwordHash: input.passwordHash,
        passwordUpdatedAt: new Date(input.passwordUpdatedAt),
      })
      .onConflictDoUpdate({
        target: [schema.authAccounts.firmId, schema.authAccounts.userId],
        set: {
          passwordHash: input.passwordHash,
          passwordUpdatedAt: new Date(input.passwordUpdatedAt),
        },
      })
      .returning();
    return mapAuthAccountRow(row);
  }

  async createAuthSession(session: AuthSessionRecord): Promise<AuthSessionRecord> {
    await this.db.insert(schema.authSessions).values({
      ...session,
      createdAt: new Date(session.createdAt),
      expiresAt: new Date(session.expiresAt),
      revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
      lastSeenAt: session.lastSeenAt ? new Date(session.lastSeenAt) : null,
    });
    return session;
  }

  async getAuthSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.authSessions)
      .where(eq(schema.authSessions.tokenHash, tokenHash));
    return row ? mapAuthSessionRow(row) : undefined;
  }

  async touchAuthSession(tokenHash: string, seenAt: string): Promise<void> {
    await this.db
      .update(schema.authSessions)
      .set({ lastSeenAt: new Date(seenAt) })
      .where(eq(schema.authSessions.tokenHash, tokenHash));
  }

  async revokeAuthSession(tokenHash: string, revokedAt: string): Promise<void> {
    await this.db
      .update(schema.authSessions)
      .set({ revokedAt: new Date(revokedAt) })
      .where(eq(schema.authSessions.tokenHash, tokenHash));
  }

  async createPasswordSetupToken(
    token: AuthPasswordSetupTokenRecord,
  ): Promise<AuthPasswordSetupTokenRecord> {
    await this.db.insert(schema.authPasswordSetupTokens).values({
      ...token,
      createdByUserId: token.createdByUserId ?? null,
      createdAt: new Date(token.createdAt),
      expiresAt: new Date(token.expiresAt),
      usedAt: token.usedAt ? new Date(token.usedAt) : null,
    });
    return token;
  }

  async consumePasswordSetupToken(
    tokenHash: string,
    usedAt: string,
  ): Promise<AuthPasswordSetupTokenRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.authPasswordSetupTokens)
      .where(eq(schema.authPasswordSetupTokens.tokenHash, tokenHash));
    if (!row || row.usedAt || row.expiresAt <= new Date(usedAt)) return undefined;
    const [updated] = await this.db
      .update(schema.authPasswordSetupTokens)
      .set({ usedAt: new Date(usedAt) })
      .where(eq(schema.authPasswordSetupTokens.tokenHash, tokenHash))
      .returning();
    return updated ? mapPasswordSetupTokenRow(updated) : undefined;
  }

  async createWebAuthnChallenge(
    challenge: WebAuthnChallengeRecord,
  ): Promise<WebAuthnChallengeRecord> {
    const [row] = await this.db
      .insert(schema.authChallenges)
      .values({
        id: challenge.id,
        firmId: challenge.firmId,
        userId: challenge.userId,
        challengeHash: challenge.challengeHash,
        purpose: challenge.purpose,
        expiresAt: new Date(challenge.expiresAt),
        createdAt: new Date(challenge.createdAt),
      })
      .returning();
    return mapAuthChallengeRow(row);
  }

  async getWebAuthnChallenge(challengeHash: string): Promise<WebAuthnChallengeRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.authChallenges)
      .where(eq(schema.authChallenges.challengeHash, challengeHash));
    return row ? mapAuthChallengeRow(row) : undefined;
  }

  async consumeWebAuthnChallenge(challengeHash: string, consumedAt: string): Promise<boolean> {
    const [row] = await this.db
      .update(schema.authChallenges)
      .set({ consumedAt: new Date(consumedAt) })
      .where(
        and(
          eq(schema.authChallenges.challengeHash, challengeHash),
          isNull(schema.authChallenges.consumedAt),
        ),
      )
      .returning();
    return !!row;
  }

  async registerWebAuthnCredential(
    credential: WebAuthnCredentialRecord,
  ): Promise<WebAuthnCredentialRecord> {
    const [row] = await this.db
      .insert(schema.webAuthnCredentials)
      .values({
        id: credential.id,
        firmId: credential.firmId,
        userId: credential.userId,
        credentialId: credential.credentialId,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports,
        deviceType: credential.deviceType,
        backedUp: credential.backedUp,
        createdAt: new Date(credential.createdAt),
      })
      .returning();
    return mapWebAuthnCredentialRow(row);
  }

  async listWebAuthnCredentials(
    firmId: string,
    userId: string,
  ): Promise<WebAuthnCredentialRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.webAuthnCredentials)
      .where(
        and(
          eq(schema.webAuthnCredentials.firmId, firmId),
          eq(schema.webAuthnCredentials.userId, userId),
        ),
      );
    return rows.map(mapWebAuthnCredentialRow);
  }

  async getWebAuthnCredential(credentialId: string): Promise<WebAuthnCredentialRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.webAuthnCredentials)
      .where(eq(schema.webAuthnCredentials.credentialId, credentialId));
    return row ? mapWebAuthnCredentialRow(row) : undefined;
  }

  async updateWebAuthnCredentialCounter(id: string, counter: number): Promise<void> {
    await this.db
      .update(schema.webAuthnCredentials)
      .set({ counter, lastUsedAt: new Date() })
      .where(eq(schema.webAuthnCredentials.id, id));
  }

  async deleteWebAuthnCredential(firmId: string, id: string): Promise<void> {
    await this.db
      .delete(schema.webAuthnCredentials)
      .where(
        and(eq(schema.webAuthnCredentials.firmId, firmId), eq(schema.webAuthnCredentials.id, id)),
      );
  }

  async updateUserMfaStatus(firmId: string, userId: string, mfaEnabled: boolean): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ mfaEnabled })
      .where(and(eq(schema.users.firmId, firmId), eq(schema.users.id, userId)));
  }

  async createRecoveryCodes(
    firmId: string,
    userId: string,
    codes: RecoveryCodeRecord[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Invalidate old codes
      await tx
        .delete(schema.recoveryCodes)
        .where(
          and(eq(schema.recoveryCodes.firmId, firmId), eq(schema.recoveryCodes.userId, userId)),
        );

      if (codes.length > 0) {
        await tx.insert(schema.recoveryCodes).values(
          codes.map((c) => ({
            id: c.id,
            firmId: c.firmId,
            userId: c.userId,
            codeHash: c.codeHash,
            createdAt: new Date(c.createdAt),
          })),
        );
      }
    });
  }

  async useRecoveryCode(
    firmId: string,
    userId: string,
    codeHash: string,
    consumedAt: string,
  ): Promise<boolean> {
    const [updated] = await this.db
      .update(schema.recoveryCodes)
      .set({ usedAt: new Date(consumedAt) })
      .where(
        and(
          eq(schema.recoveryCodes.firmId, firmId),
          eq(schema.recoveryCodes.userId, userId),
          eq(schema.recoveryCodes.codeHash, codeHash),
          isNull(schema.recoveryCodes.usedAt),
        ),
      )
      .returning();
    return !!updated;
  }

  async listRecoveryCodes(firmId: string, userId: string): Promise<RecoveryCodeRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.recoveryCodes)
      .where(and(eq(schema.recoveryCodes.firmId, firmId), eq(schema.recoveryCodes.userId, userId)));
    return rows.map(mapRecoveryCodeRow);
  }

  async getOverview(firmId: string): Promise<PracticeOverview> {
    const [firmRow] = await this.db.select().from(schema.firms).where(eq(schema.firms.id, firmId));
    if (!firmRow) throw new Error(`Unknown firm ${firmId}`);
    const users = await this.listUsers(firmId);
    const matters = await this.db
      .select()
      .from(schema.matters)
      .where(eq(schema.matters.firmId, firmId));
    const grants = await this.listPortalGrants(firmId);
    const ledger = await this.getLedger(firmId);
    const timeEntries = await this.db
      .select()
      .from(schema.timeEntries)
      .where(eq(schema.timeEntries.firmId, firmId));
    return {
      firm: { id: firmRow.id, name: firmRow.name, defaultProvince: firmRow.defaultProvince },
      metrics: {
        openMatters: matters.filter((matter) => matter.status === "open").length,
        intakeMatters: matters.filter((matter) => matter.status === "intake").length,
        portalGrants: grants.filter((grant) => !grant.revokedAt).length,
        trustBalanceCents: Object.values(ledger.trustBalances).reduce(
          (sum, value) => sum + value,
          0,
        ),
        unbilledMinutes: timeEntries
          .filter(
            (entry) =>
              entry.billable && ["draft", "submitted", "approved"].includes(entry.billingStatus),
          )
          .reduce((sum, entry) => sum + entry.minutes, 0),
      },
      users,
    };
  }

  async listMattersForUser(user: User): Promise<MatterSummary[]> {
    const firmWide = isFirmWideMatterReader(user);
    if (!firmWide && user.assignedMatterIds.length === 0) return [];
    const matterRows = firmWide
      ? await this.db.select().from(schema.matters).where(eq(schema.matters.firmId, user.firmId))
      : await this.db
          .select()
          .from(schema.matters)
          .where(inArray(schema.matters.id, user.assignedMatterIds));
    const visibleMatterIds = matterRows.map((matter) => matter.id);
    if (visibleMatterIds.length === 0) return [];
    const ledger = await this.getLedger(user.firmId);
    const allParties = await this.listMatterParties(user.firmId);
    const contacts = await this.listContacts(user.firmId);
    const users = await this.listUsers(user.firmId);
    const documents = await this.listDocuments(user.firmId);
    const timeEntries = await this.listTimeEntries(user.firmId);
    const expenses = await this.listExpenseEntries(user.firmId);
    const grants = await this.listPortalGrants(user.firmId);
    const shareLinks = await this.listShareLinks(user.firmId);
    const externalUploadLinks = await this.listExternalUploadLinks(user.firmId);
    const accessLogs = await this.listAccessLogs(user.firmId);
    const audit = await this.listAuditEvents(user.firmId);
    const emailRows = await this.db
      .select()
      .from(schema.emailOutbox)
      .where(
        and(
          eq(schema.emailOutbox.firmId, user.firmId),
          inArray(schema.emailOutbox.matterId, visibleMatterIds),
        ),
      );
    const emailOutbox = emailRows.map(mapEmailOutboxRow);
    const signatureRequests = await this.listSignatureRequests(user.firmId);
    const intakeSessions = await this.listIntakeSessions(user.firmId);
    const calendarRows = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.firmId, user.firmId),
          inArray(schema.calendarEvents.matterId, visibleMatterIds),
          isNull(schema.calendarEvents.deletedAt),
        ),
      );
    const calendarEvents = calendarRows.map(mapCalendarEventRow);
    const taskDeadlines = await this.listTaskDeadlines(user.firmId, {
      matterIds: visibleMatterIds,
      includeCompleted: true,
    });
    const generatedDocumentRows = await this.db
      .select()
      .from(schema.generatedDocuments)
      .where(eq(schema.generatedDocuments.firmId, user.firmId));
    const generatedDocuments = generatedDocumentRows.map(mapGeneratedDocumentRow);
    const invoices = await this.listInvoices(user.firmId);
    const payments = await this.listPayments(user.firmId);
    const trustTransferRequests = await this.listTrustTransferRequests(user.firmId);

    return matterRows.map((row) => {
      const matter = mapMatter(row);
      const parties = allParties
        .filter((party) => party.matterId === matter.id)
        .map((party) => ({
          ...party,
          contact: contacts.find((contact) => contact.id === party.contactId)!,
        }));
      const matterDocuments = documents.filter((document) => document.matterId === matter.id);
      const matterTimeEntries = timeEntries.filter((entry) => entry.matterId === matter.id);
      const matterExpenses = expenses.filter((entry) => entry.matterId === matter.id);
      const activity = buildActivityTimeline({
        firmId: user.firmId,
        matter,
        contacts,
        matterParties: allParties,
        documents,
        portalGrants: grants,
        shareLinks,
        externalUploadLinks,
        accessLogs,
        auditEvents: audit.events,
        emailOutbox,
        signatureRequests,
        intakeSessions,
        generatedDocuments,
        calendarEvents,
        taskDeadlines,
        timeEntries,
        expenses,
        invoices,
        payments,
        trustTransferRequests,
        ledgerAccounts: ledger.accounts,
        ledgerEntries: ledger.entries,
      });
      const trustBalanceCents = matterTrustBalance(
        ledger.entries,
        ledger.accounts,
        matter,
        allParties,
      );
      return {
        ...matter,
        parties,
        documents: matterDocuments,
        timeEntries: matterTimeEntries,
        expenses: matterExpenses,
        activity,
        trustBalanceCents,
        setupProfile: buildMatterSetupProfile({
          matter,
          parties,
          documents: matterDocuments,
          timeEntries: matterTimeEntries,
          expenses: matterExpenses,
          activity,
          trustBalanceCents,
          users,
        }),
      };
    });
  }

  async createMatterWithClient(input: CreateMatterWithClientInput): Promise<MatterSummary> {
    await this.db.transaction(async (tx) => {
      const existingMatters = await tx
        .select()
        .from(schema.matters)
        .where(eq(schema.matters.firmId, input.firmId));
      const matter: Matter = {
        id: input.matterId,
        firmId: input.firmId,
        number: nextMatterNumber(existingMatters.map(mapMatter), input.firmId, input.openedOn),
        title: input.title,
        practiceArea: input.practiceArea,
        status: "intake",
        jurisdiction: input.jurisdiction,
        responsibleUserId: input.actorUserId,
        openedOn: input.openedOn,
      };

      await tx.insert(schema.contacts).values({
        id: input.contactId,
        firmId: input.firmId,
        kind: input.client.kind,
        displayName: input.client.displayName,
        aliases: [],
        identifiers: input.client.identifiers,
      });
      await tx.insert(schema.matters).values({
        ...matter,
        openedOn: new Date(input.openedOn),
        closedOn: null,
      });
      await tx.insert(schema.matterAssignments).values({
        matterId: input.matterId,
        userId: input.actorUserId,
      });
      await tx.insert(schema.matterParties).values({
        id: input.partyId,
        firmId: input.firmId,
        matterId: input.matterId,
        contactId: input.contactId,
        role: "prospective_client",
        adverse: false,
        confidential: true,
      });

      const [previousRow] = await tx
        .select()
        .from(schema.auditEvents)
        .where(eq(schema.auditEvents.firmId, input.firmId))
        .orderBy(desc(schema.auditEvents.occurredAt))
        .limit(1);
      const previous = previousRow
        ? {
            ...previousRow,
            occurredAt: previousRow.occurredAt.toISOString(),
            metadata: previousRow.metadata as Record<string, unknown>,
          }
        : undefined;
      const audit = appendAuditEvent(previous, {
        id: input.auditEventId,
        firmId: input.firmId,
        actorId: input.actorUserId,
        action: "matter.opened",
        resourceType: "matter",
        resourceId: input.matterId,
        occurredAt: input.occurredAt,
        metadata: {
          matterId: input.matterId,
          source: "dashboard_zero_matter",
          clientContactCreated: true,
          partyRole: "prospective_client",
        },
      });
      await tx.insert(schema.auditEvents).values({
        ...audit,
        occurredAt: new Date(audit.occurredAt),
        metadata: audit.metadata,
      });
    });

    const actor = await this.getUser(input.firmId, input.actorUserId);
    if (!actor) throw new Error(`Unknown user ${input.actorUserId}`);
    const created = (await this.listMattersForUser(actor)).find(
      (matter) => matter.id === input.matterId,
    );
    if (!created) throw new Error(`Created matter ${input.matterId} was not visible`);
    return created;
  }

  async listPublicConsultationIntakes(
    firmId: string,
    options: PublicConsultationIntakeListOptions = {},
  ): Promise<PublicConsultationIntakeRecord[]> {
    const conditions = [eq(schema.publicConsultationIntakes.firmId, firmId)];
    if (options.status)
      conditions.push(eq(schema.publicConsultationIntakes.status, options.status));
    const rows = await this.db
      .select()
      .from(schema.publicConsultationIntakes)
      .where(and(...conditions))
      .orderBy(desc(schema.publicConsultationIntakes.submittedAt))
      .limit(options.limit ?? 50);
    return rows.map(mapPublicConsultationIntakeRow);
  }

  async getPublicConsultationIntake(
    firmId: string,
    intakeId: string,
  ): Promise<PublicConsultationIntakeRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.publicConsultationIntakes)
      .where(
        and(
          eq(schema.publicConsultationIntakes.firmId, firmId),
          eq(schema.publicConsultationIntakes.id, intakeId),
        ),
      );
    return row ? mapPublicConsultationIntakeRow(row) : undefined;
  }

  async createPublicConsultationIntake(
    record: PublicConsultationIntakeRecord,
  ): Promise<PublicConsultationIntakeRecord> {
    const [row] = await this.db
      .insert(schema.publicConsultationIntakes)
      .values(publicConsultationIntakeInsert(record))
      .returning();
    return mapPublicConsultationIntakeRow(row);
  }

  async updatePublicConsultationIntake(
    firmId: string,
    intakeId: string,
    updates: PublicConsultationIntakeUpdateInput,
  ): Promise<PublicConsultationIntakeRecord | undefined> {
    const set: Partial<typeof schema.publicConsultationIntakes.$inferInsert> = {};
    if (updates.status !== undefined) set.status = updates.status;
    if (updates.reviewedByUserId !== undefined) set.reviewedByUserId = updates.reviewedByUserId;
    if (updates.reviewedAt !== undefined) {
      set.reviewedAt = updates.reviewedAt ? new Date(updates.reviewedAt) : null;
    }
    if (updates.dismissedReason !== undefined) set.dismissedReason = updates.dismissedReason;
    if (updates.convertedMatterId !== undefined) set.convertedMatterId = updates.convertedMatterId;
    if (updates.notificationEmailId !== undefined) {
      set.notificationEmailId = updates.notificationEmailId;
    }
    if (updates.metadata !== undefined) set.metadata = updates.metadata;
    const [row] = await this.db
      .update(schema.publicConsultationIntakes)
      .set(set)
      .where(
        and(
          eq(schema.publicConsultationIntakes.firmId, firmId),
          eq(schema.publicConsultationIntakes.id, intakeId),
        ),
      )
      .returning();
    return row ? mapPublicConsultationIntakeRow(row) : undefined;
  }

  async convertPublicConsultationIntakeToMatter(
    input: ConvertPublicConsultationIntakeInput,
  ): Promise<{ intake: PublicConsultationIntakeRecord; matter: MatterSummary }> {
    const intake = await this.db.transaction(async (tx) => {
      const [actorRow] = await tx
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.firmId, input.firmId), eq(schema.users.id, input.actorUserId)));
      if (!actorRow) throw new Error(`Unknown user ${input.actorUserId}`);

      const [intakeRow] = await tx
        .select()
        .from(schema.publicConsultationIntakes)
        .where(
          and(
            eq(schema.publicConsultationIntakes.firmId, input.firmId),
            eq(schema.publicConsultationIntakes.id, input.intakeId),
          ),
        );
      if (!intakeRow) throw new Error(`Public consultation intake ${input.intakeId} not found`);
      const currentIntake = mapPublicConsultationIntakeRow(intakeRow);
      if (currentIntake.status !== "pending") {
        throw new Error("PUBLIC_CONSULTATION_INTAKE_NOT_PENDING");
      }

      const existingMatters = await tx
        .select()
        .from(schema.matters)
        .where(eq(schema.matters.firmId, input.firmId));
      const matter: Matter = {
        id: input.matterId,
        firmId: input.firmId,
        number: nextMatterNumber(existingMatters.map(mapMatter), input.firmId, input.openedOn),
        title: input.title,
        practiceArea: input.practiceArea,
        status: "intake",
        jurisdiction: input.jurisdiction,
        responsibleUserId: input.actorUserId,
        openedOn: input.openedOn,
      };
      const clientIdentifiers: ContactIdentifier[] = [];
      if (currentIntake.email) {
        clientIdentifiers.push({ type: "email", value: currentIntake.email });
      }
      if (currentIntake.telephone) {
        clientIdentifiers.push({ type: "phone", value: currentIntake.telephone });
      }

      await tx.insert(schema.contacts).values({
        id: input.clientContactId,
        firmId: input.firmId,
        kind: "person",
        displayName: currentIntake.clientName,
        aliases: [],
        identifiers: clientIdentifiers,
      });
      if (input.opposingParties.length > 0) {
        await tx.insert(schema.contacts).values(
          input.opposingParties.map((party) => ({
            id: party.contactId,
            firmId: input.firmId,
            kind: "person" as const,
            displayName: party.displayName,
            aliases: [],
            identifiers: [],
          })),
        );
      }
      await tx.insert(schema.matters).values({
        ...matter,
        openedOn: new Date(input.openedOn),
        closedOn: null,
      });
      await tx.insert(schema.matterAssignments).values({
        matterId: input.matterId,
        userId: input.actorUserId,
      });
      await tx.insert(schema.matterParties).values([
        {
          id: input.clientPartyId,
          firmId: input.firmId,
          matterId: input.matterId,
          contactId: input.clientContactId,
          role: "prospective_client",
          adverse: false,
          confidential: true,
        },
        ...input.opposingParties.map((party) => ({
          id: party.partyId,
          firmId: input.firmId,
          matterId: input.matterId,
          contactId: party.contactId,
          role: "opposing_party" as const,
          adverse: true,
          confidential: false,
        })),
      ]);

      const [previousRow] = await tx
        .select()
        .from(schema.auditEvents)
        .where(eq(schema.auditEvents.firmId, input.firmId))
        .orderBy(desc(schema.auditEvents.occurredAt))
        .limit(1);
      const previous = previousRow
        ? {
            ...previousRow,
            occurredAt: previousRow.occurredAt.toISOString(),
            metadata: previousRow.metadata as Record<string, unknown>,
          }
        : undefined;
      const audit = appendAuditEvent(previous, {
        id: input.auditEventId,
        firmId: input.firmId,
        actorId: input.actorUserId,
        action: "matter.opened",
        resourceType: "matter",
        resourceId: input.matterId,
        occurredAt: input.occurredAt,
        metadata: {
          matterId: input.matterId,
          source: "public_consultation_intake",
          publicConsultationIntakeId: input.intakeId,
          clientContactCreated: true,
          partyRole: "prospective_client",
          opposingPartyCount: input.opposingParties.length,
        },
      });
      await tx.insert(schema.auditEvents).values({
        ...audit,
        occurredAt: new Date(audit.occurredAt),
        metadata: audit.metadata,
      });

      const [updatedIntakeRow] = await tx
        .update(schema.publicConsultationIntakes)
        .set({
          status: "converted",
          reviewedByUserId: input.actorUserId,
          reviewedAt: new Date(input.occurredAt),
          convertedMatterId: input.matterId,
          metadata: {
            ...currentIntake.metadata,
            convertedMatterId: input.matterId,
            opposingPartyCount: input.opposingParties.length,
          },
        })
        .where(
          and(
            eq(schema.publicConsultationIntakes.firmId, input.firmId),
            eq(schema.publicConsultationIntakes.id, input.intakeId),
          ),
        )
        .returning();
      return mapPublicConsultationIntakeRow(updatedIntakeRow);
    });

    const actor = await this.getUser(input.firmId, input.actorUserId);
    if (!actor) throw new Error(`Unknown user ${input.actorUserId}`);
    const created = (await this.listMattersForUser(actor)).find(
      (matter) => matter.id === input.matterId,
    );
    if (!created) throw new Error(`Created matter ${input.matterId} was not visible`);
    return { intake, matter: created };
  }

  async listContactDossiersForUser(user: User): Promise<ContactDossier[]> {
    const matters = await this.listMattersForUser(user);
    const matterParties = matters.flatMap((matter) =>
      matter.parties.map((party) => ({
        id: party.id,
        firmId: party.firmId,
        matterId: party.matterId,
        contactId: party.contactId,
        role: party.role,
        adverse: party.adverse,
        confidential: party.confidential,
      })),
    );
    const contacts = matters.flatMap((matter) => matter.parties.map((party) => party.contact));
    const portalGrants = await this.listPortalGrants(user.firmId);
    const intakeVariableProposals = (
      await this.listIntakeVariableProposals(user.firmId, {
        status: "approved",
      })
    ).filter(
      (proposal) =>
        Boolean(proposal.appliedAt) && matters.some((matter) => matter.id === proposal.matterId),
    );
    const conflictChecks = (
      await this.db
        .select()
        .from(schema.conflictChecks)
        .where(eq(schema.conflictChecks.firmId, user.firmId))
    ).map(mapConflictCheckRow);
    return buildContactDossiers({
      firmId: user.firmId,
      contacts,
      matters,
      matterParties,
      portalGrants,
      intakeVariableProposals,
      conflictChecks,
    });
  }

  async getContact(firmId: string, contactId: string): Promise<Contact | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.contacts)
      .where(and(eq(schema.contacts.firmId, firmId), eq(schema.contacts.id, contactId)));
    return row ? mapContactRow(row) : undefined;
  }

  async createContactDataQualityResolution(
    resolution: ContactDataQualityResolutionRecord,
  ): Promise<ContactDataQualityResolutionRecord> {
    validateContactDataQualityResolutionRecord(resolution);
    await this.db.insert(schema.contactDataQualityResolutions).values({
      id: resolution.id,
      firmId: resolution.firmId,
      contactId: resolution.contactId,
      signalKind: resolution.signalKind,
      decision: resolution.decision,
      resolutionNote: resolution.resolutionNote,
      matterId: resolution.matterId ?? null,
      relatedContactId: resolution.relatedContactId ?? null,
      sourceRecordId: resolution.sourceRecordId ?? null,
      recordedByUserId: resolution.recordedByUserId,
      recordedAt: new Date(resolution.recordedAt),
    });
    return resolution;
  }

  async listContactDataQualityResolutions(
    firmId: string,
    options: { contactId?: string; matterId?: string } = {},
  ): Promise<ContactDataQualityResolutionRecord[]> {
    const filters = [eq(schema.contactDataQualityResolutions.firmId, firmId)];
    if (options.contactId) {
      filters.push(eq(schema.contactDataQualityResolutions.contactId, options.contactId));
    }
    if (options.matterId) {
      filters.push(eq(schema.contactDataQualityResolutions.matterId, options.matterId));
    }
    const rows = await this.db
      .select()
      .from(schema.contactDataQualityResolutions)
      .where(and(...filters))
      .orderBy(desc(schema.contactDataQualityResolutions.recordedAt));
    return rows.map(mapContactDataQualityResolutionRow);
  }

  async getDocument(firmId: string, documentId: string): Promise<DocumentRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.documents)
      .where(and(eq(schema.documents.firmId, firmId), eq(schema.documents.id, documentId)));
    return row ? mapDocumentRow(row) : undefined;
  }

  async listMatterDocuments(firmId: string, matterId: string): Promise<DocumentRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.documents)
      .where(and(eq(schema.documents.firmId, firmId), eq(schema.documents.matterId, matterId)));
    return rows.map(mapDocumentRow);
  }

  async listTaskDeadlines(
    firmId: string,
    options: { matterIds?: string[]; matterId?: string; includeCompleted?: boolean } = {},
  ): Promise<TaskDeadlineRecord[]> {
    const filters = [eq(schema.tasks.firmId, firmId)];
    if (options.matterId) {
      filters.push(eq(schema.tasks.matterId, options.matterId));
    } else if (options.matterIds) {
      if (options.matterIds.length === 0) return [];
      filters.push(inArray(schema.tasks.matterId, options.matterIds));
    }
    if (!options.includeCompleted) {
      filters.push(isNull(schema.tasks.completedAt));
    }
    const rows = await this.db
      .select()
      .from(schema.tasks)
      .where(and(...filters))
      .orderBy(asc(schema.tasks.dueAt), asc(schema.tasks.id));
    return rows.map(mapTaskDeadlineRow);
  }

  async getTaskDeadline(firmId: string, taskId: string): Promise<TaskDeadlineRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.tasks)
      .where(and(eq(schema.tasks.firmId, firmId), eq(schema.tasks.id, taskId)));
    return row ? mapTaskDeadlineRow(row) : undefined;
  }

  async createTaskDeadline(task: TaskDeadlineRecord): Promise<TaskDeadlineRecord> {
    const [row] = await this.db
      .insert(schema.tasks)
      .values({
        id: task.id,
        firmId: task.firmId,
        matterId: task.matterId,
        assignedToUserId: task.assignedToUserId ?? null,
        title: task.title,
        dueAt: task.dueAt ? new Date(task.dueAt) : null,
        completedAt: task.completedAt ? new Date(task.completedAt) : null,
      })
      .returning();
    return mapTaskDeadlineRow(row!);
  }

  async completeTaskDeadline(
    input: TaskDeadlineCompletionInput,
  ): Promise<TaskDeadlineRecord | undefined> {
    const [existing] = await this.db
      .select()
      .from(schema.tasks)
      .where(and(eq(schema.tasks.firmId, input.firmId), eq(schema.tasks.id, input.taskId)));
    if (!existing) return undefined;
    const [row] = await this.db
      .update(schema.tasks)
      .set({ completedAt: existing.completedAt ?? new Date(input.completedAt) })
      .where(and(eq(schema.tasks.firmId, input.firmId), eq(schema.tasks.id, input.taskId)))
      .returning();
    return row ? mapTaskDeadlineRow(row) : undefined;
  }

  async listConversationThreads(
    firmId: string,
    options: { matterIds?: string[]; matterId?: string } = {},
  ): Promise<ConversationThreadRecord[]> {
    const matterIds = options.matterId ? [options.matterId] : options.matterIds;
    const filters = [eq(schema.conversationThreads.firmId, firmId)];
    if (matterIds && matterIds.length > 0) {
      filters.push(inArray(schema.conversationThreads.matterId, matterIds));
    }
    const rows = await this.db
      .select()
      .from(schema.conversationThreads)
      .where(and(...filters))
      .orderBy(desc(schema.conversationThreads.updatedAt), asc(schema.conversationThreads.topic));
    return rows.map(mapConversationThreadRow);
  }

  async getConversationThread(
    firmId: string,
    threadId: string,
  ): Promise<ConversationThreadRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.conversationThreads)
      .where(
        and(
          eq(schema.conversationThreads.firmId, firmId),
          eq(schema.conversationThreads.id, threadId),
        ),
      );
    return row ? mapConversationThreadRow(row) : undefined;
  }

  async createConversationThread(
    thread: ConversationThreadRecord,
  ): Promise<ConversationThreadRecord> {
    const [row] = await this.db
      .insert(schema.conversationThreads)
      .values({
        ...thread,
        retentionUntil: thread.retentionUntil ? new Date(thread.retentionUntil) : null,
        accessRevokedAt: thread.accessRevokedAt ? new Date(thread.accessRevokedAt) : null,
        createdAt: new Date(thread.createdAt),
        updatedAt: new Date(thread.updatedAt),
      })
      .returning();
    return mapConversationThreadRow(row!);
  }

  async updateConversationThreadLifecycle(input: {
    firmId: string;
    threadId: string;
    action: ConversationThreadLifecycleAction;
    occurredAt: string;
    actorUserId: string;
  }): Promise<ConversationThreadRecord | undefined> {
    const existing = await this.getConversationThread(input.firmId, input.threadId);
    if (!existing) return undefined;
    const updated = applyConversationThreadLifecycleAction(existing, input);
    const [row] = await this.db
      .update(schema.conversationThreads)
      .set({
        status: updated.status,
        exportState: updated.exportState,
        accessRevokedAt: updated.accessRevokedAt ? new Date(updated.accessRevokedAt) : null,
        updatedAt: new Date(updated.updatedAt),
        updatedByUserId: updated.updatedByUserId,
      })
      .where(
        and(
          eq(schema.conversationThreads.firmId, input.firmId),
          eq(schema.conversationThreads.id, input.threadId),
        ),
      )
      .returning();
    return row ? mapConversationThreadRow(row) : undefined;
  }

  async createConversationMessageNotifications(input: {
    firmId: string;
    threadId: string;
    messageId: string;
    matterId: string;
    notificationBoundary: ConversationThreadRecord["notificationBoundary"];
    createdAt: string;
    createdByUserId: string;
  }): Promise<ConversationMessageNotificationRecord[]> {
    if (input.notificationBoundary !== "internal_only") return [];

    const [thread, users] = await Promise.all([
      this.getConversationThread(input.firmId, input.threadId),
      this.listUsers(input.firmId),
    ]);
    if (!thread) return [];

    const recipients = users.filter(
      (user) =>
        user.id !== input.createdByUserId &&
        canAccess({
          user,
          firmId: input.firmId,
          resource: "conversation_thread",
          action: "read",
          matterId: input.matterId,
        }),
    );
    if (recipients.length === 0) return [];

    const rows = await this.db.transaction(async (tx) => {
      const inserted: Array<typeof schema.conversationMessageNotifications.$inferSelect> = [];
      for (const recipient of recipients) {
        const [row] = await tx
          .insert(schema.conversationMessageNotifications)
          .values({
            id: `conversation-message-notification-${input.messageId}-${recipient.id}`,
            firmId: input.firmId,
            matterId: input.matterId,
            threadId: input.threadId,
            messageId: input.messageId,
            recipientUserId: recipient.id,
            createdAt: new Date(input.createdAt),
            updatedAt: new Date(input.createdAt),
            createdByUserId: input.createdByUserId,
            updatedByUserId: input.createdByUserId,
            metadata: {},
          })
          .onConflictDoNothing()
          .returning();
        if (row) inserted.push(row);
      }
      return inserted;
    });
    return rows.map(mapConversationMessageNotificationRow);
  }

  async listConversationMessageNotifications(
    firmId: string,
    options: {
      threadId?: string;
      matterId?: string;
      recipientUserId?: string;
      messageId?: string;
    } = {},
  ): Promise<ConversationMessageNotificationRecord[]> {
    const filters = [eq(schema.conversationMessageNotifications.firmId, firmId)];
    if (options.threadId) {
      filters.push(eq(schema.conversationMessageNotifications.threadId, options.threadId));
    }
    if (options.matterId) {
      filters.push(eq(schema.conversationMessageNotifications.matterId, options.matterId));
    }
    if (options.recipientUserId) {
      filters.push(
        eq(schema.conversationMessageNotifications.recipientUserId, options.recipientUserId),
      );
    }
    if (options.messageId) {
      filters.push(eq(schema.conversationMessageNotifications.messageId, options.messageId));
    }
    const rows = await this.db
      .select()
      .from(schema.conversationMessageNotifications)
      .where(and(...filters))
      .orderBy(
        asc(schema.conversationMessageNotifications.createdAt),
        asc(schema.conversationMessageNotifications.id),
      );
    return rows.map(mapConversationMessageNotificationRow);
  }

  async updateConversationMessageNotificationPosture(input: {
    firmId: string;
    notificationId: string;
    action: "mark_read" | "mute" | "unmute";
    occurredAt: string;
    actorUserId: string;
  }): Promise<ConversationMessageNotificationRecord | undefined> {
    const [current] = await this.db
      .select()
      .from(schema.conversationMessageNotifications)
      .where(
        and(
          eq(schema.conversationMessageNotifications.firmId, input.firmId),
          eq(schema.conversationMessageNotifications.id, input.notificationId),
        ),
      );
    if (!current || current.recipientUserId !== input.actorUserId) return undefined;

    const [row] = await this.db
      .update(schema.conversationMessageNotifications)
      .set({
        readAt:
          input.action === "mark_read"
            ? (current.readAt ?? new Date(input.occurredAt))
            : current.readAt,
        mutedAt:
          input.action === "mute"
            ? (current.mutedAt ?? new Date(input.occurredAt))
            : input.action === "unmute"
              ? null
              : current.mutedAt,
        updatedAt: new Date(input.occurredAt),
        updatedByUserId: input.actorUserId,
      })
      .where(
        and(
          eq(schema.conversationMessageNotifications.firmId, input.firmId),
          eq(schema.conversationMessageNotifications.id, input.notificationId),
        ),
      )
      .returning();
    return row ? mapConversationMessageNotificationRow(row) : undefined;
  }

  async listConversationMessages(
    firmId: string,
    options: { threadId?: string; matterId?: string } = {},
  ): Promise<ConversationMessageRecord[]> {
    const filters = [eq(schema.conversationMessages.firmId, firmId)];
    if (options.threadId) filters.push(eq(schema.conversationMessages.threadId, options.threadId));
    if (options.matterId) filters.push(eq(schema.conversationMessages.matterId, options.matterId));
    const rows = await this.db
      .select()
      .from(schema.conversationMessages)
      .where(and(...filters))
      .orderBy(asc(schema.conversationMessages.authoredAt), asc(schema.conversationMessages.id));
    return rows.map(mapConversationMessageRow);
  }

  async createConversationMessage(
    message: ConversationMessageRecord,
  ): Promise<ConversationMessageRecord> {
    const [row] = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(schema.conversationMessages)
        .values({
          ...message,
          authoredAt: new Date(message.authoredAt),
          createdAt: new Date(message.createdAt),
        })
        .returning();
      await tx
        .update(schema.conversationThreads)
        .set({
          updatedAt: new Date(message.authoredAt),
          updatedByUserId: message.createdByUserId,
        })
        .where(
          and(
            eq(schema.conversationThreads.firmId, message.firmId),
            eq(schema.conversationThreads.id, message.threadId),
          ),
        );
      return inserted;
    });
    const thread = await this.getConversationThread(message.firmId, message.threadId);
    if (thread) {
      await this.createConversationMessageNotifications({
        firmId: message.firmId,
        threadId: message.threadId,
        messageId: message.id,
        matterId: message.matterId,
        notificationBoundary: thread.notificationBoundary,
        createdAt: message.createdAt,
        createdByUserId: message.createdByUserId,
      });
    }
    return mapConversationMessageRow(row!);
  }

  async listLegalClinicPrograms(
    firmId: string,
    options: { status?: LegalClinicProgram["status"] } = {},
  ): Promise<LegalClinicProgram[]> {
    const filters = [eq(schema.legalClinicPrograms.firmId, firmId)];
    if (options.status) filters.push(eq(schema.legalClinicPrograms.status, options.status));
    const rows = await this.db
      .select()
      .from(schema.legalClinicPrograms)
      .where(and(...filters))
      .orderBy(asc(schema.legalClinicPrograms.name));
    return rows.map(mapLegalClinicProgramRow);
  }

  async createLegalClinicProgram(program: LegalClinicProgram): Promise<LegalClinicProgram> {
    await this.db.insert(schema.legalClinicPrograms).values({
      ...program,
      createdAt: new Date(program.createdAt),
      updatedAt: new Date(program.updatedAt),
    });
    return clone(program);
  }

  async getLegalClinicMatterProfile(
    firmId: string,
    matterId: string,
  ): Promise<LegalClinicMatterProfile | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.legalClinicMatterProfiles)
      .where(
        and(
          eq(schema.legalClinicMatterProfiles.firmId, firmId),
          eq(schema.legalClinicMatterProfiles.matterId, matterId),
        ),
      );
    return row ? mapLegalClinicMatterProfileRow(row) : undefined;
  }

  async upsertLegalClinicMatterProfile(
    profile: LegalClinicMatterProfile,
  ): Promise<LegalClinicMatterProfile> {
    const [row] = await this.db
      .insert(schema.legalClinicMatterProfiles)
      .values({
        ...profile,
        referralDate: profile.referralDate ? new Date(profile.referralDate) : null,
        nextReviewDate: profile.nextReviewDate ? new Date(profile.nextReviewDate) : null,
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(profile.updatedAt),
      })
      .onConflictDoUpdate({
        target: [
          schema.legalClinicMatterProfiles.firmId,
          schema.legalClinicMatterProfiles.matterId,
        ],
        set: {
          id: profile.id,
          programId: profile.programId,
          eligibilityStatus: profile.eligibilityStatus,
          referralSource: profile.referralSource,
          referralStatus: profile.referralStatus,
          referralDate: profile.referralDate ? new Date(profile.referralDate) : null,
          nextReviewDate: profile.nextReviewDate ? new Date(profile.nextReviewDate) : null,
          clinicRelationshipRole: profile.clinicRelationshipRole,
          notes: profile.notes,
          createdAt: new Date(profile.createdAt),
          updatedAt: new Date(profile.updatedAt),
          updatedByUserId: profile.updatedByUserId,
          metadata: profile.metadata,
        },
      })
      .returning();
    return mapLegalClinicMatterProfileRow(row!);
  }

  private async attachCalendarEventAttendees(
    events: CalendarEventRecord[],
  ): Promise<CalendarEventRecord[]> {
    if (events.length === 0) return events;
    const attendees = await this.db
      .select()
      .from(schema.calendarEventAttendees)
      .where(
        and(
          eq(schema.calendarEventAttendees.firmId, events[0]!.firmId),
          inArray(
            schema.calendarEventAttendees.eventId,
            events.map((event) => event.id),
          ),
          isNull(schema.calendarEventAttendees.deletedAt),
        ),
      )
      .orderBy(asc(schema.calendarEventAttendees.email));
    const attendeesByEventId = new Map<string, CalendarEventAttendeeRecord[]>();
    for (const attendee of attendees.map(mapCalendarEventAttendeeRow)) {
      const eventAttendees = attendeesByEventId.get(attendee.eventId) ?? [];
      eventAttendees.push(attendee);
      attendeesByEventId.set(attendee.eventId, eventAttendees);
    }
    return events.map((event) => ({
      ...event,
      attendees: attendeesByEventId.get(event.id) ?? [],
    }));
  }

  private async attachCalendarEventReminders(
    events: CalendarEventRecord[],
  ): Promise<CalendarEventRecord[]> {
    if (events.length === 0) return events;
    const reminders = await this.db
      .select()
      .from(schema.calendarEventReminders)
      .where(
        and(
          eq(schema.calendarEventReminders.firmId, events[0]!.firmId),
          inArray(
            schema.calendarEventReminders.eventId,
            events.map((event) => event.id),
          ),
          isNull(schema.calendarEventReminders.deletedAt),
        ),
      )
      .orderBy(asc(schema.calendarEventReminders.remindAt), asc(schema.calendarEventReminders.id));
    const remindersByEventId = new Map<string, CalendarEventReminderRecord[]>();
    for (const reminder of reminders.map(mapCalendarEventReminderRow)) {
      const eventReminders = remindersByEventId.get(reminder.eventId) ?? [];
      eventReminders.push(reminder);
      remindersByEventId.set(reminder.eventId, eventReminders);
    }
    return events.map((event) => ({
      ...event,
      reminders: remindersByEventId.get(event.id) ?? [],
    }));
  }

  private async attachCalendarEventChildren(
    events: CalendarEventRecord[],
  ): Promise<CalendarEventRecord[]> {
    return this.attachCalendarEventReminders(await this.attachCalendarEventAttendees(events));
  }

  async listCalendarEvents(
    firmId: string,
    options: { matterId: string; startsAfter?: string; startsBefore?: string },
  ): Promise<CalendarEventRecord[]> {
    const filters = [
      eq(schema.calendarEvents.firmId, firmId),
      eq(schema.calendarEvents.matterId, options.matterId),
      isNull(schema.calendarEvents.deletedAt),
    ];
    if (options.startsAfter) {
      filters.push(sql`${schema.calendarEvents.startsAt} >= ${new Date(options.startsAfter)}`);
    }
    if (options.startsBefore) {
      filters.push(sql`${schema.calendarEvents.startsAt} < ${new Date(options.startsBefore)}`);
    }
    const rows = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(and(...filters))
      .orderBy(asc(schema.calendarEvents.startsAt), asc(schema.calendarEvents.id));
    return this.attachCalendarEventChildren(rows.map(mapCalendarEventRow));
  }

  async getCalendarEvent(
    firmId: string,
    matterId: string,
    eventId: string,
  ): Promise<CalendarEventRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.firmId, firmId),
          eq(schema.calendarEvents.matterId, matterId),
          eq(schema.calendarEvents.id, eventId),
          isNull(schema.calendarEvents.deletedAt),
        ),
      );
    if (!row) return undefined;
    return (await this.attachCalendarEventChildren([mapCalendarEventRow(row)]))[0];
  }

  async getCalendarEventByUid(
    firmId: string,
    matterId: string,
    uid: string,
  ): Promise<CalendarEventRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.firmId, firmId),
          eq(schema.calendarEvents.matterId, matterId),
          eq(schema.calendarEvents.uid, uid),
          isNull(schema.calendarEvents.deletedAt),
        ),
      );
    if (!row) return undefined;
    return (await this.attachCalendarEventChildren([mapCalendarEventRow(row)]))[0];
  }

  async upsertCalendarEvent(event: CalendarEventUpsertInput): Promise<CalendarEventRecord> {
    const values = {
      id: event.id,
      firmId: event.firmId,
      matterId: event.matterId,
      uid: event.uid,
      title: event.title,
      startsAt: new Date(event.startsAt),
      endsAt: new Date(event.endsAt),
      description: event.description ?? null,
      location: event.location ?? null,
      status: event.status,
      sequence: event.sequence,
      meetingLinkMode: event.meetingLinkMode ?? "blank",
      meetingLinkUrl: event.meetingLinkUrl ?? null,
      meetingRoomId: event.meetingRoomId ?? null,
      meetingProviderKey: event.meetingProviderKey ?? null,
      createdAt: new Date(event.createdAt),
      updatedAt: new Date(event.updatedAt),
      deletedAt: event.deletedAt ? new Date(event.deletedAt) : null,
      createdByUserId: event.createdByUserId,
      updatedByUserId: event.updatedByUserId,
    };
    const [eventIdCollision] = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(eq(schema.calendarEvents.id, event.id));
    if (
      eventIdCollision &&
      (eventIdCollision.firmId !== event.firmId || eventIdCollision.matterId !== event.matterId)
    ) {
      throw new CalendarEventScopeConflictError(event.id);
    }

    const [activeUidCollision] = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.firmId, event.firmId),
          eq(schema.calendarEvents.matterId, event.matterId),
          eq(schema.calendarEvents.uid, event.uid),
          isNull(schema.calendarEvents.deletedAt),
        ),
      );
    if (activeUidCollision && activeUidCollision.id !== event.id) {
      throw new CalendarEventUidConflictError(event.uid);
    }

    let row: typeof schema.calendarEvents.$inferSelect | undefined;
    try {
      [row] = await this.db
        .insert(schema.calendarEvents)
        .values(values)
        .onConflictDoUpdate({
          target: schema.calendarEvents.id,
          set: {
            uid: values.uid,
            title: values.title,
            startsAt: values.startsAt,
            endsAt: values.endsAt,
            description: values.description,
            location: values.location,
            status: values.status,
            sequence: values.sequence,
            meetingLinkMode: values.meetingLinkMode,
            meetingLinkUrl: values.meetingLinkUrl,
            meetingRoomId: values.meetingRoomId,
            meetingProviderKey: values.meetingProviderKey,
            updatedAt: values.updatedAt,
            deletedAt: values.deletedAt,
            updatedByUserId: values.updatedByUserId,
          },
          setWhere: sql`${schema.calendarEvents.firmId} = ${event.firmId} and ${schema.calendarEvents.matterId} = ${event.matterId}`,
        })
        .returning();
    } catch (error) {
      if (isPostgresUniqueViolation(error, "calendar_events_firm_matter_uid_idx")) {
        throw new CalendarEventUidConflictError(event.uid);
      }
      throw error;
    }
    if (!row) {
      throw new CalendarEventScopeConflictError(event.id);
    }
    return (await this.attachCalendarEventChildren([mapCalendarEventRow(row)]))[0]!;
  }

  async listCalendarEventAttendees(
    firmId: string,
    matterId: string,
    eventId: string,
  ): Promise<CalendarEventAttendeeRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.calendarEventAttendees)
      .where(
        and(
          eq(schema.calendarEventAttendees.firmId, firmId),
          eq(schema.calendarEventAttendees.matterId, matterId),
          eq(schema.calendarEventAttendees.eventId, eventId),
          isNull(schema.calendarEventAttendees.deletedAt),
        ),
      )
      .orderBy(asc(schema.calendarEventAttendees.email));
    return rows.map(mapCalendarEventAttendeeRow);
  }

  async upsertCalendarEventAttendee(
    attendee: CalendarEventAttendeeUpsertInput,
  ): Promise<CalendarEventAttendeeRecord> {
    const values = {
      id: attendee.id,
      firmId: attendee.firmId,
      matterId: attendee.matterId,
      eventId: attendee.eventId,
      name: attendee.name,
      email: attendee.email,
      role: attendee.role,
      responseStatus: attendee.responseStatus,
      invitationStatus: attendee.invitationStatus,
      invitedAt: attendee.invitedAt ? new Date(attendee.invitedAt) : null,
      invitationEmailId: attendee.invitationEmailId ?? null,
      invitationJobId: attendee.invitationJobId ?? null,
      createdAt: new Date(attendee.createdAt),
      updatedAt: new Date(attendee.updatedAt),
      deletedAt: attendee.deletedAt ? new Date(attendee.deletedAt) : null,
      createdByUserId: attendee.createdByUserId,
      updatedByUserId: attendee.updatedByUserId,
    };
    const [row] = await this.db
      .insert(schema.calendarEventAttendees)
      .values(values)
      .onConflictDoUpdate({
        target: schema.calendarEventAttendees.id,
        set: {
          name: values.name,
          email: values.email,
          role: values.role,
          responseStatus: values.responseStatus,
          invitationStatus: values.invitationStatus,
          invitedAt: values.invitedAt,
          invitationEmailId: values.invitationEmailId,
          invitationJobId: values.invitationJobId,
          updatedAt: values.updatedAt,
          deletedAt: values.deletedAt,
          updatedByUserId: values.updatedByUserId,
        },
        setWhere: sql`${schema.calendarEventAttendees.firmId} = ${attendee.firmId} and ${schema.calendarEventAttendees.matterId} = ${attendee.matterId} and ${schema.calendarEventAttendees.eventId} = ${attendee.eventId}`,
      })
      .returning();
    if (!row) {
      throw new Error(`Calendar attendee ${attendee.id} already exists in another scope`);
    }
    return mapCalendarEventAttendeeRow(row);
  }

  async deleteCalendarEventAttendee(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    attendeeId: string;
    deletedAt: string;
    updatedByUserId: string;
  }): Promise<CalendarEventAttendeeRecord | undefined> {
    const [row] = await this.db
      .update(schema.calendarEventAttendees)
      .set({
        deletedAt: new Date(input.deletedAt),
        updatedAt: new Date(input.deletedAt),
        updatedByUserId: input.updatedByUserId,
      })
      .where(
        and(
          eq(schema.calendarEventAttendees.firmId, input.firmId),
          eq(schema.calendarEventAttendees.matterId, input.matterId),
          eq(schema.calendarEventAttendees.eventId, input.eventId),
          eq(schema.calendarEventAttendees.id, input.attendeeId),
          isNull(schema.calendarEventAttendees.deletedAt),
        ),
      )
      .returning();
    return row ? mapCalendarEventAttendeeRow(row) : undefined;
  }

  async replaceCalendarEventAttendees(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    attendees: CalendarEventAttendeeUpsertInput[];
    replacedAt: string;
    updatedByUserId: string;
  }): Promise<CalendarEventAttendeeRecord[]> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.calendarEventAttendees)
        .set({
          deletedAt: new Date(input.replacedAt),
          updatedAt: new Date(input.replacedAt),
          updatedByUserId: input.updatedByUserId,
        })
        .where(
          and(
            eq(schema.calendarEventAttendees.firmId, input.firmId),
            eq(schema.calendarEventAttendees.matterId, input.matterId),
            eq(schema.calendarEventAttendees.eventId, input.eventId),
            isNull(schema.calendarEventAttendees.deletedAt),
          ),
        );
      if (input.attendees.length > 0) {
        await tx.insert(schema.calendarEventAttendees).values(
          input.attendees.map((attendee) => ({
            id: attendee.id,
            firmId: attendee.firmId,
            matterId: attendee.matterId,
            eventId: attendee.eventId,
            name: attendee.name,
            email: attendee.email,
            role: attendee.role,
            responseStatus: attendee.responseStatus,
            invitationStatus: attendee.invitationStatus,
            invitedAt: attendee.invitedAt ? new Date(attendee.invitedAt) : null,
            invitationEmailId: attendee.invitationEmailId ?? null,
            invitationJobId: attendee.invitationJobId ?? null,
            createdAt: new Date(attendee.createdAt),
            updatedAt: new Date(attendee.updatedAt),
            deletedAt: attendee.deletedAt ? new Date(attendee.deletedAt) : null,
            createdByUserId: attendee.createdByUserId,
            updatedByUserId: attendee.updatedByUserId,
          })),
        );
      }
    });
    return this.listCalendarEventAttendees(input.firmId, input.matterId, input.eventId);
  }

  async listCalendarEventReminders(
    firmId: string,
    matterId: string,
    eventId: string,
  ): Promise<CalendarEventReminderRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.calendarEventReminders)
      .where(
        and(
          eq(schema.calendarEventReminders.firmId, firmId),
          eq(schema.calendarEventReminders.matterId, matterId),
          eq(schema.calendarEventReminders.eventId, eventId),
          isNull(schema.calendarEventReminders.deletedAt),
        ),
      )
      .orderBy(asc(schema.calendarEventReminders.remindAt), asc(schema.calendarEventReminders.id));
    return rows.map(mapCalendarEventReminderRow);
  }

  async upsertCalendarEventReminder(
    reminder: CalendarEventReminderUpsertInput,
  ): Promise<CalendarEventReminderRecord> {
    const values = {
      id: reminder.id,
      firmId: reminder.firmId,
      matterId: reminder.matterId,
      eventId: reminder.eventId,
      remindAt: new Date(reminder.remindAt),
      channel: reminder.channel,
      status: reminder.status,
      note: reminder.note ?? null,
      createdAt: new Date(reminder.createdAt),
      updatedAt: new Date(reminder.updatedAt),
      deletedAt: reminder.deletedAt ? new Date(reminder.deletedAt) : null,
      createdByUserId: reminder.createdByUserId,
      updatedByUserId: reminder.updatedByUserId,
    };
    const [row] = await this.db
      .insert(schema.calendarEventReminders)
      .values(values)
      .onConflictDoUpdate({
        target: schema.calendarEventReminders.id,
        set: {
          remindAt: values.remindAt,
          channel: values.channel,
          status: values.status,
          note: values.note,
          updatedAt: values.updatedAt,
          deletedAt: values.deletedAt,
          updatedByUserId: values.updatedByUserId,
        },
        setWhere: sql`${schema.calendarEventReminders.firmId} = ${reminder.firmId} and ${schema.calendarEventReminders.matterId} = ${reminder.matterId} and ${schema.calendarEventReminders.eventId} = ${reminder.eventId}`,
      })
      .returning();
    if (!row) {
      throw new Error(`Calendar reminder ${reminder.id} already exists in another scope`);
    }
    return mapCalendarEventReminderRow(row);
  }

  async deleteCalendarEventReminder(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    reminderId: string;
    deletedAt: string;
    updatedByUserId: string;
  }): Promise<CalendarEventReminderRecord | undefined> {
    const [row] = await this.db
      .update(schema.calendarEventReminders)
      .set({
        deletedAt: new Date(input.deletedAt),
        updatedAt: new Date(input.deletedAt),
        updatedByUserId: input.updatedByUserId,
      })
      .where(
        and(
          eq(schema.calendarEventReminders.firmId, input.firmId),
          eq(schema.calendarEventReminders.matterId, input.matterId),
          eq(schema.calendarEventReminders.eventId, input.eventId),
          eq(schema.calendarEventReminders.id, input.reminderId),
          isNull(schema.calendarEventReminders.deletedAt),
        ),
      )
      .returning();
    return row ? mapCalendarEventReminderRow(row) : undefined;
  }

  async deleteCalendarEvent(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    deletedAt: string;
    updatedByUserId: string;
  }): Promise<CalendarEventRecord | undefined> {
    const [row] = await this.db
      .update(schema.calendarEvents)
      .set({
        deletedAt: new Date(input.deletedAt),
        updatedAt: new Date(input.deletedAt),
        updatedByUserId: input.updatedByUserId,
        sequence: sql`${schema.calendarEvents.sequence} + 1`,
      })
      .where(
        and(
          eq(schema.calendarEvents.firmId, input.firmId),
          eq(schema.calendarEvents.matterId, input.matterId),
          eq(schema.calendarEvents.id, input.eventId),
          isNull(schema.calendarEvents.deletedAt),
        ),
      )
      .returning();
    return row ? mapCalendarEventRow(row) : undefined;
  }

  async createCalendarCredential(
    credential: CalendarCredentialRecord,
  ): Promise<CalendarCredentialRecord> {
    const [row] = await this.db
      .insert(schema.calendarCredentials)
      .values({
        id: credential.id,
        firmId: credential.firmId,
        userId: credential.userId,
        username: credential.username,
        label: credential.label,
        passwordHash: credential.passwordHash,
        createdAt: new Date(credential.createdAt),
        createdByUserId: credential.createdByUserId,
        lastUsedAt: credential.lastUsedAt ? new Date(credential.lastUsedAt) : null,
        revokedAt: credential.revokedAt ? new Date(credential.revokedAt) : null,
      })
      .returning();
    return mapCalendarCredentialRow(row);
  }

  async listCalendarCredentials(
    firmId: string,
    userId: string,
  ): Promise<CalendarCredentialRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.calendarCredentials)
      .where(
        and(
          eq(schema.calendarCredentials.firmId, firmId),
          eq(schema.calendarCredentials.userId, userId),
        ),
      )
      .orderBy(asc(schema.calendarCredentials.createdAt));
    return rows.map(mapCalendarCredentialRow);
  }

  async getCalendarCredentialByUsername(
    username: string,
  ): Promise<CalendarCredentialRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.calendarCredentials)
      .where(
        and(
          eq(schema.calendarCredentials.username, username),
          isNull(schema.calendarCredentials.revokedAt),
        ),
      );
    return row ? mapCalendarCredentialRow(row) : undefined;
  }

  async touchCalendarCredential(id: string, lastUsedAt: string): Promise<void> {
    await this.db
      .update(schema.calendarCredentials)
      .set({ lastUsedAt: new Date(lastUsedAt) })
      .where(eq(schema.calendarCredentials.id, id));
  }

  async revokeCalendarCredential(input: {
    firmId: string;
    userId: string;
    credentialId: string;
    revokedAt: string;
  }): Promise<CalendarCredentialRecord | undefined> {
    const [row] = await this.db
      .update(schema.calendarCredentials)
      .set({ revokedAt: new Date(input.revokedAt) })
      .where(
        and(
          eq(schema.calendarCredentials.firmId, input.firmId),
          eq(schema.calendarCredentials.userId, input.userId),
          eq(schema.calendarCredentials.id, input.credentialId),
        ),
      )
      .returning();
    return row ? mapCalendarCredentialRow(row) : undefined;
  }

  async createCalendarMeetingSession(
    session: CalendarMeetingSessionCreateInput,
  ): Promise<CalendarMeetingSessionRecord> {
    const [eventRow] = await this.db
      .select({ id: schema.calendarEvents.id })
      .from(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.firmId, session.firmId),
          eq(schema.calendarEvents.matterId, session.matterId),
          eq(schema.calendarEvents.id, session.eventId),
          isNull(schema.calendarEvents.deletedAt),
        ),
      );
    if (!eventRow) {
      throw new Error(`Calendar event ${session.eventId} was not found`);
    }
    const [row] = await this.db
      .insert(schema.calendarMeetingSessions)
      .values(calendarMeetingSessionInsert(session))
      .returning();
    return mapCalendarMeetingSessionRow(row);
  }

  async listCalendarMeetingSessions(
    firmId: string,
    options: {
      matterId?: string;
      eventId?: string;
      status?: CalendarMeetingSessionRecord["status"];
    } = {},
  ): Promise<CalendarMeetingSessionRecord[]> {
    const conditions = [eq(schema.calendarMeetingSessions.firmId, firmId)];
    if (options.matterId) {
      conditions.push(eq(schema.calendarMeetingSessions.matterId, options.matterId));
    }
    if (options.eventId) {
      conditions.push(eq(schema.calendarMeetingSessions.eventId, options.eventId));
    }
    if (options.status) {
      conditions.push(eq(schema.calendarMeetingSessions.status, options.status));
    }
    const rows = await this.db
      .select()
      .from(schema.calendarMeetingSessions)
      .where(and(...conditions))
      .orderBy(
        desc(schema.calendarMeetingSessions.createdAt),
        asc(schema.calendarMeetingSessions.id),
      );
    return rows.map(mapCalendarMeetingSessionRow);
  }

  async getCalendarMeetingSession(
    firmId: string,
    matterId: string,
    eventId: string,
    sessionId: string,
  ): Promise<CalendarMeetingSessionRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.calendarMeetingSessions)
      .where(
        and(
          eq(schema.calendarMeetingSessions.firmId, firmId),
          eq(schema.calendarMeetingSessions.matterId, matterId),
          eq(schema.calendarMeetingSessions.eventId, eventId),
          eq(schema.calendarMeetingSessions.id, sessionId),
        ),
      );
    return row ? mapCalendarMeetingSessionRow(row) : undefined;
  }

  async updateCalendarMeetingSessionStatus(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    sessionId: string;
    status: CalendarMeetingSessionRecord["status"];
    occurredAt: string;
    actorUserId: string;
  }): Promise<CalendarMeetingSessionRecord | undefined> {
    const existing = await this.getCalendarMeetingSession(
      input.firmId,
      input.matterId,
      input.eventId,
      input.sessionId,
    );
    if (!existing) return undefined;
    const updated = transitionCalendarMeetingSessionStatus(existing, {
      status: input.status,
      occurredAt: input.occurredAt,
      actorUserId: input.actorUserId,
    });
    const [row] = await this.db
      .update(schema.calendarMeetingSessions)
      .set({
        status: updated.status,
        updatedAt: new Date(updated.updatedAt),
        updatedByUserId: updated.updatedByUserId,
        endedAt: updated.endedAt ? new Date(updated.endedAt) : null,
      })
      .where(
        and(
          eq(schema.calendarMeetingSessions.firmId, input.firmId),
          eq(schema.calendarMeetingSessions.matterId, input.matterId),
          eq(schema.calendarMeetingSessions.eventId, input.eventId),
          eq(schema.calendarMeetingSessions.id, input.sessionId),
        ),
      )
      .returning();
    return row ? mapCalendarMeetingSessionRow(row) : undefined;
  }

  async createCalendarGuestLink(
    link: CalendarGuestLinkCreateInput,
  ): Promise<CalendarGuestLinkRecord> {
    const session = await this.getCalendarMeetingSession(
      link.firmId,
      link.matterId,
      link.eventId,
      link.sessionId,
    );
    if (!session) {
      throw new Error(`Calendar meeting session ${link.sessionId} was not found`);
    }
    try {
      const [row] = await this.db
        .insert(schema.calendarGuestLinks)
        .values(calendarGuestLinkInsert(link))
        .returning();
      return mapCalendarGuestLinkRow(row);
    } catch (error) {
      if (isPostgresUniqueViolation(error, "calendar_guest_links_token_hash_idx")) {
        throw new Error("Calendar guest link token hash already exists", { cause: error });
      }
      throw error;
    }
  }

  async listCalendarGuestLinks(
    firmId: string,
    options: {
      matterId?: string;
      eventId?: string;
      sessionId?: string;
      status?: CalendarGuestLinkRecord["status"];
    } = {},
  ): Promise<CalendarGuestLinkRecord[]> {
    const conditions = [eq(schema.calendarGuestLinks.firmId, firmId)];
    if (options.matterId) {
      conditions.push(eq(schema.calendarGuestLinks.matterId, options.matterId));
    }
    if (options.eventId) {
      conditions.push(eq(schema.calendarGuestLinks.eventId, options.eventId));
    }
    if (options.sessionId) {
      conditions.push(eq(schema.calendarGuestLinks.sessionId, options.sessionId));
    }
    if (options.status) {
      conditions.push(eq(schema.calendarGuestLinks.status, options.status));
    }
    const rows = await this.db
      .select()
      .from(schema.calendarGuestLinks)
      .where(and(...conditions))
      .orderBy(desc(schema.calendarGuestLinks.createdAt), asc(schema.calendarGuestLinks.id));
    return rows.map(mapCalendarGuestLinkRow);
  }

  async getCalendarGuestLink(
    firmId: string,
    matterId: string,
    eventId: string,
    sessionId: string,
    linkId: string,
  ): Promise<CalendarGuestLinkRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.calendarGuestLinks)
      .where(
        and(
          eq(schema.calendarGuestLinks.firmId, firmId),
          eq(schema.calendarGuestLinks.matterId, matterId),
          eq(schema.calendarGuestLinks.eventId, eventId),
          eq(schema.calendarGuestLinks.sessionId, sessionId),
          eq(schema.calendarGuestLinks.id, linkId),
        ),
      );
    return row ? mapCalendarGuestLinkRow(row) : undefined;
  }

  async getCalendarGuestLinkByTokenHash(
    tokenHash: string,
  ): Promise<CalendarGuestLinkRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.calendarGuestLinks)
      .where(eq(schema.calendarGuestLinks.tokenHash, tokenHash));
    return row ? mapCalendarGuestLinkRow(row) : undefined;
  }

  async updateCalendarGuestLinkStatus(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    sessionId: string;
    linkId: string;
    status: CalendarGuestLinkRecord["status"];
    occurredAt: string;
    actorUserId: string;
  }): Promise<CalendarGuestLinkRecord | undefined> {
    const existing = await this.getCalendarGuestLink(
      input.firmId,
      input.matterId,
      input.eventId,
      input.sessionId,
      input.linkId,
    );
    if (!existing) return undefined;
    const updated = transitionCalendarGuestLinkStatus(existing, {
      status: input.status,
      occurredAt: input.occurredAt,
      actorUserId: input.actorUserId,
    });
    const [row] = await this.db
      .update(schema.calendarGuestLinks)
      .set({
        status: updated.status,
        updatedAt: new Date(updated.updatedAt),
        updatedByUserId: updated.updatedByUserId,
        checkedInAt: updated.checkedInAt ? new Date(updated.checkedInAt) : null,
        revokedAt: updated.revokedAt ? new Date(updated.revokedAt) : null,
        admittedAt: updated.admittedAt ? new Date(updated.admittedAt) : null,
        deniedAt: updated.deniedAt ? new Date(updated.deniedAt) : null,
      })
      .where(
        and(
          eq(schema.calendarGuestLinks.firmId, input.firmId),
          eq(schema.calendarGuestLinks.matterId, input.matterId),
          eq(schema.calendarGuestLinks.eventId, input.eventId),
          eq(schema.calendarGuestLinks.sessionId, input.sessionId),
          eq(schema.calendarGuestLinks.id, input.linkId),
        ),
      )
      .returning();
    return row ? mapCalendarGuestLinkRow(row) : undefined;
  }

  async revokeCalendarGuestLink(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    sessionId: string;
    linkId: string;
    revokedAt: string;
    actorUserId: string;
  }): Promise<CalendarGuestLinkRecord | undefined> {
    return this.updateCalendarGuestLinkStatus({
      firmId: input.firmId,
      matterId: input.matterId,
      eventId: input.eventId,
      sessionId: input.sessionId,
      linkId: input.linkId,
      status: "revoked",
      occurredAt: input.revokedAt,
      actorUserId: input.actorUserId,
    });
  }

  async runConflictCheck(input: {
    firmId: string;
    actorId: string;
    prospectiveName: string;
    aliases?: string[];
    identifiers?: Array<{ type: string; value: string }>;
    prospectiveRole?: "client" | "opposing_party" | "third_party";
    includeClosedMatters: boolean;
  }): Promise<{ results: ReturnType<typeof runConflictCheck>; auditChainValid: boolean }> {
    const contacts = await this.listContacts(input.firmId);
    const matters = (
      await this.db.select().from(schema.matters).where(eq(schema.matters.firmId, input.firmId))
    ).map(mapMatter);
    const matterParties = await this.listMatterParties(input.firmId);
    const results = runConflictCheck({ ...input, contacts, matters, matterParties });
    const checkId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const previous = (await this.listAuditEvents(input.firmId)).events.at(-1);
    const event = appendAuditEvent(previous, {
      id: crypto.randomUUID(),
      firmId: input.firmId,
      actorId: input.actorId,
      action: "conflict_check.completed",
      resourceType: "conflict_check",
      resourceId: checkId,
      occurredAt: createdAt,
      metadata: { prospectiveName: input.prospectiveName, matchCount: results.length },
    });
    await this.db.insert(schema.conflictChecks).values({
      id: checkId,
      firmId: input.firmId,
      requestedByUserId: input.actorId,
      prospectiveName: input.prospectiveName,
      querySnapshot: {
        prospectiveName: input.prospectiveName,
        aliases: input.aliases ?? [],
        identifiers: input.identifiers ?? [],
        includeClosedMatters: input.includeClosedMatters,
        ...(input.prospectiveRole ? { prospectiveRole: input.prospectiveRole } : {}),
      },
      resultSnapshot: results,
      disposition: "pending_review",
      createdAt: new Date(createdAt),
    });
    await this.db.insert(schema.auditEvents).values({
      ...event,
      occurredAt: new Date(event.occurredAt),
    });
    return { results, auditChainValid: (await this.listAuditEvents(input.firmId)).valid };
  }

  async getLedger(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<{
    accounts: LedgerAccount[];
    entries: LedgerEntry[];
    balances: Record<string, number>;
    trustBalances: Record<string, number>;
  }> {
    const accounts = (await this.db
      .select()
      .from(schema.ledgerAccounts)
      .where(eq(schema.ledgerAccounts.firmId, firmId))) as LedgerAccount[];
    const rows = await this.db
      .select()
      .from(schema.trustLedgerEntries)
      .where(
        options.matterId
          ? and(
              eq(schema.trustLedgerEntries.firmId, firmId),
              eq(schema.trustLedgerEntries.matterId, options.matterId),
            )
          : eq(schema.trustLedgerEntries.firmId, firmId),
      );
    const transactionRows = await this.db
      .select()
      .from(schema.trustTransactions)
      .where(eq(schema.trustTransactions.firmId, firmId));
    const postedAtByTransactionId = new Map(
      transactionRows.map((transaction) => [transaction.id, transaction.postedAt.toISOString()]),
    );
    const entries: LedgerEntry[] = rows.map((row) => ({
      id: row.id,
      transactionId: row.transactionId,
      firmId: row.firmId,
      matterId: row.matterId,
      clientId: row.clientId,
      accountId: row.accountId,
      debitCents: row.debitCents,
      creditCents: row.creditCents,
      memo: row.memo,
      postedAt: postedAtByTransactionId.get(row.transactionId) ?? "",
    }));
    return {
      accounts,
      entries,
      balances: ledgerBalanceByMatter(entries),
      trustBalances: clientTrustBalanceByMatter(entries, accounts),
    };
  }

  async validateLedgerTransactionScope(input: {
    user: User;
    transaction: LedgerTransaction;
  }): Promise<void> {
    if (input.transaction.firmId !== input.user.firmId) {
      throw new Error("Ledger transaction firm does not match authenticated user");
    }

    const firmWide = userHasFirmWideLedgerAccess(input.user);
    const matterIds = [...new Set(input.transaction.entries.map((entry) => entry.matterId))];
    const clientIds = [...new Set(input.transaction.entries.map((entry) => entry.clientId))];
    const accountIds = [...new Set(input.transaction.entries.map((entry) => entry.accountId))];

    const [matters, contacts, accounts, parties] = await Promise.all([
      this.db.select().from(schema.matters).where(inArray(schema.matters.id, matterIds)),
      this.db.select().from(schema.contacts).where(inArray(schema.contacts.id, clientIds)),
      this.db
        .select()
        .from(schema.ledgerAccounts)
        .where(inArray(schema.ledgerAccounts.id, accountIds)),
      this.db
        .select()
        .from(schema.matterParties)
        .where(inArray(schema.matterParties.matterId, matterIds)),
    ]);

    for (const entry of input.transaction.entries) {
      if (entry.firmId !== input.user.firmId) {
        throw new Error("Ledger entry firm does not match authenticated user");
      }
      if (!firmWide && !input.user.assignedMatterIds.includes(entry.matterId)) {
        throw new Error("Ledger entry is outside the authenticated matter scope");
      }
      const matter = matters.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.matterId,
      );
      if (!matter) throw new Error(`Unknown ledger matter ${entry.matterId}`);
      const contact = contacts.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.clientId,
      );
      if (!contact) throw new Error(`Unknown ledger client ${entry.clientId}`);
      const account = accounts.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.accountId,
      );
      if (!account) throw new Error(`Unknown ledger account ${entry.accountId}`);
      const party = parties.find(
        (candidate) =>
          candidate.firmId === input.user.firmId &&
          candidate.matterId === entry.matterId &&
          candidate.contactId === entry.clientId &&
          !candidate.adverse,
      );
      if (!party) {
        throw new Error("Ledger client must be a non-adverse party on the matter");
      }
    }
  }

  async postLedgerTransaction(transaction: LedgerTransaction): Promise<PostedLedgerTransaction> {
    return this.db.transaction(async (tx) => {
      const requestFingerprint =
        transaction.requestFingerprint ?? ledgerRequestFingerprint(transaction);
      const [duplicateTransaction] = await tx
        .select()
        .from(schema.trustTransactions)
        .where(
          and(
            eq(schema.trustTransactions.firmId, transaction.firmId),
            eq(schema.trustTransactions.idempotencyKey, transaction.idempotencyKey),
          ),
        );

      if (duplicateTransaction) {
        if (duplicateTransaction.requestFingerprint !== requestFingerprint) {
          throw new Error("Idempotency key was reused with a different ledger payload");
        }
        const duplicateEntries = await tx
          .select()
          .from(schema.trustLedgerEntries)
          .where(eq(schema.trustLedgerEntries.transactionId, duplicateTransaction.id));
        return {
          id: duplicateTransaction.id,
          firmId: duplicateTransaction.firmId,
          idempotencyKey: duplicateTransaction.idempotencyKey,
          requestFingerprint: duplicateTransaction.requestFingerprint,
          reversesTransactionId: duplicateTransaction.reversesTransactionId ?? undefined,
          entries: duplicateEntries.map((entry) => ({
            id: entry.id,
            transactionId: entry.transactionId,
            firmId: entry.firmId,
            matterId: entry.matterId,
            clientId: entry.clientId,
            accountId: entry.accountId,
            debitCents: entry.debitCents,
            creditCents: entry.creditCents,
            memo: entry.memo,
            postedAt: duplicateTransaction.postedAt.toISOString(),
          })),
        };
      }

      const existingRows = await tx
        .select()
        .from(schema.trustTransactions)
        .where(eq(schema.trustTransactions.firmId, transaction.firmId));
      const entryRows = await tx
        .select()
        .from(schema.trustLedgerEntries)
        .where(eq(schema.trustLedgerEntries.firmId, transaction.firmId));
      const postedTransactions: PostedLedgerTransaction[] = existingRows.map((row) => ({
        id: row.id,
        firmId: row.firmId,
        idempotencyKey: row.idempotencyKey,
        requestFingerprint: row.requestFingerprint,
        reversesTransactionId: row.reversesTransactionId ?? undefined,
        entries: entryRows
          .filter((entry) => entry.transactionId === row.id)
          .map((entry) => ({
            id: entry.id,
            transactionId: entry.transactionId,
            firmId: entry.firmId,
            matterId: entry.matterId,
            clientId: entry.clientId,
            accountId: entry.accountId,
            debitCents: entry.debitCents,
            creditCents: entry.creditCents,
            memo: entry.memo,
            postedAt: row.postedAt.toISOString(),
          })),
      }));
      const accounts = (await tx
        .select()
        .from(schema.ledgerAccounts)
        .where(eq(schema.ledgerAccounts.firmId, transaction.firmId))) as LedgerAccount[];
      const posted = postLedgerTransaction(
        { postedTransactions, accounts },
        { ...transaction, requestFingerprint },
      );

      await tx.insert(schema.trustTransactions).values({
        id: posted.id,
        firmId: posted.firmId,
        idempotencyKey: posted.idempotencyKey,
        requestFingerprint: posted.requestFingerprint,
        postedByUserId: transaction.postedByUserId,
        postedAt: new Date(transaction.postedAt),
        reversesTransactionId: posted.reversesTransactionId,
      });
      await tx.insert(schema.trustLedgerEntries).values(posted.entries);

      const updatedAt = new Date(transaction.postedAt);
      for (const delta of clientTrustBalanceDeltas(posted.entries, accounts)) {
        if (delta.deltaCents > 0) {
          await tx
            .insert(schema.trustClientBalances)
            .values({
              firmId: delta.firmId,
              matterId: delta.matterId,
              clientId: delta.clientId,
              balanceCents: delta.deltaCents,
              updatedAt,
            })
            .onConflictDoUpdate({
              target: [
                schema.trustClientBalances.firmId,
                schema.trustClientBalances.matterId,
                schema.trustClientBalances.clientId,
              ],
              set: {
                balanceCents: sql`${schema.trustClientBalances.balanceCents} + ${delta.deltaCents}`,
                updatedAt,
              },
            });
          continue;
        }

        const updatedBalances = await tx
          .update(schema.trustClientBalances)
          .set({
            balanceCents: sql`${schema.trustClientBalances.balanceCents} + ${delta.deltaCents}`,
            updatedAt,
          })
          .where(
            and(
              eq(schema.trustClientBalances.firmId, delta.firmId),
              eq(schema.trustClientBalances.matterId, delta.matterId),
              eq(schema.trustClientBalances.clientId, delta.clientId),
              sql`${schema.trustClientBalances.balanceCents} + ${delta.deltaCents} >= 0`,
            ),
          )
          .returning({ balanceCents: schema.trustClientBalances.balanceCents });
        if (updatedBalances.length === 0) {
          throw new Error("Trust transaction would overdraw the client matter balance");
        }
      }

      return posted;
    });
  }

  async listAuditEvents(firmId: string): Promise<{ events: AuditEvent[]; valid: boolean }> {
    const rows = await this.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.firmId, firmId))
      .orderBy(asc(schema.auditEvents.occurredAt));
    const events = rows.map((row) => ({
      ...row,
      occurredAt: row.occurredAt.toISOString(),
      metadata: row.metadata as Record<string, unknown>,
    }));
    return { events, valid: verifyAuditChain(events) };
  }

  async appendAuditEvent(event: NewAuditEvent): Promise<AuditEvent> {
    const [previousRow] = await this.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.firmId, event.firmId))
      .orderBy(desc(schema.auditEvents.occurredAt))
      .limit(1);
    const previous = previousRow
      ? {
          ...previousRow,
          occurredAt: previousRow.occurredAt.toISOString(),
          metadata: previousRow.metadata as Record<string, unknown>,
        }
      : undefined;
    const appended = appendAuditEvent(previous, event);
    await this.db.insert(schema.auditEvents).values({
      ...appended,
      occurredAt: new Date(appended.occurredAt),
      metadata: appended.metadata,
    });
    return appended;
  }

  async recordAuditEvent(event: AuditEvent): Promise<void> {
    await this.db.insert(schema.auditEvents).values({
      ...event,
      occurredAt: new Date(event.occurredAt),
    });
  }

  async listPortalGrants(firmId: string): Promise<PortalGrant[]> {
    const rows = await this.db
      .select()
      .from(schema.portalGrants)
      .where(eq(schema.portalGrants.firmId, firmId));
    return rows.map((row) => ({
      id: row.id,
      firmId: row.firmId,
      matterId: row.matterId,
      contactId: row.contactId,
      grantedByUserId: row.grantedByUserId,
      permissions: row.permissions as PortalGrant["permissions"],
      expiresAt: dateToIso(row.expiresAt),
      revokedAt: dateToIso(row.revokedAt),
    }));
  }

  async listShareLinks(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<ShareLinkRecord[]> {
    const filters = [eq(schema.shareLinks.firmId, firmId)];
    if (options.matterId) filters.push(eq(schema.shareLinks.matterId, options.matterId));
    const rows = await this.db
      .select()
      .from(schema.shareLinks)
      .where(and(...filters))
      .orderBy(desc(schema.shareLinks.createdAt));
    return rows.map(mapShareLinkRow);
  }

  async createShareLink(link: ShareLinkRecord): Promise<ShareLinkRecord> {
    await this.db.insert(schema.shareLinks).values({
      id: link.id,
      firmId: link.firmId,
      matterId: link.matterId,
      tokenHash: link.tokenHash,
      grantedByUserId: link.grantedByUserId,
      permissions: link.permissions,
      requireEmailVerification: link.requireEmailVerification,
      expiresAt: link.expiresAt ? new Date(link.expiresAt) : null,
      revokedAt: link.revokedAt ? new Date(link.revokedAt) : null,
      createdAt: new Date(link.createdAt),
    });
    return clone(link);
  }

  async getShareLink(firmId: string, id: string): Promise<ShareLinkRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.shareLinks)
      .where(and(eq(schema.shareLinks.firmId, firmId), eq(schema.shareLinks.id, id)));
    return row ? mapShareLinkRow(row) : undefined;
  }

  async getShareLinkByTokenHash(tokenHash: string): Promise<ShareLinkRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.shareLinks)
      .where(eq(schema.shareLinks.tokenHash, tokenHash));
    return row ? mapShareLinkRow(row) : undefined;
  }

  async revokeShareLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<ShareLinkRecord | undefined> {
    const [row] = await this.db
      .update(schema.shareLinks)
      .set({ revokedAt: new Date(input.revokedAt) })
      .where(and(eq(schema.shareLinks.firmId, input.firmId), eq(schema.shareLinks.id, input.id)))
      .returning();
    return row ? mapShareLinkRow(row) : undefined;
  }

  async listExternalUploadLinks(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<ExternalUploadLinkRecord[]> {
    const conditions = [eq(schema.externalUploadLinks.firmId, firmId)];
    if (options.matterId) {
      conditions.push(eq(schema.externalUploadLinks.matterId, options.matterId));
    }
    const rows = await this.db
      .select()
      .from(schema.externalUploadLinks)
      .where(and(...conditions))
      .orderBy(desc(schema.externalUploadLinks.createdAt));
    return rows.map(mapExternalUploadLinkRow);
  }

  async createExternalUploadLink(
    link: ExternalUploadLinkRecord,
  ): Promise<ExternalUploadLinkRecord> {
    try {
      const [row] = await this.db
        .insert(schema.externalUploadLinks)
        .values(externalUploadLinkInsert(link))
        .returning();
      return mapExternalUploadLinkRow(row);
    } catch (error) {
      if (!isPostgresUniqueViolation(error, "external_upload_links_firm_idempotency_idx")) {
        throw error;
      }
      const [existingRow] = await this.db
        .select()
        .from(schema.externalUploadLinks)
        .where(
          and(
            eq(schema.externalUploadLinks.firmId, link.firmId),
            eq(schema.externalUploadLinks.idempotencyKey, link.idempotencyKey ?? ""),
          ),
        );
      if (!existingRow) throw error;
      const existing = mapExternalUploadLinkRow(existingRow);
      const existingFingerprint = canonicalizeForIdempotency({
        matterId: existing.matterId,
        requestedByUserId: existing.requestedByUserId,
        maxUploads: existing.maxUploads,
        expiresAt: existing.expiresAt,
      });
      const inputFingerprint = canonicalizeForIdempotency({
        matterId: link.matterId,
        requestedByUserId: link.requestedByUserId,
        maxUploads: link.maxUploads,
        expiresAt: link.expiresAt,
      });
      if (existingFingerprint !== inputFingerprint) throw new IdempotencyKeyConflictError();
      return existing;
    }
  }

  async listSavedOperationalViewDefinitions(
    firmId: string,
    options: {
      ownerUserId: string;
      surface?: SavedOperationalViewDefinition["surface"];
      includeArchived?: boolean;
    },
  ): Promise<SavedOperationalViewDefinition[]> {
    const conditions = [
      eq(schema.savedOperationalViewDefinitions.firmId, firmId),
      eq(schema.savedOperationalViewDefinitions.ownerUserId, options.ownerUserId),
    ];
    if (options.surface) {
      conditions.push(eq(schema.savedOperationalViewDefinitions.surface, options.surface));
    }
    if (!options.includeArchived) {
      conditions.push(eq(schema.savedOperationalViewDefinitions.status, "active"));
    }
    const rows = await this.db
      .select()
      .from(schema.savedOperationalViewDefinitions)
      .where(and(...conditions))
      .orderBy(asc(schema.savedOperationalViewDefinitions.name));
    return rows.map(mapSavedOperationalViewDefinitionRow);
  }

  async getSavedOperationalViewDefinition(
    firmId: string,
    id: string,
  ): Promise<SavedOperationalViewDefinition | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.savedOperationalViewDefinitions)
      .where(
        and(
          eq(schema.savedOperationalViewDefinitions.firmId, firmId),
          eq(schema.savedOperationalViewDefinitions.id, id),
        ),
      );
    return row ? mapSavedOperationalViewDefinitionRow(row) : undefined;
  }

  async createSavedOperationalViewDefinition(
    input: SavedOperationalViewDefinitionInput,
  ): Promise<SavedOperationalViewDefinition> {
    const now = new Date().toISOString();
    const definition: SavedOperationalViewDefinition = {
      id: input.id ?? crypto.randomUUID(),
      firmId: input.firmId,
      ownerUserId: input.ownerUserId,
      surface: input.surface,
      name: input.name,
      filters: input.filters ?? {},
      columns: input.columns ?? [],
      sort: input.sort ?? {},
      rowLimit: input.rowLimit ?? 25,
      dashboardBehavior: input.dashboardBehavior ?? {},
      permissionScope: input.permissionScope ?? ["matter:read"],
      status: input.status ?? "active",
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      archivedAt: input.archivedAt,
    };
    const [row] = await this.db
      .insert(schema.savedOperationalViewDefinitions)
      .values(savedOperationalViewDefinitionInsert(definition))
      .returning();
    return mapSavedOperationalViewDefinitionRow(row);
  }

  async updateSavedOperationalViewDefinition(
    firmId: string,
    id: string,
    updates: Partial<
      Pick<
        SavedOperationalViewDefinition,
        | "name"
        | "filters"
        | "columns"
        | "sort"
        | "rowLimit"
        | "dashboardBehavior"
        | "permissionScope"
        | "updatedAt"
      >
    >,
  ): Promise<SavedOperationalViewDefinition | undefined> {
    const [row] = await this.db
      .update(schema.savedOperationalViewDefinitions)
      .set({
        ...updates,
        updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : new Date(),
      })
      .where(
        and(
          eq(schema.savedOperationalViewDefinitions.firmId, firmId),
          eq(schema.savedOperationalViewDefinitions.id, id),
        ),
      )
      .returning();
    return row ? mapSavedOperationalViewDefinitionRow(row) : undefined;
  }

  async archiveSavedOperationalViewDefinition(input: {
    firmId: string;
    id: string;
    archivedAt: string;
  }): Promise<SavedOperationalViewDefinition | undefined> {
    const archivedAt = new Date(input.archivedAt);
    const [row] = await this.db
      .update(schema.savedOperationalViewDefinitions)
      .set({ status: "archived", archivedAt, updatedAt: archivedAt })
      .where(
        and(
          eq(schema.savedOperationalViewDefinitions.firmId, input.firmId),
          eq(schema.savedOperationalViewDefinitions.id, input.id),
        ),
      )
      .returning();
    return row ? mapSavedOperationalViewDefinitionRow(row) : undefined;
  }

  async getExternalUploadLinkByTokenHash(
    tokenHash: string,
  ): Promise<ExternalUploadLinkRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.externalUploadLinks)
      .where(eq(schema.externalUploadLinks.tokenHash, tokenHash));
    return row ? mapExternalUploadLinkRow(row) : undefined;
  }

  async revokeExternalUploadLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<ExternalUploadLinkRecord | undefined> {
    const [row] = await this.db
      .update(schema.externalUploadLinks)
      .set({ revokedAt: new Date(input.revokedAt) })
      .where(
        and(
          eq(schema.externalUploadLinks.firmId, input.firmId),
          eq(schema.externalUploadLinks.id, input.id),
        ),
      )
      .returning();
    return row ? mapExternalUploadLinkRow(row) : undefined;
  }

  async claimExternalUploadUse(input: {
    firmId: string;
    id: string;
    usedAt: string;
  }): Promise<ExternalUploadLinkRecord | undefined> {
    const usedAt = new Date(input.usedAt);
    const [row] = await this.db
      .update(schema.externalUploadLinks)
      .set({ usedUploads: sql`${schema.externalUploadLinks.usedUploads} + 1` })
      .where(
        and(
          eq(schema.externalUploadLinks.firmId, input.firmId),
          eq(schema.externalUploadLinks.id, input.id),
          isNull(schema.externalUploadLinks.revokedAt),
          gt(schema.externalUploadLinks.expiresAt, usedAt),
          sql`${schema.externalUploadLinks.usedUploads} < ${schema.externalUploadLinks.maxUploads}`,
        ),
      )
      .returning();
    return row ? mapExternalUploadLinkRow(row) : undefined;
  }

  async createAccessLog(log: AccessLogRecord): Promise<AccessLogRecord> {
    const [row] = await this.db.insert(schema.accessLogs).values(accessLogInsert(log)).returning();
    return mapAccessLogRow(row);
  }

  async listAccessLogs(
    firmId: string,
    options: {
      shareLinkId?: string;
      externalUploadLinkId?: string;
      intakeFormLinkId?: string;
      resourceType?: string;
      resourceId?: string;
    } = {},
  ): Promise<AccessLogRecord[]> {
    const conditions = [eq(schema.accessLogs.firmId, firmId)];
    if (options.shareLinkId) {
      conditions.push(eq(schema.accessLogs.shareLinkId, options.shareLinkId));
    }
    if (options.externalUploadLinkId) {
      conditions.push(eq(schema.accessLogs.externalUploadLinkId, options.externalUploadLinkId));
    }
    if (options.intakeFormLinkId) {
      conditions.push(eq(schema.accessLogs.intakeFormLinkId, options.intakeFormLinkId));
    }
    if (options.resourceType) {
      conditions.push(eq(schema.accessLogs.resourceType, options.resourceType));
    }
    if (options.resourceId) {
      conditions.push(eq(schema.accessLogs.resourceId, options.resourceId));
    }
    const rows = await this.db
      .select()
      .from(schema.accessLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.accessLogs.occurredAt));
    return rows.map(mapAccessLogRow);
  }

  async createDocumentUploadIntent(input: DocumentUploadIntent): Promise<DocumentRecord> {
    const supersededDocument = input.supersedesDocumentId
      ? await this.getDocument(input.firmId, input.supersedesDocumentId)
      : undefined;
    if (
      input.supersedesDocumentId &&
      (!supersededDocument || supersededDocument.matterId !== input.matterId)
    ) {
      throw new Error(`Unknown superseded document ${input.supersedesDocumentId}`);
    }
    const now = new Date();
    const document = {
      id: input.id,
      firmId: input.firmId,
      matterId: input.matterId,
      title: input.title,
      storageKey: input.storageKey,
      checksumSha256: input.checksumSha256,
      version: supersededDocument ? supersededDocument.version + 1 : 1,
      classification: input.classification,
      legalHold: input.legalHold,
      uploadStatus: "intent_created" as const,
      checksumStatus: "pending" as const,
      scanStatus: "pending" as const,
      reviewStatus: input.reviewStatus ?? ("not_required" as const),
      reviewMetadata: {},
      externalUploadLinkId: input.externalUploadLinkId,
      supersedesDocumentId: input.supersedesDocumentId,
    };
    await this.db.transaction(async (tx) => {
      if (supersededDocument) {
        await tx
          .update(schema.documents)
          .set({ supersededAt: now })
          .where(
            and(
              eq(schema.documents.firmId, input.firmId),
              eq(schema.documents.id, supersededDocument.id),
            ),
          );
      }
      await tx.insert(schema.documents).values(document);
    });
    return document;
  }

  async completeDocumentUpload(input: {
    firmId: string;
    documentId: string;
    checksumSha256: string;
    scanStatus?: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord> {
    const document = await this.getDocument(input.firmId, input.documentId);
    if (!document) throw new Error(`Unknown document ${input.documentId}`);
    const documents = await this.listDocuments(input.firmId);
    const duplicate = documents.find(
      (candidate) =>
        candidate.id !== input.documentId &&
        candidate.checksumSha256 === input.checksumSha256 &&
        candidate.checksumStatus === "verified",
    );
    const now = new Date();
    const checksumMatches = document.checksumSha256 === input.checksumSha256;
    const [row] = await this.db
      .update(schema.documents)
      .set({
        uploadStatus: checksumMatches ? "verified" : "rejected",
        checksumStatus: checksumMatches ? (duplicate ? "duplicate" : "verified") : "mismatch",
        scanStatus: checksumMatches ? (input.scanStatus ?? "queued") : "failed",
        reviewStatus: document.externalUploadLinkId
          ? checksumMatches
            ? "pending_review"
            : "retry_requested"
          : "not_required",
        reviewReason: checksumMatches ? (duplicate ? "duplicate" : null) : "checksum_mismatch",
        reviewMetadata: checksumMatches
          ? duplicate
            ? { automatedOutcome: "duplicate_detected", duplicateOfDocumentId: duplicate.id }
            : {}
          : document.externalUploadLinkId
            ? { automatedOutcome: "checksum_mismatch" }
            : {},
        duplicateOfDocumentId: duplicate?.id,
        uploadedAt: now,
        verifiedAt: now,
      })
      .where(
        and(eq(schema.documents.firmId, input.firmId), eq(schema.documents.id, input.documentId)),
      )
      .returning();
    if (!row) throw new Error(`Unknown document ${input.documentId}`);
    return mapDocumentRow(row);
  }

  async reviewUploadedDocument(input: {
    firmId: string;
    documentId: string;
    status: DocumentRecord["reviewStatus"];
    decision: DocumentRecord["reviewDecision"];
    reason?: DocumentRecord["reviewReason"];
    metadata: Record<string, unknown>;
    reviewedByUserId: string;
    reviewedAt: string;
  }): Promise<DocumentRecord> {
    const [row] = await this.db
      .update(schema.documents)
      .set({
        reviewStatus: input.status,
        reviewDecision: input.decision,
        reviewReason: input.reason ?? null,
        reviewMetadata: input.metadata,
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: new Date(input.reviewedAt),
      })
      .where(
        and(eq(schema.documents.firmId, input.firmId), eq(schema.documents.id, input.documentId)),
      )
      .returning();
    if (!row) throw new Error(`Unknown document ${input.documentId}`);
    return mapDocumentRow(row);
  }

  async updateDocumentScanStatus(input: {
    firmId: string;
    documentId: string;
    scanStatus: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord> {
    const [row] = await this.db
      .update(schema.documents)
      .set({ scanStatus: input.scanStatus })
      .where(
        and(eq(schema.documents.firmId, input.firmId), eq(schema.documents.id, input.documentId)),
      )
      .returning();
    if (!row) throw new Error(`Unknown document ${input.documentId}`);
    return mapDocumentRow(row);
  }

  async listSignatureRequests(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<SignatureRequestRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.signatureRequests)
      .where(
        options.matterId
          ? and(
              eq(schema.signatureRequests.firmId, firmId),
              eq(schema.signatureRequests.matterId, options.matterId),
            )
          : eq(schema.signatureRequests.firmId, firmId),
      );
    return rows.map(mapSignatureRequestRow);
  }

  async listSignatureRequestSigners(
    firmId: string,
    signatureRequestId: string,
  ): Promise<SignatureRequestSignerRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.signatureRequestSigners)
      .where(
        and(
          eq(schema.signatureRequestSigners.firmId, firmId),
          eq(schema.signatureRequestSigners.signatureRequestId, signatureRequestId),
        ),
      );
    return rows.map(mapSignatureRequestSignerRow);
  }

  async createSignatureRequest(input: {
    request: SignatureRequestRecord;
    signers: SignatureRequestSignerRecord[];
    event: SignatureProviderEventRecord;
  }): Promise<{ request: SignatureRequestRecord; signers: SignatureRequestSignerRecord[] }> {
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.signatureRequests).values({
        ...input.request,
        createdAt: new Date(input.request.createdAt),
        completedAt: input.request.completedAt ? new Date(input.request.completedAt) : null,
        declinedAt: input.request.declinedAt ? new Date(input.request.declinedAt) : null,
      });
      await tx.insert(schema.signatureRequestSigners).values(
        input.signers.map((signer) => ({
          ...signer,
          completedAt: signer.completedAt ? new Date(signer.completedAt) : null,
        })),
      );
      await tx.insert(schema.signatureProviderEvents).values({
        ...input.event,
        occurredAt: new Date(input.event.occurredAt),
      });
    });
    return { request: input.request, signers: input.signers };
  }

  async recordSignatureProviderEvent(
    event: SignatureProviderEventRecord,
    webhookAttempt?: SignatureWebhookAttemptRecord,
  ): Promise<SignatureProviderEventRecord> {
    const [current] = await this.db
      .select()
      .from(schema.signatureRequests)
      .where(
        and(
          eq(schema.signatureRequests.firmId, event.firmId),
          eq(schema.signatureRequests.id, event.signatureRequestId),
        ),
      );
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.signatureProviderEvents).values({
        ...event,
        occurredAt: new Date(event.occurredAt),
      });
      if (webhookAttempt) {
        await tx.insert(schema.signatureWebhookAttempts).values({
          ...webhookAttempt,
          receivedAt: new Date(webhookAttempt.receivedAt),
          processedAt: webhookAttempt.processedAt ? new Date(webhookAttempt.processedAt) : null,
        });
      }
      if (
        current &&
        shouldUpdateSignatureRequestStatus(current.status as SignatureProviderStatus, event)
      ) {
        await tx
          .update(schema.signatureRequests)
          .set({
            status: event.status,
            evidence: event.evidence,
            completedAt: event.status === "completed" ? new Date(event.occurredAt) : undefined,
            declinedAt: event.status === "declined" ? new Date(event.occurredAt) : undefined,
          })
          .where(
            and(
              eq(schema.signatureRequests.firmId, event.firmId),
              eq(schema.signatureRequests.id, event.signatureRequestId),
            ),
          );
      }
    });
    return event;
  }

  async recordSignatureWebhookAttempt(
    attempt: SignatureWebhookAttemptRecord,
  ): Promise<SignatureWebhookAttemptRecord> {
    await this.db.insert(schema.signatureWebhookAttempts).values({
      ...attempt,
      receivedAt: new Date(attempt.receivedAt),
      processedAt: attempt.processedAt ? new Date(attempt.processedAt) : null,
    });
    return attempt;
  }

  async listSignatureProviderEvents(
    firmId: string,
    options: { signatureRequestId?: string } = {},
  ): Promise<SignatureProviderEventRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.signatureProviderEvents)
      .where(
        options.signatureRequestId
          ? and(
              eq(schema.signatureProviderEvents.firmId, firmId),
              eq(schema.signatureProviderEvents.signatureRequestId, options.signatureRequestId),
            )
          : eq(schema.signatureProviderEvents.firmId, firmId),
      )
      .orderBy(asc(schema.signatureProviderEvents.occurredAt));
    return rows.map(mapSignatureProviderEventRow);
  }

  async listSignatureWebhookAttempts(
    firmId: string,
    options: { provider?: SignatureWebhookAttemptRecord["provider"]; externalId?: string } = {},
  ): Promise<SignatureWebhookAttemptRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.signatureWebhookAttempts)
      .where(eq(schema.signatureWebhookAttempts.firmId, firmId))
      .orderBy(asc(schema.signatureWebhookAttempts.receivedAt));
    return rows
      .map(mapSignatureWebhookAttemptRow)
      .filter(
        (attempt) =>
          (!options.provider || attempt.provider === options.provider) &&
          (!options.externalId || attempt.externalId === options.externalId),
      );
  }

  async listIntakeTemplates(firmId: string): Promise<IntakeTemplateRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.intakeTemplates)
      .where(eq(schema.intakeTemplates.firmId, firmId));
    return rows.map(mapIntakeTemplateRow);
  }

  async createIntakeTemplate(template: IntakeTemplateRecord): Promise<IntakeTemplateRecord> {
    await this.db.insert(schema.intakeTemplates).values({
      ...template,
      createdAt: new Date(template.createdAt),
      updatedAt: new Date(template.updatedAt),
    });
    return template;
  }

  async updateIntakeTemplate(template: IntakeTemplateRecord): Promise<IntakeTemplateRecord> {
    const [row] = await this.db
      .update(schema.intakeTemplates)
      .set({
        name: template.name,
        description: template.description,
        category: template.category,
        provider: template.provider,
        externalTemplateId: template.externalTemplateId,
        active: template.active,
        definitionVersion: template.definitionVersion,
        definition: template.definition,
        updatedAt: new Date(template.updatedAt),
        metadata: template.metadata,
      })
      .where(
        and(
          eq(schema.intakeTemplates.firmId, template.firmId),
          eq(schema.intakeTemplates.id, template.id),
        ),
      )
      .returning();
    if (!row) throw new Error(`Unknown intake template ${template.id}`);
    return mapIntakeTemplateRow(row);
  }

  async listIntakeSessions(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<IntakeSessionRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.intakeSessions)
      .where(
        options.matterId
          ? and(
              eq(schema.intakeSessions.firmId, firmId),
              eq(schema.intakeSessions.matterId, options.matterId),
            )
          : eq(schema.intakeSessions.firmId, firmId),
      );
    return rows.map(mapIntakeSessionRow);
  }

  async getIntakeSession(
    firmId: string,
    sessionId: string,
  ): Promise<IntakeSessionRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.intakeSessions)
      .where(
        and(eq(schema.intakeSessions.firmId, firmId), eq(schema.intakeSessions.id, sessionId)),
      );
    return row ? mapIntakeSessionRow(row) : undefined;
  }

  async createIntakeSession(session: IntakeSessionRecord): Promise<IntakeSessionRecord> {
    await this.db.insert(schema.intakeSessions).values({
      ...session,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
    });
    return session;
  }

  async listIntakeFormLinks(
    firmId: string,
    options: { matterId?: string; intakeSessionId?: string } = {},
  ): Promise<IntakeFormLinkRecord[]> {
    const conditions = [eq(schema.intakeFormLinks.firmId, firmId)];
    if (options.matterId) conditions.push(eq(schema.intakeFormLinks.matterId, options.matterId));
    if (options.intakeSessionId) {
      conditions.push(eq(schema.intakeFormLinks.intakeSessionId, options.intakeSessionId));
    }
    const rows = await this.db
      .select()
      .from(schema.intakeFormLinks)
      .where(and(...conditions))
      .orderBy(desc(schema.intakeFormLinks.createdAt));
    return rows.map(mapIntakeFormLinkRow);
  }

  async createIntakeFormLink(link: IntakeFormLinkRecord): Promise<IntakeFormLinkRecord> {
    const [row] = await this.db
      .insert(schema.intakeFormLinks)
      .values(intakeFormLinkInsert(link))
      .returning();
    return mapIntakeFormLinkRow(row);
  }

  async getIntakeFormLink(firmId: string, id: string): Promise<IntakeFormLinkRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.intakeFormLinks)
      .where(and(eq(schema.intakeFormLinks.firmId, firmId), eq(schema.intakeFormLinks.id, id)));
    return row ? mapIntakeFormLinkRow(row) : undefined;
  }

  async getIntakeFormLinkByTokenHash(tokenHash: string): Promise<IntakeFormLinkRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.intakeFormLinks)
      .where(eq(schema.intakeFormLinks.tokenHash, tokenHash));
    return row ? mapIntakeFormLinkRow(row) : undefined;
  }

  async revokeIntakeFormLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<IntakeFormLinkRecord | undefined> {
    const [row] = await this.db
      .update(schema.intakeFormLinks)
      .set({ revokedAt: new Date(input.revokedAt) })
      .where(
        and(
          eq(schema.intakeFormLinks.firmId, input.firmId),
          eq(schema.intakeFormLinks.id, input.id),
        ),
      )
      .returning();
    return row ? mapIntakeFormLinkRow(row) : undefined;
  }

  async markIntakeFormLinkSubmitted(input: {
    firmId: string;
    id: string;
    submittedAt: string;
    answerSnapshotId: string;
  }): Promise<IntakeFormLinkRecord | undefined> {
    const [row] = await this.db
      .update(schema.intakeFormLinks)
      .set({
        submittedAt: new Date(input.submittedAt),
        answerSnapshotId: input.answerSnapshotId,
      })
      .where(
        and(
          eq(schema.intakeFormLinks.firmId, input.firmId),
          eq(schema.intakeFormLinks.id, input.id),
          isNull(schema.intakeFormLinks.revokedAt),
          isNull(schema.intakeFormLinks.submittedAt),
        ),
      )
      .returning();
    return row ? mapIntakeFormLinkRow(row) : undefined;
  }

  async reserveIntakeFormLinkSubmission(input: {
    firmId: string;
    id: string;
    clientSubmissionId: string;
    submissionFingerprint: string;
  }): Promise<IntakeFormLinkRecord | undefined> {
    const [row] = await this.db
      .update(schema.intakeFormLinks)
      .set({
        clientSubmissionId: input.clientSubmissionId,
        submissionFingerprint: input.submissionFingerprint,
      })
      .where(
        and(
          eq(schema.intakeFormLinks.firmId, input.firmId),
          eq(schema.intakeFormLinks.id, input.id),
          isNull(schema.intakeFormLinks.revokedAt),
          isNull(schema.intakeFormLinks.submittedAt),
          isNull(schema.intakeFormLinks.clientSubmissionId),
        ),
      )
      .returning();
    if (row) return mapIntakeFormLinkRow(row);
    return this.getIntakeFormLink(input.firmId, input.id);
  }

  async saveIntakeFormLinkDraft(input: {
    firmId: string;
    id: string;
    answers: Record<string, unknown>;
    draftUpdatedAt: string;
  }): Promise<IntakeFormLinkRecord | undefined> {
    const [row] = await this.db
      .update(schema.intakeFormLinks)
      .set({
        draftAnswers: input.answers,
        draftUpdatedAt: new Date(input.draftUpdatedAt),
      })
      .where(
        and(
          eq(schema.intakeFormLinks.firmId, input.firmId),
          eq(schema.intakeFormLinks.id, input.id),
          isNull(schema.intakeFormLinks.revokedAt),
          isNull(schema.intakeFormLinks.submittedAt),
        ),
      )
      .returning();
    return row ? mapIntakeFormLinkRow(row) : this.getIntakeFormLink(input.firmId, input.id);
  }

  async listIntakeFormReviews(
    firmId: string,
    options: { matterId?: string; intakeSessionId?: string; formLinkId?: string } = {},
  ): Promise<IntakeFormReviewRecord[]> {
    const conditions = [eq(schema.intakeFormReviews.firmId, firmId)];
    if (options.matterId) conditions.push(eq(schema.intakeFormReviews.matterId, options.matterId));
    if (options.intakeSessionId) {
      conditions.push(eq(schema.intakeFormReviews.intakeSessionId, options.intakeSessionId));
    }
    if (options.formLinkId) {
      conditions.push(eq(schema.intakeFormReviews.formLinkId, options.formLinkId));
    }
    const rows = await this.db
      .select()
      .from(schema.intakeFormReviews)
      .where(and(...conditions))
      .orderBy(desc(schema.intakeFormReviews.decidedAt));
    return rows.map(mapIntakeFormReviewRow);
  }

  async createIntakeFormReview(review: IntakeFormReviewRecord): Promise<IntakeFormReviewRecord> {
    const [row] = await this.db
      .insert(schema.intakeFormReviews)
      .values(intakeFormReviewInsert(review))
      .returning();
    return mapIntakeFormReviewRow(row);
  }

  async listIntakeFormItemActions(
    firmId: string,
    options: { formLinkId?: string; intakeSessionId?: string; itemId?: string } = {},
  ): Promise<IntakeFormItemActionRecord[]> {
    const conditions = [eq(schema.intakeFormItemActions.firmId, firmId)];
    if (options.formLinkId) {
      conditions.push(eq(schema.intakeFormItemActions.formLinkId, options.formLinkId));
    }
    if (options.intakeSessionId) {
      conditions.push(eq(schema.intakeFormItemActions.intakeSessionId, options.intakeSessionId));
    }
    if (options.itemId) conditions.push(eq(schema.intakeFormItemActions.itemId, options.itemId));
    const rows = await this.db
      .select()
      .from(schema.intakeFormItemActions)
      .where(and(...conditions));
    return rows.map(mapIntakeFormItemActionRow);
  }

  async upsertIntakeFormItemAction(
    action: IntakeFormItemActionRecord,
  ): Promise<IntakeFormItemActionRecord> {
    const [row] = await this.db
      .insert(schema.intakeFormItemActions)
      .values(intakeFormItemActionInsert(action))
      .onConflictDoUpdate({
        target: schema.intakeFormItemActions.id,
        set: intakeFormItemActionInsert(action),
      })
      .returning();
    return mapIntakeFormItemActionRow(row);
  }

  async createAnswerSnapshot(snapshot: AnswerSnapshotRecord): Promise<AnswerSnapshotRecord> {
    await this.db.insert(schema.answerSnapshots).values({
      ...snapshot,
      capturedAt: new Date(snapshot.capturedAt),
    });
    return snapshot;
  }

  async listAnswerSnapshots(
    firmId: string,
    options: { intakeSessionId?: string } = {},
  ): Promise<AnswerSnapshotRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.answerSnapshots)
      .where(
        options.intakeSessionId
          ? and(
              eq(schema.answerSnapshots.firmId, firmId),
              eq(schema.answerSnapshots.intakeSessionId, options.intakeSessionId),
            )
          : eq(schema.answerSnapshots.firmId, firmId),
      );
    return rows.map(mapAnswerSnapshotRow);
  }

  async createIntakeVariableProposals(
    proposals: IntakeVariableProposal[],
  ): Promise<IntakeVariableProposal[]> {
    if (proposals.length === 0) return [];
    const rows = await this.db
      .insert(schema.intakeVariableProposals)
      .values(proposals.map(intakeVariableProposalInsert))
      .onConflictDoNothing()
      .returning();
    return rows.map(mapIntakeVariableProposalRow);
  }

  async listIntakeVariableProposals(
    firmId: string,
    options: { matterId?: string; status?: IntakeVariableProposal["status"] } = {},
  ): Promise<IntakeVariableProposal[]> {
    const conditions = [eq(schema.intakeVariableProposals.firmId, firmId)];
    if (options.matterId) {
      conditions.push(eq(schema.intakeVariableProposals.matterId, options.matterId));
    }
    if (options.status) conditions.push(eq(schema.intakeVariableProposals.status, options.status));
    const rows = await this.db
      .select()
      .from(schema.intakeVariableProposals)
      .where(and(...conditions))
      .orderBy(desc(schema.intakeVariableProposals.createdAt));
    return rows.map(mapIntakeVariableProposalRow);
  }

  async reviewIntakeVariableProposal(input: {
    firmId: string;
    id: string;
    status: "approved" | "rejected";
    reviewedByUserId: string;
    reviewedAt: string;
    rejectionReason?: string;
  }): Promise<IntakeVariableProposal | undefined> {
    const [current] = await this.db
      .select()
      .from(schema.intakeVariableProposals)
      .where(
        and(
          eq(schema.intakeVariableProposals.firmId, input.firmId),
          eq(schema.intakeVariableProposals.id, input.id),
        ),
      );
    if (!current || current.status !== "pending") return undefined;
    const reviewedAt = new Date(input.reviewedAt);
    let row: typeof schema.intakeVariableProposals.$inferSelect | undefined;
    await this.db.transaction(async (tx) => {
      if (input.status === "approved") {
        await applyVariableProposalWithTx(tx, current);
      }
      [row] = await tx
        .update(schema.intakeVariableProposals)
        .set({
          status: input.status,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt,
          rejectionReason: input.status === "rejected" ? (input.rejectionReason ?? null) : null,
          appliedAt: input.status === "approved" ? reviewedAt : null,
        })
        .where(
          and(
            eq(schema.intakeVariableProposals.firmId, input.firmId),
            eq(schema.intakeVariableProposals.id, input.id),
          ),
        )
        .returning();
    });
    return row ? mapIntakeVariableProposalRow(row) : undefined;
  }

  async createGeneratedDocument(
    document: GeneratedDocumentRecord,
  ): Promise<GeneratedDocumentRecord> {
    await this.db.insert(schema.generatedDocuments).values({
      ...document,
      intakeSessionId: document.intakeSessionId ?? null,
      createdAt: new Date(document.createdAt),
    });
    return document;
  }

  async createLedgerTransactionApproval(
    approval: LedgerTransactionApprovalRecord,
  ): Promise<LedgerTransactionApprovalRecord> {
    const [transaction] = await this.db
      .select()
      .from(schema.trustTransactions)
      .where(
        and(
          eq(schema.trustTransactions.firmId, approval.firmId),
          eq(schema.trustTransactions.id, approval.transactionId),
        ),
      );
    if (!transaction) {
      throw new Error(`Unknown ledger transaction ${approval.transactionId}`);
    }
    const [duplicateReviewer] = await this.db
      .select()
      .from(schema.trustTransactionApprovals)
      .where(
        and(
          eq(schema.trustTransactionApprovals.firmId, approval.firmId),
          eq(schema.trustTransactionApprovals.transactionId, approval.transactionId),
          eq(schema.trustTransactionApprovals.decidedByUserId, approval.decidedByUserId),
        ),
      );
    if (duplicateReviewer) {
      throw new Error("Ledger approval reviewer has already recorded a decision");
    }
    await this.db.insert(schema.trustTransactionApprovals).values({
      ...approval,
      decidedAt: new Date(approval.decidedAt),
    });
    return approval;
  }

  async listLedgerTransactionApprovals(
    firmId: string,
    options: { transactionId?: string } = {},
  ): Promise<LedgerTransactionApprovalRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.trustTransactionApprovals)
      .where(
        options.transactionId
          ? and(
              eq(schema.trustTransactionApprovals.firmId, firmId),
              eq(schema.trustTransactionApprovals.transactionId, options.transactionId),
            )
          : eq(schema.trustTransactionApprovals.firmId, firmId),
      );
    return rows.map(mapLedgerApprovalRow);
  }

  async createLedgerReconciliation(
    reconciliation: LedgerReconciliationRecord,
  ): Promise<LedgerReconciliationRecord> {
    const [account] = await this.db
      .select()
      .from(schema.ledgerAccounts)
      .where(
        and(
          eq(schema.ledgerAccounts.firmId, reconciliation.firmId),
          eq(schema.ledgerAccounts.id, reconciliation.accountId),
        ),
      );
    if (!account) {
      throw new Error(`Unknown ledger account ${reconciliation.accountId}`);
    }
    validateLedgerReconciliationRecord(reconciliation);
    await this.db.insert(schema.trustReconciliations).values({
      ...reconciliation,
      statementPeriodStart: new Date(reconciliation.statementPeriodStart),
      statementPeriodEnd: new Date(reconciliation.statementPeriodEnd),
      createdAt: new Date(reconciliation.createdAt),
    });
    return reconciliation;
  }

  async listLedgerReconciliations(firmId: string): Promise<LedgerReconciliationRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.trustReconciliations)
      .where(eq(schema.trustReconciliations.firmId, firmId))
      .orderBy(asc(schema.trustReconciliations.createdAt));
    return rows.map(mapLedgerReconciliationRow);
  }

  async createLedgerStatementImportBatch(
    batch: LedgerStatementImportBatchRecord,
  ): Promise<LedgerStatementImportBatchRecord> {
    const [account] = await this.db
      .select()
      .from(schema.ledgerAccounts)
      .where(
        and(
          eq(schema.ledgerAccounts.firmId, batch.firmId),
          eq(schema.ledgerAccounts.id, batch.accountId),
        ),
      );
    if (!account || account.type !== "trust_asset") {
      throw new Error("Statement import batches require an existing trust asset account");
    }
    validateLedgerStatementImportBatchRecord(batch);
    await this.db.insert(schema.trustStatementImportBatches).values({
      ...batch,
      matchingProfileId: batch.matchingProfileId ?? null,
      createdAt: new Date(batch.createdAt),
    });
    return batch;
  }

  async listLedgerStatementImportBatches(
    firmId: string,
    options: { accountId?: string } = {},
  ): Promise<LedgerStatementImportBatchRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.trustStatementImportBatches)
      .where(
        options.accountId
          ? and(
              eq(schema.trustStatementImportBatches.firmId, firmId),
              eq(schema.trustStatementImportBatches.accountId, options.accountId),
            )
          : eq(schema.trustStatementImportBatches.firmId, firmId),
      )
      .orderBy(asc(schema.trustStatementImportBatches.createdAt));
    return rows.map(mapLedgerStatementImportBatchRow);
  }

  async createLedgerReconciliationExceptionResolution(
    resolution: LedgerReconciliationExceptionResolutionRecord,
  ): Promise<LedgerReconciliationExceptionResolutionRecord> {
    const [account] = await this.db
      .select()
      .from(schema.ledgerAccounts)
      .where(
        and(
          eq(schema.ledgerAccounts.firmId, resolution.firmId),
          eq(schema.ledgerAccounts.id, resolution.accountId),
        ),
      );
    if (!account || account.type !== "trust_asset") {
      throw new Error(
        "Reconciliation exception resolutions require an existing trust asset account",
      );
    }
    validateLedgerReconciliationExceptionResolutionRecord(resolution);
    await this.db.insert(schema.trustReconciliationExceptionResolutions).values({
      ...resolution,
      recordedAt: new Date(resolution.recordedAt),
    });
    return resolution;
  }

  async listLedgerReconciliationExceptionResolutions(
    firmId: string,
    options: { accountId?: string } = {},
  ): Promise<LedgerReconciliationExceptionResolutionRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.trustReconciliationExceptionResolutions)
      .where(
        options.accountId
          ? and(
              eq(schema.trustReconciliationExceptionResolutions.firmId, firmId),
              eq(schema.trustReconciliationExceptionResolutions.accountId, options.accountId),
            )
          : eq(schema.trustReconciliationExceptionResolutions.firmId, firmId),
      )
      .orderBy(asc(schema.trustReconciliationExceptionResolutions.recordedAt));
    return rows.map(mapLedgerReconciliationExceptionResolutionRow);
  }

  private async listUsers(firmId: string): Promise<User[]> {
    const rows = await this.db.select().from(schema.users).where(eq(schema.users.firmId, firmId));
    return Promise.all(rows.map((row) => this.getUser(row.firmId, row.id))).then((users) =>
      users.filter((user): user is User => Boolean(user)),
    );
  }

  private async listContacts(firmId: string): Promise<Contact[]> {
    const rows = await this.db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.firmId, firmId));
    return rows.map(mapContactRow);
  }

  private async listMatterParties(firmId: string): Promise<MatterParty[]> {
    return this.db
      .select()
      .from(schema.matterParties)
      .where(eq(schema.matterParties.firmId, firmId));
  }

  private async listDocuments(firmId: string): Promise<DocumentRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.firmId, firmId));
    return rows.map(mapDocumentRow);
  }

  async listTimeEntries(
    firmId: string,
    options: { matterId?: string; status?: TimeEntry["billingStatus"] } = {},
  ): Promise<TimeEntry[]> {
    const filters = [eq(schema.timeEntries.firmId, firmId)];
    if (options.matterId) filters.push(eq(schema.timeEntries.matterId, options.matterId));
    if (options.status) filters.push(eq(schema.timeEntries.billingStatus, options.status));
    const rows = await this.db
      .select()
      .from(schema.timeEntries)
      .where(and(...filters));
    return rows.map(mapTimeEntryRow);
  }

  async listBillingPeriodLocks(firmId: string): Promise<BillingPeriodLockRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.billingPeriodLocks)
      .where(eq(schema.billingPeriodLocks.firmId, firmId))
      .orderBy(asc(schema.billingPeriodLocks.periodStart));
    return rows.map(mapBillingPeriodLockRow);
  }

  async createBillingPeriodLock(lock: BillingPeriodLockRecord): Promise<BillingPeriodLockRecord> {
    validateBillingPeriodLock(lock);
    const overlaps = (await this.listBillingPeriodLocks(lock.firmId)).some((candidate) =>
      billingPeriodLocksOverlap(candidate, lock),
    );
    if (overlaps) throw new Error("Billing period lock overlaps an existing lock");
    await this.db.insert(schema.billingPeriodLocks).values(billingPeriodLockInsert(lock));
    return clone(lock);
  }

  async listBillingRateRules(
    firmId: string,
    options: { activeOnly?: boolean; matterId?: string; userId?: string } = {},
  ): Promise<BillingRateRuleRecord[]> {
    const filters = [eq(schema.billingRateRules.firmId, firmId)];
    if (options.activeOnly) filters.push(eq(schema.billingRateRules.active, true));
    const rows = await this.db
      .select()
      .from(schema.billingRateRules)
      .where(and(...filters))
      .orderBy(desc(schema.billingRateRules.effectiveFrom));
    return rows
      .map(mapBillingRateRuleRow)
      .filter(
        (rule) =>
          (!options.matterId || !rule.matterId || rule.matterId === options.matterId) &&
          (!options.userId || !rule.userId || rule.userId === options.userId),
      );
  }

  async createBillingRateRule(rule: BillingRateRuleRecord): Promise<BillingRateRuleRecord> {
    validateBillingRateRule(rule);
    const overlaps = (await this.listBillingRateRules(rule.firmId, { activeOnly: true })).some(
      (candidate) => billingRateRulesOverlapAtSameActiveScope(candidate, rule),
    );
    if (overlaps) throw new Error("Billing rate rule overlaps an active rule at the same scope");
    await this.db.insert(schema.billingRateRules).values(billingRateRuleInsert(rule));
    return clone(rule);
  }

  async getTimeEntry(firmId: string, entryId: string): Promise<TimeEntry | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.timeEntries)
      .where(and(eq(schema.timeEntries.firmId, firmId), eq(schema.timeEntries.id, entryId)));
    return row ? mapTimeEntryRow(row) : undefined;
  }

  async createTimeEntry(entry: TimeEntry): Promise<TimeEntry> {
    await this.db.insert(schema.timeEntries).values({
      ...entry,
      performedAt: new Date(entry.performedAt),
    });
    return clone(entry);
  }

  async updateTimeEntry(
    firmId: string,
    entryId: string,
    updates: Partial<TimeEntry>,
  ): Promise<TimeEntry> {
    const [row] = await this.db
      .update(schema.timeEntries)
      .set({
        ...updates,
        performedAt: updates.performedAt ? new Date(updates.performedAt) : undefined,
        rateRuleId: "rateRuleId" in updates ? (updates.rateRuleId ?? null) : undefined,
        rateSnapshot: "rateSnapshot" in updates ? (updates.rateSnapshot ?? null) : undefined,
      })
      .where(and(eq(schema.timeEntries.firmId, firmId), eq(schema.timeEntries.id, entryId)))
      .returning();
    if (!row) throw new Error("Time entry was not found");
    return mapTimeEntryRow(row);
  }

  async listExpenseEntries(
    firmId: string,
    options: { matterId?: string; status?: ExpenseEntry["billingStatus"] } = {},
  ): Promise<ExpenseEntry[]> {
    const filters = [eq(schema.expenseEntries.firmId, firmId)];
    if (options.matterId) filters.push(eq(schema.expenseEntries.matterId, options.matterId));
    if (options.status) filters.push(eq(schema.expenseEntries.billingStatus, options.status));
    const rows = await this.db
      .select()
      .from(schema.expenseEntries)
      .where(and(...filters));
    return rows.map(mapExpenseEntryRow);
  }

  async getExpenseEntry(firmId: string, entryId: string): Promise<ExpenseEntry | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.expenseEntries)
      .where(and(eq(schema.expenseEntries.firmId, firmId), eq(schema.expenseEntries.id, entryId)));
    return row ? mapExpenseEntryRow(row) : undefined;
  }

  async createExpenseEntry(entry: ExpenseEntry): Promise<ExpenseEntry> {
    await this.db.insert(schema.expenseEntries).values({
      ...entry,
      incurredAt: new Date(entry.incurredAt),
    });
    return clone(entry);
  }

  async updateExpenseEntry(
    firmId: string,
    entryId: string,
    updates: Partial<ExpenseEntry>,
  ): Promise<ExpenseEntry> {
    const [row] = await this.db
      .update(schema.expenseEntries)
      .set({
        ...updates,
        incurredAt: updates.incurredAt ? new Date(updates.incurredAt) : undefined,
      })
      .where(and(eq(schema.expenseEntries.firmId, firmId), eq(schema.expenseEntries.id, entryId)))
      .returning();
    if (!row) throw new Error("Expense entry was not found");
    return mapExpenseEntryRow(row);
  }

  async listInvoices(
    firmId: string,
    options: { matterId?: string; status?: InvoiceRecord["status"] } = {},
  ): Promise<InvoiceWithLines[]> {
    const filters = [eq(schema.invoices.firmId, firmId)];
    if (options.matterId) filters.push(eq(schema.invoices.matterId, options.matterId));
    if (options.status) filters.push(eq(schema.invoices.status, options.status));
    const rows = await this.db
      .select()
      .from(schema.invoices)
      .where(and(...filters));
    const lines = await this.db
      .select()
      .from(schema.invoiceLines)
      .where(eq(schema.invoiceLines.firmId, firmId));
    return rows.map((row) => ({
      ...mapInvoiceRow(row),
      lines: lines.filter((line) => line.invoiceId === row.id).map(mapInvoiceLineRow),
    }));
  }

  async getInvoice(firmId: string, invoiceId: string): Promise<InvoiceWithLines | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.firmId, firmId), eq(schema.invoices.id, invoiceId)));
    if (!row) return undefined;
    const lines = await this.db
      .select()
      .from(schema.invoiceLines)
      .where(eq(schema.invoiceLines.invoiceId, invoiceId));
    return { ...mapInvoiceRow(row), lines: lines.map(mapInvoiceLineRow) };
  }

  async createInvoice(input: {
    invoice: InvoiceRecord;
    lines: InvoiceLineRecord[];
  }): Promise<InvoiceWithLines> {
    await this.db.insert(schema.invoices).values(invoiceInsert(input.invoice));
    if (input.lines.length > 0) {
      await this.db.insert(schema.invoiceLines).values(input.lines.map(invoiceLineInsert));
    }
    return { ...clone(input.invoice), lines: clone(input.lines) };
  }

  async updateInvoice(invoice: InvoiceRecord): Promise<InvoiceWithLines> {
    const [row] = await this.db
      .update(schema.invoices)
      .set(invoiceInsert(invoice))
      .where(and(eq(schema.invoices.firmId, invoice.firmId), eq(schema.invoices.id, invoice.id)))
      .returning();
    if (!row) throw new Error("Invoice was not found");
    return (await this.getInvoice(invoice.firmId, invoice.id))!;
  }

  async createPayment(input: {
    payment: ManualPaymentRecord;
    allocations: PaymentAllocationRecord[];
  }): Promise<PaymentWithAllocations> {
    const allocatedCents = input.allocations.reduce(
      (sum, allocation) => sum + allocation.amountCents,
      0,
    );
    if (allocatedCents > input.payment.amountCents) {
      throw new Error("Payment allocations exceed payment amount");
    }
    for (const allocation of input.allocations) {
      const invoice = await this.getInvoice(input.payment.firmId, allocation.invoiceId);
      if (!invoice) throw new Error("Payment allocation invoice was not found");
      if (allocation.amountCents > invoice.balanceDueCents) {
        throw new Error("Payment allocation exceeds invoice balance");
      }
    }
    await this.db.insert(schema.manualPayments).values(paymentInsert(input.payment));
    if (input.allocations.length > 0) {
      await this.db
        .insert(schema.paymentAllocations)
        .values(input.allocations.map(paymentAllocationInsert));
    }
    for (const allocation of input.allocations) {
      const invoice = await this.getInvoice(input.payment.firmId, allocation.invoiceId);
      if (!invoice) continue;
      const existingAllocations = await this.listPaymentAllocationsForInvoice(
        input.payment.firmId,
        allocation.invoiceId,
      );
      const totals = calculateInvoiceTotals({
        lines: invoice.lines,
        allocations: existingAllocations,
      });
      await this.updateInvoice({
        ...invoice,
        ...totals,
        status: invoiceStatusForPayment({
          currentStatus: invoice.status,
          totalCents: totals.totalCents,
          paidCents: totals.paidCents,
        }),
      });
    }
    return { ...clone(input.payment), allocations: clone(input.allocations) };
  }

  async listPayments(
    firmId: string,
    options: { matterId?: string; invoiceId?: string } = {},
  ): Promise<PaymentWithAllocations[]> {
    const filters = [eq(schema.manualPayments.firmId, firmId)];
    if (options.matterId) filters.push(eq(schema.manualPayments.matterId, options.matterId));
    if (options.invoiceId) filters.push(eq(schema.manualPayments.invoiceId, options.invoiceId));
    const payments = await this.db
      .select()
      .from(schema.manualPayments)
      .where(and(...filters));
    const allocations = await this.db
      .select()
      .from(schema.paymentAllocations)
      .where(eq(schema.paymentAllocations.firmId, firmId));
    return payments.map((payment) => ({
      ...mapPaymentRow(payment),
      allocations: allocations
        .filter((allocation) => allocation.paymentId === payment.id)
        .map(mapPaymentAllocationRow),
    }));
  }

  async createTrustTransferRequest(
    request: TrustTransferRequestRecord,
  ): Promise<TrustTransferRequestRecord> {
    await this.db
      .insert(schema.billingTrustTransferRequests)
      .values(trustTransferRequestInsert(request));
    return clone(request);
  }

  async getTrustTransferRequest(
    firmId: string,
    requestId: string,
  ): Promise<TrustTransferRequestRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.billingTrustTransferRequests)
      .where(
        and(
          eq(schema.billingTrustTransferRequests.firmId, firmId),
          eq(schema.billingTrustTransferRequests.id, requestId),
        ),
      );
    return row ? mapTrustTransferRequestRow(row) : undefined;
  }

  async listTrustTransferRequests(
    firmId: string,
    options: { matterId?: string; status?: TrustTransferRequestRecord["status"] } = {},
  ): Promise<TrustTransferRequestRecord[]> {
    const filters = [eq(schema.billingTrustTransferRequests.firmId, firmId)];
    if (options.matterId) {
      filters.push(eq(schema.billingTrustTransferRequests.matterId, options.matterId));
    }
    if (options.status) {
      filters.push(eq(schema.billingTrustTransferRequests.status, options.status));
    }
    const rows = await this.db
      .select()
      .from(schema.billingTrustTransferRequests)
      .where(and(...filters));
    return rows.map(mapTrustTransferRequestRow);
  }

  async updateTrustTransferRequest(
    firmId: string,
    requestId: string,
    updates: TrustTransferRequestUpdate,
    options: TrustTransferRequestUpdateOptions = {},
  ): Promise<TrustTransferRequestRecord> {
    const setValues: Partial<typeof schema.billingTrustTransferRequests.$inferInsert> = {};
    if ("status" in updates) setValues.status = updates.status;
    if ("reviewedByUserId" in updates) setValues.reviewedByUserId = updates.reviewedByUserId;
    if ("reviewedAt" in updates) {
      setValues.reviewedAt = updates.reviewedAt ? new Date(updates.reviewedAt) : null;
    }
    if ("ledgerTransactionId" in updates) {
      setValues.ledgerTransactionId = updates.ledgerTransactionId;
    }
    if ("evidence" in updates) setValues.evidence = updates.evidence;

    if (Object.keys(setValues).length === 0) {
      const existing = await this.getTrustTransferRequest(firmId, requestId);
      if (!existing) throw new Error("Trust transfer request was not found");
      return existing;
    }

    const filters = [
      eq(schema.billingTrustTransferRequests.firmId, firmId),
      eq(schema.billingTrustTransferRequests.id, requestId),
    ];
    if (options.expectedStatus) {
      filters.push(eq(schema.billingTrustTransferRequests.status, options.expectedStatus));
    }
    if (options.requireLedgerTransactionUnlinked) {
      filters.push(isNull(schema.billingTrustTransferRequests.ledgerTransactionId));
    }

    const [row] = await this.db
      .update(schema.billingTrustTransferRequests)
      .set(setValues)
      .where(and(...filters))
      .returning();
    if (!row) throw new Error("Trust transfer request update conflict");
    return mapTrustTransferRequestRow(row);
  }

  private async listPaymentAllocationsForInvoice(
    firmId: string,
    invoiceId: string,
  ): Promise<PaymentAllocationRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.paymentAllocations)
      .where(
        and(
          eq(schema.paymentAllocations.firmId, firmId),
          eq(schema.paymentAllocations.invoiceId, invoiceId),
        ),
      );
    return rows.map(mapPaymentAllocationRow);
  }

  async createDocumentTextExtraction(
    extraction: DocumentTextExtractionRecord,
  ): Promise<DocumentTextExtractionRecord> {
    await this.db.insert(schema.documentTextExtractions).values({
      ...extraction,
      createdAt: new Date(extraction.createdAt),
      completedAt: extraction.completedAt ? new Date(extraction.completedAt) : null,
    });
    return extraction;
  }

  async getDocumentTextExtractions(
    firmId: string,
    documentId: string,
  ): Promise<DocumentTextExtractionRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.documentTextExtractions)
      .where(
        and(
          eq(schema.documentTextExtractions.firmId, firmId),
          eq(schema.documentTextExtractions.documentId, documentId),
        ),
      );
    return rows.map(mapDocumentTextExtractionRow);
  }

  async listDrafts(
    firmId: string,
    options: { matterId?: string; userId?: string } = {},
  ): Promise<DraftRecord[]> {
    const conditions = [eq(schema.drafts.firmId, firmId)];
    if (options.matterId) conditions.push(eq(schema.drafts.matterId, options.matterId));
    if (options.userId) conditions.push(eq(schema.drafts.createdByUserId, options.userId));

    const rows = await this.db
      .select()
      .from(schema.drafts)
      .where(and(...conditions))
      .orderBy(asc(schema.drafts.createdAt));
    return rows.map(mapDraftRow);
  }

  async getDraft(firmId: string, draftId: string): Promise<DraftRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.drafts)
      .where(and(eq(schema.drafts.firmId, firmId), eq(schema.drafts.id, draftId)));
    return row ? mapDraftRow(row) : undefined;
  }

  async createDraft(draft: DraftRecord): Promise<DraftRecord> {
    await this.db.insert(schema.drafts).values({
      ...draft,
      createdAt: new Date(draft.createdAt),
      updatedAt: new Date(draft.updatedAt),
    });
    return draft;
  }

  async updateDraft(
    firmId: string,
    draftId: string,
    updates: Partial<
      Pick<DraftRecord, "title" | "editorJson" | "renderedHtml" | "updatedByUserId">
    >,
  ): Promise<DraftRecord> {
    const [row] = await this.db
      .update(schema.drafts)
      .set({
        ...updates,
        version: sql`${schema.drafts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.drafts.firmId, firmId), eq(schema.drafts.id, draftId)))
      .returning();
    if (!row) throw new Error(`Draft ${draftId} not found`);
    return mapDraftRow(row);
  }

  async deleteDraft(firmId: string, draftId: string): Promise<void> {
    await this.db
      .delete(schema.drafts)
      .where(and(eq(schema.drafts.firmId, firmId), eq(schema.drafts.id, draftId)));
  }

  async listDraftAssistRecords(
    firmId: string,
    options: { matterId?: string; draftId?: string; documentId?: string } = {},
  ): Promise<DraftAssistRecord[]> {
    const conditions = [eq(schema.draftAssistRecords.firmId, firmId)];
    if (options.matterId) conditions.push(eq(schema.draftAssistRecords.matterId, options.matterId));
    if (options.draftId) conditions.push(eq(schema.draftAssistRecords.draftId, options.draftId));
    if (options.documentId)
      conditions.push(eq(schema.draftAssistRecords.documentId, options.documentId));

    const rows = await this.db
      .select()
      .from(schema.draftAssistRecords)
      .where(and(...conditions))
      .orderBy(desc(schema.draftAssistRecords.createdAt));
    return rows.map(mapDraftAssistRow);
  }

  async getDraftAssistRecord(firmId: string, id: string): Promise<DraftAssistRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.draftAssistRecords)
      .where(
        and(eq(schema.draftAssistRecords.firmId, firmId), eq(schema.draftAssistRecords.id, id)),
      );
    return row ? mapDraftAssistRow(row) : undefined;
  }

  async createDraftAssistRecord(record: DraftAssistRecord): Promise<DraftAssistRecord> {
    await this.db.insert(schema.draftAssistRecords).values({
      ...record,
      reviewedAt: record.reviewedAt ? new Date(record.reviewedAt) : null,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
    return clone(record);
  }

  async updateDraftAssistRecord(record: DraftAssistRecord): Promise<DraftAssistRecord> {
    const [row] = await this.db
      .update(schema.draftAssistRecords)
      .set({
        status: record.status,
        reviewDecision: record.reviewDecision,
        reviewedByUserId: record.reviewedByUserId,
        reviewedAt: record.reviewedAt ? new Date(record.reviewedAt) : null,
        updatedAt: new Date(record.updatedAt),
        metadata: record.metadata,
      })
      .where(
        and(
          eq(schema.draftAssistRecords.firmId, record.firmId),
          eq(schema.draftAssistRecords.id, record.id),
        ),
      )
      .returning();
    if (!row) throw new Error(`Draft assist record ${record.id} was not found`);
    return mapDraftAssistRow(row);
  }

  async listDraftTemplates(
    firmId: string,
    options: { category?: string; activeOnly?: boolean } = {},
  ): Promise<DraftTemplateRecord[]> {
    const conditions = [eq(schema.draftTemplates.firmId, firmId)];
    if (options.category) conditions.push(eq(schema.draftTemplates.category, options.category));
    if (options.activeOnly) conditions.push(eq(schema.draftTemplates.active, true));

    const rows = await this.db
      .select()
      .from(schema.draftTemplates)
      .where(and(...conditions))
      .orderBy(asc(schema.draftTemplates.name));
    return rows.map(mapDraftTemplateRow);
  }

  async createDraftTemplate(template: DraftTemplateRecord): Promise<DraftTemplateRecord> {
    await this.db.insert(schema.draftTemplates).values({
      ...template,
      createdAt: new Date(template.createdAt),
      updatedAt: new Date(template.updatedAt),
    });
    return template;
  }

  async getInboundEmailAddressByAddress(
    firmId: string,
    address: string,
  ): Promise<InboundEmailAddressRecord | undefined> {
    const normalized = address.trim().toLowerCase();
    const rows = await this.db
      .select()
      .from(schema.inboundEmailAddresses)
      .where(eq(schema.inboundEmailAddresses.firmId, firmId));
    return rows
      .map(mapInboundEmailAddressRow)
      .find((candidate) => candidate.address.trim().toLowerCase() === normalized);
  }

  async listInboundEmailAddresses(firmId: string): Promise<InboundEmailAddressRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.inboundEmailAddresses)
      .where(eq(schema.inboundEmailAddresses.firmId, firmId))
      .orderBy(asc(schema.inboundEmailAddresses.address));
    return rows.map(mapInboundEmailAddressRow);
  }

  async createInboundEmailAddress(
    address: InboundEmailAddressRecord,
  ): Promise<InboundEmailAddressRecord> {
    await this.db.insert(schema.inboundEmailAddresses).values({
      ...address,
      createdAt: new Date(address.createdAt),
    });
    return address;
  }

  async listInboundEmailMessages(
    firmId: string,
    options: { matterId?: string; status?: InboundEmailMessageRecord["status"] } = {},
  ): Promise<InboundEmailMessageRecord[]> {
    const conditions = [eq(schema.inboundEmailMessages.firmId, firmId)];
    if (options.matterId)
      conditions.push(eq(schema.inboundEmailMessages.matterId, options.matterId));
    if (options.status) conditions.push(eq(schema.inboundEmailMessages.status, options.status));
    const rows = await this.db
      .select()
      .from(schema.inboundEmailMessages)
      .where(and(...conditions))
      .orderBy(desc(schema.inboundEmailMessages.receivedAt));
    return rows.map(mapInboundEmailMessageRow);
  }

  async getInboundEmailMessage(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailMessageRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.inboundEmailMessages)
      .where(
        and(
          eq(schema.inboundEmailMessages.firmId, firmId),
          eq(schema.inboundEmailMessages.id, messageId),
        ),
      );
    return row ? mapInboundEmailMessageRow(row) : undefined;
  }

  async createInboundEmailMessage(
    message: InboundEmailMessageRecord,
  ): Promise<InboundEmailMessageRecord> {
    await this.db.insert(schema.inboundEmailMessages).values({
      ...message,
      receivedAt: new Date(message.receivedAt),
    });
    return message;
  }

  async updateInboundEmailMessage(
    firmId: string,
    messageId: string,
    updates: Partial<
      Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">
    >,
  ): Promise<InboundEmailMessageRecord> {
    const [row] = await this.db
      .update(schema.inboundEmailMessages)
      .set(updates)
      .where(
        and(
          eq(schema.inboundEmailMessages.firmId, firmId),
          eq(schema.inboundEmailMessages.id, messageId),
        ),
      )
      .returning();
    if (!row) throw new Error("Inbound email message was not found");
    return mapInboundEmailMessageRow(row);
  }

  async createInboundEmailAttachment(
    attachment: InboundEmailAttachmentRecord,
  ): Promise<InboundEmailAttachmentRecord> {
    await this.db.insert(schema.inboundEmailAttachments).values(attachment);
    return attachment;
  }

  async listInboundEmailAttachments(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailAttachmentRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.inboundEmailAttachments)
      .where(
        and(
          eq(schema.inboundEmailAttachments.firmId, firmId),
          eq(schema.inboundEmailAttachments.inboundMessageId, messageId),
        ),
      );
    return rows.map(mapInboundEmailAttachmentRow);
  }

  async promoteInboundEmailAttachmentToDocument(
    input: InboundAttachmentPromotionInput,
  ): Promise<InboundAttachmentPromotionResult> {
    return this.db.transaction(async (tx) => {
      const [attachmentRow] = await tx
        .select()
        .from(schema.inboundEmailAttachments)
        .where(
          and(
            eq(schema.inboundEmailAttachments.firmId, input.firmId),
            eq(schema.inboundEmailAttachments.inboundMessageId, input.messageId),
            eq(schema.inboundEmailAttachments.id, input.attachmentId),
          ),
        )
        .for("update");
      if (!attachmentRow) throw new Error("Inbound email attachment was not found");
      const attachment = mapInboundEmailAttachmentRow(attachmentRow);
      if (!attachment.checksumSha256) {
        throw new Error("Inbound email attachment checksum is required for document promotion");
      }
      if (attachment.documentId) {
        const [documentRow] = await tx
          .select()
          .from(schema.documents)
          .where(
            and(
              eq(schema.documents.firmId, input.firmId),
              eq(schema.documents.id, attachment.documentId),
            ),
          );
        if (!documentRow) throw new Error("Promoted document was not found");
        return {
          attachment,
          document: mapDocumentRow(documentRow),
          created: false,
        };
      }

      const [duplicateRow] = await tx
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.firmId, input.firmId),
            eq(schema.documents.checksumSha256, attachment.checksumSha256),
            eq(schema.documents.checksumStatus, "verified"),
          ),
        )
        .limit(1);
      const now = new Date(input.now ?? new Date().toISOString());
      const document = {
        id: crypto.randomUUID(),
        firmId: input.firmId,
        matterId: input.matterId,
        title: input.title,
        storageKey: attachment.storageKey,
        checksumSha256: attachment.checksumSha256,
        version: 1,
        classification: input.classification,
        legalHold: input.legalHold,
        uploadStatus: "verified" as const,
        checksumStatus: duplicateRow ? ("duplicate" as const) : ("verified" as const),
        scanStatus: "queued" as const,
        reviewStatus: "not_required" as const,
        reviewDecision: undefined,
        reviewReason: duplicateRow ? ("duplicate" as const) : ("other" as const),
        reviewMetadata: duplicateRow
          ? { automatedOutcome: "duplicate_detected", duplicateOfDocumentId: duplicateRow.id }
          : { source: "inbound_email_promotion" },
        duplicateOfDocumentId: duplicateRow?.id,
        uploadedAt: now,
        verifiedAt: now,
      };
      const [documentRow] = await tx.insert(schema.documents).values(document).returning();
      if (!documentRow) throw new Error("Promoted document was not created");
      const [updatedAttachmentRow] = await tx
        .update(schema.inboundEmailAttachments)
        .set({ documentId: document.id })
        .where(
          and(
            eq(schema.inboundEmailAttachments.firmId, input.firmId),
            eq(schema.inboundEmailAttachments.inboundMessageId, input.messageId),
            eq(schema.inboundEmailAttachments.id, input.attachmentId),
            isNull(schema.inboundEmailAttachments.documentId),
          ),
        )
        .returning();
      if (!updatedAttachmentRow) throw new Error("Inbound email attachment was not linked");
      return {
        attachment: mapInboundEmailAttachmentRow(updatedAttachmentRow),
        document: mapDocumentRow(documentRow),
        created: true,
      };
    });
  }
}

export { DrizzleOpenPracticeRepository as PostgresOpenPracticeRepository };
