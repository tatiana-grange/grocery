# 03 — Refund

**Status:** done (human sandbox check of lot 5 still open)
**Blocked by:** None (slice 02 is done)

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

**What to build:** an admin records that money was given back to a member (cash, cheque or
transfer). The member's balance goes down by that amount. The application does not send
anything to HelloAsso: the admin gives the money back by hand and records it.

## Acceptance criteria

- [x] **admin-only** — only an admin can record a refund. A distributor and a member are
      refused.
- [x] **reason-required** — a refund without a reason is refused.
- [x] **never-beyond-balance** — a refund larger than the balance is refused with an explicit
      code. A member whose balance is zero or negative cannot be refunded.
- [x] **recorded-only** — recording a refund makes no call to the payment provider.
- [x] **one-reversible-row** — a refund is one new negative ledger entry with its method, its
      reason and the admin who recorded it. Nothing is edited.
- [x] **member-sees-it** — the member sees the refund in their movements, with its reason.
- [x] **journey-covered** — a Playwright test covers an admin recording a refund and the
      balance going down.
- [x] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`.

---

> 🧑 **REVIEW IF RELEVANT** — notes written before the work document exists.

## Notes

- Seams: the wallet ledger and the staff routes of the parent spec
  (`../20261123-1014-lot-5-wallet.spec.md`, section "Seams").
- The decision to record and not to send is explained in the ADR
  `apps/documentation/src/content/docs/project/decisions/0001-helloasso-and-recorded-refunds.mdx`.
- Slice 03 carries the admin notice for an underpaid top-up (the slice 01 case where the payer paid
  less than asked). It moved here from slice 02 (Architect's correction, 2026-11-23).

## Built as

Added at the close, 2026-11-23.

- The refund is one negative ledger row with the reason `refund`. The route is
  `POST wallet/members/:memberId/refunds`, admin only. The refusal code is
  `refund_exceeds_balance`; it covers a refund above the balance and any refund on a balance of
  zero or below. The check and the write run under a lock on the member row.
- "Reversible" in the criterion `one-reversible-row` was read as "a new negative row, never an
  edit" (Architect's ruling). There is no undo of a refund.
- A member who left can be refunded. The button is on the distribution member screen only.
- The underpaid top-up notice is built: one column `topup.underpaidNotifiedAt`, stamped inside the
  locked check before the mail, admins only, at most once per top-up.
- Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test` (512 tests), `pnpm build` and `pnpm e2e`
  (123 tests) all green on the final code.
