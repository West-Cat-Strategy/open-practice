import { lookup } from "node:dns/promises";
import {
  validateProviderEgressDns,
  validateProviderEgressHost,
  type ProviderEgressDnsResolver,
} from "@open-practice/domain";

export async function defaultProviderEgressDnsResolver(hostname: string): Promise<string[]> {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((result) => result.address);
}

export async function assertProviderEgressAllowed(input: {
  hostname: string;
  resolver?: ProviderEgressDnsResolver;
  label: string;
}): Promise<void> {
  const hostValidation = validateProviderEgressHost(input.hostname);
  if (!hostValidation.ok) {
    throw new Error(`${input.label} failed egress guardrail validation: ${hostValidation.reason}`);
  }

  const dnsValidation = await validateProviderEgressDns({
    hostname: hostValidation.host,
    resolver: input.resolver ?? defaultProviderEgressDnsResolver,
  });
  if (!dnsValidation.ok) {
    throw new Error(`${input.label} failed egress guardrail validation: ${dnsValidation.reason}`);
  }
}
