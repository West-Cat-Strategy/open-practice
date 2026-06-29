import type { DocumentDispositionReviewScheduleProfile, FirmSettings } from "@open-practice/domain";

export interface FirmSettingsRepository {
  getFirmSettings(firmId: string): Promise<FirmSettings | undefined>;
  updateDispositionReviewScheduleProfile(input: {
    firmId: string;
    profile?: DocumentDispositionReviewScheduleProfile;
  }): Promise<FirmSettings>;
}
