# OP-T121 Calendar Reminder Delivery Jobs Proof

Date: 2026-05-26

## Scope

Implemented the first reminder-delivery slice for matter-scoped calendar reminders:

- Pending reminders remain dashboard records by default; email reminder delivery only starts when
  the request includes matching email `deliveryConfirmation`.
- The reminder create path validates confirmation before mutation when delivery is requested, then
  records the reminder lifecycle and queues a delayed `send_email` job for a `calendar.reminder`
  template when SMTP and the email queue are available.
- The reminder update path only re-enters the notification boundary when a reminder transitions
  from a non-pending state into `pending` and the request includes matching confirmation.
- Delivery metadata stays redacted and limited to reminder/event identifiers, reminder status,
  queued email/job identifiers, and delay timing.
- Dashboard reminder records remain the source of truth for the reminder itself.

Attendee sync, iCalendar subscriptions, invitation fan-out, meeting-link delivery, provider sync,
meeting media, realtime chat, and other calendar meeting surfaces stay out of scope.

## Validation

Selector:

```bash
pnpm verify:select -- --files apps/api/src/routes/calendar.ts apps/api/src/routes/calendar.test.ts apps/api/src/routes/outbound-email.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/OP-T121_CALENDAR_REMINDER_DELIVERY_JOBS_PROOF_2026-05-26.md docs/validation/README.md
```

Recommended:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`

Passed:

```bash
pnpm format:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm docs:check
pnpm exec prettier --check apps/api/src/routes/calendar.ts apps/api/src/routes/calendar.test.ts apps/api/src/routes/outbound-email.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/OP-T121_CALENDAR_REMINDER_DELIVERY_JOBS_PROOF_2026-05-26.md docs/validation/README.md
git diff --check
```

Focused coverage includes:

- queued opt-in reminder delivery through the email outbox boundary with a delayed job
- no delivery side effects for ordinary dashboard reminders without confirmation
- confirmation mismatch rejection before reminder mutation
- re-entering pending with confirmation queues one delayed reminder job
- redacted audit metadata for the reminder lifecycle and notification boundary

Repo hygiene:

```bash
pnpm exec prettier --write apps/api/src/routes/calendar.ts apps/api/src/routes/calendar.test.ts apps/api/src/routes/outbound-email.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/OP-T121_CALENDAR_REMINDER_DELIVERY_JOBS_PROOF_2026-05-26.md docs/validation/README.md
```

## Notes

- `pnpm policy:check` currently fails at `node scripts/validate-oss-reuse.mjs` because existing
  OSS reference lock commits do not match the central reference index. Earlier policy subchecks
  passed before that failure: secret scan, package-manifest policy, and migration parity.
- Synthetic data only.
