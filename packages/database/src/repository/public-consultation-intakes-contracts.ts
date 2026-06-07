import type { PublicConsultationIntakeRecord } from "@open-practice/domain";

export interface PublicConsultationIntakeListOptions {
  status?: PublicConsultationIntakeRecord["status"];
  limit?: number;
}

export interface PublicConsultationIntakeUpdateInput {
  status?: PublicConsultationIntakeRecord["status"];
  reviewedByUserId?: string;
  reviewedAt?: string;
  dismissedReason?: string;
  convertedMatterId?: string;
  notificationEmailId?: string;
  metadata?: Record<string, unknown>;
}

export interface PublicConsultationIntakeRepository {
  listPublicConsultationIntakes(
    firmId: string,
    options?: PublicConsultationIntakeListOptions,
  ): Promise<PublicConsultationIntakeRecord[]>;
  getPublicConsultationIntake(
    firmId: string,
    intakeId: string,
  ): Promise<PublicConsultationIntakeRecord | undefined>;
  createPublicConsultationIntake(
    record: PublicConsultationIntakeRecord,
  ): Promise<PublicConsultationIntakeRecord>;
  updatePublicConsultationIntake(
    firmId: string,
    intakeId: string,
    updates: PublicConsultationIntakeUpdateInput,
  ): Promise<PublicConsultationIntakeRecord | undefined>;
}
