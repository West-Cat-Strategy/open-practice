import { describe, expect, it } from "vitest";
import {
  buildPublicTokenPath,
  publicTokenErrorMessage,
  publicTokenNetworkErrorMessage,
  readPublicTokenError,
} from "./publicTokenClient";

describe("public token helpers", () => {
  it("encodes token and path segments without changing the API base path", () => {
    expect(buildPublicTokenPath("/api/portal/intake-forms", "token with / slash")).toBe(
      "/api/portal/intake-forms/token%20with%20%2F%20slash",
    );
    expect(
      buildPublicTokenPath("api/portal/intake-forms", "token", "items", "supporting docs"),
    ).toBe("/api/portal/intake-forms/token/items/supporting%20docs");
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
