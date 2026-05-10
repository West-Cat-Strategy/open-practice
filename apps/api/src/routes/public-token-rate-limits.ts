import type { FastifyRequest, RouteShorthandOptions } from "fastify";

type PublicTokenPolicyName = "view" | "mutation" | "upload-intent";

type PublicTokenRateLimitPolicy = {
  max: number;
  timeWindow: string;
};

export const PUBLIC_TOKEN_VIEW_RATE_LIMIT: PublicTokenRateLimitPolicy = {
  max: 60,
  timeWindow: "1 minute",
};

export const PUBLIC_TOKEN_MUTATION_RATE_LIMIT: PublicTokenRateLimitPolicy = {
  max: 30,
  timeWindow: "1 minute",
};

export const PUBLIC_TOKEN_UPLOAD_INTENT_RATE_LIMIT: PublicTokenRateLimitPolicy = {
  max: 10,
  timeWindow: "1 minute",
};

function publicTokenRateLimitKey(scope: string, request: FastifyRequest): string {
  const path = request.routeOptions.url ?? "unknown";
  return `${request.ip}:${request.method}:${scope}:${path}`;
}

export function publicTokenRateLimitOptions(
  scope: string,
  policy: PublicTokenRateLimitPolicy,
): RouteShorthandOptions {
  return {
    config: {
      rateLimit: {
        ...policy,
        keyGenerator: (request: FastifyRequest) => publicTokenRateLimitKey(scope, request),
      },
    },
  };
}

export function publicTokenPolicyOptions(
  scope: string,
  policyName: PublicTokenPolicyName,
): RouteShorthandOptions {
  const policy =
    policyName === "view"
      ? PUBLIC_TOKEN_VIEW_RATE_LIMIT
      : policyName === "upload-intent"
        ? PUBLIC_TOKEN_UPLOAD_INTENT_RATE_LIMIT
        : PUBLIC_TOKEN_MUTATION_RATE_LIMIT;
  return publicTokenRateLimitOptions(scope, policy);
}
