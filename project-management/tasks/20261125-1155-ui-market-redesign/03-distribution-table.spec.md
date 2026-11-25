# 03 — Distribution table

**Status:** in-progress
**Blocked by:** [01 — Theme and shared components](01-theme-and-shared-components.spec.md) (done)
**Parent:** [UI redesign — the "neighbourhood market" direction](../20261125-1155-ui-market-redesign.spec.md)

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

**What to build:** the distribution table laid out the "neighbourhood market" way. It is designed for
a tablet in landscape (1194 × 834) and used standing up, with a queue waiting. The member search stays
on the left at all times. The open member's page is on the right: their balance, what to hand over,
and large action buttons. The journeys keep their steps: finding a member, handing over, taking a
payment, the express sale, correcting a payment and refunding all work as today.

The reference is the artboard "Distribution — tablette" on the page "Marché de quartier" of the
canvas the parent spec links.

## Acceptance criteria

- [ ] **distribution-search-visible** — from 1024 px up, the "Trouver un adhérent" search and its
      results sit in a left column on every distribution page: the home page, a member's page, the
      express sale and a handover receipt. Picking another member from that column opens their page
      without going back first. Below 1024 px the search sits above the content.
- [ ] **one-search** — the search field and its results exist once on the page. They keep their
      `data-testid` values (`distribution-member-search`, `distribution-search-results`,
      `distribution-search-empty`, and the rest). No locator matches two elements.
- [ ] **member-pane** — a member's page shows, from top to bottom: the member's name in Lora and
      number, the balance in a block that stands out, the list of what to hand over with its total, any
      warning, then the actions. The search result of the open member is marked as current
      (`aria-current`).
- [ ] **big-actions** — the main actions of the table (validating a handover, recording a payment,
      the express sale) are at least 64 px high, with a visible label. Validating a handover is the
      primary button.
- [ ] **header** — the top bar shows "Distribution" in Lora, the links to the shop and to the
      account, sign-out and the settings, each with an icon and a label. The awning band sits above it.
      `distribution-home-link` and `nav-logout` keep their `data-testid`.
- [ ] **wallet-screens** — the wallet components the table uses (`record-payment-form`,
      `correct-payment-dialog`, `refund-dialog`, `wallet-panel`, `negative-balance-notice`, and the
      `insufficient-balance-dialog`) use the market look. `wallet-panel` and `negative-balance-notice`
      also appear on the member's account and cart pages: those must still look right.
- [ ] **no-forced-capitals** — no `uppercase` class left in `features/distribution`,
      `features/wallet` and `distribution-layout.tsx`.
- [ ] **readable-text** — in those same files, body text is at least 18 px and nothing is below
      14 px.
- [ ] **theme-colours-only** — in those same files, no raw Tailwind colour (`amber-*`, `red-*`,
      `green-*`, and the like) and no hex value: only theme variables.
- [ ] **no-overflow-tablet** — at 1194 × 834 and at 768 × 1024, in light and evening mode, the
      distribution pages and the wallet dialogs have no horizontal scroll and nothing cut. A new
      Playwright test at 1194 × 834 checks it and checks that the search stays visible on a member's
      page. It fails before the change.
- [ ] **i18n-intact** — no hard-coded text; every new key exists in French and English.
- [ ] **e2e-green** — `pnpm e2e` passes with no existing test edited, skipped or deleted.
- [ ] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

## Seams

- **The layout** `apps/web-spa/app/features/common/components/distribution-layout.tsx` — it holds the
  header, the awning band and, in this slice, the search column beside the `Outlet`. Its guard does
  not change.
- **The distribution screens** in `features/distribution/components/` — their look changes; their
  logic, routes and `data-testid` do not.
- **The wallet components** in `features/wallet/components/`.

## Not included

- The back office (slice 04, built at the same time by another Mason).
- Any change to `packages/ui`, to `app-settings-menu.tsx`, or to the shop and member layouts. If one
  seems needed, stop and ask the Architect.
- Any change to a route, a guard, the API or a journey's steps.
- The period-picker race in accounting (a separate follow-up).

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Notes

- Slices 03 and 04 are built at the same time, each in its own git worktree. This slice owns the files
  above and nothing else. Both slices add keys to the same locale files: add yours in one block, so
  the merge stays simple.
- Moving the search into the layout must not leave a second copy on the home page.
