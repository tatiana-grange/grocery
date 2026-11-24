# Diagnose: reversing a reversal answered 500 once

**Status:** blocked — Docker does not answer; one test run and `pnpm test` left before the close (see the work document)

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

## Context

During the lot 7 full `pnpm test` run on 2026-11-24, the distribution test "refuses reversing a
reversal" (`apps/api/src/modules/distribution/tests/distribution.controller.e2e-spec.ts`) got a
500 instead of the expected 409 refusal. It passed on the rerun. The wallet and distribution
tests are already known to fail now and then in a full run (`AGENTS.md`, "Known flaky tests"),
but a 500 is a server error, not slowness: something threw that the route does not turn into a
refusal. Proposed in the lot 7 retrospective, approved by the human on 2026-11-24, who asked to start it
the same day. Branch: `fix/reverse-reversal-500`, off `staging`.

## Scope

**Included:**

- Build a repeatable check that makes the 500 appear (the `diagnosing-bugs` skill: a failing
  check first, then the theory).
- Find the cause and fix it, with a regression test.

**Not Included:**

- The other flaky wallet and distribution tests, unless they share the cause.

## Acceptance Criteria

- [ ] **failure-reproduced** — a check makes the 500 appear on demand, or the work document
      says why it could not, and what was tried.
- [ ] **cause-named** — the work document names the cause, with the evidence.
- [ ] ~~**reversal-of-reversal-refused** — reversing a reversal answers 409 every time, proven by
      the regression test run in a loop.~~
- [ ] **reversal-of-reversal-refused** (amended 2026-11-24 by the Architect: the stray answer
      comes about once in 4,500 calls, so no loop of one test can show it) — the test app owns
      its port on 127.0.0.1, pinned by a regression test; the test "refuses reversing a
      reversal" checks that its first reversal answers 201; and the work document shows the
      harness (stray answers before the fix, none after on the same number of calls) and three
      green full API runs in a row.
- [ ] **suite-green** — `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.

## Seams

- **Handover reversal route** — `POST` reversal of a handover. Observable over HTTP: status and
  refusal code.
- **Test app setup** (`initializeTestApp`, added 2026-11-24 by the Architect once the cause was
  known) — the app listens on 127.0.0.1 before any request. Observable: the address and port it
  holds, and a competing server refused on that port.

## Architecture

**System design:** no change planned before the cause is known.

Updated 2026-11-24 by the Architect, after the diagnosis: the cause is in the test setup, not in
the app. Supertest started the app on a random port per request, and macOS could hand out a port
another local program held on 127.0.0.1, which then answered instead. The fix starts the test app
once on 127.0.0.1. No product code changes.

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Implementation Decisions

## Testing Strategy

- Start from the test alone in a loop, then inside the full suite, then with the test app's
  single database connection under load. The HTTP test app has a pool of one database
  connection, and parallel calls on it fail now and then with `ECONNRESET` (seen in lots 6 and
  7; written in the API testing guide on the unmerged branch `feat/accounting-exports`).
  Updated 2026-11-24 by the Architect: the diagnosis showed those `ECONNRESET` errors came from
  the same port clash, not from the one-connection pool.

## Slices & Dependencies

- **Slices:** none.

## Deliverables

- [ ] The fix and its regression test, or a written finding.

## References

- `project-management/archive/20261124-1558-lot-7-accounting-and-exports.work.md`, on the
  unmerged branch `feat/accounting-exports` (read it with `git show feat/accounting-exports:<path>`)
  — the worklog line of the run that saw the 500.

## Notes

## Retrospective
