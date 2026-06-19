export interface PublicTokenErrorBody {
  code?: string;
  message?: string;
  details?: {
    requiredIncompleteItemIds?: string[];
    [key: string]: unknown;
  };
  error?: {
    code?: string;
    message?: string;
    details?: {
      requiredIncompleteItemIds?: string[];
      [key: string]: unknown;
    };
  };
}

export const PUBLIC_TOKEN_HEADER = "x-open-practice-public-token";

export function buildPublicTokenPath(
  basePath: string,
  token: string,
  ...segments: string[]
): string {
  const normalizedBase = basePath.startsWith("/") ? basePath : `/${basePath}`;
  const pathSegments = [normalizedBase.replace(/\/+$/, ""), token, ...segments];
  return pathSegments
    .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
    .join("/");
}

export function buildPublicTokenHeaderPath(basePath: string, ...segments: string[]): string {
  const normalizedBase = basePath.startsWith("/") ? basePath : `/${basePath}`;
  const pathSegments = [normalizedBase.replace(/\/+$/, ""), ...segments];
  return pathSegments
    .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
    .join("/");
}

export function publicTokenHeaders(token: string, headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers);
  nextHeaders.set(PUBLIC_TOKEN_HEADER, token);
  return nextHeaders;
}

export function publicTokenFromLocationHash(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash.replace(/^#/, "").trim();
  try {
    return hash ? decodeURIComponent(hash) : "";
  } catch {
    return "";
  }
}

export async function readPublicTokenError(response: Response): Promise<PublicTokenErrorBody> {
  try {
    return (await response.json()) as PublicTokenErrorBody;
  } catch {
    return {};
  }
}

export function publicTokenErrorMessage(body: PublicTokenErrorBody, fallback: string): string {
  return body.message ?? body.error?.message ?? fallback;
}

export function publicTokenNetworkErrorMessage(action: string, error: unknown): string {
  const detail = error instanceof Error && error.message.trim() ? ` ${error.message}` : "";
  return `${action} could not reach the secure link service.${detail}`;
}
