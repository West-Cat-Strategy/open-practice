import {
  clientTrustBalanceDeltas,
  defaultBillingExpenseCategoriesForFirm,
} from "@open-practice/domain";
import {
  sampleAuditEvents,
  sampleCalendarEvents,
  sampleCalendarSchedulingRequests,
  sampleContactRelationships,
  sampleContacts,
  sampleAiOperationalProposals,
  sampleDocumentAssemblyPackages,
  sampleDocumentAssemblySetDefinitions,
  sampleDraftTemplates,
  sampleDocuments,
  sampleExpenseEntries,
  sampleFirm,
  sampleMatterlessFirm,
  sampleGeneratedDocuments,
  sampleIntakeSessions,
  sampleIntakeTemplates,
  sampleIntakeTemplateVersions,
  sampleHostedPaymentRequests,
  sampleInvoiceLines,
  sampleInvoices,
  sampleLegalClinicMatterProfiles,
  sampleLegalClinicPrograms,
  sampleLegalResearchArtifacts,
  sampleLedgerAccountingReviewProfiles,
  sampleLedgerAccounts,
  sampleLedgerEntries,
  sampleLedgerStatementMatchRuleProfiles,
  sampleManualPayments,
  sampleMatterParties,
  sampleMatters,
  samplePaymentAllocations,
  samplePortalGrants,
  sampleSignatureProviderEvents,
  sampleSignatureEnvelopes,
  sampleSignatureRequestSigners,
  sampleSignatureRequests,
  sampleSignatureWebhookAttempts,
  sampleTaskDeadlines,
  sampleTimeEntries,
  sampleTrustTransferRequests,
  sampleUsers,
} from "@open-practice/domain/sample-data";
import { eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "./runtime.js";
import * as schema from "./schema.js";
import {
  contactInsert,
  contactRelationshipInsert,
  matterPartyInsert,
  portalGrantInsert,
} from "./repository/drizzle-mappers.js";

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
  await db.insert(schema.firms).values([sampleFirm, sampleMatterlessFirm]).onConflictDoNothing();
  await db.insert(schema.users).values(sampleUsers.map(userRow)).onConflictDoNothing();
  await db.insert(schema.contacts).values(sampleContacts.map(contactInsert)).onConflictDoNothing();
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
  await db
    .insert(schema.matterParties)
    .values(sampleMatterParties.map(matterPartyInsert))
    .onConflictDoNothing();
  await db
    .insert(schema.contactRelationships)
    .values(sampleContactRelationships.map(contactRelationshipInsert))
    .onConflictDoNothing();
  await db
    .insert(schema.legalClinicPrograms)
    .values(
      sampleLegalClinicPrograms.map((program) => ({
        ...program,
        createdAt: new Date(program.createdAt),
        updatedAt: new Date(program.updatedAt),
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.legalClinicMatterProfiles)
    .values(
      sampleLegalClinicMatterProfiles.map((profile) => ({
        ...profile,
        referralDate: profile.referralDate ? new Date(profile.referralDate) : null,
        nextReviewDate: profile.nextReviewDate ? new Date(profile.nextReviewDate) : null,
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(profile.updatedAt),
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.documents)
    .values(
      sampleDocuments.map((document) => ({
        ...document,
        supersededAt: document.supersededAt ? new Date(document.supersededAt) : null,
        uploadedAt: document.uploadedAt ? new Date(document.uploadedAt) : null,
        verifiedAt: document.verifiedAt ? new Date(document.verifiedAt) : null,
        reviewedAt: document.reviewedAt ? new Date(document.reviewedAt) : null,
        createdAt: document.createdAt ? new Date(document.createdAt) : undefined,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.calendarEvents)
    .values(
      sampleCalendarEvents.map((event) => ({
        id: event.id,
        firmId: event.firmId,
        matterId: event.matterId,
        uid: event.uid,
        title: event.title,
        startsAt: new Date(event.startsAt),
        endsAt: new Date(event.endsAt),
        description: event.description,
        location: event.location,
        status: event.status,
        sequence: event.sequence,
        createdAt: new Date(event.createdAt),
        updatedAt: new Date(event.updatedAt),
        deletedAt: event.deletedAt ? new Date(event.deletedAt) : null,
        createdByUserId: event.createdByUserId,
        updatedByUserId: event.updatedByUserId,
      })),
    )
    .onConflictDoNothing();
  const sampleCalendarAttendees = sampleCalendarEvents.flatMap((event) => event.attendees ?? []);
  if (sampleCalendarAttendees.length > 0) {
    await db
      .insert(schema.calendarEventAttendees)
      .values(
        sampleCalendarAttendees.map((attendee) => ({
          ...attendee,
          invitedAt: attendee.invitedAt ? new Date(attendee.invitedAt) : null,
          createdAt: new Date(attendee.createdAt),
          updatedAt: new Date(attendee.updatedAt),
          deletedAt: attendee.deletedAt ? new Date(attendee.deletedAt) : null,
        })),
      )
      .onConflictDoNothing();
  }
  await db
    .insert(schema.tasks)
    .values(
      sampleTaskDeadlines.map((task) => ({
        ...task,
        assignedToUserId: task.assignedToUserId ?? null,
        description: task.description ?? null,
        sourceType: task.sourceType ?? null,
        sourceId: task.sourceId ?? null,
        dueAt: task.dueAt ? new Date(task.dueAt) : null,
        completedAt: task.completedAt ? new Date(task.completedAt) : null,
        completedByUserId: task.completedByUserId ?? null,
        archivedAt: task.archivedAt ? new Date(task.archivedAt) : null,
        archivedByUserId: task.archivedByUserId ?? null,
        createdAt: new Date(task.createdAt),
        createdByUserId: task.createdByUserId ?? null,
        updatedAt: new Date(task.updatedAt),
        updatedByUserId: task.updatedByUserId ?? null,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.calendarSchedulingRequests)
    .values(
      sampleCalendarSchedulingRequests.map((request) => ({
        ...request,
        taskId: request.taskId ?? null,
        calendarEventId: request.calendarEventId ?? null,
        calendarReminderId: request.calendarReminderId ?? null,
        ownerUserId: request.ownerUserId ?? null,
        sourceId: request.sourceId ?? null,
        requestedDueAt: request.requestedDueAt ? new Date(request.requestedDueAt) : null,
        requestedStartsAt: request.requestedStartsAt ? new Date(request.requestedStartsAt) : null,
        requestedEndsAt: request.requestedEndsAt ? new Date(request.requestedEndsAt) : null,
        createdAt: new Date(request.createdAt),
        updatedAt: new Date(request.updatedAt),
        reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : null,
        reviewedByUserId: request.reviewedByUserId ?? null,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.portalGrants)
    .values(samplePortalGrants.map(portalGrantInsert))
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
    .insert(schema.trustClientBalances)
    .values(
      clientTrustBalanceDeltas(sampleLedgerEntries, sampleLedgerAccounts).map((delta) => ({
        firmId: delta.firmId,
        matterId: delta.matterId,
        clientId: delta.clientId,
        balanceCents: delta.deltaCents,
        updatedAt: new Date("2026-04-02T17:00:00.000Z"),
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.trustStatementMatchRuleProfiles)
    .values(
      sampleLedgerStatementMatchRuleProfiles.map((profile) => ({
        ...profile,
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(profile.updatedAt),
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.ledgerAccountingReviewProfiles)
    .values(
      sampleLedgerAccountingReviewProfiles.map((profile) => ({
        ...profile,
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(profile.updatedAt),
      })),
    )
    .onConflictDoNothing();
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
    .insert(schema.billingExpenseCategories)
    .values(
      [sampleFirm, sampleMatterlessFirm].flatMap((firm) =>
        defaultBillingExpenseCategoriesForFirm({
          firmId: firm.id,
          now: "2026-06-17T00:00:00.000Z",
        }).map((category) => ({
          ...category,
          matterId: category.matterId ?? null,
          reviewCue: category.reviewCue ?? null,
          createdByUserId: category.createdByUserId ?? null,
          updatedByUserId: category.updatedByUserId ?? null,
          createdAt: new Date(category.createdAt),
          updatedAt: new Date(category.updatedAt),
        })),
      ),
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
          reconciledAt: payment.reconciledAt ? new Date(payment.reconciledAt) : null,
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
  if (sampleHostedPaymentRequests.length > 0) {
    await db
      .insert(schema.hostedPaymentRequests)
      .values(
        sampleHostedPaymentRequests.map((request) => ({
          ...request,
          createdAt: new Date(request.createdAt),
          updatedAt: new Date(request.updatedAt),
          expiresAt: request.expiresAt ? new Date(request.expiresAt) : null,
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
  await db
    .insert(schema.intakeTemplates)
    .values(
      sampleIntakeTemplates.map((template) => ({
        ...template,
        createdAt: new Date(template.createdAt),
        updatedAt: new Date(template.updatedAt),
      })),
    )
    .onConflictDoNothing();
  for (const template of sampleIntakeTemplates) {
    await db
      .update(schema.intakeTemplates)
      .set({
        name: template.name,
        provider: template.provider,
        externalTemplateId: template.externalTemplateId,
        active: template.active,
        definitionVersion: template.definitionVersion,
        definition: template.definition,
        description: template.description,
        category: template.category,
        updatedAt: new Date(template.updatedAt),
        metadata: template.metadata,
      })
      .where(eq(schema.intakeTemplates.id, template.id));
  }
  await db
    .insert(schema.intakeTemplateVersions)
    .values(
      sampleIntakeTemplateVersions.map((version) => ({
        ...version,
        publishedAt: new Date(version.publishedAt),
      })),
    )
    .onConflictDoNothing();
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
    .insert(schema.aiOperationalProposals)
    .values(
      sampleAiOperationalProposals.map((proposal) => ({
        ...proposal,
        reviewedAt: proposal.reviewedAt ? new Date(proposal.reviewedAt) : null,
        createdAt: new Date(proposal.createdAt),
        updatedAt: new Date(proposal.updatedAt),
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.legalResearchArtifacts)
    .values(
      sampleLegalResearchArtifacts.map((artifact) => ({
        ...artifact,
        note: artifact.note ?? null,
        documentAnalysis: artifact.documentAnalysis ?? null,
        timeline: artifact.timeline ?? null,
        checkpoint: artifact.checkpoint ?? null,
        reviewDecision: artifact.reviewDecision ?? null,
        reviewedByUserId: artifact.reviewedByUserId ?? null,
        reviewedAt: artifact.reviewedAt ? new Date(artifact.reviewedAt) : null,
        createdAt: new Date(artifact.createdAt),
        updatedAt: new Date(artifact.updatedAt),
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
          intakeSessionId: document.intakeSessionId ?? null,
          createdAt: new Date(document.createdAt),
        })),
      )
      .onConflictDoNothing();
  }
  if (sampleDocumentAssemblySetDefinitions.length > 0) {
    await db
      .insert(schema.documentAssemblySetDefinitions)
      .values(
        sampleDocumentAssemblySetDefinitions.map((definition) => ({
          ...definition,
          description: definition.description ?? null,
          practiceArea: definition.practiceArea ?? null,
          createdAt: new Date(definition.createdAt),
          updatedAt: new Date(definition.updatedAt),
        })),
      )
      .onConflictDoNothing();
  }
  if (sampleDocumentAssemblyPackages.length > 0) {
    await db
      .insert(schema.documentAssemblyPackages)
      .values(
        sampleDocumentAssemblyPackages.map((item) => ({
          ...item,
          definitionId: item.definitionId ?? null,
          sourceDraftId: item.sourceDraftId ?? null,
          intakeSessionId: item.intakeSessionId ?? null,
          packageId: item.packageId ?? null,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        })),
      )
      .onConflictDoNothing();
  }
  if (sampleSignatureEnvelopes.length > 0) {
    await db
      .insert(schema.signatureEnvelopes)
      .values(
        sampleSignatureEnvelopes.map((envelope) => ({
          ...envelope,
          assemblyPackageId: envelope.assemblyPackageId ?? null,
          signatureRequestId: envelope.signatureRequestId ?? null,
          createdAt: new Date(envelope.createdAt),
          updatedAt: new Date(envelope.updatedAt),
        })),
      )
      .onConflictDoNothing();
  }
}
