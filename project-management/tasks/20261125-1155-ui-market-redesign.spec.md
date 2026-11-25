# UI redesign — the "neighbourhood market" direction

**Status:** ready

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

## Context

The current interface of Grocery (the "Citrus" theme, lime and teal) feels generic and cold. Moving
between the four spaces (member, distribution, back office, sign-in) is confusing, the app works
poorly on a phone, and the admin screens are badly balanced in density. Some members are elderly:
readability comes before effect.

Decisions of the project owner, 25 November 2026:

- The redesign covers **the look and the navigation**. The journeys (ordering, handing over, managing
  stock…) keep their steps.
- **Every space** changes, with **one theme** for the whole app. Only the shape of the navigation and
  the density change from one space to another.
- The chosen direction is **"neighbourhood market"** ("Marché de quartier"). A "coop poster" direction
  was also drawn and judged too modern for elderly members.

The reference mockups are on the canvas
[Grocery — directions visuelles](https://claude.ai/artifact/S1kM27fNnE7KpWaMMJ6Nt4), page "Marché de
quartier": the theme sheet, the shop on a phone, the distribution table on a tablet and the member list
on a desktop. The link is private to the project owner.

## Scope

**Included:**

- The theme in `packages/ui`: colours, fonts, radii and text sizes.
- The look of the shared components in `packages/ui`: buttons, fields, cards, badges, tables, tabs,
  sidebar, dialogs.
- A striped "awning" band, a small reusable decoration at the top of the layouts.
- The four layouts of `apps/web-spa` and the screens they hold:
  - the member space (shop, product page, cart, account, top-up return, participation), with a
    **tab bar at the bottom of the screen on phones**;
  - sign-in and registration;
  - the distribution table, designed for a tablet, with the member search always visible;
  - the back office, with its sidebar.

**Not Included:**

- Any change to the API, the data or a business rule.
- Any change to the steps of a journey.
- `apps/web-ssr` and the documentation site.
- A per-member "larger text" setting (an idea for later).

## Acceptance Criteria

- [ ] **market-palette** — in light mode, the colour variables of
  `packages/ui/src/styles/globals.css` give: cream background `#F7F1E3`, ink-brown text `#2B241C`,
  sage primary `#4E6B4A`, squash warning `#B4541A`, and the straw `#E9C46A`, kraft `#D9C3A0` and slate
  `#2F3A33` tones. No Citrus value is left.
- [ ] **market-fonts** — headings use Lora and everything else uses Onest. Host Grotesk is no longer
  imported.
- [ ] **readable-text** — body text is at least 18 px; no interface text is below 14 px.
- [ ] **no-forced-capitals** — no `uppercase` class in `apps/web-spa/app` or `packages/ui/src`.
- [ ] **touch-targets** — buttons, action links and tabs are at least 44 px high.
- [ ] **contrast-aa** — every text-on-background pair of the theme reaches a contrast of at least
  4.5:1.
- [ ] **icon-with-label** — no navigation or main action button shows an icon alone; a visible label
  goes with it.
- [ ] **mobile-tab-bar** — below 768 px wide, the member space shows a tab bar fixed at the bottom
  (Shop, Cart, Participation, My account); above it, the navigation is at the top.
- [ ] **evening-mode** — the dark mode stays, with its existing toggle: a slate background, cream
  text, and the same sage and squash action colours, each pair at 4.5:1 or more.
- [ ] **shop-grid-default** — on phones the shop still opens in the grid view; each product card's add
  button shows the word "Add" ("Ajouter"), not an icon alone.
- [ ] **distribution-search-visible** — on the distribution table, the "Find a member" field stays
  visible while a member's page is open.
- [ ] **i18n-intact** — no hard-coded text is added; every new translation key exists in French and
  English.
- [ ] **e2e-green** — `pnpm e2e` passes with no existing test edited, skipped or deleted.
- [ ] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

## Seams

- **The theme** (`packages/ui/src/styles/globals.css`) — the CSS variables every component reads.
  Changing a value here changes the whole app.
- **The shared components** (`packages/ui/src/components/primitives/`) — their look changes; their
  props and behaviour stay the same.
- **The four layouts** (`apps/web-spa/app/features/common/components/*-layout.tsx`) — each carries the
  navigation of its space. The routes in `apps/web-spa/app/routes.ts` do not change.

## Architecture

**System design:** the theme is the only source of style. Screens hold no hard-coded colour or font:
they go through the theme variables and the `packages/ui` components. Layouts only decide the
navigation and the density of their space. A new colour goes into the theme first.

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Implementation Decisions

- Lora and Onest are already installed by `packages/ui` (`@fontsource-variable` packages): no font is
  loaded from Google Fonts.
- Components keep their `data-testid` attributes and ARIA roles: the E2E suite relies on them.
- The straw, kraft and slate tones decorate; they never carry information on their own. A status is
  always written out in words.

## Testing Strategy

- The existing E2E suite is the safety net: it proves the journeys did not move.
- A visual check on the disposable E2E stack at 390 px (phone), 1194 px (tablet) and 1440 px
  (desktop), with screenshots for the pull request.
- The criteria that a search can check (`uppercase`, Citrus colours, Host Grotesk) are checked with
  `grep` at the close.

## Slices & Dependencies

- **Slices:**
  1. Theme and shared components (blocked by: none)
  2. Member space and sign-in, with the mobile tab bar (blocked by: 1)
  3. Distribution table (blocked by: 1)
  4. Back office (blocked by: 1)

Slices 2, 3 and 4 are independent of each other. Each slice ends on a working app: a space not yet
redone keeps its old layout with the new theme.

## Deliverables

- [ ] The new theme and restyled components in `packages/ui`.
- [ ] The four spaces redone in `apps/web-spa`.
- [ ] Before-and-after screenshots for the pull request.

## References

- `apps/documentation/src/content/docs/references/frontend.mdx`, "General Instructions": folder
  structure, shadcn/ui, i18n with no hard-coded text.
- The canvas [Grocery — directions visuelles](https://claude.ai/artifact/S1kM27fNnE7KpWaMMJ6Nt4),
  page "Marché de quartier": the reference mockups.

## Notes

**Branch.** The task branches off `feat/accounting-exports`, not `staging`. `staging` does not have
the participation and accounting screens yet, and the redesign touches them. The pull request will
target `feat/accounting-exports`.

**Answered questions** (asked by the Architect and answered by the project owner, 25 November 2026):

1. **Dark mode: kept**, as an "evening" variant on a slate background. See `evening-mode`.
2. **"Participation" label: kept.** The tab is not renamed "Créneaux", so the E2E suite stays intact.
3. **Shop on phones: grid kept** as the default view, as today. The list view stays one choice away.

## Retrospective

Added at the close.
