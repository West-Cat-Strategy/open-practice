import { describe, expect, it } from "vitest";
import nextConfig, { buildContentSecurityPolicy } from "../next.config.mjs";

describe("web security headers", () => {
  it("sets baseline hardening headers without exposing the Next powered-by header", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const routes = await nextConfig.headers?.();
    const headers = routes?.[0]?.headers ?? [];
    const csp = headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
    const reportOnly = headers.find(
      (header) => header.key === "Content-Security-Policy-Report-Only",
    )?.value;

    expect(routes).toEqual([
      expect.objectContaining({
        source: "/:path*",
        headers: expect.arrayContaining([
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Reporting-Endpoints", value: 'csp-endpoint="/api/csp-report"' },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          expect.objectContaining({ key: "Content-Security-Policy", value: expect.any(String) }),
          expect.objectContaining({
            key: "Content-Security-Policy-Report-Only",
            value: expect.any(String),
          }),
        ]),
      }),
    ]);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' http://localhost:* http://127.0.0.1:*");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(reportOnly).toEqual(expect.any(String));
    expect(reportOnly).toContain("default-src 'self'");
    expect(reportOnly).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(reportOnly).toContain("connect-src 'self'");
    expect(reportOnly).toContain("img-src 'self' data: blob:");
    expect(reportOnly).toContain("style-src 'self' 'unsafe-inline'");
    expect(reportOnly).toContain("font-src 'self' data:");
    expect(reportOnly).toContain("form-action 'self'");
    expect(reportOnly).toContain("report-to csp-endpoint");
    expect(reportOnly).not.toContain("frame-ancestors");
  });

  it("keeps production CSP free of inline script and loopback connect allowances", () => {
    const productionCsp = buildContentSecurityPolicy({ production: true });
    const scriptSrc = productionCsp
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith("script-src"));
    expect(scriptSrc).toBe("script-src 'self'");
    expect(productionCsp).toContain("connect-src 'self'");
    expect(productionCsp).toContain("upgrade-insecure-requests");
    expect(productionCsp).not.toContain("http://localhost:*");
    expect(productionCsp).not.toContain("http://127.0.0.1:*");
    expect(productionCsp).not.toContain("'unsafe-eval'");
  });
});
