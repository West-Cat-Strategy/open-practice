import { dirname } from "node:path";
import { env } from "node:process";
import { URL, fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const isProduction = env.NODE_ENV === "production";

export function buildContentSecurityPolicy({ production = isProduction } = {}) {
  const scriptSrc = production
    ? "script-src 'self'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  const connectSrc = production
    ? "connect-src 'self'"
    : "connect-src 'self' http://localhost:* http://127.0.0.1:*";
  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    connectSrc,
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ];
  if (production) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

// Linux production builds need ProseMirror ESM modules directly instead of TipTap's wrapper re-exports.
const prosemirrorAliases = {
  "@tiptap/pm/commands": "prosemirror-commands",
  "@tiptap/pm/dropcursor": "prosemirror-dropcursor",
  "@tiptap/pm/gapcursor": "prosemirror-gapcursor",
  "@tiptap/pm/history": "prosemirror-history",
  "@tiptap/pm/keymap": "prosemirror-keymap",
  "@tiptap/pm/model": "prosemirror-model",
  "@tiptap/pm/schema-list": "prosemirror-schema-list",
  "@tiptap/pm/state": "prosemirror-state",
  "@tiptap/pm/tables": "prosemirror-tables",
  "@tiptap/pm/transform": "prosemirror-transform",
  "@tiptap/pm/view": "prosemirror-view",
};

function originFromUrl(value) {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

const apiOrigin = originFromUrl(env.NEXT_PUBLIC_API_BASE_URL ?? env.API_BASE_URL);
const cspConnectSources = ["'self'", "http://localhost:*", "http://127.0.0.1:*", apiOrigin].filter(
  Boolean,
);
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  `connect-src ${[...new Set(cspConnectSources)].join(" ")}`,
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "report-to csp-endpoint",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Reporting-Endpoints", value: 'csp-endpoint="/api/csp-report"' },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(),
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: cspReportOnly,
  },
];

if (isProduction) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  transpilePackages: ["@open-practice/domain"],
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      ...prosemirrorAliases,
    };

    return config;
  },
};

export default nextConfig;
