import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveBrowserApiBaseUrl } from "./api-base-urls";
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

  it("uses same-origin API requests for self-hosted and Docker local browser modes", () => {
    expect(
      resolveBrowserApiBaseUrl({
        OPEN_PRACTICE_BROWSER_API_MODE: "same-origin",
        NEXT_PUBLIC_API_BASE_URL: "https://api.example.test",
      }),
    ).toBe("");
    expect(
      resolveBrowserApiBaseUrl({
        OPEN_PRACTICE_DOCKER_LOCAL_DEV: "true",
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:34000",
      }),
    ).toBe("");
  });

  it("keeps explicit browser API origins outside same-origin modes", () => {
    expect(
      resolveBrowserApiBaseUrl({
        NEXT_PUBLIC_API_BASE_URL: "https://api.example.test",
      }),
    ).toBe("https://api.example.test");
  });
});
