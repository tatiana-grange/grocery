# 01 — Theme and shared components

**Status:** in-progress
**Blocked by:** None — can start immediately
**Parent:** [UI redesign — the "neighbourhood market" direction](../20261125-1155-ui-market-redesign.spec.md)

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

**What to build:** the "neighbourhood market" theme in `packages/ui`, and the shared components
restyled to match it. Once this slice lands, every screen of the app shows the new colours, fonts,
radii and text sizes, with its current layout. The layouts themselves change in slices 02 to 04.

The decisions, the colour values and the reference mockups are in the parent spec, "Context" and
"Acceptance Criteria". The theme sheet of the mockups is the artboard "Thème — palette, typo,
composants" on the page "Marché de quartier" of the canvas the parent spec links.

## Acceptance criteria

Each one is the parent criterion of the same name, checked on what this slice touches.

- [ ] **market-palette** — the light-mode values of the parent criterion, in
  `packages/ui/src/styles/globals.css`. No Citrus value is left.
- [ ] **evening-mode** — the dark mode keeps its toggle and gets the slate "evening" values of the
  parent criterion.
- [ ] **market-fonts** — headings in Lora, the rest in Onest; Host Grotesk no longer imported.
- [ ] **readable-text** — body text at least 18 px; no text below 14 px in the shared components.
- [ ] **no-forced-capitals** — no `uppercase` class in `packages/ui/src`.
- [ ] **touch-targets** — the default sizes of buttons, inputs, selects and tabs are at least 44 px
  high.
- [ ] **contrast-aa** — every text-on-background pair of both modes reaches 4.5:1. The work document
  lists each pair with its ratio.
- [ ] **awning-band** — a reusable awning band component exists in `packages/ui`, decorative only
  (hidden from assistive technology), drawn from theme variables.
- [ ] **components-unchanged-api** — no component's props, `data-testid` or ARIA role changes.
- [ ] **e2e-green** — `pnpm e2e` passes with no existing test edited, skipped or deleted.
- [ ] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

## Seams

- **The theme** (`packages/ui/src/styles/globals.css`) — the CSS variables every component reads.
- **The shared components** (`packages/ui/src/components/primitives/` and `components/app/`) —
  their look changes; their props and behaviour stay the same.

## Not included

- Any change to the four layouts of `apps/web-spa` beyond what the theme changes on its own (slices
  02 to 04).
- The `uppercase` classes in `apps/web-spa/app` (removed by the slice that redoes each space).

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Notes

The awning band is built here but placed in the layouts by slices 02 to 04.
