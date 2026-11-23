# 01 — Online top-up

**Status:** done (human sandbox check still open)
**Blocked by:** None — can start immediately

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

**What to build:** an active member opens their account page, types an amount or taps a quick
button, and is sent to HelloAsso to pay. When they come back, the page shows that the payment
is being checked, then that their balance went up. Nothing is credited until the application
has asked HelloAsso for the result of the payment.

## Acceptance criteria

- [x] **amount-bounds** — an amount under 5 € or over 200 € is refused with an explicit code,
      and the member sees which bound they broke.
- [x] **quick-buttons-fill-the-field** — the 10, 20 and 50 € buttons put the amount in the
      field, and the member can still type any amount by hand.
- [x] **active-members-only** — a pending, rejected or terminated member cannot start a
      top-up, on the page or on the route.
- [x] **negative-balance-can-top-up** — a member whose balance is negative can start a top-up.
- [x] **credit-after-verification** — the balance rises only after the application asked the
      provider for the payment result. A notification that claims a payment the provider does
      not confirm credits nothing.
- [x] **requested-amount-is-credited** — if the payer paid more because of a voluntary
      contribution, the member is credited the requested amount only.
- [x] **credited-exactly-once** — the same payment reported twice, or reported by the
      notification and by the return page, writes one ledger entry.
- [x] **no-entry-on-failure** — an abandoned, failed or expired payment writes no ledger
      entry and the member can start again.
- [x] **entry-is-traceable** — the ledger entry says it is an online top-up, with payment
      method "online" and the provider payment id.
- [x] **result-page** — after payment the page shows "being checked", then "credited", or the
      failure, and never shows a balance that is not yet true.
- [x] **off-without-settings** — without the HelloAsso settings the app starts, the top-up
      button is hidden, and the routes refuse with an explicit code.
- [x] **settings-documented** — each new environment variable is in the matching
      `.env.example` files.
- [x] **migration-reviewed** — the schema change is a MikroORM migration with its reviewed SQL
      and the updated snapshot, and the OpenAPI client is regenerated.
- [x] **journey-covered** — a Playwright test covers the top-up journey with the fake
      provider.
- [x] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`.

---

> 🧑 **REVIEW IF RELEVANT** — notes written before the work document exists.

## Notes

- Seams: the payment provider seam, the member routes, and the provider notification route of
  the parent spec (`../20261123-1014-lot-5-wallet.spec.md`, section "Seams").
- The HelloAsso payment request is valid for 15 minutes. The top-up turns expired 5 minutes
  after that, as a grace period. An expired top-up can still become paid if the provider
  later confirms it. Amended by the Architect, 2026-11-23, after the build.
- The literal `pnpm e2e` could not start on the maintainer's machine, because another
  project's mail container holds the ports 1035 and 1090 that the E2E compose file binds.
  The Playwright suite was run against a stack started by hand on other ports: 118 passed.
  Run the literal `pnpm e2e` once the ports are free.
- HelloAsso notifications are not trusted on their own. The application always asks for the
  result before it credits.
- Use the HelloAsso sandbox by hand once before closing; automated tests use the fake
  provider only. That check must also answer these open questions: whether a payer can retry
  inside the same checkout after a refused card (if so, a failed top-up must be asked about
  again, as an expired one is), whether the paid amount includes the voluntary contribution,
  and whether `localhost` is accepted as a return address.
