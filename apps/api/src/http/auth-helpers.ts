import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE_NAME = "open_practice_session";
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
    (method === "GET" && path?.startsWith("/api/portal/shares/")) ||
    (method === "POST" && /^\/api\/portal\/shares\/[^/]+\/email-verification$/.test(path ?? "")) ||
    (method === "GET" && /^\/api\/portal\/email-receipts\/[^/]+$/.test(path ?? "")) ||
    (method === "POST" && /^\/api\/portal\/email-receipts\/[^/]+$/.test(path ?? "")) ||
    (method === "GET" && /^\/api\/portal\/mail\/receipts\/[^/]+$/.test(path ?? "")) ||
    (method === "POST" && /^\/api\/portal\/mail\/receipts\/[^/]+$/.test(path ?? "")) ||
    (method === "GET" && /^\/api\/portal\/intake-forms\/[^/]+$/.test(path ?? "")) ||
    (method === "POST" && /^\/api\/portal\/intake-forms\/[^/]+\/draft$/.test(path ?? "")) ||
    (method === "GET" && /^\/api\/portal\/external-uploads\/[^/]+$/.test(path ?? "")) ||
    (method === "GET" && /^\/api\/portal\/mail\/receipts\/[^/]+$/.test(path ?? "")) ||
    (method === "GET" && /^\/api\/portal\/guest-sessions\/[^/]+$/.test(path ?? "")) ||
    (method === "POST" && /^\/api\/portal\/intake-forms\/[^/]+\/submit$/.test(path ?? "")) ||
    (method === "POST" && /^\/api\/portal\/guest-sessions\/[^/]+\/check-in$/.test(path ?? "")) ||
    (method === "POST" && /^\/api\/portal\/mail\/receipts\/[^/]+\/acknowledge$/.test(path ?? "")) ||
    (method === "POST" &&
      /^\/api\/portal\/intake-forms\/[^/]+\/items\/[^/]+\/uploads$/.test(path ?? "")) ||
    (method === "POST" &&
      /^\/api\/portal\/intake-forms\/[^/]+\/items\/[^/]+\/documents\/[^/]+\/complete$/.test(
        path ?? "",
      )) ||
    (method === "POST" &&
      /^\/api\/portal\/intake-forms\/[^/]+\/items\/[^/]+\/signature$/.test(path ?? "")) ||
    (method === "POST" && /^\/api\/portal\/external-uploads\/[^/]+\/intents$/.test(path ?? "")) ||
    (method === "POST" &&
      /^\/api\/portal\/external-uploads\/[^/]+\/documents\/[^/]+\/complete$/.test(path ?? ""))
  );
}
