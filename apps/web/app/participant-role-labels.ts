import {
  describeCalendarAttendeeRole,
  describeMatterPartyRole,
  describeProfessionalRole,
  describeSignatureSignerRole,
  type CalendarAttendeeRole,
  type PartyRole,
  type ProfessionalRole,
} from "@open-practice/domain/participant-roles";

export function formatProfessionalRoleLabel(role: ProfessionalRole): string {
  return describeProfessionalRole(role).label;
}

export function formatMatterPartyRoleLabel(role: PartyRole): string {
  return describeMatterPartyRole(role).label;
}

export function formatCalendarAttendeeRoleLabel(role: CalendarAttendeeRole): string {
  return describeCalendarAttendeeRole(role).label;
}

export function formatSignatureSignerRoleLabel(role?: string): string {
  return describeSignatureSignerRole(role).label;
}
