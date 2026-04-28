import {
  sampleAuditEvents,
  sampleContacts,
  sampleDraftTemplates,
  sampleDocuments,
  sampleExpenseEntries,
  sampleFirm,
  sampleGeneratedDocuments,
  sampleIntakeSessions,
  sampleIntakeTemplates,
  sampleInvoiceLines,
  sampleInvoices,
  sampleLedgerAccounts,
  sampleLedgerEntries,
  sampleManualPayments,
  sampleMatterParties,
  sampleMatters,
  samplePaymentAllocations,
  samplePortalGrants,
  sampleSignatureProviderEvents,
  sampleSignatureRequestSigners,
  sampleSignatureRequests,
  sampleSignatureWebhookAttempts,
  sampleTimeEntries,
  sampleTrustTransferRequests,
  sampleUsers,
} from "@open-practice/domain/sample-data";
import type { OpenPracticeDatabase } from "./runtime.js";
import * as schema from "./schema.js";

function userRow(user: (typeof sampleUsers)[number]): typeof schema.users.$inferInsert {
  return {
    id: user.id,
    firmId: user.firmId,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
  };
}

export async function seedSampleData(db: OpenPracticeDatabase): Promise<void> {
  await db.insert(schema.firms).values(sampleFirm).onConflictDoNothing();
  await db.insert(schema.users).values(sampleUsers.map(userRow)).onConflictDoNothing();
  await db.insert(schema.contacts).values(sampleContacts).onConflictDoNothing();
  await db
    .insert(schema.matters)
    .values(
      sampleMatters.map((matter) => ({
        ...matter,
        openedOn: matter.openedOn ? new Date(matter.openedOn) : null,
        closedOn: matter.closedOn ? new Date(matter.closedOn) : null,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.matterAssignments)
    .values(
      sampleUsers.flatMap((user) =>
        user.assignedMatterIds.map((matterId) => ({ userId: user.id, matterId })),
      ),
    )
    .onConflictDoNothing();
  await db.insert(schema.matterParties).values(sampleMatterParties).onConflictDoNothing();
  await db
    .insert(schema.documents)
    .values(
      sampleDocuments.map((document) => ({
        ...document,
        supersededAt: document.supersededAt ? new Date(document.supersededAt) : null,
        uploadedAt: document.uploadedAt ? new Date(document.uploadedAt) : null,
        verifiedAt: document.verifiedAt ? new Date(document.verifiedAt) : null,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.portalGrants)
    .values(
      samplePortalGrants.map((grant) => ({
        ...grant,
        expiresAt: grant.expiresAt ? new Date(grant.expiresAt) : null,
        revokedAt: grant.revokedAt ? new Date(grant.revokedAt) : null,
      })),
    )
    .onConflictDoNothing();
  await db.insert(schema.ledgerAccounts).values(sampleLedgerAccounts).onConflictDoNothing();
  await db
    .insert(schema.trustTransactions)
    .values({
      id: "trust-retainer",
      firmId: sampleFirm.id,
      idempotencyKey: "retainer",
      requestFingerprint: "seed:retainer",
      postedByUserId: "user-admin",
      postedAt: new Date("2026-04-02T17:00:00.000Z"),
    })
    .onConflictDoNothing();
  await db.insert(schema.trustLedgerEntries).values(sampleLedgerEntries).onConflictDoNothing();
  await db
    .insert(schema.auditEvents)
    .values(
      sampleAuditEvents.map((event) => ({
        ...event,
        occurredAt: new Date(event.occurredAt),
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.timeEntries)
    .values(
      sampleTimeEntries.map((entry) => ({
        ...entry,
        performedAt: new Date(entry.performedAt),
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.expenseEntries)
    .values(
      sampleExpenseEntries.map((entry) => ({
        ...entry,
        incurredAt: new Date(entry.incurredAt),
      })),
    )
    .onConflictDoNothing();
  if (sampleInvoices.length > 0) {
    await db
      .insert(schema.invoices)
      .values(
        sampleInvoices.map((invoice) => ({
          ...invoice,
          approvedAt: invoice.approvedAt ? new Date(invoice.approvedAt) : null,
          issuedAt: invoice.issuedAt ? new Date(invoice.issuedAt) : null,
          dueAt: invoice.dueAt ? new Date(invoice.dueAt) : null,
          createdAt: new Date(invoice.createdAt),
          voidedAt: invoice.voidedAt ? new Date(invoice.voidedAt) : null,
        })),
      )
      .onConflictDoNothing();
  }
  if (sampleInvoiceLines.length > 0) {
    await db
      .insert(schema.invoiceLines)
      .values(
        sampleInvoiceLines.map((line) => ({
          ...line,
          createdAt: new Date(line.createdAt),
        })),
      )
      .onConflictDoNothing();
  }
  if (sampleManualPayments.length > 0) {
    await db
      .insert(schema.manualPayments)
      .values(
        sampleManualPayments.map((payment) => ({
          ...payment,
          receivedAt: new Date(payment.receivedAt),
        })),
      )
      .onConflictDoNothing();
  }
  if (samplePaymentAllocations.length > 0) {
    await db
      .insert(schema.paymentAllocations)
      .values(
        samplePaymentAllocations.map((allocation) => ({
          ...allocation,
          allocatedAt: new Date(allocation.allocatedAt),
        })),
      )
      .onConflictDoNothing();
  }
  if (sampleTrustTransferRequests.length > 0) {
    await db
      .insert(schema.billingTrustTransferRequests)
      .values(
        sampleTrustTransferRequests.map((request) => ({
          ...request,
          requestedAt: new Date(request.requestedAt),
          reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : null,
        })),
      )
      .onConflictDoNothing();
  }
  await db
    .insert(schema.signatureRequests)
    .values(
      sampleSignatureRequests.map((request) => ({
        ...request,
        createdAt: new Date(request.createdAt),
        completedAt: request.completedAt ? new Date(request.completedAt) : null,
        declinedAt: request.declinedAt ? new Date(request.declinedAt) : null,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.signatureRequestSigners)
    .values(
      sampleSignatureRequestSigners.map((signer) => ({
        ...signer,
        completedAt: signer.completedAt ? new Date(signer.completedAt) : null,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.signatureProviderEvents)
    .values(
      sampleSignatureProviderEvents.map((event) => ({
        ...event,
        occurredAt: new Date(event.occurredAt),
      })),
    )
    .onConflictDoNothing();
  if (sampleSignatureWebhookAttempts.length > 0) {
    await db
      .insert(schema.signatureWebhookAttempts)
      .values(
        sampleSignatureWebhookAttempts.map((attempt) => ({
          ...attempt,
          receivedAt: new Date(attempt.receivedAt),
          processedAt: attempt.processedAt ? new Date(attempt.processedAt) : null,
        })),
      )
      .onConflictDoNothing();
  }
  await db.insert(schema.intakeTemplates).values(sampleIntakeTemplates).onConflictDoNothing();
  await db
    .insert(schema.draftTemplates)
    .values(
      sampleDraftTemplates.map((template) => ({
        ...template,
        createdAt: new Date(template.createdAt),
        updatedAt: new Date(template.updatedAt),
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.intakeSessions)
    .values(
      sampleIntakeSessions.map((session) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      })),
    )
    .onConflictDoNothing();
  if (sampleGeneratedDocuments.length > 0) {
    await db
      .insert(schema.generatedDocuments)
      .values(
        sampleGeneratedDocuments.map((document) => ({
          ...document,
          createdAt: new Date(document.createdAt),
        })),
      )
      .onConflictDoNothing();
  }
}
