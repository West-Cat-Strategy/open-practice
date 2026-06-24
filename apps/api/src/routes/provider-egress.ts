import { lookup } from "node:dns/promises";
import {
  validateProviderEgressDns,
  validateProviderEgressHost,
  type ProviderEgressDnsResolver,
} from "@open-practice/domain";
import { ApiHttpError } from "../http/response.js";

export async function defaultProviderEgressDnsResolver(hostname: string): Promise<string[]> {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((result) => result.address);
}

export async function assertProviderEgressAllowed(input: {
  hostname: string;
  resolver?: ProviderEgressDnsResolver;
  code: string;
  field: string;
}): Promise<void> {
  const hostValidation = validateProviderEgressHost(input.hostname);
  if (!hostValidation.ok) {
    throw new ApiHttpError(
      400,
      input.code,
      `${input.field} failed provider egress guardrail validation`,
      { reason: hostValidation.reason },
    );
  }

  const dnsValidation = await validateProviderEgressDns({
    hostname: hostValidation.host,
    resolver: input.resolver ?? defaultProviderEgressDnsResolver,
  });
  if (!dnsValidation.ok) {
    throw new ApiHttpError(
      400,
      input.code,
      `${input.field} failed provider egress guardrail validation`,
      { reason: dnsValidation.reason },
    );
  }
}
