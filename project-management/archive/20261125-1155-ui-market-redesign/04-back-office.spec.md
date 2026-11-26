# 04 — Back office

**Status:** done
**Blocked by:** [01 — Theme and shared components](01-theme-and-shared-components.spec.md) (done)
**Parent:** [UI redesign — the "neighbourhood market" direction](../20261125-1155-ui-market-redesign.spec.md)

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

**What to build:** the back office laid out the "neighbourhood market" way. It is designed for a
computer (1440 px). It has a cream sidebar, page titles in Lora, roomy tables and status badges
written out in words. The journeys keep their steps: members, catalogue, purchasing, inventory,
participation slots and accounting all work as today.

The reference is the artboard "Back-office — adhérents" on the page "Marché de quartier" of the canvas
the parent spec links. It shows the following, from top to bottom:

- **The sidebar:**
  - on the card background, with a 2 px right border;
  - the awning band at its top;
  - "Grocery" in Lora 30 px, with "Gestion de l'épicerie" below it;
  - the links at 18 px semibold, with the current link filled in sage;
  - at the bottom, a straw "Ouvrir la distribution" button, 52 px high.
- **The page title:** Lora 52 px, with a short line of explanation under it. Small figure cards sit
  beside it.
- **Search and filters:** a search field 52 px high, then a group of filter buttons.
- **The table:**
  - a frame with a 2 px border and a 16 px radius;
  - a kraft-tinted heading row at 16 px bold, and body rows at 17 px;
  - 1 px kraft lines between rows;
  - statuses in badges with words;
  - row actions as 44 px buttons.

## Acceptance criteria

- [x] **sidebar** — the back office sidebar follows the reference: "Grocery" in Lora with its
      subtitle, the awning band, every current link with an icon and a label, the current page marked
      (`aria-current="page"` or the component's active state), and the way to the distribution table at
      the bottom as a visible button. The links keep their `data-testid` (`back-office-nav-*`,
      `nav-logout`). It still folds away on small screens as today.
- [x] **page-heads** — each back office page opens with its title in Lora and, where the page has
      one today, its short explanation.
- [x] **tables** — the back office tables (members, catalogue, purchasing, inventory, slots,
      accounting) use the reference look: framed, heading row tinted, body text at least 16 px, row
      actions at least 44 px high with a visible label. Wide tables scroll inside their frame, never the
      page.
- [x] **status-words** — every status (membership, order, stock, slot) is a badge with a word, never
      a colour alone.
- [x] **pagination-labels** — `ListPagination` in `packages/ui` takes optional label props
      (previous, next, page of), with today's text as the default. The back office passes translated
      labels. No existing prop changes.
- [x] **no-forced-capitals** — no `uppercase` class left in `back-office-layout.tsx` and in
      `features/admin-*` and `features/catalog`.
- [x] **readable-text** — in those same files, body text is at least 16 px in tables and 18 px
      elsewhere, and nothing is below 14 px.
      _(Mason, 2026-11-25: sentences are 18 px or more; short labels beside a value are 16 px, as
      in slice 02. The reading of "body text" is left to the Architect; see Diff-Review Findings
      in the work document.)_
- [x] **theme-colours-only** — in those same files, no raw Tailwind colour and no hex value: only
      theme variables.
- [x] **no-overflow-desktop** — at 1440 × 900 and at 1194 × 834, in light and evening mode, the back
      office pages have no horizontal page scroll and nothing cut. A new Playwright test checks the
      members list, the catalogue and the accounting page at both sizes. It fails before the change.
- [x] **i18n-intact** — no hard-coded text; every new key exists in French and English.
- [x] **e2e-green** — `pnpm e2e` passes with no existing test edited, skipped or deleted.
- [x] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

## Seams

- **The layout** `apps/web-spa/app/features/common/components/back-office-layout.tsx` and the
  `Sidebar` of `packages/ui` it uses. A change to the sidebar component keeps its props.
- **`ListPagination`** in `packages/ui/src/components/app/list-pagination.tsx` — one additive,
  optional change.
- **The back office screens** in `features/admin-*` and `features/catalog` — their look changes;
  their logic, routes and `data-testid` do not.

## Not included

- The distribution table and the wallet components (slice 03, built at the same time by another
  Mason).
- New figures or filters that need new data. The figure cards of the reference are drawn only where
  the page already has the number.
- Any change to a route, a guard, the API or a journey's steps.
- The period-picker race in accounting (a separate follow-up). Restyle the picker, but leave its
  logic alone.

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Notes

- Slices 03 and 04 are built at the same time, each in its own git worktree. This slice owns the files
  above and nothing else; `app-settings-menu.tsx` and the shop and member layouts are off limits. Both
  slices add keys to the same locale files: add yours in one block, so the merge stays simple.
- The reference shows the "Participation" link as "Créneaux". Keep today's label.
