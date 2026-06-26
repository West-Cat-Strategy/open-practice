import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE_NAME = "open_practice_session";
export const PUBLIC_TOKEN_HEADER = "x-open-practice-public-token";
const PASSWORD_HASH_ITERATIONS = 210_000;
const PASSWORD_HASH_KEY_LENGTH = 32;
const PASSWORD_HASH_DIGEST = "sha256";

export function hashToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_HASH_ITERATIONS,
    PASSWORD_HASH_KEY_LENGTH,
    PASSWORD_HASH_DIGEST,
  ).toString("hex");
  return `pbkdf2:${PASSWORD_HASH_DIGEST}:${PASSWORD_HASH_ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [scheme, digest, iterations, salt, hash] = storedHash.split(":");
  if (scheme !== "pbkdf2" || !digest || !iterations || !salt || !hash) return false;
  const candidate = pbkdf2Sync(
    password,
    salt,
    Number(iterations),
    Buffer.from(hash, "hex").length,
    digest,
  );
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionCookie(token: string, expiresAt: string, secure: boolean): string {
  const secureFlag = secure ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(
    token,
  )}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Expires=${new Date(expiresAt).toUTCString()}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSessionToken(requestHeaders: {
  cookie?: string;
  ["x-open-practice-session"]?: string | string[];
}): string | undefined {
  const header = requestHeaders["x-open-practice-session"];
  if (typeof header === "string" && header.length > 0) return header;
  const cookie = requestHeaders.cookie;
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function readPublicTokenHeader(
  requestHeaders: Record<string, string | string[] | undefined>,
): string | undefined {
  const value = requestHeaders[PUBLIC_TOKEN_HEADER];
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value) && value.length === 1) return value[0]?.trim() || undefined;
  return undefined;
}

export function publicTokenPathFromHeader(token: string | undefined): { token: string } {
  return { token: token ?? "" };
}

const PUBLIC_TOKEN_PATH_REDACTIONS: Array<[RegExp, string]> = [
  [/^(\/api\/portal\/shares)\/[^/?]+(\/email-verification)?(\?.*)?$/, "$1/:token$2$3"],
  [/^(\/api\/portal\/email-receipts)\/[^/?]+(\?.*)?$/, "$1/:token$2"],
  [/^(\/api\/portal\/mail\/receipts)\/[^/?]+(\?.*)?$/, "$1/:token$2"],
  [/^(\/api\/portal\/external-uploads)\/[^/?]+(\/intents)(\?.*)?$/, "$1/:token$2$3"],
  [
    /^(\/api\/portal\/external-uploads)\/[^/?]+(\/documents\/[^/?]+\/complete)(\?.*)?$/,
    "$1/:token$2$3",
  ],
  [/^(\/api\/portal\/external-uploads)\/[^/?]+(\?.*)?$/, "$1/:token$2"],
  [/^(\/api\/portal\/guest-sessions)\/[^/?]+(\/check-in)?(\?.*)?$/, "$1/:token$2$3"],
  [/^(\/api\/portal\/appointment-bookings)\/[^/?]+(\/book)?(\?.*)?$/, "$1/:token$2$3"],
  [/^(\/api\/portal\/intake-forms)\/[^/?]+(\/draft|\/submit)?(\?.*)?$/, "$1/:token$2$3"],
  [/^(\/api\/portal\/intake-forms)\/[^/?]+(\/items\/[^/?]+\/uploads)(\?.*)?$/, "$1/:token$2$3"],
  [
    /^(\/api\/portal\/intake-forms)\/[^/?]+(\/items\/[^/?]+\/documents\/[^/?]+\/complete)(\?.*)?$/,
    "$1/:token$2$3",
  ],
  [/^(\/api\/portal\/intake-forms)\/[^/?]+(\/items\/[^/?]+\/signature)(\?.*)?$/, "$1/:token$2$3"],
];

export function redactPublicTokenUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  for (const [pattern, replacement] of PUBLIC_TOKEN_PATH_REDACTIONS) {
    if (pattern.test(url)) return url.replace(pattern, replacement);
  }
  return url;
}

const CALDAV_PUBLIC_ROUTE_PATTERNS = [
  /^\/caldav\/?$/,
  /^\/caldav\/principals\/[^/]+\/$/,
  /^\/caldav\/calendars\/[^/]+\/$/,
  /^\/caldav\/calendars\/[^/]+\/[^/]+\/$/,
  /^\/caldav\/calendars\/[^/]+\/[^/]+\/[^/]+\.ics$/,
];

function isPublicCalDavRoute(path: string): boolean {
  return (
    path === "/.well-known/caldav" ||
    CALDAV_PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(path))
  );
}

export const PUBLIC_ROUTE_SAMPLES = [
  { method: "GET", path: "/health" },
  { method: "GET", path: "/api/setup/status" },
  { method: "POST", path: "/api/setup/complete" },
  { method: "POST", path: "/api/setup/webauthn-options" },
  { method: "POST", path: "/api/auth/login" },
  { method: "POST", path: "/api/auth/login/options" },
  { method: "POST", path: "/api/auth/login/verify" },
  { method: "POST", path: "/api/auth/password-setup" },
  { method: "POST", path: "/api/auth/recovery-codes/verify" },
  { method: "POST", path: "/api/public/consultation-intakes" },
  { method: "GET", path: "/api/public/appointment-booking/sample/slots" },
  { method: "POST", path: "/api/public/appointment-booking/sample/bookings" },
  { method: "POST", path: "/api/inbound-email/provider-webhooks/mailgun/raw-mime" },
  { method: "GET", path: "/api/portal/shares/sample" },
  { method: "GET", path: "/api/portal/shares" },
  { method: "POST", path: "/api/portal/shares/sample/email-verification" },
  { method: "POST", path: "/api/portal/shares/email-verification" },
  { method: "GET", path: "/api/portal/email-receipts/sample" },
  { method: "GET", path: "/api/portal/email-receipts" },
  { method: "POST", path: "/api/portal/email-receipts/sample" },
  { method: "POST", path: "/api/portal/email-receipts" },
  { method: "GET", path: "/api/portal/mail/receipts/sample" },
  { method: "GET", path: "/api/portal/mail/receipts" },
  { method: "POST", path: "/api/portal/mail/receipts/sample" },
  { method: "POST", path: "/api/portal/mail/receipts" },
  { method: "GET", path: "/api/portal/intake-forms/sample" },
  { method: "GET", path: "/api/portal/intake-forms" },
  { method: "POST", path: "/api/portal/intake-forms/sample/draft" },
  { method: "POST", path: "/api/portal/intake-forms/draft" },
  { method: "POST", path: "/api/portal/intake-forms/sample/submit" },
  { method: "POST", path: "/api/portal/intake-forms/submit" },
  {
    method: "POST",
    path: "/api/portal/intake-forms/sample/items/sample/uploads",
  },
  {
    method: "POST",
    path: "/api/portal/intake-forms/items/sample/uploads",
  },
  {
    method: "POST",
    path: "/api/portal/intake-forms/sample/items/sample/documents/sample/complete",
  },
  {
    method: "POST",
    path: "/api/portal/intake-forms/items/sample/documents/sample/complete",
  },
  {
    method: "POST",
    path: "/api/portal/intake-forms/sample/items/sample/signature",
  },
  {
    method: "POST",
    path: "/api/portal/intake-forms/items/sample/signature",
  },
  { method: "GET", path: "/api/portal/external-uploads/sample" },
  { method: "GET", path: "/api/portal/external-uploads" },
  { method: "POST", path: "/api/portal/external-uploads/sample/intents" },
  { method: "POST", path: "/api/portal/external-uploads/intents" },
  {
    method: "POST",
    path: "/api/portal/external-uploads/sample/documents/sample/complete",
  },
  {
    method: "POST",
    path: "/api/portal/external-uploads/documents/sample/complete",
  },
  { method: "GET", path: "/api/portal/guest-sessions/sample" },
  { method: "GET", path: "/api/portal/guest-sessions" },
  { method: "POST", path: "/api/portal/guest-sessions/sample/check-in" },
  { method: "POST", path: "/api/portal/guest-sessions/check-in" },
  { method: "GET", path: "/api/portal/appointment-bookings/sample" },
  { method: "GET", path: "/api/portal/appointment-bookings" },
  { method: "POST", path: "/api/portal/appointment-bookings/sample/book" },
  { method: "POST", path: "/api/portal/appointment-bookings/book" },
] as const;

export function isPublicRoute(method: string, url: string): boolean {
  const path = url.split("?")[0];
  return (
    path === "/health" ||
    isPublicCalDavRoute(path) ||
    (method === "GET" && path === "/api/setup/status") ||
    (method === "POST" && path === "/api/setup/complete") ||
    (method === "POST" && path === "/api/setup/webauthn-options") ||
    (method === "POST" && path === "/api/auth/login") ||
    (method === "POST" && path === "/api/auth/login/options") ||
    (method === "POST" && path === "/api/auth/login/verify") ||
    (method === "POST" && path === "/api/auth/password-setup") ||
    (method === "POST" && path === "/api/auth/recovery-codes/verify") ||
    (method === "POST" && path === "/api/public/consultation-intakes") ||
    (method === "GET" && /^\/api\/public\/appointment-booking\/[^/]+\/slots$/.test(path ?? "")) ||
    (method === "POST" &&
      /^\/api\/public\/appointment-booking\/[^/]+\/bookings$/.test(path ?? "")) ||
    (method === "POST" && path === "/api/inbound-email/provider-webhooks/mailgun/raw-mime") ||
    (method === "GET" && path === "/api/portal/shares") ||
    (method === "GET" && path?.startsWith("/api/portal/shares/")) ||
    (method === "POST" && path === "/api/portal/shares/email-verification") ||
    (method === "POST" && /^\/api\/portal\/shares\/[^/]+\/email-verification$/.test(path ?? "")) ||
    (method === "GET" && path === "/api/portal/email-receipts") ||
    (method === "GET" && /^\/api\/portal\/email-receipts\/[^/]+$/.test(path ?? "")) ||
    (method === "POST" && path === "/api/portal/email-receipts") ||
    (method === "POST" && /^\/api\/portal\/email-receipts\/[^/]+$/.test(path ?? "")) ||
    (method === "GET" && path === "/api/portal/mail/receipts") ||
    (method === "GET" && /^\/api\/portal\/mail\/receipts\/[^/]+$/.test(path ?? "")) ||
    (method === "POST" && path === "/api/portal/mail/receipts") ||
    (method === "POST" && /^\/api\/portal\/mail\/receipts\/[^/]+$/.test(path ?? "")) ||
    (method === "GET" && path === "/api/portal/intake-forms") ||
    (method === "GET" && /^\/api\/portal\/intake-forms\/[^/]+$/.test(path ?? "")) ||
    (method === "POST" && path === "/api/portal/intake-forms/draft") ||
    (method === "POST" && /^\/api\/portal\/intake-forms\/[^/]+\/draft$/.test(path ?? "")) ||
    (method === "GET" && path === "/api/portal/external-uploads") ||
    (method === "GET" && /^\/api\/portal\/external-uploads\/[^/]+$/.test(path ?? "")) ||
    (method === "GET" && path === "/api/portal/guest-sessions") ||
    (method === "GET" && /^\/api\/portal\/guest-sessions\/[^/]+$/.test(path ?? "")) ||
    (method === "POST" && path === "/api/portal/intake-forms/submit") ||
    (method === "POST" && /^\/api\/portal\/intake-forms\/[^/]+\/submit$/.test(path ?? "")) ||
    (method === "POST" && path === "/api/portal/guest-sessions/check-in") ||
    (method === "POST" && /^\/api\/portal\/guest-sessions\/[^/]+\/check-in$/.test(path ?? "")) ||
    (method === "GET" && path === "/api/portal/appointment-bookings") ||
    (method === "GET" && /^\/api\/portal\/appointment-bookings\/[^/]+$/.test(path ?? "")) ||
    (method === "POST" && path === "/api/portal/appointment-bookings/book") ||
    (method === "POST" && /^\/api\/portal\/appointment-bookings\/[^/]+\/book$/.test(path ?? "")) ||
    (method === "POST" &&
      /^\/api\/portal\/intake-forms\/items\/[^/]+\/uploads$/.test(path ?? "")) ||
    (method === "POST" &&
      /^\/api\/portal\/intake-forms\/[^/]+\/items\/[^/]+\/uploads$/.test(path ?? "")) ||
    (method === "POST" &&
      /^\/api\/portal\/intake-forms\/items\/[^/]+\/documents\/[^/]+\/complete$/.test(path ?? "")) ||
    (method === "POST" &&
      /^\/api\/portal\/intake-forms\/[^/]+\/items\/[^/]+\/documents\/[^/]+\/complete$/.test(
        path ?? "",
      )) ||
    (method === "POST" &&
      /^\/api\/portal\/intake-forms\/items\/[^/]+\/signature$/.test(path ?? "")) ||
    (method === "POST" &&
      /^\/api\/portal\/intake-forms\/[^/]+\/items\/[^/]+\/signature$/.test(path ?? "")) ||
    (method === "POST" && path === "/api/portal/external-uploads/intents") ||
    (method === "POST" && /^\/api\/portal\/external-uploads\/[^/]+\/intents$/.test(path ?? "")) ||
    (method === "POST" &&
      /^\/api\/portal\/external-uploads\/documents\/[^/]+\/complete$/.test(path ?? "")) ||
    (method === "POST" &&
      /^\/api\/portal\/external-uploads\/[^/]+\/documents\/[^/]+\/complete$/.test(path ?? ""))
  );
}
