import type { PublicConsultationIntakeRecord } from "@open-practice/domain";
import * as schema from "../../schema.js";
import { dateToIso } from "../contracts.js";

export function mapPublicConsultationIntakeRow(
  row: typeof schema.publicConsultationIntakes.$inferSelect,
): PublicConsultationIntakeRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    status: row.status,
    clientName: row.clientName,
    telephone: row.telephone,
    email: row.email ?? undefined,
    opposingPartyNames: row.opposingPartyNames,
    matterDescription: row.matterDescription,
    sourceUrl: row.sourceUrl ?? undefined,
    disclosureAcceptedAt: row.disclosureAcceptedAt.toISOString(),
    submittedAt: row.submittedAt.toISOString(),
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    reviewedAt: dateToIso(row.reviewedAt),
    dismissedReason: row.dismissedReason ?? undefined,
    convertedMatterId: row.convertedMatterId ?? undefined,
    notificationEmailId: row.notificationEmailId ?? undefined,
    metadata: row.metadata,
  };
}

export function publicConsultationIntakeInsert(
  record: PublicConsultationIntakeRecord,
): typeof schema.publicConsultationIntakes.$inferInsert {
  return {
    ...record,
    email: record.email ?? null,
    sourceUrl: record.sourceUrl ?? null,
    disclosureAcceptedAt: new Date(record.disclosureAcceptedAt),
    submittedAt: new Date(record.submittedAt),
    reviewedByUserId: record.reviewedByUserId ?? null,
    reviewedAt: record.reviewedAt ? new Date(record.reviewedAt) : null,
    dismissedReason: record.dismissedReason ?? null,
    convertedMatterId: record.convertedMatterId ?? null,
    notificationEmailId: record.notificationEmailId ?? null,
  };
}
