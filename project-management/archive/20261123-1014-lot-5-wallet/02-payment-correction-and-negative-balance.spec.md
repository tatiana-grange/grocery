# 02 — Payment correction and negative balance

**Status:** done
**Blocked by:** None — can start immediately

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

**What to build:** a staff member who typed a wrong payment (cash, cheque or transfer) can
correct it. The correction is a new reversing entry. If it leaves the member's balance below
zero, the correction still goes through. From then on the member cannot buy, at the counter or
online, until they top up. An e-mail tells the admins and the member there is a problem.

## Acceptance criteria

- [x] **correct-manual-payment** — a payment recorded by hand can be corrected once. The
      correction writes a reversing entry for the same amount and refers to the original.
- [x] **history-untouched** — the original entry is never edited or deleted.
- [x] **only-manual-payments** — an online top-up, a handover entry, or a payment that was
      already corrected is refused with an explicit code.
- [x] **any-staff-may-correct** — a distributor and an admin can correct. A member cannot, and
      a member cannot correct someone else's account.
- [x] **reason-recorded** — a correction carries a short reason and the staff member who made
      it.
- [x] **may-go-negative** — a correction that leaves the balance below zero is accepted.
- [x] **blocks-the-counter** — with a negative balance, a handover and an express order are
      refused with the existing insufficient-balance code.
- [x] **blocks-the-online-shop** — with a negative balance, the cart and the checkout are
      refused with an explicit conflict code, and the page tells the member to top up or
      contact the cooperative.
- [x] **notice-emails** — when a correction leaves the balance negative, one e-mail goes to
      every admin and one to the member, once per correction.
- [x] **mail-failure-keeps-the-correction** — if sending fails, the correction stays written
      and the failure is logged.
- [x] **old-claims-updated** — every comment, contract description and doc that says the
      balance is never negative (including the one marked SC-010) is updated.
- [x] **journey-covered** — a Playwright test covers a correction that leaves the balance
      negative, and the blocked purchase.
- [x] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`.

---

> 🧑 **REVIEW IF RELEVANT** — notes written before the work document exists.

## Notes

- Seams: the wallet ledger, the staff routes, the purchase guard and the member notice of the
  parent spec (`../20261123-1014-lot-5-wallet.spec.md`, section "Seams").
- Today the only refusal is `insufficient_balance` at the handover. The purchase guard becomes
  the single place that refuses, and the online shop calls it too.
- A member with exactly zero is not blocked. Only a negative balance is.
- Slice 01 leaves one case with only an error log: a top-up that HelloAsso says was paid for
  less than requested stays pending, the money is held, and nothing credits it. Once the admin
  e-mails exist, send the admins a notice for that case too. It is not an acceptance
  criterion. Ruled on 2026-11-23: it needs a new column to send only once, so slice 03 carries it.
- The e-mail copy is French first, like the rest of the member-facing text, and says there is
  a problem with the account. It does not give details of the correction.
