import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LoginClient from "./login-client";
import { buildLoginPayload, canSubmitLogin } from "./login-client-utils";

describe("login client single-tenant payload", () => {
  it("renders email/password sign-in without a firm ID field", () => {
    const markup = renderToStaticMarkup(createElement(LoginClient, { apiBaseUrl: "http://api" }));

    expect(markup).toContain("Email");
    expect(markup).toContain("Password");
    expect(markup).not.toContain("Firm ID");
    expect(markup).not.toContain("firm workspace ID");
  });

  it("builds the public auth payload without firmId", () => {
    expect(canSubmitLogin({ email: " avery@example.test ", password: "password123" })).toBe(true);
    expect(buildLoginPayload({ email: " avery@example.test ", password: "password123" })).toEqual({
      email: "avery@example.test",
      password: "password123",
    });
  });
});
