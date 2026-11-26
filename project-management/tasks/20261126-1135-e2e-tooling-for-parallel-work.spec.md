# E2E tooling for layout checks and parallel worktrees

**Status:** draft

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

## Context

The UI redesign (archived as `20261125-1155-ui-market-redesign`) ran slices side by side in two
worktrees and checked layouts in the browser. Its three slices left the same tooling gaps in their
retros:

- The overflow and small-text helpers were copied into three spec files and now differ. The copies
  missed a row cut inside a frame that scrolls on its own, and text squeezed into a narrow column;
  only screenshots caught them.
- Each slice wrote its own temporary Playwright config to take screenshots, and one left servers
  running.
- Outside CI, Playwright reuses any server on 3060 or 5273, so a run in one worktree can silently
  test the other worktree's code. A hand-made `mkdir` lock prevented it; one Typist waited about
  25 minutes for it. `pnpm test` was not under the lock, and two API tests failed once each.

## Scope

**Included:**

- One helper file in `apps/web-spa-e2e` for layout checks, used by the redesign's four browser
  tests.
- A committed screenshot command.
- A committed lock for browser and API test runs, and a guard against testing another checkout's
  servers.
- The E2E guide updated for each.

**Not Included:**

- New browser tests or changes to the app.
- CI: these tools are for local runs.

## Acceptance Criteria

- [ ] **one-layout-helper** — `expectNoHorizontalScroll`, the spilled-control check and the
      small-text walker live in one file of `apps/web-spa-e2e`; no spec file defines its own copy.
- [ ] **inner-scroll-caught** — the spill check reports an element that scrolls sideways inside the
      page (`scrollWidth` above `clientWidth` with `overflow-x` auto or hidden).
- [ ] **broken-word-caught** — the helper reports a short text broken inside a word, or above two
      lines in a box under 120 px wide.
- [ ] **shots-command** — one command takes routes, widths and light or evening mode, writes PNG
      files to a given folder, and starts and stops its own servers.
- [ ] **test-lock** — one script takes a lock before `pnpm e2e` or `pnpm test`, waits its turn in
      order, records its owner, and always releases it, even on failure.
- [ ] **no-foreign-servers** — outside CI, a run fails fast with a clear message when the servers on
      3060 or 5273 do not come from this checkout.
- [ ] **guide-updated** — `web-spa-e2e.mdx` explains the helper, the shots command and the lock.
- [ ] **e2e-green** — `pnpm e2e` passes; the four browser tests keep every case.
- [ ] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

## Seams

- **The layout helper** (`apps/web-spa-e2e`) — the functions the browser tests call.
- **The Playwright config and global setup** (`apps/web-spa-e2e/playwright.config.ts`,
  `global-setup.ts`) — server reuse and the checkout check.
- **The scripts** (`apps/web-spa-e2e/scripts`) — the lock and the shots command.

## Architecture

**System design:** the browser tests import their layout checks; the lock wraps the commands; the
config decides which servers a run may use.

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Implementation Decisions

- The new helper checks start red on a small fixture page that has the inner scroll and the broken
  word, then go green.

## Testing Strategy

- The redesign's four browser tests are the proof the helper keeps every old check.
- The lock is tested by two runs started together: the second waits, then runs.

## Slices & Dependencies

- **Slices:** 1. One task (blocked by: none)

## Deliverables

- [ ] The helper, the shots command, the lock and the guard.
- [ ] The guide section.

## References

- Redesign slice 02 work document, "Retro proposals", proposals 1 and 3.
- Redesign slice 03 work document, "Retro proposals", proposals 2 and 3.
- Redesign slice 04 work document, "Retro proposals", proposals 1, 2 and 3.

## Notes

Drafted by the Architect on 2026-11-26 from the redesign's retro, on the human's go.

## Retrospective

Added at the close.
