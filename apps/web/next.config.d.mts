import type { NextConfig } from "next";

export interface RelaxedCspOptions {
  relaxed?: boolean;
  localDockerDev?: boolean;
  profile?: string;
}

export interface ContentSecurityPolicyOptions {
  production?: boolean;
  relaxed?: boolean;
}

export interface ApiRewriteBaseUrlOptions {
  localDockerDev?: boolean;
  sameOriginApi?: boolean;
}

export function validateRelaxedCspFlag(options?: RelaxedCspOptions): void;

export function buildContentSecurityPolicy(options?: ContentSecurityPolicyOptions): string;

export function defaultApiRewriteBaseUrl(options?: ApiRewriteBaseUrlOptions): string;

export function buildApiRewriteDestination(apiBaseUrl?: string): string;

declare const nextConfig: NextConfig;

export default nextConfig;
