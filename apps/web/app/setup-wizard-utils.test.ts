import { describe, expect, it } from "vitest";
import {
  selectStartupView,
  trimmedSetupKey,
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
    setupKey: "",
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
    expect(
      selectStartupView({ required: true, blocked: false, setupKeyRequired: false }, null),
    ).toBe("setup");
    expect(
      selectStartupView(
        {
          required: false,
          blocked: true,
          setupKeyRequired: false,
          reason: "partial",
        },
        null,
      ),
    ).toBe("blocked");
    expect(
      selectStartupView({ required: false, blocked: false, setupKeyRequired: false }, 401),
    ).toBe("login");
    expect(
      selectStartupView({ required: false, blocked: false, setupKeyRequired: false }, 200),
    ).toBe("dashboard");
  });

  it("requires only minimal workspace bootstrap fields", () => {
    const validation = validateSetupWizardState(
      state({
        firmName: "",
        ownerName: "",
        ownerEmail: "",
        ownerPassword: "",
        ownerPasswordConfirmation: "",
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

  it("requires a setup key only when the server asks for one", () => {
    expect(validateSetupWizardState(state(), true).errors).toContain("Setup key is required.");
    expect(validateSetupWizardState(state({ setupKey: "key" }), true).valid).toBe(true);
    expect(validateSetupWizardState(state({ setupKey: "   " }), true).errors).toContain(
      "Setup key is required.",
    );
    expect(trimmedSetupKey(state({ setupKey: "  setup-key  " }))).toBe("setup-key");
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
