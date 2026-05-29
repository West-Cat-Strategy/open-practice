import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PasswordSetupClient from "./PasswordSetupClient";
import {
  buildPasswordSetupPayload,
  canSubmitPasswordSetup,
  passwordSetupErrors,
} from "./password-setup-utils";

const setupToken = "setup-token-12345678901234567890";

describe("password setup payload", () => {
  it("builds the public password setup payload without a firm ID", () => {
    const payload = buildPasswordSetupPayload({
      userId: " user-client-001 ",
      token: ` ${setupToken} `,
      password: "new-password",
    });

    expect(payload).toEqual({
      userId: "user-client-001",
      token: setupToken,
      password: "new-password",
    });
    expect(payload).not.toHaveProperty("firmId");
  });

  it("requires token, user, matching confirmation, and minimum password length", () => {
    expect(
      canSubmitPasswordSetup({
        userId: "user-client-001",
        token: setupToken,
        password: "new-password",
        passwordConfirmation: "new-password",
      }),
    ).toBe(true);

    expect(
      passwordSetupErrors({
        userId: "",
        token: "short",
        password: "short",
        passwordConfirmation: "different",
      }),
    ).toEqual([
      "User is missing.",
      "Setup token is missing.",
      "Password must be at least 8 characters.",
      "Passwords must match.",
    ]);
  });

  it("renders the small setup page without exposing hidden account tokens", () => {
    const markup = renderToStaticMarkup(
      createElement(PasswordSetupClient, {
        apiBaseUrl: "http://api.example.test",
        token: setupToken,
        userId: "user-client-001",
      }),
    );

    expect(markup).toContain("Set password");
    expect(markup).toContain("New password");
    expect(markup).toContain("Confirm password");
    expect(markup).not.toContain(setupToken);
    expect(markup).not.toContain("Firm ID");
    expect(markup).not.toContain("firm workspace ID");
  });
});
