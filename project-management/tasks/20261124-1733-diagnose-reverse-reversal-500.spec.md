# Diagnose: reversing a reversal answered 500 once

**Status:** draft

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

## Context

During the lot 7 full `pnpm test` run on 2026-11-24, the distribution test "refuses reversing a
reversal" (`apps/api/src/modules/distribution/tests/distribution.controller.e2e-spec.ts`) got a
500 instead of the expected 409 refusal. It passed on the rerun. The wallet and distribution
tests are already known to fail now and then in a full run (`AGENTS.md`, "Known flaky tests"),
but a 500 is a server error, not slowness: something threw that the route does not turn into a
refusal. Proposed in the lot 7 retrospective, approved by the human on 2026-11-24.

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
- [ ] **reversal-of-reversal-refused** — reversing a reversal answers 409 every time, proven by
      the regression test run in a loop.
- [ ] **suite-green** — `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.

## Seams

- **Handover reversal route** — `POST` reversal of a handover. Observable over HTTP: status and
  refusal code.

## Architecture

**System design:** no change planned before the cause is known.

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Implementation Decisions

## Testing Strategy

- Start from the test alone in a loop, then inside the full suite, then with the test app's
  single database connection under load (`apps/documentation/src/content/docs/guides/api-testing.mdx`,
  "One database connection per test app").

## Slices & Dependencies

- **Slices:** none.

## Deliverables

- [ ] The fix and its regression test, or a written finding.

## References

- `project-management/archive/20261124-1558-lot-7-accounting-and-exports.work.md` — the
  worklog line of the run that saw the 500.

## Notes

## Retrospective
