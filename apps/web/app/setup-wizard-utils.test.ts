import { describe, expect, it } from "vitest";
import { PRACTICE_PRESET_CATALOG } from "@open-practice/domain/practice-presets";
import {
  buildSetupCompletePayload,
  selectStartupView,
  selectedPracticeAreas,
  updateSetupWizardState,
  validateSetupWizardState,
  type SetupWebAuthnCredential,
  type SetupWizardState,
} from "./setup-wizard-utils";

function state(overrides: Partial<SetupWizardState> = {}): SetupWizardState {
  return {
    firmName: "North Shore Law",
    ownerName: "Avery Owner",
    ownerEmail: "avery@example.test",
    ownerPassword: "correct horse battery staple",
    ownerPasswordConfirmation: "correct horse battery staple",
    selectedPresetIds: PRACTICE_PRESET_CATALOG.map((preset) => preset.id),
    firstMatterEnabled: true,
    firstMatterTitle: "Initial consultation",
    firstMatterPracticeArea: "General practice",
    firstMatterJurisdiction: "BC",
    firstMatterClientKind: "person",
    firstMatterClientName: "First Client",
    firstMatterClientEmail: "client@example.test",
    firstMatterClientPhone: "",
    trustFundsCaveatAccepted: true,
    ...overrides,
  };
}

const stagedCredential: SetupWebAuthnCredential = {
  id: "credential-id",
  rawId: "credential-id",
  response: {
    clientDataJSON: "client-data",
    attestationObject: "attestation",
    transports: ["internal"],
  },
  type: "public-key",
  clientExtensionResults: {},
  challengeHash: "registration-challenge",
};

describe("setup wizard startup and validation", () => {
  it("chooses setup, blocked, login, or dashboard from setup and auth status", () => {
    expect(selectStartupView({ required: true, blocked: false }, null)).toBe("setup");
    expect(
      selectStartupView(
        {
          required: false,
          blocked: true,
          reason: "partial",
        },
        null,
      ),
    ).toBe("blocked");
    expect(selectStartupView({ required: false, blocked: false }, 401)).toBe("login");
    expect(selectStartupView({ required: false, blocked: false }, 200)).toBe("dashboard");
  });

  it("requires only minimal workspace bootstrap fields", () => {
    const validation = validateSetupWizardState(
      state({
        firmName: "",
        ownerName: "",
        ownerEmail: "",
        ownerPassword: "",
        ownerPasswordConfirmation: "",
        firstMatterTitle: "",
        firstMatterPracticeArea: "",
        firstMatterClientName: "",
        trustFundsCaveatAccepted: false,
      }),
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "Workspace name is required.",
        "Owner name is required.",
        "Owner email is required.",
        "Backup password must be at least 8 characters.",
        "First matter title is required.",
        "First matter practice area is required.",
        "First matter client name is required.",
        "Trust/funds acknowledgement is required.",
      ]),
    );
    expect(validation.errors).not.toEqual(
      expect.arrayContaining([
        "Business address line 1 is required.",
        "At least one practice area is required.",
        "Practitioner regulator is required.",
      ]),
    );
  });

  it("keeps passkey registration recommended but optional", () => {
    const validation = validateSetupWizardState(state());

    expect(validation.valid).toBe(true);
    expect(validation.errors).not.toContain("Passkey is required.");
  });

  it("validates first matter fields only when the starter matter is enabled", () => {
    expect(
      validateSetupWizardState(
        state({
          firstMatterTitle: "",
          firstMatterClientName: "",
          firstMatterClientEmail: "not-email",
        }),
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        "First matter title is required.",
        "First matter client name is required.",
        "First matter client email must be a valid email address.",
      ]),
    );
    expect(
      validateSetupWizardState(
        state({
          firstMatterEnabled: false,
          firstMatterTitle: "",
          firstMatterClientName: "",
          firstMatterClientEmail: "not-email",
        }),
      ).valid,
    ).toBe(true);
  });

  it("builds an operational first-run payload from selected presets and first matter fields", () => {
    const payload = buildSetupCompletePayload(
      state({
        selectedPresetIds: ["general-canada", "bc-notarial"],
        firstMatterTitle: "Opening consult",
        firstMatterPracticeArea: "Notarial services",
        firstMatterJurisdiction: "BC",
        firstMatterClientKind: "organization",
        firstMatterClientName: "Example Cooperative",
        firstMatterClientEmail: "contact@example.test",
        firstMatterClientPhone: "604-555-0199",
      }),
      PRACTICE_PRESET_CATALOG,
    );

    expect(payload.selectedPresetIds).toEqual(["general-canada", "bc-notarial"]);
    expect(payload.settings.practiceAreas).toEqual(["General practice", "Notarial services"]);
    expect(payload.firstMatter).toMatchObject({
      title: "Opening consult",
      practiceArea: "Notarial services",
      jurisdiction: "BC",
      client: {
        kind: "organization",
        displayName: "Example Cooperative",
        email: "contact@example.test",
        phone: "604-555-0199",
      },
    });
  });

  it("falls back to general practice when no starter presets or first matter are selected", () => {
    expect(
      selectedPracticeAreas(
        state({ selectedPresetIds: [], firstMatterEnabled: false }),
        PRACTICE_PRESET_CATALOG,
      ),
    ).toEqual(["General practice"]);
  });

  it("matches API-shaped owner email and password validation", () => {
    const validation = validateSetupWizardState(
      state({
        ownerEmail: "owner",
        ownerPassword: "short",
        ownerPasswordConfirmation: "different",
      }),
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "Owner email must be a valid email address.",
        "Backup password must be at least 8 characters.",
        "Backup password confirmation must match.",
      ]),
    );
  });

  it("clears a staged passkey when the owner email changes", () => {
    const current = state({ webAuthnCredential: stagedCredential });

    expect(updateSetupWizardState(current, "ownerEmail", "avery@example.test")).toMatchObject({
      webAuthnCredential: stagedCredential,
    });
    expect(
      updateSetupWizardState(current, "ownerEmail", "new-owner@example.test"),
    ).not.toHaveProperty("webAuthnCredential");
  });
});
