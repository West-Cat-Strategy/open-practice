# Security Remediation Proof - 2026-05-31

## Scope

This proof covers the security remediation batch landed on
`codex/op-security-remediation-2026-05-31`.

- Upload completion now verifies the uploaded object exists in S3/MinIO and returns the expected
  SHA-256 checksum before marking a document verified; missing checksums and client-supplied scan
  states are rejected or ignored.
- Public external-upload status and completion responses, plus intake completion responses, no
  longer expose checksum/duplicate details.
- Manual scan-status override is owner-admin only.
- Conflict checks return details only to owner-admin/auditor roles; other authorized users receive
  aggregate severity/counts.
- Firm-wide audit reads are owner-admin/auditor only; `?matterId=` returns an assignment-checked
  redacted matter projection without hash-chain internals.
- Passkey login options no longer return user-specific credential IDs.
- Connector delivery URLs are validated before persistence and worker delivery, including private
  address and DNS-resolution guardrails, guarded socket lookup, and no automatic redirect following.
- Local Docker Compose ports bind to loopback by default, external upload pages use the browser API
  origin, and the web app sets baseline security headers.

## Validation

| Command                                                                                                                                                                                     | Result                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)`                                                                                         | Pass; selected format, docs, policy, tests, package typechecks, database checks, worker build, and full build |
| `pnpm --filter @open-practice/domain build`                                                                                                                                                 | Pass                                                                                                          |
| `pnpm --filter @open-practice/database build`                                                                                                                                               | Pass                                                                                                          |
| `pnpm --filter @open-practice/providers build`                                                                                                                                              | Pass                                                                                                          |
| `pnpm --filter @open-practice/domain test -- outbound-webhooks.test.ts`                                                                                                                     | Pass: 22 files, 148 tests                                                                                     |
| `pnpm --filter @open-practice/worker test -- processors.test.ts`                                                                                                                            | Pass: 3 files, 24 tests                                                                                       |
| `pnpm --filter @open-practice/web test -- security-headers.test.ts runner-utils.test.ts`                                                                                                    | Pass: 16 files, 126 tests                                                                                     |
| `pnpm --filter @open-practice/api test -- documents.test.ts external-uploads.test.ts intake-forms.test.ts webauthn.test.ts audit.test.ts matters.test.ts connectors.test.ts server.test.ts` | Pass: 39 files, 420 tests                                                                                     |
| `pnpm format:check`                                                                                                                                                                         | Pass                                                                                                          |
| `pnpm docs:check`                                                                                                                                                                           | Pass                                                                                                          |
| `pnpm policy:check`                                                                                                                                                                         | Pass                                                                                                          |
| `pnpm security:scan`                                                                                                                                                                        | Pass: no high-confidence tracked secrets                                                                      |
| `pnpm audit --prod`                                                                                                                                                                         | Pass: no known production vulnerabilities                                                                     |
| `pnpm test`                                                                                                                                                                                 | Pass: 9 workspace tasks and 36 script tests                                                                   |
| `pnpm --filter @open-practice/domain test`                                                                                                                                                  | Pass: 22 files, 148 tests                                                                                     |
| `pnpm --filter @open-practice/domain typecheck`                                                                                                                                             | Pass                                                                                                          |
| `pnpm --filter @open-practice/database test`                                                                                                                                                | Pass: 16 files, 89 tests                                                                                      |
| `pnpm --filter @open-practice/database db:check`                                                                                                                                            | Pass                                                                                                          |
| `pnpm migrations:check`                                                                                                                                                                     | Pass: 44 SQL files match 44 journal entries                                                                   |
| `pnpm --filter @open-practice/database typecheck`                                                                                                                                           | Pass                                                                                                          |
| `pnpm --filter @open-practice/api test`                                                                                                                                                     | Pass: 39 files, 420 tests                                                                                     |
| `pnpm --filter @open-practice/api typecheck`                                                                                                                                                | Pass after TypeScript-only fixes for conflict severity aggregation and the upload verification helper         |
| `pnpm --filter @open-practice/providers test`                                                                                                                                               | Pass: 5 files, 15 tests                                                                                       |
| `pnpm --filter @open-practice/worker test`                                                                                                                                                  | Pass: 3 files, 24 tests                                                                                       |
| `pnpm --filter @open-practice/worker typecheck`                                                                                                                                             | Pass                                                                                                          |
| `pnpm --filter @open-practice/worker build`                                                                                                                                                 | Pass                                                                                                          |
| `pnpm --filter @open-practice/web test`                                                                                                                                                     | Pass: 16 files, 126 tests                                                                                     |
| `pnpm --filter @open-practice/web typecheck`                                                                                                                                                | Pass after making public checksum status optional in the external upload UI                                   |
| `pnpm build`                                                                                                                                                                                | Pass: 6 package builds                                                                                        |

## Notes

- The first API/worker/web targeted run was retried after building local workspace package exports in
  the fresh worktree.
- Three read-only subagent security reviews were run over upload/public-token, authorization/privacy,
  and outbound/web/local-hardening slices. Findings were addressed before final validation: public
  duplicate/checksum status redaction, fail-closed checksum verification, scoped audit/conflict chain
  signal removal, matter-audit alias coverage, route manifest guard detail, DNS-aware connector
  persistence checks, guarded worker socket lookup, redirect non-following delivery, and
  IPv4-mapped IPv6 private-address detection.
- The final selector did not choose browser/e2e suites for this path set; public-token response and
  header coverage are exercised by focused API and web tests above.
- No new dependencies or migrations were added.
- No checks were skipped.
