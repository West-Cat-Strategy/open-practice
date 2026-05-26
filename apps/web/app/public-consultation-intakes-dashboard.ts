import type {
  PublicConsultationDashboardResponse,
  PublicConsultationIntake,
  PublicConsultationIntakeSettings,
} from "./types";

export function buildPublicConsultationIntakesPath(status = "pending"): string {
  return `/api/public-consultation-intakes?status=${encodeURIComponent(status)}`;
}

export function buildPublicConsultationIntakeSettingsPath(): string {
  return "/api/public-consultation-intakes/settings";
}

export function buildPublicConsultationIntakeDismissPath(intakeId: string): string {
  return `/api/public-consultation-intakes/${encodeURIComponent(intakeId)}/dismiss`;
}

export function buildPublicConsultationIntakeConvertPath(intakeId: string): string {
  return `/api/public-consultation-intakes/${encodeURIComponent(intakeId)}/convert`;
}

export const defaultPublicConsultationSettings: PublicConsultationIntakeSettings = {
  enabled: true,
  senderAddress: "info@crockettparalegal.ca",
  recipientEmails: ["bryan@crockettparalegal.ca"],
  allowedOrigins: [
    "https://crockettparalegal.ca",
    "https://www.crockettparalegal.ca",
    "http://localhost:4321",
    "http://127.0.0.1:4321",
  ],
};

export function emptyPublicConsultationDashboard(
  status: PublicConsultationDashboardResponse["status"] = "unavailable",
): PublicConsultationDashboardResponse {
  return {
    settings: defaultPublicConsultationSettings,
    intakes: [],
    status,
  };
}

export function upsertPublicConsultationIntake(
  intakes: PublicConsultationIntake[],
  intake: PublicConsultationIntake,
): PublicConsultationIntake[] {
  return intakes.some((candidate) => candidate.id === intake.id)
    ? intakes.map((candidate) => (candidate.id === intake.id ? intake : candidate))
    : [intake, ...intakes];
}

export function splitPublicConsultationList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

export function publicConsultationOpposingParties(intake: PublicConsultationIntake): string {
  return intake.opposingPartyNames.length > 0 ? intake.opposingPartyNames.join(", ") : "none";
}

export function publicConsultationSettingsSummary(
  settings: PublicConsultationIntakeSettings,
): string {
  return `${settings.enabled ? "enabled" : "disabled"} · ${settings.senderAddress} to ${settings.recipientEmails.join(", ")}`;
}
