# Journal

Project history, newest first. Written by hand, one dated entry per
task — never generated.

## 2026-11-25

- Diagnosis of the 500 on reversing a reversal: fixed on `fix/reverse-reversal-500`. The cause was
  in the test setup, not the app. Supertest started the app on a random port for each request,
  and macOS could hand out a port another local program held on 127.0.0.1, which then answered
  instead. A harness showed 4 stray answers and 2 connection resets in 18,000 calls before the
  fix, none after. The test app now listens once on 127.0.0.1, pinned by a regression test. This
  also explains the wallet and distribution tests that failed now and then since lot 5. All
  gates green (605 API tests). Proposed: check route ids as UUIDs, since a bad id answers 500.

## 2026-11-24

- Lot 6, participation planning: built and reviewed on `feat/participation-planning`. Admins create,
  edit, cancel and delete time slots with a number of places. Members sign up while places are
  left, and leave until 7 days before the start. Admins can sign up or remove anyone until the slot
  ends. A member cannot hold two overlapping slots. The last place and the no-overlap rule hold
  under row locks on the member and the slot, proven by two service tests that fail without the
  lock (the HTTP test app has a pool of one connection, so it cannot prove a lock). The Typists
  coded it in nine steps, test first. The review found four standards points (mapper check,
  schema derivation, hand-written page meta, names), all fixed. All five gates are green (601 API
  tests, 132 browser tests). Fixed after the close, on the human's word: a cancelled slot can no
  longer be edited, the API refuses it with `slot_cancelled`. A six-check feature review then
  found 43 small points (missing tests, copied code, names, comments, French wording), all fixed:
  604 API tests and 135 browser tests green. The report sits beside the spec.

## 2026-11-23

- Lot 5, slice 03, refund, and the close of lot 5: built and reviewed on `feat/online-topup`. An
  admin can record money given back to a member. It is one negative ledger row, checked under a
  lock so it never goes beyond the balance, and nothing is sent to HelloAsso. The admins now get
  one e-mail when a top-up is paid short, once per top-up. The Typist coded it in four steps and
  the full suites are green (512 API tests, 123 browser tests). The two reviewers found nothing
  blocking. Open: some wallet tests fail now and then under load in a full run (seen in slices 02
  and 03, cause not found), and the human check against the real HelloAsso sandbox. The lot is
  closed: its spec and all slice documents are archived together in `project-management/archive/`.
- Lot 5, slice 02, payment correction and negative balance: built and reviewed on
  `feat/online-topup`. Staff can correct a payment typed by hand. The correction is a new
  reversing row, allowed once per payment, and it may leave the balance below zero. One purchase
  guard now refuses at the counter, for express orders, and in the online cart and checkout. A
  negative balance e-mails every admin and the member once. The Typist coded it in seven green
  commits with the full end-to-end suite. The review asked for typed refusal codes, now fixed.
  Left alone on purpose: the archived lot 4 files under `specs/` still say the balance is never
  negative. The underpaid top-up notice moved to slice 03.
- Lot 5, slice 01, online top-up through HelloAsso: built and reviewed on `feat/online-topup`.
  Members top up from the account page and are credited once HelloAsso confirms the payment.
  The Typist coded the plan, the HelloAsso facts came from a research file, and a two-reviewer
  review caught two real faults (an unknown payment state ended as a final failure, and a down
  provider was never throttled), both fixed. Open: the human check against the real HelloAsso
  sandbox, and two questions for the Architect (a refused card retried in the same checkout, and
  an underpaid payment that stays pending). Slices 02 and 03 are still to do.

## 2026-11-22

- chisel init: installed the dev-workflow socle.
