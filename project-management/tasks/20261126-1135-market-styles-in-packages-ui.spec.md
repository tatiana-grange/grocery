# Market sizes, tones and toasts in `packages/ui`

**Status:** draft

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

## Context

The UI redesign (archived as `20261125-1155-ui-market-redesign`) could not change the component
props of `packages/ui`. So slices 02 and 03 typed the same styles by hand in `apps/web-spa`: 64 and
72 px buttons, a squash warning button, a straw pill, money figures in italic serif, and a kraft
tint with its own evening override. The reviewers flagged the copies each time (slice 03 work
document, retro proposal 1).

The shared toasts were left out too. They are 13 px, under the 14 px floor of the redesign, and
their `richColors` green and red come from outside the theme.

## Scope

**Included:**

- In `packages/ui`: two larger Button sizes, a warning Button variant, a straw Badge variant, an
  Amount component for money figures, and a kraft tint token for both modes.
- The Toaster restyled with theme colours and readable text.
- The screens of `apps/web-spa` that copied those styles by hand move to the new sizes, variants
  and component.

**Not Included:**

- Any new look: the screens look the same before and after, except the toasts.
- The API, the routes and the steps of any journey.

## Acceptance Criteria

- [ ] **button-sizes** — Button has an `xl` size of 64 px and a `2xl` size of 72 px, each with a
      visible label at 18 px or more.
- [ ] **warning-button** — Button has a `warning` variant on the squash colour, with text at 4.5:1 or
      more in both modes.
- [ ] **straw-badge** — Badge has a `straw` variant, with text at 4.5:1 or more in both modes.
- [ ] **amount-component** — an `Amount` component shows a sum in euros, in the serif italic with
      tabular figures, from cents, in the language's number format.
- [ ] **kraft-tint-token** — `globals.css` holds a kraft tint for light and evening modes; no screen
      keeps a `dark:` override for the kraft footers.
- [ ] **no-hand-copies** — no file of `apps/web-spa/app` keeps the hand-typed large button sizes
      (`h-16`, `h-18` on a Button), the squash fill on a Button, or the serif italic money classes.
- [ ] **readable-toasts** — toast text is at least 14 px and its colours come from theme variables;
      no layout passes `richColors`.
- [ ] **components-unchanged-api** — no existing prop, `data-testid` or ARIA role changes; the new
      sizes and variants are additions.
- [ ] **e2e-green** — `pnpm e2e` passes with no existing test edited, skipped or deleted, apart from
      removing the toast exclusion from the text walkers.
- [ ] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

## Seams

- **Button and Badge** (`packages/ui/src/components/primitives/`) — new sizes and variants beside
  the existing ones.
- **The theme** (`packages/ui/src/styles/globals.css`) — one new tint token.
- **The Toaster** (`packages/ui/src/components/primitives/sonner.tsx`) — its look, not its API.

## Architecture

**System design:** the theme stays the only source of style. A size or tone used on two screens
lives in `packages/ui` and the screens name it, they do not repeat it.

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Implementation Decisions

- The contrast unit test of `packages/ui` (`theme.spec.ts`) covers the new token and variants.

## Testing Strategy

- Unit tests in `packages/ui` for each new size, variant and the Amount format, red first.
- The redesign's browser tests (`market-theme`, `member-phone`, `distribution-tablet`,
  `back-office-desktop`) prove the screens did not move; their text walkers stop skipping toasts.

## Slices & Dependencies

- **Slices:** 1. One task (blocked by: none)

## Deliverables

- [ ] The new sizes, variants, component and token in `packages/ui`.
- [ ] The screens moved to them.

## References

- Slice 03 work document of the redesign, "Retro proposals", proposal 1: the list of copied styles.
- Slice 03 work document, "Diff-Review Findings", "Toasts are 13 px": why the toasts were left.

## Notes

Drafted by the Architect on 2026-11-26 from the redesign's retro, on the human's go.

## Retrospective

Added at the close.
