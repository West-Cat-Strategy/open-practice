import { describe, expect, it } from "vitest";
import {
  formatCalendarAttendeeRoleLabel,
  formatMatterPartyRoleLabel,
  formatProfessionalRoleLabel,
  formatSignatureSignerRoleLabel,
} from "./participant-role-labels";

describe("participant role labels", () => {
  it("formats dashboard role labels from the shared vocabulary", () => {
    expect(formatProfessionalRoleLabel("owner_admin")).toBe("Owner/admin");
    expect(formatProfessionalRoleLabel("client_external")).toBe("External portal user");
    expect(formatMatterPartyRoleLabel("opposing_party")).toBe("Opposing party");
    expect(formatCalendarAttendeeRoleLabel("required")).toBe("Required guest");
    expect(formatSignatureSignerRoleLabel("third_party")).toBe("Third party signer");
  });
});
