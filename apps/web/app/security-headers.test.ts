import { describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";

describe("web security headers", () => {
  it("sets baseline hardening headers without exposing the Next powered-by header", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const routes = await nextConfig.headers?.();
    expect(routes).toEqual([
      expect.objectContaining({
        source: "/:path*",
        headers: expect.arrayContaining([
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ]),
      }),
    ]);
  });
});
