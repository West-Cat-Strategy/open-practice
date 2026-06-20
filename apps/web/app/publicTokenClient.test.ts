import { describe, expect, it } from "vitest";
import {
  PUBLIC_TOKEN_HEADER,
  buildPublicTokenHeaderPath,
  publicTokenHeaders,
  publicTokenErrorMessage,
  publicTokenNetworkErrorMessage,
  readPublicTokenError,
} from "./publicTokenClient";

describe("public token helpers", () => {
  it("builds header-token paths and headers without token path material", () => {
    expect(buildPublicTokenHeaderPath("api/portal/intake-forms", "items", "supporting docs")).toBe(
      "/api/portal/intake-forms/items/supporting%20docs",
    );

    const headers = publicTokenHeaders("token with / slash", {
      "Content-Type": "application/json",
    });
    expect(headers.get(PUBLIC_TOKEN_HEADER)).toBe("token with / slash");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("keeps public error messages status-safe", async () => {
    const body = await readPublicTokenError(
      new Response(JSON.stringify({ error: { message: "Link unavailable" } }), { status: 403 }),
    );

    expect(publicTokenErrorMessage(body, "Fallback")).toBe("Link unavailable");
    expect(publicTokenErrorMessage({}, "Fallback")).toBe("Fallback");
  });

  it("keeps network failures tied to the public-token action", () => {
    expect(publicTokenNetworkErrorMessage("Draft save", new Error("offline"))).toBe(
      "Draft save could not reach the secure link service. offline",
    );
    expect(publicTokenNetworkErrorMessage("Submit", "unknown")).toBe(
      "Submit could not reach the secure link service.",
    );
  });
});
